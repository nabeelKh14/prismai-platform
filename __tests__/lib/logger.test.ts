import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { withRequestLogging, PerformanceMonitor } from '@/lib/logger'
import { logger } from '@/lib/logger'

// Mock environment
jest.mock('@/lib/env', () => ({
  getEnv: jest.fn((key: string) => {
    const envVars: Record<string, string> = {
      'LOG_LEVEL': 'debug',
      'ENABLE_REQUEST_LOGGING': 'true',
      'ENABLE_AUDIT_LOGGING': 'true',
      'ENABLE_DATABASE_LOGGING': 'false'
    }
    return envVars[key] || ''
  }),
  isProduction: false
}))

// Mock the logger module to get a fresh instance
jest.mock('@/lib/logger', () => {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      logWithCorrelation: jest.fn(),
      logUserAction: jest.fn(),
      logSecurityEvent: jest.fn(),
      logAPICall: jest.fn(),
      logDatabaseOperation: jest.fn(),
      logSecurity: jest.fn(),
      logAuditTrail: jest.fn()
    },
    withRequestLogging: jest.fn(),
    PerformanceMonitor: {
      start: jest.fn(() => 'test-timer'),
      end: jest.fn(() => 100),
      measure: jest.fn(async (name: string, fn: () => Promise<any>) => await fn())
    }
  }
})

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
}))

// Mock fetch for external logging
const mockResponse = {
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
  blob: () => Promise.resolve(new Blob()),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  formData: () => Promise.resolve(new FormData()),
  clone: () => mockResponse,
  body: null,
  bodyUsed: false,
  redirected: false,
  type: 'basic' as ResponseType,
  url: '',
  bytes: () => Promise.resolve(new Uint8Array())
}

global.fetch = jest.fn(() => Promise.resolve(mockResponse))

