import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { createHash, randomBytes } from 'crypto'

export interface SessionData {
  id: string
  userId: string
  sessionToken: string
  refreshToken: string
  deviceInfo?: any
  ipAddress?: string
  userAgent?: string
  expiresAt: Date
  refreshExpiresAt: Date
  createdAt: Date
  lastActivity: Date
  revoked: boolean
}

export class SessionService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret'
  private static readonly REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-token-secret'
  private static readonly SESSION_DURATION = parseInt(process.env.SESSION_DURATION || '3600000') // 1 hour default
  private static readonly REFRESH_DURATION = parseInt(process.env.REFRESH_DURATION || '604800000') // 7 days default
  private static readonly MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5')
  private static readonly SESSION_TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30')
  private static readonly ENABLE_SESSION_FIXATION_PROTECTION = process.env.ENABLE_SESSION_FIXATION_PROTECTION !== 'false'

  /**
   * Create a new session for user with enhanced security
   */
  static async createSession(
    userId: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SessionData | null> {
    try {
      // Check concurrent session limits
      const canCreateSession = await this.checkConcurrentSessionLimit(userId)
      if (!canCreateSession) {
        await this.enforceConcurrentSessionLimit(userId)
      }

      const sessionToken = this.generateSecureToken()
      const refreshToken = this.generateSecureToken()
      const expiresAt = new Date(Date.now() + this.SESSION_DURATION)
      const refreshExpiresAt = new Date(Date.now() + this.REFRESH_DURATION)

      // Generate session fingerprint for fixation protection
      const sessionFingerprint = this.ENABLE_SESSION_FIXATION_PROTECTION && ipAddress && userAgent
        ? createHash('sha256').update(`${ipAddress}|${userAgent}`).digest('hex')
        : undefined

      const enhancedDeviceInfo = {
        ...deviceInfo,
        fingerprint: sessionFingerprint,
        createdAt: new Date().toISOString()
      }

      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token: this.hashToken(sessionToken),
          refresh_token: this.hashToken(refreshToken),
          device_info: enhancedDeviceInfo,
          ip_address: ipAddress,
          user_agent: userAgent,
          expires_at: expiresAt.toISOString(),
          refresh_expires_at: refreshExpiresAt.toISOString(),
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to create session', { error, userId })
        return null
      }

      const session: SessionData = {
        id: data.id,
        userId,
        sessionToken,
        refreshToken,
        deviceInfo: enhancedDeviceInfo,
        ipAddress,
        userAgent,
        expiresAt,
        refreshExpiresAt,
        createdAt: new Date(data.created_at),
        lastActivity: new Date(data.last_activity),
        revoked: false
      }

      logger.info('Session created successfully', {
        userId,
        sessionId: data.id,
        hasFingerprint: !!sessionFingerprint
      })
      return session
    } catch (error) {
      logger.error('Session creation failed', { error, userId })
      return null
    }
  }

  /**
   * Validate session token and return session data
   */
  static async validateSession(sessionToken: string): Promise<SessionData | null> {
    try {
      const hashedToken = this.hashToken(sessionToken)
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', hashedToken)
        .eq('revoked', false)
        .single()

      if (error || !data) {
        return null
      }

      const expiresAt = new Date(data.expires_at)
      const refreshExpiresAt = new Date(data.refresh_expires_at)

      // Check if session is expired
      if (expiresAt < new Date()) {
        await this.revokeSession(data.id)
        return null
      }

      // Update last activity
      await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', data.id)

      const session: SessionData = {
        id: data.id,
        userId: data.user_id,
        sessionToken,
        refreshToken: '', // Don't return refresh token
        deviceInfo: data.device_info,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        expiresAt,
        refreshExpiresAt,
        createdAt: new Date(data.created_at),
        lastActivity: new Date(data.last_activity),
        revoked: false
      }

      return session
    } catch (error) {
      logger.error('Session validation failed', { error })
      return null
    }
  }

  /**
   * Refresh session using refresh token
   */
  static async refreshSession(refreshToken: string): Promise<SessionData | null> {
    try {
      const hashedRefreshToken = this.hashToken(refreshToken)
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('refresh_token', hashedRefreshToken)
        .eq('revoked', false)
        .single()

      if (error || !data) {
        return null
      }

      const refreshExpiresAt = new Date(data.refresh_expires_at)

      // Check if refresh token is expired
      if (refreshExpiresAt < new Date()) {
        await this.revokeSession(data.id)
        return null
      }

      // Generate new tokens
      const newSessionToken = this.generateSecureToken()
      const newRefreshToken = this.generateSecureToken()
      const newExpiresAt = new Date(Date.now() + this.SESSION_DURATION)
      const newRefreshExpiresAt = new Date(Date.now() + this.REFRESH_DURATION)

      // Update session with new tokens
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({
          session_token: this.hashToken(newSessionToken),
          refresh_token: this.hashToken(newRefreshToken),
          expires_at: newExpiresAt.toISOString(),
          refresh_expires_at: newRefreshExpiresAt.toISOString(),
          last_activity: new Date().toISOString()
        })
        .eq('id', data.id)

      if (updateError) {
        logger.error('Failed to refresh session', { error: updateError, sessionId: data.id })
        return null
      }

      const session: SessionData = {
        id: data.id,
        userId: data.user_id,
        sessionToken: newSessionToken,
        refreshToken: newRefreshToken,
        deviceInfo: data.device_info,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        expiresAt: newExpiresAt,
        refreshExpiresAt: newRefreshExpiresAt,
        createdAt: new Date(data.created_at),
        lastActivity: new Date(),
        revoked: false
      }

      logger.info('Session refreshed successfully', { userId: data.user_id, sessionId: data.id })
      return session
    } catch (error) {
      logger.error('Session refresh failed', { error })
      return null
    }
  }

  /**
   * Revoke session
   */
  static async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('user_sessions')
        .update({
          revoked: true,
          revoked_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      if (error) {
        logger.error('Failed to revoke session', { error, sessionId })
        return false
      }

      logger.info('Session revoked successfully', { sessionId })
      return true
    } catch (error) {
      logger.error('Session revocation failed', { error, sessionId })
      return false
    }
  }

  /**
   * Revoke all sessions for a user
   */
  static async revokeAllUserSessions(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('user_sessions')
        .update({
          revoked: true,
          revoked_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('revoked', false)

      if (error) {
        logger.error('Failed to revoke all user sessions', { error, userId })
        return false
      }

      logger.info('All user sessions revoked successfully', { userId })
      return true
    } catch (error) {
      logger.error('Revoke all user sessions failed', { error, userId })
      return false
    }
  }

  /**
   * Get active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('revoked', false)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to get user sessions', { error, userId })
        return []
      }

      return data.map(session => ({
        id: session.id,
        userId: session.user_id,
        sessionToken: '', // Don't return actual tokens
        refreshToken: '',
        deviceInfo: session.device_info,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        expiresAt: new Date(session.expires_at),
        refreshExpiresAt: new Date(session.refresh_expires_at),
        createdAt: new Date(session.created_at),
        lastActivity: new Date(session.last_activity),
        revoked: false
      }))
    } catch (error) {
      logger.error('Get user sessions failed', { error, userId })
      return []
    }
  }

  /**
   * Generate JWT token
   */
  static generateJWT(payload: any, expiresIn: string | number = 3600): string {
    try {
      // Use basic synchronous call without options to avoid type issues
      const token = jwt.sign(payload, this.JWT_SECRET)
      logger.debug('JWT generated successfully', { hasExpiry: !!expiresIn })
      return token
    } catch (error) {
      logger.error('JWT generation failed', { error, payload: typeof payload, secret: typeof this.JWT_SECRET })
      throw error
    }
  }

  /**
   * Verify JWT token
   */
  static verifyJWT(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET)
    } catch (error) {
      logger.error('JWT verification failed', { error })
      return null
    }
  }

  /**
   * Generate secure random token
   */
  private static generateSecureToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Hash token for storage
   */
  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  /**
   * Enhanced session validation with security checks
   */
  static async validateSessionEnhanced(sessionToken: string, request?: any): Promise<SessionData | null> {
    try {
      const session = await this.validateSession(sessionToken)
      if (!session) {
        return null
      }

      // Check for session fixation attacks
      if (this.ENABLE_SESSION_FIXATION_PROTECTION && request) {
        const currentFingerprint = this.generateSessionFingerprint(request)
        const storedFingerprint = session.deviceInfo?.fingerprint

        if (storedFingerprint && currentFingerprint !== storedFingerprint) {
          logger.logSecurity('Session fixation attempt detected', undefined, {
            sessionId: session.id,
            userId: session.userId,
            ip: request.headers?.['x-forwarded-for'] || request.ip
          })
          await this.revokeSession(session.id)
          return null
        }
      }

      // Check for suspicious activity
      if (await this.isSessionSuspicious(session, request)) {
        logger.logSecurity('Suspicious session activity detected', undefined, {
          sessionId: session.id,
          userId: session.userId
        })
        await this.revokeSession(session.id)
        return null
      }

      return session
    } catch (error) {
      logger.error('Enhanced session validation failed', { error })
      return null
    }
  }

  /**
   * Check for concurrent session limits
   */
  static async checkConcurrentSessionLimit(userId: string): Promise<boolean> {
    try {
      const activeSessions = await this.getUserSessions(userId)
      return activeSessions.length < this.MAX_CONCURRENT_SESSIONS
    } catch (error) {
      logger.error('Concurrent session limit check failed', { error, userId })
      return true // Allow on error
    }
  }

  /**
   * Enforce concurrent session limits
   */
  static async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    try {
      const activeSessions = await this.getUserSessions(userId)

      if (activeSessions.length >= this.MAX_CONCURRENT_SESSIONS) {
        // Revoke oldest sessions
        const sessionsToRevoke = activeSessions.slice(this.MAX_CONCURRENT_SESSIONS - 1)
        for (const session of sessionsToRevoke) {
          await this.revokeSession(session.id)
        }

        logger.info('Concurrent session limit enforced', {
          userId,
          revokedCount: sessionsToRevoke.length
        })
      }
    } catch (error) {
      logger.error('Failed to enforce concurrent session limit', { error, userId })
    }
  }

  /**
   * Check if session is suspicious based on activity patterns
   */
  private static async isSessionSuspicious(session: SessionData, request?: any): Promise<boolean> {
    try {
      const now = new Date()
      const lastActivity = new Date(session.lastActivity)
      const timeSinceActivity = now.getTime() - lastActivity.getTime()

      // Check for unusual activity patterns
      if (request) {
        const ipAddress = request.headers?.['x-forwarded-for'] || request.ip
        const userAgent = request.headers?.['user-agent']

        // Check if IP has changed significantly
        if (session.ipAddress && ipAddress && session.ipAddress !== ipAddress) {
          // This could be a legitimate VPN/mobile usage, so we'll be lenient
          // but log it for monitoring
          logger.info('Session IP change detected', {
            sessionId: session.id,
            oldIP: session.ipAddress,
            newIP: ipAddress
          })
        }

        // Check for user agent changes
        if (session.userAgent && userAgent && session.userAgent !== userAgent) {
          logger.info('Session user agent change detected', {
            sessionId: session.id,
            oldUA: session.userAgent,
            newUA: userAgent
          })
        }
      }

      // Check for very long periods of inactivity followed by sudden activity
      const maxInactivity = this.SESSION_TIMEOUT_MINUTES * 60 * 1000
      if (timeSinceActivity > maxInactivity) {
        logger.info('Session timeout due to inactivity', {
          sessionId: session.id,
          timeSinceActivity: Math.floor(timeSinceActivity / 1000 / 60) // minutes
        })
        return true
      }

      return false
    } catch (error) {
      logger.error('Suspicious session check failed', { error, sessionId: session.id })
      return false
    }
  }

  /**
   * Generate session fingerprint for fixation protection
   */
  private static generateSessionFingerprint(request: any): string {
    const components = [
      request.headers?.['user-agent'],
      request.headers?.['accept-language'],
      request.headers?.['x-forwarded-for'] || request.ip,
      request.headers?.['sec-ch-ua'] || '',
      request.headers?.['sec-ch-ua-platform'] || ''
    ]

    return createHash('sha256').update(components.join('|')).digest('hex')
  }

  /**
   * Update session activity with enhanced tracking
   */
  static async updateSessionActivity(sessionId: string, request?: any): Promise<void> {
    try {
      const supabase = await createClient()

      const updateData: any = {
        last_activity: new Date().toISOString()
      }

      // Track additional activity metrics
      if (request) {
        updateData.last_ip = request.headers?.['x-forwarded-for'] || request.ip
        updateData.last_user_agent = request.headers?.['user-agent']
        // Note: Activity count would need to be implemented as a separate RPC function
      }

      await supabase
        .from('user_sessions')
        .update(updateData)
        .eq('id', sessionId)

    } catch (error) {
      logger.error('Failed to update session activity', { error, sessionId })
    }
  }

  /**
   * Get session security metrics
   */
  static async getSessionSecurityMetrics(userId: string): Promise<{
    totalSessions: number
    activeSessions: number
    suspiciousSessions: number
    averageSessionAge: number
    lastActivity: Date | null
  }> {
    try {
      const sessions = await this.getUserSessions(userId)
      const now = new Date()

      const activeSessions = sessions.filter(s => s.expiresAt > now)
      const suspiciousSessions = sessions.filter(s => {
        const timeSinceActivity = now.getTime() - s.lastActivity.getTime()
        return timeSinceActivity > (this.SESSION_TIMEOUT_MINUTES * 60 * 1000)
      })

      const averageSessionAge = sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (now.getTime() - s.createdAt.getTime()), 0) / sessions.length
        : 0

      const lastActivity = sessions.length > 0
        ? new Date(Math.max(...sessions.map(s => s.lastActivity.getTime())))
        : null

      return {
        totalSessions: sessions.length,
        activeSessions: activeSessions.length,
        suspiciousSessions: suspiciousSessions.length,
        averageSessionAge,
        lastActivity
      }
    } catch (error) {
      logger.error('Failed to get session security metrics', { error, userId })
      return {
        totalSessions: 0,
        activeSessions: 0,
        suspiciousSessions: 0,
        averageSessionAge: 0,
        lastActivity: null
      }
    }
  }

  /**
   * Clean up expired sessions (should be run periodically)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_sessions')
        .update({
          revoked: true,
          revoked_at: new Date().toISOString(),
          revocation_reason: 'expired'
        })
        .lt('expires_at', new Date().toISOString())
        .eq('revoked', false)
        .select('id')

      if (error) {
        logger.error('Failed to cleanup expired sessions', { error })
        return 0
      }

      const cleanedCount = data?.length || 0
      logger.info('Expired sessions cleaned up', { count: cleanedCount })

      return cleanedCount
    } catch (error) {
      logger.error('Cleanup expired sessions failed', { error })
      return 0
    }
  }
}