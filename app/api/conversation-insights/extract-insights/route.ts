import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { insightExtractionService } from "@/lib/ai/insight-extractor"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"
import { ValidationError } from "@/lib/errors"

// POST /api/conversation-insights/extract-insights - Extract insights from conversation data
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
      conversationId,
      messages,
      tenantId,
      context,
      options = {}
    } = body

    // Validate required fields
    if (!conversationId) {
      return NextResponse.json({
        error: "Conversation ID is required"
      }, { status: 400 })
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({
        error: "Messages array is required and cannot be empty"
      }, { status: 400 })
    }

    // Check tenant access if tenantId provided
    if (tenantId) {
      await tenantService.checkTenantAccess(user.id, tenantId)
    }

    // Get or determine tenant context
    const tenantContext = await tenantService.getTenantContext(user.id, tenantId)
    const effectiveTenantId = tenantId || tenantContext.tenant.id

    logger.info('Starting insight extraction', {
      conversationId,
      messageCount: messages.length,
      tenantId: effectiveTenantId
    })

    // Extract insights
    const insights = await insightExtractionService.extractInsights({
      conversationId,
      messages: messages.map(msg => ({
        messageId: msg.messageId || `msg_${Date.now()}_${Math.random()}`,
        text: msg.text,
        timestamp: msg.timestamp || new Date().toISOString(),
        sender: msg.sender,
        emotion: msg.emotion,
        intent: msg.intent
      })),
      context,
      options
    })

    // Store insights in database (if tables exist)
    try {
      await storeConversationInsights(supabase, {
        conversationId,
        tenantId: effectiveTenantId,
        insights,
        userId: user.id
      })
    } catch (storageError) {
      logger.error('Failed to store conversation insights', storageError as Error, {
        conversationId,
        tenantId: effectiveTenantId
      })
    }

    const processingTime = Date.now() - startTime

    const response = {
      success: true,
      conversationId,
      insights,
      insightsCount: insights.length,
      processingTime,
      timestamp: new Date().toISOString()
    }

    logger.info('Insight extraction completed', {
      conversationId,
      insightsExtracted: insights.length,
      averageConfidence: insights.length > 0 ?
        insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length : 0,
      processingTime,
      tenantId: effectiveTenantId
    })

    return NextResponse.json(response)

  } catch (error) {
    const processingTime = Date.now() - startTime

    logger.error('Insight extraction failed', error as Error, {
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

// Helper function to store conversation insights
async function storeConversationInsights(
  supabase: any,
  data: {
    conversationId: string
    tenantId: string
    insights: any[]
    userId: string
  }
) {
  const { conversationId, tenantId, insights, userId } = data

  if (insights && insights.length > 0) {
    const insightInserts = insights.map(insight => ({
      conversation_id: conversationId,
      tenant_id: tenantId,
      insight_id: insight.insightId,
      type: insight.type,
      category: insight.category,
      title: insight.title,
      description: insight.description,
      severity: insight.severity,
      confidence_score: insight.confidence,
      actionable: insight.actionable,
      recommended_actions: insight.recommendedActions,
      related_entities: insight.relatedEntities,
      related_topics: insight.relatedTopics,
      impact: insight.impact,
      timeframe: insight.timeframe,
      metadata: insight.metadata,
      created_at: insight.timestamp,
      created_by: userId
    }))

    await supabase.from('conversation_insights').insert(insightInserts)
  }
}