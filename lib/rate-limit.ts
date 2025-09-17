import { NextRequest, NextResponse } from 'next/server'
import { cache, createCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { RateLimitError } from '@/lib/errors'
import { AbuseDetectionService } from './rate-limit/abuse-detection'
import { captchaService, withCaptchaValidation } from './captcha/service'
import { EnhancedRateLimiter, withEnhancedRateLimit } from './rate-limit/enhanced-rate-limiter'
import { UsageAnalyticsService } from './rate-limit/analytics'
import { RateLimitBypassService } from './rate-limit/bypass'
import { GracefulDegradationService } from './rate-limit/graceful-degradation'

interface RateLimitOptions {
  maxRequests: number
  windowMs: number
  keyGenerator?: (request: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  message?: string
}

interface RateLimitInfo {
  count: number
  resetTime: number
  remaining: number
}

class RateLimiter {
  protected options: Required<RateLimitOptions>

  constructor(options: RateLimitOptions) {
    this.options = {
      keyGenerator: (request) => this.getDefaultKey(request),
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Too many requests, please try again later.',
      ...options,
    }
  }

  private getDefaultKey(request: NextRequest): string {
    // Use IP address as default key
    const ip = this.getClientIP(request)
    return createCacheKey('rate-limit', ip)
  }

  protected getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfIP = request.headers.get('cf-connecting-ip')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    return realIP || cfIP || 'unknown'
  }

  async checkLimit(request: NextRequest): Promise<RateLimitInfo> {
    const key = this.options.keyGenerator(request)
    const now = Date.now()
    const windowStart = now - this.options.windowMs
    
    // Get current count from cache
    const cached = await cache.get<{ count: number; resetTime: number }>(key)
    
    let count = 0
    let resetTime = now + this.options.windowMs
    
    if (cached && cached.resetTime > now) {
      // Within the current window
      count = cached.count
      resetTime = cached.resetTime
    }
    
    const remaining = Math.max(0, this.options.maxRequests - count)
    
    return {
      count,
      resetTime,
      remaining,
    }
  }

  async increment(request: NextRequest): Promise<RateLimitInfo> {
    const key = this.options.keyGenerator(request)
    const now = Date.now()
    
    // Get current state
    const info = await this.checkLimit(request)
    
    // Increment count
    const newCount = info.count + 1
    const resetTime = info.resetTime
    
    // Store updated count
    await cache.set(
      key,
      { count: newCount, resetTime },
      Math.max(0, resetTime - now)
    )
    
    return {
      count: newCount,
      resetTime,
      remaining: Math.max(0, this.options.maxRequests - newCount),
    }
  }

  async isLimitExceeded(request: NextRequest): Promise<boolean> {
    const info = await this.checkLimit(request)
    return info.count >= this.options.maxRequests
  }

  createHeaders(info: RateLimitInfo): Record<string, string> {
    return {
      'X-RateLimit-Limit': this.options.maxRequests.toString(),
      'X-RateLimit-Remaining': info.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(info.resetTime / 1000).toString(),
      'X-RateLimit-Reset-Timestamp': info.resetTime.toString(),
    }
  }

  // Public getter for options (needed by middleware)
  getOptions(): Required<RateLimitOptions> {
    return this.options
  }
}

// Predefined rate limiters for common use cases
export const rateLimiters = {
  // General API rate limiting
  api: new RateLimiter({
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  }),
  
  // Authentication endpoints (stricter)
  auth: new RateLimiter({
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many authentication attempts, please try again later.',
  }),
  
  // AI/Call endpoints (expensive operations)
  aiCalls: new RateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many AI call requests, please wait before trying again.',
  }),
  
  // File uploads or heavy operations
  heavy: new RateLimiter({
    maxRequests: 3,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many resource-intensive requests, please slow down.',
  }),
} as const

