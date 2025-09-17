import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SessionService } from '@/lib/auth/session-service'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const GET = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user sessions
    const sessions = await SessionService.getUserSessions(user.id)

    return NextResponse.json({
      success: true,
      data: {
        sessions: sessions.map(session => ({
          id: session.id,
          deviceInfo: session.deviceInfo,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt.toISOString(),
          lastActivity: session.lastActivity.toISOString(),
          expiresAt: session.expiresAt.toISOString()
        }))
      }
    })

  } catch (error) {
    logger.error('Failed to get user sessions', { error })
    return NextResponse.json(
      { error: 'Failed to get sessions' },
      { status: 500 }
    )
  }
}

export const DELETE = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { sessionId, revokeAll } = await request.json()

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let success = false

    if (revokeAll) {
      // Revoke all sessions for the user
      success = await SessionService.revokeAllUserSessions(user.id)
      logger.info('All user sessions revoked', { userId: user.id })
    } else if (sessionId) {
      // Revoke specific session
      success = await SessionService.revokeSession(sessionId)
      logger.info('Session revoked', { userId: user.id, sessionId })
    } else {
      return NextResponse.json(
        { error: 'Session ID or revokeAll flag is required' },
        { status: 400 }
      )
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to revoke session(s)' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: revokeAll ? 'All sessions revoked successfully' : 'Session revoked successfully'
    })

  } catch (error) {
    logger.error('Session revocation failed', { error })
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    )
  }
}