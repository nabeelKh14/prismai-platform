import { createClient } from '@/lib/supabase/server'
import { performanceMonitor } from './performance-monitor'
import { logger } from '@/lib/logger'

export interface DatabaseHealthMetrics {
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  uptime: number
  activeConnections: number
  totalConnections: number
  connectionUtilization: number
  cacheHitRate: number
  avgQueryTime: number
  slowQueryCount: number
  deadlockCount: number
  lastChecked: string
}

export interface DatabaseResourceMetrics {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkIO: number
  databaseSize: number
  tempFileSize: number
  walFileSize: number
}

export interface QueryPerformanceMetrics {
  totalQueries: number
  avgExecutionTime: number
  p95ExecutionTime: number
  p99ExecutionTime: number
  slowQueries: number
  failedQueries: number
  topSlowQueries: Array<{
    query: string
    executionTime: number
    frequency: number
  }>
}

export interface IndexPerformanceMetrics {
  totalIndexes: number
  unusedIndexes: number
  bloatedIndexes: number
  indexHitRate: number
  indexUsageStats: Array<{
    indexName: string
    tableName: string
    scans: number
    tuplesRead: number
    tuplesFetched: number
  }>
}

export interface DatabaseAlert {
  id: string
  type: 'performance' | 'resource' | 'security' | 'availability'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: Record<string, any>
  threshold: number
  currentValue: number
  timestamp: string
  resolved: boolean
  resolvedAt?: string
}

