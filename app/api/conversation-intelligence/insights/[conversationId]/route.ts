import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"

// GET /api/conversation-intelligence/insights/[conversationId] - Retrieve stored insights
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

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const includeEmotions = searchParams.get('includeEmotions') !== 'false'
    const includeIntents = searchParams.get('includeIntents') !== 'false'

    // Check tenant access if tenantId provided
    if (tenantId) {
      await tenantService.checkTenantAccess(user.id, tenantId)
    }

    // Get or determine tenant context
    const tenantContext = await tenantService.getTenantContext(user.id, tenantId || undefined)
    const effectiveTenantId = tenantId || tenantContext.tenant.id

    logger.info('Retrieving conversation insights', {
      conversationId,
      tenantId: effectiveTenantId,
      includeEmotions,
      includeIntents
    })

    // Build query for conversation insights
    const insightsQuery = supabase
      .from('conversation_insights')
      .select(`
        *,
        emotion_data,
        intent_data
      `)
      .eq('conversation_id', conversationId)
      .eq('tenant_id', effectiveTenantId)
      .order('created_at', { ascending: false })

    const { data: insights, error: insightsError } = await insightsQuery

    if (insightsError) {
      logger.error('Failed to fetch conversation insights', insightsError, {
        conversationId,
        tenantId: effectiveTenantId
      })
      return NextResponse.json({
        error: "Failed to fetch conversation insights"
      }, { status: 500 })
    }

    // Get emotion data if requested
    let emotions = []
    if (includeEmotions) {
      const { data: emotionData, error: emotionError } = await supabase
        .from('conversation_emotions')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: true })

      if (emotionError) {
        logger.error('Failed to fetch emotion data', emotionError, {
          conversationId,
          tenantId: effectiveTenantId
        })
      } else {
        emotions = emotionData || []
      }
    }

    // Get intent data if requested
    let intents = []
    if (includeIntents) {
      const { data: intentData, error: intentError } = await supabase
        .from('conversation_intents')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: true })

      if (intentError) {
        logger.error('Failed to fetch intent data', intentError, {
          conversationId,
          tenantId: effectiveTenantId
        })
      } else {
        intents = intentData || []
      }
    }

    const response = {
      conversationId,
      insights: insights || [],
      emotions: emotions,
      intents: intents,
      summary: {
        totalMessages: emotions.length || intents.length,
        averageEmotionConfidence: emotions.length > 0
          ? emotions.reduce((sum, e) => sum + (e.confidence_score || 0), 0) / emotions.length
          : 0,
        averageIntentConfidence: intents.length > 0
          ? intents.reduce((sum, i) => sum + (i.confidence_score || 0), 0) / intents.length
          : 0,
        dominantEmotion: emotions.length > 0
          ? emotions.reduce((prev, current) =>
              (prev.confidence_score || 0) > (current.confidence_score || 0) ? prev : current
            ).dominant_emotion
          : null,
        primaryIntent: intents.length > 0
          ? intents.reduce((prev, current) =>
              (prev.confidence_score || 0) > (current.confidence_score || 0) ? prev : current
            ).primary_intent
          : null
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Failed to retrieve conversation insights', error as Error, {
      conversationId
    })

    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 })
  }
}