import { createClient } from '@/lib/supabase/server'
import { tenantService } from '@/lib/tenant/tenant-service'
import { logger } from '@/lib/logger'
import { ValidationError, AuthorizationError } from '@/lib/errors'

// Monitoring types
export type MetricType =
  | 'performance'
  | 'security'
  | 'usage'
  | 'business'
  | 'system'

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface TenantMetric {
  id: string
  tenant_id: string
  metric_name: string
  metric_type: MetricType
  value: number
  unit: string
  timestamp: string
  metadata: Record<string, any>
}

export interface TenantAlert {
  id: string
  tenant_id: string
  alert_type: string
  severity: AlertSeverity
  title: string
  description: string
  status: 'active' | 'acknowledged' | 'resolved'
  triggered_at: string
  resolved_at?: string
  metadata: Record<string, any>
}

export interface SystemHealth {
  overall_status: 'healthy' | 'warning' | 'critical'
  components: {
    database: 'healthy' | 'warning' | 'critical'
    api: 'healthy' | 'warning' | 'critical'
    storage: 'healthy' | 'warning' | 'critical'
    integrations: 'healthy' | 'warning' | 'critical'
  }
  metrics: {
    total_tenants: number
    active_tenants: number
    total_users: number
    api_requests_last_hour: number
    error_rate_last_hour: number
    average_response_time: number
  }
  last_updated: string
}

export interface TenantHealth {
  tenant_id: string
  status: 'healthy' | 'warning' | 'critical'
  issues: Array<{
    type: string
    severity: AlertSeverity
    description: string
    detected_at: string
  }>
  metrics: {
    users_active: number
    api_calls_today: number
    error_rate_today: number
    storage_used_mb: number
    last_activity: string
  }
  recommendations: string[]
}

export class TenantMonitoringService {
  private async getSupabase() {
    return await createClient()
  }

