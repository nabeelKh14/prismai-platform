import { NextRequest } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { ValidationError, AuthenticationError } from '@/lib/errors'
import { createHash, timingSafeEqual } from 'crypto'

// Input sanitization
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>\"'&]/g, (char) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      }
      return entities[char] || char
    })
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[^\\d+\\-\\s()]/g, '').trim()
}

// Enhanced input sanitization with comprehensive XSS protection
export function sanitizeStringAdvanced(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    .trim()
    // Remove null bytes and control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // HTML entity encoding
    .replace(/[<>\"'&]/g, (char) => {
      const entities: Record<string, string> = {
        '<': '<',
        '>': '>',
        '"': '"',
        "'": '&#x27;',
        '&': '&',
      }
      return entities[char] || char
    })
    // Remove potentially dangerous patterns
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Remove script tags and their content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, '')
}

// Advanced XSS sanitization using DOMPurify-like approach
export function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') return ''

  // Remove all HTML tags except allowed ones
  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote']
  const allowedAttributes = ['href', 'target', 'rel']

  return input
    .replace(/<[^>]*>/g, (tag) => {
      const tagName = tag.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/)?.[1]?.toLowerCase()
      if (!tagName || !allowedTags.includes(tagName)) {
        return ''
      }

      // For links, only allow safe attributes
      if (tagName === 'a') {
        const href = tag.match(/href=["']([^"']*)["']/)?.[1]
        if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))) {
          return tag.replace(/<a([^>]*)>/, `<a$1 rel="noopener noreferrer" target="_blank">`)
        }
        return ''
      }

      return tag
    })
}

// SQL injection prevention
export function sanitizeSQLInput(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    .replace(/'/g, "''") // Escape single quotes for SQL
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/gi, '') // Remove dangerous SQL keywords
}

