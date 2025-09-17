import { NextRequest, NextResponse } from 'next/server'
import { PasswordPolicyService } from '@/lib/auth/password-policy'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const POST = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { password, userInfo } = await request.json()

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Validate password
    const validation = PasswordPolicyService.validatePassword(password, userInfo)

    // Generate suggestions if password is weak
    const suggestions = validation.isValid
      ? []
      : PasswordPolicyService.generateSuggestions(password, validation)

    return NextResponse.json({
      success: true,
      data: {
        isValid: validation.isValid,
        errors: validation.errors,
        strength: validation.strength,
        score: validation.score,
        suggestions
      }
    })

  } catch (error) {
    logger.error('Password validation failed', { error })
    return NextResponse.json(
      { error: 'Password validation failed' },
      { status: 500 }
    )
  }
}