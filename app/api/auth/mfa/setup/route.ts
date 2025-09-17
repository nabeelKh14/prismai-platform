import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MFAService } from '@/lib/auth/mfa-service'
import { logger } from '@/lib/logger'
import { RequestValidator, AuthSecurity } from '@/lib/security'

export const POST = async (request: NextRequest) => {
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

    // Check if MFA is already enabled
    const isMFAEnabled = await MFAService.isMFAEnabled(user.id)
    if (isMFAEnabled) {
      return NextResponse.json(
        { error: 'MFA is already enabled for this account' },
        { status: 400 }
      )
    }

    // Generate TOTP secret and setup data
    const setupData = await MFAService.generateTOTPSecret(user.id, user.email!)

    // Generate QR code data URL
    const qrCodeDataURL = await MFAService.generateQRCodeDataURL(setupData.qrCodeUrl)

    logger.info('MFA setup initiated', { userId: user.id })

    return NextResponse.json({
      success: true,
      data: {
        secret: setupData.secret,
        qrCodeDataURL,
        backupCodes: setupData.backupCodes
      }
    })

  } catch (error) {
    logger.error('MFA setup failed', { error })
    return NextResponse.json(
      { error: 'Failed to setup MFA' },
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

    // Check MFA status
    const isMFAEnabled = await MFAService.isMFAEnabled(user.id)

    // Get MFA data if exists
    const { data: mfaData } = await supabase
      .from('user_mfa')
      .select('mfa_enabled, created_at, enabled_at, backup_codes')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        mfaEnabled: isMFAEnabled,
        mfaData: mfaData ? {
          enabled: mfaData.mfa_enabled,
          createdAt: mfaData.created_at,
          enabledAt: mfaData.enabled_at,
          backupCodesCount: mfaData.backup_codes?.length || 0
        } : null
      }
    })

  } catch (error) {
    logger.error('Failed to get MFA status', { error })
    return NextResponse.json(
      { error: 'Failed to get MFA status' },
      { status: 500 }
    )
  }
}