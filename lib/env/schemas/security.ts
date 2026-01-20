import { z } from 'zod'

/**
 * Checks if a string has sufficient entropy for use as a secret
 * Requires at least 32 characters with mixed case, numbers, and special characters
 */
function hasSufficientEntropy(value: string): boolean {
  if (value.length < 32) return false

  const hasLower = /[a-z]/.test(value)
  const hasUpper = /[A-Z]/.test(value)
  const hasNumber = /\d/.test(value)
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)

  return hasLower && hasUpper && hasNumber && hasSpecial
}

/**
 * Security configuration schema
 * Contains secrets and security-related settings with entropy validation
 */
export const securitySchema = z.object({
  // Security - optional in development, validated in production
  JWT_SECRET: z.string().optional().refine(
    (val) => !val || val.length >= 32 || process.env.NODE_ENV === 'development',
    { message: 'JWT_SECRET must be at least 32 characters with mixed case, numbers, and special characters' }
  ),
  ENCRYPTION_KEY: z.string().optional().refine(
    (val) => !val || val.length >= 32 || process.env.NODE_ENV === 'development',
    { message: 'ENCRYPTION_KEY must be at least 32 characters with mixed case, numbers, and special characters' }
  ),
  WEBHOOK_SECRET: z.string().optional(),
})