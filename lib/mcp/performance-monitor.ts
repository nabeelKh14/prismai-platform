/**
 * Performance Monitoring for Optimized Data Sources
 * Tracks performance metrics, identifies bottlenecks, and provides optimization recommendations
 */

import { intelligentCache } from './cache'
import { logger } from '@/lib/logger'

export interface PerformanceMetrics {
  timestamp: number
  source: string
  operation: string
  duration: number
  success: boolean
  cacheHit: boolean
  dataSize: number
  errorType?: string
  retryCount?: number
}

export interface PerformanceReport {
  period: {
    start: number
    end: number
  }
  summary: {
    totalRequests: number
    averageResponseTime: number
    cacheHitRate: number
    errorRate: number
    throughput: number // requests per minute
  }
  bySource: Record<string, {
    totalRequests: number
    averageResponseTime: number
    cacheHitRate: number
    errorRate: number
    dataTransferred: number
    recommendations: string[]
  }>
  bottlenecks: Array<{
    source: string
    operation: string
    averageTime: number
    frequency: number
    impact: 'low' | 'medium' | 'high' | 'critical'
  }>
  recommendations: string[]
}

export interface AlertRule {
  name: string
  condition: (metrics: PerformanceMetrics[]) => boolean
  threshold: number
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  cooldown: number // minutes
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private maxMetricsHistory = 10000
  private alertRules: AlertRule[] = []
  private lastAlerts: Map<string, number> = new Map()
  private monitoringInterval?: NodeJS.Timeout

  constructor() {
    this.initializeAlertRules()
    this.startMonitoring()
  }

