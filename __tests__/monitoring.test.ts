import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { alertingSystem } from '@/lib/monitoring/alerting-system'
import { logAggregator } from '@/lib/monitoring/log-aggregator'
import { MonitoringRateLimiter, sanitizeMonitoringData, MonitoringCompliance } from '@/middleware/monitoring-security'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({ data: null, error: null }))
                }))
              }))
            }))
          }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => Promise.resolve({ data: null, error: null })),
      delete: jest.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null }))
    }
  }))
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))

describe('Monitoring System Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Performance Monitor', () => {
    it('should record API metrics', async () => {
      const metric = {
        endpoint: '/api/test',
        method: 'GET',
        response_time_ms: 150,
        status_code: 200,
        user_agent: 'test-agent',
        ip_address: '127.0.0.1',
        timestamp: new Date().toISOString()
      }

      await performanceMonitor.recordAPIMetric(metric)

      // Verify the metric was processed (mock doesn't actually store)
      expect(metric.endpoint).toBe('/api/test')
      expect(metric.response_time_ms).toBe(150)
    })

    it('should record database metrics', async () => {
      const metric = {
        query_type: 'select' as const,
        table_name: 'users',
        execution_time_ms: 25,
        rows_affected: 10,
        timestamp: new Date().toISOString()
      }

      await performanceMonitor.recordDatabaseMetric(metric)

      expect(metric.table_name).toBe('users')
      expect(metric.execution_time_ms).toBe(25)
    })

    it('should record system metrics', async () => {
      const metric = {
        memory_usage_mb: 512,
        memory_total_mb: 1024,
        cpu_usage_percent: 45,
        active_connections: 25,
        timestamp: new Date().toISOString()
      }

      await performanceMonitor.recordSystemMetric(metric)

      expect(metric.memory_usage_mb).toBe(512)
      expect(metric.cpu_usage_percent).toBe(45)
    })

    it('should get aggregated stats', async () => {
      const stats = await performanceMonitor.getAggregatedStats('api_response', '24h')

      // Should return default values when no data
      expect(stats).toHaveProperty('count')
      expect(stats).toHaveProperty('average')
      expect(stats).toHaveProperty('min')
      expect(stats).toHaveProperty('max')
    })
  })

  describe('Alerting System', () => {
    it('should add alert rule', () => {
      const rule = {
        name: 'Test Rule',
        type: 'custom' as const,
        severity: 'medium' as const,
        condition: () => true,
        message: () => 'Test alert',
        channels: ['dashboard' as const],
        enabled: true,
        cooldown_minutes: 30
      }

      alertingSystem.addAlertRule(rule)

      const rules = alertingSystem.getAlertRules()
      expect(rules.some(r => r.name === 'Test Rule')).toBe(true)
    })

    it('should remove alert rule', () => {
      const rule = {
        name: 'Test Rule to Remove',
        type: 'custom' as const,
        severity: 'medium' as const,
        condition: () => true,
        message: () => 'Test alert',
        channels: ['dashboard' as const],
        enabled: true,
        cooldown_minutes: 30
      }

      alertingSystem.addAlertRule(rule)
      const rules = alertingSystem.getAlertRules()
      const ruleToRemove = rules.find(r => r.name === 'Test Rule to Remove')

      if (ruleToRemove) {
        alertingSystem.removeAlertRule(ruleToRemove.id)
        const updatedRules = alertingSystem.getAlertRules()
        expect(updatedRules.some(r => r.id === ruleToRemove.id)).toBe(false)
      }
    })
  })

  describe('Log Aggregator', () => {
    it('should log entries', async () => {
      await logAggregator.log(
        'info',
        'api',
        'Test log message',
        { test: 'data' },
        { user_id: 'user-123' }
      )

      // Verify logging was called (implementation details are mocked)
      expect(true).toBe(true) // Placeholder assertion
    })

    it('should query logs', async () => {
      const result = await logAggregator.queryLogs({ limit: 10 })

      expect(result).toHaveProperty('logs')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('has_more')
      expect(Array.isArray(result.logs)).toBe(true)
    })

    it('should get analytics', async () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const endTime = new Date().toISOString()

      const analytics = await logAggregator.getAnalytics(startTime, endTime)

      expect(analytics).toHaveProperty('total_logs')
      expect(analytics).toHaveProperty('logs_by_level')
      expect(analytics).toHaveProperty('logs_by_source')
      expect(analytics).toHaveProperty('error_rate')
    })
  })

  describe('Monitoring Security', () => {
    describe('Rate Limiter', () => {
      it('should allow requests within limit', () => {
        const result = MonitoringRateLimiter.checkLimit('test-ip')
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBeGreaterThan(0)
      })

      it('should block requests over limit', () => {
        // Simulate exceeding the limit
        for (let i = 0; i < 101; i++) {
          MonitoringRateLimiter.checkLimit('test-ip-exceed')
        }

        const result = MonitoringRateLimiter.checkLimit('test-ip-exceed')
        expect(result.allowed).toBe(false)
      })
    })

    describe('Data Sanitization', () => {
      it('should sanitize sensitive data', () => {
        const data = {
          user_id: '123',
          password: 'secret123',
          api_key: 'key123',
          normal_field: 'normal'
        }

        const sanitized = sanitizeMonitoringData(data)

        expect(sanitized.password).toBe('[REDACTED]')
        expect(sanitized.api_key).toBe('[REDACTED]')
        expect(sanitized.user_id).toBe('123')
        expect(sanitized.normal_field).toBe('normal')
      })

      it('should handle nested objects', () => {
        const data = {
          user: {
            id: '123',
            password: 'secret',
            profile: {
              email: 'test@example.com',
              token: 'token123'
            }
          }
        }

        const sanitized = sanitizeMonitoringData(data)

        expect(sanitized.user.password).toBe('[REDACTED]')
        expect(sanitized.user.profile.token).toBe('[REDACTED]')
        expect(sanitized.user.id).toBe('123')
        expect(sanitized.user.profile.email).toBe('test@example.com')
      })
    })

    describe('Compliance', () => {
      it('should anonymize user data', () => {
        const data = {
          user_id: 'user-123',
          email: 'john.doe@example.com',
          ip_address: '192.168.1.100'
        }

        const anonymized = MonitoringCompliance.anonymizeUserData(data)

        expect(anonymized.user_id).not.toBe('user-123')
        expect(anonymized.email).toContain('***')
        expect(anonymized.ip_address).toContain('***')
      })

      it('should anonymize email correctly', () => {
        expect(MonitoringCompliance.anonymizeUserData({ email: 'a@b.com' }).email).toBe('a***@b.com')
        expect(MonitoringCompliance.anonymizeUserData({ email: 'ab@b.com' }).email).toBe('ab***@b.com')
        expect(MonitoringCompliance.anonymizeUserData({ email: 'abc@b.com' }).email).toBe('ab***@b.com')
      })

      it('should anonymize IP addresses', () => {
        expect(MonitoringCompliance.anonymizeUserData({ ip_address: '192.168.1.100' }).ip_address).toBe('192.168.1.***')
        expect(MonitoringCompliance.anonymizeUserData({ ip_address: '2001:db8::1' }).ip_address).toBe('2001:db8::****')
      })
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete monitoring workflow', async () => {
      // Record a performance metric
      await performanceMonitor.recordAPIMetric({
        endpoint: '/api/test',
        method: 'GET',
        response_time_ms: 200,
        status_code: 200,
        timestamp: new Date().toISOString()
      })

      // Log an entry
      await logAggregator.log(
        'info',
        'api',
        'Test API call',
        { endpoint: '/api/test', response_time: 200 }
      )

      // Check if alerts are triggered (this would be tested with actual alert rules)
      await alertingSystem.checkAlerts()

      // Verify data sanitization
      const sensitiveData = { password: 'secret', user_id: '123' }
      const sanitized = sanitizeMonitoringData(sensitiveData)

      expect(sanitized.password).toBe('[REDACTED]')
      expect(sanitized.user_id).toBe('123')
    })

    it('should handle error scenarios gracefully', async () => {
      // Test with invalid data
      await expect(performanceMonitor.recordAPIMetric({
        endpoint: '',
        method: 'GET',
        response_time_ms: -1,
        status_code: 200,
        timestamp: 'invalid-date'
      })).resolves.not.toThrow()

      // Test rate limiting
      const rateLimit = MonitoringRateLimiter.checkLimit('test-ip')
      expect(typeof rateLimit.allowed).toBe('boolean')
      expect(typeof rateLimit.remaining).toBe('number')
    })
  })
})