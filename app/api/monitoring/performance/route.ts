import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { performanceMonitor } from "@/lib/monitoring/performance-monitor"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '24h'
    const metricType = searchParams.get('metricType') as any

    // Get aggregated performance statistics
    const apiStats = await performanceMonitor.getAggregatedStats('api_response', timeRange as any)
    const dbStats = await performanceMonitor.getAggregatedStats('database_query', timeRange as any)
    const memoryStats = await performanceMonitor.getAggregatedStats('memory_usage', timeRange as any)
    const cpuStats = await performanceMonitor.getAggregatedStats('cpu_usage', timeRange as any)

    // Get recent performance metrics
    const recentMetrics = await performanceMonitor.getMetrics(
      metricType,
      undefined,
      undefined,
      undefined,
      100
    )

    // Get API endpoint performance breakdown
    const apiEndpointStats = await getAPIEndpointStats(timeRange as any)

    // Get error rate trends
    const errorRateTrends = await getErrorRateTrends(timeRange as any)

    const performanceData = {
      summary: {
        api_response_time: apiStats,
        database_query_time: dbStats,
        memory_usage: memoryStats,
        cpu_usage: cpuStats
      },
      recent_metrics: recentMetrics,
      api_endpoints: apiEndpointStats,
      error_trends: errorRateTrends,
      time_range: timeRange,
      last_updated: new Date().toISOString()
    }

    return NextResponse.json(performanceData)

  } catch (error) {
    logger.error('Failed to fetch performance metrics', { error })
    return NextResponse.json({
      error: "Failed to fetch performance metrics",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function getAPIEndpointStats(timeRange: '1h' | '24h' | '7d' | '30d') {
  try {
    const supabase = await createClient()

    // Calculate time range
    const now = new Date()
    const startTime = new Date()

    switch (timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1)
        break
      case '24h':
        startTime.setDate(now.getDate() - 1)
        break
      case '7d':
        startTime.setDate(now.getDate() - 7)
        break
      case '30d':
        startTime.setMonth(now.getMonth() - 1)
        break
    }

    const { data, error } = await supabase
      .from('performance_metrics')
      .select('metadata, value')
      .eq('metric_type', 'api_response')
      .gte('timestamp', startTime.toISOString())

    if (error) throw error

    // Group by endpoint
    const endpointStats: Record<string, {
      endpoint: string
      total_requests: number
      average_response_time: number
      min_response_time: number
      max_response_time: number
      error_count: number
    }> = {}

    for (const metric of data || []) {
      const endpoint = metric.metadata?.endpoint || 'unknown'
      const responseTime = metric.value
      const isError = metric.metadata?.status_code >= 400

      if (!endpointStats[endpoint]) {
        endpointStats[endpoint] = {
          endpoint,
          total_requests: 0,
          average_response_time: 0,
          min_response_time: Infinity,
          max_response_time: 0,
          error_count: 0
        }
      }

      const stats = endpointStats[endpoint]
      stats.total_requests++
      stats.average_response_time = (stats.average_response_time * (stats.total_requests - 1) + responseTime) / stats.total_requests
      stats.min_response_time = Math.min(stats.min_response_time, responseTime)
      stats.max_response_time = Math.max(stats.max_response_time, responseTime)

      if (isError) {
        stats.error_count++
      }
    }

    return Object.values(endpointStats).map(stats => ({
      ...stats,
      min_response_time: stats.min_response_time === Infinity ? 0 : stats.min_response_time,
      error_rate: stats.total_requests > 0 ? (stats.error_count / stats.total_requests) * 100 : 0
    }))

  } catch (error) {
    logger.error('Failed to get API endpoint stats', { error })
    return []
  }
}

async function getErrorRateTrends(timeRange: '1h' | '24h' | '7d' | '30d') {
  try {
    const supabase = await createClient()

    // Calculate time range
    const now = new Date()
    const startTime = new Date()

    switch (timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1)
        break
      case '24h':
        startTime.setDate(now.getDate() - 1)
        break
      case '7d':
        startTime.setDate(now.getDate() - 7)
        break
      case '30d':
        startTime.setMonth(now.getMonth() - 1)
        break
    }

    const { data, error } = await supabase
      .from('performance_metrics')
      .select('timestamp, metadata')
      .eq('metric_type', 'api_response')
      .gte('timestamp', startTime.toISOString())
      .order('timestamp', { ascending: true })

    if (error) throw error

    // Group by hour/day
    const trends: Record<string, { total: number; errors: number }> = {}

    for (const metric of data || []) {
      const timestamp = new Date(metric.timestamp)
      let key: string

      if (timeRange === '1h') {
        key = `${timestamp.getHours()}:${timestamp.getMinutes().toString().padStart(2, '0')}`
      } else {
        key = timestamp.toISOString().split('T')[0]
      }

      if (!trends[key]) {
        trends[key] = { total: 0, errors: 0 }
      }

      trends[key].total++
      if (metric.metadata?.status_code >= 400) {
        trends[key].errors++
      }
    }

    return Object.entries(trends).map(([time, stats]) => ({
      time,
      error_rate: stats.total > 0 ? (stats.errors / stats.total) * 100 : 0,
      total_requests: stats.total,
      error_count: stats.errors
    }))

  } catch (error) {
    logger.error('Failed to get error rate trends', { error })
    return []
  }
}