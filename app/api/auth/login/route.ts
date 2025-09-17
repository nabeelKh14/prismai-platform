import { NextRequest, NextResponse } from 'next/server'
import { EnterpriseSecurity } from '@/lib/auth/enterprise-security'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const POST = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Check rate limiting
    const canProceed = await EnterpriseSecurity.checkRateLimit(ipAddress, 'login')
    if (!canProceed) {
      await EnterpriseSecurity.logAuthEvent(null, 'login_rate_limited', { email }, request)
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Attempt login with enhanced security
    const authResult = await EnterpriseSecurity.loginWithMFA(email, password, ipAddress, userAgent)

    if (!authResult.success) {
      await EnterpriseSecurity.logAuthEvent(null, 'login_failed', { email, reason: authResult.error }, request)
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      )
    }

    // Log successful authentication
    await EnterpriseSecurity.logAuthEvent(
      authResult.user?.id,
      'login_success',
      { email, requiresMFA: authResult.requiresMFA },
      request
    )

    if (authResult.requiresMFA) {
      // Return MFA challenge
      return NextResponse.json({
        success: true,
        requiresMFA: true,
        mfaMethods: authResult.mfaMethods,
        sessionId: authResult.session?.id
      })
    }

    // Create response with session cookies
    const response = NextResponse.json({
      success: true,
      user: {
        id: authResult.user?.id,
        email: authResult.user?.email
      },
      redirectTo: '/dashboard'
    })

    // Set session cookies
    if (authResult.session) {
      response.cookies.set('session_token', authResult.session.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 // 1 hour
      })

      response.cookies.set('refresh_token', authResult.session.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      })

      // Set MFA verified cookie if no MFA required
      if (!authResult.requiresMFA) {
        response.cookies.set('mfa_verified', 'true', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 // 1 hour
        })
      }
    }

    return response

  } catch (error) {
    logger.error('Login error', { error })
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}