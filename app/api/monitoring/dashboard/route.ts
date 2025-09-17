import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { AuthMonitor } from "@/lib/monitoring/auth-monitor"
import { tenantMonitoringService } from "@/lib/tenant/monitoring-service"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get system health
    const systemHealth = await tenantMonitoringService.getSystemHealth()

    // Get auth metrics
    const authMetrics = await AuthMonitor.getAuthMetrics('day')

    // Get recent alerts
    const { data: recentAlerts } = await supabase
      .from('tenant_alerts')
      .select('*')
      .eq('status', 'active')
      .order('triggered_at', { ascending: false })
      .limit(10)

    // Get key performance metrics
    const { data: metrics } = await supabase
      .from('tenant_metrics')
      .select('metric_name, value, timestamp')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(100)

    // Aggregate metrics
    const aggregatedMetrics = metrics?.reduce((acc, metric) => {
      if (!acc[metric.metric_name]) {
        acc[metric.metric_name] = []
      }
      acc[metric.metric_name].push(metric.value)
      return acc
    }, {} as Record<string, number[]>) || {}

    const keyMetrics = {
      total_api_requests: aggregatedMetrics.api_requests?.reduce((sum, val) => sum + val, 0) || 0,
      average_response_time: aggregatedMetrics.api_response_time?.length
        ? aggregatedMetrics.api_response_time.reduce((sum, val) => sum + val, 0) / aggregatedMetrics.api_response_time.length
        : 0,
      error_rate: aggregatedMetrics.api_requests?.length && aggregatedMetrics.api_errors?.length
        ? (aggregatedMetrics.api_errors.reduce((sum, val) => sum + val, 0) / aggregatedMetrics.api_requests.reduce((sum, val) => sum + val, 0)) * 100
        : 0,
      active_users: aggregatedMetrics.active_users?.[0] || 0,
      storage_used_mb: aggregatedMetrics.storage_used_mb?.[0] || 0
    }

    // Get real-time conversation metrics
    const { data: conversations } = await supabase
      .from('chat_conversations')
      .select('status, created_at')
      .eq('user_id', user.id)
      .gte('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

    const conversationMetrics = {
      active_conversations: conversations?.filter(c => c.status === 'active' || c.status === 'assigned').length || 0,
      waiting_conversations: conversations?.filter(c => c.status === 'waiting').length || 0,
      total_conversations_today: conversations?.length || 0
    }

    // Get agent status
    const { data: agents } = await supabase
      .from('agent_profiles')
      .select('status, last_active_at')
      .eq('user_id', user.id)

    const agentMetrics = {
      total_agents: agents?.length || 0,
      online_agents: agents?.filter(a => a.status === 'online' && new Date(a.last_active_at) > new Date(Date.now() - 5 * 60 * 1000)).length || 0,
      busy_agents: agents?.filter(a => a.status === 'busy').length || 0
    }

    const dashboardData = {
      service: 'PrismAI',
      platform: 'Intelligent Business Automation Platform',
      systemHealth,
      authMetrics,
      recentAlerts: recentAlerts || [],
      keyMetrics,
      conversationMetrics,
      agentMetrics,
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    logger.error('Failed to fetch PrismAI monitoring dashboard data', { error })
    return NextResponse.json({
      service: 'PrismAI',
      error: "Failed to fetch PrismAI monitoring dashboard data",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}