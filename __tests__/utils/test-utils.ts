/**
 * Comprehensive Test Utilities for Production Deployment Readiness
 * Provides utilities for unit, integration, and performance testing
 */

import { jest } from '@jest/globals'
import { createClient } from '@/lib/supabase/client'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'

// Test data factories
export const TestDataFactory = {
  // User data
  createUser(overrides: Partial<any> = {}) {
    return {
      id: `user-${Date.now()}`,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    }
  },

  // Tenant data
  createTenant(overrides: Partial<any> = {}) {
    return {
      id: `tenant-${Date.now()}`,
      name: 'Test Company',
      domain: 'test-company.com',
      plan: 'enterprise',
      status: 'active',
      created_at: new Date().toISOString(),
      ...overrides
    }
  },

  // API request data
  createAPIRequest(overrides: Partial<any> = {}) {
    return {
      endpoint: '/api/test',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: { test: 'data' },
      ...overrides
    }
  },

  // Performance metrics
  createPerformanceMetric(overrides: Partial<any> = {}) {
    return {
      endpoint: '/api/test',
      method: 'GET',
      response_time_ms: 150,
      status_code: 200,
      timestamp: new Date().toISOString(),
      ...overrides
    }
  }
}

// Mock utilities
export const MockUtils = {
  // Mock Supabase client with enhanced functionality
  createMockSupabaseClient() {
    const mockClient = {
      auth: {
        getUser: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        signUp: jest.fn(),
        onAuthStateChange: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        and: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn(),
        execute: jest.fn(() => Promise.resolve({ data: [] as any[], error: null }))
      })),
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(),
          download: jest.fn(),
          list: jest.fn(),
          update: jest.fn(),
          remove: jest.fn()
        }))
      }
    }

    return mockClient
  },

  // Mock external services
  createMockExternalService(serviceName: string) {
    return {
      name: serviceName,
      call: jest.fn(),
      isHealthy: jest.fn().mockReturnValue(true),
      getMetrics: jest.fn().mockReturnValue({
        responseTime: 100,
        successRate: 0.99,
        errorRate: 0.01
      })
    }
  },

  // Mock AI services
  createMockAIService() {
    return {
      generateResponse: jest.fn(() => Promise.resolve('AI generated response' as any)),
      analyzeSentiment: jest.fn(() => Promise.resolve({ score: 0.8, label: 'positive' } as any)),
      extractEntities: jest.fn(() => Promise.resolve(['entity1', 'entity2'] as any)),
      moderateContent: jest.fn(() => Promise.resolve({ flagged: false, reason: null } as any))
    }
  }
}

// Performance testing utilities
export const PerformanceUtils = {
  // Measure function execution time
  async measureExecutionTime<T>(
    fn: () => Promise<T>,
    iterations: number = 100
  ): Promise<{ averageTime: number; minTime: number; maxTime: number }> {
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      await fn()
      const end = performance.now()
      times.push(end - start)
    }

    return {
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times)
    }
  },

  // Memory usage tracking
  getMemoryUsage() {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      }
    }
    return null
  },

  // CPU usage estimation (basic)
  estimateCPUTime() {
    return performance.now()
  }
}

// Security testing utilities
export const SecurityUtils = {
  // Generate test tokens
  generateTestToken(payload: any, secret: string = 'test-secret') {
    return Buffer.from(JSON.stringify({ ...payload, iat: Date.now() }))
      .toString('base64')
  },

  // Generate test CSRF tokens
  generateTestCSRFToken(sessionId: string) {
    return `csrf_${sessionId}_${Date.now()}`
  },

  // Test SQL injection patterns
  sqlInjectionPatterns: [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1' UNION SELECT * FROM users --",
    "admin' --",
    "1' OR '1'='1' --"
  ],

  // Test XSS patterns
  xssPatterns: [
    "<script>alert('xss')</script>",
    "javascript:alert('xss')",
    "<img src=x onerror=alert('xss')>",
    "<svg onload=alert('xss')>",
    "data:text/html,<script>alert('xss')</script>"
  ]
}

// Integration testing utilities
export const IntegrationUtils = {
  // Create test database state
  async setupTestDatabase(mockClient: any) {
    const testData = {
      users: [TestDataFactory.createUser()],
      tenants: [TestDataFactory.createTenant()],
      sessions: []
    }

    // Mock database setup
    mockClient.from.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn(() => Promise.resolve({
            data: testData[table as keyof typeof testData]?.[0] || null,
            error: null
          }))
        })
      }),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => Promise.resolve({ data: null, error: null })),
      delete: jest.fn(() => Promise.resolve({ data: null, error: null }))
    }))

    return testData
  },

  // Cleanup test database state
  async cleanupTestDatabase(mockClient: any) {
    // Reset all mocks
    jest.clearAllMocks()
  }
}

// Error testing utilities
export const ErrorUtils = {
  // Create custom test errors
  createTestError(message: string, code: string, statusCode: number = 500) {
    const error = new Error(message)
    ;(error as any).code = code
    ;(error as any).statusCode = statusCode
    return error
  },

  // Test error scenarios
  async testErrorScenario<T>(
    operation: () => Promise<T>,
    expectedError: string,
    retries: number = 3
  ): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        await operation()
        return false // Should have thrown
      } catch (error: any) {
        if (error.message?.includes(expectedError)) {
          return true // Correct error thrown
        }
      }
    }
    return false // Expected error not thrown
  }
}

// Load testing utilities
export const LoadUtils = {
  // Simulate concurrent requests
  async simulateConcurrentRequests<T>(
    operation: () => Promise<T>,
    concurrency: number = 10,
    iterations: number = 100
  ): Promise<{
    totalTime: number
    averageTime: number
    successCount: number
    errorCount: number
    throughput: number
  }> {
    const startTime = performance.now()
    let successCount = 0
    let errorCount = 0

    const executeBatch = async (batchSize: number) => {
      const promises = Array.from({ length: batchSize }, () =>
        operation()
          .then(() => successCount++)
          .catch(() => errorCount++)
      )
      await Promise.all(promises)
    }

    // Execute in batches to avoid overwhelming the system
    const batchSize = Math.min(concurrency, 50)
    const batches = Math.ceil(iterations / batchSize)

    for (let i = 0; i < batches; i++) {
      await executeBatch(batchSize)
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime
    const throughput = (successCount + errorCount) / (totalTime / 1000)

    return {
      totalTime,
      averageTime: totalTime / (successCount + errorCount),
      successCount,
      errorCount,
      throughput
    }
  }
}

// Export all utilities
export default {
  TestDataFactory,
  MockUtils,
  PerformanceUtils,
  SecurityUtils,
  IntegrationUtils,
  ErrorUtils,
  LoadUtils
}