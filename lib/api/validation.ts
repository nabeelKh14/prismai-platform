/**
 * API Endpoint Security Validation and Rate Limiting
 * Provides comprehensive security validation and rate limiting for API endpoints
 */

import { z } from 'zod'
import { ValidationError, RateLimitError, AuthenticationError, AuthorizationError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// Security Event Types
export enum SecurityEventType {
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  BRUTE_FORCE_ATTACK = 'brute_force_attack',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTACK = 'xss_attack',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  DATA_EXFILTRATION = 'data_exfiltration',
  MALFORMED_REQUEST = 'malformed_request',
  UNUSUAL_PATTERN = 'unusual_pattern'
}

// Rate Limit Types
export enum RateLimitType {
  REQUEST_PER_MINUTE = 'request_per_minute',
  REQUEST_PER_HOUR = 'request_per_hour',
  REQUEST_PER_DAY = 'request_per_day',
  CONCURRENT_REQUESTS = 'concurrent_requests',
  BANDWIDTH_PER_HOUR = 'bandwidth_per_hour'
}

// Security Validation Level
export enum SecurityValidationLevel {
  LOW = 'low',           // Basic validation only
  MEDIUM = 'medium',     // Standard validation + basic security checks
  HIGH = 'high',         // Full validation + advanced security checks
  CRITICAL = 'critical'  // Maximum validation + real-time threat detection
}

// API Security Configuration
export interface APISecurityConfig {
  endpoint: string
  method: string
  validationLevel: SecurityValidationLevel
  rateLimits: RateLimitRule[]
  authentication: {
    required: boolean
    methods: string[]
    scopes?: string[]
  }
  authorization: {
    required: boolean
    roles?: string[]
    permissions?: string[]
    resource?: string
    ownership?: boolean
  }
  inputValidation: {
    sanitizeInput: boolean
    maxRequestSize: number
    allowedContentTypes: string[]
    validateHeaders: boolean
  }
  threatDetection: {
    enabled: boolean
    sqlInjectionDetection: boolean
    xssDetection: boolean
    suspiciousPatternDetection: boolean
    anomalyDetection: boolean
  }
  logging: {
    logRequests: boolean
    logResponses: boolean
    logSecurityEvents: boolean
    logPerformance: boolean
  }
}

// Rate Limit Rule
export interface RateLimitRule {
  type: RateLimitType
  limit: number
  windowMs: number
  strategy: 'fixed_window' | 'sliding_window' | 'token_bucket'
  burstLimit?: number
  burstWindowMs?: number
}

// Security Validation Result
export interface SecurityValidationResult {
  isValid: boolean
  errors: Array<{
    type: SecurityEventType
    message: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    field?: string
    suggestion?: string
    code?: string
  }>
  warnings: Array<{
    type: SecurityEventType
    message: string
    suggestion?: string
  }>
  threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical'
  riskScore: number
  recommendations: string[]
  metadata: Record<string, unknown>
}

// Request Context
export interface RequestContext {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
  query?: Record<string, unknown>
  params?: Record<string, string>
  userId?: string
  tenantId?: string
  sessionId?: string
  ipAddress: string
  userAgent: string
  timestamp: Date
  correlationId: string
  requestId: string
}

// Rate Limiter
class RateLimiter {
  private static instance: RateLimiter
  private limits = new Map<string, Map<string, number[]>>()
  private concurrentRequests = new Map<string, Set<string>>()

  constructor() {
    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 300000)
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter()
    }
    return RateLimiter.instance
  }

  async checkRateLimit(
    key: string,
    rules: RateLimitRule[],
    context: RequestContext
  ): Promise<void> {
    const now = Date.now()

    for (const rule of rules) {
      const limitKey = `${rule.type}:${key}`

      if (!this.limits.has(limitKey)) {
        this.limits.set(limitKey, new Map())
      }

      const ruleLimits = this.limits.get(limitKey)!

      // Clean old entries for this rule
      const cutoff = now - rule.windowMs
      const requests = ruleLimits.get(rule.type) || []
      const validRequests = requests.filter(timestamp => timestamp > cutoff)

      // Check if limit exceeded
      if (validRequests.length >= rule.limit) {
        await logger.warn('Rate limit exceeded', {
          key,
          rule: rule.type,
          limit: rule.limit,
          windowMs: rule.windowMs,
          requestCount: validRequests.length,
          context
        }, {
          userId: context.userId,
          correlationId: context.correlationId,
          tags: ['rate-limit', 'exceeded', rule.type],
          source: 'system'
        })

        throw new RateLimitError(`Rate limit exceeded for ${rule.type}`)
      }

      // Add current request
      validRequests.push(now)
      ruleLimits.set(rule.type, validRequests)
    }

    // Check concurrent requests limit
    const concurrentKey = `concurrent:${key}`
    if (!this.concurrentRequests.has(concurrentKey)) {
      this.concurrentRequests.set(concurrentKey, new Set())
    }

    const concurrentSet = this.concurrentRequests.get(concurrentKey)!
    const concurrentRule = rules.find(r => r.type === RateLimitType.CONCURRENT_REQUESTS)

    if (concurrentRule && concurrentSet.size >= concurrentRule.limit) {
      throw new RateLimitError('Too many concurrent requests')
    }

    concurrentSet.add(context.requestId)
  }

  removeConcurrentRequest(key: string, requestId: string): void {
    const concurrentKey = `concurrent:${key}`
    const concurrentSet = this.concurrentRequests.get(concurrentKey)
    if (concurrentSet) {
      concurrentSet.delete(requestId)
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const cutoff = now - 3600000 // 1 hour

    for (const [limitKey, ruleLimits] of this.limits.entries()) {
      for (const [ruleType, requests] of ruleLimits.entries()) {
        const validRequests = requests.filter(timestamp => timestamp > cutoff)
        if (validRequests.length === 0) {
          ruleLimits.delete(ruleType)
        } else {
          ruleLimits.set(ruleType, validRequests)
        }
      }

      if (ruleLimits.size === 0) {
        this.limits.delete(limitKey)
      }
    }
  }
}