// Enhanced rate limiting middleware with abuse detection and CAPTCHA
export function withRateLimit(
  limiter: RateLimiter,
  options: {
    onLimitReached?: (request: NextRequest, info: RateLimitInfo) => void
    skipIf?: (request: NextRequest) => boolean
    enableAbuseDetection?: boolean
    enableCaptcha?: boolean
    captchaAction?: string
  } = {}
) {
  return function <T extends any[], R>(
    handler: (request: NextRequest, ...args: T) => Promise<R>
  ) {
    return async (request: NextRequest, ...args: T): Promise<R | NextResponse> => {
      // Skip rate limiting if condition is met
      if (options.skipIf?.(request)) {
        return handler(request, ...args)
      }

      try {
        // Abuse detection
        if (options.enableAbuseDetection) {
          const analysis = AbuseDetectionService.analyzeRequest(request)

          if (analysis.isSuspicious) {
            // Track suspicious activity
            await AbuseDetectionService.trackSuspiciousActivity(request, {
              riskScore: analysis.riskScore
            })

            // Apply dynamic rate limiting based on risk
            const dynamicLimits = AbuseDetectionService.getDynamicRateLimit(analysis.riskScore)
            const dynamicLimiter = new RateLimiter({
              maxRequests: dynamicLimits.maxRequests,
              windowMs: dynamicLimits.windowMs
            })

            if (await dynamicLimiter.isLimitExceeded(request)) {
              const info = await dynamicLimiter.checkLimit(request)

              logger.logSecurity('Dynamic rate limit exceeded due to suspicious activity', undefined, {
                ip: request.headers.get('x-forwarded-for') || 'unknown',
                riskScore: analysis.riskScore,
                recommendedAction: analysis.recommendedAction,
                path: request.nextUrl.pathname
              })

              // Handle different actions
              if (analysis.recommendedAction === 'block') {
                throw new RateLimitError('Access blocked due to suspicious activity')
              } else if (analysis.recommendedAction === 'captcha' && options.enableCaptcha) {
                // Return CAPTCHA challenge
                return new NextResponse(
                  JSON.stringify({
                    error: 'CAPTCHA required',
                    captchaHtml: captchaService.generateCaptchaHtml(options.captchaAction || 'submit'),
                    riskScore: analysis.riskScore
                  }),
                  {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                  }
                )
              }
            }
          }
        }

        // Standard rate limiting
        if (await limiter.isLimitExceeded(request)) {
          const info = await limiter.checkLimit(request)

          logger.logSecurity('Rate limit exceeded', undefined, {
            ip: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent'),
            path: request.nextUrl.pathname,
            limit: limiter.getOptions().maxRequests,
            count: info.count,
          })

          options.onLimitReached?.(request, info)

          const headers = limiter.createHeaders(info)

          throw new RateLimitError(limiter.getOptions().message)
        }

        // CAPTCHA validation if required
        if (options.enableCaptcha && await captchaService.requiresCaptcha(request)) {
          const captchaToken = request.headers.get('x-captcha-token')

          if (!captchaToken) {
            return new NextResponse(
              JSON.stringify({
                error: 'CAPTCHA required',
                captchaHtml: captchaService.generateCaptchaHtml(options.captchaAction || 'submit')
              }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
              }
            )
          }

          const validation = await captchaService.validateCaptcha(
            captchaToken,
            options.captchaAction || 'submit',
            request
          )

          if (!validation.success) {
            // Track failed CAPTCHA
            await AbuseDetectionService.trackSuspiciousActivity(request, {
              riskScore: 15,
              captchaRequired: true
            })

            return new NextResponse(
              JSON.stringify({
                error: 'CAPTCHA validation failed',
                details: validation.error,
                captchaHtml: captchaService.generateCaptchaHtml(options.captchaAction || 'submit')
              }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
              }
            )
          }
        }

        // Execute handler
        const result = await handler(request, ...args)

        // Increment counter after successful execution
        const info = await limiter.increment(request)

        // Add rate limit headers to response if it's a NextResponse
        if (result instanceof NextResponse) {
          const headers = limiter.createHeaders(info)
          Object.entries(headers).forEach(([key, value]) => {
            result.headers.set(key, value)
          })
        }

        return result
      } catch (error) {
        // Still increment on errors unless configured otherwise
        if (!limiter.getOptions().skipFailedRequests) {
          await limiter.increment(request)
        }
        throw error
      }
    }
  }
}

