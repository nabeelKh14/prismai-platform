import { logger } from '@/lib/logger'
import { CRMError, CRMErrorType, crmErrorHandler } from './error-handler'
import { circuitBreakerManager } from './circuit-breaker'

export interface CRMProviderLimits {
  requestsPerSecond: number
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  burstLimit: number
  concurrentRequests: number
}

export interface RateLimitConfig {
  provider: string
  operation: string
  limits: CRMProviderLimits
  adaptiveLimits: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  backoffStrategy: 'linear' | 'exponential' | 'adaptive'
}

export interface RateLimitStatus {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
  backoffDelay?: number
}

export class CRMProviderRateLimiter {
  private config: RateLimitConfig
  private requestCounts: Map<string, number[]> = new Map() // Key -> [timestamps]
  private concurrentRequests: number = 0
  private maxConcurrentRequests: number
  private lastRateLimitHit: Date = new Date(0)
  private adaptiveMode: boolean = false

  constructor(config: RateLimitConfig) {
    this.config = config
    this.maxConcurrentRequests = config.limits.concurrentRequests
  }

  async checkRateLimit(operation: string, priority: string = 'medium'): Promise<RateLimitStatus> {
    const now = Date.now()
    const key = `${this.config.provider}:${operation}:${priority}`

    // Check concurrent request limit
    if (this.concurrentRequests >= this.maxConcurrentRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + 1000, // 1 second
        retryAfter: 1000,
        backoffDelay: this.calculateBackoffDelay()
      }
    }

    // Check rate limits
    const rateLimitCheck = this.checkRateLimits(key, now)
    if (!rateLimitCheck.allowed) {
      this.lastRateLimitHit = new Date()
      return rateLimitCheck
    }

    // Record the request
    this.recordRequest(key, now)

