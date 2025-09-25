import { logger } from '@/lib/logger'
import { CRMErrorType, CRMErrorSeverity } from './error-handler'

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Circuit is open, requests fail fast
  HALF_OPEN = 'half_open' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number      // Number of failures before opening circuit
  recoveryTimeout: number       // Time to wait before trying half-open (ms)
  monitoringPeriod: number      // Time window to count failures (ms)
  successThreshold: number      // Number of successes needed in half-open to close
  name: string                  // Circuit breaker name for logging
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  lastStateChange: Date
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private lastStateChange: Date = new Date()
  private nextAttemptTime: number = 0

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker is OPEN for ${this.config.name}. Next retry at ${new Date(this.nextAttemptTime)}`)
      } else {
        // Transition to half-open
        this.transitionTo(CircuitState.HALF_OPEN)
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error as Error)
      throw error
    }
  }

  private onSuccess(): void {
    this.successCount++
    this.lastSuccessTime = new Date()

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED)
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.resetFailureCount()
    }
  }

  private onFailure(error: Error): void {
    this.failureCount++
    this.lastFailureTime = new Date()

    if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpenCircuit()) {
        this.transitionTo(CircuitState.OPEN)
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open immediately opens the circuit
      this.transitionTo(CircuitState.OPEN)
    }
  }

  private shouldOpenCircuit(): boolean {
    return this.failureCount >= this.config.failureThreshold
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state
    this.state = newState
    this.lastStateChange = new Date()

    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
      logger.warn('Circuit breaker opened', {
        name: this.config.name,
        oldState,
        newState,
        failureCount: this.failureCount,
        nextAttemptTime: new Date(this.nextAttemptTime)
      })
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0
      logger.info('Circuit breaker half-open', {
        name: this.config.name,
        oldState,
        newState
      })
    } else if (newState === CircuitState.CLOSED) {
      this.resetFailureCount()
      logger.info('Circuit breaker closed', {
        name: this.config.name,
        oldState,
        newState
      })
    }
  }

  private resetFailureCount(): void {
    this.failureCount = 0
    this.successCount = 0
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange
    }
  }

  getState(): CircuitState {
    return this.state
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN
  }

  // Force state transitions (useful for testing and manual recovery)
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN)
  }

  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED)
  }

  forceHalfOpen(): void {
    this.transitionTo(CircuitState.HALF_OPEN)
  }
}

export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager
  private breakers: Map<string, CircuitBreaker> = new Map()

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager()
    }
    return CircuitBreakerManager.instance
  }

  getOrCreateBreaker(
    name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        successThreshold: 3,
        name,
        ...config
      }

      this.breakers.set(name, new CircuitBreaker(defaultConfig))
    }

    return this.breakers.get(name)!
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name)
  }

  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers)
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {}
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats()
    }
    return stats
  }

  removeBreaker(name: string): boolean {
    return this.breakers.delete(name)
  }

  // Create provider-specific circuit breakers
  getProviderBreaker(provider: string, operation: string): CircuitBreaker {
    const breakerName = `crm_${provider}_${operation}`
    return this.getOrCreateBreaker(breakerName, {
      name: breakerName,
      failureThreshold: this.getProviderFailureThreshold(provider),
      recoveryTimeout: this.getProviderRecoveryTimeout(provider)
    })
  }

  private getProviderFailureThreshold(provider: string): number {
    // Different providers may have different reliability characteristics
    const thresholds: Record<string, number> = {
      'salesforce': 3,  // More reliable, lower threshold
      'hubspot': 5,     // Standard threshold
      'pipedrive': 4    // Moderately reliable
    }
    return thresholds[provider] || 5
  }

  private getProviderRecoveryTimeout(provider: string): number {
    // Different recovery times based on provider characteristics
    const timeouts: Record<string, number> = {
      'salesforce': 30000,  // 30 seconds - faster recovery
      'hubspot': 60000,     // 1 minute - standard
      'pipedrive': 90000    // 1.5 minutes - slower recovery
    }
    return timeouts[provider] || 60000
  }

  // Health check for all circuit breakers
  async getHealthStatus(): Promise<{
    healthy: number
    degraded: number
    failed: number
    details: Record<string, { state: CircuitState; health: 'healthy' | 'degraded' | 'failed' }>
  }> {
    let healthy = 0
    let degraded = 0
    let failed = 0
    const details: Record<string, { state: CircuitState; health: 'healthy' | 'degraded' | 'failed' }> = {}

    for (const [name, breaker] of this.breakers) {
      const state = breaker.getState()
      let health: 'healthy' | 'degraded' | 'failed'

      if (state === CircuitState.CLOSED) {
        healthy++
        health = 'healthy'
      } else if (state === CircuitState.HALF_OPEN) {
        degraded++
        health = 'degraded'
      } else {
        failed++
        health = 'failed'
      }

      details[name] = { state, health }
    }

    return { healthy, degraded, failed, details }
  }
}

// Export singleton instance
export const circuitBreakerManager = CircuitBreakerManager.getInstance()