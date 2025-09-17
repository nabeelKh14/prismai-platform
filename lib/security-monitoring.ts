import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { AuthMonitor } from '@/lib/monitoring/auth-monitor'
import { LogAggregator } from '@/lib/monitoring/log-aggregator'

export interface SecurityEvent {
  id: string
  type: SecurityEventType
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  userId?: string
  sessionId?: string
  ipAddress: string
  userAgent: string
  requestPath?: string
  requestMethod?: string
  metadata: Record<string, any>
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
  alertTriggered: boolean
}

export type SecurityEventType =
  | 'authentication_failure'
  | 'authorization_failure'
  | 'suspicious_activity'
  | 'brute_force_attempt'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'csrf_attempt'
  | 'file_upload_malware'
  | 'data_breach_attempt'
  | 'unusual_login_location'
  | 'multiple_failed_logins'
  | 'session_anomaly'
  | 'api_rate_limit_exceeded'
  | 'encryption_key_compromised'
  | 'configuration_change'
  | 'admin_privilege_escalation'

export interface SecurityAlert {
  id: string
  eventId: string
  alertType: 'email' | 'sms' | 'webhook' | 'dashboard'
  recipient: string
  message: string
  sent: boolean
  sentAt?: Date
  acknowledged: boolean
  acknowledgedAt?: Date
  acknowledgedBy?: string
}

export interface SecurityMetrics {
  totalEvents: number
  eventsBySeverity: Record<string, number>
  eventsByType: Record<string, number>
  activeAlerts: number
  resolvedEvents: number
  averageResponseTime: number
  topThreatSources: Array<{ ip: string; count: number }>
  recentEvents: SecurityEvent[]
}

