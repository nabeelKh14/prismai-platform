/**
 * MCP Data Source Validation and Error Handling
 * Provides robust validation and error handling for all MCP data sources
 */

import { z } from 'zod'
import { ValidationError, ExternalServiceError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/errors'

// MCP Service Status Types
export enum MCPServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export enum MCPErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  VALIDATION_ERROR = 'validation_error',
  DATA_QUALITY_ERROR = 'data_quality_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  UNKNOWN_ERROR = 'unknown_error'
}

// MCP Service Configuration
export interface MCPServiceConfig {
  name: string
  baseUrl?: string
  timeout: number
  retryAttempts: number
  retryDelay: number
  rateLimit: {
    requestsPerMinute: number
    requestsPerHour: number
  }
  circuitBreaker: {
    failureThreshold: number
    resetTimeout: number
  }
  validationRules: {
    requiredFields: string[]
    dataQualityChecks: Array<{
      field: string
      validator: (value: any) => boolean
      message: string
    }>
  }
}

// MCP Request Context
export interface MCPRequestContext {
  serviceName: string
  operation: string
  correlationId: string
  userId?: string
  tenantId?: string
  requestId: string
  startTime: number
  retryAttempt?: number
  metadata?: Record<string, unknown>
}

// MCP Response Validation
export interface MCPResponseValidation {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
    severity: 'error' | 'warning'
  }>
  warnings: Array<{
    field: string
    message: string
  }>
  dataQualityScore: number
  recommendations: string[]
}

// Circuit Breaker State
class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private threshold: number,
    private resetTimeout: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new ExternalServiceError('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    }
  }
}

// Rate Limiter
class RateLimiter {
  private requests: Array<{ timestamp: number }> = []

  constructor(
    private requestsPerMinute: number,
    private requestsPerHour: number
  ) {}

  async checkLimit(): Promise<void> {
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    const oneHourAgo = now - 3600000

    // Clean old requests
    this.requests = this.requests.filter(req => req.timestamp > oneHourAgo)

    // Check per-minute limit
    const requestsLastMinute = this.requests.filter(req => req.timestamp > oneMinuteAgo).length
    if (requestsLastMinute >= this.requestsPerMinute) {
      throw new ExternalServiceError('Rate limit exceeded (per minute)')
    }

    // Check per-hour limit
    if (this.requests.length >= this.requestsPerHour) {
      throw new ExternalServiceError('Rate limit exceeded (per hour)')
    }

    // Add current request
    this.requests.push({ timestamp: now })
  }
}

// MCP Service Health Monitor
export class MCPHealthMonitor {
  private serviceStates = new Map<string, MCPServiceStatus>()
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private rateLimiters = new Map<string, RateLimiter>()
  private lastHealthCheck = new Map<string, number>()

  constructor(private services: MCPServiceConfig[]) {
    this.initializeServices()
  }

  private initializeServices() {
    for (const service of this.services) {
      this.serviceStates.set(service.name, MCPServiceStatus.UNKNOWN)
      this.circuitBreakers.set(service.name, new CircuitBreaker(
        service.circuitBreaker.failureThreshold,
        service.circuitBreaker.resetTimeout
      ))
      this.rateLimiters.set(service.name, new RateLimiter(
        service.rateLimit.requestsPerMinute,
        service.rateLimit.requestsPerHour
      ))
    }
  }

  async checkServiceHealth(serviceName: string): Promise<MCPServiceStatus> {
    const now = Date.now()
    const lastCheck = this.lastHealthCheck.get(serviceName) || 0

    // Don't check too frequently (max once per minute)
    if (now - lastCheck < 60000) {
      return this.serviceStates.get(serviceName) || MCPServiceStatus.UNKNOWN
    }

    try {
      // Perform health check (implementation depends on service)
      await this.performHealthCheck(serviceName)
      this.serviceStates.set(serviceName, MCPServiceStatus.HEALTHY)
      this.lastHealthCheck.set(serviceName, now)
      return MCPServiceStatus.HEALTHY
    } catch (error) {
      const status = this.determineServiceStatus(error as Error)
      this.serviceStates.set(serviceName, status)
      this.lastHealthCheck.set(serviceName, now)
      return status
    }
  }

