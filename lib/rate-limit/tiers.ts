import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

export interface RateLimitTier {
  name: 'free' | 'pro' | 'enterprise'
  maxRequests: number
  windowMs: number
  burstLimit?: number
  priority: number
  features: {
    analytics: boolean
    customLimits: boolean
    bypassAllowed: boolean
    monitoring: boolean
  }
}

export interface UserTierInfo {
  tier: RateLimitTier
  apiKey?: string
  customLimits?: {
    maxRequests: number
    windowMs: number
  }
  bypassEnabled: boolean
  quotaUsed: number
  quotaReset: Date
}

export class TierManager {
  private static readonly TIERS: Record<string, RateLimitTier> = {
    free: {
      name: 'free',
      maxRequests: 100,
      windowMs: 15 * 60 * 1000, // 15 minutes
      burstLimit: 10,
      priority: 1,
      features: {
        analytics: false,
        customLimits: false,
        bypassAllowed: false,
        monitoring: false
      }
    },
    pro: {
      name: 'pro',
      maxRequests: 1000,
      windowMs: 60 * 60 * 1000, // 1 hour
      burstLimit: 100,
      priority: 2,
      features: {
        analytics: true,
        customLimits: false,
        bypassAllowed: true,
        monitoring: true
      }
    },
    enterprise: {
      name: 'enterprise',
      maxRequests: 10000,
      windowMs: 60 * 60 * 1000, // 1 hour
      burstLimit: 1000,
      priority: 3,
      features: {
        analytics: true,
        customLimits: true,
        bypassAllowed: true,
        monitoring: true
      }
    }
  }

  static getTier(tierName: string): RateLimitTier {
    const tier = this.TIERS[tierName]
    if (!tier) {
      logger.warn('Unknown tier requested, defaulting to free', { tierName })
      return this.TIERS.free
    }
    return tier
  }

  static getAllTiers(): RateLimitTier[] {
    return Object.values(this.TIERS)
  }

  static async determineUserTier(request: NextRequest): Promise<UserTierInfo> {
    // Extract user information from request
    const userId = this.extractUserId(request)
    const apiKey = this.extractApiKey(request)

    // Default to free tier
    let tier = this.TIERS.free
    let customLimits: UserTierInfo['customLimits']
    let bypassEnabled = false

    if (userId) {
      // Check user's subscription tier from database
      const userTierInfo = await this.getUserTierFromDatabase(userId)
      if (userTierInfo) {
        tier = userTierInfo.tier
        customLimits = userTierInfo.customLimits
        bypassEnabled = userTierInfo.bypassEnabled
      }
    } else if (apiKey) {
      // Check API key tier
      const apiKeyTierInfo = await this.getApiKeyTier(apiKey)
      if (apiKeyTierInfo) {
        tier = apiKeyTierInfo.tier
        customLimits = apiKeyTierInfo.customLimits
        bypassEnabled = apiKeyTierInfo.bypassEnabled
      }
    }

    // Get current quota usage
    const quotaInfo = await this.getQuotaUsage(userId || apiKey || this.getClientIP(request))

    return {
      tier,
      apiKey: apiKey || undefined,
      customLimits,
      bypassEnabled,
      quotaUsed: quotaInfo.used,
      quotaReset: quotaInfo.reset
    }
  }

  private static extractUserId(request: NextRequest): string | null {
    // Try to get user ID from Authorization header (JWT)
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) {
      try {
        const token = auth.substring(7)
        const payload = JSON.parse(atob(token.split('.')[1]))
        return payload.sub || payload.user_id
      } catch {
        // Invalid JWT, fall back to other methods
      }
    }

    // Try custom header
    return request.headers.get('x-user-id')
  }

  private static extractApiKey(request: NextRequest): string | null {
    const apiKey = request.headers.get('x-api-key')
    const auth = request.headers.get('authorization')
    return apiKey || (auth ? auth.replace('Bearer ', '') : null)
  }

  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfIP = request.headers.get('cf-connecting-ip')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    return realIP || cfIP || 'unknown'
  }

  private static async getUserTierFromDatabase(userId: string): Promise<UserTierInfo | null> {
    // TODO: Implement database lookup for user tier
    // This would query the users table to get subscription information
    // For now, return null to use default tier
    return null
  }

  private static async getApiKeyTier(apiKey: string): Promise<UserTierInfo | null> {
    // TODO: Implement API key lookup
    // This would validate the API key and return associated tier
    return null
  }

  private static async getQuotaUsage(identifier: string): Promise<{ used: number; reset: Date }> {
    // TODO: Implement quota usage tracking
    // This would get current usage from database/cache
    return {
      used: 0,
      reset: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    }
  }

  static canBypassRateLimit(userTier: UserTierInfo, endpoint: string): boolean {
    if (!userTier.bypassEnabled) return false

    // Define premium endpoints that allow bypass
    const premiumEndpoints = [
      '/api/analytics',
      '/api/monitoring',
      '/api/admin'
    ]

    return premiumEndpoints.some(ep => endpoint.startsWith(ep))
  }
}