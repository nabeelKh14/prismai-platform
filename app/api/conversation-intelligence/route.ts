import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { emotionDetectionService } from "@/lib/ai/emotion-detection"
import { intentClassificationService } from "@/lib/ai/intent-classifier"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"
import { ValidationError } from "@/lib/errors"

// POST /api/conversation-intelligence - Real-time conversation analysis
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
      text,
      conversationId,
      messageId,
      language = 'en',
      tenantId,
      options = {}
    } = body

    // Validate required fields
    if (!text?.trim()) {
      return NextResponse.json({
        error: "Text content is required"
      }, { status: 400 })
    }

    if (!conversationId) {
      return NextResponse.json({
        error: "Conversation ID is required"
      }, { status: 400 })
    }

    // Check tenant access if tenantId provided
    if (tenantId) {
      await tenantService.checkTenantAccess(user.id, tenantId)
    }

    // Get or determine tenant context
    const tenantContext = await tenantService.getTenantContext(user.id, tenantId)
    const effectiveTenantId = tenantId || tenantContext.tenant.id

    logger.info('Starting conversation intelligence analysis', {
      conversationId,
      messageId,
      tenantId: effectiveTenantId,
      textLength: text.length
    })

    // Run emotion detection and intent classification in parallel
    const [emotionAnalysis, intentAnalysis] = await Promise.all([
      emotionDetectionService.detectEmotions({
        text,
        conversationId,
        messageId,
        language,
        options: options.emotionOptions
      }),
      intentClassificationService.classifyIntent({
        text,
        conversationId,
        messageId,
        language,
        options: options.intentOptions
      })
    ])

    // Store results in database (if tables exist)
    try {
      await storeConversationInsights(supabase, {
        conversationId,
        messageId,
        tenantId: effectiveTenantId,
        emotionAnalysis,
        intentAnalysis,
        userId: user.id
      })
    } catch (storageError) {
      // Log but don't fail the request if storage fails
      logger.error('Failed to store conversation insights', storageError as Error, {
        conversationId,
        tenantId: effectiveTenantId
      })
    }

    const processingTime = Date.now() - startTime

    const response = {
      success: true,
      conversationId,
      messageId,
      emotion: emotionAnalysis,
      intent: intentAnalysis,
      processingTime,
      timestamp: new Date().toISOString()
    }

    logger.info('Conversation intelligence analysis completed', {
      conversationId,
      dominantEmotion: emotionAnalysis.dominantEmotion,
      primaryIntent: intentAnalysis.primaryIntent,
      processingTime,
      tenantId: effectiveTenantId
    })

    return NextResponse.json(response)

  } catch (error) {
    const processingTime = Date.now() - startTime

    logger.error('Conversation intelligence analysis failed', error as Error, {
      processingTime,
      body: request.body
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

// GET /api/conversation-intelligence - Health check and service info
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Run health checks on both services
    const [emotionHealth, intentHealth] = await Promise.all([
      emotionDetectionService.healthCheck(),
      intentClassificationService.healthCheck()
    ])

    const healthStatus = emotionHealth && intentHealth ? 'healthy' : 'degraded'

    return NextResponse.json({
      status: healthStatus,
      services: {
        emotion_detection: {
          healthy: emotionHealth,
          version: '1.0.0'
        },
        intent_classification: {
          healthy: intentHealth,
          version: '1.0.0'
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Conversation intelligence health check failed', error as Error)

    return NextResponse.json({
      status: 'unhealthy',
      error: 'Service health check failed',
      timestamp: new Date().toISOString()
    }, { status: 503 })
  }
}

// Helper function to store conversation insights
async function storeConversationInsights(
  supabase: any,
  data: {
    conversationId: string
    messageId?: string
    tenantId: string
    emotionAnalysis: any
    intentAnalysis: any
    userId: string
  }
) {
  const { conversationId, messageId, tenantId, emotionAnalysis, intentAnalysis, userId } = data

  // Store emotion analysis
  if (emotionAnalysis) {
    await supabase.from('conversation_emotions').upsert({
      conversation_id: conversationId,
      message_id: messageId,
      tenant_id: tenantId,
      dominant_emotion: emotionAnalysis.dominantEmotion,
      overall_sentiment: emotionAnalysis.overallSentiment,
      confidence_score: emotionAnalysis.confidence,
      emotion_scores: emotionAnalysis.emotions,
      language: emotionAnalysis.language,
      processing_time_ms: emotionAnalysis.processingTime,
      created_at: emotionAnalysis.timestamp,
      created_by: userId
    })
  }

  // Store intent analysis
  if (intentAnalysis) {
    await supabase.from('conversation_intents').upsert({
      conversation_id: conversationId,
      message_id: messageId,
      tenant_id: tenantId,
      primary_intent: intentAnalysis.primaryIntent,
      secondary_intent: intentAnalysis.secondaryIntent,
      urgency_level: intentAnalysis.urgency,
      complexity_level: intentAnalysis.complexity,
      confidence_score: intentAnalysis.confidence,
      intent_scores: intentAnalysis.intents,
      entities: intentAnalysis.entities,
      context_keywords: intentAnalysis.contextKeywords,
      language: intentAnalysis.language,
      processing_time_ms: intentAnalysis.processingTime,
      created_at: intentAnalysis.timestamp,
      created_by: userId
    })
  }

  // Store combined insights
  await supabase.from('conversation_insights').upsert({
    conversation_id: conversationId,
    message_id: messageId,
    tenant_id: tenantId,
    emotion_data: emotionAnalysis,
    intent_data: intentAnalysis,
    combined_confidence: Math.min(emotionAnalysis.confidence, intentAnalysis.confidence),
    created_at: new Date().toISOString(),
    created_by: userId
  })
}