  private async performHealthCheck(serviceName: string): Promise<void> {
    // Implementation depends on the specific MCP service
    // This is a generic health check - override for specific services
    const service = this.services.find(s => s.name === serviceName)
    if (!service) {
      throw new Error(`Service ${serviceName} not found`)
    }

    // Basic connectivity check
    if (service.baseUrl) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${service.baseUrl}/health`, {
          method: 'GET',
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Health check timeout')
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
    }
  }

  private determineServiceStatus(error: Error): MCPServiceStatus {
    if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
      return MCPServiceStatus.DEGRADED
    }

    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return MCPServiceStatus.DEGRADED
    }

    if (error.message.includes('circuit breaker') || error.message.includes('5')) {
      return MCPServiceStatus.UNHEALTHY
    }

    return MCPServiceStatus.DEGRADED
  }

  getServiceStatus(serviceName: string): MCPServiceStatus {
    return this.serviceStates.get(serviceName) || MCPServiceStatus.UNKNOWN
  }

  getAllServiceStatuses(): Record<string, MCPServiceStatus> {
    const statuses: Record<string, MCPServiceStatus> = {}
    for (const [name, status] of this.serviceStates) {
      statuses[name] = status
    }
    return statuses
  }
}

// MCP Data Validator
export class MCPDataValidator {
  private static instance: MCPDataValidator
  private healthMonitor: MCPHealthMonitor

  constructor() {
    const services: MCPServiceConfig[] = [
      {
        name: 'github-mcp',
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: { requestsPerMinute: 60, requestsPerHour: 5000 },
        circuitBreaker: { failureThreshold: 5, resetTimeout: 60000 },
        validationRules: {
          requiredFields: ['username'],
          dataQualityChecks: [
            {
              field: 'followers',
              validator: (value) => typeof value === 'number' && value >= 0,
              message: 'Followers must be a non-negative number'
            }
          ]
        }
      },
      {
        name: 'clearbit-mcp',
        timeout: 15000,
        retryAttempts: 2,
        retryDelay: 2000,
        rateLimit: { requestsPerMinute: 30, requestsPerHour: 1000 },
        circuitBreaker: { failureThreshold: 3, resetTimeout: 120000 },
        validationRules: {
          requiredFields: ['domain'],
          dataQualityChecks: [
            {
              field: 'employees',
              validator: (value) => typeof value === 'number' && value >= 0,
              message: 'Employees must be a non-negative number'
            }
          ]
        }
      },
      {
        name: 'hunter-mcp',
        timeout: 8000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: { requestsPerMinute: 100, requestsPerHour: 10000 },
        circuitBreaker: { failureThreshold: 5, resetTimeout: 30000 },
        validationRules: {
          requiredFields: ['email'],
          dataQualityChecks: [
            {
              field: 'score',
              validator: (value) => typeof value === 'number' && value >= 0 && value <= 100,
              message: 'Score must be between 0 and 100'
            }
          ]
        }
      },
      {
        name: 'wikipedia-mcp',
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 500,
        rateLimit: { requestsPerMinute: 120, requestsPerHour: 10000 },
        circuitBreaker: { failureThreshold: 3, resetTimeout: 30000 },
        validationRules: {
          requiredFields: ['query'],
          dataQualityChecks: []
        }
      },
      {
        name: 'stackoverflow-mcp',
        timeout: 8000,
        retryAttempts: 2,
        retryDelay: 1000,
        rateLimit: { requestsPerMinute: 60, requestsPerHour: 5000 },
        circuitBreaker: { failureThreshold: 3, resetTimeout: 60000 },
        validationRules: {
          requiredFields: ['query'],
          dataQualityChecks: []
        }
      },
      {
        name: 'reddit-mcp',
        timeout: 10000,
        retryAttempts: 2,
        retryDelay: 2000,
        rateLimit: { requestsPerMinute: 30, requestsPerHour: 1000 },
        circuitBreaker: { failureThreshold: 5, resetTimeout: 120000 },
        validationRules: {
          requiredFields: ['subreddit'],
          dataQualityChecks: []
        }
      }
    ]

    this.healthMonitor = new MCPHealthMonitor(services)
  }

  static getInstance(): MCPDataValidator {
    if (!MCPDataValidator.instance) {
      MCPDataValidator.instance = new MCPDataValidator()
    }
    return MCPDataValidator.instance
  }

  /**
   * Validate MCP response data
   */
  async validateMCPResponse(
    serviceName: string,
    operation: string,
    data: unknown,
    context: MCPRequestContext
  ): Promise<MCPResponseValidation> {
    const validation: MCPResponseValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      dataQualityScore: 1.0,
      recommendations: []
    }

    try {
      // Get service configuration
      const service = this.getServiceConfig(serviceName)
      if (!service) {
        validation.isValid = false
        validation.errors.push({
          field: 'service',
          message: `Unknown MCP service: ${serviceName}`,
          severity: 'error'
        })
        return validation
      }

      // Check required fields
      for (const field of service.validationRules.requiredFields) {
        if (!data || typeof data !== 'object' || !(field in data)) {
          validation.isValid = false
          validation.errors.push({
            field,
            message: `Required field '${field}' is missing`,
            severity: 'error'
          })
        }
      }

      // Run data quality checks
      if (data && typeof data === 'object') {
        for (const check of service.validationRules.dataQualityChecks) {
          const value = (data as any)[check.field]
          if (value !== undefined && !check.validator(value)) {
            validation.errors.push({
              field: check.field,
              message: check.message,
              severity: 'error'
            })
            validation.isValid = false
          }
        }
      }

      // Calculate data quality score
      validation.dataQualityScore = this.calculateDataQualityScore(data, service)

      // Generate recommendations
      validation.recommendations = this.generateRecommendations(data, service, context)

      // Log validation results
      await logger.info('MCP response validation completed', {
        serviceName,
        operation,
        isValid: validation.isValid,
        dataQualityScore: validation.dataQualityScore,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['mcp', 'validation', serviceName],
        source: 'system'
      })

    } catch (error) {
      validation.isValid = false
      validation.errors.push({
        field: 'validation',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      })

      await logger.error('MCP response validation error', error as Error, {
        serviceName,
        operation,
        context
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['mcp', 'validation', 'error'],
        source: 'system'
      })
    }

    return validation
  }

  /**
   * Execute MCP request with validation and error handling
   */
  async executeWithValidation<T>(
    serviceName: string,
    operation: string,
    requestFn: () => Promise<T>,
    context: MCPRequestContext
  ): Promise<T> {
    const startTime = Date.now()

    try {
      // Check service health
      const healthStatus = await this.healthMonitor.checkServiceHealth(serviceName)
      if (healthStatus === MCPServiceStatus.UNHEALTHY) {
        throw new ExternalServiceError(`${serviceName} is currently unhealthy`)
      }

      // Check rate limits
      const rateLimiter = this.healthMonitor['rateLimiters'].get(serviceName)
      if (rateLimiter) {
        await rateLimiter.checkLimit()
      }

      // Execute request with circuit breaker
      const circuitBreaker = this.healthMonitor['circuitBreakers'].get(serviceName)
      if (!circuitBreaker) {
        throw new ExternalServiceError(`Circuit breaker not found for ${serviceName}`)
      }

      const result = await circuitBreaker.execute(async () => {
        return await withRetry(
          requestFn,
          {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            shouldRetry: (error) => {
              return error.message.includes('network') ||
                     error.message.includes('timeout') ||
                     error.message.includes('ECONNRESET')
            }
          }
        )
      })

      // Validate response
      const validation = await this.validateMCPResponse(serviceName, operation, result, context)

      if (!validation.isValid) {
        await logger.warn('MCP response validation failed', {
          serviceName,
          operation,
          validation,
          context
        }, {
          userId: context.userId,
          correlationId: context.correlationId,
          tags: ['mcp', 'validation', 'warning'],
          source: 'system'
        })
      }

      // Log successful execution
      const duration = Date.now() - startTime
      await logger.info('MCP request completed successfully', {
        serviceName,
        operation,
        duration,
        dataQualityScore: validation.dataQualityScore,
        context
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['mcp', 'success', serviceName],
        source: 'system'
      })

      return result

    } catch (error) {
      const duration = Date.now() - startTime
      const errorType = this.classifyError(error as Error)

      await logger.error('MCP request failed', error as Error, {
        serviceName,
        operation,
        duration,
        errorType,
        context
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['mcp', 'error', serviceName, errorType],
        source: 'system'
      })

      throw error
    }
  }

  /**
   * Get service configuration
   */
  private getServiceConfig(serviceName: string): MCPServiceConfig | undefined {
    // This would typically come from a configuration file or database
    const configs: Record<string, MCPServiceConfig> = {
      'github-mcp': {
        name: 'github-mcp',
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: { requestsPerMinute: 60, requestsPerHour: 5000 },
        circuitBreaker: { failureThreshold: 5, resetTimeout: 60000 },
        validationRules: {
          requiredFields: ['username'],
          dataQualityChecks: [
            {
              field: 'followers',
              validator: (value) => typeof value === 'number' && value >= 0,
              message: 'Followers must be a non-negative number'
            }
          ]
        }
      },
      'clearbit-mcp': {
        name: 'clearbit-mcp',
        timeout: 15000,
        retryAttempts: 2,
        retryDelay: 2000,
        rateLimit: { requestsPerMinute: 30, requestsPerHour: 1000 },
        circuitBreaker: { failureThreshold: 3, resetTimeout: 120000 },
        validationRules: {
          requiredFields: ['domain'],
          dataQualityChecks: [
            {
              field: 'employees',
              validator: (value) => typeof value === 'number' && value >= 0,
              message: 'Employees must be a non-negative number'
            }
          ]
        }
      },
      'hunter-mcp': {
        name: 'hunter-mcp',
        timeout: 8000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: { requestsPerMinute: 100, requestsPerHour: 10000 },
        circuitBreaker: { failureThreshold: 5, resetTimeout: 30000 },
        validationRules: {
          requiredFields: ['email'],
          dataQualityChecks: [
            {
              field: 'score',
              validator: (value) => typeof value === 'number' && value >= 0 && value <= 100,
              message: 'Score must be between 0 and 100'
            }
          ]
        }
      },
      'wikipedia-mcp': {
        name: 'wikipedia-mcp',
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 500,
        rateLimit: { requestsPerMinute: 120, requestsPerHour: 10000 },
        circuitBreaker: { failureThreshold: 3, resetTimeout: 30000 },
        validationRules: {
          requiredFields: ['query'],
          dataQualityChecks: []
        }
      },
      'stackoverflow-mcp': {
        name: 'stackoverflow-mcp',
        timeout: 8000,
        retryAttempts: 2,
        retryDelay: 1000,
        rateLimit: { requestsPerMinute: 60, requestsPerHour: 5000 },
        circuitBreaker: { failureThreshold: 3, resetTimeout: 60000 },
        validationRules: {
          requiredFields: ['query'],
          dataQualityChecks: []
        }
      },
      'reddit-mcp': {
        name: 'reddit-mcp',
        timeout: 10000,
        retryAttempts: 2,
        retryDelay: 2000,
        rateLimit: { requestsPerMinute: 30, requestsPerHour: 1000 },
        circuitBreaker: { failureThreshold: 5, resetTimeout: 120000 },
        validationRules: {
          requiredFields: ['subreddit'],
          dataQualityChecks: []
        }
      }
    }

    return configs[serviceName]
  }

  /**
   * Calculate data quality score
   */
  private calculateDataQualityScore(data: unknown, service: MCPServiceConfig): number {
    if (!data || typeof data !== 'object') {
      return 0
    }

    let score = 1.0
    const dataObj = data as Record<string, unknown>

    // Completeness score (required fields present)
    const requiredFieldsPresent = service.validationRules.requiredFields.filter(
      field => field in dataObj
    ).length
    const completenessScore = requiredFieldsPresent / service.validationRules.requiredFields.length
    score *= completenessScore

    // Data quality score (validation checks pass)
    let qualityScore = 1.0
    for (const check of service.validationRules.dataQualityChecks) {
      const value = dataObj[check.field]
      if (value !== undefined && !check.validator(value)) {
        qualityScore *= 0.8 // Reduce score for each failed check
      }
    }
    score *= qualityScore

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Generate recommendations based on data quality
   */
  private generateRecommendations(
    data: unknown,
    service: MCPServiceConfig,
    context: MCPRequestContext
  ): string[] {
    const recommendations: string[] = []

    if (!data || typeof data !== 'object') {
      recommendations.push('No data received from MCP service')
      return recommendations
    }

    const dataObj = data as Record<string, unknown>

    // Check for missing optional fields that could improve scoring
    const optionalFields = ['description', 'location', 'industry', 'foundedYear']
    for (const field of optionalFields) {
      if (!(field in dataObj)) {
        recommendations.push(`Consider adding ${field} for better data quality`)
      }
    }

    // Service-specific recommendations
    if (service.name === 'github-mcp') {
      if (!dataObj.company) {
        recommendations.push('GitHub company information could improve lead scoring')
      }
      if (!dataObj.email) {
        recommendations.push('GitHub email verification could enhance lead quality')
      }
    }

    if (service.name === 'clearbit-mcp') {
      if (!dataObj.employees) {
        recommendations.push('Employee count data would improve company scoring')
      }
      if (!dataObj.funding) {
        recommendations.push('Funding information could enhance company valuation')
      }
    }

    return recommendations
  }

  /**
   * Classify error type for better handling
   */
  private classifyError(error: Error): MCPErrorType {
    const message = error.message.toLowerCase()

    if (message.includes('timeout') || message.includes('econnaborted')) {
      return MCPErrorType.TIMEOUT_ERROR
    }

    if (message.includes('rate limit') || message.includes('429')) {
      return MCPErrorType.RATE_LIMIT_ERROR
    }

    if (message.includes('auth') || message.includes('401') || message.includes('403')) {
      return MCPErrorType.AUTHENTICATION_ERROR
    }

    if (message.includes('network') || message.includes('econnreset') || message.includes('enotfound')) {
      return MCPErrorType.NETWORK_ERROR
    }

    if (message.includes('5')) {
      return MCPErrorType.SERVICE_UNAVAILABLE
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return MCPErrorType.VALIDATION_ERROR
    }

    return MCPErrorType.UNKNOWN_ERROR
  }

  /**
   * Get health status of all MCP services
   */
  async getAllServiceHealth(): Promise<Record<string, MCPServiceStatus>> {
    return this.healthMonitor.getAllServiceStatuses()
  }

  /**
   * Get detailed service metrics
   */
  async getServiceMetrics(serviceName: string): Promise<any> {
    const circuitBreaker = this.healthMonitor['circuitBreakers'].get(serviceName)
    const rateLimiter = this.healthMonitor['rateLimiters'].get(serviceName)

    return {
      serviceName,
      status: this.healthMonitor.getServiceStatus(serviceName),
      circuitBreaker: circuitBreaker?.getState(),
      rateLimiter: rateLimiter ? {
        requestsPerMinute: rateLimiter['requestsPerMinute'],
        requestsPerHour: rateLimiter['requestsPerHour']
      } : null
    }
  }
}

// Export singleton instance
export const mcpValidator = MCPDataValidator.getInstance()
export default mcpValidator