import { NextRequest } from 'next/server'
import { cache, createCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { RateLimitBypass } from './types'
import { createClient } from '@/lib/supabase/server'

export class RateLimitBypassService {
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  // Define premium endpoints that can be bypassed
  private static readonly PREMIUM_ENDPOINTS = [
    '/api/analytics',
    '/api/monitoring',
    '/api/admin',
    '/api/enterprise',
    '/api/reports',
    '/api/export',
    '/api/bulk',
    '/api/webhooks/premium'
  ]

  // Define bypass reasons
  private static readonly BYPASS_REASONS = {
    PREMIUM_FEATURE: 'premium_feature',
    ENTERPRISE_CUSTOMER: 'enterprise_customer',
    ADMIN_ACCESS: 'admin_access',
    EMERGENCY_ACCESS: 'emergency_access',
    PARTNER_INTEGRATION: 'partner_integration'
  }

  // Check if request can bypass rate limiting
  static async canBypassRateLimit(
    request: NextRequest,
    userTier: 'free' | 'pro' | 'enterprise'
  ): Promise<boolean> {
    // Enterprise users can always bypass
    if (userTier === 'enterprise') {
      return true
    }

    // Pro users can bypass premium endpoints
    if (userTier === 'pro' && this.isPremiumEndpoint(request.nextUrl.pathname)) {
      return true
    }

    // Check for active bypass grants
    const activeBypass = await this.getActiveBypass(request)
    if (activeBypass) {
      return true
    }

    return false
  }

  // Grant temporary bypass
  static async grantBypass(
    identifier: string, // userId or apiKey
    reason: keyof typeof RateLimitBypassService.BYPASS_REASONS,
    durationMinutes: number = 60,
    grantedBy?: string
  ): Promise<RateLimitBypass> {
    try {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000)

      const bypassGrant: RateLimitBypass = {
        userId: identifier.startsWith('user_') ? identifier : undefined,
        apiKey: identifier.startsWith('api_') ? identifier : undefined,
        endpoint: '*', // Wildcard for all endpoints
        reason: this.BYPASS_REASONS[reason],
        grantedAt: now,
        expiresAt
      }

      // Store in database
      const supabase = await createClient()
      const { error } = await supabase
        .from('rate_limit_bypasses')
        .insert({
          user_id: bypassGrant.userId,
          api_key: bypassGrant.apiKey,
          endpoint: bypassGrant.endpoint,
          reason: bypassGrant.reason,
          granted_at: bypassGrant.grantedAt.toISOString(),
          expires_at: bypassGrant.expiresAt.toISOString(),
          granted_by: grantedBy,
          is_active: true
        })

      if (error) {
        logger.error('Failed to grant bypass', error)
        throw new Error('Failed to grant bypass')
      }

      // Cache the bypass
      await this.cacheBypass(bypassGrant)

      logger.info('Rate limit bypass granted', {
        identifier,
        reason: bypassGrant.reason,
        durationMinutes,
        grantedBy
      })

      return bypassGrant
    } catch (error) {
      logger.error('Error granting bypass', error as Error)
      throw error
    }
  }

  // Revoke bypass
  static async revokeBypass(identifier: string): Promise<boolean> {
    try {
      const supabase = await createClient()
      const { error } = await supabase
        .from('rate_limit_bypasses')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString()
        })
        .or(`user_id.eq.${identifier},api_key.eq.${identifier}`)
        .eq('is_active', true)

      if (error) {
        logger.error('Failed to revoke bypass', error)
        return false
      }

      // Remove from cache
      const cacheKey = createCacheKey('bypass', identifier)
      await cache.del(cacheKey)

      logger.info('Rate limit bypass revoked', { identifier })
      return true
    } catch (error) {
      logger.error('Error revoking bypass', error as Error)
      return false
    }
  }

  // Get active bypass for request
  static async getActiveBypass(request: NextRequest): Promise<RateLimitBypass | null> {
    try {
      const identifier = this.extractIdentifier(request)

      // Check cache first
      const cacheKey = createCacheKey('bypass', identifier)
      const cached = await cache.get<RateLimitBypass>(cacheKey)

      if (cached && cached.expiresAt > new Date()) {
        return cached
      }

      // Check database
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('rate_limit_bypasses')
        .select('*')
        .or(`user_id.eq.${identifier},api_key.eq.${identifier}`)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return null
      }

      const bypass: RateLimitBypass = {
        userId: data.user_id,
        apiKey: data.api_key,
        endpoint: data.endpoint,
        reason: data.reason,
        grantedAt: new Date(data.granted_at),
        expiresAt: new Date(data.expires_at)
      }

      // Cache the result
      await this.cacheBypass(bypass)

      return bypass
    } catch (error) {
      logger.error('Error getting active bypass', error as Error)
      return null
    }
  }

  // Get all active bypasses
  static async getActiveBypasses(): Promise<RateLimitBypass[]> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('rate_limit_bypasses')
        .select('*')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('granted_at', { ascending: false })

      if (error) {
        logger.error('Failed to get active bypasses', error)
        return []
      }

      return data.map((row: any) => ({
        userId: row.user_id,
        apiKey: row.api_key,
        endpoint: row.endpoint,
        reason: row.reason,
        grantedAt: new Date(row.granted_at),
        expiresAt: new Date(row.expires_at)
      }))
    } catch (error) {
      logger.error('Error getting active bypasses', error as Error)
      return []
    }
  }

  // Check if endpoint is premium
  static isPremiumEndpoint(endpoint: string): boolean {
    return this.PREMIUM_ENDPOINTS.some(premiumEp =>
      endpoint.startsWith(premiumEp)
    )
  }

  // Get bypass statistics
  static async getBypassStats(): Promise<{
    totalActive: number
    byReason: Record<string, number>
    byTier: Record<string, number>
    recentGrants: RateLimitBypass[]
  }> {
    try {
      const activeBypasses = await this.getActiveBypasses()

      const byReason: Record<string, number> = {}
      const byTier: Record<string, number> = {}

      activeBypasses.forEach(bypass => {
        // Count by reason
        byReason[bypass.reason] = (byReason[bypass.reason] || 0) + 1

        // Count by tier (would need to determine tier from user/api key)
        // For now, we'll skip this
      })

      const recentGrants = activeBypasses
        .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())
        .slice(0, 10)

      return {
        totalActive: activeBypasses.length,
        byReason,
        byTier,
        recentGrants
      }
    } catch (error) {
      logger.error('Error getting bypass stats', error as Error)
      return {
        totalActive: 0,
        byReason: {},
        byTier: {},
        recentGrants: []
      }
    }
  }

  // Emergency bypass for critical systems
  static async grantEmergencyBypass(
    identifier: string,
    durationMinutes: number = 30,
    reason: string = 'Emergency system maintenance'
  ): Promise<RateLimitBypass> {
    logger.warn('Emergency bypass granted', { identifier, durationMinutes, reason })

    return this.grantBypass(identifier, 'EMERGENCY_ACCESS', durationMinutes, 'system')
  }

  // Private helper methods
  private static extractIdentifier(request: NextRequest): string {
    const userId = request.headers.get('x-user-id')
    const apiKey = request.headers.get('x-api-key')
    const ip = this.getClientIP(request)

    return userId || apiKey || ip
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

  private static async cacheBypass(bypass: RateLimitBypass): Promise<void> {
    const identifier = bypass.userId || bypass.apiKey || 'unknown'
    const cacheKey = createCacheKey('bypass', identifier)

    const ttl = Math.max(0, Math.floor((bypass.expiresAt.getTime() - Date.now()) / 1000))
    await cache.set(cacheKey, bypass, ttl * 1000)
  }

  // Clean up expired bypasses
  static async cleanupExpiredBypasses(): Promise<void> {
    try {
      const supabase = await createClient()
      const { error } = await supabase
        .from('rate_limit_bypasses')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString()
        })
        .lt('expires_at', new Date().toISOString())
        .eq('is_active', true)

      if (error) {
        logger.error('Failed to cleanup expired bypasses', error)
      } else {
        logger.info('Cleaned up expired bypasses')
      }
    } catch (error) {
      logger.error('Error cleaning up expired bypasses', error as Error)
    }
  }
}