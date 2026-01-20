/**
 * @jest-environment node
 */

/**
 * Core API Integration Tests
 * Tests fundamental API endpoints for health, auth, and monitoring
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Test utilities
const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${BASE_URL}${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })
  return response
}

const expectSuccessResponse = async (response: Response, expectedStatus = 200) => {
  expect(response.status).toBe(expectedStatus)
  const data = await response.json()
  expect(data).toBeDefined()
  return data
}

const expectErrorResponse = async (response: Response, expectedStatus: number) => {
  expect(response.status).toBe(expectedStatus)
  const data = await response.json()
  expect(data).toBeDefined()
  return data
}

describe('Core API Integration Tests', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await makeRequest('/api/health')
      const data = await expectSuccessResponse(response)
      expect(data.status).toBe('healthy')
      expect(data.timestamp).toBeDefined()
    })

    it('should handle health check with query parameters', async () => {
      const response = await makeRequest('/api/health?check=database')
      const data = await expectSuccessResponse(response)
      expect(data.status).toBe('healthy')
    })
  })

  describe('Authentication', () => {
    it('should reject invalid login attempts', async () => {
      const response = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid@example.com',
          password: 'wrongpassword'
        })
      })
      await expectErrorResponse(response, 401)
    })

    it('should handle signup validation', async () => {
      const response = await makeRequest('/api/auth/sign-up', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'validpassword123',
          name: 'Test User'
        })
      })
      // May return success or validation error depending on implementation
      expect([200, 400, 409]).toContain(response.status)
    })
  })

  describe('Monitoring', () => {
    it('should return monitoring metrics', async () => {
      const response = await makeRequest('/api/monitoring/metrics')
      const data = await expectSuccessResponse(response)
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('metrics')
    })

    it('should return agent monitoring data', async () => {
      const response = await makeRequest('/api/monitoring/agents')
      const data = await expectSuccessResponse(response)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await makeRequest('/api/nonexistent')
      expect(response.status).toBe(404)
    })

    it('should handle malformed JSON', async () => {
      const response = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: '{invalid json',
        headers: { 'Content-Type': 'application/json' }
      })
      expect(response.status).toBe(400)
    })
  })
})