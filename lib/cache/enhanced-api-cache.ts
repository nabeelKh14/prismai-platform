import { createRedisCache } from './redis-cache'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { logger } from '@/lib/logger'

export interface CacheInvalidationRule {
  pattern: string
  ttl?: number
  conditions?: {
    statusCode?: number[]
    userId?: string[]
    tenantId?: string[]
    custom?: (metadata: any) => boolean
  }
}

export interface CacheWarmingConfig {
  enabled: boolean
  warmupOnStartup?: boolean
  warmupEndpoints?: string[]
  warmupInterval?: number
  maxConcurrent?: number
}

export interface APICacheConfig {
  defaultTTL: number
  enableCompression: boolean
  enableMetrics: boolean
  enableWarming: boolean
  warmingConfig?: CacheWarmingConfig
  invalidationRules?: CacheInvalidationRule[]
  enableStaleWhileRevalidate?: boolean
  staleWhileRevalidateTTL?: number
}

export interface CachedAPIResponse {
  data: any
  status: number
  headers: Record<string, string>
  cachedAt: number
  expiresAt: number
  metadata: {
    endpoint: string
    method: string
    userId?: string
    tenantId?: string
    queryHash?: string
    responseSize: number
  }
}

export class EnhancedAPICache {
  private cache = createRedisCache()
  private config: APICacheConfig
  private warmingInProgress = new Set<string>()
  private invalidationRules: CacheInvalidationRule[] = []
  private warmingInterval?: NodeJS.Timeout

  constructor(config: APICacheConfig) {
    this.config = config
    this.invalidationRules = config.invalidationRules || []

    if (config.enableWarming && config.warmingConfig?.warmupOnStartup) {
      this.startupWarmup()
    }

    if (config.enableWarming && config.warmingConfig?.warmupInterval) {
      this.startPeriodicWarming()
    }
  }

  /**
   * Generate cache key for API response
   */
  private generateCacheKey(
    endpoint: string,
    method: string,
    queryParams?: Record<string, any>,
    userId?: string,
    tenantId?: string
  ): string {
    const queryHash = queryParams ?
      this.hashObject(queryParams) : 'no-query'

    const key = `api:${method}:${endpoint}:${queryHash}`
    const suffix = userId ? `:user:${userId}` : tenantId ? `:tenant:${tenantId}` : ''

    return key + suffix
  }

  /**
   * Hash object for consistent cache keys
   */
  private hashObject(obj: Record<string, any>): string {
    const str = JSON.stringify(obj)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Cache API response
   */
  async set(
    endpoint: string,
    method: string,
    data: any,
    status: number = 200,
    headers: Record<string, string> = {},
    options?: {
      ttl?: number
      userId?: string
      tenantId?: string
      queryParams?: Record<string, any>
      metadata?: Record<string, any>
    }
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(
        endpoint,
        method,
        options?.queryParams,
        options?.userId,
        options?.tenantId
      )

      const responseSize = JSON.stringify(data).length
      const ttl = options?.ttl || this.config.defaultTTL

      const cachedResponse: CachedAPIResponse = {
        data,
        status,
        headers,
        cachedAt: Date.now(),
        expiresAt: Date.now() + ttl,
        metadata: {
          endpoint,
          method,
          userId: options?.userId,
          tenantId: options?.tenantId,
          queryHash: options?.queryParams ?
            this.hashObject(options.queryParams) : undefined,
          responseSize
        }
      }

      const success = await this.cache.set(cacheKey, cachedResponse, ttl)

      if (success && this.config.enableMetrics) {
        await performanceMonitor.recordCacheMetric(100, 1, new Date().toISOString())
      }

      logger.debug('API response cached', {
        key: cacheKey,
        endpoint,
        method,
        ttl,
        responseSize
      })

      return success

    } catch (error) {
      logger.error('Failed to cache API response', {
        error,
        endpoint,
        method
      })
      return false
    }
  }

  /**
   * Get cached API response
   */
  async get(
    endpoint: string,
    method: string,
    options?: {
      userId?: string
      tenantId?: string
      queryParams?: Record<string, any>
      allowStale?: boolean
    }
  ): Promise<CachedAPIResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(
        endpoint,
        method,
        options?.queryParams,
        options?.userId,
        options?.tenantId
      )

      const cached = await this.cache.get<CachedAPIResponse>(cacheKey)

      if (!cached) {
        if (this.config.enableMetrics) {
          await performanceMonitor.recordCacheMetric(0, 1, new Date().toISOString())
        }
        return null
      }

      // Check if expired
      if (Date.now() > cached.expiresAt) {
        await this.cache.delete(cacheKey)
        if (this.config.enableMetrics) {
          await performanceMonitor.recordCacheMetric(0, 1, new Date().toISOString())
        }
        return null
      }

