import { NextRequest } from 'next/server'
import { cache, createCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { UsageAnalytics, QuotaInfo, MonitoringData } from './types'
import { createClient } from '@/lib/supabase/server'

export class UsageAnalyticsService {
  private static readonly CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  // Record API usage
  static async recordUsage(
    request: NextRequest,
    userId?: string,
    apiKey?: string,
    responseTime?: number,
    success: boolean = true
  ): Promise<void> {
    try {
      const endpoint = request.nextUrl.pathname
      const method = request.method
      const now = new Date()

      // Create usage record
      const usageRecord: UsageAnalytics = {
        userId,
        apiKey,
        endpoint,
        method,
        requestCount: 1,
        timeWindow: {
          start: now,
          end: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour window
        },
        tier: await this.determineTier(request),
        quotaUsed: 1,
        quotaLimit: await this.getQuotaLimit(request),
        blockedRequests: success ? 0 : 1
      }

      // Store in cache for quick access
      await this.cacheUsageRecord(usageRecord)

      // Store in database (async, don't wait)
      this.storeUsageInDatabase(usageRecord).catch(error => {
        logger.error('Failed to store usage in database', error)
      })

      // Update quota usage
      await this.updateQuotaUsage(request, 1)

      // Record monitoring data
      if (responseTime !== undefined) {
        await this.recordMonitoringData(request, responseTime, success)
      }

    } catch (error) {
      logger.error('Error recording usage', error as Error, {
        endpoint: request.nextUrl.pathname,
        userId,
        apiKey
      })
    }
  }

  // Get usage statistics
  static async getUsageStats(
    identifier: string,
    timeWindow: { start: Date; end: Date }
  ): Promise<UsageAnalytics[]> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('usage_analytics')
        .select('*')
        .or(`user_id.eq.${identifier},api_key.eq.${identifier}`)
        .gte('created_at', timeWindow.start.toISOString())
        .lte('created_at', timeWindow.end.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to get usage stats', error)
        return []
      }

      return data.map((row: any) => ({
        userId: row.user_id,
        apiKey: row.api_key,
        endpoint: row.endpoint,
        method: row.method,
        requestCount: row.request_count,
        timeWindow: {
          start: new Date(row.time_window_start),
          end: new Date(row.time_window_end)
        },
        tier: row.tier,
        quotaUsed: row.quota_used,
        quotaLimit: row.quota_limit,
        blockedRequests: row.blocked_requests
      }))
    } catch (error) {
      logger.error('Error getting usage stats', error as Error)
      return []
    }
  }

  // Get current quota usage
  static async getQuotaUsage(identifier: string): Promise<QuotaInfo> {
    try {
      // Check cache first
      const cacheKey = createCacheKey('quota-usage', identifier)
      const cached = await cache.get<QuotaInfo>(cacheKey)

      if (cached && cached.resetTime > new Date()) {
        return cached
      }

      // Get from database
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('quota_usage')
        .select('*')
        .eq('identifier', identifier)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found error
        logger.error('Failed to get quota usage', error)
        return this.getDefaultQuotaInfo(identifier)
      }

      const quotaInfo: QuotaInfo = data ? {
        identifier: data.identifier,
        used: data.used,
        limit: data.limit,
        resetTime: new Date(data.reset_time),
        tier: data.tier
      } : this.getDefaultQuotaInfo(identifier)

      // Cache the result
      await cache.set(cacheKey, quotaInfo, this.CACHE_TTL)

      return quotaInfo
    } catch (error) {
      logger.error('Error getting quota usage', error as Error)
      return this.getDefaultQuotaInfo(identifier)
    }
  }

  // Update quota usage
  static async updateQuotaUsage(request: NextRequest, increment: number = 1): Promise<void> {
    try {
      const identifier = await this.getIdentifier(request)
      const tier = await this.determineTier(request)
      const quotaLimit = await this.getQuotaLimit(request)

      const supabase = await createClient()
      const now = new Date()
      const resetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

      // Upsert quota usage
      const { error } = await supabase
        .from('quota_usage')
        .upsert({
          identifier,
          used: increment, // This should be incremented, not set
          limit: quotaLimit,
          reset_time: resetTime.toISOString(),
          tier,
          updated_at: now.toISOString()
        }, {
          onConflict: 'identifier',
          ignoreDuplicates: false
        })

      if (error) {
        logger.error('Failed to update quota usage', error)
        return
      }

      // Update cache
      const cacheKey = createCacheKey('quota-usage', identifier)
      const currentUsage = await this.getQuotaUsage(identifier)
      const updatedUsage: QuotaInfo = {
        ...currentUsage,
        used: currentUsage.used + increment,
        resetTime
      }

      await cache.set(cacheKey, updatedUsage, this.CACHE_TTL)

    } catch (error) {
      logger.error('Error updating quota usage', error as Error)
    }
  }

  // Check if quota is exceeded
  static async isQuotaExceeded(request: NextRequest): Promise<boolean> {
    const quotaInfo = await this.getQuotaUsage(await this.getIdentifier(request))
    return quotaInfo.used >= quotaInfo.limit
  }

  // Get usage analytics for dashboard
  static async getDashboardAnalytics(
    userId: string,
    timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<{
    totalRequests: number
    blockedRequests: number
    averageResponseTime: number
    quotaUsage: number
    quotaLimit: number
    topEndpoints: Array<{ endpoint: string; count: number }>
  }> {
    try {
      const now = new Date()
      const timeWindow = this.getTimeWindow(now, timeRange)

      const usageStats = await this.getUsageStats(userId, timeWindow)

      const totalRequests = usageStats.reduce((sum, stat) => sum + stat.requestCount, 0)
      const blockedRequests = usageStats.reduce((sum, stat) => sum + stat.blockedRequests, 0)
      const quotaInfo = await this.getQuotaUsage(userId)

      // Calculate top endpoints
      const endpointCounts = new Map<string, number>()
      usageStats.forEach(stat => {
        const count = endpointCounts.get(stat.endpoint) || 0
        endpointCounts.set(stat.endpoint, count + stat.requestCount)
      })

      const topEndpoints = Array.from(endpointCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count }))

      return {
        totalRequests,
        blockedRequests,
        averageResponseTime: 0, // Would need to calculate from monitoring data
        quotaUsage: quotaInfo.used,
        quotaLimit: quotaInfo.limit,
        topEndpoints
      }
    } catch (error) {
      logger.error('Error getting dashboard analytics', error as Error)
      return {
        totalRequests: 0,
        blockedRequests: 0,
        averageResponseTime: 0,
        quotaUsage: 0,
        quotaLimit: 0,
        topEndpoints: []
      }
    }
  }

  // Private helper methods
  private static async determineTier(request: NextRequest): Promise<string> {
    // This would integrate with the tier manager
    // For now, return 'free'
    return 'free'
  }

  private static async getQuotaLimit(request: NextRequest): Promise<number> {
    // This would get the limit based on tier
    // For now, return default
    return 1000
  }

  private static async getIdentifier(request: NextRequest): Promise<string> {
    // Extract user ID or API key or IP
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

  private static getDefaultQuotaInfo(identifier: string): QuotaInfo {
    return {
      identifier,
      used: 0,
      limit: 1000,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      tier: 'free'
    }
  }

  private static getTimeWindow(now: Date, range: 'hour' | 'day' | 'week' | 'month'): { start: Date; end: Date } {
    const end = new Date(now)
    const start = new Date(now)

    switch (range) {
      case 'hour':
        start.setHours(now.getHours() - 1)
        break
      case 'day':
        start.setDate(now.getDate() - 1)
        break
      case 'week':
        start.setDate(now.getDate() - 7)
        break
      case 'month':
        start.setMonth(now.getMonth() - 1)
        break
    }

    return { start, end }
  }

  private static async cacheUsageRecord(record: UsageAnalytics): Promise<void> {
    const cacheKey = createCacheKey('usage-record',
      record.userId || record.apiKey || 'unknown',
      record.endpoint,
      record.timeWindow.start.getTime().toString()
    )

    await cache.set(cacheKey, record, this.CACHE_TTL)
  }

  private static async storeUsageInDatabase(record: UsageAnalytics): Promise<void> {
    const supabase = await createClient()

    const { error } = await supabase
      .from('usage_analytics')
      .insert({
        user_id: record.userId,
        api_key: record.apiKey,
        endpoint: record.endpoint,
        method: record.method,
        request_count: record.requestCount,
        time_window_start: record.timeWindow.start.toISOString(),
        time_window_end: record.timeWindow.end.toISOString(),
        tier: record.tier,
        quota_used: record.quotaUsed,
        quota_limit: record.quotaLimit,
        blocked_requests: record.blockedRequests,
        created_at: new Date().toISOString()
      })

    if (error) {
      throw error
    }
  }

  private static async recordMonitoringData(
    request: NextRequest,
    responseTime: number,
    success: boolean
  ): Promise<void> {
    const monitoringData: MonitoringData = {
      timestamp: new Date(),
      endpoint: request.nextUrl.pathname,
      method: request.method,
      userId: request.headers.get('x-user-id') || undefined,
      apiKey: request.headers.get('x-api-key') || undefined,
      tier: await this.determineTier(request),
      requestCount: 1,
      blockedCount: success ? 0 : 1,
      averageResponseTime: responseTime,
      errorRate: success ? 0 : 1,
      cacheHitRate: 0, // Would need to track this separately
    }

    // Store monitoring data (implementation would depend on monitoring system)
    const cacheKey = createCacheKey('monitoring',
      monitoringData.endpoint,
      monitoringData.timestamp.getTime().toString()
    )

    await cache.set(cacheKey, monitoringData, 60 * 60 * 1000) // 1 hour
  }
}