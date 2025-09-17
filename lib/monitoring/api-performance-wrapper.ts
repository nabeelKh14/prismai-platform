import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from './performance-monitor'
import { logger } from '@/lib/logger'

export type APIHandler = (request: NextRequest, context?: any) => Promise<NextResponse> | NextResponse

/**
 * Wraps an API handler to automatically record performance metrics
 */
export function withPerformanceMonitoring(handler: APIHandler, options?: {
  recordErrors?: boolean
  logSlowRequests?: boolean
  slowRequestThreshold?: number
  recordResponseSize?: boolean
  recordThroughput?: boolean
}): APIHandler {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now()
    const url = new URL(request.url)
    const endpoint = url.pathname
    const method = request.method
    const timestamp = new Date().toISOString()

    try {
      // Execute the handler
      const response = await handler(request, context)
      const endTime = Date.now()
      const responseTime = endTime - startTime

      // Record performance metric
      const userAgent = request.headers.get('user-agent') || undefined
      const ipAddress = getClientIP(request)

      await performanceMonitor.recordAPIMetric({
        endpoint,
        method,
        response_time_ms: responseTime,
        status_code: response.status,
        user_agent: userAgent,
        ip_address: ipAddress,
        timestamp
      })

      // Record response size if enabled
      if (options?.recordResponseSize !== false) {
        try {
          const responseSize = await getResponseSize(response)
          await performanceMonitor.recordResponseSizeMetric(responseSize, endpoint, timestamp)
        } catch (error) {
          logger.warn('Failed to record response size', { error, endpoint })
        }
      }

      // Record throughput if enabled
      if (options?.recordThroughput !== false) {
        await performanceMonitor.recordThroughputMetric(1 / (responseTime / 1000), timestamp, endpoint)
      }

      // Log slow requests if enabled
      const threshold = options?.slowRequestThreshold || 5000
      if (options?.logSlowRequests !== false && responseTime > threshold) {
        logger.warn('Slow API request detected', {
          endpoint,
          method,
          response_time_ms: responseTime,
          status_code: response.status,
          user_agent: userAgent,
          ip_address: ipAddress
        })
      }

      return response

    } catch (error) {
      const endTime = Date.now()
      const responseTime = endTime - startTime

      // Record error metric if enabled
      if (options?.recordErrors !== false) {
        const userAgent = request.headers.get('user-agent') || undefined
        const ipAddress = getClientIP(request)

        await performanceMonitor.recordAPIMetric({
          endpoint,
          method,
          response_time_ms: responseTime,
          status_code: 500,
          user_agent: userAgent,
          ip_address: ipAddress,
          timestamp
        })

        logger.error('API handler error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          endpoint,
          method,
          response_time_ms: responseTime,
          user_agent: userAgent,
          ip_address: ipAddress
        })
      }

      throw error
    }
  }
}

/**
 * Higher-order component for API routes that adds performance monitoring
 */
export function createMonitoredAPIHandler(
  handler: APIHandler,
  options?: {
    recordErrors?: boolean
    logSlowRequests?: boolean
    slowRequestThreshold?: number
  }
) {
  return {
    GET: withPerformanceMonitoring(handler, options),
    POST: withPerformanceMonitoring(handler, options),
    PUT: withPerformanceMonitoring(handler, options),
    DELETE: withPerformanceMonitoring(handler, options),
    PATCH: withPerformanceMonitoring(handler, options)
  }
}

/**
  * Utility function to get client IP from request
  */
 function getClientIP(request: NextRequest): string | undefined {
   // Try different headers for client IP
   const forwardedFor = request.headers.get('x-forwarded-for')
   if (forwardedFor) {
     return forwardedFor.split(',')[0].trim()
   }

   const realIP = request.headers.get('x-real-ip')
   if (realIP) {
     return realIP
   }

   const cfConnectingIP = request.headers.get('cf-connecting-ip')
   if (cfConnectingIP) {
     return cfConnectingIP
   }

   // Fallback to request.ip if available
   return (request as any).ip
 }

/**
  * Utility function to get response size
  */
 async function getResponseSize(response: NextResponse): Promise<number> {
   try {
     // Try to get content-length header first
     const contentLength = response.headers.get('content-length')
     if (contentLength) {
       return parseInt(contentLength, 10)
     }

     // For responses with body, try to calculate size
     if (response.body) {
       // This is a simplified implementation
       // In production, you might need to clone the response or use other methods
       return 0 // Placeholder - would need proper implementation based on response type
     }

     // Default size estimate based on response type
     return 1024 // 1KB default estimate

   } catch (error) {
     logger.warn('Failed to get response size', { error })
     return 0
   }
 }

/**
 * Performance monitoring hook for database operations
 */
export async function withDatabaseMonitoring<T>(
  operation: () => Promise<T>,
  metadata: {
    query_type: 'select' | 'insert' | 'update' | 'delete'
    table_name: string
  }
): Promise<T> {
  const startTime = Date.now()

  try {
    const result = await operation()
    const endTime = Date.now()
    const executionTime = endTime - startTime

    await performanceMonitor.recordDatabaseMetric({
      query_type: metadata.query_type,
      table_name: metadata.table_name,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString()
    })

    return result

  } catch (error) {
    const endTime = Date.now()
    const executionTime = endTime - startTime

    await performanceMonitor.recordDatabaseMetric({
      query_type: metadata.query_type,
      table_name: metadata.table_name,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString()
    })

    throw error
  }
}