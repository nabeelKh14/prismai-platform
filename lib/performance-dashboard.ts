import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { loadBalancer } from '@/lib/monitoring/load-balancer'
import { createRedisCache } from '@/lib/cache/redis-cache'
import { aiOptimizer } from '@/lib/ai/ai-optimizer'
import { backgroundJobProcessor } from '@/lib/background-job-processor'
import { memoryOptimizer } from '@/lib/memory-optimizer'
import { websocketOptimizer } from '@/lib/websocket-optimizer'
import { logger } from '@/lib/logger'

export interface PerformanceMetrics {
  timestamp: string
  apiMetrics: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    throughput: number
    cacheHitRate: number
  }
  systemMetrics: {
    memoryUsage: number
    cpuUsage: number
    activeConnections: number
    loadAverage: number
  }
  aiMetrics: {
    totalRequests: number
    cacheHitRate: number
    averageResponseTime: number
    totalCost: number
    savedCost: number
  }
  loadBalancerMetrics: {
    totalServers: number
    healthyServers: number
    totalConnections: number
    averageLoad: number
  }
  jobMetrics: {
    queued: number
    processing: number
    completed: number
    failed: number
    averageProcessingTime: number
  }
  websocketMetrics: {
    totalConnections: number
    activeConnections: number
    subscriptions: number
    messagesPerSecond: number
  }
  cacheMetrics: {
    totalKeys: number
    memoryUsage: string
    hitRate: number
  }
}

export interface PerformanceAlert {
  id: string
  type: 'error' | 'warning' | 'info'
  category: 'api' | 'system' | 'ai' | 'loadbalancer' | 'jobs' | 'websocket' | 'cache'
  title: string
  message: string
  timestamp: string
  metadata?: Record<string, any>
  resolved?: boolean
  resolvedAt?: string
}

export interface PerformanceConfig {
  enableRealTimeMetrics?: boolean
  metricsInterval?: number
  alertThresholds?: {
    maxErrorRate?: number
    maxResponseTime?: number
    minCacheHitRate?: number
    maxMemoryUsage?: number
    maxCPUUsage?: number
    minHealthyServers?: number
  }
  enableAlerts?: boolean
  alertInterval?: number
  retentionDays?: number
}

export class PerformanceDashboard {
  private cache = createRedisCache()
  private config: Required<PerformanceConfig>
  private metricsInterval?: NodeJS.Timeout
  private alertInterval?: NodeJS.Timeout
  private alerts: PerformanceAlert[] = []
  private lastMetrics: Partial<PerformanceMetrics> = {}

