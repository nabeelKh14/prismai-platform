describe('Environment Validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv } as any
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should validate successfully with all required environment variables', async () => {
    (process.env as any).NODE_ENV = 'development'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    process.env.VAPI_API_KEY = 'test-vapi-key'
    process.env.SENTRY_DSN = ''
    process.env.UPSTASH_REDIS_REST_URL = ''
    process.env.REDIS_URL = ''

    const { validateEnvSafe } = await import('../../lib/env')
    const result = validateEnvSafe()
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development')
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000')
    }
  })

  it('should fail validation when required variables are missing', async () => {
    (process.env as any).NODE_ENV = 'development'
    // Missing required vars like SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, etc.

    const { validateEnvSafe } = await import('../../lib/env')
    const result = validateEnvSafe()
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Environment validation failed')
      expect(result.error).toContain('Missing:')
    }
  })
})