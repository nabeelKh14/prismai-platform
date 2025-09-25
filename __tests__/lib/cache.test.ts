import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { cache, createCacheKey, memoize, cacheAside, CacheWarmer, TTL } from '@/lib/cache'
import { logger } from '@/lib/logger'

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}))

// Mock environment
jest.mock('@/lib/env', () => ({
  getEnv: jest.fn((key: string) => {
    const envVars: Record<string, string> = {
      'UPSTASH_REDIS_REST_URL': '',
      'UPSTASH_REDIS_REST_TOKEN': '',
      'REDIS_URL': ''
    }
    return envVars[key] || ''
  }),
  features: {
    caching: false
  }
}))

describe('Cache System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createCacheKey', () => {
    it('should create cache key from strings', () => {
      expect(createCacheKey('user', '123')).toBe('user:123')
    })

    it('should create cache key from numbers', () => {
      expect(createCacheKey('user', 123)).toBe('user:123')
    })

    it('should create cache key from mixed types', () => {
      expect(createCacheKey('user', 123, 'profile')).toBe('user:123:profile')
    })

    it('should handle empty parts', () => {
      expect(createCacheKey()).toBe('')
    })
  })

  describe('MemoryCache', () => {
    it('should store and retrieve data', async () => {
      const testData = { id: 1, name: 'test' }
      await cache.set('test-key', testData, 1000)

      const result = await cache.get('test-key')
      expect(result).toEqual(testData)
    })

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent')
      expect(result).toBeNull()
    })

    it('should handle TTL expiration', async () => {
      const testData = { id: 1, name: 'test' }
      await cache.set('ttl-test', testData, 1) // 1ms TTL

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 5))

      const result = await cache.get('ttl-test')
      expect(result).toBeNull()
    })

    it('should delete specific keys', async () => {
      const testData = { id: 1, name: 'test' }
      await cache.set('delete-test', testData, 1000)

      await cache.del('delete-test')

      const result = await cache.get('delete-test')
      expect(result).toBeNull()
    })

    it('should clear all cache entries', async () => {
      await cache.set('clear-test-1', { id: 1 }, 1000)
      await cache.set('clear-test-2', { id: 2 }, 1000)

      await cache.clear()

      const result1 = await cache.get('clear-test-1')
      const result2 = await cache.get('clear-test-2')
      expect(result1).toBeNull()
      expect(result2).toBeNull()
    })

    it('should provide cache statistics', () => {
      const stats = cache.getStats()
      expect(stats).toHaveProperty('memory')
      expect(stats.memory).toHaveProperty('size')
      expect(stats.memory).toHaveProperty('validEntries')
      expect(stats.memory).toHaveProperty('maxSize')
    })
  })

  describe('memoize decorator', () => {
    it('should cache function results', async () => {
      let callCount = 0

      const testFunction = jest.fn(async (x: number) => {
        callCount++
        return x * 2
      })

      const memoizedFunction = memoize(testFunction)

      // First call
      const result1 = await memoizedFunction(5)
      expect(result1).toBe(10)
      expect(callCount).toBe(1)

      // Second call with same arguments (should use cache)
      const result2 = await memoizedFunction(5)
      expect(result2).toBe(10)
      expect(callCount).toBe(1) // Should not increment

      // Different arguments
      const result3 = await memoizedFunction(3)
      expect(result3).toBe(6)
      expect(callCount).toBe(2)
    })

    it('should handle custom key generator', async () => {
      const testFunction = jest.fn(async (user: { id: number }) => {
        return `user-${user.id}`
      })

      const memoizedFunction = memoize(testFunction, {
        keyGenerator: (user) => `custom-${user.id}`
      })

      const result1 = await memoizedFunction({ id: 1 })
      const result2 = await memoizedFunction({ id: 1 })

      expect(result1).toBe('user-1')
      expect(result2).toBe('user-1')
      expect(testFunction).toHaveBeenCalledTimes(1)
    })

    it('should respect TTL', async () => {
      let callCount = 0

      const testFunction = jest.fn(async () => {
        callCount++
        return Date.now()
      })

      const memoizedFunction = memoize(testFunction, { ttl: 10 })

      const result1 = await memoizedFunction()
      expect(callCount).toBe(1)

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 15))

      const result2 = await memoizedFunction()
      expect(callCount).toBe(2)
    })
  })

  describe('cacheAside helper', () => {
    it('should use cache when available', async () => {
      const fetcher = jest.fn(async () => 'fetched-data')

      // First call should execute fetcher
      const result1 = await cacheAside('aside-test', fetcher, 1000)
      expect(result1).toBe('fetched-data')
      expect(fetcher).toHaveBeenCalledTimes(1)

      // Second call should use cache
      const result2 = await cacheAside('aside-test', fetcher, 1000)
      expect(result2).toBe('fetched-data')
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('should handle fetcher errors', async () => {
      const fetcher = jest.fn(async () => {
        throw new Error('Fetch failed')
      })

      await expect(cacheAside('error-test', fetcher)).rejects.toThrow('Fetch failed')
    })
  })

  describe('CacheWarmer', () => {
    it('should register and execute warmup tasks', async () => {
      const task1 = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
      })

      const task2 = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
      })

      CacheWarmer.register('task1', task1)
      CacheWarmer.register('task2', task2)

      await CacheWarmer.warmup()

      expect(task1).toHaveBeenCalledTimes(1)
      expect(task2).toHaveBeenCalledTimes(1)
      expect(logger.info).toHaveBeenCalledWith('Starting cache warmup', { taskCount: 2 })
      expect(logger.info).toHaveBeenCalledWith('Cache warmup completed', { successful: 2, failed: 0 })
    })

    it('should handle specific task names', async () => {
      const task1 = jest.fn(async () => {})
      const task2 = jest.fn(async () => {})

      CacheWarmer.register('task1', task1)
      CacheWarmer.register('task2', task2)

      await CacheWarmer.warmup(['task1'])

      expect(task1).toHaveBeenCalledTimes(1)
      expect(task2).toHaveBeenCalledTimes(0)
    })

    it('should handle task failures', async () => {
      const failingTask = jest.fn(async () => {
        throw new Error('Task failed')
      })

      const successfulTask = jest.fn(async () => {})

      CacheWarmer.register('failing', failingTask)
      CacheWarmer.register('success', successfulTask)

      await CacheWarmer.warmup()

      expect(logger.warn).toHaveBeenCalledWith('Some cache warmup tasks failed', expect.any(Object))
    })
  })

  describe('TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(TTL.MINUTE).toBe(60000)
      expect(TTL.HOUR).toBe(3600000)
      expect(TTL.DAY).toBe(86400000)
      expect(TTL.WEEK).toBe(604800000)
    })
  })

  describe('Integration tests', () => {
    it('should handle complex caching scenarios', async () => {
      const userService = {
        getUser: jest.fn(async (id: number) => ({ id, name: `User ${id}` }))
      }

      const memoizedGetUser = memoize(userService.getUser, { ttl: 1000 })

      // First call
      const user1 = await memoizedGetUser(1)
      expect(user1).toEqual({ id: 1, name: 'User 1' })
      expect(userService.getUser).toHaveBeenCalledTimes(1)

      // Cached call
      const user1Cached = await memoizedGetUser(1)
      expect(user1Cached).toEqual({ id: 1, name: 'User 1' })
      expect(userService.getUser).toHaveBeenCalledTimes(1)

      // Different user
      const user2 = await memoizedGetUser(2)
      expect(user2).toEqual({ id: 2, name: 'User 2' })
      expect(userService.getUser).toHaveBeenCalledTimes(2)
    })

    it('should handle cache invalidation', async () => {
      const testData = { id: 1, name: 'test' }

      await cache.set('invalidation-test', testData, 1000)
      expect(await cache.get('invalidation-test')).toEqual(testData)

      await cache.del('invalidation-test')
      expect(await cache.get('invalidation-test')).toBeNull()
    })
  })
})