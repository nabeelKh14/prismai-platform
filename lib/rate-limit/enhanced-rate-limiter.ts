import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { RateLimitError } from '@/lib/errors'
import { RateLimitInfo } from './types'
import { TierManager, UserTierInfo } from './tiers'
import { EnhancedSlidingWindowRateLimiter } from './sliding-window'
import { EnhancedFixedWindowRateLimiter } from './fixed-window'
import { ApiKeyManager } from './api-keys'
import { UsageAnalyticsService } from './analytics'
import { RateLimitBypassService } from './bypass'
import { GracefulDegradationService } from './graceful-degradation'

interface EnhancedRateLimitConfig {
  algorithm: 'sliding-window' | 'fixed-window'
  defaultLimits: {
    maxRequests: number
    windowMs: number
  }
  enableAnalytics: boolean
  enableBypass: boolean
  enableDegradation: boolean
  enableApiKeys: boolean
}

export class EnhancedRateLimiter {
  private config: EnhancedRateLimitConfig
  private slidingWindowLimiter: EnhancedSlidingWindowRateLimiter
  private fixedWindowLimiter: EnhancedFixedWindowRateLimiter

  constructor(config: Partial<EnhancedRateLimitConfig> = {}) {
    this.config = {
      algorithm: 'sliding-window',
      defaultLimits: {
        maxRequests: 100,
        windowMs: 15 * 60 * 1000 // 15 minutes
      },
      enableAnalytics: true,
      enableBypass: true,
      enableDegradation: true,
      enableApiKeys: true,
      ...config
    }

    // Initialize rate limiters
    this.slidingWindowLimiter = new EnhancedSlidingWindowRateLimiter(this.config.defaultLimits)
    this.fixedWindowLimiter = new EnhancedFixedWindowRateLimiter(this.config.defaultLimits)
  }

  // Main rate limiting method
  async checkRateLimit(request: NextRequest): Promise<RateLimitInfo> {
    try {
      // Apply graceful degradation first
      if (this.config.enableDegradation) {
        const degradationResponse = await GracefulDegradationService.applyDegradation(
          request,
          async () => new NextResponse('OK')
        )
        if (degradationResponse.status !== 200) {
          throw new RateLimitError('Service temporarily unavailable due to high load')
        }
      }

      // Get user tier information
      const userTier = await TierManager.determineUserTier(request)

      // Check for bypass
      if (this.config.enableBypass && await RateLimitBypassService.canBypassRateLimit(request, userTier.tier.name)) {
        logger.debug('Rate limit bypassed for premium user', {
          userId: userTier.apiKey || this.getClientIP(request),
          tier: userTier.tier.name,
          endpoint: request.nextUrl.pathname
        })
        return this.createBypassInfo(userTier)
      }

      // Validate API key if present
      if (this.config.enableApiKeys) {
        const apiKey = ApiKeyManager.extractApiKey(request)
        if (apiKey) {
          const keyInfo = await ApiKeyManager.validateApiKey(apiKey)
          if (!keyInfo) {
            throw new RateLimitError('Invalid API key')
          }
        }
      }

      // Apply tier-based limits
      const limitInfo = await this.applyTierLimits(request, userTier)

      // Record analytics
      if (this.config.enableAnalytics) {
        await UsageAnalyticsService.recordUsage(request, undefined, userTier.apiKey)
      }

      return limitInfo

    } catch (error) {
      logger.error('Error in enhanced rate limiting', error as Error, {
        endpoint: request.nextUrl.pathname,
        ip: this.getClientIP(request)
      })
      throw error
    }
  }

  // Apply tier-based rate limiting
  private async applyTierLimits(request: NextRequest, userTier: UserTierInfo): Promise<RateLimitInfo> {
    // Use custom limits if available, otherwise use tier defaults
    const limits = userTier.customLimits || {
      maxRequests: userTier.tier.maxRequests,
      windowMs: userTier.tier.windowMs
    }

    // Choose algorithm
    const limiter = this.config.algorithm === 'sliding-window'
      ? this.slidingWindowLimiter
      : this.fixedWindowLimiter

    // Create a custom limiter for this tier
    const tierLimiter = this.config.algorithm === 'sliding-window'
      ? new EnhancedSlidingWindowRateLimiter(limits)
      : new EnhancedFixedWindowRateLimiter(limits)

    // Check the limit
    const limitInfo = await tierLimiter.checkLimit(request)

    // If limit exceeded, check burst allowance for pro/enterprise
    if (limitInfo.remaining <= 0 && userTier.tier.burstLimit && userTier.tier.burstLimit > 0) {
      const burstInfo = await (tierLimiter as any).getBurstInfo?.(request)
      if (burstInfo && !burstInfo.isInBurst) {
        // Allow burst
        return await tierLimiter.recordRequest(request)
      }
    }

    return limitInfo
  }

