import { NextRequest } from 'next/server'
import { cache, createCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { RateLimitInfo } from './types'

interface SlidingWindowConfig {
  maxRequests: number
  windowMs: number
  keyGenerator?: (request: NextRequest) => string
}

export class EnhancedSlidingWindowRateLimiter {
  private config: Required<SlidingWindowConfig>

  constructor(config: SlidingWindowConfig) {
    this.config = {
      keyGenerator: (request) => this.getDefaultKey(request),
      ...config,
    }
  }

  private getDefaultKey(request: NextRequest): string {
    const ip = this.getClientIP(request)
    return createCacheKey('sliding-window', ip)
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
    const windowStart = now - this.config.windowMs

    try {
      // Get request timestamps from cache
      const timestamps = await this.getTimestamps(key)

      // Filter out old timestamps and count valid requests
      const validTimestamps = timestamps.filter(ts => ts > windowStart)
      const requestCount = validTimestamps.length

      // Calculate remaining requests
      const remaining = Math.max(0, this.config.maxRequests - requestCount)

      // Calculate reset time (when the oldest request will expire)
      const resetTime = validTimestamps.length > 0
        ? validTimestamps[0] + this.config.windowMs
        : now + this.config.windowMs

      return {
        count: requestCount,
        resetTime,
        remaining,
        windowStart,
        windowEnd: now,
      }
    } catch (error) {
      logger.error('Error checking sliding window limit', error as Error, { key })
      // On error, allow request but log it
      return {
        count: 0,
        resetTime: now + this.config.windowMs,
        remaining: this.config.maxRequests,
        windowStart,
        windowEnd: now,
      }
    }
  }

  async recordRequest(request: NextRequest): Promise<RateLimitInfo> {
    const key = this.config.keyGenerator(request)
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    try {
      // Get current timestamps
      const timestamps = await this.getTimestamps(key)

      // Add new timestamp and filter old ones
      const updatedTimestamps = [...timestamps, now]
        .filter(ts => ts > windowStart)
        .sort((a, b) => a - b) // Keep sorted for easier oldest request tracking

      // Keep only the most recent requests up to maxRequests + buffer
      const maxStored = this.config.maxRequests * 2 // Store extra for accuracy
      const trimmedTimestamps = updatedTimestamps.slice(-maxStored)

      // Store back to cache with TTL
      await cache.set(key, trimmedTimestamps, this.config.windowMs * 2)

      // Return updated limit info
      const requestCount = trimmedTimestamps.length
      const remaining = Math.max(0, this.config.maxRequests - requestCount)
      const resetTime = trimmedTimestamps.length > 0
        ? trimmedTimestamps[0] + this.config.windowMs
        : now + this.config.windowMs

      return {
        count: requestCount,
        resetTime,
        remaining,
        windowStart,
        windowEnd: now,
      }
    } catch (error) {
      logger.error('Error recording request in sliding window', error as Error, { key })
      throw error
    }
  }

  async isLimitExceeded(request: NextRequest): Promise<boolean> {
    const info = await this.checkLimit(request)
    return info.count >= this.config.maxRequests
  }

  async getRemainingRequests(request: NextRequest): Promise<number> {
    const info = await this.checkLimit(request)
    return info.remaining
  }

  async getResetTime(request: NextRequest): Promise<number> {
    const info = await this.checkLimit(request)
    return info.resetTime
  }

  // Clean up old entries (can be called periodically)
  async cleanup(): Promise<void> {
    // This would need to be implemented with a more sophisticated cache cleanup
    // For now, rely on TTL expiration
    logger.debug('Sliding window cleanup called (no-op)')
  }

  private async getTimestamps(key: string): Promise<number[]> {
    try {
      const cached = await cache.get<number[]>(key)
      return cached || []
    } catch (error) {
      logger.error('Error getting timestamps from cache', error as Error, { key })
      return []
    }
  }

  // Get statistics for monitoring
  async getStats(request: NextRequest): Promise<{
    requestCount: number
    remaining: number
    resetTime: number
    windowStart: number
    windowEnd: number
  }> {
    const info = await this.checkLimit(request)
    return {
      requestCount: info.count,
      remaining: info.remaining,
      resetTime: info.resetTime,
      windowStart: info.windowStart || 0,
      windowEnd: info.windowEnd || 0,
    }
  }
}