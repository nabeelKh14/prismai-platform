/**
 * Retry Mechanisms for External Service Failures
 * Provides sophisticated retry mechanisms with backoff strategies, circuit breakers, and failure recovery
 */

import { z } from 'zod'
import { ValidationError, ExternalServiceError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/errors'

// Retry Strategy Types
export enum RetryStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  FIBONACCI = 'fibonacci',
  CUSTOM = 'custom'
}

// Retry Configuration
export interface RetryConfiguration {
  maxRetries: number
  baseDelay: number // Base delay in milliseconds
  maxDelay: number // Maximum delay in milliseconds
  backoffFactor: number // Multiplier for delay calculation
  strategy: RetryStrategy
  jitter: boolean // Add randomness to delay
  retryableErrors: string[] // Error types that should trigger retry
  retryCondition?: (error: Error, attempt: number) => boolean
  onRetry?: (error: Error, attempt: number, delay: number) => void
  onMaxRetries?: (error: Error, attempts: number) => void
}

// Circuit Breaker State
export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failures: number
  lastFailureTime: number
  nextAttemptTime: number
  threshold: number
  resetTimeout: number
}

// Retry Context
export interface RetryContext {
  operation: string
  service: string
  userId?: string
  tenantId?: string
  correlationId: string
  requestId: string
  startTime: number
  attempts: number
  totalDelay: number
  lastError?: Error
  metadata: Record<string, unknown>
}

// Retry Result
export interface RetryResult<T> {
  success: boolean
  result?: T
  error?: Error
  attempts: number
  totalDelay: number
  circuitBreakerTriggered: boolean
  metadata: Record<string, unknown>
}

// Failure Recovery Strategy
export interface FailureRecoveryStrategy {
  name: string
  description: string
  applicableErrors: string[]
  recoveryActions: Array<{
    type: 'fallback' | 'cache' | 'degraded' | 'manual' | 'skip'
    description: string
    parameters: Record<string, unknown>
    priority: number
    automated: boolean
  }>
  fallbackResponse?: unknown
  requiresApproval: boolean
  approvalRequiredFrom?: string[]
}

// Service Health Monitor
export interface ServiceHealthMonitor {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastHealthCheck: Date
  consecutiveFailures: number
  averageResponseTime: number
  errorRate: number
  circuitBreakerState: CircuitBreakerState
  metadata: Record<string, unknown>
}

