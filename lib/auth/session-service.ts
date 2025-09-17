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
  private static readonly SESSION_DURATION = 60 * 60 * 1000 // 1 hour
  private static readonly REFRESH_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

  /**
   * Create a new session for user
   */
  static async createSession(
    userId: string,
    deviceInfo?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SessionData | null> {
    try {
      const sessionToken = this.generateSecureToken()
      const refreshToken = this.generateSecureToken()
      const expiresAt = new Date(Date.now() + this.SESSION_DURATION)
      const refreshExpiresAt = new Date(Date.now() + this.REFRESH_DURATION)

      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token: this.hashToken(sessionToken),
          refresh_token: this.hashToken(refreshToken),
          device_info: deviceInfo,
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
        deviceInfo,
        ipAddress,
        userAgent,
        expiresAt,
        refreshExpiresAt,
        createdAt: new Date(data.created_at),
        lastActivity: new Date(data.last_activity),
        revoked: false
      }

      logger.info('Session created successfully', { userId, sessionId: data.id })
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
  static generateJWT(payload: any, expiresIn: string = '1h'): string {
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: expiresIn as string })
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