  constructor(config?: PerformanceConfig) {
    this.config = {
      enableRealTimeMetrics: true,
      metricsInterval: 30000, // 30 seconds
      alertThresholds: {
        maxErrorRate: 5,
        maxResponseTime: 5000,
        minCacheHitRate: 80,
        maxMemoryUsage: 500,
        maxCPUUsage: 80,
        minHealthyServers: 1
      },
      enableAlerts: true,
      alertInterval: 60000, // 1 minute
      retentionDays: 30,
      ...config
    }

    if (this.config.enableRealTimeMetrics) {
      this.startMetricsCollection()
    }

    if (this.config.enableAlerts) {
      this.startAlertMonitoring()
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const now = new Date().toISOString()
    const timestamp = now

    // Get API metrics
    const apiMetrics = await this.getAPIMetrics()

    // Get system metrics
    const systemMetrics = await this.getSystemMetrics()

    // Get AI metrics
    const aiMetrics = await this.getAIMetrics()

    // Get load balancer metrics
    const loadBalancerMetrics = this.getLoadBalancerMetrics()

    // Get job metrics
    const jobMetrics = this.getJobMetrics()

    // Get WebSocket metrics
    const websocketMetrics = this.getWebSocketMetrics()

    // Get cache metrics
    const cacheMetrics = await this.getCacheMetrics()

    const metrics: PerformanceMetrics = {
      timestamp,
      apiMetrics,
      systemMetrics,
      aiMetrics,
      loadBalancerMetrics,
      jobMetrics,
      websocketMetrics,
      cacheMetrics
    }

    this.lastMetrics = metrics
    return metrics
  }

  /**
   * Get API performance metrics
   */
  private async getAPIMetrics() {
    try {
      // Get recent API metrics from performance monitor
      const recentMetrics = await performanceMonitor.getMetrics(
        'api_response',
        undefined,
        undefined,
        undefined,
        100
      )

      const totalRequests = recentMetrics.length
      const averageResponseTime = totalRequests > 0
        ? recentMetrics.reduce((sum, m) => sum + m.value, 0) / totalRequests
        : 0

      // Get error metrics
      const errorMetrics = await performanceMonitor.getMetrics(
        'error_rate',
        undefined,
        undefined,
        undefined,
        10
      )

      const errorRate = errorMetrics.length > 0
        ? errorMetrics[errorMetrics.length - 1].value
        : 0

      // Get throughput metrics
      const throughputMetrics = await performanceMonitor.getMetrics(
        'throughput',
        undefined,
        undefined,
        undefined,
        10
      )

      const throughput = throughputMetrics.length > 0
        ? throughputMetrics[throughputMetrics.length - 1].value
        : 0

      // Get cache metrics
      const cacheMetrics = await performanceMonitor.getMetrics(
        'cache_hit_rate',
        undefined,
        undefined,
        undefined,
        10
      )

      const cacheHitRate = cacheMetrics.length > 0
        ? cacheMetrics[cacheMetrics.length - 1].value
        : 0

      return {
        totalRequests,
        averageResponseTime: Math.round(averageResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        throughput: Math.round(throughput * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100
      }

    } catch (error) {
      logger.error('Failed to get API metrics', { error })
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        cacheHitRate: 0
      }
    }
  }

  /**
   * Get system performance metrics
   */
  private async getSystemMetrics() {
    try {
      const memoryMetrics = await performanceMonitor.getMetrics(
        'memory_usage',
        undefined,
        undefined,
        undefined,
        10
      )

      const memoryUsage = memoryMetrics.length > 0
        ? memoryMetrics[memoryMetrics.length - 1].value
        : 0

      const cpuMetrics = await performanceMonitor.getMetrics(
        'cpu_usage',
        undefined,
        undefined,
        undefined,
        10
      )

      const cpuUsage = cpuMetrics.length > 0
        ? cpuMetrics[cpuMetrics.length - 1].value
        : 0

      const concurrencyMetrics = await performanceMonitor.getMetrics(
        'concurrency',
        undefined,
        undefined,
        undefined,
        10
      )

      const activeConnections = concurrencyMetrics.length > 0
        ? concurrencyMetrics[concurrencyMetrics.length - 1].value
        : 0

      const loadMetrics = await performanceMonitor.getMetrics(
        'load_average',
        undefined,
        undefined,
        undefined,
        10
      )

      const loadAverage = loadMetrics.length > 0
        ? loadMetrics[loadMetrics.length - 1].value
        : 0

      return {
        memoryUsage: Math.round(memoryUsage),
        cpuUsage: Math.round(cpuUsage),
        activeConnections: Math.round(activeConnections),
        loadAverage: Math.round(loadAverage * 100) / 100
      }

    } catch (error) {
      logger.error('Failed to get system metrics', { error })
      return {
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0,
        loadAverage: 0
      }
    }
  }

  /**
   * Get AI performance metrics
   */
  private async getAIMetrics() {
    try {
      // This would require additional tracking in the AI optimizer
      // For now, return placeholder values
      return {
        totalRequests: 0,
        cacheHitRate: 0,
        averageResponseTime: 0,
        totalCost: 0,
        savedCost: 0
      }
    } catch (error) {
      logger.error('Failed to get AI metrics', { error })
      return {
        totalRequests: 0,
        cacheHitRate: 0,
        averageResponseTime: 0,
        totalCost: 0,
        savedCost: 0
      }
    }
  }

  /**
   * Get load balancer metrics
   */
  private getLoadBalancerMetrics() {
    const stats = loadBalancer.getStatistics()

    return {
      totalServers: stats.totalServers,
      healthyServers: stats.healthyServers,
      totalConnections: stats.totalConnections,
      averageLoad: Math.round(stats.averageLoad)
    }
  }

  /**
   * Get job processing metrics
   */
  private getJobMetrics() {
    const stats = backgroundJobProcessor.getQueueStats()

    return {
      queued: stats.queued,
      processing: stats.processing,
      completed: stats.completed,
      failed: stats.failed,
      averageProcessingTime: 0 // Would need additional tracking
    }
  }

  /**
   * Get WebSocket metrics
   */
  private getWebSocketMetrics() {
    const stats = websocketOptimizer.getConnectionStats()

    return {
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      subscriptions: stats.subscriptions,
      messagesPerSecond: stats.messagesPerSecond
    }
  }

  /**
   * Get cache metrics
   */
  private async getCacheMetrics() {
    try {
      const cacheStats = await this.cache.getStats()

      return {
        totalKeys: cacheStats.keys,
        memoryUsage: cacheStats.memoryUsage || 'unknown',
        hitRate: 0 // Would need additional tracking
      }
    } catch (error) {
      logger.error('Failed to get cache metrics', { error })
      return {
        totalKeys: 0,
        memoryUsage: 'unknown',
        hitRate: 0
      }
    }
  }

  /**
   * Get performance alerts
   */
  async getAlerts(
    options?: {
      type?: PerformanceAlert['type']
      category?: PerformanceAlert['category']
      limit?: number
      resolved?: boolean
    }
  ): Promise<PerformanceAlert[]> {
    let alerts = [...this.alerts]

    if (options?.type) {
      alerts = alerts.filter(alert => alert.type === options.type)
    }

    if (options?.category) {
      alerts = alerts.filter(alert => alert.category === options.category)
    }

    if (options?.resolved !== undefined) {
      alerts = alerts.filter(alert => alert.resolved === options.resolved)
    }

    if (options?.limit) {
      alerts = alerts.slice(0, options.limit)
    }

    return alerts
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (!alert) {
      return false
    }

    alert.resolved = true
    alert.resolvedAt = new Date().toISOString()

    logger.info('Alert resolved', { alertId, title: alert.title })
    return true
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(): Promise<{
    overall: 'excellent' | 'good' | 'fair' | 'poor'
    score: number
    issues: string[]
    recommendations: string[]
  }> {
    const metrics = await this.getPerformanceMetrics()
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    // API Performance
    if (metrics.apiMetrics.errorRate > (this.config.alertThresholds.maxErrorRate || 5)) {
      issues.push(`High API error rate: ${metrics.apiMetrics.errorRate}%`)
      score -= 20
    }

    if (metrics.apiMetrics.averageResponseTime > (this.config.alertThresholds.maxResponseTime || 5000)) {
      issues.push(`Slow API response time: ${metrics.apiMetrics.averageResponseTime}ms`)
      score -= 15
    }

    if (metrics.apiMetrics.cacheHitRate < (this.config.alertThresholds.minCacheHitRate || 80)) {
      issues.push(`Low cache hit rate: ${metrics.apiMetrics.cacheHitRate}%`)
      recommendations.push('Consider optimizing cache strategies')
      score -= 10
    }

    // System Performance
    if (metrics.systemMetrics.memoryUsage > (this.config.alertThresholds.maxMemoryUsage || 500)) {
      issues.push(`High memory usage: ${metrics.systemMetrics.memoryUsage}MB`)
      recommendations.push('Consider memory optimization or scaling')
      score -= 20
    }

    if (metrics.systemMetrics.cpuUsage > (this.config.alertThresholds.maxCPUUsage || 80)) {
      issues.push(`High CPU usage: ${metrics.systemMetrics.cpuUsage}%`)
      recommendations.push('Consider CPU optimization or scaling')
      score -= 15
    }

    // Load Balancer
    if (metrics.loadBalancerMetrics.healthyServers < (this.config.alertThresholds.minHealthyServers || 1)) {
      issues.push('No healthy servers available')
      score -= 30
    }

    if (metrics.loadBalancerMetrics.averageLoad > 80) {
      issues.push('High server load detected')
      recommendations.push('Consider scaling up server instances')
      score -= 10
    }

    // Determine overall performance
    let overall: 'excellent' | 'good' | 'fair' | 'poor'
    if (score >= 90) overall = 'excellent'
    else if (score >= 70) overall = 'good'
    else if (score >= 50) overall = 'fair'
    else overall = 'poor'

    return {
      overall,
      score: Math.max(0, Math.min(100, score)),
      issues,
      recommendations
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getPerformanceMetrics()

        // Store metrics in cache for persistence
        await this.cache.set('performance_metrics_latest', metrics, 3600000) // 1 hour

        // Store historical metrics
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await this.cache.set(`performance_metrics_${timestamp}`, metrics, 86400000 * this.config.retentionDays) // Retention period

        logger.debug('Performance metrics collected', {
          timestamp: metrics.timestamp,
          apiRequests: metrics.apiMetrics.totalRequests,
          memoryUsage: metrics.systemMetrics.memoryUsage
        })

      } catch (error) {
        logger.error('Failed to collect performance metrics', { error })
      }
    }, this.config.metricsInterval)
  }

  /**
   * Start alert monitoring
   */
  private startAlertMonitoring(): void {
    this.alertInterval = setInterval(async () => {
      try {
        await this.checkAndCreateAlerts()
      } catch (error) {
        logger.error('Failed to check alerts', { error })
      }
    }, this.config.alertInterval)
  }

  /**
   * Check and create alerts
   */
  private async checkAndCreateAlerts(): Promise<void> {
    const metrics = await this.getPerformanceMetrics()
    const thresholds = this.config.alertThresholds

    // API Error Rate Alert
    if (metrics.apiMetrics.errorRate > (thresholds.maxErrorRate || 5)) {
      this.createAlert({
        type: 'error',
        category: 'api',
        title: 'High API Error Rate',
        message: `API error rate is ${metrics.apiMetrics.errorRate}%, exceeding threshold of ${thresholds.maxErrorRate}%`
      })
    }

    // Slow Response Time Alert
    if (metrics.apiMetrics.averageResponseTime > (thresholds.maxResponseTime || 5000)) {
      this.createAlert({
        type: 'warning',
        category: 'api',
        title: 'Slow API Response Time',
        message: `Average response time is ${metrics.apiMetrics.averageResponseTime}ms, exceeding threshold of ${thresholds.maxResponseTime}ms`
      })
    }

    // Low Cache Hit Rate Alert
    if (metrics.apiMetrics.cacheHitRate < (thresholds.minCacheHitRate || 80)) {
      this.createAlert({
        type: 'warning',
        category: 'api',
        title: 'Low Cache Hit Rate',
        message: `Cache hit rate is ${metrics.apiMetrics.cacheHitRate}%, below threshold of ${thresholds.minCacheHitRate}%`
      })
    }

    // High Memory Usage Alert
    if (metrics.systemMetrics.memoryUsage > (thresholds.maxMemoryUsage || 500)) {
      this.createAlert({
        type: 'warning',
        category: 'system',
        title: 'High Memory Usage',
        message: `Memory usage is ${metrics.systemMetrics.memoryUsage}MB, exceeding threshold of ${thresholds.maxMemoryUsage}MB`
      })
    }

    // High CPU Usage Alert
    if (metrics.systemMetrics.cpuUsage > (thresholds.maxCPUUsage || 80)) {
      this.createAlert({
        type: 'warning',
        category: 'system',
        title: 'High CPU Usage',
        message: `CPU usage is ${metrics.systemMetrics.cpuUsage}%, exceeding threshold of ${thresholds.maxCPUUsage}%`
      })
    }

    // Load Balancer Alert
    if (metrics.loadBalancerMetrics.healthyServers < (thresholds.minHealthyServers || 1)) {
      this.createAlert({
        type: 'error',
        category: 'loadbalancer',
        title: 'No Healthy Servers',
        message: 'No healthy servers are available in the load balancer'
      })
    }

    // Clean up old alerts
    this.cleanupOldAlerts()
  }

  /**
   * Create new alert
   */
  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.alerts.find(alert =>
      alert.title === alertData.title &&
      alert.category === alertData.category &&
      !alert.resolved
    )

    if (existingAlert) {
      // Update existing alert
      existingAlert.message = alertData.message
      existingAlert.metadata = alertData.metadata
      return
    }

    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...alertData
    }

