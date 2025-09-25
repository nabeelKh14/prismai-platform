import { NextRequest, NextResponse } from 'next/server'
import { withSecurity, RequestValidator, AuthSecurity, securitySchemas } from '@/lib/security'
import { ApiKeyManager } from '@/lib/rate-limit/api-keys'
import { securityMonitoring, logSecurityEvent } from '@/lib/security-monitoring'
import { databaseSecurityManager } from '@/lib/security/database-security-manager'
import { DatabaseEncryption } from '@/lib/encryption/service'
import { logger } from '@/lib/logger'
import { ValidationError, AuthenticationError } from '@/lib/errors'
import { z } from 'zod'

export interface ApiSecurityConfig {
  requireAuth?: boolean
  requireApiKey?: boolean
  allowedApiKeyTiers?: ('free' | 'pro' | 'enterprise')[]
  validateInput?: z.ZodSchema
  encryptSensitiveData?: boolean
  logSecurityEvents?: boolean
  enableRateLimiting?: boolean
  enableCSRFProtection?: boolean
  enableInputValidation?: boolean
  enableXSSProtection?: boolean
  enableSQLInjectionProtection?: boolean
  customValidation?: (request: NextRequest) => Promise<void>
  sensitiveFields?: string[]
  auditResource?: string
}

export interface ApiSecurityContext {
  userId?: string
  apiKeyInfo?: any
  sessionId?: string
  ipAddress: string
  userAgent: string
  requestId: string
  securityEvents: string[]
  validationErrors: string[]
  encryptedFields: string[]
}

/**
 * Comprehensive API security middleware that integrates all security measures
 */
export function withApiSecurity(config: ApiSecurityConfig = {}) {
  return (handler: (request: NextRequest, ...args: any[]) => Promise<any>) => {
    return withSecurity({
      requireAuth: config.requireAuth,
      validateCSRF: config.enableCSRFProtection,
      maxRequestSize: 1024 * 1024, // 1MB
      checkSuspiciousPatterns: config.enableXSSProtection,
      enableRateLimiting: config.enableRateLimiting,
      detectBots: true,
      validateOrigin: ['*'], // Configure based on your needs
      enableSecurityHeaders: true,
    })(async (request: NextRequest, ...args: any[]) => {
      const securityContext: ApiSecurityContext = {
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        requestId: crypto.randomUUID(),
        securityEvents: [],
        validationErrors: [],
        encryptedFields: [],
      }

      try {
        // Step 1: API Key Authentication
        if (config.requireApiKey) {
          const apiKey = ApiKeyManager.extractApiKey(request)
          if (!apiKey) {
            throw new AuthenticationError('API key required')
          }

          const apiKeyInfo = await ApiKeyManager.validateApiKey(apiKey)
          if (!apiKeyInfo) {
            throw new AuthenticationError('Invalid API key')
          }

          if (config.allowedApiKeyTiers && !config.allowedApiKeyTiers.includes(apiKeyInfo.tier)) {
            throw new AuthenticationError('Insufficient API key tier')
          }

          securityContext.apiKeyInfo = apiKeyInfo
          securityContext.securityEvents.push('api_key_validated')
        }

        // Step 2: Enhanced Input Validation
        if (config.enableInputValidation !== false) {
          await validateApiInput(request, config, securityContext)
        }

        // Step 3: Custom Validation
        if (config.customValidation) {
          await config.customValidation(request)
          securityContext.securityEvents.push('custom_validation_passed')
        }

        // Step 4: Security Monitoring
        if (config.logSecurityEvents !== false) {
          await logSecurityEvent(
            'suspicious_activity',
            'low',
            'API endpoint accessed',
            `API endpoint accessed with security measures`,
            request,
            securityContext.userId,
            securityContext.sessionId,
            {
              endpoint: request.nextUrl.pathname,
              method: request.method,
              hasApiKey: !!securityContext.apiKeyInfo,
              securityEvents: securityContext.securityEvents,
            }
          )
        }

        // Step 5: Database Security Check
        if (config.auditResource && securityContext.userId) {
          const accessCheck = await databaseSecurityManager.checkAccessPermissions(
            securityContext.userId,
            'access',
            config.auditResource,
            {
              ipAddress: securityContext.ipAddress,
              userAgent: securityContext.userAgent,
              apiKeyTier: securityContext.apiKeyInfo?.tier,
            }
          )

          if (!accessCheck.allowed) {
            throw new AuthenticationError(`Access denied: ${accessCheck.reason}`)
          }

          securityContext.securityEvents.push('database_access_authorized')
        }

        // Step 6: Add security context to request
        ;(request as any).securityContext = securityContext

        // Step 7: Process the request
        const response = await handler(request, ...args)

        // Step 8: Encrypt sensitive data in response if configured
        if (config.encryptSensitiveData && config.sensitiveFields && response) {
          const encryptedResponse = await encryptResponseData(
            response,
            config.sensitiveFields,
            securityContext
          )
          return encryptedResponse
        }

        return response

      } catch (error) {
        // Enhanced error handling with security context
        await handleSecurityError(error, request, securityContext, config)
        throw error
      }
    })
  }
}