// File path sanitization to prevent directory traversal
export function sanitizeFilePath(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    .replace(/\.\./g, '') // Remove directory traversal attempts
    .replace(/[<>:"|?*]/g, '') // Remove invalid file characters
    .replace(/^\//, '') // Remove leading slashes
    .replace(/^\\+/, '') // Remove leading backslashes
    .trim()
}

// JSON input validation and sanitization
export function sanitizeJSONInput(input: string): string {
  if (typeof input !== 'string') return '{}'

  try {
    // Parse and stringify to validate JSON structure
    const parsed = JSON.parse(input)
    return JSON.stringify(parsed)
  } catch {
    // If invalid JSON, return empty object
    return '{}'
  }
}

// Strong validation schemas
export const securitySchemas = {
  email: z.string()
    .email('Invalid email address')
    .min(3, 'Email too short')
    .max(254, 'Email too long')
    .refine(email => !email.includes('..'), 'Invalid email format')
    .transform(sanitizeEmail),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number, and special character'),
  
  phoneNumber: z.string()
    .regex(/^\\+?[1-9]\\d{1,14}$/, 'Invalid phone number format')
    .transform(sanitizePhoneNumber),
  
  businessName: z.string()
    .min(1, 'Business name is required')
    .max(100, 'Business name too long')
    .regex(/^[a-zA-Z0-9\s\-&.,()]+$/, 'Business name contains invalid characters')
    .transform(sanitizeString),
  
  message: z.string()
    .max(1000, 'Message too long')
    .transform(sanitizeString),
  
  uuid: z.string().uuid('Invalid ID format'),
  
  url: z.string().url('Invalid URL format').max(2048, 'URL too long'),

  // Enhanced validation schemas
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username contains invalid characters')
    .transform(sanitizeString),

  apiKey: z.string()
    .min(20, 'API key too short')
    .max(100, 'API key too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'API key contains invalid characters'),

  ipAddress: z.string()
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IP address format')
    .refine(ip => {
      const parts = ip.split('.')
      return parts.every(part => {
        const num = parseInt(part)
        return num >= 0 && num <= 255
      })
    }, 'Invalid IP address range'),

  creditCard: z.string()
    .regex(/^\d{13,19}$/, 'Invalid credit card number format')
    .refine(cc => {
      // Luhn algorithm validation
      const digits = cc.split('').map(Number)
      for (let i = digits.length - 2; i >= 0; i -= 2) {
        digits[i] *= 2
        if (digits[i] > 9) digits[i] -= 9
      }
      return digits.reduce((sum, digit) => sum + digit, 0) % 10 === 0
    }, 'Invalid credit card number'),

  fileName: z.string()
    .min(1, 'File name is required')
    .max(255, 'File name too long')
    .regex(/^[^<>:"/\\|?*\x00-\x1f]+$/, 'File name contains invalid characters')
    .transform(sanitizeFilePath),

  jsonData: z.string()
    .max(1048576, 'JSON data too large') // 1MB limit
    .refine(data => {
      try {
        JSON.parse(data)
        return true
      } catch {
        return false
      }
    }, 'Invalid JSON format')
    .transform(sanitizeJSONInput),

  sqlQuery: z.string()
    .max(10000, 'SQL query too long')
    .refine(query => {
      // Basic SQL injection detection
      const dangerous = /\b(drop|delete|truncate|alter|create|insert|update)\b/i
      return !dangerous.test(query)
    }, 'Potentially dangerous SQL query')
    .transform(sanitizeSQLInput),
}

// CSRF protection
export class CSRFProtection {
  private static secret = process.env.CSRF_SECRET || 'default-csrf-secret'
  
  static generateToken(sessionId: string): string {
    const timestamp = Date.now().toString()
    const data = `${sessionId}:${timestamp}`
    const signature = createHash('sha256')
      .update(data + this.secret)
      .digest('hex')
    
    return Buffer.from(`${data}:${signature}`).toString('base64')
  }
  
  static validateToken(token: string, sessionId: string, maxAge = 3600000): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [session, timestamp, signature] = decoded.split(':')
      
      if (session !== sessionId) return false
      
      const now = Date.now()
      const tokenTime = parseInt(timestamp)
      if (now - tokenTime > maxAge) return false
      
      const expectedData = `${session}:${timestamp}`
      const expectedSignature = createHash('sha256')
        .update(expectedData + this.secret)
        .digest('hex')
      
      return timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    } catch {
      return false
    }
  }

  // Enhanced CSRF protection with double-submit cookie pattern
  static generateDoubleSubmitToken(sessionId: string): { token: string; cookieValue: string } {
    const token = this.generateToken(sessionId)
    const cookieValue = createHash('sha256')
      .update(token + process.env.CSRF_SECRET)
      .digest('hex')

    return { token, cookieValue }
  }

  static validateDoubleSubmitToken(token: string, cookieValue: string, sessionId: string): boolean {
    try {
      // First validate the token normally
      if (!this.validateToken(token, sessionId)) {
        return false
      }

      // Then validate against the cookie
      const expectedCookieValue = createHash('sha256')
        .update(token + this.secret)
        .digest('hex')

      return timingSafeEqual(
        Buffer.from(cookieValue, 'hex'),
        Buffer.from(expectedCookieValue, 'hex')
      )
    } catch {
      return false
    }
  }

  // CSRF protection for forms
  static generateCSRFTokenForForm(sessionId: string): string {
    const timestamp = Date.now().toString()
    const random = createHash('sha256').update(Math.random().toString()).digest('hex').substring(0, 32)
    const data = `${sessionId}:${timestamp}:${random}`

    const signature = createHash('sha256')
      .update(data + this.secret)
      .digest('hex')

    return Buffer.from(`${data}:${signature}`).toString('base64')
  }

  static validateCSRFTokenForForm(token: string, sessionId: string, maxAge = 3600000): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [session, timestamp, random, signature] = decoded.split(':')

      if (session !== sessionId) return false

      const now = Date.now()
      const tokenTime = parseInt(timestamp)
      if (now - tokenTime > maxAge) return false

      const expectedData = `${session}:${timestamp}:${random}`
      const expectedSignature = createHash('sha256')
        .update(expectedData + this.secret)
        .digest('hex')

      return timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    } catch {
      return false
    }
  }
}

// Request validation and security checks
export class RequestValidator {
  static validateHeaders(request: NextRequest): void {
    const userAgent = request.headers.get('user-agent')
    const contentType = request.headers.get('content-type')
    
    // Block requests without user agent (likely bots)
    if (!userAgent || userAgent.length < 10) {
      logger.logSecurity('Suspicious request: missing or short user agent', undefined, {
        userAgent,
        ip: request.headers.get('x-forwarded-for'),
        url: request.nextUrl.pathname,
      })
      throw new ValidationError('Invalid request headers')
    }
    
    // Validate content type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && contentType) {
      const allowedTypes = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data']
      const isValidType = allowedTypes.some(type => contentType.includes(type))
      
      if (!isValidType) {
        logger.logSecurity('Invalid content type', undefined, {
          contentType,
          method: request.method,
          url: request.nextUrl.pathname,
        })
        throw new ValidationError('Invalid content type')
      }
    }
  }
  
  static validateRequestSize(request: NextRequest, maxSize = 1024 * 1024): void {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > maxSize) {
      logger.logSecurity('Request too large', undefined, {
        contentLength: parseInt(contentLength),
        maxSize,
        url: request.nextUrl.pathname,
      })
      throw new ValidationError('Request payload too large')
    }
  }
  
  static detectSuspiciousPatterns(request: NextRequest): void {
    const url = request.nextUrl.pathname + request.nextUrl.search
    const body = request.body ? JSON.stringify(request.body) : ''
    const headers = Array.from(request.headers.entries()).map(([k, v]) => `${k}: ${v}`).join('\n')

    const suspiciousPatterns = [
      /\.\.\//, // Path traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection
      /exec\s*\(/i, // Code injection
      /eval\s*\(/i, // Code injection
      /%3C%73%63%72%69%70%74/i, // URL encoded XSS
      /javascript:/i, // JavaScript URLs
      /vbscript:/i, // VBScript URLs
      /data:/i, // Data URLs (potentially dangerous)
      /<iframe/i, // iframe injection
      /<object/i, // object injection
      /<embed/i, // embed injection
      /\b(alert|confirm|prompt)\s*\(/i, // JavaScript alerts
      /\bdocument\./i, // DOM manipulation
      /\bwindow\./i, // Window object access
    ]

    const allContent = [url, body, headers].join(' ')

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(allContent)) {
        logger.logSecurity('Suspicious pattern detected', undefined, {
          pattern: pattern.source,
          url,
          ip: request.headers.get('x-forwarded-for'),
          userAgent: request.headers.get('user-agent'),
        })
        throw new ValidationError('Suspicious request pattern detected')
      }
    }
  }

  // Rate limiting validation
  static validateRateLimit(request: NextRequest, maxRequests = 100, windowMs = 60000): void {
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    // Simple in-memory rate limiting (in production, use Redis or similar)
    const key = `rate_limit_${clientIP}_${request.method}_${request.nextUrl.pathname}`
    const now = Date.now()

    // Type-safe global store
    const globalAny = global as any
    if (!globalAny.rateLimitStore) {
      globalAny.rateLimitStore = new Map<string, { count: number; resetTime: number }>()
    }

    const store = globalAny.rateLimitStore as Map<string, { count: number; resetTime: number }>

    if (!store.has(key)) {
      store.set(key, { count: 1, resetTime: now + windowMs })
    } else {
      const data = store.get(key)!
      if (now > data.resetTime) {
        data.count = 1
        data.resetTime = now + windowMs
      } else if (data.count >= maxRequests) {
        logger.logSecurity('Rate limit exceeded', undefined, {
          ip: clientIP,
          method: request.method,
          url: request.nextUrl.pathname,
          count: data.count
        })
        throw new ValidationError('Rate limit exceeded')
      } else {
        data.count++
      }
    }
  }

  // Bot detection
  static detectBotActivity(request: NextRequest): void {
    const userAgent = request.headers.get('user-agent') || ''
    const accept = request.headers.get('accept') || ''
    const acceptLanguage = request.headers.get('accept-language') || ''

    // Common bot indicators
    const botIndicators = [
      userAgent.toLowerCase().includes('bot'),
      userAgent.toLowerCase().includes('crawler'),
      userAgent.toLowerCase().includes('spider'),
      userAgent === '', // No user agent
      accept === '', // No accept header
      acceptLanguage === '', // No language preference
      userAgent.length < 10, // Suspiciously short user agent
    ]

    if (botIndicators.some(indicator => indicator)) {
      logger.logSecurity('Bot activity detected', undefined, {
        userAgent,
        accept,
        acceptLanguage,
        ip: request.headers.get('x-forwarded-for'),
        url: request.nextUrl.pathname,
      })
      throw new ValidationError('Bot activity detected')
    }
  }

  // Request origin validation
  static validateOrigin(request: NextRequest, allowedOrigins: string[] = []): void {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')

    if (!origin && !referer) {
      // Allow requests without origin (e.g., mobile apps, Postman)
      return
    }

    const source = origin || referer
    if (source) {
      try {
        const url = new URL(source)
        const isAllowed = allowedOrigins.some(allowed => {
          if (allowed === '*') return true
          return url.origin === allowed || url.hostname === allowed
        })

        if (!isAllowed) {
          logger.logSecurity('Invalid request origin', undefined, {
            origin,
            referer,
            ip: request.headers.get('x-forwarded-for'),
            url: request.nextUrl.pathname,
          })
          throw new ValidationError('Invalid request origin')
        }
      } catch {
        logger.logSecurity('Malformed origin header', undefined, {
          origin,
          referer,
          ip: request.headers.get('x-forwarded-for'),
        })
        throw new ValidationError('Malformed origin header')
      }
    }
  }
}

// Authentication utilities
export class AuthSecurity {
  static async hashPassword(password: string): Promise<string> {
    const { hash } = await import('bcryptjs')
    return hash(password, 12)
  }
  
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const { compare } = await import('bcryptjs')
    return compare(password, hashedPassword)
  }
  
  static generateSecureToken(length = 32): string {
    const { randomBytes } = require('crypto')
    return randomBytes(length).toString('hex')
  }
  
  static validateJWT(token: string): any {
    try {
      // In a real implementation, use a proper JWT library
      const parts = token.split('.')
      if (parts.length !== 3) throw new Error('Invalid JWT format')
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      
      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new AuthenticationError('Token expired')
      }
      
      return payload
    } catch (error) {
      throw new AuthenticationError('Invalid token')
    }
  }
}