export class DatabasePerformanceMonitor {
  private static instance: DatabasePerformanceMonitor
  private alerts: DatabaseAlert[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  private readonly monitoringIntervalMs = 30000 // 30 seconds
  private readonly alertRetentionDays = 7

  // Alert thresholds
  private thresholds = {
    maxConnections: 80, // percentage
    slowQueryThreshold: 5000, // ms
    highCpuThreshold: 80, // percentage
    highMemoryThreshold: 85, // percentage
    lowCacheHitRate: 70, // percentage
    maxDeadlocks: 5, // per hour
    maxFailedQueries: 10 // per hour
  }

  static getInstance(): DatabasePerformanceMonitor {
    if (!DatabasePerformanceMonitor.instance) {
      DatabasePerformanceMonitor.instance = new DatabasePerformanceMonitor()
    }
    return DatabasePerformanceMonitor.instance
  }

  /**
   * Start comprehensive database monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      logger.warn('Database monitoring already running')
      return
    }

    logger.info('Starting comprehensive database performance monitoring')

    // Initial health check
    await this.performHealthCheck()

    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck()
        await this.checkAlertConditions()
        await this.cleanupOldAlerts()
      } catch (error) {
        logger.error('Error during database monitoring cycle', { error })
      }
    }, this.monitoringIntervalMs)
  }

  /**
   * Stop database monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      logger.info('Database performance monitoring stopped')
    }
  }

  /**
   * Perform comprehensive database health check
   */
  async performHealthCheck(): Promise<DatabaseHealthMetrics> {
    try {
      const supabase = await createClient()
      const timestamp = new Date().toISOString()

      // Get connection pool statistics
      const { data: connectionStats, error: connError } = await supabase.rpc('get_connection_pool_stats')

      // Get query performance metrics
      const { data: queryStats, error: queryError } = await supabase.rpc('get_query_performance_summary')

      // Get system resource metrics
      const { data: systemStats, error: sysError } = await supabase.rpc('get_system_resource_stats')

      // Calculate health status
      const healthMetrics: DatabaseHealthMetrics = {
        status: this.calculateHealthStatus(connectionStats, queryStats, systemStats),
        uptime: systemStats?.uptime || 0,
        activeConnections: connectionStats?.active_connections || 0,
        totalConnections: connectionStats?.total_connections || 0,
        connectionUtilization: connectionStats?.pool_utilization || 0,
        cacheHitRate: systemStats?.cache_hit_rate || 0,
        avgQueryTime: queryStats?.avg_execution_time || 0,
        slowQueryCount: queryStats?.slow_queries || 0,
        deadlockCount: systemStats?.deadlocks || 0,
        lastChecked: timestamp
      }

      // Record health metrics
      await this.recordHealthMetrics(healthMetrics)

      return healthMetrics

    } catch (error) {
      logger.error('Error performing database health check', { error })

      // Return degraded health status
      return {
        status: 'unknown',
        uptime: 0,
        activeConnections: 0,
        totalConnections: 0,
        connectionUtilization: 0,
        cacheHitRate: 0,
        avgQueryTime: 0,
        slowQueryCount: 0,
        deadlockCount: 0,
        lastChecked: new Date().toISOString()
      }
    }
  }

  /**
   * Get detailed resource metrics
   */
  async getResourceMetrics(): Promise<DatabaseResourceMetrics> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc('get_detailed_resource_metrics')

      if (error) throw error

      return {
        cpuUsage: data.cpu_usage || 0,
        memoryUsage: data.memory_usage || 0,
        diskUsage: data.disk_usage || 0,
        networkIO: data.network_io || 0,
        databaseSize: data.database_size || 0,
        tempFileSize: data.temp_file_size || 0,
        walFileSize: data.wal_file_size || 0
      }

    } catch (error) {
      logger.error('Error getting resource metrics', { error })
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIO: 0,
        databaseSize: 0,
        tempFileSize: 0,
        walFileSize: 0
      }
    }
  }

  /**
   * Get query performance metrics
   */
  async getQueryPerformanceMetrics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<QueryPerformanceMetrics> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc('get_query_performance_metrics', {
        time_range: timeRange
      })

      if (error) throw error

      return {
        totalQueries: data.total_queries || 0,
        avgExecutionTime: data.avg_execution_time || 0,
        p95ExecutionTime: data.p95_execution_time || 0,
        p99ExecutionTime: data.p99_execution_time || 0,
        slowQueries: data.slow_queries || 0,
        failedQueries: data.failed_queries || 0,
        topSlowQueries: data.top_slow_queries || []
      }

    } catch (error) {
      logger.error('Error getting query performance metrics', { error })
      return {
        totalQueries: 0,
        avgExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0,
        slowQueries: 0,
        failedQueries: 0,
        topSlowQueries: []
      }
    }
  }

  /**
   * Get index performance metrics
   */
  async getIndexPerformanceMetrics(): Promise<IndexPerformanceMetrics> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc('get_index_performance_metrics')

      if (error) throw error

      return {
        totalIndexes: data.total_indexes || 0,
        unusedIndexes: data.unused_indexes || 0,
        bloatedIndexes: data.bloated_indexes || 0,
        indexHitRate: data.index_hit_rate || 0,
        indexUsageStats: data.index_usage_stats || []
      }

    } catch (error) {
      logger.error('Error getting index performance metrics', { error })
      return {
        totalIndexes: 0,
        unusedIndexes: 0,
        bloatedIndexes: 0,
        indexHitRate: 0,
        indexUsageStats: []
      }
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): DatabaseAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * Get alert history
   */
  async getAlertHistory(
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h',
    severity?: DatabaseAlert['severity']
  ): Promise<DatabaseAlert[]> {
    try {
      const supabase = await createClient()
      const timeFilter = this.getTimeFilter(timeRange)

      let query = supabase
        .from('database_alerts')
        .select('*')
        .gte('timestamp', timeFilter)
        .order('timestamp', { ascending: false })

      if (severity) {
        query = query.eq('severity', severity)
      }

      const { data, error } = await query
      if (error) throw error

      return data || []

    } catch (error) {
      logger.error('Error getting alert history', { error })
      return []
    }
  }

  /**
   * Manually trigger health check
   */
  async triggerHealthCheck(): Promise<DatabaseHealthMetrics> {
    return this.performHealthCheck()
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds }
    logger.info('Database monitoring thresholds updated', { newThresholds })
  }

  /**
   * Private methods
   */
  private calculateHealthStatus(
    connectionStats: any,
    queryStats: any,
    systemStats: any
  ): DatabaseHealthMetrics['status'] {
    const issues: string[] = []

    if (connectionStats?.pool_utilization > this.thresholds.maxConnections) {
      issues.push('high_connection_utilization')
    }

    if (queryStats?.slow_queries > 10) {
      issues.push('high_slow_query_count')
    }

    if (systemStats?.cpu_usage > this.thresholds.highCpuThreshold) {
      issues.push('high_cpu_usage')
    }

    if (systemStats?.memory_usage > this.thresholds.highMemoryThreshold) {
      issues.push('high_memory_usage')
    }

    if (systemStats?.cache_hit_rate < this.thresholds.lowCacheHitRate) {
      issues.push('low_cache_hit_rate')
    }

    if (issues.length === 0) return 'healthy'
    if (issues.length <= 2) return 'warning'
    return 'critical'
  }

  private async checkAlertConditions(): Promise<void> {
    try {
      const healthMetrics = await this.performHealthCheck()
      const resourceMetrics = await this.getResourceMetrics()
      const queryMetrics = await this.getQueryPerformanceMetrics('1h')

      // Check connection utilization
      if (healthMetrics.connectionUtilization > this.thresholds.maxConnections) {
        await this.createAlert({
          type: 'performance',
          severity: 'high',
          message: 'High database connection utilization detected',
          details: { currentUtilization: healthMetrics.connectionUtilization },
          threshold: this.thresholds.maxConnections,
          currentValue: healthMetrics.connectionUtilization
        })
      }

      // Check slow queries
      if (queryMetrics.slowQueries > 50) {
        await this.createAlert({
          type: 'performance',
          severity: 'medium',
          message: 'High number of slow queries detected',
          details: { slowQueryCount: queryMetrics.slowQueries },
          threshold: 50,
          currentValue: queryMetrics.slowQueries
        })
      }

      // Check CPU usage
      if (resourceMetrics.cpuUsage > this.thresholds.highCpuThreshold) {
        await this.createAlert({
          type: 'resource',
          severity: 'high',
          message: 'High CPU usage detected',
          details: { cpuUsage: resourceMetrics.cpuUsage },
          threshold: this.thresholds.highCpuThreshold,
          currentValue: resourceMetrics.cpuUsage
        })
      }

      // Check memory usage
      if (resourceMetrics.memoryUsage > this.thresholds.highMemoryThreshold) {
        await this.createAlert({
          type: 'resource',
          severity: 'critical',
          message: 'High memory usage detected',
          details: { memoryUsage: resourceMetrics.memoryUsage },
          threshold: this.thresholds.highMemoryThreshold,
          currentValue: resourceMetrics.memoryUsage
        })
      }

      // Check cache hit rate
      if (healthMetrics.cacheHitRate < this.thresholds.lowCacheHitRate) {
        await this.createAlert({
          type: 'performance',
          severity: 'medium',
          message: 'Low cache hit rate detected',
          details: { cacheHitRate: healthMetrics.cacheHitRate },
          threshold: this.thresholds.lowCacheHitRate,
          currentValue: healthMetrics.cacheHitRate
        })
      }

    } catch (error) {
      logger.error('Error checking alert conditions', { error })
    }
  }

  private async createAlert(alertData: Omit<DatabaseAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const alert: DatabaseAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      resolved: false
    }

    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a =>
      a.type === alert.type &&
      a.message === alert.message &&
      !a.resolved &&
      Date.now() - new Date(a.timestamp).getTime() < 300000 // 5 minutes
    )

    if (!existingAlert) {
      this.alerts.unshift(alert)

      // Store in database
      try {
        const supabase = await createClient()
        await supabase.from('database_alerts').insert({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          details: alert.details,
          threshold: alert.threshold,
          current_value: alert.currentValue,
          timestamp: alert.timestamp,
          resolved: false
        })
      } catch (error) {
        logger.error('Error storing database alert', { error })
      }

      logger.warn('Database alert created', {
        type: alert.type,
        severity: alert.severity,
        message: alert.message
      })
    }
  }

  private async recordHealthMetrics(metrics: DatabaseHealthMetrics): Promise<void> {
    await performanceMonitor.recordSystemMetric({
      memory_usage_mb: 0, // Would be populated from actual system metrics
      memory_total_mb: 0,
      cpu_usage_percent: 0,
      active_connections: metrics.activeConnections,
      timestamp: metrics.lastChecked
    })
  }

  private async cleanupOldAlerts(): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.alertRetentionDays)

      // Remove from memory
      this.alerts = this.alerts.filter(alert =>
        !alert.resolved || new Date(alert.timestamp) > cutoffDate
      )

      // Remove from database
      const supabase = await createClient()
      await supabase
        .from('database_alerts')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())

    } catch (error) {
      logger.error('Error cleaning up old alerts', { error })
    }
  }

  private getTimeFilter(timeRange: string): string {
    const now = new Date()
    switch (timeRange) {
      case '1h': now.setHours(now.getHours() - 1); break
      case '24h': now.setDate(now.getDate() - 1); break
      case '7d': now.setDate(now.getDate() - 7); break
      case '30d': now.setMonth(now.getMonth() - 1); break
    }
    return now.toISOString()
  }
}

// Export singleton instance
export const databasePerformanceMonitor = DatabasePerformanceMonitor.getInstance()