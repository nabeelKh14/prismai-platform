import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { logger } from '@/lib/logger'

export class PerformanceMonitoringMiddleware {
  static async recordAPIPerformance(
    request: NextRequest,
    response: NextResponse,
    startTime: number
  ): Promise<void> {
    try {
      const endTime = Date.now()
      const responseTime = endTime - startTime

      const url = new URL(request.url)
      const endpoint = url.pathname
      const method = request.method
      const statusCode = response.status
      const userAgent = request.headers.get('user-agent') || undefined
      const ipAddress = this.getClientIP(request)

      await performanceMonitor.recordAPIMetric({
        endpoint,
        method,
        response_time_ms: responseTime,
        status_code: statusCode,
        user_agent: userAgent,
        ip_address: ipAddress,
        timestamp: new Date().toISOString()
      })

      // Log performance issues
      if (responseTime > 10000) { // 10 seconds
        logger.warn('Very slow API response', {
          endpoint,
          method,
          response_time_ms: responseTime,
          status_code: statusCode
        })
      }

    } catch (error) {
      logger.error('Failed to record API performance', { error })
    }
  }

  static async recordSystemMetrics(): Promise<void> {
    try {
      // Only record system metrics on server-side (not in Edge Runtime)
      if (typeof process !== 'undefined' && process.memoryUsage && process.cpuUsage) {
        const memUsage = process.memoryUsage()
        const cpuUsage = process.cpuUsage()

        const memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024)
        const memoryTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
        const cpuUsagePercent = Math.round((cpuUsage.user + cpuUsage.system) / 1000000)

        await performanceMonitor.recordSystemMetric({
          memory_usage_mb: memoryUsageMB,
          memory_total_mb: memoryTotalMB,
          cpu_usage_percent: cpuUsagePercent,
          active_connections: 0, // TODO: Track active connections
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      logger.error('Failed to record system metrics', { error })
    }
  }

  private static getClientIP(request: NextRequest): string | undefined {
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
}

// Periodic system metrics collection
let metricsInterval: NodeJS.Timeout | null = null

export function startSystemMetricsCollection(intervalMinutes: number = 5): void {
  if (metricsInterval) {
    clearInterval(metricsInterval)
  }

  // Only start system metrics collection on server-side
  if (typeof setInterval !== 'undefined') {
    const intervalMs = intervalMinutes * 60 * 1000

    metricsInterval = setInterval(async () => {
      await PerformanceMonitoringMiddleware.recordSystemMetrics()
    }, intervalMs)
  }

  // Record initial metrics
  PerformanceMonitoringMiddleware.recordSystemMetrics()
}

export function stopSystemMetricsCollection(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval)
    metricsInterval = null
  }
}