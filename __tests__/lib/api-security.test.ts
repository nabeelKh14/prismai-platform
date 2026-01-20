jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn().mockImplementation((body: any, init?: any) => ({
      status: init?.status || 200,
      statusText: 'OK',
      headers: new Map(),
      body,
      json: jest.fn().mockImplementation(() => body),
    })),
    next: jest.fn(),
    redirect: jest.fn(),
  },
}))
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn().mockImplementation((body: any, init?: any) => ({
      status: init?.status || 200,
      statusText: 'OK',
      headers: new Map(),
      body,
      json: jest.fn().mockImplementation(() => body),
    })),
    next: jest.fn(),
    redirect: jest.fn(),
  },
}))
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn().mockImplementation((body: any, init?: any) => ({
      status: init?.status || 200,
      statusText: 'OK',
      headers: new Map(),
      body,
      json: jest.fn().mockImplementation(() => body),
    })),
    next: jest.fn(),
    redirect: jest.fn(),
  },
}))
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn().mockImplementation((body, init) => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        body,
        json: jest.fn().mockImplementation(() => body),
      }
      if (init && typeof init === 'object') {
        if (init.status) response.status = init.status
        Object.assign(response, init)
      }
      return response
    }),
    next: jest.fn(),
    redirect: jest.fn(),
  },
}))
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn().mockImplementation((body: any, init?: { status?: number; [key: string]: any }) => ({
      status: init?.status || 200,
      statusText: 'OK',
      headers: new Map(),
      body,
      json: jest.fn().mockImplementation(() => body),
      ...(init || {}),
    })),
    next: jest.fn(),
    redirect: jest.fn(),
  },
}))
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  json: jest.fn().mockImplementation((body, init) => ({
    status: init?.status || 200,
    statusText: 'OK',
    headers: new Map(),
    body,
    json: jest.fn().mockImplementation(() => body),
    ...(init || {}),
  })),
  NextResponse: {
    json: jest.fn().mockImplementation((body, init) => ({
      status: init?.status || 200,
      statusText: 'OK',
      headers: new Map(),
      body,
      json: jest.fn().mockImplementation(() => body),
      ...init,
    })),
    next: jest.fn(),
    redirect: jest.fn(),
  },
}))

