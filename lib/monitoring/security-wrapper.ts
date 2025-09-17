import { logger } from '@/lib/logger'
import { performanceMonitor } from './performance-monitor'
import { systemMetricsCollector } from './system-metrics-collector'
import { databaseOptimizer } from './database-optimizer'
import { cdnService } from './cdn-service'
import { loadBalancer } from './load-balancer'
import { benchmarkingTools } from './benchmarking-tools'
import { resourceMonitor } from './resource-monitor'

export interface SecurityConfig {
  enableEncryption: boolean
  enableAccessControl: boolean
  enableAuditLogging: boolean
  allowedIPs: string[]
  rateLimitRequests: number
  rateLimitWindow: number // seconds
  encryptionKey?: string
}

export interface MonitoringRequest {
  userId?: string
  ipAddress: string
  userAgent: string
  timestamp: string
  action: string
  resource: string
  metadata?: Record<string, any>
}

export class MonitoringSecurityWrapper {
  private static instance: MonitoringSecurityWrapper
  private config: SecurityConfig
  private rateLimitCache: Map<string, { count: number; resetTime: number }> = new Map()

  static getInstance(): MonitoringSecurityWrapper {
    if (!MonitoringSecurityWrapper.instance) {
      MonitoringSecurityWrapper.instance = new MonitoringSecurityWrapper()
    }
    return MonitoringSecurityWrapper.instance
  }

  constructor() {
    this.config = {
      enableEncryption: true,
      enableAccessControl: true,
      enableAuditLogging: true,
      allowedIPs: [],
      rateLimitRequests: 100,
      rateLimitWindow: 60
    }
  }

  /**
   * Configure security settings
   */
  configureSecurity(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('Monitoring security configuration updated', {
      encryption: this.config.enableEncryption,
      accessControl: this.config.enableAccessControl,
      auditLogging: this.config.enableAuditLogging
    })
  }

  /**
   * Secure wrapper for performance monitoring
   */
  async securePerformanceMonitoring(
    action: string,
    request: MonitoringRequest,
    operation: () => Promise<any>
  ): Promise<any> {
    try {
      // Check access control
      if (this.config.enableAccessControl) {
        this.checkAccessControl(request)
      }

      // Check rate limiting
      this.checkRateLimit(request.ipAddress)

      // Log audit trail
      if (this.config.enableAuditLogging) {
        await this.logAuditTrail(request)
      }

      // Execute operation
      const result = await operation()

      // Record successful access
      await this.recordSuccessfulAccess(request)

      return result

    } catch (error) {
      // Record failed access
      await this.recordFailedAccess(request, error)

      throw error
    }
  }

  /**
   * Get secure metrics with access control
   */
  async getSecureMetrics(
    request: MonitoringRequest,
    metricType?: string,
    timeRange?: string
  ): Promise<any> {
    return this.securePerformanceMonitoring(
      'get_metrics',
      request,
      async () => {
        const metrics = await performanceMonitor.getMetrics(
          metricType as any,
          timeRange ? new Date(Date.now() - this.parseTimeRange(timeRange)).toISOString() : undefined,
          undefined,
          undefined,
          100
        )

        return this.config.enableEncryption ? this.encryptData(metrics) : metrics
      }
    )
  }

  /**
   * Get secure system health
   */
  async getSecureSystemHealth(request: MonitoringRequest): Promise<any> {
    return this.securePerformanceMonitoring(
      'get_system_health',
      request,
      async () => {
        const health = await systemMetricsCollector.getSystemHealth()
        return this.config.enableEncryption ? this.encryptData(health) : health
      }
    )
  }

  /**
   * Execute secure database query
   */
  async executeSecureDatabaseQuery(
    request: MonitoringRequest,
    query: string,
    params?: any[]
  ): Promise<any> {
    return this.securePerformanceMonitoring(
      'database_query',
      request,
      async () => {
        const result = await databaseOptimizer.executeQuery(query, params)
        return this.config.enableEncryption ? this.encryptData(result) : result
      }
    )
  }

  /**
   * Get secure CDN analytics
   */
  async getSecureCDNAnalytics(request: MonitoringRequest, timeRange: string): Promise<any> {
    return this.securePerformanceMonitoring(
      'cdn_analytics',
      request,
      async () => {
        const analytics = await cdnService.getAnalytics(timeRange as any)
        return this.config.enableEncryption ? this.encryptData(analytics) : analytics
      }
    )
  }

  /**
   * Get secure load balancer stats
   */
  async getSecureLoadBalancerStats(request: MonitoringRequest): Promise<any> {
    return this.securePerformanceMonitoring(
      'load_balancer_stats',
      request,
      async () => {
        const stats = loadBalancer.getStatistics()
        return this.config.enableEncryption ? this.encryptData(stats) : stats
      }
    )
  }

