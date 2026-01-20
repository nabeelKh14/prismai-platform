import { logger } from '@/lib/logger'
import { performanceMonitor } from './performance-monitor'
import { databaseOptimizer } from './database-optimizer'
import { cdnService } from './cdn-service'
import { loadBalancer } from './load-balancer'
import { benchmarkingTools } from './benchmarking-tools'
import { resourceMonitor } from './resource-monitor'
import { breachDetectionEngine, SecurityEvent, DetectedBreach } from '@/lib/compliance/breach-detection'

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
  private breachDetectionEnabled: boolean = true
  private securityEventBuffer: SecurityEvent[] = []
  private readonly SECURITY_EVENT_BUFFER_SIZE = 1000

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
      auditLogging: this.config.enableAuditLogging,
      breachDetection: this.breachDetectionEnabled
    })
  }

  /**
   * Configure breach detection settings
   */
  configureBreachDetection(enabled: boolean): void {
    this.breachDetectionEnabled = enabled
    logger.info('Breach detection configuration updated', {
      enabled: this.breachDetectionEnabled
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

      // Process security event for breach detection
      if (this.breachDetectionEnabled) {
        await this.processSecurityEvent(request)
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

  // Breach Detection Methods

  /**
   * Process security event for breach detection
   */
  private async processSecurityEvent(request: MonitoringRequest): Promise<void> {
    try {
      // Convert monitoring request to security event
      const securityEvent: SecurityEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date(request.timestamp),
        source: request.resource,
        event_type: this.mapToSecurityEventType(request.action),
        severity: this.determineEventSeverity(request),
        description: `${request.action} on ${request.resource}`,
        metadata: {
          userId: request.userId,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          ...request.metadata
        }
      }

      // Add to buffer for analysis
      this.securityEventBuffer.push(securityEvent)

      // Maintain buffer size
      if (this.securityEventBuffer.length > this.SECURITY_EVENT_BUFFER_SIZE) {
        this.securityEventBuffer = this.securityEventBuffer.slice(-this.SECURITY_EVENT_BUFFER_SIZE)
      }

      // Process through breach detection engine
      const detectedBreach = await breachDetectionEngine.processSecurityEvent(securityEvent)

      if (detectedBreach) {
        logger.warn('Breach detected', {
          incident_id: detectedBreach.incident_id,
          severity: detectedBreach.severity_score,
          type: detectedBreach.incident_type,
          description: detectedBreach.description
        })

        // Trigger immediate notification for high-severity breaches
        if (detectedBreach.severity_score >= 4) {
          await this.handleHighSeverityBreach(detectedBreach)
        }
      }
    } catch (error) {
      logger.error('Error processing security event for breach detection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request: request
      })
    }
  }

  /**
   * Handle high-severity breach detection
   */
  private async handleHighSeverityBreach(breach: DetectedBreach): Promise<void> {
    try {
      // Log critical breach
      await logger.error('High-severity breach detected', {
        incident_id: breach.incident_id,
        severity: breach.severity_score,
        type: breach.incident_type,
        description: breach.description,
        affected_systems: breach.affected_systems,
        affected_data_types: breach.affected_data_types
      })

      // Could trigger immediate notifications, alerts, or automated responses
      // For now, just log the detection
    } catch (error) {
      logger.error('Error handling high-severity breach', {
        error: error instanceof Error ? error.message : 'Unknown error',
        breach_id: breach.incident_id
      })
    }
  }

  /**
   * Map monitoring action to security event type
   */
  private mapToSecurityEventType(action: string): string {
    const mapping: Record<string, string> = {
      'get_metrics': 'monitoring_access',
      'get_system_health': 'system_query',
      'database_query': 'database_access',
      'cdn_analytics': 'cdn_access',
      'load_balancer_stats': 'infrastructure_access',
      'resource_usage': 'resource_monitoring',
      'run_benchmark': 'performance_test',
      'unauthorized_access': 'unauthorized_access',
      'suspicious_activity': 'suspicious_activity',
      'data_exfiltration': 'data_exfiltration',
      'malware_detected': 'malware',
      'failed_login': 'authentication_failure'
    }

    return mapping[action] || 'security_event'
  }

  /**
   * Determine severity of security event
   */
  private determineEventSeverity(request: MonitoringRequest): 'low' | 'medium' | 'high' | 'critical' {
    // Check for suspicious patterns
    if (request.ipAddress && this.isSuspiciousIP(request.ipAddress)) {
      return 'high'
    }

    if (request.action.includes('unauthorized') || request.action.includes('failed')) {
      return 'medium'
    }

    if (request.metadata?.suspicious === true) {
      return 'high'
    }

    return 'low'
  }

  /**
   * Check if IP address is suspicious
   */
  private isSuspiciousIP(ipAddress: string): boolean {
    // Simple check for obviously suspicious IPs
    const suspiciousPatterns = [
      /^192\.168\./, // Internal IP accessing external resources suspiciously
      /^10\./,       // Internal IP
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Internal IP
      /^127\./       // Localhost
    ]

    return suspiciousPatterns.some(pattern => pattern.test(ipAddress))
  }

  /**
   * Get security events from buffer
   */
  getSecurityEvents(limit: number = 100): SecurityEvent[] {
    return this.securityEventBuffer.slice(-limit)
  }

  /**
   * Clear security event buffer
   */
  clearSecurityEventBuffer(): void {
    this.securityEventBuffer = []
  }

  /**
   * Get breach detection statistics
   */
  getBreachDetectionStats(): {
    events_processed: number
    breaches_detected: number
    high_severity_events: number
    buffer_size: number
  } {
    const highSeverityEvents = this.securityEventBuffer.filter(
      event => event.severity === 'high' || event.severity === 'critical'
    ).length

    return {
      events_processed: this.securityEventBuffer.length,
      breaches_detected: 0, // Would be tracked in actual implementation
      high_severity_events: highSeverityEvents,
      buffer_size: this.securityEventBuffer.length
    }
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
export { databaseOptimizer }
export { cdnService }
export { loadBalancer }
export { benchmarkingTools }
export { resourceMonitor }