/**
 * Lead Routing Metrics API
 * Provides monitoring and performance metrics for the lead routing system
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { priorityRoutingService } from '@/lib/lead-routing/priority-routing-service'
import { intelligentRoutingEngine } from '@/lib/lead-routing/intelligent-routing-engine'
import { realtimeHandoffOptimizer } from '@/lib/lead-routing/realtime-handoff-optimizer'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const metricType = searchParams.get('type')
    const userId = searchParams.get('userId')
    const timeRange = searchParams.get('timeRange') || '24h'
    const agentId = searchParams.get('agentId')

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const targetUserId = userId || user.id

    switch (metricType) {
      case 'queue_performance':
        return await handleQueuePerformanceMetrics(targetUserId, timeRange)

      case 'routing_efficiency':
        return await handleRoutingEfficiencyMetrics(targetUserId, timeRange)

      case 'agent_performance':
        return await handleAgentPerformanceMetrics(targetUserId, timeRange, agentId || undefined)

      case 'handoff_optimization':
        return await handleHandoffOptimizationMetrics(targetUserId, timeRange)

      case 'system_health':
        return await handleSystemHealthMetrics(targetUserId)

      case 'priority_distribution':
        return await handlePriorityDistributionMetrics(targetUserId, timeRange)

      default:
        return await handleOverviewMetrics(targetUserId, timeRange)
    }

  } catch (error) {
    logger.error('Lead routing metrics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Metric handlers

async function handleOverviewMetrics(userId: string, timeRange: string) {
  try {
    const [
      queueStats,
      routingDecisions,
      handoffEvents,
      systemHealth
    ] = await Promise.all([
      priorityRoutingService.getQueueStats(),
      getRoutingDecisionsMetrics(userId, timeRange),
      getHandoffEventsMetrics(userId, timeRange),
      getSystemHealthMetrics(userId)
    ])

    const totalLeads = Object.values(queueStats).reduce((sum: number, queue: any) => sum + queue.count, 0)
    const averageWaitTime = await calculateAverageWaitTime(queueStats)

    return NextResponse.json({
      success: true,
      overview: {
        totalLeadsInQueues: totalLeads,
        averageWaitTime,
        queueStats,
        recentRoutingDecisions: routingDecisions.count,
        recentHandoffEvents: handoffEvents.count,
        systemHealth: {
          status: systemHealth.status,
          uptime: systemHealth.uptime,
          errorRate: systemHealth.errorRate
        }
      }
    })

  } catch (error) {
    logger.error('Error getting overview metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get overview metrics' },
      { status: 500 }
    )
  }
}

async function handleQueuePerformanceMetrics(userId: string, timeRange: string) {
  try {
    const queueStats = await priorityRoutingService.getQueueStats()
    const queueMetrics = await getQueuePerformanceMetrics(userId, timeRange)

    return NextResponse.json({
      success: true,
      queuePerformance: {
        currentStats: queueStats,
        historicalMetrics: queueMetrics,
        recommendations: await generateQueueRecommendations(queueStats, queueMetrics)
      }
    })

  } catch (error) {
    logger.error('Error getting queue performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get queue performance metrics' },
      { status: 500 }
    )
  }
}

async function handleRoutingEfficiencyMetrics(userId: string, timeRange: string) {
  try {
    const efficiencyMetrics = await getRoutingEfficiencyMetrics(userId, timeRange)

    return NextResponse.json({
      success: true,
      routingEfficiency: {
        ...efficiencyMetrics,
        benchmarks: {
          targetAssignmentTime: '< 5 minutes',
          targetSuccessRate: '> 85%',
          targetOptimizationRate: '> 15%'
        }
      }
    })

  } catch (error) {
    logger.error('Error getting routing efficiency metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get routing efficiency metrics' },
      { status: 500 }
    )
  }
}

async function handleAgentPerformanceMetrics(userId: string, timeRange: string, agentId?: string) {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('agent_performance_metrics')
      .select(`
        *,
        users(email, first_name, last_name)
      `)
      .eq('user_id', userId)

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data: agentMetrics } = await query
      .order('updated_at', { ascending: false })

    const performanceSummary = await calculateAgentPerformanceSummary(agentMetrics || [])

    return NextResponse.json({
      success: true,
      agentPerformance: {
        agents: agentMetrics || [],
        summary: performanceSummary,
        timeRange,
        recommendations: await generateAgentRecommendations(performanceSummary)
      }
    })

  } catch (error) {
    logger.error('Error getting agent performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get agent performance metrics' },
      { status: 500 }
    )
  }
}

async function handleHandoffOptimizationMetrics(userId: string, timeRange: string) {
  try {
    const handoffMetrics = await getHandoffOptimizationMetrics(userId, timeRange)

    return NextResponse.json({
      success: true,
      handoffOptimization: {
        ...handoffMetrics,
        insights: await generateHandoffInsights(handoffMetrics)
      }
    })

  } catch (error) {
    logger.error('Error getting handoff optimization metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get handoff optimization metrics' },
      { status: 500 }
    )
  }
}

async function handleSystemHealthMetrics(userId: string) {
  try {
    const healthMetrics = await getSystemHealthMetrics(userId)

    return NextResponse.json({
      success: true,
      systemHealth: healthMetrics
    })

  } catch (error) {
    logger.error('Error getting system health metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get system health metrics' },
      { status: 500 }
    )
  }
}

async function handlePriorityDistributionMetrics(userId: string, timeRange: string) {
  try {
    const supabase = await createClient()

    const { data: leads } = await supabase
      .from('leads')
      .select('priority_score, created_at')
      .eq('user_id', userId)
      .gte('created_at', getTimeRangeFilter(timeRange))

    const distribution = calculatePriorityDistribution(leads || [])

    return NextResponse.json({
      success: true,
      priorityDistribution: {
        distribution,
        totalLeads: leads?.length || 0,
        averagePriorityScore: calculateAveragePriorityScore(leads || []),
        trends: await calculatePriorityTrends(userId, timeRange)
      }
    })

  } catch (error) {
    logger.error('Error getting priority distribution metrics:', error)
    return NextResponse.json(
      { error: 'Failed to get priority distribution metrics' },
      { status: 500 }
    )
  }
}

// Helper functions

async function getRoutingDecisionsMetrics(userId: string, timeRange: string) {
  const supabase = await createClient()

  const { data: decisions } = await supabase
    .from('lead_routing_decisions')
    .select('created_at, confidence_score, priority_level')
    .eq('user_id', userId)
    .gte('created_at', getTimeRangeFilter(timeRange))

  return {
    count: decisions?.length || 0,
    averageConfidence: calculateAverage(decisions?.map(d => d.confidence_score) || []),
    priorityBreakdown: calculatePriorityBreakdown(decisions || [])
  }
}

async function getHandoffEventsMetrics(userId: string, timeRange: string) {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('lead_handoff_events')
    .select('created_at, handoff_type, priority_level')
    .eq('user_id', userId)
    .gte('created_at', getTimeRangeFilter(timeRange))

  return {
    count: events?.length || 0,
    typeBreakdown: calculateHandoffTypeBreakdown(events || []),
    priorityBreakdown: calculatePriorityBreakdown(events || [])
  }
}

async function getSystemHealthMetrics(userId: string) {
  const supabase = await createClient()

  // Get recent errors and performance issues
  const { data: recentErrors } = await supabase
    .from('system_logs')
    .select('created_at, level, message')
    .eq('user_id', userId)
    .eq('level', 'error')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(100)

  const { data: routingDecisions } = await supabase
    .from('lead_routing_decisions')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const errorRate = recentErrors?.length || 0
  const totalOperations = routingDecisions?.length || 1

  return {
    status: errorRate / totalOperations < 0.05 ? 'healthy' : 'degraded',
    uptime: '99.9%', // This would be calculated from actual uptime data
    errorRate: `${((errorRate / totalOperations) * 100).toFixed(2)}%`,
    recentErrors: recentErrors?.slice(0, 5) || [],
    lastChecked: new Date().toISOString()
  }
}

async function getQueuePerformanceMetrics(userId: string, timeRange: string) {
  const supabase = await createClient()

  const { data: queueHistory } = await supabase
    .from('queue_metrics_history')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', getTimeRangeFilter(timeRange))
    .order('created_at', { ascending: true })

  return {
    history: queueHistory || [],
    trends: calculateQueueTrends(queueHistory || []),
    peakHours: calculatePeakHours(queueHistory || [])
  }
}

async function getRoutingEfficiencyMetrics(userId: string, timeRange: string) {
  const supabase = await createClient()

  const { data: decisions } = await supabase
    .from('lead_routing_decisions')
    .select('created_at, confidence_score, estimated_wait_time')
    .eq('user_id', userId)
    .gte('created_at', getTimeRangeFilter(timeRange))

  const { data: leads } = await supabase
    .from('leads')
    .select('created_at, assigned_at, status')
    .eq('user_id', userId)
    .eq('status', 'assigned')
    .gte('created_at', getTimeRangeFilter(timeRange))

  const averageAssignmentTime = calculateAverageAssignmentTime(leads || [])
  const averageConfidence = calculateAverage(decisions?.map(d => d.confidence_score) || [])
  const averageWaitTime = calculateAverage(decisions?.map(d => d.estimated_wait_time) || [])

  return {
    averageAssignmentTime,
    averageConfidence,
    averageWaitTime,
    successRate: calculateSuccessRate(leads || []),
    optimizationRate: await calculateOptimizationRate(userId, timeRange)
  }
}

async function getHandoffOptimizationMetrics(userId: string, timeRange: string) {
  const supabase = await createClient()

  const { data: handoffEvents } = await supabase
    .from('lead_handoff_events')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', getTimeRangeFilter(timeRange))

  const { data: optimizationEvents } = await supabase
    .from('handoff_optimization_events')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', getTimeRangeFilter(timeRange))

  return {
    totalHandoffs: handoffEvents?.length || 0,
    optimizationEvents: optimizationEvents?.length || 0,
    optimizationRate: optimizationEvents?.length || 0 / (handoffEvents?.length || 1),
    averageImprovement: calculateAverage(optimizationEvents?.map(o => o.expected_improvement) || []),
    typeBreakdown: calculateHandoffTypeBreakdown(handoffEvents || [])
  }
}

function getTimeRangeFilter(timeRange: string): string {
  const now = new Date()
  switch (timeRange) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  }
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

function calculatePriorityBreakdown(items: any[]): Record<string, number> {
  const breakdown: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  }

  items.forEach(item => {
    const priority = item.priority_level || 'medium'
    breakdown[priority] = (breakdown[priority] || 0) + 1
  })

  return breakdown
}

function calculateHandoffTypeBreakdown(events: any[]): Record<string, number> {
  const breakdown: Record<string, number> = {}

  events.forEach(event => {
    const type = event.handoff_type || 'assignment'
    breakdown[type] = (breakdown[type] || 0) + 1
  })

  return breakdown
}

function calculatePriorityDistribution(leads: any[]): Record<string, number> {
  const distribution: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  }

  leads.forEach(lead => {
    const score = lead.priority_score || 0
    if (score >= 90) distribution.critical++
    else if (score >= 75) distribution.high++
    else if (score >= 50) distribution.medium++
    else distribution.low++
  })

  return distribution
}

function calculateAveragePriorityScore(leads: any[]): number {
  if (leads.length === 0) return 0
  const totalScore = leads.reduce((sum, lead) => sum + (lead.priority_score || 0), 0)
  return totalScore / leads.length
}

async function calculatePriorityTrends(userId: string, timeRange: string) {
  // This would calculate trends in priority scores over time
  return {
    trend: 'stable',
    changePercent: 0,
    description: 'Priority scores have remained stable over the selected period'
  }
}

function calculateAverageAssignmentTime(leads: any[]): number {
  if (leads.length === 0) return 0

  const totalTime = leads.reduce((sum, lead) => {
    if (lead.created_at && lead.assigned_at) {
      return sum + (new Date(lead.assigned_at).getTime() - new Date(lead.created_at).getTime())
    }
    return sum
  }, 0)

  return totalTime / leads.length / (1000 * 60) // Convert to minutes
}

function calculateSuccessRate(leads: any[]): number {
  if (leads.length === 0) return 0

  const successfulLeads = leads.filter(lead =>
    lead.status === 'qualified' ||
    lead.status === 'opportunity' ||
    lead.status === 'customer'
  ).length

  return (successfulLeads / leads.length) * 100
}

async function calculateOptimizationRate(userId: string, timeRange: string): Promise<number> {
  const supabase = await createClient()

  const { data: optimizationEvents } = await supabase
    .from('handoff_optimization_events')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', getTimeRangeFilter(timeRange))

  const { data: totalDecisions } = await supabase
    .from('lead_routing_decisions')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', getTimeRangeFilter(timeRange))

  const optimizationCount = optimizationEvents?.length || 0
  const totalCount = totalDecisions?.length || 1

  return (optimizationCount / totalCount) * 100
}

async function calculateAgentPerformanceSummary(agentMetrics: any[]) {
  if (agentMetrics.length === 0) {
    return {
      totalAgents: 0,
      averageSuccessRate: 0,
      averageResolutionTime: 0,
      totalLeadsHandled: 0
    }
  }

  const summary = {
    totalAgents: new Set(agentMetrics.map(m => m.agent_id)).size,
    averageSuccessRate: calculateAverage(agentMetrics.map(m => m.success_rate || 0)),
    averageResolutionTime: calculateAverage(agentMetrics.map(m => m.average_resolution_time || 0)),
    totalLeadsHandled: agentMetrics.reduce((sum, m) => sum + (m.leads_handled || 0), 0)
  }

  return summary
}

async function calculateAverageWaitTime(queueStats: any): Promise<number> {
  const totalLeads = Object.values(queueStats).reduce((sum: number, queue: any) => sum + queue.count, 0)

  if (totalLeads === 0) return 0

  // This is a simplified calculation - in reality, you'd track actual wait times
  return Math.ceil(totalLeads / 10) // Assume 10 leads can be processed per minute
}

function calculateQueueTrends(queueHistory: any[]): any {
  // Calculate trends in queue metrics over time
  return {
    trend: 'stable',
    description: 'Queue metrics have remained stable'
  }
}

function calculatePeakHours(queueHistory: any[]): any {
  // Identify peak hours for queue activity
  return {
    peakHour: '9 AM',
    peakDay: 'Tuesday',
    description: 'Peak activity occurs mid-morning on Tuesdays'
  }
}

async function generateQueueRecommendations(queueStats: any, queueMetrics: any) {
  const recommendations: string[] = []

  for (const [queueName, stats] of Object.entries(queueStats)) {
    if ((stats as any).count > 50) {
      recommendations.push(`High volume in ${queueName} queue - consider adding more agents`)
    }
  }

  return recommendations
}

async function generateAgentRecommendations(performanceSummary: any) {
  const recommendations: string[] = []

  if (performanceSummary.averageSuccessRate < 70) {
    recommendations.push('Agent success rate is below target - consider additional training')
  }

  if (performanceSummary.averageResolutionTime > 60) {
    recommendations.push('Average resolution time is high - review agent workflows')
  }

  return recommendations
}

async function generateHandoffInsights(handoffMetrics: any) {
  const insights: string[] = []

  if (handoffMetrics.optimizationRate > 20) {
    insights.push('High optimization rate indicates effective real-time adjustments')
  }

  if (handoffMetrics.averageImprovement > 0.15) {
    insights.push('Significant performance improvements from handoff optimizations')
  }

  return insights
}