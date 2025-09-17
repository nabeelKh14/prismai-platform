import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MFAService } from '@/lib/auth/mfa-service'
import { RBACService } from '@/lib/auth/rbac-service'
import { SessionService } from '@/lib/auth/session-service'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export interface AuthResult {
  success: boolean
  user?: any
  session?: any
  requiresMFA?: boolean
  mfaMethods?: string[]
  error?: string
}

export class EnterpriseSecurity {
  /**
   * Enhanced authentication middleware with MFA and RBAC support
   */
  static async authenticateRequest(
    request: NextRequest,
    options: {
      requireAuth?: boolean
      requireMFA?: boolean
      requiredPermission?: { resource: string; action: string }
      requireAdmin?: boolean
    } = {}
  ): Promise<AuthResult> {
    try {
      // Basic request validation
      RequestValidator.validateHeaders(request)
      RequestValidator.detectSuspiciousPatterns(request)

      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        return { success: false, error: 'Authentication failed' }
      }

      if (!user) {
        if (options.requireAuth) {
          return { success: false, error: 'Authentication required' }
        }
        return { success: true } // Public route
      }

      // Check session validity
      const sessionToken = request.cookies.get('session_token')?.value
      if (sessionToken) {
        const session = await SessionService.validateSession(sessionToken)
        if (!session) {
          return { success: false, error: 'Invalid or expired session' }
        }
      }

      // Check MFA requirement
      if (options.requireMFA) {
        const mfaMethods = await MFAService.getUserMFAMethods(user.id)
        const hasMFA = mfaMethods.totpEnabled || mfaMethods.smsEnabled

        if (!hasMFA) {
          return {
            success: false,
            error: 'MFA required but not configured',
            requiresMFA: true,
            mfaMethods: []
          }
        }

        // Check if MFA verification is needed for this session
        const mfaVerified = request.cookies.get('mfa_verified')?.value === 'true'
        if (!mfaVerified) {
          return {
            success: false,
            error: 'MFA verification required',
            requiresMFA: true,
            mfaMethods: mfaMethods.totpEnabled ? ['totp'] : []
          }
        }
      }

      // Check permissions
      if (options.requiredPermission) {
        const hasPermission = await RBACService.hasPermission(
          user.id,
          options.requiredPermission.resource,
          options.requiredPermission.action
        )

        if (!hasPermission) {
          return {
            success: false,
            error: `Insufficient permissions: ${options.requiredPermission.action} on ${options.requiredPermission.resource}`
          }
        }
      }

      // Check admin requirement
      if (options.requireAdmin) {
        const isAdmin = await RBACService.isAdmin(user.id)
        if (!isAdmin) {
          return { success: false, error: 'Admin access required' }
        }
      }

      // Update last activity
      if (sessionToken) {
        await SessionService.validateSession(sessionToken)
      }

      // Log successful authentication
      logger.info('Request authenticated successfully', {
        userId: user.id,
        path: request.nextUrl.pathname,
        method: request.method
      })

      return {
        success: true,
        user,
        session: sessionToken ? await SessionService.validateSession(sessionToken) : null
      }

    } catch (error) {
      logger.error('Authentication middleware error', { error })
      return { success: false, error: 'Authentication error' }
    }
  }

  /**
   * Enhanced login with MFA support
   */
  static async loginWithMFA(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        logger.warn('Login failed', { error: error.message, email })
        return { success: false, error: error.message }
      }

      if (!data.user) {
        return { success: false, error: 'Login failed' }
      }

      const userId = data.user.id

      // Check if MFA is enabled
      const mfaMethods = await MFAService.getUserMFAMethods(userId)
      const hasMFA = mfaMethods.totpEnabled || mfaMethods.smsEnabled

      if (hasMFA) {
        // Create session but mark as requiring MFA
        const session = await SessionService.createSession(
          userId,
          undefined,
          ipAddress,
          userAgent
        )

        if (!session) {
          return { success: false, error: 'Failed to create session' }
        }

        // Update last login
        await this.updateLastLogin(userId)

        return {
          success: true,
          user: data.user,
          session,
          requiresMFA: true,
          mfaMethods: mfaMethods.totpEnabled ? ['totp'] : ['sms']
        }
      }

      // No MFA required, create full session
      const session = await SessionService.createSession(
        userId,
        undefined,
        ipAddress,
        userAgent
      )

      if (!session) {
        return { success: false, error: 'Failed to create session' }
      }

      // Update last login
      await this.updateLastLogin(userId)

      // Generate JWT
      const jwtToken = SessionService.generateJWT({
        userId,
        sessionId: session.id,
        type: 'access'
      })

      logger.info('Login successful', { userId, email })

      return {
        success: true,
        user: data.user,
        session: {
          ...session,
          accessToken: jwtToken
        }
      }

    } catch (error) {
      logger.error('Login error', { error })
      return { success: false, error: 'Login failed' }
    }
  }

  /**
   * Verify MFA and complete authentication
   */
  static async verifyMFACompleteAuth(
    userId: string,
    mfaToken: string,
    sessionId: string
  ): Promise<AuthResult> {
    try {
      // Verify MFA token
      const mfaResult = await MFAService.verifyTOTP(userId, mfaToken)

      if (!mfaResult.success) {
        return { success: false, error: mfaResult.message }
      }

      // Get session
      const session = await SessionService.validateSession(sessionId)
      if (!session) {
        return { success: false, error: 'Invalid session' }
      }

      // Generate JWT
      const jwtToken = SessionService.generateJWT({
        userId,
        sessionId: session.id,
        type: 'access'
      })

      logger.info('MFA verification successful', { userId })

      return {
        success: true,
        session: {
          ...session,
          accessToken: jwtToken
        }
      }

    } catch (error) {
      logger.error('MFA verification error', { error, userId })
      return { success: false, error: 'MFA verification failed' }
    }
  }

  /**
   * Logout with session cleanup
   */
  static async logout(sessionToken: string): Promise<boolean> {
    try {
      const session = await SessionService.validateSession(sessionToken)
      if (session) {
        await SessionService.revokeSession(session.id)
        logger.info('Logout successful', { userId: session.userId })
      }

      return true
    } catch (error) {
      logger.error('Logout error', { error })
      return false
    }
  }

  /**
   * Check if user needs password change
   */
  static async requiresPasswordChange(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      // Check if password is expired
      const { data: passwordHistory } = await supabase
        .from('password_history')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!passwordHistory) {
        return false // No password history, assume current
      }

      const passwordAge = Date.now() - new Date(passwordHistory.created_at).getTime()
      const maxAge = 90 * 24 * 60 * 60 * 1000 // 90 days

      return passwordAge > maxAge
    } catch (error) {
      logger.error('Password age check failed', { error, userId })
      return false
    }
  }

  /**
   * Audit log authentication events
   */
  static async logAuthEvent(
    userId: string | null,
    action: string,
    details: any = {},
    request?: NextRequest
  ): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('auth_audit_log')
        .insert({
          user_id: userId,
          action,
          details,
          ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip'),
          user_agent: request?.headers.get('user-agent'),
          created_at: new Date().toISOString()
        })

    } catch (error) {
      logger.error('Failed to log auth event', { error, userId, action })
    }
  }

  /**
   * Update last login timestamp
   */
  private static async updateLastLogin(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('profiles')
        .update({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    } catch (error) {
      logger.error('Failed to update last login', { error, userId })
    }
  }

  /**
   * Check rate limiting for authentication attempts
   */
  static async checkRateLimit(identifier: string, action: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      // Check recent attempts
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      const { data: attempts } = await supabase
        .from('auth_audit_log')
        .select('id')
        .eq('action', action)
        .eq('ip_address', identifier)
        .gte('created_at', fiveMinutesAgo)

      const attemptCount = attempts?.length || 0

      // Allow max 5 attempts per 5 minutes
      return attemptCount < 5
    } catch (error) {
      logger.error('Rate limit check failed', { error, identifier, action })
      return true // Allow on error
    }
  }

  /**
   * Get security status for user
   */
  static async getSecurityStatus(userId: string): Promise<{
    mfaEnabled: boolean
    passwordStrength: string
    lastLogin: string | null
    activeSessions: number
    recentFailedAttempts: number
  }> {
    try {
      const mfaMethods = await MFAService.getUserMFAMethods(userId)
      const sessions = await SessionService.getUserSessions(userId)

      const supabase = await createClient()

      // Get profile info
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_login_at')
        .eq('id', userId)
        .single()

      // Get recent failed attempts
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: failedAttempts } = await supabase
        .from('auth_audit_log')
        .select('id')
        .eq('user_id', userId)
        .eq('success', false)
        .gte('created_at', oneDayAgo)

      return {
        mfaEnabled: mfaMethods.totpEnabled || mfaMethods.smsEnabled,
        passwordStrength: 'unknown', // Would need password policy service integration
        lastLogin: profile?.last_login_at || null,
        activeSessions: sessions.length,
        recentFailedAttempts: failedAttempts?.length || 0
      }

    } catch (error) {
      logger.error('Failed to get security status', { error, userId })
      return {
        mfaEnabled: false,
        passwordStrength: 'unknown',
        lastLogin: null,
        activeSessions: 0,
        recentFailedAttempts: 0
      }
    }
  }
}