// User-specific rate limiting
export class UserRateLimiter extends RateLimiter {
  constructor(options: Omit<RateLimitOptions, 'keyGenerator'>) {
    super({
      ...options,
      keyGenerator: (request) => {
        // Try to extract user ID from various sources
        const userId = this.extractUserId(request)
        return createCacheKey('user-rate-limit', userId || this.getClientIP(request))
      },
    })
  }

  private extractUserId(request: NextRequest): string | null {
    // Try to get user ID from Authorization header (if JWT)
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) {
      try {
        const token = auth.substring(7)
        // In a real implementation, you'd decode the JWT
        // For now, use a simple approach
        const payload = JSON.parse(atob(token.split('.')[1]))
        return payload.sub || payload.user_id
      } catch {
        // Invalid JWT, fall back to IP
      }
    }

    // Try to get from custom header
    return request.headers.get('x-user-id')
  }

  protected getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    return realIP || 'unknown'
  }
}

// Sliding window rate limiter (more accurate but more resource intensive)
export class SlidingWindowRateLimiter {
  private maxRequests: number
  private windowMs: number
  private keyGenerator: (request: NextRequest) => string

  constructor(options: RateLimitOptions) {
    this.maxRequests = options.maxRequests
    this.windowMs = options.windowMs
    this.keyGenerator = options.keyGenerator || ((request) => 
      createCacheKey('sliding-rate-limit', this.getClientIP(request))
    )
  }

  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    return forwarded?.split(',')[0].trim() || 'unknown'
  }

  async checkLimit(request: NextRequest): Promise<boolean> {
    const key = this.keyGenerator(request)
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    // Get request timestamps from cache
    const timestamps = await cache.get<number[]>(key) || []
    
    // Filter out old timestamps
    const validTimestamps = timestamps.filter(ts => ts > windowStart)
    
    // Check if limit is exceeded
    return validTimestamps.length >= this.maxRequests
  }

  async recordRequest(request: NextRequest): Promise<void> {
    const key = this.keyGenerator(request)
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    // Get current timestamps
    const timestamps = await cache.get<number[]>(key) || []
    
    // Add new timestamp and filter old ones
    const updatedTimestamps = [...timestamps, now]
      .filter(ts => ts > windowStart)
      .slice(-this.maxRequests) // Keep only the most recent requests
    
    // Store back to cache
    await cache.set(key, updatedTimestamps, this.windowMs)
  }
}

// Export utility functions
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  return new RateLimiter(options)
}

export function createUserRateLimiter(options: Omit<RateLimitOptions, 'keyGenerator'>): UserRateLimiter {
  return new UserRateLimiter(options)
}

export function createSlidingWindowRateLimiter(options: RateLimitOptions): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter(options)
}

// Export enhanced rate limiting system
export { EnhancedRateLimiter, withEnhancedRateLimit } from './rate-limit/enhanced-rate-limiter'
export { TierManager, type UserTierInfo, type RateLimitTier } from './rate-limit/tiers'
export { EnhancedSlidingWindowRateLimiter } from './rate-limit/sliding-window'
export { EnhancedFixedWindowRateLimiter } from './rate-limit/fixed-window'
export { ApiKeyManager } from './rate-limit/api-keys'
export { UsageAnalyticsService } from './rate-limit/analytics'
export { RateLimitBypassService } from './rate-limit/bypass'
export { GracefulDegradationService } from './rate-limit/graceful-degradation'
export type {
  RateLimitInfo,
  RateLimitConfig,
  MonitoringData,
  ApiKeyInfo,
  UsageAnalytics,
  QuotaInfo,
  RateLimitBypass
} from './rate-limit/types'

// Enhanced middleware with all features enabled
export const withEnterpriseRateLimit = withEnhancedRateLimit({
  algorithm: 'sliding-window',
  enableAnalytics: true,
  enableBypass: true,
  enableDegradation: true,
  enableApiKeys: true
})