    return {
      allowed: true,
      remaining: rateLimitCheck.remaining,
      resetTime: rateLimitCheck.resetTime
    }
  }

  private checkRateLimits(key: string, now: number): RateLimitStatus {
    const windows = [
      { duration: 1000, maxRequests: this.config.limits.requestsPerSecond },    // Per second
      { duration: 60000, maxRequests: this.config.limits.requestsPerMinute },   // Per minute
      { duration: 3600000, maxRequests: this.config.limits.requestsPerHour },   // Per hour
      { duration: 86400000, maxRequests: this.config.limits.requestsPerDay }    // Per day
    ]

    for (const window of windows) {
      const cutoff = now - window.duration
      const requests = this.getRequestsInWindow(key, cutoff, now)

      if (requests >= window.maxRequests) {
        const resetTime = this.getNextResetTime(key, window.duration)
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.max(resetTime - now, 1000),
          backoffDelay: this.calculateBackoffDelay()
        }
      }
    }

    // Calculate remaining requests (using the most restrictive window)
    const mostRestrictive = windows[0] // Per second is usually most restrictive
    const requests = this.getRequestsInWindow(key, now - mostRestrictive.duration, now)
    const remaining = Math.max(0, mostRestrictive.maxRequests - requests)

    return {
      allowed: true,
      remaining,
      resetTime: now + mostRestrictive.duration
    }
  }

  private getRequestsInWindow(key: string, startTime: number, endTime: number): number {
    const requests = this.requestCounts.get(key) || []
    return requests.filter(timestamp => timestamp >= startTime && timestamp <= endTime).length
  }

  private recordRequest(key: string, timestamp: number): void {
    const requests = this.requestCounts.get(key) || []
    requests.push(timestamp)

    // Clean old requests (keep last 24 hours)
    const cutoff = timestamp - 86400000
    const filteredRequests = requests.filter(ts => ts >= cutoff)

    this.requestCounts.set(key, filteredRequests)
  }

  private getNextResetTime(key: string, windowDuration: number): number {
    const requests = this.requestCounts.get(key) || []
    if (requests.length === 0) return Date.now() + windowDuration

    // Find the oldest request in the current window
    const now = Date.now()
    const cutoff = now - windowDuration
    const windowRequests = requests.filter(ts => ts >= cutoff)

    if (windowRequests.length === 0) return now + windowDuration

    // Return the time when the oldest request in the window will expire
    const oldestInWindow = Math.min(...windowRequests)
    return oldestInWindow + windowDuration
  }

  private calculateBackoffDelay(): number {
    const timeSinceLastHit = Date.now() - this.lastRateLimitHit.getTime()
    const baseDelay = 1000 // 1 second

    if (this.config.backoffStrategy === 'exponential') {
      const exponentialDelay = baseDelay * Math.pow(2, Math.floor(timeSinceLastHit / 60000)) // Double every minute
      return Math.min(exponentialDelay, 30000) // Cap at 30 seconds
    } else if (this.config.backoffStrategy === 'adaptive') {
      // Adaptive backoff based on recent rate limit frequency
      const recentHits = this.getRecentRateLimitHits(300000) // Last 5 minutes
      const adaptiveDelay = baseDelay * (1 + recentHits * 0.5)
      return Math.min(adaptiveDelay, 15000) // Cap at 15 seconds
    }

    // Linear backoff
    return Math.min(baseDelay + (timeSinceLastHit / 1000), 10000)
  }

  private getRecentRateLimitHits(timeWindow: number): number {
    // This would track recent rate limit hits for adaptive behavior
    // For now, return a simple estimate
    return 0
  }

  // Adaptive rate limiting based on provider health
  async updateLimitsBasedOnHealth(healthScore: number): Promise<void> {
    if (!this.config.adaptiveLimits) return

    const baseLimits = this.config.limits

    if (healthScore < 0.5) {
      // Reduce limits when provider is unhealthy
      this.config.limits.requestsPerSecond = Math.floor(baseLimits.requestsPerSecond * 0.5)
      this.config.limits.requestsPerMinute = Math.floor(baseLimits.requestsPerMinute * 0.5)
      this.maxConcurrentRequests = Math.floor(baseLimits.concurrentRequests * 0.5)
      this.adaptiveMode = true
    } else if (healthScore > 0.8 && this.adaptiveMode) {
      // Restore limits when provider recovers
      this.config.limits = { ...baseLimits }
      this.maxConcurrentRequests = baseLimits.concurrentRequests
      this.adaptiveMode = false
    }
  }

  getCurrentLimits(): CRMProviderLimits {
    return { ...this.config.limits }
  }

  getStats(): {
    concurrentRequests: number
    maxConcurrentRequests: number
    adaptiveMode: boolean
    lastRateLimitHit: Date
    requestCounts: Record<string, number>
  } {
    const requestCounts: Record<string, number> = {}
    for (const [key, requests] of this.requestCounts) {
      requestCounts[key] = requests.length
    }

    return {
      concurrentRequests: this.concurrentRequests,
      maxConcurrentRequests: this.maxConcurrentRequests,
      adaptiveMode: this.adaptiveMode,
      lastRateLimitHit: this.lastRateLimitHit,
      requestCounts
    }
  }
}

export class CRMProviderRateLimitManager {
  private static instance: CRMProviderRateLimitManager
  private rateLimiters: Map<string, CRMProviderRateLimiter> = new Map()
  private providerConfigs: Map<string, RateLimitConfig> = new Map()

  static getInstance(): CRMProviderRateLimitManager {
    if (!CRMProviderRateLimitManager.instance) {
      CRMProviderRateLimitManager.instance = new CRMProviderRateLimitManager()
    }
    return CRMProviderRateLimitManager.instance
  }

  constructor() {
    this.initializeDefaultConfigs()
  }

  private initializeDefaultConfigs(): void {
    const defaultConfigs: Record<string, RateLimitConfig> = {
      'salesforce': {
        provider: 'salesforce',
        operation: 'default',
        limits: {
          requestsPerSecond: 10,
          requestsPerMinute: 500,
          requestsPerHour: 10000,
          requestsPerDay: 100000,
          burstLimit: 50,
          concurrentRequests: 10
        },
        adaptiveLimits: true,
        priority: 'high',
        backoffStrategy: 'adaptive'
      },
      'hubspot': {
        provider: 'hubspot',
        operation: 'default',
        limits: {
          requestsPerSecond: 5,
          requestsPerMinute: 120,
          requestsPerHour: 5000,
          requestsPerDay: 50000,
          burstLimit: 20,
          concurrentRequests: 5
        },
        adaptiveLimits: true,
        priority: 'high',
        backoffStrategy: 'exponential'
      },
      'pipedrive': {
        provider: 'pipedrive',
        operation: 'default',
        limits: {
          requestsPerSecond: 3,
          requestsPerMinute: 100,
          requestsPerHour: 2000,
          requestsPerDay: 20000,
          burstLimit: 15,
          concurrentRequests: 3
        },
        adaptiveLimits: true,
        priority: 'medium',
        backoffStrategy: 'linear'
      }
    }

    for (const [provider, config] of Object.entries(defaultConfigs)) {
      this.providerConfigs.set(provider, config)
    }
  }

