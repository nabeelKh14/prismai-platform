import { z } from 'zod'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export interface PasswordPolicy {
  minLength: number
  maxLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
  preventCommonPasswords: boolean
  preventPersonalInfo: boolean
  passwordHistory: number // Number of previous passwords to prevent reuse
  maxAge: number // Maximum password age in days
}

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong' | 'very-strong'
  score: number // 0-100
}

export class PasswordPolicyService {
  private static readonly DEFAULT_POLICY: PasswordPolicy = {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    preventPersonalInfo: true,
    passwordHistory: 5,
    maxAge: 90
  }

  private static readonly COMMON_PASSWORDS = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
    'qwerty123', 'welcome123', 'admin123', 'root', 'user', 'guest'
  ]

  /**
   * Validate password against policy
   */
  static validatePassword(
    password: string,
    userInfo?: {
      email?: string
      firstName?: string
      lastName?: string
      phoneNumber?: string
    },
    policy: PasswordPolicy = this.DEFAULT_POLICY
  ): PasswordValidationResult {
    const errors: string[] = []
    let score = 0

    // Length validation
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`)
    } else if (password.length > policy.maxLength) {
      errors.push(`Password must be no more than ${policy.maxLength} characters long`)
    } else {
      score += 20
    }

    // Character requirements
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    } else if (policy.requireUppercase) {
      score += 15
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    } else if (policy.requireLowercase) {
      score += 15
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    } else if (policy.requireNumbers) {
      score += 15
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character')
    } else if (policy.requireSpecialChars) {
      score += 15
    }

    // Common password check
    if (policy.preventCommonPasswords && this.COMMON_PASSWORDS.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a more unique password')
    } else if (policy.preventCommonPasswords) {
      score += 10
    }

    // Personal information check
    if (policy.preventPersonalInfo && userInfo) {
      const personalInfo = [
        userInfo.email?.split('@')[0],
        userInfo.firstName,
        userInfo.lastName,
        userInfo.phoneNumber?.slice(-4)
      ].filter(Boolean).map(info => info?.toLowerCase())

      const containsPersonalInfo = personalInfo.some(info =>
        info && password.toLowerCase().includes(info)
      )

      if (containsPersonalInfo) {
        errors.push('Password should not contain personal information')
      } else if (policy.preventPersonalInfo) {
        score += 10
      }
    }

    // Additional complexity checks
    if (password.length >= 16) score += 10
    if (/(.)\1{2,}/.test(password)) score -= 10 // Repeated characters
    if (/(.{3,})\1/.test(password)) score -= 10 // Repeated sequences

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong' | 'very-strong'
    if (score >= 80) strength = 'very-strong'
    else if (score >= 60) strength = 'strong'
    else if (score >= 40) strength = 'medium'
    else strength = 'weak'

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score: Math.max(0, Math.min(100, score))
    }
  }

  /**
   * Check if password was used recently
   */
  static async checkPasswordHistory(
    userId: string,
    newPassword: string,
    historyCount: number = this.DEFAULT_POLICY.passwordHistory
  ): Promise<boolean> {
    try {
      const supabase = await createClient()

      // Get recent password hashes
      const { data: passwordHistory, error } = await supabase
        .from('password_history')
        .select('password_hash')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(historyCount)

      if (error) {
        logger.error('Failed to check password history', { error, userId })
        return false // Allow password change if we can't check history
      }

      // Check against recent passwords
      for (const history of passwordHistory || []) {
        const isMatch = await this.comparePassword(newPassword, history.password_hash)
        if (isMatch) {
          return true // Password was used recently
        }
      }

      return false // Password not in recent history
    } catch (error) {
      logger.error('Password history check failed', { error, userId })
      return false
    }
  }

  /**
   * Store password in history
   */
  static async storePasswordHistory(userId: string, passwordHash: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Store new password hash
      const { error: insertError } = await supabase
        .from('password_history')
        .insert({
          user_id: userId,
          password_hash: passwordHash
        })

      if (insertError) {
        logger.error('Failed to store password history', { error: insertError, userId })
        return
      }

      // Clean up old entries (keep only last N passwords)
      const { error: cleanupError } = await supabase
        .from('password_history')
        .delete()
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(this.DEFAULT_POLICY.passwordHistory, 1000) // Delete beyond the limit

      if (cleanupError) {
        logger.warn('Failed to cleanup old password history', { error: cleanupError, userId })
      }
    } catch (error) {
      logger.error('Store password history failed', { error, userId })
    }
  }

  /**
   * Check if password needs to be changed (age check)
   */
  static async checkPasswordAge(userId: string, maxAge: number = this.DEFAULT_POLICY.maxAge): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('password_history')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return false // No password history, assume password is current
      }

      const passwordAge = Date.now() - new Date(data.created_at).getTime()
      const maxAgeMs = maxAge * 24 * 60 * 60 * 1000

      return passwordAge > maxAgeMs
    } catch (error) {
      logger.error('Password age check failed', { error, userId })
      return false
    }
  }

  /**
   * Generate password strength suggestions
   */
  static generateSuggestions(password: string, validation: PasswordValidationResult): string[] {
    const suggestions: string[] = []

    if (password.length < 12) {
      suggestions.push('Use at least 12 characters')
    }

    if (!/[A-Z]/.test(password)) {
      suggestions.push('Add uppercase letters (A-Z)')
    }

    if (!/[a-z]/.test(password)) {
      suggestions.push('Add lowercase letters (a-z)')
    }

    if (!/\d/.test(password)) {
      suggestions.push('Add numbers (0-9)')
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      suggestions.push('Add special characters (!@#$%^&*...)')
    }

    if (this.COMMON_PASSWORDS.includes(password.toLowerCase())) {
      suggestions.push('Avoid common passwords like "password123"')
    }

    if (validation.strength === 'weak') {
      suggestions.push('Consider using a passphrase or password manager')
    }

    return suggestions
  }

  /**
   * Compare password with hash (using bcrypt)
   */
  private static async comparePassword(password: string, hash: string): Promise<boolean> {
    const { compare } = await import('bcryptjs')
    return compare(password, hash)
  }

  /**
   * Get current password policy
   */
  static getCurrentPolicy(): PasswordPolicy {
    return this.DEFAULT_POLICY
  }

  /**
   * Update password policy (admin only)
   */
  static updatePolicy(newPolicy: Partial<PasswordPolicy>): PasswordPolicy {
    // In a real implementation, this would be stored in database
    // For now, we'll just return the updated policy
    return { ...this.DEFAULT_POLICY, ...newPolicy }
  }
}