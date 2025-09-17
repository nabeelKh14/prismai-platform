import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/auth/session-service'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const POST = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { refreshToken } = await request.json()

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

    // Refresh the session
    const session = await SessionService.refreshSession(refreshToken)

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }

    // Generate new JWT token
    const jwtToken = SessionService.generateJWT({
      userId: session.userId,
      sessionId: session.id,
      type: 'access'
    })

    logger.info('Session refreshed successfully', { userId: session.userId, sessionId: session.id })

    return NextResponse.json({
      success: true,
      data: {
        accessToken: jwtToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt.toISOString(),
        refreshExpiresAt: session.refreshExpiresAt.toISOString()
      }
    })

  } catch (error) {
    logger.error('Session refresh failed', { error })
    return NextResponse.json(
      { error: 'Session refresh failed' },
      { status: 500 }
    )
  }
}