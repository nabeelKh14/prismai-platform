import { logger } from '@/lib/logger'
import { CRMError, CRMErrorType, CRMErrorContext } from './error-handler'
import { CircuitBreaker, circuitBreakerManager } from './circuit-breaker'

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number          // Base delay in milliseconds
  maxDelay: number           // Maximum delay in milliseconds
  backoffMultiplier: number  // Exponential backoff multiplier
  jitter: boolean            // Add random jitter to delays
  retryableErrors: CRMErrorType[]  // Which error types should be retried
  circuitBreakerName?: string      // Circuit breaker to use
}

export interface RetryState {
  attempt: number
  totalDelay: number
  lastError?: CRMError
  startTime: Date
}

export class RetryMechanism {
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,        // 1 second
      maxDelay: 30000,        // 30 seconds
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        CRMErrorType.NETWORK_ERROR,
        CRMErrorType.TIMEOUT_ERROR,
        CRMErrorType.SERVICE_UNAVAILABLE,
        CRMErrorType.RATE_LIMIT_ERROR
      ],
      ...config
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: CRMErrorContext,
    circuitBreaker?: CircuitBreaker
  ): Promise<T> {
    const retryState: RetryState = {
      attempt: 0,
      totalDelay: 0,
      startTime: new Date()
    }

    while (retryState.attempt < this.config.maxAttempts) {
      retryState.attempt++

      try {
        // Execute the operation through circuit breaker if provided
        const result = circuitBreaker
          ? await circuitBreaker.execute(operation)
          : await operation()

        // Success - log if this was a retry
        if (retryState.attempt > 1) {
          logger.info('Operation succeeded after retry', {
            provider: context.provider,
            operation: context.operation,
            attempts: retryState.attempt,
            totalDelay: retryState.totalDelay
          })
        }

        return result

      } catch (error) {
        const crmError = error instanceof CRMError ? error : new CRMError(
          this.classifyError(error as Error),
          (error as Error).message,
          { ...context, retryCount: retryState.attempt - 1 },
          error as Error
        )

        retryState.lastError = crmError

        // Check if error is retryable
        if (!this.isRetryableError(crmError)) {
          logger.info('Non-retryable error encountered', {
            provider: context.provider,
            operation: context.operation,
            errorType: crmError.type,
            attempt: retryState.attempt
          })
          throw crmError
        }

        // Check if we've exhausted all attempts
        if (retryState.attempt >= this.config.maxAttempts) {
          logger.error('Max retry attempts exhausted', {
            provider: context.provider,
            operation: context.operation,
            attempts: retryState.attempt,
            totalDelay: retryState.totalDelay,
            finalError: crmError.type
          })
          throw crmError
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(retryState.attempt)
        retryState.totalDelay += delay

        logger.warn('Retrying operation after error', {
          provider: context.provider,
          operation: context.operation,
          attempt: retryState.attempt,
          maxAttempts: this.config.maxAttempts,
          errorType: crmError.type,
          delay,
          totalDelay: retryState.totalDelay
        })

        await this.delay(delay)
      }
    }

    // This should never be reached, but just in case
    throw retryState.lastError || new Error('Retry mechanism failed')
  }

  private classifyError(error: Error): CRMErrorType {
    const message = error.message.toLowerCase()

    if (message.includes('timeout') || message.includes('timed out')) {
      return CRMErrorType.TIMEOUT_ERROR
    }
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return CRMErrorType.NETWORK_ERROR
    }
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return CRMErrorType.RATE_LIMIT_ERROR
    }
    if (message.includes('service unavailable') || message.includes('503')) {
      return CRMErrorType.SERVICE_UNAVAILABLE
    }

    return CRMErrorType.UNKNOWN_ERROR
  }

  private isRetryableError(error: CRMError): boolean {
    return this.config.retryableErrors.includes(error.type)
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ (attempt - 1))
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)

    // Cap at maxDelay
    delay = Math.min(delay, this.config.maxDelay)

    // Add jitter if enabled
    if (this.config.jitter) {
      // Add random jitter between 0 and 25% of the delay
      const jitterAmount = delay * 0.25 * Math.random()
      delay += jitterAmount
    }

    return Math.round(delay)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Configuration methods
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig(): RetryConfig {
    return { ...this.config }
  }

  // Static factory methods for common retry strategies
  static createConservativeRetry(): RetryMechanism {
    return new RetryMechanism({
      maxAttempts: 2,
      baseDelay: 2000,
      maxDelay: 10000,
      backoffMultiplier: 1.5,
      retryableErrors: [
        CRMErrorType.NETWORK_ERROR,
        CRMErrorType.TIMEOUT_ERROR
      ]
    })
  }

  static createAggressiveRetry(): RetryMechanism {
    return new RetryMechanism({
      maxAttempts: 5,
      baseDelay: 500,
      maxDelay: 60000,
      backoffMultiplier: 2.5,
      retryableErrors: [
        CRMErrorType.NETWORK_ERROR,
        CRMErrorType.TIMEOUT_ERROR,
        CRMErrorType.SERVICE_UNAVAILABLE,
        CRMErrorType.RATE_LIMIT_ERROR
      ]
    })
  }

  static createProviderSpecificRetry(provider: string): RetryMechanism {
    const providerConfigs: Record<string, Partial<RetryConfig>> = {
      'salesforce': {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 15000,
        backoffMultiplier: 2,
        retryableErrors: [
          CRMErrorType.NETWORK_ERROR,
          CRMErrorType.TIMEOUT_ERROR,
          CRMErrorType.RATE_LIMIT_ERROR
        ]
      },
      'hubspot': {
        maxAttempts: 4,
        baseDelay: 800,
        maxDelay: 30000,
        backoffMultiplier: 2.2,
        retryableErrors: [
          CRMErrorType.NETWORK_ERROR,
          CRMErrorType.TIMEOUT_ERROR,
          CRMErrorType.SERVICE_UNAVAILABLE,
          CRMErrorType.RATE_LIMIT_ERROR
        ]
      },
      'pipedrive': {
        maxAttempts: 3,
        baseDelay: 1500,
        maxDelay: 20000,
        backoffMultiplier: 1.8,
        retryableErrors: [
          CRMErrorType.NETWORK_ERROR,
          CRMErrorType.TIMEOUT_ERROR,
          CRMErrorType.SERVICE_UNAVAILABLE
        ]
      }
    }

    return new RetryMechanism(providerConfigs[provider] || {})
  }
}