// Advanced Retry Manager
class AdvancedRetryManager {
  private static instance: AdvancedRetryManager
  private circuitBreakers = new Map<string, CircuitBreakerState>()
  private serviceHealth = new Map<string, ServiceHealthMonitor>()
  private retryHistory = new Map<string, RetryContext[]>()
  private defaultConfig: RetryConfiguration = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    strategy: RetryStrategy.EXPONENTIAL,
    jitter: true,
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'TimeoutError',
      'NetworkError',
      'ExternalServiceError'
    ]
  }

  constructor() {
    this.initializeCircuitBreakers()
    this.startHealthMonitoring()
  }

  static getInstance(): AdvancedRetryManager {
    if (!AdvancedRetryManager.instance) {
      AdvancedRetryManager.instance = new AdvancedRetryManager()
    }
    return AdvancedRetryManager.instance
  }

  private initializeCircuitBreakers() {
    // Initialize circuit breakers for common services
    const services = ['github-mcp', 'clearbit-mcp', 'hunter-mcp', 'wikipedia-mcp', 'stackoverflow-mcp', 'reddit-mcp', 'crm-api', 'database']

    for (const service of services) {
      this.circuitBreakers.set(service, {
        state: 'CLOSED',
        failures: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        threshold: 5,
        resetTimeout: 60000 // 1 minute
      })
    }
  }

  private startHealthMonitoring() {
    // Monitor service health every 30 seconds
    setInterval(() => {
      this.updateServiceHealthMonitors()
    }, 30000)
  }

  private updateServiceHealthMonitors() {
    for (const [service, monitor] of this.serviceHealth.entries()) {
      const circuitBreaker = this.circuitBreakers.get(service)
      if (circuitBreaker) {
        monitor.circuitBreakerState = circuitBreaker
        monitor.lastHealthCheck = new Date()
      }
    }
  }

  /**
   * Execute operation with advanced retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfiguration> = {},
    context: Partial<RetryContext> = {}
  ): Promise<RetryResult<T>> {
    const retryConfig = { ...this.defaultConfig, ...config }
    const retryContext: RetryContext = {
      operation: context.operation || 'unknown',
      service: context.service || 'unknown',
      userId: context.userId,
      tenantId: context.tenantId,
      correlationId: context.correlationId || crypto.randomUUID(),
      requestId: context.requestId || crypto.randomUUID(),
      startTime: Date.now(),
      attempts: 0,
      totalDelay: 0,
      metadata: context.metadata || {}
    }

    // Check circuit breaker
    const circuitBreaker = this.circuitBreakers.get(retryContext.service)
    if (circuitBreaker && circuitBreaker.state === 'OPEN') {
      if (Date.now() < circuitBreaker.nextAttemptTime) {
        return {
          success: false,
          error: new ExternalServiceError(`Circuit breaker is OPEN for service: ${retryContext.service}`),
          attempts: 0,
          totalDelay: 0,
          circuitBreakerTriggered: true,
          metadata: { circuitBreakerState: circuitBreaker.state }
        }
      } else {
        // Transition to HALF_OPEN
        circuitBreaker.state = 'HALF_OPEN'
      }
    }

    let lastError: Error | undefined
    let attempts = 0

    while (attempts <= retryConfig.maxRetries) {
      try {
        retryContext.attempts = attempts

        // Check if error is retryable
        if (lastError && !this.isRetryableError(lastError, retryConfig)) {
          break
        }

        // Execute operation
        const result = await operation()

        // Success - update circuit breaker
        if (circuitBreaker) {
          circuitBreaker.state = 'CLOSED'
          circuitBreaker.failures = 0
        }

        // Record successful retry
        this.recordRetryAttempt(retryContext, true)

        return {
          success: true,
          result,
          attempts: attempts + 1,
          totalDelay: retryContext.totalDelay,
          circuitBreakerTriggered: false,
          metadata: {
            circuitBreakerState: circuitBreaker?.state,
            serviceHealth: this.getServiceHealth(retryContext.service)
          }
        }

      } catch (error) {
        lastError = error as Error
        attempts++

        // Update circuit breaker
        if (circuitBreaker) {
          circuitBreaker.failures++
          circuitBreaker.lastFailureTime = Date.now()

          if (circuitBreaker.failures >= circuitBreaker.threshold) {
            circuitBreaker.state = 'OPEN'
            circuitBreaker.nextAttemptTime = Date.now() + circuitBreaker.resetTimeout
          }
        }

        // Check if we've exhausted retries
        if (attempts > retryConfig.maxRetries) {
          break
        }

        // Calculate delay
        const delay = this.calculateDelay(attempts, retryConfig)
        retryContext.totalDelay += delay

        // Call retry callback
        if (retryConfig.onRetry) {
          retryConfig.onRetry(lastError, attempts, delay)
        }

        // Log retry attempt
        await logger.warn('Retry attempt', {
          attempt: attempts,
          maxRetries: retryConfig.maxRetries,
          delay,
          error: lastError.message,
          context: retryContext
        }, {
          userId: retryContext.userId,
          correlationId: retryContext.correlationId,
          tags: ['retry', 'attempt', retryContext.service],
          source: 'system'
        })

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All retries exhausted
    if (retryConfig.onMaxRetries) {
      retryConfig.onMaxRetries(lastError!, attempts)
    }

    // Record failed retry
    this.recordRetryAttempt(retryContext, false, lastError)

    return {
      success: false,
      error: lastError,
      attempts,
      totalDelay: retryContext.totalDelay,
      circuitBreakerTriggered: circuitBreaker?.state === 'OPEN',
      metadata: {
        circuitBreakerState: circuitBreaker?.state,
        serviceHealth: this.getServiceHealth(retryContext.service)
      }
    }
  }

  private isRetryableError(error: Error, config: RetryConfiguration): boolean {
    // Check custom retry condition
    if (config.retryCondition) {
      return config.retryCondition(error, 0)
    }

    // Check error type
    const errorMessage = error.message.toLowerCase()
    const errorName = error.name.toLowerCase()

    return config.retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError.toLowerCase()) ||
      errorName.includes(retryableError.toLowerCase())
    )
  }

  private calculateDelay(attempt: number, config: RetryConfiguration): number {
    let delay: number

    switch (config.strategy) {
      case RetryStrategy.FIXED:
        delay = config.baseDelay
        break
      case RetryStrategy.LINEAR:
        delay = config.baseDelay + (attempt - 1) * config.backoffFactor * 1000
        break
      case RetryStrategy.EXPONENTIAL:
        delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1)
        break
      case RetryStrategy.FIBONACCI:
        delay = this.fibonacci(attempt) * config.baseDelay
        break
      case RetryStrategy.CUSTOM:
        delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1)
        break
      default:
        delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1)
    }

    // Apply max delay limit
    delay = Math.min(delay, config.maxDelay)

    // Add jitter if enabled
    if (config.jitter) {
      const jitterRange = delay * 0.1 // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterRange
      delay = Math.max(0, delay)
    }

    return Math.round(delay)
  }

  private fibonacci(n: number): number {
    if (n <= 1) return 1
    let a = 1, b = 1
    for (let i = 2; i < n; i++) {
      const temp = a + b
      a = b
      b = temp
    }
    return b
  }

  private recordRetryAttempt(context: RetryContext, success: boolean, error?: Error): void {
    const key = `${context.service}:${context.operation}`
    if (!this.retryHistory.has(key)) {
      this.retryHistory.set(key, [])
    }

    const history = this.retryHistory.get(key)!
    history.push({ ...context, lastError: error })

    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift()
    }
  }

  private getServiceHealth(service: string): ServiceHealthMonitor | undefined {
    return this.serviceHealth.get(service)
  }

  /**
   * Get retry statistics
   */
  getRetryStatistics(
    service?: string,
    operation?: string,
    timeRange?: { start: Date; end: Date }
  ): {
    totalAttempts: number
    successfulAttempts: number
    failedAttempts: number
    averageAttempts: number
    averageDelay: number
    circuitBreakerTrips: number
    topErrors: Array<{ error: string; count: number }>
  } {
    let relevantHistory: RetryContext[] = []

    for (const [key, history] of this.retryHistory.entries()) {
      if (service && !key.startsWith(service)) continue
      if (operation && !key.includes(operation)) continue

      relevantHistory.push(...history)
    }

    if (timeRange) {
      relevantHistory = relevantHistory.filter(h =>
        h.startTime >= timeRange.start.getTime() && h.startTime <= timeRange.end.getTime()
      )
    }

    const totalAttempts = relevantHistory.length
    const successfulAttempts = relevantHistory.filter(h => !h.lastError).length
    const failedAttempts = totalAttempts - successfulAttempts
    const averageAttempts = totalAttempts > 0 ? relevantHistory.reduce((sum, h) => sum + h.attempts, 0) / totalAttempts : 0
    const averageDelay = totalAttempts > 0 ? relevantHistory.reduce((sum, h) => sum + h.totalDelay, 0) / totalAttempts : 0

    // Count circuit breaker trips
    let circuitBreakerTrips = 0
    for (const circuitBreaker of this.circuitBreakers.values()) {
      if (circuitBreaker.state === 'OPEN') {
        circuitBreakerTrips++
      }
    }

    // Count top errors
    const errorCounts = new Map<string, number>()
    for (const context of relevantHistory) {
      if (context.lastError) {
        const errorKey = context.lastError.name || context.lastError.message
        errorCounts.set(errorKey, (errorCounts.get(errorKey) || 0) + 1)
      }
    }

    const topErrors = Array.from(errorCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }))

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      averageAttempts,
      averageDelay,
      circuitBreakerTrips,
      topErrors
    }
  }

  /**
   * Update service health
   */
  updateServiceHealth(service: string, responseTime: number, success: boolean): void {
    const monitor = this.serviceHealth.get(service) || {
      service,
      status: 'healthy',
      lastHealthCheck: new Date(),
      consecutiveFailures: 0,
      averageResponseTime: 0,
      errorRate: 0,
      circuitBreakerState: this.circuitBreakers.get(service)!,
      metadata: {}
    }

    // Update metrics
    monitor.lastHealthCheck = new Date()
    monitor.consecutiveFailures = success ? 0 : monitor.consecutiveFailures + 1

    // Update average response time (simple moving average)
    monitor.averageResponseTime = (monitor.averageResponseTime + responseTime) / 2

    // Update error rate
    const totalRequests = (monitor.metadata.totalRequests as number) || 0
    const errorCount = (monitor.metadata.errorCount as number) || 0
    monitor.errorRate = totalRequests > 0 ? errorCount / totalRequests : 0

    // Update status
    if (monitor.consecutiveFailures >= 5) {
      monitor.status = 'unhealthy'
    } else if (monitor.consecutiveFailures >= 3 || monitor.errorRate > 0.1) {
      monitor.status = 'degraded'
    } else {
      monitor.status = 'healthy'
    }

    // Update metadata
    monitor.metadata.totalRequests = totalRequests + 1
    monitor.metadata.errorCount = errorCount + (success ? 0 : 1)

    this.serviceHealth.set(service, monitor)
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(service: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(service)
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(service: string): void {
    const circuitBreaker = this.circuitBreakers.get(service)
    if (circuitBreaker) {
      circuitBreaker.state = 'CLOSED'
      circuitBreaker.failures = 0
      circuitBreaker.lastFailureTime = 0
      circuitBreaker.nextAttemptTime = 0
    }
  }
}

// Enhanced Retry System
export class EnhancedRetrySystem {
  private static instance: EnhancedRetrySystem
  private retryManager: AdvancedRetryManager
  private recoveryStrategies: Map<string, FailureRecoveryStrategy[]> = new Map()

  constructor() {
    this.retryManager = AdvancedRetryManager.getInstance()
    this.initializeRecoveryStrategies()
  }

  static getInstance(): EnhancedRetrySystem {
    if (!EnhancedRetrySystem.instance) {
      EnhancedRetrySystem.instance = new EnhancedRetrySystem()
    }
    return EnhancedRetrySystem.instance
  }

  private initializeRecoveryStrategies() {
    // Initialize recovery strategies for different error types
    const networkErrorStrategy: FailureRecoveryStrategy = {
      name: 'Network Error Recovery',
      description: 'Recovery strategy for network-related failures',
      applicableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'NetworkError'],
      recoveryActions: [
        {
          type: 'fallback',
          description: 'Use cached data if available',
          parameters: { useCache: true, cacheTimeout: 300000 },
          priority: 1,
          automated: true
        },
        {
          type: 'degraded',
          description: 'Provide degraded functionality',
          parameters: { limitedFeatures: true },
          priority: 2,
          automated: true
        },
        {
          type: 'manual',
          description: 'Manual intervention required',
          parameters: {},
          priority: 3,
          automated: false
        }
      ],
      requiresApproval: false
    }

    const timeoutErrorStrategy: FailureRecoveryStrategy = {
      name: 'Timeout Error Recovery',
      description: 'Recovery strategy for timeout failures',
      applicableErrors: ['TimeoutError', 'ETIMEDOUT'],
      recoveryActions: [
        {
          type: 'fallback',
          description: 'Return default response',
          parameters: { useDefaults: true },
          priority: 1,
          automated: true
        },
        {
          type: 'cache',
          description: 'Use cached response',
          parameters: { cacheKey: 'timeout_fallback' },
          priority: 2,
          automated: true
        }
      ],
      requiresApproval: false
    }

    const rateLimitStrategy: FailureRecoveryStrategy = {
      name: 'Rate Limit Recovery',
      description: 'Recovery strategy for rate limiting',
      applicableErrors: ['RateLimitError', '429'],
      recoveryActions: [
        {
          type: 'cache',
          description: 'Use cached data',
          parameters: { cacheKey: 'rate_limit_cache' },
          priority: 1,
          automated: true
        },
        {
          type: 'degraded',
          description: 'Reduce request frequency',
          parameters: { reduceFrequency: true, delay: 60000 },
          priority: 2,
          automated: true
        }
      ],
      requiresApproval: false
    }

    this.recoveryStrategies.set('network', [networkErrorStrategy])
    this.recoveryStrategies.set('timeout', [timeoutErrorStrategy])
    this.recoveryStrategies.set('rate_limit', [rateLimitStrategy])
  }

  /**
   * Execute operation with comprehensive retry and recovery
   */
  async executeWithRetryAndRecovery<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfiguration> = {},
    context: Partial<RetryContext> = {},
    recoveryEnabled: boolean = true
  ): Promise<RetryResult<T>> {
    const retryResult = await this.retryManager.executeWithRetry(operation, config, context)

    if (!retryResult.success && recoveryEnabled) {
      // Attempt recovery
      const recoveryResult = await this.attemptRecovery(retryResult, context)
      if (recoveryResult.success) {
        return {
          ...retryResult,
          success: true,
          result: recoveryResult.result,
          metadata: {
            ...retryResult.metadata,
            recoveryApplied: true,
            recoveryStrategy: recoveryResult.strategy
          }
        }
      }
    }

    return retryResult
  }

  private async attemptRecovery<T>(
    retryResult: RetryResult<T>,
    context: Partial<RetryContext>
  ): Promise<{ success: boolean; result?: T; strategy?: string }> {
    if (!retryResult.error) {
      return { success: false }
    }

    const errorMessage = retryResult.error.message.toLowerCase()
    const errorName = retryResult.error.name.toLowerCase()

    // Find applicable recovery strategies
    for (const [strategyKey, strategies] of this.recoveryStrategies.entries()) {
      for (const strategy of strategies) {
        const isApplicable = strategy.applicableErrors.some(errorType =>
          errorMessage.includes(errorType.toLowerCase()) ||
          errorName.includes(errorType.toLowerCase())
        )

        if (isApplicable) {
          // Try recovery actions in priority order
          for (const action of strategy.recoveryActions.sort((a, b) => a.priority - b.priority)) {
            try {
              const result = await this.executeRecoveryAction(action, context, retryResult.error)
              if (result !== undefined) {
                return {
                  success: true,
                  result: result as T,
                  strategy: strategy.name
                }
              }
            } catch (error) {
              // Continue to next recovery action
              continue
            }
          }
        }
      }
    }

    return { success: false }
  }

  private async executeRecoveryAction<T>(
    action: any,
    context: Partial<RetryContext>,
    error: Error
  ): Promise<T | undefined> {
    switch (action.type) {
      case 'fallback':
        if (action.parameters.useDefaults) {
          // Return default/fallback response
          return this.getFallbackResponse(context.operation || 'unknown') as T
        }
        break

      case 'cache':
        // Try to get cached response
        return this.getCachedResponse(context.operation || 'unknown', action.parameters.cacheKey) as T

      case 'degraded':
        if (action.parameters.limitedFeatures) {
          // Return degraded response
          return this.getDegradedResponse(context.operation || 'unknown') as T
        }
        break

      case 'skip':
        // Skip the operation and return undefined
        return undefined
    }

    return undefined
  }

  private getFallbackResponse(operation: string): any {
    // Return appropriate fallback based on operation
    const fallbacks: Record<string, any> = {
      'lead_scoring': { score: 0, confidence: 0, error: 'Service unavailable' },
      'data_enrichment': { enriched: false, error: 'Service unavailable' },
      'email_validation': { valid: false, error: 'Service unavailable' },
      'company_lookup': { found: false, error: 'Service unavailable' }
    }

    return fallbacks[operation] || { error: 'Service unavailable' }
  }

  private getCachedResponse(operation: string, cacheKey: string): any {
    // This would retrieve from cache
    // For simulation, return fallback
    return this.getFallbackResponse(operation)
  }

  private getDegradedResponse(operation: string): any {
    // Return degraded functionality response
    return {
      degraded: true,
      limited: true,
      error: 'Operating in degraded mode'
    }
  }

  /**
   * Get retry statistics
   */
  getRetryStatistics(
    service?: string,
    operation?: string,
    timeRange?: { start: Date; end: Date }
  ) {
    return this.retryManager.getRetryStatistics(service, operation, timeRange)
  }

  /**
   * Get service health
   */
  getServiceHealth(service: string) {
    return this.retryManager['serviceHealth'].get(service)
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(service: string) {
    return this.retryManager.getCircuitBreakerStatus(service)
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(service: string): void {
    this.retryManager.resetCircuitBreaker(service)
  }

  /**
   * Update service health
   */
  updateServiceHealth(service: string, responseTime: number, success: boolean): void {
    this.retryManager['updateServiceHealth'](service, responseTime, success)
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(strategy: FailureRecoveryStrategy): void {
    if (!this.recoveryStrategies.has(strategy.name)) {
      this.recoveryStrategies.set(strategy.name, [])
    }
    this.recoveryStrategies.get(strategy.name)!.push(strategy)
  }

  /**
   * Remove recovery strategy
   */
  removeRecoveryStrategy(strategyName: string): void {
    this.recoveryStrategies.delete(strategyName)
  }
}

// Export singleton instance
export const retrySystem = EnhancedRetrySystem.getInstance()
export default retrySystem