import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { insightExtractionService } from "@/lib/ai/insight-extractor"
import { conversationPatternAnalysisService } from "@/lib/analytics/conversation-patterns"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"
import { ValidationError } from "@/lib/errors"

// GET /api/conversation-insights/trends/{timeframe} - Get trending topics and insights
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ timeframe: string }> }
) {
  const startTime = Date.now()
  const { timeframe: resolvedTimeframe } = await params
  const timeframe = resolvedTimeframe

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenantId')

    // Validate timeframe
    const validTimeframes = ['7d', '30d', '90d', '1y']
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json({
        error: "Invalid timeframe. Must be one of: 7d, 30d, 90d, 1y"
      }, { status: 400 })
    }

    // Check tenant access if tenantId provided
    if (tenantId) {
      await tenantService.checkTenantAccess(user.id, tenantId)
    }

    // Get or determine tenant context
    const tenantContext = await tenantService.getTenantContext(user.id, tenantId || undefined)
    const effectiveTenantId = tenantId || tenantContext.tenant.id

    // Calculate date range based on timeframe
    const endDate = new Date()
    const startDate = new Date()

    switch (timeframe) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(endDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(endDate.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1)
        break
    }

    logger.info('Starting trends analysis', {
      tenantId: effectiveTenantId,
      timeframe,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    })

    // Get query parameters for filters
    const filters = {
      agentIds: url.searchParams.get('agentIds')?.split(','),
      customerSegments: url.searchParams.get('customerSegments')?.split(','),
      conversationTypes: url.searchParams.get('conversationTypes')?.split(','),
      minMessageCount: url.searchParams.get('minMessageCount') ?
        parseInt(url.searchParams.get('minMessageCount')!) : undefined,
      maxMessageCount: url.searchParams.get('maxMessageCount') ?
        parseInt(url.searchParams.get('maxMessageCount')!) : undefined
    }

    // Get trending insights
    const insightAnalytics = await insightExtractionService.getInsightAnalytics(
      [], // conversationIds - would be populated from database
      startDate,
      endDate
    )

    // Get pattern trends
    const patternAnalytics = await conversationPatternAnalysisService.getPatternAnalytics({
      tenantId: effectiveTenantId,
      timeRange: { startDate, endDate },
      filters
    })

    // Combine and analyze trends
    const trends = await analyzeTrends(insightAnalytics, patternAnalytics, timeframe)

    const processingTime = Date.now() - startTime

    const response = {
      success: true,
      tenantId: effectiveTenantId,
      timeframe,
      timeRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      trends,
      insights: insightAnalytics,
      patterns: patternAnalytics,
      processingTime,
      timestamp: new Date().toISOString()
    }

    logger.info('Trends analysis completed', {
      tenantId: effectiveTenantId,
      timeframe,
      trendsIdentified: trends.length,
      processingTime
    })

    return NextResponse.json(response)

  } catch (error) {
    const processingTime = Date.now() - startTime

    logger.error('Trends analysis failed', error as Error, {
      timeframe,
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

// Helper function to analyze trends from insights and patterns
async function analyzeTrends(insightAnalytics: any, patternAnalytics: any, timeframe: string) {
  const trends = []

  // Analyze insight trends
  if (insightAnalytics.insightsByCategory) {
    for (const [category, count] of Object.entries(insightAnalytics.insightsByCategory)) {
      trends.push({
        type: 'insight_category',
        category,
        metric: `${category}_insights`,
        value: count,
        timeframe,
        trend: 'stable', // Would be calculated based on historical data
        significance: (count as number) > 10 ? 'high' : (count as number) > 5 ? 'medium' : 'low'
      })
    }
  }

  // Analyze pattern trends
  if (patternAnalytics.trends) {
    for (const trend of patternAnalytics.trends) {
      trends.push({
        type: 'pattern_trend',
        category: trend.metric,
        metric: trend.metric,
        value: trend.changePercentage,
        timeframe,
        trend: trend.trend,
        significance: trend.significance
      })
    }
  }

  // Add overall sentiment trend (mock data for now)
  trends.push({
    type: 'sentiment',
    category: 'overall_sentiment',
    metric: 'customer_satisfaction',
    value: 85, // percentage
    timeframe,
    trend: 'improving',
    significance: 'high'
  })

  return trends
}