export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService
  private eventBuffer: SecurityEvent[] = []
  private readonly bufferSize = 50
  private flushInterval: NodeJS.Timeout | null = null

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService()
    }
    return SecurityMonitoringService.instance
  }

  constructor() {
    this.startPeriodicFlush()
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    type: SecurityEventType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    description: string,
    request?: NextRequest,
    userId?: string,
    sessionId?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const event: Omit<SecurityEvent, 'id'> = {
        type,
        severity,
        title,
        description,
        userId,
        sessionId,
        ipAddress: request?.headers.get('x-forwarded-for') ||
                  request?.headers.get('x-real-ip') ||
                  'unknown',
        userAgent: request?.headers.get('user-agent') || 'unknown',
        requestPath: request?.nextUrl.pathname,
        requestMethod: request?.method,
        metadata,
        timestamp: new Date(),
        resolved: false,
        alertTriggered: false,
      }

      // Add to buffer for batch processing
      this.eventBuffer.push({ ...event, id: this.generateEventId() })

      // Flush if buffer is full
      if (this.eventBuffer.length >= this.bufferSize) {
        await this.flushEvents()
      }

      // Trigger alerts for high-severity events
      if (severity === 'high' || severity === 'critical') {
        await this.triggerSecurityAlert(event)
      }

      // Log to application logger with appropriate level
      const logData = {
        type,
        severity,
        title,
        userId,
        ipAddress: event.ipAddress,
        metadata,
      }

      switch (severity) {
        case 'critical':
          logger.error(`SECURITY EVENT: ${title}`, logData)
          break
        case 'high':
          logger.error(`Security Event: ${title}`, logData)
          break
        case 'medium':
          logger.warn(`Security Event: ${title}`, logData)
          break
        case 'low':
          logger.info(`Security Event: ${title}`, logData)
          break
      }

    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  /**
   * Trigger security alert
   */
  private async triggerSecurityAlert(event: Omit<SecurityEvent, 'id'>): Promise<void> {
    try {
      const supabase = await createClient()

      // Create alert record
      const alert: Omit<SecurityAlert, 'id'> = {
        eventId: '', // Will be set after event is saved
        alertType: 'dashboard', // Default to dashboard alerts
        recipient: 'security_team',
        message: `Security Alert: ${event.title} - ${event.description}`,
        sent: false,
        acknowledged: false,
      }

      // In a real implementation, you would:
      // 1. Send email/SMS notifications
      // 2. Trigger webhooks
      // 3. Create dashboard notifications
      // 4. Integrate with SIEM systems

      logger.warn('Security alert triggered', {
        type: event.type,
        severity: event.severity,
        title: event.title,
        ipAddress: event.ipAddress,
      })

    } catch (error) {
      logger.error('Failed to trigger security alert', error as Error)
    }
  }

  /**
   * Get security events with filtering
   */
  async getSecurityEvents(
    limit: number = 50,
    offset: number = 0,
    severity?: SecurityEvent['severity'],
    type?: SecurityEventType,
    resolved?: boolean,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    events: SecurityEvent[]
    total: number
    hasMore: boolean
  }> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('security_events')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })

      if (severity) {
        query = query.eq('severity', severity)
      }

      if (type) {
        query = query.eq('type', type)
      }

      if (resolved !== undefined) {
        query = query.eq('resolved', resolved)
      }

      if (startDate) {
        query = query.gte('timestamp', startDate.toISOString())
      }

      if (endDate) {
        query = query.lte('timestamp', endDate.toISOString())
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1)

      if (error) throw error

      const events: SecurityEvent[] = (data || []).map(event => ({
        id: event.id,
        type: event.type,
        severity: event.severity,
        title: event.title,
        description: event.description,
        userId: event.user_id,
        sessionId: event.session_id,
        ipAddress: event.ip_address,
        userAgent: event.user_agent,
        requestPath: event.request_path,
        requestMethod: event.request_method,
        metadata: event.metadata || {},
        timestamp: new Date(event.timestamp),
        resolved: event.resolved,
        resolvedAt: event.resolved_at ? new Date(event.resolved_at) : undefined,
        resolvedBy: event.resolved_by,
        alertTriggered: event.alert_triggered,
      }))

      return {
        events,
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      }

    } catch (error) {
      logger.error('Failed to get security events', error as Error)
      return { events: [], total: 0, hasMore: false }
    }
  }

  /**
   * Resolve security event
   */
  async resolveSecurityEvent(
    eventId: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('security_events')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          metadata: resolutionNotes ? { resolution_notes: resolutionNotes } : undefined,
        })
        .eq('id', eventId)

      if (error) throw error

      logger.info('Security event resolved', { eventId, resolvedBy })

      return true

    } catch (error) {
      logger.error('Failed to resolve security event', error as Error, { eventId })
      return false
    }
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(
    timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<SecurityMetrics> {
    try {
      const supabase = await createClient()

      // Calculate time range
      const now = new Date()
      const startTime = new Date()

      switch (timeRange) {
        case 'hour':
          startTime.setHours(now.getHours() - 1)
          break
        case 'day':
          startTime.setDate(now.getDate() - 1)
          break
        case 'week':
          startTime.setDate(now.getDate() - 7)
          break
        case 'month':
          startTime.setMonth(now.getMonth() - 1)
          break
      }

      const startTimeStr = startTime.toISOString()

      // Get total events
      const { count: totalEvents } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startTimeStr)

      // Get events by severity
      const severityPromises = (['low', 'medium', 'high', 'critical'] as const).map(async (severity) => {
        const { count } = await supabase
          .from('security_events')
          .select('*', { count: 'exact', head: true })
          .eq('severity', severity)
          .gte('timestamp', startTimeStr)
        return { severity, count: count || 0 }
      })

      const severityResults = await Promise.all(severityPromises)
      const eventsBySeverity = severityResults.reduce((acc, { severity, count }) => {
        acc[severity] = count
        return acc
      }, {} as Record<string, number>)

      // Get events by type
      const { data: typeData } = await supabase
        .from('security_events')
        .select('type')
        .gte('timestamp', startTimeStr)

      const eventsByType: Record<string, number> = {}
      for (const event of typeData || []) {
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1
      }

      // Get active alerts
      const { count: activeAlerts } = await supabase
        .from('security_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('acknowledged', false)

      // Get resolved events
      const { count: resolvedEvents } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', true)
        .gte('timestamp', startTimeStr)

      // Get top threat sources
      const { data: threatData } = await supabase
        .from('security_events')
        .select('ip_address')
        .gte('timestamp', startTimeStr)
        .neq('ip_address', 'unknown')

      const ipCounts: Record<string, number> = {}
      for (const event of threatData || []) {
        ipCounts[event.ip_address] = (ipCounts[event.ip_address] || 0) + 1
      }

      const topThreatSources = Object.entries(ipCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }))

      // Get recent events
      const { events: recentEvents } = await this.getSecurityEvents(10, 0, undefined, undefined, undefined, startTime)

      // Calculate average response time (simplified)
      const avgResponseTime = (resolvedEvents || 0) > 0 ? 3600000 : 0 // 1 hour placeholder

      return {
        totalEvents: totalEvents || 0,
        eventsBySeverity,
        eventsByType,
        activeAlerts: activeAlerts || 0,
        resolvedEvents: resolvedEvents || 0,
        averageResponseTime: avgResponseTime,
        topThreatSources,
        recentEvents,
      }

    } catch (error) {
      logger.error('Failed to get security metrics', error as Error)
      return {
        totalEvents: 0,
        eventsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
        eventsByType: {},
        activeAlerts: 0,
        resolvedEvents: 0,
        averageResponseTime: 0,
        topThreatSources: [],
        recentEvents: [],
      }
    }
  }

  /**
   * Detect brute force attacks
   */
  async detectBruteForce(ipAddress: string, maxAttempts = 5, windowMs = 900000): Promise<boolean> {
    try {
      const supabase = await createClient()

      const windowStart = new Date(Date.now() - windowMs).toISOString()

      const { count } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'authentication_failure')
        .eq('ip_address', ipAddress)
        .gte('timestamp', windowStart)

      if ((count || 0) >= maxAttempts) {
        await this.logSecurityEvent(
          'brute_force_attempt',
          'high',
          'Brute Force Attack Detected',
          `Multiple failed authentication attempts from ${ipAddress}`,
          undefined,
          undefined,
          undefined,
          { attemptCount: count, ipAddress }
        )
        return true
      }

      return false

    } catch (error) {
      logger.error('Failed to detect brute force', error as Error, { ipAddress })
      return false
    }
  }

  /**
   * Detect unusual login locations
   */
  async detectUnusualLogin(
    userId: string,
    currentIp: string,
    currentUserAgent: string
  ): Promise<boolean> {
    try {
      const supabase = await createClient()

      // Get recent login history
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: recentLogins } = await supabase
        .from('security_events')
        .select('ip_address, user_agent, metadata')
        .eq('user_id', userId)
        .eq('type', 'authentication_success')
        .gte('timestamp', sevenDaysAgo)
        .order('timestamp', { ascending: false })
        .limit(10)

      if (!recentLogins || recentLogins.length === 0) {
        return false // First login, not unusual
      }

      // Check if current IP is in recent login history
      const knownIPs = new Set(recentLogins.map(login => login.ip_address))
      const isKnownIP = knownIPs.has(currentIp)

      if (!isKnownIP) {
        await this.logSecurityEvent(
          'unusual_login_location',
          'medium',
          'Unusual Login Location',
          `Login from unrecognized IP address: ${currentIp}`,
          undefined,
          userId,
          undefined,
          { currentIp, knownIPs: Array.from(knownIPs) }
        )
        return true
      }

      return false

    } catch (error) {
      logger.error('Failed to detect unusual login', error as Error, { userId, currentIp })
      return false
    }
  }

  /**
   * Flush buffered events to database
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return

    try {
      const supabase = await createClient()

      const eventsToInsert = this.eventBuffer.map(event => ({
        type: event.type,
        severity: event.severity,
        title: event.title,
        description: event.description,
        user_id: event.userId,
        session_id: event.sessionId,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        request_path: event.requestPath,
        request_method: event.requestMethod,
        metadata: event.metadata,
        timestamp: event.timestamp.toISOString(),
        resolved: event.resolved,
        alert_triggered: event.alertTriggered,
      }))

      const { error } = await supabase
        .from('security_events')
        .insert(eventsToInsert)

      if (error) throw error

      this.eventBuffer = []

    } catch (error) {
      logger.error('Failed to flush security events', error as Error)
    }
  }

  /**
   * Start periodic flush
   */
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushEvents()
    }, 30000) // Flush every 30 seconds
  }

  /**
   * Stop periodic flush
   */
  stopPeriodicFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const securityMonitoring = SecurityMonitoringService.getInstance()

// Export convenience functions
export async function logSecurityEvent(
  type: SecurityEventType,
  severity: 'low' | 'medium' | 'high' | 'critical',
  title: string,
  description: string,
  request?: NextRequest,
  userId?: string,
  sessionId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  return securityMonitoring.logSecurityEvent(type, severity, title, description, request, userId, sessionId, metadata)
}

export async function getSecurityEvents(
  limit?: number,
  offset?: number,
  severity?: SecurityEvent['severity'],
  type?: SecurityEventType,
  resolved?: boolean,
  startDate?: Date,
  endDate?: Date
) {
  return securityMonitoring.getSecurityEvents(limit, offset, severity, type, resolved, startDate, endDate)
}

export async function getSecurityMetrics(timeRange?: 'hour' | 'day' | 'week' | 'month') {
  return securityMonitoring.getSecurityMetrics(timeRange)
}