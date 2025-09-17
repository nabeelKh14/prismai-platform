import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PasswordPolicyService } from '@/lib/auth/password-policy'
import { AuthSecurity } from '@/lib/security'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const POST = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
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

    // Get user profile for password validation
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, first_name, last_name, phone_number')
      .eq('id', user.id)
      .single()

    // Validate new password
    const userInfo = profile ? {
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phoneNumber: profile.phone_number
    } : undefined

    const validation = PasswordPolicyService.validatePassword(newPassword, userInfo)

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Password does not meet security requirements',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    // Check password history
    const wasUsedRecently = await PasswordPolicyService.checkPasswordHistory(user.id, newPassword)
    if (wasUsedRecently) {
      return NextResponse.json(
        { error: 'Password was used recently. Please choose a different password' },
        { status: 400 }
      )
    }

    // Verify current password
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'Failed to verify current user' },
        { status: 500 }
      )
    }

    // For Supabase, we'll use the updateUser method to change password
    // Note: This requires re-authentication in production
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      logger.error('Failed to update password', { error: updateError, userId: user.id })
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    // Hash the new password for history storage
    const hashedPassword = await AuthSecurity.hashPassword(newPassword)

    // Store password in history
    await PasswordPolicyService.storePasswordHistory(user.id, hashedPassword)

    logger.info('Password changed successfully', { userId: user.id })

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
      data: {
        strength: validation.strength,
        score: validation.score
      }
    })

  } catch (error) {
    logger.error('Password change failed', { error })
    return NextResponse.json(
      { error: 'Password change failed' },
      { status: 500 }
    )
  }
}