// Threat Detector
class ThreatDetector {
  private static instance: ThreatDetector
  private suspiciousPatterns = new Map<SecurityEventType, RegExp[]>()

  constructor() {
    this.initializePatterns()
  }

  static getInstance(): ThreatDetector {
    if (!ThreatDetector.instance) {
      ThreatDetector.instance = new ThreatDetector()
    }
    return ThreatDetector.instance
  }

  private initializePatterns() {
    // SQL Injection patterns
    this.suspiciousPatterns.set(SecurityEventType.SQL_INJECTION_ATTEMPT, [
      /(\bselect\b.*\bfrom\b.*\bwhere\b.*\b1=1\b)/i,
      /(\bor\b\s+\d+\s*=\s*\d+)/i,
      /(\bunion\b.*\bselect\b)/i,
      /(--.*)/,
      /(\*.*from.*)/i,
      /(;\s*drop\s)/i,
      /(;\s*delete\s)/i,
      /(;\s*update\s)/i,
      /(\band\b\s+\d+\s*=\s*\d+)/i,
      /(\bor\b\s+\d+\s*=\s*\d+)/i
    ])

    // XSS patterns
    this.suspiciousPatterns.set(SecurityEventType.XSS_ATTACK, [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi,
      /vbscript:/gi,
      /data:\s*text\/html/gi
    ])

    // Suspicious activity patterns
    this.suspiciousPatterns.set(SecurityEventType.SUSPICIOUS_ACTIVITY, [
      /admin/i,
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /config/i,
      /backup/i,
      /dump/i,
      /export/i,
      /import/i
    ])
  }

  async detectThreats(
    input: string,
    context: RequestContext
  ): Promise<Array<{ type: SecurityEventType; pattern: string; match: string }>> {
    const threats: Array<{ type: SecurityEventType; pattern: string; match: string }> = []

    for (const [eventType, patterns] of this.suspiciousPatterns.entries()) {
      for (const pattern of patterns) {
        const matches = input.match(pattern)
        if (matches) {
          threats.push({
            type: eventType,
            pattern: pattern.source,
            match: matches[0]
          })
        }
      }
    }

    if (threats.length > 0) {
      await logger.warn('Threats detected in request', {
        threatCount: threats.length,
        threats: threats.map(t => ({ type: t.type, pattern: t.pattern, match: t.match })),
        context
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['security', 'threat-detected'],
        source: 'system'
      })
    }

    return threats
  }

