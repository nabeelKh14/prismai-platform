import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { conversationPatternAnalysisService } from "@/lib/analytics/conversation-patterns"
import { tenantService } from "@/lib/tenant/tenant-service"
import { logger } from "@/lib/logger"
import { ValidationError } from "@/lib/errors"

// GET /api/conversation-insights/patterns/{tenantId} - Get conversation pattern analysis
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const startTime = Date.now()
  const { tenantId: resolvedTenantId } = await params
  const tenantId = resolvedTenantId

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check tenant access
    await tenantService.checkTenantAccess(user.id, tenantId)

    // Get query parameters
    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const includeAnomalies = url.searchParams.get('includeAnomalies') === 'true'
    const includeAnalytics = url.searchParams.get('includeAnalytics') === 'true'

    // Validate date range
    if (!startDate || !endDate) {
      return NextResponse.json({
        error: "Start date and end date are required"
      }, { status: 400 })
    }

    const timeRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    }

    // Validate date range
    if (isNaN(timeRange.startDate.getTime()) || isNaN(timeRange.endDate.getTime())) {
      return NextResponse.json({
        error: "Invalid date format"
      }, { status: 400 })
    }

    if (timeRange.startDate >= timeRange.endDate) {
      return NextResponse.json({
        error: "Start date must be before end date"
      }, { status: 400 })
    }

    logger.info('Starting conversation pattern analysis', {
      tenantId,
      startDate: timeRange.startDate.toISOString(),
      endDate: timeRange.endDate.toISOString()
    })

    // Get filters from query parameters
    const filters = {
      agentIds: url.searchParams.get('agentIds')?.split(','),
      customerSegments: url.searchParams.get('customerSegments')?.split(','),
      conversationTypes: url.searchParams.get('conversationTypes')?.split(','),
      minMessageCount: url.searchParams.get('minMessageCount') ?
        parseInt(url.searchParams.get('minMessageCount')!) : undefined,
      maxMessageCount: url.searchParams.get('maxMessageCount') ?
        parseInt(url.searchParams.get('maxMessageCount')!) : undefined
    }

    // Get options from query parameters
    const options = {
      minPatternFrequency: url.searchParams.get('minPatternFrequency') ?
        parseInt(url.searchParams.get('minPatternFrequency')!) : undefined,
      minConfidence: url.searchParams.get('minConfidence') ?
        parseFloat(url.searchParams.get('minConfidence')!) : undefined,
      maxPatterns: url.searchParams.get('maxPatterns') ?
        parseInt(url.searchParams.get('maxPatterns')!) : undefined,
      includeRecommendations: url.searchParams.get('includeRecommendations') !== 'false',
      patternTypes: url.searchParams.get('patternTypes')?.split(',')
    }

    // Analyze patterns
    const patterns = await conversationPatternAnalysisService.analyzePatterns({
      tenantId,
      timeRange,
      filters,
      options
    })

    const response: any = {
      success: true,
      tenantId,
      timeRange,
      patterns,
      patternsCount: patterns.length,
      timestamp: new Date().toISOString()
    }

    // Include anomalies if requested
    if (includeAnomalies) {
      const anomalies = await conversationPatternAnalysisService.detectAnomalies({
        tenantId,
        timeRange,
        filters,
        options
      })

      response.anomalies = anomalies
      response.anomaliesCount = anomalies.length
    }

    // Include analytics if requested
    if (includeAnalytics) {
      const analytics = await conversationPatternAnalysisService.getPatternAnalytics({
        tenantId,
        timeRange,
        filters,
        options
      })

      response.analytics = analytics
    }

    const processingTime = Date.now() - startTime

    logger.info('Conversation pattern analysis completed', {
      tenantId,
      patternsFound: patterns.length,
      includeAnomalies,
      includeAnalytics,
      processingTime
    })

    return NextResponse.json(response)

  } catch (error) {
    const processingTime = Date.now() - startTime

    logger.error('Conversation pattern analysis failed', error as Error, {
      tenantId,
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