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

    const { phoneNumber } = await request.json()

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
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

    // Check if SMS MFA is already enabled
    const isSMSMFAEnabled = await MFAService.isSMSMFAEnabled(user.id)
    if (isSMSMFAEnabled) {
      return NextResponse.json(
        { error: 'SMS MFA is already enabled for this account' },
        { status: 400 }
      )
    }

    // Send verification code
    const success = await MFAService.enableSMSMFA(user.id, phoneNumber)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send SMS verification code' },
        { status: 500 }
      )
    }

    logger.info('SMS MFA setup initiated', { userId: user.id })
    return NextResponse.json({
      success: true,
      message: 'SMS verification code sent. Please check your phone.'
    })

  } catch (error) {
    logger.error('SMS MFA setup failed', { error })
    return NextResponse.json(
      { error: 'Failed to setup SMS MFA' },
      { status: 500 }
    )
  }
}

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

    // Get SMS MFA status
    const mfaMethods = await MFAService.getUserMFAMethods(user.id)

    return NextResponse.json({
      success: true,
      data: {
        smsEnabled: mfaMethods.smsEnabled,
        phoneNumber: mfaMethods.phoneNumber
      }
    })

  } catch (error) {
    logger.error('Failed to get SMS MFA status', { error })
    return NextResponse.json(
      { error: 'Failed to get SMS MFA status' },
      { status: 500 }
    )
  }
}