  async analyzeAnomalies(
    context: RequestContext,
    history: Array<{ timestamp: Date; endpoint: string; userAgent: string; ipAddress: string }>
  ): Promise<{ isAnomalous: boolean; score: number; reasons: string[] }> {
    const analysis = {
      isAnomalous: false,
      score: 0,
      reasons: [] as string[]
    }

    // Check for unusual request frequency
    const recentRequests = history.filter(h =>
      h.timestamp.getTime() > Date.now() - 3600000 // Last hour
    )

    if (recentRequests.length > 100) {
      analysis.isAnomalous = true
      analysis.score += 0.3
      analysis.reasons.push('Unusual request frequency detected')
    }

    // Check for unusual user agents
    const userAgent = context.userAgent.toLowerCase()
    const suspiciousUserAgents = ['curl', 'wget', 'python', 'bot', 'spider', 'crawler']

    if (suspiciousUserAgents.some(agent => userAgent.includes(agent))) {
      analysis.isAnomalous = true
      analysis.score += 0.2
      analysis.reasons.push('Suspicious user agent detected')
    }

    // Check for rapid endpoint changes
    const uniqueEndpoints = new Set(recentRequests.map(h => h.endpoint))
    if (uniqueEndpoints.size > 10) {
      analysis.isAnomalous = true
      analysis.score += 0.2
      analysis.reasons.push('Rapid endpoint switching detected')
    }

    // Check for unusual time patterns
    const hour = new Date().getHours()
    if (hour < 6 || hour > 22) { // Outside normal business hours
      analysis.score += 0.1
      analysis.reasons.push('Request outside normal business hours')
    }

    if (analysis.score >= 0.5) {
      analysis.isAnomalous = true
    }

    if (analysis.isAnomalous) {
      await logger.warn('Anomalous activity detected', {
        score: analysis.score,
        reasons: analysis.reasons,
        context
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['security', 'anomaly-detected'],
        source: 'system'
      })
    }

    return analysis
  }
}

// API Security Validator
export class APISecurityValidator {
  private static instance: APISecurityValidator
  private rateLimiter: RateLimiter
  private threatDetector: ThreatDetector
  private securityConfigs = new Map<string, APISecurityConfig>()

  constructor() {
    this.rateLimiter = RateLimiter.getInstance()
    this.threatDetector = ThreatDetector.getInstance()
    this.initializeSecurityConfigs()
  }

  static getInstance(): APISecurityValidator {
    if (!APISecurityValidator.instance) {
      APISecurityValidator.instance = new APISecurityValidator()
    }
    return APISecurityValidator.instance
  }

  private initializeSecurityConfigs() {
    // Initialize default security configurations for common endpoints
    const defaultConfigs: APISecurityConfig[] = [
      {
        endpoint: '/api/leads',
        method: 'POST',
        validationLevel: SecurityValidationLevel.HIGH,
        rateLimits: [
          { type: RateLimitType.REQUEST_PER_MINUTE, limit: 60, windowMs: 60000, strategy: 'sliding_window' },
          { type: RateLimitType.REQUEST_PER_HOUR, limit: 1000, windowMs: 3600000, strategy: 'sliding_window' },
          { type: RateLimitType.CONCURRENT_REQUESTS, limit: 10, windowMs: 60000, strategy: 'fixed_window' }
        ],
        authentication: { required: true, methods: ['bearer', 'api_key'] },
        authorization: { required: true, permissions: ['leads:create'] },
        inputValidation: {
          sanitizeInput: true,
          maxRequestSize: 1024 * 1024, // 1MB
          allowedContentTypes: ['application/json'],
          validateHeaders: true
        },
        threatDetection: {
          enabled: true,
          sqlInjectionDetection: true,
          xssDetection: true,
          suspiciousPatternDetection: true,
          anomalyDetection: true
        },
        logging: {
          logRequests: true,
          logResponses: false,
          logSecurityEvents: true,
          logPerformance: true
        }
      },
      {
        endpoint: '/api/leads',
        method: 'GET',
        validationLevel: SecurityValidationLevel.MEDIUM,
        rateLimits: [
          { type: RateLimitType.REQUEST_PER_MINUTE, limit: 120, windowMs: 60000, strategy: 'sliding_window' },
          { type: RateLimitType.REQUEST_PER_HOUR, limit: 5000, windowMs: 3600000, strategy: 'sliding_window' }
        ],
        authentication: { required: true, methods: ['bearer', 'api_key'] },
        authorization: { required: true, permissions: ['leads:read'] },
        inputValidation: {
          sanitizeInput: false,
          maxRequestSize: 1024 * 1024,
          allowedContentTypes: ['application/json'],
          validateHeaders: true
        },
        threatDetection: {
          enabled: true,
          sqlInjectionDetection: true,
          xssDetection: false,
          suspiciousPatternDetection: true,
          anomalyDetection: false
        },
        logging: {
          logRequests: true,
          logResponses: false,
          logSecurityEvents: true,
          logPerformance: false
        }
      },
      {
        endpoint: '/api/crm/sync',
        method: 'POST',
        validationLevel: SecurityValidationLevel.CRITICAL,
        rateLimits: [
          { type: RateLimitType.REQUEST_PER_HOUR, limit: 100, windowMs: 3600000, strategy: 'sliding_window' },
          { type: RateLimitType.REQUEST_PER_DAY, limit: 1000, windowMs: 86400000, strategy: 'sliding_window' }
        ],
        authentication: { required: true, methods: ['bearer', 'api_key'], scopes: ['crm:write'] },
        authorization: { required: true, permissions: ['crm:sync'], roles: ['admin', 'integration'] },
        inputValidation: {
          sanitizeInput: true,
          maxRequestSize: 10 * 1024 * 1024, // 10MB
          allowedContentTypes: ['application/json'],
          validateHeaders: true
        },
        threatDetection: {
          enabled: true,
          sqlInjectionDetection: true,
          xssDetection: true,
          suspiciousPatternDetection: true,
          anomalyDetection: true
        },
        logging: {
          logRequests: true,
          logResponses: true,
          logSecurityEvents: true,
          logPerformance: true
        }
      }
    ]

    for (const config of defaultConfigs) {
      const key = `${config.method}:${config.endpoint}`
      this.securityConfigs.set(key, config)
    }
  }