  getRateLimiter(provider: string, operation: string = 'default'): CRMProviderRateLimiter {
    const key = `${provider}:${operation}`

    if (!this.rateLimiters.has(key)) {
      const config = this.providerConfigs.get(provider)
      if (!config) {
        throw new Error(`No rate limit configuration found for provider: ${provider}`)
      }

      const operationConfig = {
        ...config,
        operation,
        limits: { ...config.limits }
      }

      this.rateLimiters.set(key, new CRMProviderRateLimiter(operationConfig))
    }

    return this.rateLimiters.get(key)!
  }

  async checkRateLimit(
    provider: string,
    operation: string,
    priority: string = 'medium'
  ): Promise<RateLimitStatus> {
    try {
      const limiter = this.getRateLimiter(provider, operation)
      return await limiter.checkRateLimit(operation, priority)
    } catch (error) {
      logger.error('Rate limit check failed', {
        provider,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      // Fail open - allow request if rate limiter fails
      return {
        allowed: true,
        remaining: 1,
        resetTime: Date.now() + 60000
      }
    }
  }

  // Update provider health and adjust limits accordingly
  async updateProviderHealth(provider: string, healthScore: number): Promise<void> {
    try {
      const config = this.providerConfigs.get(provider)
      if (!config?.adaptiveLimits) return

      // Update all rate limiters for this provider
      for (const [key, limiter] of this.rateLimiters) {
        if (key.startsWith(`${provider}:`)) {
          await limiter.updateLimitsBasedOnHealth(healthScore)
        }
      }

      logger.info('Updated provider rate limits based on health', {
        provider,
        healthScore,
        adaptiveMode: config.adaptiveLimits
      })
    } catch (error) {
      logger.error('Failed to update provider health', {
        provider,
        healthScore,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Get rate limit status for all providers
  getAllRateLimitStats(): Record<string, any> {
    const stats: Record<string, any> = {}

    for (const [key, limiter] of this.rateLimiters) {
      stats[key] = limiter.getStats()
    }

    return stats
  }

  // Configure custom limits for a provider
  setProviderLimits(
    provider: string,
    limits: Partial<CRMProviderLimits>,
    adaptiveLimits: boolean = true
  ): void {
    const existingConfig = this.providerConfigs.get(provider)
    if (!existingConfig) {
      throw new Error(`Provider ${provider} not found in configuration`)
    }

    const updatedConfig = {
      ...existingConfig,
      limits: { ...existingConfig.limits, ...limits },
      adaptiveLimits
    }

    this.providerConfigs.set(provider, updatedConfig)

    // Update existing rate limiters
    for (const [key, limiter] of this.rateLimiters) {
      if (key.startsWith(`${provider}:`)) {
        // Recreate limiter with new config
        const operation = key.split(':')[1]
        const newLimiter = new CRMProviderRateLimiter({
          ...updatedConfig,
          operation
        })
        this.rateLimiters.set(key, newLimiter)
      }
    }

    logger.info('Updated provider rate limits', {
      provider,
      limits,
      adaptiveLimits
    })
  }

  // Get provider configuration
  getProviderConfig(provider: string): RateLimitConfig | undefined {
    return this.providerConfigs.get(provider)
  }

  // Reset rate limits for a provider (useful for testing)
  resetProviderLimits(provider: string): void {
    for (const [key] of this.rateLimiters) {
      if (key.startsWith(`${provider}:`)) {
        this.rateLimiters.delete(key)
      }
    }

    logger.info('Reset rate limits for provider', { provider })
  }
}

// Export singleton instance
export const crmRateLimitManager = CRMProviderRateLimitManager.getInstance()