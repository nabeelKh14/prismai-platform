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

    const { code } = await request.json()

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid verification code format' },
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

    // Verify SMS code
    const result = await MFAService.verifySMSCode(user.id, code)

    if (result.success) {
      logger.info('SMS MFA verification successful', { userId: user.id })
      return NextResponse.json({
        success: true,
        message: result.message,
        smsEnabled: true
      })
    } else {
      logger.warn('SMS MFA verification failed', { userId: user.id, reason: result.message })
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

  } catch (error) {
    logger.error('SMS MFA verification failed', { error })
    return NextResponse.json(
      { error: 'SMS verification failed' },
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

    // Disable SMS MFA
    const disabled = await MFAService.disableSMSMFA(user.id)

    if (!disabled) {
      return NextResponse.json(
        { error: 'Failed to disable SMS MFA' },
        { status: 500 }
      )
    }

    logger.info('SMS MFA disabled', { userId: user.id })
    return NextResponse.json({
      success: true,
      message: 'SMS MFA has been disabled'
    })

  } catch (error) {
    logger.error('Failed to disable SMS MFA', { error })
    return NextResponse.json(
      { error: 'Failed to disable SMS MFA' },
      { status: 500 }
    )
  }
}