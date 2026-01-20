import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { conversationSummarizationService } from "@/lib/ai/conversation-summarizer"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"
import { ValidationError } from "@/lib/errors"

// POST /api/conversation-insights/summarize/{conversationId} - Generate conversation summary
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const startTime = Date.now()
  const { conversationId: resolvedConversationId } = await params
  const conversationId = resolvedConversationId

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      messages,
      tenantId,
      format = 'brief',
      language,
      options = {}
    } = body

    // Validate required fields
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

    logger.info('Starting conversation summarization', {
      conversationId,
      messageCount: messages.length,
      format,
      tenantId: effectiveTenantId
    })

    // Generate summary
    const summary = await conversationSummarizationService.summarizeConversation({
      conversationId,
      messages: messages.map(msg => ({
        messageId: msg.messageId || `msg_${Date.now()}_${Math.random()}`,
        text: msg.text,
        timestamp: msg.timestamp || new Date().toISOString(),
        sender: msg.sender,
        metadata: msg.metadata
      })),
      format,
      language,
      options
    })

    // Store summary in database (if tables exist)
    try {
      await storeConversationSummary(supabase, {
        conversationId,
        tenantId: effectiveTenantId,
        summary,
        userId: user.id
      })
    } catch (storageError) {
      logger.error('Failed to store conversation summary', storageError as Error, {
        conversationId,
        tenantId: effectiveTenantId
      })
    }

    const processingTime = Date.now() - startTime

    const response = {
      success: true,
      conversationId,
      summary,
      processingTime,
      timestamp: new Date().toISOString()
    }

    logger.info('Conversation summarization completed', {
      conversationId,
      format: summary.format,
      confidence: summary.confidence,
      processingTime,
      tenantId: effectiveTenantId
    })

    return NextResponse.json(response)

  } catch (error) {
    const processingTime = Date.now() - startTime

    logger.error('Conversation summarization failed', error as Error, {
      conversationId,
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

// GET /api/conversation-insights/summarize/{conversationId} - Get existing summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId: resolvedConversationId } = await params
  const conversationId = resolvedConversationId

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Query existing summary from database
    const { data: summary, error } = await supabase
      .from('conversation_summaries')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.error('Failed to fetch conversation summary', error, {
        conversationId
      })
      return NextResponse.json({
        error: "Failed to fetch summary"
      }, { status: 500 })
    }

    if (!summary) {
      return NextResponse.json({
        error: "No summary found for this conversation"
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      conversationId,
      summary: {
        summary: summary.summary_text,
        keyPoints: summary.key_points,
        outcomes: summary.outcomes,
        turningPoints: summary.turning_points,
        sentiment: summary.sentiment,
        format: summary.format,
        confidence: summary.confidence_score,
        messageCount: summary.message_count,
        duration: summary.duration_minutes,
        language: summary.language,
        createdAt: summary.created_at
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Get conversation summary failed', error as Error, {
      conversationId
    })

    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 })
  }
}

// Helper function to store conversation summary
async function storeConversationSummary(
  supabase: any,
  data: {
    conversationId: string
    tenantId: string
    summary: any
    userId: string
  }
) {
  const { conversationId, tenantId, summary, userId } = data

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