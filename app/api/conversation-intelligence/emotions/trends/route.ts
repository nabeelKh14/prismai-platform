import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"

// GET /api/conversation-intelligence/emotions/trends - Emotion trends over time
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'day' // day, week, month
    const conversationIds = searchParams.get('conversationIds')?.split(',')

    // Validate date parameters
    if (!startDate || !endDate) {
      return NextResponse.json({
        error: "startDate and endDate parameters are required"
      }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({
        error: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)"
      }, { status: 400 })
    }

    if (start >= end) {
      return NextResponse.json({
        error: "startDate must be before endDate"
      }, { status: 400 })
    }

    // Check tenant access if tenantId provided
    if (tenantId) {
      await tenantService.checkTenantAccess(user.id, tenantId)
    }

    // Get or determine tenant context
    const tenantContext = await tenantService.getTenantContext(user.id, tenantId || undefined)
    const effectiveTenantId = tenantId || tenantContext.tenant.id

    logger.info('Retrieving emotion trends', {
      tenantId: effectiveTenantId,
      startDate,
      endDate,
      groupBy,
      conversationCount: conversationIds?.length
    })

    // Build query for emotion data
    let query = supabase
      .from('conversation_emotions')
      .select(`
        dominant_emotion,
        overall_sentiment,
        confidence_score,
        created_at,
        conversation_id
      `)
      .eq('tenant_id', effectiveTenantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true })

    if (conversationIds && conversationIds.length > 0) {
      query = query.in('conversation_id', conversationIds)
    }

    const { data: emotions, error } = await query

    if (error) {
      logger.error('Failed to fetch emotion trends data', error, {
        tenantId: effectiveTenantId,
        startDate,
        endDate
      })
      return NextResponse.json({
        error: "Failed to fetch emotion trends"
      }, { status: 500 })
    }

    // Process data into trends
    const trends = processEmotionTrends(emotions || [], start, end, groupBy)

    const response = {
      trends,
      summary: {
        totalConversations: new Set((emotions || []).map(e => e.conversation_id)).size,
        totalEmotions: emotions?.length || 0,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        groupBy
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Failed to retrieve emotion trends', error as Error)

    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 })
  }
}

// Helper function to process emotion data into trends
function processEmotionTrends(
  emotions: any[],
  startDate: Date,
  endDate: Date,
  groupBy: string
): Array<{
  period: string
  emotions: Record<string, number>
  totalConversations: number
  dominantEmotion: string
  averageConfidence: number
}> {
  const trends: Record<string, {
    emotions: Record<string, number>
    conversations: Set<string>
    confidences: number[]
  }> = {}

  // Group emotions by period
  emotions.forEach(emotion => {
    const date = new Date(emotion.created_at)
    let periodKey: string

    switch (groupBy) {
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        periodKey = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
        break
      case 'day':
      default:
        periodKey = date.toISOString().split('T')[0]
        break
    }

    if (!trends[periodKey]) {
      trends[periodKey] = {
        emotions: {},
        conversations: new Set(),
        confidences: []
      }
    }

    trends[periodKey].emotions[emotion.dominant_emotion] =
      (trends[periodKey].emotions[emotion.dominant_emotion] || 0) + 1

    trends[periodKey].conversations.add(emotion.conversation_id)
    trends[periodKey].confidences.push(emotion.confidence_score || 0)
  })

  // Convert to array format and calculate metrics
  return Object.entries(trends).map(([period, data]) => {
    const dominantEmotion = Object.entries(data.emotions)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral'

    const averageConfidence = data.confidences.length > 0
      ? data.confidences.reduce((sum, conf) => sum + conf, 0) / data.confidences.length
      : 0

    return {
      period,
      emotions: data.emotions,
      totalConversations: data.conversations.size,
      dominantEmotion,
      averageConfidence
    }
  }).sort((a, b) => a.period.localeCompare(b.period))
}