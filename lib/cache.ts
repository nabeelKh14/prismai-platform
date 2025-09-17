import { getEnv, features } from '@/lib/env'
import { logger } from '@/lib/logger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

// In-memory cache fallback
class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private maxSize: number

  constructor(maxSize = 1000) {
    this.maxSize = maxSize
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.timestamp + entry.ttl
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key)
      }
    }

    // If still over limit, remove oldest entries
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)
      
      const toRemove = entries.slice(0, this.cache.size - this.maxSize)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)
    if (!entry || this.isExpired(entry)) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    this.cleanup()
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    })
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }

  getStats() {
    const now = Date.now()
    const validEntries = Array.from(this.cache.values())
      .filter(entry => !this.isExpired(entry))
    
    return {
      size: this.cache.size,
      validEntries: validEntries.length,
      maxSize: this.maxSize,
    }
  }
}

// Redis cache implementation
class RedisCache {
  private client: any
  private isConnected = false

  constructor() {
    this.initRedis()
  }

  private async initRedis() {
    if (!features.caching) return

    try {
      // Try Upstash Redis first
      const upstashUrl = getEnv('UPSTASH_REDIS_REST_URL')
      const upstashToken = getEnv('UPSTASH_REDIS_REST_TOKEN')
      
      if (upstashUrl && upstashToken) {
        const { Redis } = await import('@upstash/redis')
        this.client = new Redis({
          url: upstashUrl,
          token: upstashToken,
        })
        this.isConnected = true
        logger.info('Connected to Upstash Redis')
        return
      }

      // Fallback to regular Redis
      const redisUrl = getEnv('REDIS_URL')
      if (redisUrl) {
        const { createClient } = await import('redis')
        this.client = createClient({ url: redisUrl })
        await this.client.connect()
        this.isConnected = true
        logger.info('Connected to Redis')
      }
    } catch (error) {
      logger.warn('Failed to connect to Redis, falling back to memory cache', error as Error)
      this.isConnected = false
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null

    try {
      const data = await this.client.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      logger.error('Redis get error', error as Error, { key })
      return null
    }
  }

  async set<T>(key: string, data: T, ttlMs: number): Promise<void> {
    if (!this.isConnected) return

    try {
      const serialized = JSON.stringify(data)
      if (ttlMs > 0) {
        await this.client.setex(key, Math.ceil(ttlMs / 1000), serialized)
      } else {
        await this.client.set(key, serialized)
      }
    } catch (error) {
      logger.error('Redis set error', error as Error, { key })
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return

    try {
      await this.client.del(key)
    } catch (error) {
      logger.error('Redis del error', error as Error, { key })
    }
  }

  async clear(): Promise<void> {
    if (!this.isConnected) return

    try {
      await this.client.flushall()
    } catch (error) {
      logger.error('Redis clear error', error as Error)
    }
  }
}

// Cache abstraction layer
class CacheManager {
  private redisCache: RedisCache
  private memoryCache: MemoryCache

  constructor() {
    this.redisCache = new RedisCache()
    this.memoryCache = new MemoryCache()
  }

  async get<T>(key: string): Promise<T | null> {
    // Try Redis first, then memory cache
    const redisResult = await this.redisCache.get<T>(key)
    if (redisResult !== null) {
      return redisResult
    }

    return await this.memoryCache.get<T>(key)
  }

  async set<T>(key: string, data: T, ttlMs: number = 300000): Promise<void> {
    // Store in both caches
    await Promise.all([
      this.redisCache.set(key, data, ttlMs),
      this.memoryCache.set(key, data, ttlMs),
    ])
  }

  async del(key: string): Promise<void> {
    await Promise.all([
      this.redisCache.del(key),
      this.memoryCache.del(key),
    ])
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.redisCache.clear(),
      this.memoryCache.clear(),
    ])
  }

  getStats() {
    return {
      memory: this.memoryCache.getStats(),
      redis: features.caching,
    }
  }
}

// Export singleton
export const cache = new CacheManager()

// Cache utilities
export function createCacheKey(...parts: (string | number)[]): string {
  return parts.join(':')
}

// Memoization decorator
export function memoize<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    ttl?: number
    keyGenerator?: (...args: Parameters<T>) => string
  } = {}
): T {
  const { ttl = 300000, keyGenerator } = options

  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const cacheKey = keyGenerator 
      ? keyGenerator(...args)
      : createCacheKey(fn.name, ...args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ))

    // Try to get from cache
    const cached = await cache.get<Awaited<ReturnType<T>>>(cacheKey)
    if (cached !== null) {
      logger.debug('Cache hit', { function: fn.name, key: cacheKey })
      return cached
    }

    // Execute function and cache result
    logger.debug('Cache miss', { function: fn.name, key: cacheKey })
    const result = await fn(...args)
    await cache.set(cacheKey, result, ttl)
    
    return result
  }) as T
}

// Cache-aside pattern helper
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300000
): Promise<T> {
  const cached = await cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  const result = await fetcher()
  await cache.set(key, result, ttl)
  return result
}

// Cache warming utilities
export class CacheWarmer {
  private static warmupTasks = new Map<string, () => Promise<void>>()

  static register(name: string, task: () => Promise<void>) {
    this.warmupTasks.set(name, task)
  }

  static async warmup(taskNames?: string[]) {
    const tasks = taskNames 
      ? taskNames.map(name => this.warmupTasks.get(name)).filter(Boolean)
      : Array.from(this.warmupTasks.values())

    logger.info('Starting cache warmup', { taskCount: tasks.length })
    
    const results = await Promise.allSettled(
      tasks.map(task => task!())
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    logger.info('Cache warmup completed', { successful, failed })

    if (failed > 0) {
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason)
      
      logger.warn('Some cache warmup tasks failed', { errors })
    }
  }
}

// TTL constants
export const TTL = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const