  /**
   * Record performance metric
   */
  recordMetric(metric: Omit<PerformanceMetrics, 'timestamp'>): void {
    const fullMetric: PerformanceMetrics = {
      ...metric,
      timestamp: Date.now()
    }

    this.metrics.push(fullMetric)

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory)
    }

    // Check alert rules
    this.checkAlerts([fullMetric])

    logger.debug('Performance metric recorded', {
      source: metric.source,
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
      cacheHit: metric.cacheHit
    })
  }

  /**
   * Initialize default alert rules
   */
  private initializeAlertRules(): void {
    this.alertRules = [
      {
        name: 'high-response-time',
        condition: (metrics) => {
          const recent = metrics.filter(m => Date.now() - m.timestamp < 300000) // Last 5 minutes
          if (recent.length < 5) return false

          const avgTime = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length
          return avgTime > 5000 // 5 seconds average
        },
        threshold: 5000,
        severity: 'warning',
        message: 'High average response time detected',
        cooldown: 5
      },
      {
        name: 'low-cache-hit-rate',
        condition: (metrics) => {
          const recent = metrics.filter(m => Date.now() - m.timestamp < 600000) // Last 10 minutes
          if (recent.length < 10) return false

          const cacheHits = recent.filter(m => m.cacheHit).length
          const hitRate = (cacheHits / recent.length) * 100
          return hitRate < 30 // Less than 30% cache hit rate
        },
        threshold: 30,
        severity: 'warning',
        message: 'Low cache hit rate detected',
        cooldown: 10
      },
      {
        name: 'high-error-rate',
        condition: (metrics) => {
          const recent = metrics.filter(m => Date.now() - m.timestamp < 300000) // Last 5 minutes
          if (recent.length < 5) return false

          const errors = recent.filter(m => !m.success).length
          const errorRate = (errors / recent.length) * 100
          return errorRate > 20 // More than 20% error rate
        },
        threshold: 20,
        severity: 'error',
        message: 'High error rate detected',
        cooldown: 5
      },
      {
        name: 'cache-thrashing',
        condition: (metrics) => {
          const recent = metrics.filter(m => Date.now() - m.timestamp < 600000) // Last 10 minutes
          if (recent.length < 20) return false

          // Check for frequent cache misses followed by immediate requests
          const cacheMisses = recent.filter(m => !m.cacheHit)
          const missRate = (cacheMisses.length / recent.length) * 100

          return missRate > 70 // More than 70% cache misses
        },
        threshold: 70,
        severity: 'critical',
        message: 'Cache thrashing detected',
        cooldown: 15
      }
    ]
  }

  /**
   * Check alert rules
   */
  private checkAlerts(newMetrics: PerformanceMetrics[]): void {
    for (const rule of this.alertRules) {
      try {
        if (rule.condition(this.metrics)) {
          const lastAlert = this.lastAlerts.get(rule.name) || 0
          const cooldownMs = rule.cooldown * 60 * 1000

          if (Date.now() - lastAlert > cooldownMs) {
            this.triggerAlert(rule, newMetrics)
            this.lastAlerts.set(rule.name, Date.now())
          }
        }
      } catch (error) {
        logger.error(`Error checking alert rule ${rule.name}:`, {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(rule: AlertRule, metrics: PerformanceMetrics[]): void {
    const alertData = {
      rule: rule.name,
      severity: rule.severity,
      message: rule.message,
      threshold: rule.threshold,
      currentValue: this.calculateCurrentValue(rule, metrics),
      timestamp: new Date().toISOString(),
      metrics: metrics.slice(-10) // Last 10 metrics
    }

    const logMethod = rule.severity === 'critical' || rule.severity === 'error' ? 'error' : 'warn'
    logger[logMethod](`Performance Alert: ${rule.message}`, alertData, {
      tags: ['performance', 'alert', rule.severity],
      source: 'system'
    })

    // In a real system, you might want to send alerts to external monitoring systems
    this.sendAlertToExternalSystems(alertData)
  }

  /**
   * Calculate current value for alert rule
   */
  private calculateCurrentValue(rule: AlertRule, metrics: PerformanceMetrics[]): number {
    switch (rule.name) {
      case 'high-response-time':
        return metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
      case 'low-cache-hit-rate':
        return (metrics.filter(m => m.cacheHit).length / metrics.length) * 100
      case 'high-error-rate':
        return (metrics.filter(m => !m.success).length / metrics.length) * 100
      case 'cache-thrashing':
        return (metrics.filter(m => !m.cacheHit).length / metrics.length) * 100
      default:
        return 0
    }
  }

  /**
   * Send alert to external monitoring systems
   */
  private sendAlertToExternalSystems(alertData: any): void {
    // Placeholder for external monitoring integration
    // Examples: DataDog, New Relic, Prometheus, etc.
    logger.debug('Would send alert to external monitoring system', alertData)
  }

  /**
   * Generate performance report
   */
  generateReport(periodMinutes: number = 60): PerformanceReport {
    const now = Date.now()
    const periodStart = now - (periodMinutes * 60 * 1000)

    const periodMetrics = this.metrics.filter(m => m.timestamp >= periodStart)

    if (periodMetrics.length === 0) {
      throw new Error('No metrics available for the specified period')
    }

    // Calculate summary metrics
    const totalRequests = periodMetrics.length
    const averageResponseTime = periodMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests
    const cacheHits = periodMetrics.filter(m => m.cacheHit).length
    const cacheHitRate = (cacheHits / totalRequests) * 100
    const errors = periodMetrics.filter(m => !m.success).length
    const errorRate = (errors / totalRequests) * 100
    const throughput = totalRequests / periodMinutes

    // Group by source
    const bySource: Record<string, any> = {}
    const sourceMetrics = new Map<string, PerformanceMetrics[]>()

    for (const metric of periodMetrics) {
      if (!sourceMetrics.has(metric.source)) {
        sourceMetrics.set(metric.source, [])
      }
      sourceMetrics.get(metric.source)!.push(metric)
    }

    for (const [source, metrics] of sourceMetrics) {
      const sourceRequests = metrics.length
      const sourceAvgTime = metrics.reduce((sum, m) => sum + m.duration, 0) / sourceRequests
      const sourceCacheHits = metrics.filter(m => m.cacheHit).length
      const sourceCacheHitRate = (sourceCacheHits / sourceRequests) * 100
      const sourceErrors = metrics.filter(m => !m.success).length
      const sourceErrorRate = (sourceErrors / sourceRequests) * 100
      const sourceDataTransferred = metrics.reduce((sum, m) => sum + (m.dataSize || 0), 0)

      bySource[source] = {
        totalRequests: sourceRequests,
        averageResponseTime: sourceAvgTime,
        cacheHitRate: sourceCacheHitRate,
        errorRate: sourceErrorRate,
        dataTransferred: sourceDataTransferred,
        recommendations: this.generateSourceRecommendations(source, metrics)
      }
    }

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(periodMetrics)

    // Generate recommendations
    const recommendations = this.generateRecommendations(periodMetrics, bySource)

    return {
      period: {
        start: periodStart,
        end: now
      },
      summary: {
        totalRequests,
        averageResponseTime,
        cacheHitRate,
        errorRate,
        throughput
      },
      bySource,
      bottlenecks,
      recommendations
    }
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(metrics: PerformanceMetrics[]): Array<{
    source: string
    operation: string
    averageTime: number
    frequency: number
    impact: 'low' | 'medium' | 'high' | 'critical'
  }> {
    const bottlenecks: Array<{
      source: string
      operation: string
      averageTime: number
      frequency: number
      impact: 'low' | 'medium' | 'high' | 'critical'
    }> = []

    // Group by source and operation
    const operationMetrics = new Map<string, PerformanceMetrics[]>()

    for (const metric of metrics) {
      const key = `${metric.source}:${metric.operation}`
      if (!operationMetrics.has(key)) {
        operationMetrics.set(key, [])
      }
      operationMetrics.get(key)!.push(metric)
    }

    for (const [key, metrics] of operationMetrics) {
      const [source, operation] = key.split(':')
      const averageTime = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
      const frequency = metrics.length / (metrics.length > 0 ? (Date.now() - metrics[0].timestamp) / (1000 * 60) : 1)

      // Determine impact based on time and frequency
      let impact: 'low' | 'medium' | 'high' | 'critical' = 'low'
      if (averageTime > 10000 || frequency > 10) impact = 'critical'
      else if (averageTime > 5000 || frequency > 5) impact = 'high'
      else if (averageTime > 2000 || frequency > 2) impact = 'medium'

      if (impact !== 'low') {
        bottlenecks.push({
          source,
          operation,
          averageTime,
          frequency,
          impact
        })
      }
    }

    return bottlenecks.sort((a, b) => {
      const impactOrder = { low: 0, medium: 1, high: 2, critical: 3 }
      return impactOrder[b.impact] - impactOrder[a.impact]
    })
  }

  /**
   * Generate recommendations for a source
   */
  private generateSourceRecommendations(source: string, metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = []

    const cacheHitRate = (metrics.filter(m => m.cacheHit).length / metrics.length) * 100
    const errorRate = (metrics.filter(m => !m.success).length / metrics.length) * 100
    const averageTime = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length

    if (cacheHitRate < 50) {
      recommendations.push(`Consider increasing cache TTL for ${source} or implementing cache warming`)
    }

    if (errorRate > 10) {
      recommendations.push(`High error rate for ${source} - investigate API limits or network issues`)
    }

    if (averageTime > 3000) {
      recommendations.push(`Slow response times for ${source} - consider optimization or alternative data sources`)
    }

    return recommendations
  }

  /**
   * Generate overall recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics[], bySource: Record<string, any>): string[] {
    const recommendations: string[] = []

    const overallCacheHitRate = (metrics.filter(m => m.cacheHit).length / metrics.length) * 100
    const overallErrorRate = (metrics.filter(m => !m.success).length / metrics.length) * 100

    if (overallCacheHitRate < 60) {
      recommendations.push('Overall cache hit rate is low - consider implementing more aggressive caching strategies')
    }

    if (overallErrorRate > 5) {
      recommendations.push('Overall error rate is elevated - investigate external API reliability')
    }

    // Check for sources with poor performance
    for (const [source, data] of Object.entries(bySource)) {
      if (data.averageResponseTime > 5000) {
        recommendations.push(`${source} has slow response times - consider optimization or caching improvements`)
      }
    }

    return recommendations
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Generate performance reports every 5 minutes
    this.monitoringInterval = setInterval(() => {
      try {
        const report = this.generateReport(5)
        logger.info('Performance monitoring report generated', {
          period: report.period,
          summary: report.summary,
          bottleneckCount: report.bottlenecks.length
        })
      } catch (error) {
        logger.warn('Failed to generate performance report:', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }, 300000) // 5 minutes
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(minutes: number = 60): PerformanceMetrics[] {
    const cutoff = Date.now() - (minutes * 60 * 1000)
    return this.metrics.filter(m => m.timestamp >= cutoff)
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = []
    this.lastAlerts.clear()
    logger.info('Performance metrics cleared')
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    this.clearMetrics()
    logger.info('Performance monitor destroyed')
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()
export default performanceMonitor