// Enhanced security middleware wrapper
export function withSecurity(options: {
  requireAuth?: boolean
  validateCSRF?: boolean
  maxRequestSize?: number
  checkSuspiciousPatterns?: boolean
  enableRateLimiting?: boolean
  detectBots?: boolean
  validateOrigin?: string[]
  enableSecurityHeaders?: boolean
} = {}) {
  return function <T extends any[], R>(
    handler: (request: NextRequest, ...args: T) => Promise<R>
  ) {
    return async (request: NextRequest, ...args: T): Promise<R> => {
      try {
        // Basic request validation
        RequestValidator.validateHeaders(request)

        if (options.maxRequestSize) {
          RequestValidator.validateRequestSize(request, options.maxRequestSize)
        }

        if (options.checkSuspiciousPatterns !== false) {
          RequestValidator.detectSuspiciousPatterns(request)
        }

        // Rate limiting
        if (options.enableRateLimiting) {
          RequestValidator.validateRateLimit(request)
        }

        // Bot detection
        if (options.detectBots) {
          RequestValidator.detectBotActivity(request)
        }

        // Origin validation
        if (options.validateOrigin && options.validateOrigin.length > 0) {
          RequestValidator.validateOrigin(request, options.validateOrigin)
        }

        // CSRF validation for state-changing operations
        if (options.validateCSRF && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
          const csrfToken = request.headers.get('x-csrf-token')
          const csrfCookie = request.cookies.get('csrf_token')?.value
          const sessionId = request.headers.get('x-session-id')

          let csrfValid = false

          if (csrfToken && sessionId) {
            // Try standard CSRF validation first
            csrfValid = CSRFProtection.validateToken(csrfToken, sessionId)

            // If that fails, try double-submit cookie validation
            if (!csrfValid && csrfCookie) {
              csrfValid = CSRFProtection.validateDoubleSubmitToken(csrfToken, csrfCookie, sessionId)
            }
          }

          if (!csrfValid) {
            logger.logSecurity('CSRF validation failed', undefined, {
              hasToken: !!csrfToken,
              hasCookie: !!csrfCookie,
              hasSession: !!sessionId,
              method: request.method,
              url: request.nextUrl.pathname,
            })
            throw new ValidationError('CSRF validation failed')
          }
        }

        // Authentication check
        if (options.requireAuth) {
          const authHeader = request.headers.get('authorization')
          if (!authHeader?.startsWith('Bearer ')) {
            throw new AuthenticationError('Missing or invalid authorization header')
          }

          const token = authHeader.substring(7)
          const payload = AuthSecurity.validateJWT(token)

          // Add user info to request (if using a custom request type)
          ;(request as any).user = payload
        }

        // Apply security headers to response
        const result = await handler(request, ...args)

        // Apply security headers if enabled
        if (options.enableSecurityHeaders && result && typeof result === 'object' && 'headers' in result) {
          const responseWithHeaders = result as any
          const headers = buildSecurityHeaders()

          // Apply critical security headers
          responseWithHeaders.headers.set('X-Frame-Options', headers['X-Frame-Options'])
          responseWithHeaders.headers.set('X-Content-Type-Options', headers['X-Content-Type-Options'])
          responseWithHeaders.headers.set('X-XSS-Protection', headers['X-XSS-Protection'])
          responseWithHeaders.headers.set('Referrer-Policy', headers['Referrer-Policy'])
          responseWithHeaders.headers.set('Content-Security-Policy', headers['Content-Security-Policy'])
        }

        return result
      } catch (error) {
        // Log security-related errors
        if (error instanceof ValidationError || error instanceof AuthenticationError) {
          logger.logSecurity('Security validation failed', undefined, {
            error: error.message,
            method: request.method,
            url: request.nextUrl.pathname,
            ip: request.headers.get('x-forwarded-for'),
            userAgent: request.headers.get('user-agent'),
          })
        }
        throw error
      }
    }
  }
}