export class RetryManager {
  private static instance: RetryManager
  private retryMechanisms: Map<string, RetryMechanism> = new Map()
  private defaultMechanism: RetryMechanism

  constructor() {
    this.defaultMechanism = new RetryMechanism()
  }

  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager()
    }
    return RetryManager.instance
  }

  getRetryMechanism(name: string): RetryMechanism {
    if (!this.retryMechanisms.has(name)) {
      this.retryMechanisms.set(name, this.defaultMechanism)
    }
    return this.retryMechanisms.get(name)!
  }

  setRetryMechanism(name: string, mechanism: RetryMechanism): void {
    this.retryMechanisms.set(name, mechanism)
  }

  getProviderRetryMechanism(provider: string): RetryMechanism {
    const mechanismName = `provider_${provider}`
    return this.getRetryMechanism(mechanismName)
  }

  setProviderRetryMechanism(provider: string, mechanism: RetryMechanism): void {
    const mechanismName = `provider_${provider}`
    this.setRetryMechanism(mechanismName, mechanism)
  }

  // Execute with provider-specific retry logic
  async executeWithProviderRetry<T>(
    provider: string,
    operation: string,
    operationFn: () => Promise<T>,
    context: CRMErrorContext
  ): Promise<T> {
    const mechanism = this.getProviderRetryMechanism(provider)
    const circuitBreaker = circuitBreakerManager.getProviderBreaker(provider, operation)

    return mechanism.executeWithRetry(operationFn, context, circuitBreaker)
  }

  // Get retry statistics
  getRetryStats(): Record<string, {
    config: RetryConfig
    activeRetries: number
    totalRetries: number
    averageDelay: number
  }> {
    const stats: Record<string, any> = {}

    for (const [name, mechanism] of this.retryMechanisms) {
      stats[name] = {
        config: mechanism.getConfig(),
        // Note: These would need to be tracked in the actual implementation
        activeRetries: 0,
        totalRetries: 0,
        averageDelay: 0
      }
    }

    return stats
  }
}

// Export singleton instance
export const retryManager = RetryManager.getInstance()