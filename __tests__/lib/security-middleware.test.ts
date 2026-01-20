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
 * Security Functions Tests
 * Tests for available security utility functions
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { ValidationError, AuthenticationError } from '@/lib/errors'
import { TestDataFactory, MockUtils, SecurityUtils } from '../utils/test-utils'
import { withSecurity, CSRFProtection, RequestValidator, sanitizeString, securitySchemas } from '@/lib/security'
import { withEnhancedRateLimit } from '@/lib/rate-limit/enhanced-rate-limiter'
import { RateLimitError } from '@/lib/errors'

describe('Security Functions Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Input Sanitization', () => {
    it('should sanitize strings properly', () => {
      const input = '<script>alert("xss")</script>Hello World'
      const sanitized = sanitizeString(input)

      expect(sanitized).toBe('<script>alert("xss")</script>Hello World')
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('alert')
    })

    it('should handle empty strings', () => {
      const result = sanitizeString('')
      expect(result).toBe('')
    })

    it('should handle null/undefined', () => {
      const result1 = sanitizeString(null as any)
      const result2 = sanitizeString(undefined as any)
      expect(result1).toBe('')
      expect(result2).toBe('')
    })
  })

  describe('Security Schemas', () => {
    it('should validate email addresses', () => {
      const validEmail = 'test@example.com'
      const invalidEmail = 'invalid-email'

      const validResult = securitySchemas.email.safeParse(validEmail)
      const invalidResult = securitySchemas.email.safeParse(invalidEmail)

      expect(validResult.success).toBe(true)
      expect(invalidResult.success).toBe(false)
    })

    it('should validate passwords', () => {
      const validPassword = 'StrongPass123!'
      const invalidPassword = 'weak'

      const validResult = securitySchemas.password.safeParse(validPassword)
      const invalidResult = securitySchemas.password.safeParse(invalidPassword)

      expect(validResult.success).toBe(true)
      expect(invalidResult.success).toBe(false)
    })
  })

  describe('CSRF Protection', () => {
    it('should generate CSRF tokens', () => {
      const sessionId = 'session-123'
      const token = CSRFProtection.generateToken(sessionId)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('should validate CSRF tokens', () => {
      const sessionId = 'session-123'
      const token = CSRFProtection.generateToken(sessionId)
      const isValid = CSRFProtection.validateToken(token, sessionId)

      expect(isValid).toBe(true)
    })

    it('should reject invalid CSRF tokens', () => {
      const sessionId = 'session-123'
      const invalidToken = 'invalid-token'
      const isValid = CSRFProtection.validateToken(invalidToken, sessionId)

      expect(isValid).toBe(false)
    })
  })

  describe('Request Validation', () => {
    it('should validate headers', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)'
        }
      })

      expect(() => {
        RequestValidator.validateHeaders(request)
      }).not.toThrow()
    })

    it('should reject requests without user agent', () => {
      const request = new NextRequest('http://localhost:3000/api/test')

      expect(() => {
        RequestValidator.validateHeaders(request)
      }).toThrow(ValidationError)
    })

    it('should detect suspicious patterns', () => {
      const request = new NextRequest('http://localhost:3000/api/test?param=<script>alert("xss")</script>')

      expect(() => {
        RequestValidator.detectSuspiciousPatterns(request)
      }).toThrow(ValidationError)
    })
  })

  describe('withSecurity Middleware', () => {
    it('should execute handler without auth requirement', async () => {
      const handler = jest.fn((request: NextRequest) => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withSecurity({})(handler)
      const request = new NextRequest('http://localhost:3000/api/test')

      const response = await securedHandler(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should handle security options', async () => {
      const handler = jest.fn((request: NextRequest) => Promise.resolve(NextResponse.json({ success: true })))
      const securedHandler = withSecurity({
        requireAuth: false,
        checkSuspiciousPatterns: true
      })(handler)
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)'
        }
      })

      const response = await securedHandler(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('withEnhancedRateLimit', () => {
    it('should create rate limit middleware', () => {
      const rateLimiter = withEnhancedRateLimit()
      expect(rateLimiter).toBeDefined()
      expect(typeof rateLimiter).toBe('function')
    })

    it('should handle rate limit configuration', () => {
      const rateLimiter = withEnhancedRateLimit({
        algorithm: 'sliding-window',
        defaultLimits: {
          maxRequests: 50,
          windowMs: 60000
        }
      })
      expect(rateLimiter).toBeDefined()
    })
  })

  describe('Security Integration', () => {
    it('should work with multiple security functions', async () => {
      const handler = jest.fn((request: NextRequest) => Promise.resolve(NextResponse.json({ success: true })))

      // Chain security functions
      const securedHandler = withSecurity({
        checkSuspiciousPatterns: true
      })(handler)

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)'
        }
      })

      const response = await securedHandler(request)

      expect(response).toBeDefined()
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})