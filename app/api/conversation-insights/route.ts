import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { conversationSummarizationService } from "@/lib/ai/conversation-summarizer"
import { insightExtractionService } from "@/lib/ai/insight-extractor"
import { conversationPatternAnalysisService } from "@/lib/analytics/conversation-patterns"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"
import { ValidationError } from "@/lib/errors"

// POST /api/conversation-insights - Generate comprehensive conversation insights
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

    logger.info('Starting comprehensive conversation insights generation', {
      conversationId,
      messageCount: messages.length,
      tenantId: effectiveTenantId
    })

    // Run all analysis services in parallel for better performance
    const [summary, insights] = await Promise.all([
      conversationSummarizationService.summarizeConversation({
        conversationId,
        messages: messages.map(msg => ({
          messageId: msg.messageId || `msg_${Date.now()}_${Math.random()}`,
          text: msg.text,
          timestamp: msg.timestamp || new Date().toISOString(),
          sender: msg.sender,
          metadata: msg.metadata
        })),
        format: options.summaryFormat || 'brief',
        language: options.language,
        options: options.summaryOptions
      }),
      insightExtractionService.extractInsights({
        conversationId,
        messages: messages.map(msg => ({
          messageId: msg.messageId || `msg_${Date.now()}_${Math.random()}`,
          text: msg.text,
          timestamp: msg.timestamp || new Date().toISOString(),
          sender: msg.sender,
          emotion: msg.emotion,
          intent: msg.intent
        })),
        context: options.context,
        options: options.insightOptions
      })
    ])

    // Store results in database (if tables exist)
    try {
      await storeConversationInsights(supabase, {
        conversationId,
        tenantId: effectiveTenantId,
        summary,
        insights,
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
      summary,
      insights,
      insightsCount: insights.length,
      processingTime,
      timestamp: new Date().toISOString()
    }

    logger.info('Comprehensive conversation insights generation completed', {
      conversationId,
      summaryFormat: summary.format,
      insightsExtracted: insights.length,
      processingTime,
      tenantId: effectiveTenantId
    })

    return NextResponse.json(response)

  } catch (error) {
    const processingTime = Date.now() - startTime

    logger.error('Conversation insights generation failed', error as Error, {
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

// GET /api/conversation-insights - Health check and service info
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Run health checks on all services
    const [summarizationHealth, insightHealth, patternHealth] = await Promise.all([
      conversationSummarizationService.healthCheck(),
      insightExtractionService.healthCheck(),
      conversationPatternAnalysisService.healthCheck()
    ])

    const overallHealth = summarizationHealth && insightHealth && patternHealth
    const healthStatus = overallHealth ? 'healthy' : 'degraded'

    return NextResponse.json({
      status: healthStatus,
      services: {
        conversation_summarization: {
          healthy: summarizationHealth,
          version: '1.0.0'
        },
        insight_extraction: {
          healthy: insightHealth,
          version: '1.0.0'
        },
        pattern_analysis: {
          healthy: patternHealth,
          version: '1.0.0'
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Conversation insights health check failed', error as Error)

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
    tenantId: string
    summary: any
    insights: any[]
    userId: string
  }
) {
  const { conversationId, tenantId, summary, insights, userId } = data

  // Store conversation summary
  if (summary) {
    await supabase.from('conversation_summaries').upsert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      summary_text: summary.summary,
      key_points: summary.keyPoints,
      outcomes: summary.outcomes,
      turning_points: summary.turningPoints,
      sentiment: summary.sentiment,
      format: summary.format,
      confidence_score: summary.confidence,
      message_count: summary.messageCount,
      duration_minutes: summary.duration,
      language: summary.language,
      processing_time_ms: summary.processingTime,
      created_at: summary.timestamp,
      created_by: userId
    })
  }

  // Store conversation insights
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

  // Store combined insights record
  await supabase.from('conversation_insights_combined').upsert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    summary_data: summary,
    insights_data: insights,
    insights_count: insights.length,
    summary_confidence: summary?.confidence || 0,
    average_insight_confidence: insights.length > 0 ?
      insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length : 0,
    created_at: new Date().toISOString(),
    created_by: userId
  })
}