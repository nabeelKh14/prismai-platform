import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface AuthMetrics {
  totalUsers: number
  activeUsers: number
  mfaEnabledUsers: number
  socialLoginUsers: number
  failedLoginAttempts: number
  successfulLogins: number
  mfaVerifications: number
  sessionCreated: number
  sessionRevoked: number
  passwordChanges: number
  profileUpdates: number
}

export interface SecurityEvent {
  id: string
  type: 'suspicious_login' | 'mfa_failure' | 'password_brute_force' | 'session_anomaly' | 'permission_denied'
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  ipAddress: string
  userAgent: string
  details: Record<string, any>
  timestamp: Date
  resolved: boolean
}

export class AuthMonitor {
  /**
   * Get authentication metrics
   */
  static async getAuthMetrics(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<AuthMetrics> {
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

      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // Get active users (logged in within time range)
      const { count: activeUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('last_login_at', startTimeStr)

      // Get MFA enabled users
      const { count: mfaEnabledUsers } = await supabase
        .from('user_mfa')
        .select('*', { count: 'exact', head: true })
        .or('mfa_enabled.eq.true,sms_enabled.eq.true')

      // Get social login users (users with identities from OAuth providers)
      const { count: socialLoginUsers } = await supabase
        .from('auth.identities')
        .select('*', { count: 'exact', head: true })
        .neq('provider', 'email')

      // Get failed login attempts
      const { count: failedLoginAttempts } = await supabase
        .from('auth_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'login_failed')
        .gte('created_at', startTimeStr)

      // Get successful logins
      const { count: successfulLogins } = await supabase
        .from('auth_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'login_success')
        .gte('created_at', startTimeStr)

      // Get MFA verifications
      const { count: mfaVerifications } = await supabase
        .from('mfa_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('success', true)
        .gte('attempted_at', startTimeStr)

      // Get session metrics
      const { count: sessionCreated } = await supabase
        .from('user_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startTimeStr)

      const { count: sessionRevoked } = await supabase
        .from('user_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('revoked', true)
        .gte('revoked_at', startTimeStr)

      // Get password changes
      const { count: passwordChanges } = await supabase
        .from('auth_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'password_changed')
        .gte('created_at', startTimeStr)

      // Get profile updates
      const { count: profileUpdates } = await supabase
        .from('auth_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'profile_updated')
        .gte('created_at', startTimeStr)

      return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        mfaEnabledUsers: mfaEnabledUsers || 0,
        socialLoginUsers: socialLoginUsers || 0,
        failedLoginAttempts: failedLoginAttempts || 0,
        successfulLogins: successfulLogins || 0,
        mfaVerifications: mfaVerifications || 0,
        sessionCreated: sessionCreated || 0,
        sessionRevoked: sessionRevoked || 0,
        passwordChanges: passwordChanges || 0,
        profileUpdates: profileUpdates || 0
      }

    } catch (error) {
      logger.error('Failed to get auth metrics', { error })
      return {
        totalUsers: 0,
        activeUsers: 0,
        mfaEnabledUsers: 0,
        socialLoginUsers: 0,
        failedLoginAttempts: 0,
        successfulLogins: 0,
        mfaVerifications: 0,
        sessionCreated: 0,
        sessionRevoked: 0,
        passwordChanges: 0,
        profileUpdates: 0
      }
    }
  }

  /**
   * Log security event
   */
  static async logSecurityEvent(
    type: SecurityEvent['type'],
    severity: SecurityEvent['severity'],
    userId: string | undefined,
    ipAddress: string,
    userAgent: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const supabase = await createClient()

      const event: Omit<SecurityEvent, 'id'> = {
        type,
        severity,
        userId,
        ipAddress,
        userAgent,
        details,
        timestamp: new Date(),
        resolved: false
      }

      await supabase
        .from('security_events')
        .insert({
          type: event.type,
          severity: event.severity,
          user_id: event.userId,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          details: event.details,
          timestamp: event.timestamp.toISOString(),
          resolved: event.resolved
        })

      // Log to application logger with appropriate level
      const logData = {
        type,
        severity,
        userId,
        ipAddress,
        details
      }

      switch (severity) {
        case 'critical':
          logger.error('Critical security event', logData)
          break
        case 'high':
          logger.error('High severity security event', logData)
          break
        case 'medium':
          logger.warn('Medium severity security event', logData)
          break
        case 'low':
          logger.info('Low severity security event', logData)
          break
      }

    } catch (error) {
      logger.error('Failed to log security event', { error, type, severity, userId })
    }
  }

  /**
   * Get security events
   */
  static async getSecurityEvents(
    limit: number = 50,
    offset: number = 0,
    severity?: SecurityEvent['severity'],
    resolved?: boolean
  ): Promise<SecurityEvent[]> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('security_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1)

      if (severity) {
        query = query.eq('severity', severity)
      }

      if (resolved !== undefined) {
        query = query.eq('resolved', resolved)
      }

      const { data, error } = await query

      if (error) {
        logger.error('Failed to get security events', { error })
        return []
      }

      return (data || []).map(event => ({
        id: event.id,
        type: event.type,
        severity: event.severity,
        userId: event.user_id,
        ipAddress: event.ip_address,
        userAgent: event.user_agent,
        details: event.details,
        timestamp: new Date(event.timestamp),
        resolved: event.resolved
      }))

    } catch (error) {
      logger.error('Failed to get security events', { error })
      return []
    }
  }

  /**
   * Mark security event as resolved
   */
  static async resolveSecurityEvent(eventId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('security_events')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq('id', eventId)

      if (error) {
        logger.error('Failed to resolve security event', { error, eventId })
        return false
      }

      logger.info('Security event resolved', { eventId })
      return true

    } catch (error) {
      logger.error('Failed to resolve security event', { error, eventId })
      return false
    }
  }

  /**
   * Get authentication trends
   */
  static async getAuthTrends(days: number = 7): Promise<{
    date: string
    logins: number
    failedLogins: number
    mfaVerifications: number
    newUsers: number
  }[]> {
    try {
      const supabase = await createClient()

      const trends = []
      const now = new Date()

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const nextDate = new Date(date)
        nextDate.setDate(nextDate.getDate() + 1)
        const nextDateStr = nextDate.toISOString()

        // Get metrics for this date
        const [loginsResult, failedLoginsResult, mfaResult, newUsersResult] = await Promise.all([
          supabase
            .from('auth_audit_log')
            .select('*', { count: 'exact', head: true })
            .eq('action', 'login_success')
            .gte('created_at', dateStr)
            .lt('created_at', nextDateStr),

          supabase
            .from('auth_audit_log')
            .select('*', { count: 'exact', head: true })
            .eq('action', 'login_failed')
            .gte('created_at', dateStr)
            .lt('created_at', nextDateStr),

          supabase
            .from('mfa_attempts')
            .select('*', { count: 'exact', head: true })
            .eq('success', true)
            .gte('attempted_at', dateStr)
            .lt('attempted_at', nextDateStr),

          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', dateStr)
            .lt('created_at', nextDateStr)
        ])

        trends.push({
          date: dateStr,
          logins: loginsResult.count || 0,
          failedLogins: failedLoginsResult.count || 0,
          mfaVerifications: mfaResult.count || 0,
          newUsers: newUsersResult.count || 0
        })
      }

      return trends

    } catch (error) {
      logger.error('Failed to get auth trends', { error })
      return []
    }
  }

  /**
   * Get system health metrics
   */
  static async getSystemHealth(): Promise<{
    database: 'healthy' | 'degraded' | 'unhealthy'
    authentication: 'healthy' | 'degraded' | 'unhealthy'
    mfa: 'healthy' | 'degraded' | 'unhealthy'
    sessions: 'healthy' | 'degraded' | 'unhealthy'
    lastChecked: Date
  }> {
    try {
      const supabase = await createClient()
      const now = new Date()

      // Check database health
      const { error: dbError } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true })
        .limit(1)

      const database = dbError ? 'unhealthy' : 'healthy'

      // Check authentication health (recent successful logins)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
      const { count: recentLogins } = await supabase
        .from('auth_audit_log')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'login_success')
        .gte('created_at', oneHourAgo)

      const authentication = recentLogins && recentLogins > 0 ? 'healthy' : 'degraded'

      // Check MFA health
      const { count: recentMFA } = await supabase
        .from('mfa_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('success', true)
        .gte('attempted_at', oneHourAgo)

      const mfa = recentMFA !== null ? 'healthy' : 'degraded'

      // Check session health
      const { count: activeSessions } = await supabase
        .from('user_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('revoked', false)
        .gt('expires_at', now.toISOString())

      const sessions = activeSessions !== null ? 'healthy' : 'degraded'

      return {
        database,
        authentication,
        mfa,
        sessions,
        lastChecked: now
      }

    } catch (error) {
      logger.error('Failed to get system health', { error })
      return {
        database: 'unhealthy',
        authentication: 'unhealthy',
        mfa: 'unhealthy',
        sessions: 'unhealthy',
        lastChecked: new Date()
      }
    }
  }
}