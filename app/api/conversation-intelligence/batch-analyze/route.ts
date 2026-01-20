import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { emotionDetectionService } from "@/lib/ai/emotion-detection"
import { intentClassificationService } from "@/lib/ai/intent-classifier"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"
import { ValidationError } from "@/lib/errors"

// POST /api/conversation-intelligence/batch-analyze - Batch processing for historical data
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      conversations,
      tenantId,
      options = {}
    } = body

    // Validate required fields
    if (!conversations || !Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json({
        error: "Conversations array is required and cannot be empty"
      }, { status: 400 })
    }

    // Check tenant access if tenantId provided
    if (tenantId) {
      await tenantService.checkTenantAccess(user.id, tenantId)
    }

    // Get or determine tenant context
    const tenantContext = await tenantService.getTenantContext(user.id, tenantId)
    const effectiveTenantId = tenantId || tenantContext.tenant.id

    logger.info('Starting batch conversation analysis', {
      conversationCount: conversations.length,
      tenantId: effectiveTenantId
    })

    // Validate conversations structure
    for (const conversation of conversations) {
      if (!conversation.conversationId || !conversation.messages) {
        return NextResponse.json({
          error: "Each conversation must have conversationId and messages array"
        }, { status: 400 })
      }

      if (!Array.isArray(conversation.messages) || conversation.messages.length === 0) {
        return NextResponse.json({
          error: "Each conversation must have a non-empty messages array"
        }, { status: 400 })
      }

      for (const message of conversation.messages) {
        if (!message.messageId || !message.text) {
          return NextResponse.json({
            error: "Each message must have messageId and text"
          }, { status: 400 })
        }
      }
    }

    // Process conversations in parallel for better performance
    const analysisPromises = conversations.map(async (conversation) => {
      try {
        const [emotionAnalyses, intentAnalyses] = await Promise.all([
          Promise.all(conversation.messages.map((message: any) =>
            emotionDetectionService.detectEmotions({
              text: message.text,
              conversationId: conversation.conversationId,
              messageId: message.messageId,
              language: conversation.language,
              options: options.emotionOptions
            })
          )),
          Promise.all(conversation.messages.map((message: any) =>
            intentClassificationService.classifyIntent({
              text: message.text,
              conversationId: conversation.conversationId,
              messageId: message.messageId,
              language: conversation.language,
              options: options.intentOptions
            })
          ))
        ])

        return {
          conversationId: conversation.conversationId,
          emotions: emotionAnalyses,
          intents: intentAnalyses
        }
      } catch (error) {
        logger.error('Failed to analyze conversation', error as Error, {
          conversationId: conversation.conversationId
        })

        // Return partial results for this conversation
        return {
          conversationId: conversation.conversationId,
          error: (error as Error).message,
          emotions: [],
          intents: []
        }
      }
    })

    const results = await Promise.all(analysisPromises)

    // Store results in database (if tables exist)
    try {
      await storeBatchConversationInsights(supabase, results, effectiveTenantId, user.id)
    } catch (storageError) {
      logger.error('Failed to store batch conversation insights', storageError as Error, {
        tenantId: effectiveTenantId,
        conversationCount: conversations.length
      })
    }

    const processingTime = Date.now() - startTime

    const response = {
      success: true,
      processedConversations: results.length,
      results,
      processingTime,
      timestamp: new Date().toISOString()
    }

    logger.info('Batch conversation analysis completed', {
      processedConversations: results.length,
      processingTime,
      tenantId: effectiveTenantId
    })

    return NextResponse.json(response)

  } catch (error) {
    const processingTime = Date.now() - startTime

    logger.error('Batch conversation analysis failed', error as Error, {
      processingTime
    })

    if (error instanceof ValidationError) {
      return NextResponse.json({
        error: error.message
      }, { status: 400 })
    }

    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 })
  }
}

// Helper function to store batch conversation insights
async function storeBatchConversationInsights(
  supabase: any,
  results: any[],
  tenantId: string,
  userId: string
) {
  const emotionInserts = []
  const intentInserts = []
  const insightInserts = []

  for (const result of results) {
    if (result.error) continue

    for (let i = 0; i < result.emotions.length; i++) {
      const emotion = result.emotions[i]
      const intent = result.intents[i]

      if (emotion) {
        emotionInserts.push({
          conversation_id: result.conversationId,
          message_id: emotion.messageId,
          tenant_id: tenantId,
          dominant_emotion: emotion.dominantEmotion,
          overall_sentiment: emotion.overallSentiment,
          confidence_score: emotion.confidence,
          emotion_scores: emotion.emotions,
          language: emotion.language,
          processing_time_ms: emotion.processingTime,
          created_at: emotion.timestamp,
          created_by: userId
        })
      }

      if (intent) {
        intentInserts.push({
          conversation_id: result.conversationId,
          message_id: intent.messageId,
          tenant_id: tenantId,
          primary_intent: intent.primaryIntent,
          secondary_intent: intent.secondaryIntent,
          urgency_level: intent.urgency,
          complexity_level: intent.complexity,
          confidence_score: intent.confidence,
          intent_scores: intent.intents,
          entities: intent.entities,
          context_keywords: intent.contextKeywords,
          language: intent.language,
          processing_time_ms: intent.processingTime,
          created_at: intent.timestamp,
          created_by: userId
        })
      }

      // Combined insights
      if (emotion && intent) {
        insightInserts.push({
          conversation_id: result.conversationId,
          message_id: emotion.messageId,
          tenant_id: tenantId,
          emotion_data: emotion,
          intent_data: intent,
          combined_confidence: Math.min(emotion.confidence, intent.confidence),
          created_at: new Date().toISOString(),
          created_by: userId
        })
      }
    }
  }

  // Execute batch inserts
  if (emotionInserts.length > 0) {
    await supabase.from('conversation_emotions').insert(emotionInserts)
  }

  if (intentInserts.length > 0) {
    await supabase.from('conversation_intents').insert(intentInserts)
  }

  if (insightInserts.length > 0) {
    await supabase.from('conversation_insights').insert(insightInserts)
  }
}