// Content Security Policy helpers
export function generateCSPNonce(): string {
  const { randomBytes } = require('crypto')
  return randomBytes(16).toString('base64')
}

export function buildCSPHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://generativelanguage.googleapis.com https://api.vapi.ai wss://api.vapi.ai",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
    "require-sri-for script style",
  ]

  return directives.join('; ')
}

// Comprehensive security headers
export function buildSecurityHeaders(nonce?: string): Record<string, string> {
  const headers: Record<string, string> = {
    // Content Security Policy
    'Content-Security-Policy': nonce ? buildCSPHeader(nonce) : buildCSPHeader(''),

    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',

    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions Policy (formerly Feature Policy)
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
      'speaker=()',
      'fullscreen=(self)',
      'ambient-light-sensor=()',
      'autoplay=(self)',
      'encrypted-media=(self)',
      'picture-in-picture=()',
    ].join(', '),

    // HSTS (HTTP Strict Transport Security)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

    // Cross-Origin policies
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',

    // Remove server information
    'X-Powered-By': '',

    // Cache control for sensitive content
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }

  return headers
}

// Security headers middleware
export function withSecurityHeaders(options: {
  enableCSP?: boolean
  enableHSTS?: boolean
  enablePermissionsPolicy?: boolean
  customHeaders?: Record<string, string>
} = {}) {
  return function <T extends any[], R>(
    handler: (request: NextRequest, ...args: T) => Promise<R>
  ) {
    return async (request: NextRequest, ...args: T): Promise<R> => {
      try {
        const response = await handler(request, ...args)

        // Apply security headers to response
        if (response && typeof response === 'object' && 'headers' in response) {
          const responseWithHeaders = response as any
          const headers = buildSecurityHeaders()

          // Apply optional headers based on configuration
          if (options.enableCSP !== false) {
            responseWithHeaders.headers.set('Content-Security-Policy', headers['Content-Security-Policy'])
          }

          if (options.enableHSTS !== false) {
            responseWithHeaders.headers.set('Strict-Transport-Security', headers['Strict-Transport-Security'])
          }

          if (options.enablePermissionsPolicy !== false) {
            responseWithHeaders.headers.set('Permissions-Policy', headers['Permissions-Policy'])
          }

          // Always apply critical security headers
          responseWithHeaders.headers.set('X-Frame-Options', headers['X-Frame-Options'])
          responseWithHeaders.headers.set('X-Content-Type-Options', headers['X-Content-Type-Options'])
          responseWithHeaders.headers.set('X-XSS-Protection', headers['X-XSS-Protection'])
          responseWithHeaders.headers.set('Referrer-Policy', headers['Referrer-Policy'])
          responseWithHeaders.headers.set('Cross-Origin-Embedder-Policy', headers['Cross-Origin-Embedder-Policy'])
          responseWithHeaders.headers.set('Cross-Origin-Opener-Policy', headers['Cross-Origin-Opener-Policy'])
          responseWithHeaders.headers.set('Cross-Origin-Resource-Policy', headers['Cross-Origin-Resource-Policy'])

          // Remove server information
          responseWithHeaders.headers.delete('X-Powered-By')
          responseWithHeaders.headers.set('Server', 'Web Server')

          // Apply custom headers
          if (options.customHeaders) {
            for (const [key, value] of Object.entries(options.customHeaders)) {
              responseWithHeaders.headers.set(key, value)
            }
          }
        }

        return response
      } catch (error) {
        throw error
      }
    }
  }
}

// Webhook signature validation
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHash('sha256')
    .update(payload + secret)
    .digest('hex')
  
  const receivedSignature = signature.replace('sha256=', '')
  
  return timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  )
}

// Security audit utilities
export class SecurityAudit {
  static logSensitiveAction(
    action: string,
    userId: string,
    details: Record<string, any> = {}
  ): void {
    logger.info('Sensitive action performed', {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details,
    })
  }
  
  static logDataAccess(
    resource: string,
    userId: string,
    operation: 'read' | 'write' | 'delete',
    details: Record<string, any> = {}
  ): void {
    logger.info('Data access logged', {
      resource,
      userId,
      operation,
      timestamp: new Date().toISOString(),
      ...details,
    })
  }
}