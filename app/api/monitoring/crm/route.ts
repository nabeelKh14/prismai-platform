import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { crmErrorHandler } from '@/lib/crm/error-handler'
import { circuitBreakerManager } from '@/lib/crm/circuit-breaker'
import { retryManager } from '@/lib/crm/retry-mechanism'
import { crmRateLimitManager } from '@/lib/crm/rate-limiter'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') || undefined
    const timeframe = searchParams.get('timeframe') || '1h'
    const includeDetails = searchParams.get('details') === 'true'

    // Get comprehensive CRM monitoring data
    const monitoringData = await getCRMMonitoringData(provider, timeframe, includeDetails)

    return NextResponse.json({
      success: true,
      data: monitoringData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to get CRM monitoring data', error as Error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve monitoring data'
      },
      { status: 500 }
    )
  }
}

async function getCRMMonitoringData(
  provider?: string,
  timeframe: string = '1h',
  includeDetails: boolean = false
) {
  const supabase = await createClient()

  // Get error statistics
  const errorStats = crmErrorHandler.getErrorStats(provider)

  // Get circuit breaker status
  const circuitBreakerStats = circuitBreakerManager.getAllStats()

  // Get retry statistics
  const retryStats = retryManager.getRetryStats()

  // Get rate limiting statistics
  const rateLimitStats = crmRateLimitManager.getAllRateLimitStats()

  // Get recent CRM operations from database
  const operationsData = await getRecentOperations(provider, timeframe)

  // Get provider health scores
  const healthScores = await getProviderHealthScores(provider)

  // Calculate overall metrics
  const overallMetrics = calculateOverallMetrics(
    errorStats,
    circuitBreakerStats,
    operationsData,
    healthScores
  )

  const data: any = {
    overall: overallMetrics,
    errors: errorStats,
    circuitBreakers: circuitBreakerStats,
    retry: retryStats,
    rateLimiting: rateLimitStats,
    operations: operationsData,
    health: healthScores
  }

  if (includeDetails) {
    // Add detailed operation logs
    data.detailedLogs = await getDetailedOperationLogs(provider, timeframe)

    // Add performance metrics
    data.performance = await getPerformanceMetrics(provider, timeframe)

    // Add provider-specific configurations
    data.configurations = await getProviderConfigurations(provider)
  }

  return data
}

async function getRecentOperations(provider?: string, timeframe: string = '1h') {
  try {
    const supabase = await createClient()
    const timeAgo = new Date(Date.now() - parseTimeframeToMs(timeframe))

    let query = supabase
      .from('crm_sync_logs')
      .select('*')
      .gte('completed_at', timeAgo.toISOString())
      .order('completed_at', { ascending: false })
      .limit(100)

    if (provider) {
      query = query.eq('provider', provider)
    }

    const { data, error } = await query

    if (error) throw error

    // Transform and aggregate data
    const operations = (data || []).map(log => ({
      id: log.id,
      provider: log.provider,
      operation: log.sync_type,
      status: log.status,
      recordsProcessed: log.records_processed,
      errors: log.errors?.length || 0,
      completedAt: log.completed_at,
      duration: log.completed_at ? Date.now() - new Date(log.completed_at).getTime() : 0
    }))

    // Aggregate by provider and status
    const aggregated = operations.reduce((acc, op) => {
      const key = `${op.provider}:${op.operation}`
      if (!acc[key]) {
        acc[key] = {
          provider: op.provider,
          operation: op.operation,
          totalOperations: 0,
          successfulOperations: 0,
          failedOperations: 0,
          totalRecords: 0,
          totalErrors: 0,
          averageDuration: 0,
          lastOperation: op.completedAt
        }
      }

      acc[key].totalOperations++
      if (op.status === 'success') {
        acc[key].successfulOperations++
      } else {
        acc[key].failedOperations++
      }
      acc[key].totalRecords += op.recordsProcessed || 0
      acc[key].totalErrors += op.errors || 0
      acc[key].averageDuration = (acc[key].averageDuration + op.duration) / 2

      if (new Date(op.completedAt) > new Date(acc[key].lastOperation)) {
        acc[key].lastOperation = op.completedAt
      }

      return acc
    }, {} as Record<string, any>)

    return {
      recent: operations.slice(0, 20), // Last 20 operations
      aggregated: Object.values(aggregated)
    }

  } catch (error) {
    logger.error('Failed to get recent operations', error as Error)
    return { recent: [], aggregated: [] }
  }
}