  /**
   * Get secure resource usage
   */
  async getSecureResourceUsage(request: MonitoringRequest): Promise<any> {
    return this.securePerformanceMonitoring(
      'resource_usage',
      request,
      async () => {
        const usage = await resourceMonitor.getCurrentUsage()
        return this.config.enableEncryption ? this.encryptData(usage) : usage
      }
    )
  }

  /**
   * Run secure benchmark
   */
  async runSecureBenchmark(
    request: MonitoringRequest,
    config: any
  ): Promise<any> {
    return this.securePerformanceMonitoring(
      'run_benchmark',
      request,
      async () => {
        const result = await benchmarkingTools.runBenchmark(config)
        return this.config.enableEncryption ? this.encryptData(result) : result
      }
    )
  }

  // Private security methods

  private checkAccessControl(request: MonitoringRequest): void {
    // Check IP whitelist
    if (this.config.allowedIPs.length > 0 && !this.config.allowedIPs.includes(request.ipAddress)) {
      throw new Error('IP address not allowed')
    }

    // Additional access control checks can be added here
    // e.g., user role validation, API key validation, etc.
  }

  private checkRateLimit(ipAddress: string): void {
    const now = Date.now()
    const windowMs = this.config.rateLimitWindow * 1000
    const key = ipAddress

    const current = this.rateLimitCache.get(key)

    if (!current || now > current.resetTime) {
      // Reset or initialize rate limit
      this.rateLimitCache.set(key, {
        count: 1,
        resetTime: now + windowMs
      })
    } else {
      // Check if limit exceeded
      if (current.count >= this.config.rateLimitRequests) {
        throw new Error('Rate limit exceeded')
      }

      // Increment counter
      current.count++
      this.rateLimitCache.set(key, current)
    }
  }

  private async logAuditTrail(request: MonitoringRequest): Promise<void> {
    await logger.info('Monitoring access audit', {
      userId: request.userId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      action: request.action,
      resource: request.resource,
      timestamp: request.timestamp,
      metadata: request.metadata
    })
  }

  private async recordSuccessfulAccess(request: MonitoringRequest): Promise<void> {
    await performanceMonitor.recordAPIMetric({
      endpoint: `/monitoring/${request.resource}`,
      method: 'GET',
      response_time_ms: 0, // Would be measured in actual implementation
      status_code: 200,
      user_agent: request.userAgent,
      ip_address: request.ipAddress,
      timestamp: request.timestamp
    })
  }

  private async recordFailedAccess(request: MonitoringRequest, error: any): Promise<void> {
    await performanceMonitor.recordAPIMetric({
      endpoint: `/monitoring/${request.resource}`,
      method: 'GET',
      response_time_ms: 0,
      status_code: 403, // Forbidden or appropriate error code
      user_agent: request.userAgent,
      ip_address: request.ipAddress,
      timestamp: request.timestamp
    })

    await logger.warn('Monitoring access denied', {
      error: error.message,
      userId: request.userId,
      ipAddress: request.ipAddress,
      action: request.action,
      resource: request.resource
    })
  }

  private encryptData(data: any): any {
    if (!this.config.enableEncryption || !this.config.encryptionKey) {
      return data
    }

    // Simple encryption placeholder
    // In production, use proper encryption libraries
    const jsonString = JSON.stringify(data)
    const encrypted = Buffer.from(jsonString).toString('base64')

    return {
      encrypted: true,
      data: encrypted,
      timestamp: new Date().toISOString()
    }
  }

  private parseTimeRange(timeRange: string): number {
    const unit = timeRange.slice(-1)
    const value = parseInt(timeRange.slice(0, -1))

    switch (unit) {
      case 'm': return value * 60 * 1000 // minutes
      case 'h': return value * 60 * 60 * 1000 // hours
      case 'd': return value * 24 * 60 * 60 * 1000 // days
      default: return 60 * 60 * 1000 // default 1 hour
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimits(): void {
    const now = Date.now()

    for (const [key, value] of this.rateLimitCache.entries()) {
      if (now > value.resetTime) {
        this.rateLimitCache.delete(key)
      }
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    activeRateLimits: number
    totalRequests: number
    blockedRequests: number
  } {
    let totalRequests = 0
    let blockedRequests = 0

    for (const value of this.rateLimitCache.values()) {
      totalRequests += value.count
      if (value.count >= this.config.rateLimitRequests) {
        blockedRequests++
      }
    }

    return {
      activeRateLimits: this.rateLimitCache.size,
      totalRequests,
      blockedRequests
    }
  }
}

// Export singleton instance
export const monitoringSecurity = MonitoringSecurityWrapper.getInstance()

// Backward compatibility exports
export { performanceMonitor }
export { systemMetricsCollector }
export { databaseOptimizer }
export { cdnService }
export { loadBalancer }
export { benchmarkingTools }
export { resourceMonitor }