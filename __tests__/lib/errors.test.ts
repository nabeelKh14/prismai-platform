jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn().mockImplementation((body, init) => ({
      status: init?.status || 200,
      statusText: 'OK',
      headers: new Map(),
      body,
      json: jest.fn().mockImplementation(() => body),
      ...init,
    })),
    next: jest.fn(),
    redirect: jest.fn(),
  },
}))

import {
  AppError,
  ValidationError,
  AuthenticationError,
  createErrorResponse,
  withErrorHandling,
  withRetry,
  ExternalServiceError
} from '@/lib/errors'
import { NextResponse } from 'next/server'

describe('Error Handling', () => {
  describe('Custom Error Classes', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR')
      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('TEST_ERROR')
      expect(error.name).toBe('AppError')
    })

    it('should create ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid input')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('VALIDATION_ERROR')
    })

    it('should create AuthenticationError with 401 status', () => {
      const error = new AuthenticationError()
      expect(error.statusCode).toBe(401)
      expect(error.code).toBe('AUTHENTICATION_ERROR')
    })
  })

  describe('createErrorResponse', () => {
    it('should create error response for AppError', () => {
      const error = new ValidationError('Test validation error')
      const response = createErrorResponse(error, 'test-request-id')
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(400)
    })

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error')
      const response = createErrorResponse(error)
      
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500)
    })
  })

  describe('withErrorHandling', () => {
    it('should handle successful operations', async () => {
      const handler = jest.fn().mockResolvedValue('success')
      const wrappedHandler = withErrorHandling(handler)
      
      const result = await wrappedHandler('test-arg')
      expect(result).toBe('success')
      expect(handler).toHaveBeenCalledWith('test-arg')
    })

    it('should handle errors and return error response', async () => {
      const handler = jest.fn().mockRejectedValue(new ValidationError('Test error'))
      const wrappedHandler = withErrorHandling(handler)
      
      const result = await wrappedHandler('test-arg')
      expect(result).toBeInstanceOf(NextResponse)
      expect((result as NextResponse).status).toBe(400)
    })
  })

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success')
      const result = await withRetry(operation, { maxRetries: 3 })
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new ExternalServiceError('VAPI', 'Service unavailable'))
        .mockResolvedValue('success')
      
      const result = await withRetry(operation, { 
        maxRetries: 3,
        baseDelay: 10 // Short delay for testing
      })
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new ValidationError('Invalid input'))
      
      await expect(withRetry(operation, { maxRetries: 3 }))
        .rejects.toThrow('Invalid input')
      
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should throw last error after max retries', async () => {
      const error = new ExternalServiceError('Test', 'Service error')
      const operation = jest.fn().mockRejectedValue(error)
      
      await expect(withRetry(operation, { maxRetries: 2, baseDelay: 10 }))
        .rejects.toThrow('Service error')
      
      expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })
  })
})