/**
 * API Security Middleware Tests
 * Tests for the actual API security middleware implementation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import {
  withApiSecurity,
  apiSecurity,
  createSecureResponse,
  ApiSecurityConfig,
  ApiSecurityContext
} from '@/lib/api-security-middleware'
import { ValidationError, AuthenticationError } from '@/lib/errors'

// Mock external dependencies
jest.mock('@/lib/security', () => ({
  withSecurity: jest.fn((config: any) => (handler: any) => handler),
  RequestValidator: {
    validateHeaders: jest.fn(),
    validateRequestSize: jest.fn(),
    detectSuspiciousPatterns: jest.fn(),
    detectBotActivity: jest.fn()
  },
  securitySchemas: {
    email: { safeParse: jest.fn() },
    password: { safeParse: jest.fn() }
  }
}))

jest.mock('@/lib/rate-limit/api-keys', () => ({
  ApiKeyManager: {
    extractApiKey: jest.fn(() => 'test-api-key'),
    validateApiKey: jest.fn(() => ({ tier: 'free', userId: 'user-123' }))
  }
}))

jest.mock('@/lib/security-monitoring', () => ({
  securityMonitoring: {},
  logSecurityEvent: jest.fn(() => Promise.resolve())
}))

jest.mock('@/lib/security/database-security-manager', () => ({
  databaseSecurityManager: {
    checkAccessPermissions: jest.fn(() => ({ allowed: true, reason: null }))
  }
}))

jest.mock('@/lib/encryption/service', () => ({
  DatabaseEncryption: {
    encryptSensitiveFields: jest.fn(() => Promise.resolve({}))
  }
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    logSecurity: jest.fn(),
    error: jest.fn()
  }
}))

describe('API Security Middleware Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('withApiSecurity', () => {
    it('should allow basic requests', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withApiSecurity()
      const request = new NextRequest('http://localhost:3000/api/test')

      const response = await securedHandler(handler)(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalled()
    })

    it('should handle API key authentication', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withApiSecurity({ requireApiKey: true })
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-api-key': 'test-api-key'
        }
      })

      const response = await securedHandler(handler)(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalled()
    })

    it('should reject requests without required API key', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withApiSecurity({ requireApiKey: true })
      const request = new NextRequest('http://localhost:3000/api/test')

      await expect(securedHandler(handler)(request)).rejects.toThrow(AuthenticationError)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should validate input with schema', async () => {
      const validationSchema = {
        safeParse: jest.fn(() => ({ success: true, data: { name: 'test' } }))
      }

      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withApiSecurity({ validateInput: validationSchema as any })
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' })
      })

      const response = await securedHandler(handler)(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalled()
    })

    it('should reject invalid input', async () => {
      const validationSchema = {
        safeParse: jest.fn(() => ({
          success: false,
          error: { errors: [{ message: 'Invalid input' }] }
        }))
      }

      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withApiSecurity({ validateInput: validationSchema as any })
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' })
      })

      await expect(securedHandler(handler)(request)).rejects.toThrow(ValidationError)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('apiSecurity Presets', () => {
    it('should configure public API security', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = apiSecurity.public()
      const request = new NextRequest('http://localhost:3000/api/test')

      const response = await securedHandler(handler)(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalled()
    })

    it('should configure protected API security', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = apiSecurity.protected()
      const request = new NextRequest('http://localhost:3000/api/test')

      const response = await securedHandler(handler)(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalled()
    })

    it('should configure API key security', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = apiSecurity.apiKey()
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-api-key': 'test-api-key'
        }
      })

      const response = await securedHandler(handler)(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalled()
    })

    it('should configure high security', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = apiSecurity.highSecurity()
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-api-key': 'test-api-key'
        }
      })

      const response = await securedHandler(handler)(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('createSecureResponse', () => {
    it('should create response with security headers', () => {
      const securityContext: ApiSecurityContext = {
        requestId: 'test-request-123',
        securityEvents: ['input_validation_passed'],
        validationErrors: [],
        encryptedFields: [],
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      }

      const response = createSecureResponse({ success: true }, 200, securityContext)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.headers.get('X-Request-ID')).toBe('test-request-123')
      expect(response.headers.get('X-Security-Events')).toBe('1')
      expect(response.headers.get('X-Validation-Errors')).toBe('0')
      expect(response.headers.get('X-Encrypted-Fields')).toBe('0')
    })

    it('should handle encrypted fields', () => {
      const securityContext: ApiSecurityContext = {
        requestId: 'test-request-123',
        securityEvents: [],
        validationErrors: [],
        encryptedFields: ['password', 'token'],
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      }

      const response = createSecureResponse({ success: true }, 200, securityContext)

      expect(response.headers.get('X-Encrypted-Fields')).toBe('2')
      expect(response.headers.get('X-Encrypted-Fields-List')).toBe('password,token')
    })
  })

  describe('Security Integration Tests', () => {
    it('should handle complete security workflow', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withApiSecurity({
        requireApiKey: true,
        validateInput: {
          safeParse: jest.fn(() => ({ success: true, data: { name: 'test' } }))
        } as any,
        logSecurityEvents: true
      })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-api-key': 'test-api-key'
        },
        body: JSON.stringify({ name: 'test' })
      })

      const response = await securedHandler(handler)(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalled()
    })

    it('should handle security failures gracefully', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withApiSecurity({
        requireApiKey: true,
        validateInput: {
          safeParse: jest.fn(() => ({
            success: false,
            error: { errors: [{ message: 'Invalid input' }] }
          }))
        } as any
      })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-api-key': 'test-api-key'
        },
        body: JSON.stringify({ invalid: 'data' })
      })

      await expect(securedHandler(handler)(request)).rejects.toThrow(ValidationError)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle SQL injection protection', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withApiSecurity({
        enableSQLInjectionProtection: true
      })

      const request = new NextRequest('http://localhost:3000/api/test?query=SELECT * FROM users')

      await expect(securedHandler(handler)(request)).rejects.toThrow(ValidationError)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle XSS protection', async () => {
      const handler = jest.fn(() => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withApiSecurity({
        enableXSSProtection: true
      })

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ data: '<script>alert("xss")</script>' })
      })

      await expect(securedHandler(handler)(request)).rejects.toThrow(ValidationError)
      expect(handler).not.toHaveBeenCalled()
    })
  })
})