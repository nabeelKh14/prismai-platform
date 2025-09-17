import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { isProduction, getEnv } from '@/lib/env'

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR')
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR')
    this.name = 'RateLimitError'
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(message || `${service} service unavailable`, 502, 'EXTERNAL_SERVICE_ERROR', { service })
    this.name = 'ExternalServiceError'
  }
}

interface ErrorResponse {
  error: {
    message: string
    code?: string
    details?: any
    timestamp: string
    requestId?: string
  }
}

export function createErrorResponse(error: Error, requestId?: string): NextResponse<ErrorResponse> {
  const timestamp = new Date().toISOString()
  
  // Handle known error types
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code,
          details: isProduction ? undefined : error.details,
          timestamp,
          requestId,
        },
      },
      { status: error.statusCode }
    )
  }
  
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.input,
    }))
    
    return NextResponse.json(
      {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: isProduction ? undefined : validationErrors,
          timestamp,
          requestId,
        },
      },
      { status: 400 }
    )
  }
  
  // Handle Supabase auth errors
  if (error.message?.includes('Invalid JWT') || error.message?.includes('JWT expired')) {
    return NextResponse.json(
      {
        error: {
          message: 'Authentication token expired',
          code: 'TOKEN_EXPIRED',
          timestamp,
          requestId,
        },
      },
      { status: 401 }
    )
  }
  
  // Handle unknown errors
  const message = isProduction ? 'Internal server error' : error.message
  const details = isProduction ? undefined : {
    stack: error.stack,
    name: error.name,
  }
  
  // Log error in production
  if (isProduction) {
    console.error('Unhandled error:', {
      message: error.message,
      stack: error.stack,
      requestId,
      timestamp,
    })
  }
  
  return NextResponse.json(
    {
      error: {
        message,
        code: 'INTERNAL_ERROR',
        details,
        timestamp,
        requestId,
      },
    },
    { status: 500 }
  )
}

export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      const requestId = crypto.randomUUID()
      
      // Log error for debugging
      console.error('API Error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestId,
        timestamp: new Date().toISOString(),
      })
      
      return createErrorResponse(error instanceof Error ? error : new Error(String(error)), requestId)
    }
  }
}

// Async error boundary for React components
export class AsyncErrorBoundary {
  static wrap<T extends any[], R>(fn: (...args: T) => Promise<R>) {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args)
      } catch (error) {
        console.error('Async operation failed:', error)
        throw error instanceof AppError ? error : new AppError(
          error instanceof Error ? error.message : 'Unexpected error occurred'
        )
      }
    }
  }
}

// Retry mechanism for external services
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelay?: number
    maxDelay?: number
    backoffFactor?: number
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    shouldRetry = (error) => {
      // Retry on network errors and 5xx status codes
      return error.message.includes('fetch') || 
             error.message.includes('network') ||
             error.message.includes('ECONNRESET') ||
             (error instanceof ExternalServiceError)
    }
  } = options
  
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError
      }
      
      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay)
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, lastError.message)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}