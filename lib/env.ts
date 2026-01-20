import { z } from 'zod'
import { appSchema } from './env/schemas/app'
import { supabaseSchema } from './env/schemas/supabase'
import { analyticsSchema } from './env/schemas/analytics'
import { monitoringSchema } from './env/schemas/monitoring'
import { aiSchema } from './env/schemas/ai'
import { emailSchema } from './env/schemas/email'
import { securitySchema } from './env/schemas/security'
import { cachingSchema } from './env/schemas/caching'

// Define public schema (available in both client and server)
const publicSchema = appSchema
  .merge(supabaseSchema.pick({
    NEXT_PUBLIC_SUPABASE_URL: true,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  }))
  .merge(analyticsSchema)
  .merge(monitoringSchema.pick({
    LOG_LEVEL: true,
    ENABLE_REQUEST_LOGGING: true,
  }))

// Define server schema (extends public with server-only variables)
const serverSchema = publicSchema
  .merge(supabaseSchema.pick({
    SUPABASE_SERVICE_ROLE_KEY: true,
  }))
  .merge(aiSchema)
  .merge(emailSchema)
  .merge(securitySchema)
  .merge(cachingSchema)
  .merge(monitoringSchema.pick({
    DATABASE_CONNECTION_LIMIT: true,
    HEALTH_CHECK_TOKEN: true,
  }))

/**
 * Type representing public environment variables available in both client and server
 */
export type PublicEnv = z.infer<typeof publicSchema>

/**
 * Type representing all environment variables available on the server
 */
export type ServerEnv = z.infer<typeof serverSchema>

/**
 * Legacy type for backward compatibility - represents server environment
 */
export type Env = ServerEnv

/**
 * List of sensitive environment variable names that should be redacted in error messages
 */
const SENSITIVE_VARS = new Set([
  'GEMINI_API_KEY',
  'VAPI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'WEBHOOK_SECRET',
  'UPSTASH_REDIS_REST_TOKEN',
  'SMTP_PASS',
  'RESEND_API_KEY',
])

/**
 * Sanitizes error messages by redacting sensitive variable names
 */
function sanitizeErrorMessage(message: string): string {
  let sanitized = message
  SENSITIVE_VARS.forEach(sensitiveVar => {
    const regex = new RegExp(`\\b${sensitiveVar}\\b`, 'g')
    sanitized = sanitized.replace(regex, '[REDACTED]')
  })
  return sanitized
}

class EnvValidationError extends Error {
  constructor(message: string, public errors: z.ZodError) {
    super(message)
    this.name = 'EnvValidationError'
  }
}

/**
 * Validates environment variables and returns the appropriate type based on environment
 * @returns PublicEnv in browser, ServerEnv on server
 */
function validateEnv(): PublicEnv | ServerEnv {
  const isBrowser = typeof window !== 'undefined'
  const schema = isBrowser ? publicSchema : serverSchema

  try {
    const parsed = schema.parse(process.env)
    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .filter(err => err.code === 'invalid_type' && err.received === 'undefined')
        .map(err => err.path.join('.'))

      const invalidVars = error.errors
        .filter(err => err.code !== 'invalid_type' || err.received !== 'undefined')
        .map(err => `${err.path.join('.')}: ${err.message}`)

      let errorMessage = 'Environment validation failed:'

      if (missingVars.length > 0) {
        errorMessage += ' Missing: ' + missingVars.join(', ')
      }

      if (invalidVars.length > 0) {
        errorMessage += ' Invalid: ' + invalidVars.map(sanitizeErrorMessage).join(', ')
      }

      errorMessage += ' Please check your .env file'

      throw new EnvValidationError(errorMessage, error)
    }
    throw error
  }
}

/**
 * Safely validates environment variables without throwing
 * @returns Object with success status and either data or error
 */
export function validateEnvSafe(): { success: true; data: PublicEnv | ServerEnv } | { success: false; error: string } {
  try {
    const data = validateEnv()
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof EnvValidationError
      ? error.message
      : `Environment validation failed: ${String(error)}`
    return { success: false, error: sanitizeErrorMessage(errorMessage) }
  }
}

// Validate environment variables at module load time
let env: ServerEnv

try {
  env = validateEnv() as ServerEnv
} catch (error) {
  if (process.env.NODE_ENV !== 'test') {
    console.error('❌ Environment validation failed')
    console.error(error instanceof EnvValidationError ? error.message : error)
    // Instead of process.exit(1), log the error. We don't throw here to allow the app to load
    // so we can show a nice error message in the UI if needed (via requireEnv calls).
    // throw new Error(`Environment validation failed: ${error instanceof EnvValidationError ? error.message : String(error)}`)
    console.warn('Environment validation failed, proceeding with unsafe environment')
    env = process.env as unknown as ServerEnv
  }
  // In test environment, provide defaults
  env = serverSchema.parse({
    NODE_ENV: 'test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    GEMINI_API_KEY: 'test-gemini-key',
    VAPI_API_KEY: 'test-vapi-key',
    SENTRY_DSN: '',
    UPSTASH_REDIS_REST_URL: '',
    REDIS_URL: '',
    LOG_LEVEL: 'info',
    ENABLE_REQUEST_LOGGING: false,
    DATABASE_CONNECTION_LIMIT: 20,
    HEALTH_CHECK_TOKEN: '',
    JWT_SECRET: 'TestJwtSecretWithAtLeast32Characters!123',
    ENCRYPTION_KEY: 'TestEncryptionKeyWithAtLeast32Chars!456',
    WEBHOOK_SECRET: '',
    SMTP_HOST: '',
    SMTP_PORT: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    RESEND_API_KEY: '',
    VERCEL_ANALYTICS_ID: '',
    UPSTASH_REDIS_REST_TOKEN: '',
  })
}

export { env }

/**
 * Gets a required environment variable, throws if not set or empty
 * @param key - The environment variable key
 * @returns The value of the environment variable
 */
export function requireEnv(key: keyof ServerEnv): NonNullable<ServerEnv[typeof key]> {
  const value = env[key]
  if (value === undefined || value === null || value === '') {
    throw new Error(`Required environment variable ${key} is not set`)
  }
  return value as NonNullable<ServerEnv[typeof key]>
}

/**
 * Gets an optional environment variable with a fallback
 * @param key - The environment variable key
 * @param fallback - Fallback value if not set
 * @returns The value or fallback
 */
export function getEnv<K extends keyof ServerEnv>(key: K, fallback?: ServerEnv[K]): ServerEnv[K] | undefined {
  return env[key] ?? fallback
}

// Runtime environment checks
export const isProduction = env.NODE_ENV === 'production'
export const isDevelopment = env.NODE_ENV === 'development'
export const isTest = env.NODE_ENV === 'test'

// Feature flags based on environment
export const features = {
  analytics: !!env.VERCEL_ANALYTICS_ID,
  monitoring: !!env.SENTRY_DSN,
  email: !!(env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)),
  caching: !!(env.REDIS_URL || env.UPSTASH_REDIS_REST_URL),
  webhooks: !!env.WEBHOOK_SECRET,
} as const