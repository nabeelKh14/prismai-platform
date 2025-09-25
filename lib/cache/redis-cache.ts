import { createClient, RedisClientType } from 'redis'
import { requireEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

// Cache configuration interface
interface RedisCacheConfig {
  ttl?: number
  keyPrefix?: string
  enableCompression?: boolean
  maxRetries?: number
  retryDelay?: number
}

// Cache entry interface
interface CacheEntry {
  data: any
  expires: number
  compressed?: boolean
  tenantId?: string
  createdAt: number
}

// Redis cache manager for high-performance caching
export class RedisCacheManager {
  private client: RedisClientType
  private config: Required<RedisCacheConfig>
  private isConnected: boolean = false
  private retryCount: number = 0

  constructor(config?: RedisCacheConfig) {
    this.config = {
      ttl: 300000, // 5 minutes default
      keyPrefix: 'prismaicache:',
      enableCompression: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    }

    this.client = this.createRedisClient()
    this.initializeConnection()
  }

  private createRedisClient(): RedisClientType {
    const redisUrl = String(requireEnv('REDIS_URL') || 'redis://localhost:6379')

    return createClient({
      url: redisUrl
    })
  }

  private async initializeConnection(): Promise<void> {
    try {
      this.client.on('error', (err) => {
        logger.error('Redis client error', { error: err.message })
        this.isConnected = false
      })

      this.client.on('connect', () => {
        logger.info('Redis client connected')
        this.isConnected = true
        this.retryCount = 0
      })

      this.client.on('disconnect', () => {
        logger.warn('Redis client disconnected')
        this.isConnected = false
      })

      await this.client.connect()
    } catch (error) {
      logger.error('Failed to initialize Redis connection', {
        error: error instanceof Error ? error.message : String(error)
      })
      this.isConnected = false
    }
  }

  // Core cache operations
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      logger.warn('Redis not connected, returning null')
      return null
    }

    try {
      const fullKey = this.buildKey(key)
      const cached = await this.client.get(fullKey)

      if (!cached) {
        return null
      }

      const entry: CacheEntry = JSON.parse(cached)

      // Check if entry has expired
      if (Date.now() > entry.expires) {
        await this.client.del(fullKey)
        return null
      }

      logger.debug('Cache hit', { key: fullKey })
      return entry.data as T

    } catch (error) {
      logger.error('Cache get error', {
        key,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  async set(key: string, data: any, ttl?: number, tenantId?: string): Promise<boolean> {
    if (!this.isConnected) {
      logger.warn('Redis not connected, cache set failed')
      return false
    }

    try {
      const fullKey = this.buildKey(key)
      const entry: CacheEntry = {
        data,
        expires: Date.now() + (ttl || this.config.ttl),
        tenantId,
        createdAt: Date.now()
      }

      const serialized = JSON.stringify(entry)
      await this.client.setEx(fullKey, Math.ceil((ttl || this.config.ttl) / 1000), serialized)

      logger.debug('Cache set', { key: fullKey, ttl: ttl || this.config.ttl })
      return true

    } catch (error) {
      logger.error('Cache set error', {
        key,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false
    }

    try {
      const fullKey = this.buildKey(key)
      const result = await this.client.del(fullKey)

      logger.debug('Cache delete', { key: fullKey, deleted: result > 0 })
      return result > 0

    } catch (error) {
      logger.error('Cache delete error', {
        key,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      return 0
    }

    try {
      const fullPattern = this.buildKey(pattern)
      const keys = await this.client.keys(fullPattern)
      let deletedCount = 0

      if (keys.length > 0) {
        deletedCount = await this.client.del(keys)
      }

      logger.debug('Cache delete pattern', {
        pattern: fullPattern,
        keysFound: keys.length,
        deleted: deletedCount
      })

      return deletedCount

    } catch (error) {
      logger.error('Cache delete pattern error', {
        pattern,
        error: error instanceof Error ? error.message : String(error)
      })
      return 0
    }
  }

  // Tenant-specific cache operations
  async getTenantData<T = any>(tenantId: string, key: string): Promise<T | null> {
    return this.get<T>(`tenant:${tenantId}:${key}`)
  }

  async setTenantData(tenantId: string, key: string, data: any, ttl?: number): Promise<boolean> {
    return this.set(`tenant:${tenantId}:${key}`, data, ttl, tenantId)
  }

  async invalidateTenantCache(tenantId: string): Promise<number> {
    logger.info('Invalidating tenant cache', { tenantId })
    return this.deletePattern(`tenant:${tenantId}:*`)
  }

  // Batch operations
  async multiGet(keys: string[]): Promise<(any | null)[]> {
    if (!this.isConnected || keys.length === 0) {
      return keys.map(() => null)
    }

    try {
      const fullKeys = keys.map(key => this.buildKey(key))
      const results = await this.client.mGet(fullKeys)

      return results.map((cached, index) => {
        if (!cached) return null

        try {
          const entry: CacheEntry = JSON.parse(cached)
          if (Date.now() > entry.expires) {
            this.client.del(fullKeys[index])
            return null
          }
          return entry.data
        } catch {
          return null
        }
      })

    } catch (error) {
      logger.error('Cache multi-get error', {
        error: error instanceof Error ? error.message : String(error)
      })
      return keys.map(() => null)
    }
  }

  async multiSet(keyValuePairs: Array<[string, any]>, ttl?: number): Promise<boolean> {
    if (!this.isConnected || keyValuePairs.length === 0) {
      return false
    }

    try {
      const entries: CacheEntry[] = keyValuePairs.map(([key, data]) => ({
        data,
        expires: Date.now() + (ttl || this.config.ttl),
        createdAt: Date.now()
      }))

      const fullKeys = keyValuePairs.map(([key]) => this.buildKey(key))
      const serializedEntries = entries.map(entry => JSON.stringify(entry))

      await this.client.mSet(
        fullKeys.flatMap((key, index) => [key, serializedEntries[index]])
      )

      // Set TTL for each key
      const ttlPromises = fullKeys.map(key =>
        this.client.expire(key, Math.ceil((ttl || this.config.ttl) / 1000))
      )

      await Promise.all(ttlPromises)

      logger.debug('Cache multi-set', { count: keyValuePairs.length })
      return true

    } catch (error) {
      logger.error('Cache multi-set error', {
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  // Cache statistics and monitoring
  async getStats(): Promise<{
    connected: boolean
    keys: number
    memoryUsage?: string
    hitRate?: number
    uptime?: number
  }> {
    if (!this.isConnected) {
      return { connected: false, keys: 0 }
    }

    try {
      const info = await this.client.info('memory')
      const keyspace = await this.client.info('keyspace')

      // Parse Redis info (simplified)
      const memoryUsage = this.parseMemoryInfo(info)
      const keyCount = this.parseKeyspaceInfo(keyspace)

      return {
        connected: true,
        keys: keyCount,
        memoryUsage,
        uptime: await this.getUptime()
      }

    } catch (error) {
      logger.error('Cache stats error', {
        error: error instanceof Error ? error.message : String(error)
      })
      return { connected: this.isConnected, keys: 0 }
    }
  }

  private parseMemoryInfo(info: string): string {
    const lines = info.split('\n')
    for (const line of lines) {
      if (line.startsWith('used_memory_human:')) {
        return line.split(':')[1]
      }
    }
    return 'unknown'
  }

  private parseKeyspaceInfo(info: string): number {
    const lines = info.split('\n')
    for (const line of lines) {
      if (line.includes('keys=')) {
        const match = line.match(/keys=(\d+)/)
        if (match) {
          return parseInt(match[1], 10)
        }
      }
    }
    return 0
  }

  private async getUptime(): Promise<number> {
    try {
      const info = await this.client.info('server')
      const lines = info.split('\n')
      for (const line of lines) {
        if (line.startsWith('uptime_in_seconds:')) {
          return parseInt(line.split(':')[1], 10)
        }
      }
    } catch {
      // Ignore errors
    }
    return 0
  }

  // Utility methods
  private buildKey(key: string): string {
    return `${this.config.keyPrefix}${key}`
  }

  async clearAll(): Promise<boolean> {
    if (!this.isConnected) {
      return false
    }

    try {
      const pattern = `${this.config.keyPrefix}*`
      const keys = await this.client.keys(pattern)

      if (keys.length > 0) {
        await this.client.del(keys)
      }

      logger.info('Cache cleared', { keysDeleted: keys.length })
      return true

    } catch (error) {
      logger.error('Cache clear error', {
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    responseTime: number
    message?: string
  }> {
    const startTime = Date.now()

    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          message: 'Redis not connected'
        }
      }

      // Test Redis with a ping
      await this.client.ping()
      const responseTime = Date.now() - startTime

      if (responseTime > 100) {
        return {
          status: 'degraded',
          responseTime,
          message: 'Slow Redis response'
        }
      }

      return {
        status: 'healthy',
        responseTime
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Redis health check failed'
      }
    }
  }

  // Get all keys matching pattern
  async getKeys(pattern: string): Promise<string[]> {
    if (!this.isConnected) {
      return []
    }

    try {
      return await this.client.keys(pattern)
    } catch (error) {
      logger.error('Failed to get keys', {
        error: error instanceof Error ? error.message : String(error),
        pattern
      })
      return []
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.quit()
        this.isConnected = false
        logger.info('Redis disconnected gracefully')
      }
    } catch (error) {
      logger.error('Redis disconnect error', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
}

// Factory function for creating cache manager
export function createRedisCache(config?: RedisCacheConfig): RedisCacheManager {
  return new RedisCacheManager(config)
}

// Default export
export default RedisCacheManager