/**
 * Validate API input with comprehensive security checks
 */
async function validateApiInput(
  request: NextRequest,
  config: ApiSecurityConfig,
  securityContext: ApiSecurityContext
): Promise<void> {
  try {
    // Basic request validation
    RequestValidator.validateHeaders(request)
    RequestValidator.validateRequestSize(request, 1024 * 1024) // 1MB
    RequestValidator.detectSuspiciousPatterns(request)
    RequestValidator.detectBotActivity(request)

    // Schema validation if provided
    if (config.validateInput) {
      let inputData: any = {}

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          inputData = await request.json()
        } catch {
          // Handle non-JSON requests
          inputData = {}
        }
      }

      const validationResult = config.validateInput.safeParse(inputData)
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        securityContext.validationErrors.push(...errors)

        logger.logSecurity('Input validation failed', undefined, {
          errors,
          ipAddress: securityContext.ipAddress,
          path: request.nextUrl.pathname,
        })

        throw new ValidationError(`Validation failed: ${errors.join(', ')}`)
      }

      securityContext.securityEvents.push('input_validation_passed')
    }

    // SQL injection protection
    if (config.enableSQLInjectionProtection !== false) {
      const body = request.body ? JSON.stringify(request.body) : ''
      const url = request.nextUrl.pathname + request.nextUrl.search

      const suspiciousSQLPatterns = [
        /\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/gi,
        /--/,
        /\/\*[\s\S]*?\*\//g,
        /;.*;/,
      ]

      for (const pattern of suspiciousSQLPatterns) {
        if (pattern.test(url) || pattern.test(body)) {
          await logSecurityEvent(
            'sql_injection_attempt',
            'high',
            'SQL Injection Attempt Detected',
            'Suspicious SQL patterns detected in request',
            request,
            undefined,
            undefined,
            { pattern: pattern.source }
          )
          throw new ValidationError('Suspicious request pattern detected')
        }
      }

      securityContext.securityEvents.push('sql_injection_check_passed')
    }

    // XSS protection
    if (config.enableXSSProtection !== false) {
      const body = request.body ? JSON.stringify(request.body) : ''
      const url = request.nextUrl.pathname + request.nextUrl.search

      const xssPatterns = [
        /<script[^>]*>[\s\S]*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /on\w+\s*=/gi,
        /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
        /<object[^>]*>[\s\S]*?<\/object>/gi,
        /<embed[^>]*>[\s\S]*?<\/embed>/gi,
      ]

      for (const pattern of xssPatterns) {
        if (pattern.test(url) || pattern.test(body)) {
          await logSecurityEvent(
            'xss_attempt',
            'high',
            'XSS Attempt Detected',
            'Cross-site scripting patterns detected in request',
            request,
            undefined,
            undefined,
            { pattern: pattern.source }
          )
          throw new ValidationError('Suspicious XSS pattern detected')
        }
      }

      securityContext.securityEvents.push('xss_protection_passed')
    }

  } catch (error) {
    securityContext.validationErrors.push(error instanceof Error ? error.message : 'Validation error')
    throw error
  }
}

/**
 * Encrypt sensitive data in API responses
 */
