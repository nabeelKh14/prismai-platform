import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"

// GET /api/conversation-intelligence/intents/analytics - Intent classification analytics
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
    const topN = parseInt(searchParams.get('topN') || '10')

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

    logger.info('Retrieving intent analytics', {
      tenantId: effectiveTenantId,
      startDate,
      endDate,
      groupBy,
      topN,
      conversationCount: conversationIds?.length
    })

    // Build query for intent data
    let query = supabase
      .from('conversation_intents')
      .select(`
        primary_intent,
        secondary_intent,
        urgency_level,
        complexity_level,
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

    const { data: intents, error } = await query

    if (error) {
      logger.error('Failed to fetch intent analytics data', error, {
        tenantId: effectiveTenantId,
        startDate,
        endDate
      })
      return NextResponse.json({
        error: "Failed to fetch intent analytics"
      }, { status: 500 })
    }

    // Process data into analytics
    const analytics = processIntentAnalytics(intents || [], start, end, groupBy, topN)

    const response = {
      analytics,
      summary: {
        totalConversations: new Set((intents || []).map(i => i.conversation_id)).size,
        totalIntents: intents?.length || 0,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        groupBy,
        topN
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Failed to retrieve intent analytics', error as Error)

    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 })
  }
}

// Helper function to process intent data into analytics
function processIntentAnalytics(
  intents: any[],
  startDate: Date,
  endDate: Date,
  groupBy: string,
  topN: number
): Array<{
  intent: string
  count: number
  averageConfidence: number
  urgencyDistribution: Record<string, number>
  complexityDistribution: Record<string, number>
  trends: Array<{
    period: string
    count: number
    confidence: number
  }>
}> {
  // Aggregate by intent type
  const intentStats: Record<string, {
    count: number
    confidences: number[]
    urgencies: Record<string, number>
    complexities: Record<string, number>
    trends: Record<string, { count: number, confidences: number[] }>
  }> = {}

  intents.forEach(intent => {
    const intentType = intent.primary_intent || 'unknown'

    if (!intentStats[intentType]) {
      intentStats[intentType] = {
        count: 0,
        confidences: [],
        urgencies: { low: 0, medium: 0, high: 0 },
        complexities: { simple: 0, moderate: 0, complex: 0 },
        trends: {}
      }
    }

    intentStats[intentType].count++
    intentStats[intentType].confidences.push(intent.confidence_score || 0)

    // Track urgency distribution
    const urgency = intent.urgency_level || 'low'
    intentStats[intentType].urgencies[urgency]++

    // Track complexity distribution
    const complexity = intent.complexity_level || 'simple'
    intentStats[intentType].complexities[complexity]++

    // Track trends
    const date = new Date(intent.created_at)
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

    if (!intentStats[intentType].trends[periodKey]) {
      intentStats[intentType].trends[periodKey] = { count: 0, confidences: [] }
    }

    intentStats[intentType].trends[periodKey].count++
    intentStats[intentType].trends[periodKey].confidences.push(intent.confidence_score || 0)
  })

  // Convert to array format and calculate metrics
  return Object.entries(intentStats)
    .map(([intent, stats]) => {
      const averageConfidence = stats.confidences.length > 0
        ? stats.confidences.reduce((sum, conf) => sum + conf, 0) / stats.confidences.length
        : 0

      const trends = Object.entries(stats.trends).map(([period, trendData]) => ({
        period,
        count: trendData.count,
        confidence: trendData.confidences.length > 0
          ? trendData.confidences.reduce((sum, conf) => sum + conf, 0) / trendData.confidences.length
          : 0
      })).sort((a, b) => a.period.localeCompare(b.period))

      return {
        intent,
        count: stats.count,
        averageConfidence,
        urgencyDistribution: stats.urgencies,
        complexityDistribution: stats.complexities,
        trends
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}