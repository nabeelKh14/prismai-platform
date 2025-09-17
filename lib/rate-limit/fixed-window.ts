import { NextRequest } from 'next/server'
import { cache, createCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { RateLimitInfo } from './types'

interface FixedWindowConfig {
  maxRequests: number
  windowMs: number
  burstAllowance?: number // Allow burst requests above the limit
  keyGenerator?: (request: NextRequest) => string
}

export class EnhancedFixedWindowRateLimiter {
  private config: Required<FixedWindowConfig>

  constructor(config: FixedWindowConfig) {
    this.config = {
      burstAllowance: 0,
      keyGenerator: (request) => this.getDefaultKey(request),
      ...config,
    }
  }

  private getDefaultKey(request: NextRequest): string {
    const ip = this.getClientIP(request)
    return createCacheKey('fixed-window', ip)
  }

  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfIP = request.headers.get('cf-connecting-ip')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    return realIP || cfIP || 'unknown'
  }

  async checkLimit(request: NextRequest): Promise<RateLimitInfo> {
    const key = this.config.keyGenerator(request)
    const now = Date.now()

    // Calculate current window
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs
    const windowEnd = windowStart + this.config.windowMs
    const resetTime = windowEnd

    try {
      // Get current window data from cache
      const windowKey = `${key}:${windowStart}`
      const cached = await cache.get<{ count: number; firstRequest: number }>(windowKey)

      const count = cached?.count || 0
      const effectiveLimit = this.config.maxRequests + this.config.burstAllowance

      // Calculate remaining requests
      const remaining = Math.max(0, effectiveLimit - count)

      return {
        count,
        resetTime,
        remaining,
        windowStart,
        windowEnd,
      }
    } catch (error) {
      logger.error('Error checking fixed window limit', error as Error, { key })
      // On error, allow request but log it
      return {
        count: 0,
        resetTime,
        remaining: this.config.maxRequests,
        windowStart,
        windowEnd,
      }
    }
  }

  async recordRequest(request: NextRequest): Promise<RateLimitInfo> {
    const key = this.config.keyGenerator(request)
    const now = Date.now()

    // Calculate current window
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs
    const windowEnd = windowStart + this.config.windowMs
    const resetTime = windowEnd
    const windowKey = `${key}:${windowStart}`

    try {
      // Get current window data
      const cached = await cache.get<{ count: number; firstRequest: number }>(windowKey)
      const currentCount = cached?.count || 0

      // Increment count
      const newCount = currentCount + 1

      // Store updated data
      const windowData = {
        count: newCount,
        firstRequest: cached?.firstRequest || now,
      }

      // Set TTL to cover the remaining window time plus some buffer
      const ttl = Math.ceil((windowEnd - now) / 1000) + 60 // Add 60 seconds buffer
      await cache.set(windowKey, windowData, ttl * 1000)

      // Calculate remaining requests
      const effectiveLimit = this.config.maxRequests + this.config.burstAllowance
      const remaining = Math.max(0, effectiveLimit - newCount)

      return {
        count: newCount,
        resetTime,
        remaining,
        windowStart,
        windowEnd,
      }
    } catch (error) {
      logger.error('Error recording request in fixed window', error as Error, { key })
      throw error
    }
  }

  async isLimitExceeded(request: NextRequest): Promise<boolean> {
    const info = await this.checkLimit(request)
    return info.count >= this.config.maxRequests
  }

  async isBurstExceeded(request: NextRequest): Promise<boolean> {
    const info = await this.checkLimit(request)
    const effectiveLimit = this.config.maxRequests + this.config.burstAllowance
    return info.count >= effectiveLimit
  }

  async getRemainingRequests(request: NextRequest): Promise<number> {
    const info = await this.checkLimit(request)
    return info.remaining
  }

  async getResetTime(request: NextRequest): Promise<number> {
    const info = await this.checkLimit(request)
    return info.resetTime
  }

  // Get burst usage information
  async getBurstInfo(request: NextRequest): Promise<{
    currentUsage: number
    burstLimit: number
    burstRemaining: number
    isInBurst: boolean
  }> {
    const info = await this.checkLimit(request)
    const burstLimit = this.config.burstAllowance
    const burstRemaining = Math.max(0, burstLimit - Math.max(0, info.count - this.config.maxRequests))
    const isInBurst = info.count > this.config.maxRequests

    return {
      currentUsage: Math.max(0, info.count - this.config.maxRequests),
      burstLimit,
      burstRemaining,
      isInBurst,
    }
  }

  // Clean up old windows (can be called periodically)
  async cleanup(): Promise<void> {
    // This would need to be implemented with a more sophisticated cleanup mechanism
    // For now, rely on TTL expiration
    logger.debug('Fixed window cleanup called (no-op)')
  }

  // Get statistics for monitoring
  async getStats(request: NextRequest): Promise<{
    requestCount: number
    remaining: number
    resetTime: number
    windowStart: number
    windowEnd: number
    burstInfo: {
      currentUsage: number
      burstLimit: number
      burstRemaining: number
      isInBurst: boolean
    }
  }> {
    const info = await this.checkLimit(request)
    const burstInfo = await this.getBurstInfo(request)

    return {
      requestCount: info.count,
      remaining: info.remaining,
      resetTime: info.resetTime,
      windowStart: info.windowStart!,
      windowEnd: info.windowEnd!,
      burstInfo,
    }
  }
}