    this.alerts.push(alert)

    logger.warn('Performance alert created', {
      alertId: alert.id,
      type: alert.type,
      category: alert.category,
      title: alert.title
    })
  }

  /**
   * Clean up old alerts
   */
  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000) // 24 hours ago
    this.alerts = this.alerts.filter(alert => {
      const alertTime = new Date(alert.timestamp).getTime()
      return alertTime > cutoffTime || !alert.resolved
    })
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(
    startTime: string,
    endTime: string,
    interval: '5m' | '1h' | '1d' = '1h'
  ): Promise<PerformanceMetrics[]> {
    try {
      const metrics: PerformanceMetrics[] = []

      // This would query stored historical metrics
      // For now, return current metrics as placeholder
      const currentMetrics = await this.getPerformanceMetrics()
      metrics.push(currentMetrics)

      return metrics
    } catch (error) {
      logger.error('Failed to get historical metrics', { error })
      return []
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    if (this.alertInterval) {
      clearInterval(this.alertInterval)
    }

    this.alerts.length = 0
    logger.info('Performance dashboard cleaned up')
  }
}

// Export singleton instance
export const performanceDashboard = new PerformanceDashboard()

// Export factory function
export function createPerformanceDashboard(config?: PerformanceConfig): PerformanceDashboard {
  return new PerformanceDashboard(config)
}