  // Create middleware function
  createMiddleware(options: {
    onLimitReached?: (request: NextRequest, info: RateLimitInfo) => void
    skipIf?: (request: NextRequest) => boolean
  } = {}) {
    return async (request: NextRequest, handler: () => Promise<NextResponse>): Promise<NextResponse> => {
      try {
        // Skip if condition met
        if (options.skipIf?.(request)) {
          return handler()
        }

        // Check rate limit
        const limitInfo = await this.checkRateLimit(request)

        // If limit exceeded
        if (limitInfo.remaining <= 0) {
          options.onLimitReached?.(request, limitInfo)

          logger.warn('Rate limit exceeded', {
            ip: this.getClientIP(request),
            endpoint: request.nextUrl.pathname,
            limit: limitInfo.count,
            remaining: limitInfo.remaining,
            resetTime: limitInfo.resetTime
          })

          // Return rate limit exceeded response
          return new NextResponse(
            JSON.stringify({
              error: 'Rate limit exceeded',
              message: 'Too many requests, please try again later.',
              retryAfter: Math.ceil((limitInfo.resetTime - Date.now()) / 1000)
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': Math.ceil((limitInfo.resetTime - Date.now()) / 1000).toString(),
                'X-RateLimit-Limit': limitInfo.count.toString(),
                'X-RateLimit-Remaining': limitInfo.remaining.toString(),
                'X-RateLimit-Reset': limitInfo.resetTime.toString(),
              }
            }
          )
        }

        // Execute handler
        const response = await handler()

        // Add rate limit headers to response
        if (response instanceof NextResponse) {
          response.headers.set('X-RateLimit-Limit', limitInfo.count.toString())
          response.headers.set('X-RateLimit-Remaining', limitInfo.remaining.toString())
          response.headers.set('X-RateLimit-Reset', limitInfo.resetTime.toString())
        }

        return response

      } catch (error) {
        if (error instanceof RateLimitError) {
          return new NextResponse(
            JSON.stringify({
              error: 'Rate limit error',
              message: error.message
            }),
            {
              status: 429,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }
        throw error
      }
    }
  }

  // Get rate limit status
  async getStatus(request: NextRequest): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
    tier: string
    quotaUsed: number
    quotaLimit: number
  }> {
    const userTier = await TierManager.determineUserTier(request)
    const limitInfo = await this.checkRateLimit(request)

    return {
      allowed: limitInfo.remaining > 0,
      remaining: limitInfo.remaining,
      resetTime: limitInfo.resetTime,
      tier: userTier.tier.name,
      quotaUsed: userTier.quotaUsed,
      quotaLimit: await this.getQuotaLimit(request)
    }
  }

  // Private helper methods
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfIP = request.headers.get('cf-connecting-ip')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    return realIP || cfIP || 'unknown'
  }

  private createBypassInfo(userTier: UserTierInfo): RateLimitInfo {
    return {
      count: 0,
      resetTime: Date.now() + userTier.tier.windowMs,
      remaining: userTier.tier.maxRequests,
      windowStart: Date.now(),
      windowEnd: Date.now() + userTier.tier.windowMs
    }
  }

  private async getQuotaLimit(request: NextRequest): Promise<number> {
    const userTier = await TierManager.determineUserTier(request)
    return userTier.customLimits?.maxRequests || userTier.tier.maxRequests
  }
}

// Export singleton instance
export const enhancedRateLimiter = new EnhancedRateLimiter()

// Export middleware creator
export function withEnhancedRateLimit(
  config?: Partial<EnhancedRateLimitConfig>
) {
  const limiter = new EnhancedRateLimiter(config)

  return (options?: {
    onLimitReached?: (request: NextRequest, info: RateLimitInfo) => void
    skipIf?: (request: NextRequest) => boolean
  }) => {
    return limiter.createMiddleware(options)
  }
}