      // Check stale-while-revalidate
      if (this.config.enableStaleWhileRevalidate &&
          options?.allowStale &&
          Date.now() > (cached.expiresAt - (this.config.staleWhileRevalidateTTL || 300000))) {

        // Trigger background refresh
        this.triggerBackgroundRefresh(endpoint, method, options)
      }

      if (this.config.enableMetrics) {
        await performanceMonitor.recordCacheMetric(100, 1, new Date().toISOString())
      }

      logger.debug('API response cache hit', {
        key: cacheKey,
        endpoint,
        method,
        age: Date.now() - cached.cachedAt
      })

      return cached

    } catch (error) {
      logger.error('Failed to get cached API response', {
        error,
        endpoint,
        method
      })
      return null
    }
  }

  /**
   * Invalidate cache based on rules
   */
  async invalidate(
    endpoint: string,
    method: string,
    options?: {
      statusCode?: number
      userId?: string
      tenantId?: string
      customMetadata?: Record<string, any>
    }
  ): Promise<number> {
    let totalDeleted = 0

    try {
      for (const rule of this.invalidationRules) {
        if (!this.matchesInvalidationRule(rule, endpoint, method, options)) {
          continue
        }

        const pattern = rule.pattern
          .replace(':endpoint', endpoint)
          .replace(':method', method)
          .replace(':userId', options?.userId || '*')
          .replace(':tenantId', options?.tenantId || '*')

        const deleted = await this.cache.deletePattern(pattern)
        totalDeleted += deleted

        logger.info('Cache invalidation applied', {
          pattern,
          rule: rule.pattern,
          deleted
        })
      }

      // Also invalidate specific endpoint patterns
      const patterns = [
        `api:${method}:${endpoint}:*`,
        `api:${method}:${endpoint}:*:user:*`,
        `api:${method}:${endpoint}:*:tenant:*`
      ]

      for (const pattern of patterns) {
        const deleted = await this.cache.deletePattern(pattern)
        totalDeleted += deleted
      }

      if (totalDeleted > 0) {
        logger.info('Cache invalidated', {
          endpoint,
          method,
          totalDeleted
        })
      }

      return totalDeleted

    } catch (error) {
      logger.error('Failed to invalidate cache', {
        error,
        endpoint,
        method
      })
      return 0
    }
  }

  /**
   * Check if request matches invalidation rule
   */
  private matchesInvalidationRule(
    rule: CacheInvalidationRule,
    endpoint: string,
    method: string,
    options?: {
      statusCode?: number
      userId?: string
      tenantId?: string
      customMetadata?: Record<string, any>
    }
  ): boolean {
    // Pattern matching
    const pattern = rule.pattern
      .replace(':endpoint', endpoint)
      .replace(':method', method)

    if (!pattern.includes('*') && pattern !== `api:${method}:${endpoint}`) {
      return false
    }

    // Status code condition
    if (rule.conditions?.statusCode && options?.statusCode) {
      if (!rule.conditions.statusCode.includes(options.statusCode)) {
        return false
      }
    }

    // User ID condition
    if (rule.conditions?.userId && options?.userId) {
      if (!rule.conditions.userId.includes(options.userId)) {
        return false
      }
    }

    // Tenant ID condition
    if (rule.conditions?.tenantId && options?.tenantId) {
      if (!rule.conditions.tenantId.includes(options.tenantId)) {
        return false
      }
    }

    // Custom condition
    if (rule.conditions?.custom && options?.customMetadata) {
      if (!rule.conditions.custom(options.customMetadata)) {
        return false
      }
    }

    return true
  }

  /**
   * Trigger background refresh for stale-while-revalidate
   */
  private async triggerBackgroundRefresh(
    endpoint: string,
    method: string,
    options?: {
      userId?: string
      tenantId?: string
      queryParams?: Record<string, any>
    }
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(
      endpoint,
      method,
      options?.queryParams,
      options?.userId,
      options?.tenantId
    )

    if (this.warmingInProgress.has(cacheKey)) {
      return // Already warming up
    }

    this.warmingInProgress.add(cacheKey)

    // Trigger refresh in background
    setImmediate(async () => {
      try {
        // This would typically call the actual API endpoint
        // For now, we'll just log it
        logger.debug('Background cache refresh triggered', {
          endpoint,
          method,
          cacheKey
        })

        // Simulate API call (replace with actual call)
        // const response = await fetch(`/api${endpoint}`, { method })
        // await this.set(endpoint, method, response.data, response.status)

      } catch (error) {
        logger.error('Background cache refresh failed', {
          error,
          endpoint,
          method
        })
      } finally {
        this.warmingInProgress.delete(cacheKey)
      }
    })
  }

  /**
   * Warm up cache on startup
   */
  private async startupWarmup(): Promise<void> {
    if (!this.config.warmingConfig?.warmupEndpoints) {
      return
    }

    logger.info('Starting cache warmup...')

    const warmupPromises = this.config.warmingConfig.warmupEndpoints.map(
      endpoint => this.warmupEndpoint(endpoint)
    )

    await Promise.allSettled(warmupPromises)

    logger.info('Cache warmup completed')
  }

  /**
   * Warm up specific endpoint
   */
  private async warmupEndpoint(endpoint: string): Promise<void> {
    try {
      // This would typically call the actual API endpoint
      // For now, we'll just log it
      logger.debug('Warming up endpoint', { endpoint })

      // Simulate API call (replace with actual call)
      // const response = await fetch(endpoint)
      // await this.set(endpoint, 'GET', response.data, response.status)

    } catch (error) {
      logger.error('Failed to warmup endpoint', { error, endpoint })
    }
  }

  /**
   * Start periodic warming
   */
  private startPeriodicWarming(): void {
    const interval = this.config.warmingConfig?.warmupInterval
    if (!interval) {
      logger.warn('No warmup interval configured')
      return
    }

    this.warmingInterval = setInterval(async () => {
      if (!this.config.warmingConfig?.warmupEndpoints) {
        return
      }

      const warmupPromises = this.config.warmingConfig.warmupEndpoints.map(
        endpoint => this.warmupEndpoint(endpoint)
      )

      await Promise.allSettled(warmupPromises)
    }, interval)
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number
    memoryUsage: string
    hitRate: number
    avgResponseSize: number
    endpointsCached: string[]
  }> {
    try {
      const stats = await this.cache.getStats()

      // Get all cache keys to analyze
      const pattern = 'api:*'
      const keys = await this.cache.getKeys(pattern)

      const endpoints = new Set<string>()
      let totalSize = 0

      for (const key of keys) {
        const endpoint = key.split(':')[2] // Extract endpoint from key
        endpoints.add(endpoint)

        const cached = await this.cache.get(key)
        if (cached && 'metadata' in cached) {
          totalSize += (cached as CachedAPIResponse).metadata.responseSize
        }
      }

      return {
        totalKeys: keys.length,
        memoryUsage: stats.memoryUsage || 'unknown',
        hitRate: 0, // Would need additional tracking
        avgResponseSize: keys.length > 0 ? totalSize / keys.length : 0,
        endpointsCached: Array.from(endpoints)
      }

    } catch (error) {
      logger.error('Failed to get cache stats', { error })
      return {
        totalKeys: 0,
        memoryUsage: 'unknown',
        hitRate: 0,
        avgResponseSize: 0,
        endpointsCached: []
      }
    }
  }

  /**
   * Clear all cached responses
   */
  async clearAll(): Promise<boolean> {
    try {
      const deleted = await this.cache.deletePattern('api:*')
      logger.info('Cleared all API cache', { deleted })
      return true
    } catch (error) {
      logger.error('Failed to clear API cache', { error })
      return false
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    responseTime: number
    message?: string
  }> {
    try {
      const health = await this.cache.healthCheck()

      if (health.status !== 'healthy') {
        return health
      }

      // Additional API cache specific checks
      const stats = await this.getStats()

      if (stats.totalKeys > 10000) {
        return {
          status: 'degraded',
          responseTime: health.responseTime,
          message: 'High cache key count'
        }
      }

      return health

    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        message: 'API cache health check failed'
      }
    }
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval)
    }

    this.warmingInProgress.clear()
    await this.cache.disconnect()
  }
}

// Factory function
export function createEnhancedAPICache(config: APICacheConfig): EnhancedAPICache {
  return new EnhancedAPICache(config)
}

// Default configuration
export const defaultAPICacheConfig: APICacheConfig = {
  defaultTTL: 300000, // 5 minutes
  enableCompression: true,
  enableMetrics: true,
  enableWarming: false,
  enableStaleWhileRevalidate: true,
  staleWhileRevalidateTTL: 60000, // 1 minute
  invalidationRules: [
    {
      pattern: 'api:POST:*',
      ttl: 0 // Never cache POST requests
    },
    {
      pattern: 'api:DELETE:*',
      ttl: 0 // Never cache DELETE requests
    },
    {
      pattern: 'api:PUT:*',
      ttl: 30000 // Short TTL for PUT requests
    }
  ],
  warmingConfig: {
    enabled: false,
    warmupOnStartup: false,
    warmupInterval: 3600000, // 1 hour
    maxConcurrent: 5
  }
}