  /**
   * Validate API request security
   */
  async validateAPIRequest(
    context: RequestContext,
    body?: unknown,
    history?: Array<{ timestamp: Date; endpoint: string; userAgent: string; ipAddress: string }>
  ): Promise<SecurityValidationResult> {
    const validation: SecurityValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      threatLevel: 'none',
      riskScore: 0,
      recommendations: [],
      metadata: {}
    }

    try {
      // Get security configuration
      const configKey = `${context.method}:${context.url}`
      const securityConfig = this.securityConfigs.get(configKey)

      if (!securityConfig) {
        validation.warnings.push({
          type: SecurityEventType.UNUSUAL_PATTERN,
          message: 'No security configuration found for endpoint',
          suggestion: 'Consider adding security configuration for this endpoint'
        })
      }

      // Check rate limits
      try {
        const rateLimitKey = `${context.ipAddress}:${context.userId || 'anonymous'}:${context.url}`
        const rules = securityConfig?.rateLimits || []
        await this.rateLimiter.checkRateLimit(rateLimitKey, rules, context)
      } catch (error) {
        if (error instanceof RateLimitError) {
          validation.isValid = false
          validation.errors.push({
            type: SecurityEventType.RATE_LIMIT_EXCEEDED,
            message: error.message,
            severity: 'high'
          })
          validation.threatLevel = 'high'
          validation.riskScore += 0.8
        }
      }

      // Detect threats in input data
      const inputData = JSON.stringify({ body, query: context.query, params: context.params })
      const threats = await this.threatDetector.detectThreats(inputData, context)

      for (const threat of threats) {
        validation.isValid = false
        validation.errors.push({
          type: threat.type,
          message: `Security threat detected: ${threat.match}`,
          severity: 'critical',
          suggestion: 'Request blocked due to security policy'
        })
        validation.threatLevel = 'critical'
        validation.riskScore += 1.0
      }

      // Analyze anomalies
      if (history && history.length > 0) {
        const anomalyAnalysis = await this.threatDetector.analyzeAnomalies(context, history)

        if (anomalyAnalysis.isAnomalous) {
          validation.warnings.push({
            type: SecurityEventType.UNUSUAL_PATTERN,
            message: `Anomalous activity detected (score: ${anomalyAnalysis.score})`,
            suggestion: 'Monitor this activity closely'
          })
          validation.threatLevel = anomalyAnalysis.score > 0.7 ? 'high' : 'medium'
          validation.riskScore += anomalyAnalysis.score
        }
      }

      // Validate authentication
      if (securityConfig?.authentication.required) {
        const authValidation = await this.validateAuthentication(context, securityConfig)
        if (!authValidation.isValid) {
          validation.isValid = false
          validation.errors.push(...authValidation.errors)
          validation.threatLevel = 'high'
          validation.riskScore += 0.6
        }
      }

      // Validate authorization
      if (securityConfig?.authorization.required) {
        const authzValidation = await this.validateAuthorization(context, securityConfig)
        if (!authzValidation.isValid) {
          validation.isValid = false
          validation.errors.push(...authzValidation.errors)
          validation.threatLevel = 'high'
          validation.riskScore += 0.5
        }
      }

      // Validate input
      const inputValidation = await this.validateInput(context, body, securityConfig)
      if (!inputValidation.isValid) {
        validation.isValid = false
        validation.errors.push(...inputValidation.errors)
        validation.riskScore += 0.3
      }

      // Generate recommendations
      validation.recommendations = this.generateSecurityRecommendations(validation, securityConfig)

      // Determine overall threat level
      if (validation.riskScore >= 0.8) {
        validation.threatLevel = 'critical'
      } else if (validation.riskScore >= 0.6) {
        validation.threatLevel = 'high'
      } else if (validation.riskScore >= 0.4) {
        validation.threatLevel = 'medium'
      } else if (validation.riskScore >= 0.2) {
        validation.threatLevel = 'low'
      }

      // Log security validation results
      if (!validation.isValid || validation.threatLevel !== 'none') {
        await logger.warn('API security validation completed with issues', {
          endpoint: context.url,
          method: context.method,
          isValid: validation.isValid,
          threatLevel: validation.threatLevel,
          riskScore: validation.riskScore,
          errorCount: validation.errors.length,
          warningCount: validation.warnings.length,
          context
        }, {
          userId: context.userId,
          correlationId: context.correlationId,
          tags: ['api', 'security', 'validation', validation.threatLevel],
          source: 'system'
        })
      }

    } catch (error) {
      validation.isValid = false
      validation.errors.push({
        type: SecurityEventType.UNUSUAL_PATTERN,
        message: `Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'high'
      })

      await logger.error('API security validation error', error as Error, {
        endpoint: context.url,
        method: context.method,
        context
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['api', 'security', 'validation', 'error'],
        source: 'system'
      })
    }

    return validation
  }

  /**
   * Validate authentication
   */
  private async validateAuthentication(
    context: RequestContext,
    config: APISecurityConfig
  ): Promise<{ isValid: boolean; errors: SecurityValidationResult['errors'] }> {
    const errors: SecurityValidationResult['errors'] = []

    // Check for authentication headers
    const authHeader = context.headers.authorization || context.headers['x-api-key']
    if (!authHeader) {
      errors.push({
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        message: 'Missing authentication credentials',
        severity: 'high',
        suggestion: 'Provide valid authentication credentials'
      })
      return { isValid: false, errors }
    }

    // Validate authentication method
    const authMethods = config.authentication.methods
    const isValidAuthMethod = authMethods.some(method => {
      switch (method) {
        case 'bearer':
          return authHeader.startsWith('Bearer ')
        case 'api_key':
          return authHeader.startsWith('API-Key ') || context.headers['x-api-key']
        case 'basic':
          return authHeader.startsWith('Basic ')
        default:
          return false
      }
    })

    if (!isValidAuthMethod) {
      errors.push({
        type: SecurityEventType.UNAUTHORIZED_ACCESS,
        message: 'Invalid authentication method',
        severity: 'high',
        suggestion: `Use one of the supported methods: ${authMethods.join(', ')}`
      })
      return { isValid: false, errors }
    }

    return { isValid: true, errors: [] }
  }

  /**
   * Validate authorization
   */
  private async validateAuthorization(
    context: RequestContext,
    config: APISecurityConfig
  ): Promise<{ isValid: boolean; errors: SecurityValidationResult['errors'] }> {
    const errors: SecurityValidationResult['errors'] = []

    // This would typically check user roles and permissions against a database
    // For now, we'll simulate the validation

    if (config.authorization.roles && context.userId) {
      // Check if user has required roles
      const userRoles = await this.getUserRoles(context.userId)
      const hasRequiredRole = config.authorization.roles.some(role => userRoles.includes(role))

      if (!hasRequiredRole) {
        errors.push({
          type: SecurityEventType.UNAUTHORIZED_ACCESS,
          message: 'Insufficient role permissions',
          severity: 'high',
          suggestion: `User must have one of the following roles: ${config.authorization.roles.join(', ')}`
        })
        return { isValid: false, errors }
      }
    }

    if (config.authorization.permissions && context.userId) {
      // Check if user has required permissions
      const userPermissions = await this.getUserPermissions(context.userId)
      const hasRequiredPermission = config.authorization.permissions.some(permission => userPermissions.includes(permission))

      if (!hasRequiredPermission) {
        errors.push({
          type: SecurityEventType.UNAUTHORIZED_ACCESS,
          message: 'Insufficient permissions',
          severity: 'high',
          suggestion: `User must have one of the following permissions: ${config.authorization.permissions.join(', ')}`
        })
        return { isValid: false, errors }
      }
    }

    return { isValid: true, errors: [] }
  }

  /**
   * Validate input data
   */
  private async validateInput(
    context: RequestContext,
    body?: unknown,
    config?: APISecurityConfig
  ): Promise<{ isValid: boolean; errors: SecurityValidationResult['errors'] }> {
    const errors: SecurityValidationResult['errors'] = []

    // Check content type
    if (config?.inputValidation.allowedContentTypes) {
      const contentType = context.headers['content-type'] || ''
      const isAllowedContentType = config.inputValidation.allowedContentTypes.some(type =>
        contentType.includes(type)
      )

      if (!isAllowedContentType) {
        errors.push({
          type: SecurityEventType.MALFORMED_REQUEST,
          message: 'Invalid content type',
          severity: 'medium',
          suggestion: `Content type must be one of: ${config.inputValidation.allowedContentTypes.join(', ')}`
        })
        return { isValid: false, errors }
      }
    }

    // Check request size
    if (config?.inputValidation.maxRequestSize) {
      const requestSize = JSON.stringify({ body, query: context.query, params: context.params }).length
      if (requestSize > config.inputValidation.maxRequestSize) {
        errors.push({
          type: SecurityEventType.MALFORMED_REQUEST,
          message: 'Request size exceeds maximum allowed',
          severity: 'medium',
          suggestion: `Request size must be less than ${config.inputValidation.maxRequestSize} bytes`
        })
        return { isValid: false, errors }
      }
    }

    // Sanitize input if enabled
    if (config?.inputValidation.sanitizeInput) {
      // This would sanitize the input data
      // Implementation depends on your sanitization requirements
    }

    return { isValid: true, errors: [] }
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(
    validation: SecurityValidationResult,
    config?: APISecurityConfig
  ): string[] {
    const recommendations: string[] = []

    if (validation.threatLevel === 'high' || validation.threatLevel === 'critical') {
      recommendations.push('Consider implementing additional security measures')
      recommendations.push('Monitor this endpoint closely for suspicious activity')
    }

    if (validation.errors.some(e => e.type === SecurityEventType.RATE_LIMIT_EXCEEDED)) {
      recommendations.push('Consider increasing rate limits for legitimate users')
      recommendations.push('Implement progressive rate limiting delays')
    }

    if (validation.errors.some(e => e.type === SecurityEventType.SQL_INJECTION_ATTEMPT)) {
      recommendations.push('Use parameterized queries instead of string concatenation')
      recommendations.push('Implement input validation and sanitization')
    }

    if (validation.errors.some(e => e.type === SecurityEventType.XSS_ATTACK)) {
      recommendations.push('Implement output encoding for user-controlled data')
      recommendations.push('Use Content Security Policy (CSP) headers')
    }

    if (!config?.authentication.required) {
      recommendations.push('Consider requiring authentication for this endpoint')
    }

    if (!config?.authorization.required) {
      recommendations.push('Consider implementing authorization checks')
    }

    return recommendations
  }

  /**
   * Get user roles (simulated)
   */
  private async getUserRoles(userId: string): Promise<string[]> {
    // This would typically query your user management system
    // For simulation, return basic roles
    return ['user']
  }

  /**
   * Get user permissions (simulated)
   */
  private async getUserPermissions(userId: string): Promise<string[]> {
    // This would typically query your permissions system
    // For simulation, return basic permissions
    return ['read']
  }

  /**
   * Clean up request tracking
   */
  cleanupRequest(context: RequestContext): void {
    const rateLimitKey = `${context.ipAddress}:${context.userId || 'anonymous'}:${context.url}`
    this.rateLimiter.removeConcurrentRequest(rateLimitKey, context.requestId)
  }
}

// Export singleton instance
export const apiSecurityValidator = APISecurityValidator.getInstance()
export default apiSecurityValidator