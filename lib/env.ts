import { z } from 'zod'

const envSchema = z.object({
  // Node.js Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Application URLs
  NEXT_PUBLIC_APP_URL: z.string().url(),
  
  // Supabase Configuration (Required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  
  // AI Services (Required)
  GEMINI_API_KEY: z.string().min(1),
  VAPI_API_KEY: z.string().min(1),
  
  // Optional Analytics
  VERCEL_ANALYTICS_ID: z.string().optional(),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  
  // Optional Email Service
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  WEBHOOK_SECRET: z.string().optional(),
  
  // Optional Redis/Caching
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  REDIS_URL: z.string().url().optional().or(z.literal('')),
  
  // Performance & Monitoring
  DATABASE_CONNECTION_LIMIT: z.coerce.number().default(20),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(false),
  HEALTH_CHECK_TOKEN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

class EnvValidationError extends Error {
  constructor(message: string, public errors: z.ZodError) {
    super(message)
    this.name = 'EnvValidationError'
  }
}

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env)
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
        errorMessage += ' Invalid: ' + invalidVars.join(', ')
      }
      
      errorMessage += ' Please check your .env file'
      
      throw new EnvValidationError(errorMessage, error)
    }
    throw error
  }
}

// Validate environment variables at module load time
let env: Env

try {
  env = validateEnv()
} catch (error) {
  if (process.env.NODE_ENV !== 'test') {
    console.error('❌ Environment validation failed')
    console.error(error instanceof EnvValidationError ? error.message : error)
    // Instead of process.exit(1), throw the error to be handled by Next.js
    throw new Error(`Environment validation failed: ${error instanceof EnvValidationError ? error.message : String(error)}`)
  }
  // In test environment, provide defaults
  env = envSchema.parse({
    NODE_ENV: 'test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    GEMINI_API_KEY: 'test-gemini-key',
    VAPI_API_KEY: 'test-vapi-key',
  })
}

export { env }

export function requireEnv(key: keyof Env): NonNullable<Env[typeof key]> {
  const value = env[key]
  if (value === undefined || value === null || value === '') {
    throw new Error(`Required environment variable ${key} is not set`)
  }
  return value as NonNullable<Env[typeof key]>
}

export function getEnv<K extends keyof Env>(key: K, fallback?: Env[K]): Env[K] | undefined {
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