async function getProviderHealthScores(provider?: string) {
  try {
    const supabase = await createClient()

    // Get recent error counts by provider
    const { data: errorData, error: errorError } = await supabase
      .from('crm_sync_logs')
      .select('provider, status, completed_at')
      .gte('completed_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .order('completed_at', { ascending: false })

    if (errorError) throw errorError

    // Calculate health scores
    const healthScores: Record<string, number> = {}

    const providers = provider ? [provider] : ['salesforce', 'hubspot', 'pipedrive']

    for (const prov of providers) {
      const providerOperations = (errorData || []).filter(op => op.provider === prov)
      const totalOps = providerOperations.length
      const failedOps = providerOperations.filter(op => op.status !== 'success').length

      if (totalOps === 0) {
        healthScores[prov] = 1.0 // Assume healthy if no recent operations
      } else {
        const successRate = (totalOps - failedOps) / totalOps
        healthScores[prov] = Math.max(0, Math.min(1, successRate))
      }
    }

    return healthScores

  } catch (error) {
    logger.error('Failed to get provider health scores', error as Error)
    return {}
  }
}

function calculateOverallMetrics(
  errorStats: any,
  circuitBreakerStats: any,
  operationsData: any,
  healthScores: any
) {
  const totalErrors = Object.values(errorStats).reduce((sum: number, stat: any) => sum + stat.count, 0)
  const totalOperations = operationsData.aggregated.reduce((sum: number, op: any) => sum + op.totalOperations, 0)

  // Circuit breaker health
  const circuitBreakers = Object.values(circuitBreakerStats)
  const healthyBreakers = circuitBreakers.filter((cb: any) => cb.state === 'closed').length
  const totalBreakers = circuitBreakers.length
  const circuitBreakerHealth = totalBreakers > 0 ? healthyBreakers / totalBreakers : 1

  // Overall health score
  const healthScoreValues = Object.values(healthScores) as number[]
  const avgHealthScore = healthScoreValues.reduce((sum: number, score: number) => sum + score, 0) /
                         Math.max(Object.keys(healthScores).length, 1)

  const overallHealth = (avgHealthScore + circuitBreakerHealth) / 2

  return {
    totalErrors,
    totalOperations,
    errorRate: totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0,
    overallHealth: Math.round(overallHealth * 100) / 100,
    circuitBreakerHealth: Math.round(circuitBreakerHealth * 100) / 100,
    averageHealthScore: Math.round(avgHealthScore * 100) / 100,
    activeProviders: Object.keys(healthScores).length,
    healthyProviders: healthScoreValues.filter((score: number) => score > 0.8).length
  }
}

async function getDetailedOperationLogs(provider?: string, timeframe: string = '1h') {
  try {
    const supabase = await createClient()
    const timeAgo = new Date(Date.now() - parseTimeframeToMs(timeframe))

    const { data, error } = await supabase
      .from('crm_sync_logs')
      .select('*')
      .gte('completed_at', timeAgo.toISOString())
      .order('completed_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return (data || []).map(log => ({
      id: log.id,
      provider: log.provider,
      syncType: log.sync_type,
      status: log.status,
      recordsProcessed: log.records_processed,
      errors: log.errors || [],
      completedAt: log.completed_at,
      duration: log.completed_at ? Date.now() - new Date(log.completed_at).getTime() : 0
    }))

  } catch (error) {
    logger.error('Failed to get detailed operation logs', error as Error)
    return []
  }
}

async function getPerformanceMetrics(provider?: string, timeframe: string = '1h') {
  try {
    const supabase = await createClient()

    // Get performance metrics from system monitoring
    const { data: metricsData, error } = await supabase
      .from('system_metrics')
      .select('*')
      .gte('created_at', new Date(Date.now() - parseTimeframeToMs(timeframe)).toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error

    // Filter for CRM-related metrics
    const crmMetrics = (metricsData || []).filter(metric =>
      metric.metric_name.includes('crm') ||
      metric.metric_name.includes('api_response') ||
      metric.metric_name.includes('external_service')
    )

    return {
      totalMetrics: crmMetrics.length,
      averageResponseTime: crmMetrics.reduce((sum, m) => sum + (m.value || 0), 0) / Math.max(crmMetrics.length, 1),
      errorCount: crmMetrics.filter(m => m.value > 5000).length, // High response times
      recentMetrics: crmMetrics.slice(0, 20)
    }

  } catch (error) {
    logger.error('Failed to get performance metrics', error as Error)
    return {
      totalMetrics: 0,
      averageResponseTime: 0,
      errorCount: 0,
      recentMetrics: []
    }
  }
}

async function getProviderConfigurations(provider?: string) {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('crm_configs')
      .select('*')
      .eq('is_active', true)

    if (provider) {
      query = query.eq('provider', provider)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(config => ({
      id: config.id,
      provider: config.provider,
      isActive: config.is_active,
      lastSyncAt: config.last_sync_at,
      createdAt: config.created_at,
      updatedAt: config.updated_at
    }))

  } catch (error) {
    logger.error('Failed to get provider configurations', error as Error)
    return []
  }
}

function parseTimeframeToMs(timeframe: string): number {
  const units: Record<string, number> = {
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  }

  return units[timeframe] || units['1h']
}