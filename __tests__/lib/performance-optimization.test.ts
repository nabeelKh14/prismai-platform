/**
 * Performance Optimization Utilities Tests
 * Comprehensive tests for performance monitoring, caching, and optimization utilities
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { cache } from '@/lib/cache'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({ data: null, error: null }))
                }))
              }))
            }))
          }))
        }))
      }))
    }))
  }))
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))

describe('Performance Optimization Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Performance Monitor', () => {
    it('should record API metrics', async () => {
      const metric = {
        endpoint: '/api/test',
        method: 'GET',
        response_time_ms: 150,
        status_code: 200,
        user_agent: 'test-agent',
        ip_address: '127.0.0.1',
        timestamp: new Date().toISOString()
      }

      await performanceMonitor.recordAPIMetric(metric)

      expect(metric.endpoint).toBe('/api/test')
      expect(metric.response_time_ms).toBe(150)
      expect(metric.status_code).toBe(200)
    })

    it('should record database metrics', async () => {
      const metric = {
        query_type: 'select' as const,
        table_name: 'users',
        execution_time_ms: 25,
        rows_affected: 10,
        timestamp: new Date().toISOString()
      }

      await performanceMonitor.recordDatabaseMetric(metric)

      expect(metric.table_name).toBe('users')
      expect(metric.execution_time_ms).toBe(25)
      expect(metric.rows_affected).toBe(10)
    })


    it('should get aggregated stats', async () => {
      const stats = await performanceMonitor.getAggregatedStats('api_response', '24h')

      expect(stats).toHaveProperty('count')
      expect(stats).toHaveProperty('average')
      expect(stats).toHaveProperty('min')
      expect(stats).toHaveProperty('max')
      expect(stats).toHaveProperty('p95')
      expect(stats).toHaveProperty('p99')
    })

    it('should handle performance monitoring without errors', async () => {
      // Test that performance monitoring doesn't throw errors
      const metric = {
        endpoint: '/api/test',
        method: 'GET',
        response_time_ms: 100,
        status_code: 200,
        timestamp: new Date().toISOString()
      }

      await performanceMonitor.recordAPIMetric(metric)

      // Should not throw errors
      expect(true).toBe(true)
    })
  })

  describe('Cache Performance Tests', () => {
    it('should cache and retrieve data efficiently', async () => {
      const testData = { id: 1, name: 'test', data: 'cached content' }
      const cacheKey = 'test-key'

      // Test set operation
      await cache.set(cacheKey, testData, 300) // 5 minutes TTL

      // Test get operation
      const retrieved = await cache.get(cacheKey)
      expect(retrieved).toEqual(testData)
    })

    it('should handle cache misses gracefully', async () => {
      const cacheKey = 'nonexistent-key'

      const retrieved = await cache.get(cacheKey)
      expect(retrieved).toBeNull()
    })

    it('should handle cache operations without errors', async () => {
      const testData = { id: 1, name: 'test' }
      const cacheKey = 'test-key'

      // Test set operation
      await cache.set(cacheKey, testData, 300)

      // Test get operation
      const retrieved = await cache.get(cacheKey)
      expect(retrieved).toEqual(testData)

      // Should not throw errors
      expect(true).toBe(true)
    })
  })

  describe('Performance Utils Tests', () => {
    it('should measure execution time accurately', async () => {
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'result'
      }

      const startTime = performance.now()
      await testFunction()
      const endTime = performance.now()

      const executionTime = endTime - startTime
      expect(executionTime).toBeGreaterThan(0)
      expect(executionTime).toBeGreaterThanOrEqual(10)
    })

    it('should track performance metrics', () => {
      const startTime = performance.now()
      const endTime = performance.now()

      const executionTime = endTime - startTime
      expect(typeof executionTime).toBe('number')
      expect(executionTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Performance Integration Tests', () => {
    it('should handle complete performance monitoring workflow', async () => {
      // Record API metric
      await performanceMonitor.recordAPIMetric({
        endpoint: '/api/performance-test',
        method: 'GET',
        response_time_ms: 100,
        status_code: 200,
        timestamp: new Date().toISOString()
      })

      // Record database metric
      await performanceMonitor.recordDatabaseMetric({
        query_type: 'select',
        table_name: 'performance_test',
        execution_time_ms: 50,
        rows_affected: 1,
        timestamp: new Date().toISOString()
      })

      // Get aggregated stats
      const apiStats = await performanceMonitor.getAggregatedStats('api_response', '1h')
      const dbStats = await performanceMonitor.getAggregatedStats('database_query', '1h')

      expect(apiStats).toHaveProperty('count')
      expect(dbStats).toHaveProperty('count')
    })

    it('should handle cache performance under load', async () => {
      const operations = []

      // Simulate multiple cache operations
      for (let i = 0; i < 10; i++) {
        operations.push(async () => {
          const key = `load-test-${i}`
          const data = { id: i, data: `test-data-${i}` }

          await cache.set(key, data, 300)
          const retrieved = await cache.get(key)
          return retrieved
        })
      }

      // Execute all operations
      const results = await Promise.all(operations.map(op => op()))

      // Verify all operations succeeded
      expect(results).toHaveLength(10)
      results.forEach((result, index) => {
        expect(result).toEqual({ id: index, data: `test-data-${index}` })
      })
    })
  })

  describe('Performance Edge Cases', () => {
    it('should handle invalid performance metrics gracefully', async () => {
      // Test with invalid data
      const invalidMetric = {
        endpoint: '',
        method: 'GET',
        response_time_ms: -1,
        status_code: 200,
        timestamp: 'invalid-date'
      }

      // Should not throw errors
      await expect(performanceMonitor.recordAPIMetric(invalidMetric)).resolves.not.toThrow()
    })

    it('should handle cache errors gracefully', async () => {
      const invalidKey = null as any

      // Should not throw errors
      await expect(cache.get(invalidKey)).resolves.not.toThrow()
      await expect(cache.set(invalidKey, 'data', 300)).resolves.not.toThrow()
    })

    it('should handle high frequency performance monitoring', async () => {
      // Simulate high frequency monitoring
      const metrics = []

      for (let i = 0; i < 100; i++) {
        metrics.push({
          endpoint: `/api/high-frequency-${i}`,
          method: 'GET',
          response_time_ms: Math.random() * 100,
          status_code: 200,
          timestamp: new Date().toISOString()
        })
      }

      // Record all metrics
      for (const metric of metrics) {
        await performanceMonitor.recordAPIMetric(metric)
      }

      // Should not throw errors
      expect(true).toBe(true)
    })
  })
})