  /**
   * Record tenant metric
   */
  async recordMetric(
    tenantId: string,
    metricName: string,
    metricType: MetricType,
    value: number,
    unit: string,
    metadata?: Record<string, any>
  ): Promise<TenantMetric> {
    const supabase = await this.getSupabase()

    const { data: metric, error } = await supabase
      .from('tenant_metrics')
      .insert({
        tenant_id: tenantId,
        metric_name: metricName,
        metric_type: metricType,
        value,
        unit,
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) throw error

    // Check for alert conditions
    await this.checkMetricAlerts(tenantId, metricName, value, metadata)

    return metric
  }

  /**
   * Get tenant metrics
   */
  async getTenantMetrics(
    tenantId: string,
    userId: string,
    metricType?: MetricType,
    timeRange?: { start: string; end: string }
  ): Promise<TenantMetric[]> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    let query = supabase
      .from('tenant_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('timestamp', { ascending: false })

    if (metricType) {
      query = query.eq('metric_type', metricType)
    }

    if (timeRange) {
      query = query
        .gte('timestamp', timeRange.start)
        .lte('timestamp', timeRange.end)
    }

    const { data: metrics, error } = await query

    if (error) throw error

    return metrics || []
  }

  /**
   * Create tenant alert
   */
  async createAlert(
    tenantId: string,
    alertType: string,
    severity: AlertSeverity,
    title: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<TenantAlert> {
    const supabase = await this.getSupabase()

    const { data: alert, error } = await supabase
      .from('tenant_alerts')
      .insert({
        tenant_id: tenantId,
        alert_type: alertType,
        severity,
        title,
        description,
        status: 'active',
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) throw error

    // Log alert creation
    logger.warn('Tenant alert created', {
      tenantId,
      alertType,
      severity,
      title
    })

    // TODO: Send notifications based on alert severity

    return alert
  }

  /**
   * Get tenant alerts
   */
  async getTenantAlerts(
    tenantId: string,
    userId: string,
    status?: 'active' | 'acknowledged' | 'resolved',
    severity?: AlertSeverity
  ): Promise<TenantAlert[]> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    let query = supabase
      .from('tenant_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('triggered_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data: alerts, error } = await query

    if (error) throw error

    return alerts || []
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(
    alertId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    const { error } = await supabase
      .from('tenant_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('tenant_id', tenantId)

    if (error) throw error

    logger.info('Alert acknowledged', { alertId, tenantId, userId })
  }

  /**
   * Resolve alert
   */
  async resolveAlert(
    alertId: string,
    tenantId: string,
    userId: string,
    resolution?: string
  ): Promise<void> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    const { error } = await supabase
      .from('tenant_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution,
      })
      .eq('id', alertId)
      .eq('tenant_id', tenantId)

    if (error) throw error

    logger.info('Alert resolved', { alertId, tenantId, userId })
  }

  /**
   * Get system health overview
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const supabase = await this.getSupabase()

    // Get basic system metrics
    const [
      { count: totalTenants },
      { count: activeTenants },
      { count: totalUsers },
    ] = await Promise.all([
      supabase.from('tenants').select('*', { count: 'exact', head: true }),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('tenant_users').select('*', { count: 'exact', head: true }),
    ])

    // Get API metrics for last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: apiMetrics } = await supabase
      .from('tenant_metrics')
      .select('value')
      .eq('metric_name', 'api_requests')
      .gte('timestamp', oneHourAgo)

    const apiRequestsLastHour = (apiMetrics || []).reduce((sum, m) => sum + m.value, 0)

    // Get error metrics
    const { data: errorMetrics } = await supabase
      .from('tenant_metrics')
      .select('value')
      .eq('metric_name', 'api_errors')
      .gte('timestamp', oneHourAgo)

    const errorsLastHour = (errorMetrics || []).reduce((sum, m) => sum + m.value, 0)
    const errorRateLastHour = apiRequestsLastHour > 0 ? (errorsLastHour / apiRequestsLastHour) * 100 : 0

    // Get response time metrics
    const { data: responseTimeMetrics } = await supabase
      .from('tenant_metrics')
      .select('value')
      .eq('metric_name', 'api_response_time')
      .gte('timestamp', oneHourAgo)

    const averageResponseTime = responseTimeMetrics && responseTimeMetrics.length > 0
      ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
      : 0

    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (errorRateLastHour > 5) {
      overallStatus = 'critical'
    } else if (errorRateLastHour > 1 || averageResponseTime > 5000) {
      overallStatus = 'warning'
    }

    return {
      overall_status: overallStatus,
      components: {
        database: 'healthy', // TODO: Implement actual database health checks
        api: errorRateLastHour > 5 ? 'critical' : errorRateLastHour > 1 ? 'warning' : 'healthy',
        storage: 'healthy', // TODO: Implement storage health checks
        integrations: 'healthy', // TODO: Implement integration health checks
      },
      metrics: {
        total_tenants: totalTenants || 0,
        active_tenants: activeTenants || 0,
        total_users: totalUsers || 0,
        api_requests_last_hour: apiRequestsLastHour,
        error_rate_last_hour: errorRateLastHour,
        average_response_time: averageResponseTime,
      },
      last_updated: new Date().toISOString(),
    }
  }

  /**
   * Get tenant health status
   */
  async getTenantHealth(tenantId: string, userId: string): Promise<TenantHealth> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    // Get active alerts
    const { data: alerts } = await supabase
      .from('tenant_alerts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('triggered_at', { ascending: false })

    // Get recent metrics
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: metrics } = await supabase
      .from('tenant_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('timestamp', oneDayAgo)

    const metricsArray = metrics || []

    // Calculate health metrics
    const usersActive = await this.getActiveUsersCount(tenantId)
    const apiCallsToday = this.sumMetrics(metricsArray, 'api_requests')
    const errorsToday = this.sumMetrics(metricsArray, 'api_errors')
    const errorRateToday = apiCallsToday > 0 ? (errorsToday / apiCallsToday) * 100 : 0
    const storageUsedMb = this.sumMetrics(metricsArray, 'storage_used_mb')
    const lastActivity = this.getLastActivity(metricsArray)

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    const issues: TenantHealth['issues'] = []

    if (errorRateToday > 5) {
      status = 'critical'
      issues.push({
        type: 'high_error_rate',
        severity: 'high',
        description: `Error rate is ${errorRateToday.toFixed(1)}%`,
        detected_at: new Date().toISOString(),
      })
    } else if (errorRateToday > 1) {
      status = 'warning'
      issues.push({
        type: 'elevated_error_rate',
        severity: 'medium',
        description: `Error rate is ${errorRateToday.toFixed(1)}%`,
        detected_at: new Date().toISOString(),
      })
    }

    // Add alert issues
    for (const alert of alerts || []) {
      issues.push({
        type: alert.alert_type,
        severity: alert.severity,
        description: alert.description,
        detected_at: alert.triggered_at,
      })

      if (alert.severity === 'critical') {
        status = 'critical'
      } else if (alert.severity === 'high' && status === 'healthy') {
        status = 'warning'
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues, {
      usersActive,
      apiCallsToday,
      errorRateToday,
      storageUsedMb,
    })

    return {
      tenant_id: tenantId,
      status,
      issues,
      metrics: {
        users_active: usersActive,
        api_calls_today: apiCallsToday,
        error_rate_today: errorRateToday,
        storage_used_mb: storageUsedMb,
        last_activity: lastActivity,
      },
      recommendations,
    }
  }

  /**
   * Get monitoring dashboard data
   */
  async getMonitoringDashboard(userId: string): Promise<{
    systemHealth: SystemHealth
    tenantHealth: TenantHealth[]
    recentAlerts: TenantAlert[]
    keyMetrics: Record<string, number>
  }> {
    // Get user's tenants
    const userTenants = await tenantService.getUserTenants(userId)
    const tenantIds = userTenants.map(t => t.id)

    if (tenantIds.length === 0) {
      throw new AuthorizationError('User has no tenant access')
    }

    const supabase = await this.getSupabase()

    // Get system health
    const systemHealth = await this.getSystemHealth()

    // Get tenant health for user's tenants
    const tenantHealthPromises = tenantIds.map(tenantId =>
      this.getTenantHealth(tenantId, userId)
    )
    const tenantHealth = await Promise.all(tenantHealthPromises)

    // Get recent alerts
    const { data: recentAlerts } = await supabase
      .from('tenant_alerts')
      .select('*')
      .in('tenant_id', tenantIds)
      .eq('status', 'active')
      .order('triggered_at', { ascending: false })
      .limit(10)

    // Get key metrics
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: metrics } = await supabase
      .from('tenant_metrics')
      .select('metric_name, value')
      .in('tenant_id', tenantIds)
      .gte('timestamp', sevenDaysAgo)

    const keyMetrics = this.aggregateKeyMetrics(metrics || [])

    return {
      systemHealth,
      tenantHealth,
      recentAlerts: recentAlerts || [],
      keyMetrics,
    }
  }

  // =====================================
  // PRIVATE HELPERS
  // =====================================

  private async checkMetricAlerts(
    tenantId: string,
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const alertRules = this.getAlertRules()

    for (const rule of alertRules) {
      if (rule.metric === metricName && rule.condition(value)) {
        await this.createAlert(
          tenantId,
          rule.type,
          rule.severity,
          rule.title,
          rule.description(value, metadata),
          { metric: metricName, value, threshold: rule.threshold }
        )
      }
    }
  }

  private getAlertRules(): Array<{
    metric: string
    type: string
    severity: AlertSeverity
    threshold: number
    condition: (value: number) => boolean
    title: string
    description: (value: number, metadata?: any) => string
  }> {
    return [
      {
        metric: 'error_rate',
        type: 'high_error_rate',
        severity: 'high',
        threshold: 5,
        condition: (value) => value > 5,
        title: 'High Error Rate Detected',
        description: (value) => `Error rate has exceeded ${value.toFixed(1)}%`,
      },
      {
        metric: 'api_response_time',
        type: 'slow_response_time',
        severity: 'medium',
        threshold: 5000,
        condition: (value) => value > 5000,
        title: 'Slow API Response Time',
        description: (value) => `Average response time is ${value.toFixed(0)}ms`,
      },
      {
        metric: 'storage_used_mb',
        type: 'storage_warning',
        severity: 'medium',
        threshold: 900, // 90% of 1GB
        condition: (value) => value > 900,
        title: 'Storage Usage Warning',
        description: (value) => `Storage usage is ${value}MB`,
      },
    ]
  }

  private async getActiveUsersCount(tenantId: string): Promise<number> {
    const supabase = await this.getSupabase()

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('tenant_users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .gte('last_active_at', oneDayAgo)

    return count || 0
  }

  private sumMetrics(metrics: TenantMetric[], metricName: string): number {
    return metrics
      .filter(m => m.metric_name === metricName)
      .reduce((sum, m) => sum + m.value, 0)
  }

  private getLastActivity(metrics: TenantMetric[]): string {
    if (metrics.length === 0) return 'Never'

    const sortedMetrics = metrics.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return sortedMetrics[0].timestamp
  }

  private generateRecommendations(
    issues: TenantHealth['issues'],
    metrics: any
  ): string[] {
    const recommendations: string[] = []

    if (issues.some(i => i.type === 'high_error_rate')) {
      recommendations.push('Review recent API errors and implement error handling improvements')
    }

    if (metrics.errorRateToday > 1) {
      recommendations.push('Monitor API error patterns and consider implementing circuit breakers')
    }

    if (metrics.apiCallsToday === 0) {
      recommendations.push('Consider sending test API requests to verify system connectivity')
    }

    if (metrics.storageUsedMb > 800) {
      recommendations.push('Review storage usage and consider data cleanup or storage optimization')
    }

    if (issues.length === 0 && metrics.usersActive > 0) {
      recommendations.push('System is operating normally')
    }

    return recommendations
  }

  private aggregateKeyMetrics(metrics: any[]): Record<string, number> {
    const aggregated: Record<string, number> = {}

    for (const metric of metrics) {
      const key = metric.metric_name
      aggregated[key] = (aggregated[key] || 0) + metric.value
    }

    return aggregated
  }
}

// Export singleton instance
export const tenantMonitoringService = new TenantMonitoringService()