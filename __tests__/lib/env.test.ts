import { env, requireEnv, getEnv, isProduction, isDevelopment, features } from '@/lib/env'

describe('Environment Configuration', () => {
  describe('env validation', () => {
    it('should have required environment variables in test mode', () => {
      expect(env.NODE_ENV).toBe('test')
      expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
      expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined()
      expect(env.GEMINI_API_KEY).toBeDefined()
      expect(env.VAPI_API_KEY).toBeDefined()
    })

    it('should correctly identify test environment', () => {
      expect(isProduction).toBe(false)
      expect(isDevelopment).toBe(false)
    })
  })

  describe('requireEnv function', () => {
    it('should return value for existing environment variable', () => {
      const result = requireEnv('NODE_ENV')
      expect(result).toBe('test')
    })

    it('should throw error for missing required environment variable', () => {
      expect(() => requireEnv('NONEXISTENT_VAR' as any)).toThrow()
    })
  })

  describe('getEnv function', () => {
    it('should return value for existing environment variable', () => {
      const result = getEnv('NODE_ENV')
      expect(result).toBe('test')
    })

    it('should return fallback for missing environment variable', () => {
      const result = getEnv('NONEXISTENT_VAR' as any, 'fallback')
      expect(result).toBe('fallback')
    })
  })

  describe('feature flags', () => {
    it('should have correct feature flags for test environment', () => {
      expect(typeof features.analytics).toBe('boolean')
      expect(typeof features.monitoring).toBe('boolean')
      expect(typeof features.email).toBe('boolean')
      expect(typeof features.caching).toBe('boolean')
      expect(typeof features.webhooks).toBe('boolean')
    })
  })
})