/**
 * Intelligent Caching System for External Data Sources
 * Provides caching, cache warming, invalidation strategies, and performance monitoring
 */

import { logger } from '@/lib/logger'

export interface CacheEntry<T = any> {
  key: string
  data: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  source: string
  metadata?: Record<string, any>
}

export interface CacheStats {
  totalEntries: number
  totalHits: number
  totalMisses: number
  hitRate: number
  totalSize: number
  averageResponseTime: number
  sourceStats: Record<string, {
    hits: number
    misses: number
    hitRate: number
    averageResponseTime: number
  }>
}

export interface CacheConfig {
  maxSize: number
  defaultTTL: number
  cleanupInterval: number
  enableCompression: boolean
  enableMetrics: boolean
  warmUpOnStartup: boolean
}

export class IntelligentCache {
  private cache: Map<string, CacheEntry> = new Map()
  private stats: CacheStats = {
    totalEntries: 0,
    totalHits: 0,
    totalMisses: 0,
    hitRate: 0,
    totalSize: 0,
    averageResponseTime: 0,
    sourceStats: {}
  }
  private config: CacheConfig
  private responseTimes: number[] = []
  private cleanupTimer?: NodeJS.Timeout
  private warmingUp = false

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 10000,
      defaultTTL: 3600000, // 1 hour
      cleanupInterval: 300000, // 5 minutes
      enableCompression: true,
      enableMetrics: true,
      warmUpOnStartup: true,
      ...config
    }

    this.startCleanupTimer()
    if (this.config.warmUpOnStartup) {
      this.warmUpCache()
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string, source: string, fetcher?: () => Promise<T>): Promise<T | null> {
    const startTime = Date.now()
    const entry = this.cache.get(key)

    if (entry && this.isValid(entry)) {
      // Cache hit
      entry.accessCount++
      entry.lastAccessed = Date.now()
      this.stats.totalHits++

      if (this.config.enableMetrics) {
        this.updateSourceStats(source, true, Date.now() - startTime)
      }

      logger.debug(`Cache hit for ${key} from ${source}`)
      return entry.data as T
    }

    // Cache miss
    this.stats.totalMisses++

    if (fetcher) {
      try {
        logger.debug(`Cache miss for ${key} from ${source}, fetching...`)
        const data = await fetcher()

        if (data !== null && data !== undefined) {
          this.set(key, data, source)
        }

        if (this.config.enableMetrics) {
          this.updateSourceStats(source, false, Date.now() - startTime)
        }

        return data
      } catch (error) {
        logger.error(`Error fetching data for ${key} from ${source}:`, error)
        return null
      }
    }

    if (this.config.enableMetrics) {
      this.updateSourceStats(source, false, Date.now() - startTime)
    }

    return null
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, source: string, ttl?: number, metadata?: Record<string, any>): void {
    const now = Date.now()

    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed()
    }

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: now,
      ttl: ttl || this.config.defaultTTL,
      accessCount: 0,
      lastAccessed: now,
      source,
      metadata
    }

    this.cache.set(key, entry)
    this.stats.totalEntries = this.cache.size

    // Estimate size (rough calculation)
    this.stats.totalSize += JSON.stringify(data).length

    logger.debug(`Cached ${key} from ${source}`)
  }

  /**
   * Check if cache entry is valid
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl
  }

  /**
   * Evict least recently used entries
   */
  private evictLeastRecentlyUsed(): void {
    const entries = Array.from(this.cache.entries())
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

    const toEvict = entries.slice(0, Math.floor(this.config.maxSize * 0.1)) // Evict 10%

    for (const [key] of toEvict) {
      this.cache.delete(key)
      logger.debug(`Evicted cache entry: ${key}`)
    }

    this.stats.totalEntries = this.cache.size
  }

  /**
   * Update source statistics
   */
  private updateSourceStats(source: string, isHit: boolean, responseTime: number): void {
    if (!this.stats.sourceStats[source]) {
      this.stats.sourceStats[source] = {
        hits: 0,
        misses: 0,
        hitRate: 0,
        averageResponseTime: 0
      }
    }

    const sourceStats = this.stats.sourceStats[source]
    if (isHit) {
      sourceStats.hits++
    } else {
      sourceStats.misses++
    }

    // Update response time average
    this.responseTimes.push(responseTime)
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift() // Keep only last 1000 measurements
    }

    sourceStats.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
    this.stats.averageResponseTime = sourceStats.averageResponseTime

    // Calculate hit rate
    const total = sourceStats.hits + sourceStats.misses
    sourceStats.hitRate = total > 0 ? (sourceStats.hits / total) * 100 : 0
    this.stats.hitRate = (this.stats.totalHits / (this.stats.totalHits + this.stats.totalMisses)) * 100
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
    this.stats = {
      totalEntries: 0,
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      totalSize: 0,
      averageResponseTime: 0,
      sourceStats: {}
    }
    this.responseTimes = []
    logger.info('Cache cleared')
  }

  /**
   * Clear cache for specific source
   */
  clearSource(source: string): void {
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache) {
      if (entry.source === source) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
    this.stats.totalEntries = this.cache.size

    logger.info(`Cleared cache for source: ${source}`)
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
    this.stats.totalEntries = this.cache.size

    if (keysToDelete.length > 0) {
      logger.debug(`Cleaned up ${keysToDelete.length} expired cache entries`)
    }
  }

  /**
   * Warm up cache with common data
   */
  private async warmUpCache(): Promise<void> {
    if (this.warmingUp) return

    this.warmingUp = true
    logger.info('Starting cache warm-up...')

    try {
      // Warm up with common GitHub profiles (you can customize this list)
      const commonProfiles = ['torvalds', 'gaearon', 'sindresorhus', 'tj']

      for (const profile of commonProfiles) {
        try {
          const response = await fetch(`https://api.github.com/users/${profile}`)
          if (response.ok) {
            const data = await response.json()
            this.set(`github:${profile}`, data, 'github', 7200000) // 2 hours TTL
          }
        } catch (error) {
          logger.warn(`Failed to warm up cache for GitHub profile: ${profile}`)
        }
      }

      logger.info('Cache warm-up completed')
    } catch (error) {
      logger.error('Cache warm-up failed:', error)
    } finally {
      this.warmingUp = false
    }
  }

  /**
   * Preload specific data
   */
  async preload(keys: string[], source: string, fetcher: (key: string) => Promise<any>): Promise<void> {
    logger.info(`Preloading ${keys.length} items for source: ${source}`)

    for (const key of keys) {
      try {
        const data = await fetcher(key)
        if (data) {
          this.set(key, data, source, this.config.defaultTTL * 2) // Longer TTL for preloaded data
        }
      } catch (error) {
        logger.warn(`Failed to preload ${key} for ${source}`, {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    logger.info(`Preloading completed for source: ${source}`)
  }

  /**
   * Get cache entries for monitoring
   */
  getCacheEntries(): CacheEntry[] {
    return Array.from(this.cache.values())
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
    logger.info('Cache destroyed')
  }
}

// Export singleton instance
export const intelligentCache = new IntelligentCache()
export default intelligentCache