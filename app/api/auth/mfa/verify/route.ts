import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MFAService } from '@/lib/auth/mfa-service'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const POST = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { token } = await request.json()

    if (!token || typeof token !== 'string' || token.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid MFA token format' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify MFA token
    const result = await MFAService.verifyTOTP(user.id, token)

    if (result.success) {
      // If this is the first successful verification, enable MFA
      const isMFAEnabled = await MFAService.isMFAEnabled(user.id)
      if (!isMFAEnabled) {
        const enabled = await MFAService.enableMFA(user.id)
        if (!enabled) {
          logger.error('Failed to enable MFA after verification', { userId: user.id })
          return NextResponse.json(
            { error: 'Failed to enable MFA' },
            { status: 500 }
          )
        }
      }

      logger.info('MFA verification successful', { userId: user.id })
      return NextResponse.json({
        success: true,
        message: result.message,
        mfaEnabled: true
      })
    } else {
      logger.warn('MFA verification failed', { userId: user.id, reason: result.message })
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

  } catch (error) {
    logger.error('MFA verification failed', { error })
    return NextResponse.json(
      { error: 'MFA verification failed' },
      { status: 500 }
    )
  }
}

export const DELETE = async (request: NextRequest) => {
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

    // Disable MFA
    const disabled = await MFAService.disableMFA(user.id)

    if (!disabled) {
      return NextResponse.json(
        { error: 'Failed to disable MFA' },
        { status: 500 }
      )
    }

    logger.info('MFA disabled', { userId: user.id })
    return NextResponse.json({
      success: true,
      message: 'MFA has been disabled'
    })

  } catch (error) {
    logger.error('Failed to disable MFA', { error })
    return NextResponse.json(
      { error: 'Failed to disable MFA' },
      { status: 500 }
    )
  }
}