describe('Logger System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock console methods
    jest.spyOn(console, 'debug').mockImplementation(() => {})
    jest.spyOn(console, 'info').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Basic logging functionality', () => {
    it('should log debug messages', async () => {
      await logger.debug('Debug message', { key: 'value' })
      expect(console.debug).toHaveBeenCalled()
    })

    it('should log info messages', async () => {
      await logger.info('Info message', { key: 'value' })
      expect(console.info).toHaveBeenCalled()
    })

    it('should log warning messages', async () => {
      await logger.warn('Warning message', { key: 'value' })
      expect(console.warn).toHaveBeenCalled()
    })

    it('should log error messages', async () => {
      const error = new Error('Test error')
      await logger.error('Error message', error, { key: 'value' })
      expect(console.error).toHaveBeenCalled()
    })

    it('should handle error objects in context', async () => {
      const error = new Error('Test error')
      await logger.error('Error message', { error }, { key: 'value' })
      expect(console.error).toHaveBeenCalled()
    })

    it('should respect log levels', async () => {
      // Mock a higher log level
      const originalLogLevel = (logger as any).logLevel
      ;(logger as any).logLevel = 'warn'

      await logger.debug('This should not log')
      await logger.info('This should not log')
      await logger.warn('This should log')

      expect(console.debug).not.toHaveBeenCalled()
      expect(console.info).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalled()

      // Restore
      ;(logger as any).logLevel = originalLogLevel
    })
  })

  describe('Advanced logging features', () => {
    it('should log with correlation ID', async () => {
      const correlationId = 'test-correlation-123'
      await logger.logWithCorrelation('info', 'Test message', correlationId, { key: 'value' })
      expect(console.info).toHaveBeenCalled()
    })

    it('should log user actions', async () => {
      await logger.logUserAction('CREATE', 'user-123', 'user', 'user-456', { name: 'John' })
      expect(console.info).toHaveBeenCalled()
    })

    it('should log security events', async () => {
      await logger.logSecurityEvent('LOGIN_ATTEMPT', 'medium', 'user-123', { ip: '192.168.1.1' })
      expect(console.warn).toHaveBeenCalled()
    })

    it('should log API calls', () => {
      logger.logAPICall('stripe', '/api/charge', true, 150, undefined)
      expect(console.info).toHaveBeenCalled()
    })

    it('should log database operations', () => {
      logger.logDatabaseOperation('SELECT', 'users', true, 25, undefined)
      expect(console.debug).toHaveBeenCalled()
    })

    it('should log security events', () => {
      logger.logSecurity('SUSPICIOUS_ACTIVITY', 'user-123', { reason: 'multiple failed logins' })
      expect(console.warn).toHaveBeenCalled()
    })
  })

  describe('Utility functions', () => {
    it('should generate correlation IDs', () => {
      const correlationId = logger.constructor.prototype.constructor.generateCorrelationId()
      expect(correlationId).toMatch(/^corr_\d+_[a-z0-9]+$/)
    })

    it('should generate request IDs', () => {
      const requestId = logger.constructor.prototype.constructor.generateRequestId()
      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/)
    })
  })

  describe('Request logging middleware', () => {
    it('should log successful requests', async () => {
      const mockHandler = jest.fn(async () => ({ status: 200 }))

      const wrappedHandler = withRequestLogging(mockHandler, {
        operation: 'test-operation',
        userId: 'user-123'
      })

      const mockRequest = {
        method: 'GET',
        url: '/api/test',
        headers: {
          get: jest.fn((key: string) => {
            if (key === 'user-agent') return 'test-agent'
            return null
          })
        },
        ip: '127.0.0.1'
      }

      await wrappedHandler()

      expect(mockHandler).toHaveBeenCalled()
      expect(console.info).toHaveBeenCalledTimes(2) // Start and completion
    })

    it('should log failed requests', async () => {
      const mockHandler = jest.fn(async () => {
        throw new Error('Handler failed')
      })

      const wrappedHandler = withRequestLogging(mockHandler, {
        operation: 'test-operation'
      })

      const mockRequest = {
        method: 'POST',
        url: '/api/test',
        headers: { get: jest.fn(() => 'test-agent') },
        ip: '127.0.0.1'
      }

      await expect(wrappedHandler()).rejects.toThrow('Handler failed')
      expect(console.error).toHaveBeenCalled()
    })

    it('should handle different HTTP status codes', async () => {
      const mockHandler = jest.fn(async () => ({ status: 404 }))

      const wrappedHandler = withRequestLogging(mockHandler)

      const mockRequest = {
        method: 'GET',
        url: '/api/not-found',
        headers: { get: jest.fn(() => 'test-agent') },
        ip: '127.0.0.1'
      }

      await wrappedHandler()

      expect(console.warn).toHaveBeenCalled()
    })
  })

  describe('Performance monitoring', () => {
    it('should start and end performance timers', () => {
      const timerId = PerformanceMonitor.start('test-operation')
      expect(timerId).toMatch(/^test-operation-\d+-[0-9.]+$/)

      const duration = PerformanceMonitor.end(timerId, 'test-operation')
      expect(typeof duration).toBe('number')
      expect(duration).toBeGreaterThanOrEqual(0)
    })

    it('should handle missing timers', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const duration = PerformanceMonitor.end('non-existent-timer')
      expect(duration).toBe(0)
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should measure async operations', async () => {
      const result = await PerformanceMonitor.measure('test-measure', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'test-result'
      })

      expect(result).toBe('test-result')
    })

    it('should handle errors in measured operations', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      await expect(PerformanceMonitor.measure('error-test', async () => {
        throw new Error('Test error')
      })).rejects.toThrow('Test error')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('Audit trail logging', () => {
    it('should log audit trail entries', async () => {
      const auditEntry = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        action: 'CREATE',
        resourceType: 'user',
        resourceId: 'user-789',
        method: 'POST',
        endpoint: '/api/users',
        oldValues: {},
        newValues: { name: 'John Doe' },
        metadata: { source: 'admin-panel' },
        success: true,
        duration: 150,
        riskLevel: 'low' as const,
        complianceFlags: ['GDPR']
      }

      await logger.logAuditTrail(auditEntry)
      expect(console.info).toHaveBeenCalled()
    })

    it('should handle audit trail failures', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const auditEntry = {
        userId: 'user-123',
        action: 'DELETE',
        resourceType: 'user',
        success: false,
        errorMessage: 'Permission denied'
      }

      await logger.logAuditTrail(auditEntry)
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('Integration tests', () => {
    it('should handle complex logging scenarios', async () => {
      const correlationId = logger.constructor.prototype.constructor.generateCorrelationId()
      const requestId = logger.constructor.prototype.constructor.generateRequestId()

      // Log with full context
      await logger.logWithCorrelation(
        'info',
        'Complex operation started',
        correlationId,
        {
          operation: 'user-creation',
          metadata: { source: 'api' }
        },
        {
          userId: 'user-123',
          requestId,
          tenantId: 'tenant-456',
          tags: ['user-management', 'create'],
          source: 'api'
        }
      )

      // Log user action
      await logger.logUserAction(
        'CREATE_USER',
        'user-123',
        'user',
        'user-456',
        { email: 'john@example.com' },
        {
          riskLevel: 'low',
          complianceFlags: ['GDPR', 'SOX'],
          correlationId
        }
      )

      // Log security event
      await logger.logSecurityEvent(
        'USER_CREATED',
        'low',
        'user-123',
        { newUserId: 'user-456' },
        { correlationId }
      )

      expect(console.info).toHaveBeenCalledTimes(3)
    })

    it('should handle performance monitoring with logging', async () => {
      const timerId = PerformanceMonitor.start('database-query')

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 5))

      const duration = PerformanceMonitor.end(timerId, 'database-query')

      await logger.debug('Database query completed', {
        operation: 'database-query',
        duration
      })

      expect(duration).toBeGreaterThan(0)
      expect(console.debug).toHaveBeenCalled()
    })
  })
})