async function encryptResponseData(
  response: any,
  sensitiveFields: string[],
  securityContext: ApiSecurityContext
): Promise<any> {
  if (!response || typeof response !== 'object') {
    return response
  }

  const encryptedResponse = { ...response }

  for (const field of sensitiveFields) {
    if (encryptedResponse[field] !== undefined) {
      try {
        const encrypted = await DatabaseEncryption.encryptSensitiveFields(
          { [field]: encryptedResponse[field] },
          'api_response'
        )
        encryptedResponse[field] = encrypted[field]
        securityContext.encryptedFields.push(field)
      } catch (error) {
        logger.error('Failed to encrypt response field', error as Error, { field })
      }
    }
  }

  return encryptedResponse
}

/**
 * Handle security errors with comprehensive logging
 */
async function handleSecurityError(
  error: any,
  request: NextRequest,
  securityContext: ApiSecurityContext,
  config: ApiSecurityConfig
): Promise<void> {
  const errorInfo = {
    message: error instanceof Error ? error.message : 'Unknown error',
    type: error.constructor.name,
    stack: error instanceof Error ? error.stack : undefined,
    ipAddress: securityContext.ipAddress,
    userAgent: securityContext.userAgent,
    path: request.nextUrl.pathname,
    method: request.method,
    hasApiKey: !!securityContext.apiKeyInfo,
    securityEvents: securityContext.securityEvents,
    validationErrors: securityContext.validationErrors,
    encryptedFields: securityContext.encryptedFields,
  }

  // Log security event based on error type
  let eventType: any = 'security_error'
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'

  if (error instanceof AuthenticationError) {
    eventType = 'authentication_failure'
    severity = 'high'
  } else if (error instanceof ValidationError) {
    eventType = 'validation_failure'
    severity = 'medium'
  } else {
    eventType = 'security_error'
    severity = 'high'
  }

  await logSecurityEvent(
    eventType,
    severity,
    'Security Error in API Endpoint',
    errorInfo.message,
    request,
    securityContext.userId,
    securityContext.sessionId,
    errorInfo
  )

  // Log to application logger
  logger.error('API Security Error', errorInfo)
}

/**
 * Create secure API response with security headers and context
 */
export function createSecureResponse(
  data: any,
  status: number = 200,
  securityContext?: ApiSecurityContext
): NextResponse {
  const response = NextResponse.json(data, { status })

  // Add security headers
  response.headers.set('X-Request-ID', securityContext?.requestId || crypto.randomUUID())
  response.headers.set('X-Security-Events', securityContext?.securityEvents.length.toString() || '0')
  response.headers.set('X-Validation-Errors', securityContext?.validationErrors.length.toString() || '0')
  response.headers.set('X-Encrypted-Fields', securityContext?.encryptedFields.length.toString() || '0')

  if (securityContext?.encryptedFields.length) {
    response.headers.set('X-Encrypted-Fields-List', securityContext.encryptedFields.join(','))
  }

  return response
}

/**
 * Pre-configured security middleware for different API types
 */
export const apiSecurity = {
  // Public API with basic security
  public: (config: Partial<ApiSecurityConfig> = {}) => withApiSecurity({
    enableInputValidation: true,
    enableXSSProtection: true,
    enableSQLInjectionProtection: true,
    logSecurityEvents: true,
    enableRateLimiting: true,
    ...config,
  }),

  // Protected API requiring authentication
  protected: (config: Partial<ApiSecurityConfig> = {}) => withApiSecurity({
    requireAuth: true,
    enableInputValidation: true,
    enableXSSProtection: true,
    enableSQLInjectionProtection: true,
    logSecurityEvents: true,
    enableRateLimiting: true,
    enableCSRFProtection: true,
    ...config,
  }),

  // API Key required
  apiKey: (config: Partial<ApiSecurityConfig> = {}) => withApiSecurity({
    requireApiKey: true,
    allowedApiKeyTiers: ['free', 'pro', 'enterprise'],
    enableInputValidation: true,
    enableXSSProtection: true,
    enableSQLInjectionProtection: true,
    logSecurityEvents: true,
    enableRateLimiting: true,
    ...config,
  }),

  // High-security API with encryption
  highSecurity: (config: Partial<ApiSecurityConfig> = {}) => withApiSecurity({
    requireAuth: true,
    requireApiKey: true,
    allowedApiKeyTiers: ['pro', 'enterprise'],
    enableInputValidation: true,
    enableXSSProtection: true,
    enableSQLInjectionProtection: true,
    logSecurityEvents: true,
    enableRateLimiting: true,
    enableCSRFProtection: true,
    encryptSensitiveData: true,
    ...config,
  }),
}