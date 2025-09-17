import { NextRequest, NextResponse } from 'next/server'
import { cache, createCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'

interface LoadMetrics {
  requestCount: number
  errorRate: number
  averageResponseTime: number
  activeConnections: number
  memoryUsage: number
  timestamp: Date
}

interface DegradationLevel {
  name: 'normal' | 'moderate' | 'high' | 'critical'
  maxRequests: number
  enableCaching: boolean
  reduceFeatures: boolean
  enableQueue: boolean
  responseDelay: number
  errorThreshold: number
}

export class GracefulDegradationService {
  private static readonly LOAD_CHECK_INTERVAL = 30 * 1000 // 30 seconds
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  private static readonly DEGRADATION_LEVELS: Record<string, DegradationLevel> = {
    normal: {
      name: 'normal',
      maxRequests: 1000,
      enableCaching: true,
      reduceFeatures: false,
      enableQueue: false,
      responseDelay: 0,
      errorThreshold: 0.05 // 5%
    },
    moderate: {
      name: 'moderate',
      maxRequests: 500,
      enableCaching: true,
      reduceFeatures: true,
      enableQueue: false,
      responseDelay: 100,
      errorThreshold: 0.10 // 10%
    },
    high: {
      name: 'high',
      maxRequests: 200,
      enableCaching: true,
      reduceFeatures: true,
      enableQueue: true,
      responseDelay: 500,
      errorThreshold: 0.20 // 20%
    },
    critical: {
      name: 'critical',
      maxRequests: 50,
      enableCaching: false,
      reduceFeatures: true,
      enableQueue: true,
      responseDelay: 2000,
      errorThreshold: 0.50 // 50%
    }
  }

  private static currentLevel: DegradationLevel = this.DEGRADATION_LEVELS.normal
  private static lastLoadCheck = 0

  // Assess current system load
  static async assessSystemLoad(): Promise<DegradationLevel> {
    const now = Date.now()

    // Throttle load checks
    if (now - this.lastLoadCheck < this.LOAD_CHECK_INTERVAL) {
      return this.currentLevel
    }

    this.lastLoadCheck = now

    try {
      const metrics = await this.collectLoadMetrics()

      // Determine degradation level based on metrics
      let newLevel = this.DEGRADATION_LEVELS.normal

      if (metrics.errorRate > 0.50 || metrics.averageResponseTime > 5000) {
        newLevel = this.DEGRADATION_LEVELS.critical
      } else if (metrics.errorRate > 0.20 || metrics.averageResponseTime > 2000) {
        newLevel = this.DEGRADATION_LEVELS.high
      } else if (metrics.errorRate > 0.10 || metrics.averageResponseTime > 1000) {
        newLevel = this.DEGRADATION_LEVELS.moderate
      }

      // Check if level changed
      if (newLevel.name !== this.currentLevel.name) {
        logger.warn('System load level changed', {
          from: this.currentLevel.name,
          to: newLevel.name,
          metrics
        })
        this.currentLevel = newLevel

        // Cache the new level
        await cache.set(createCacheKey('degradation-level'), newLevel, this.CACHE_TTL)
      }

      return newLevel
    } catch (error) {
      logger.error('Error assessing system load', error as Error)
      return this.DEGRADATION_LEVELS.critical // Fail safe to most restrictive
    }
  }

  // Apply graceful degradation to request
  static async applyDegradation(
    request: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const level = await this.assessSystemLoad()

    // Apply response delay if configured
    if (level.responseDelay > 0) {
      await this.delay(level.responseDelay)
    }

    // Check if we should queue the request
    if (level.enableQueue && await this.shouldQueueRequest()) {
      return this.createQueuedResponse(request)
    }

    // Apply feature reduction
    if (level.reduceFeatures) {
      return this.applyFeatureReduction(request, handler)
    }

    // Normal processing
    return handler()
  }

  // Get current degradation status
  static async getDegradationStatus(): Promise<{
    level: DegradationLevel
    metrics: LoadMetrics
    isDegraded: boolean
  }> {
    const level = await this.assessSystemLoad()
    const metrics = await this.collectLoadMetrics()

    return {
      level,
      metrics,
      isDegraded: level.name !== 'normal'
    }
  }

  // Force specific degradation level (for testing or manual override)
  static async forceDegradationLevel(levelName: keyof typeof GracefulDegradationService.DEGRADATION_LEVELS): Promise<void> {
    const level = this.DEGRADATION_LEVELS[levelName]
    if (!level) {
      throw new Error(`Unknown degradation level: ${levelName}`)
    }

    this.currentLevel = level
    await cache.set(createCacheKey('degradation-level'), level, this.CACHE_TTL)

    logger.warn('Degradation level manually forced', { level: levelName })
  }

  // Reset to normal operation
  static async resetToNormal(): Promise<void> {
    this.currentLevel = this.DEGRADATION_LEVELS.normal
    await cache.set(createCacheKey('degradation-level'), this.currentLevel, this.CACHE_TTL)

    logger.info('System reset to normal operation')
  }

  // Private helper methods
  private static async collectLoadMetrics(): Promise<LoadMetrics> {
    try {
      // Get request count from cache
      const requestCount = await this.getRequestCount()

      // Get error rate
      const errorRate = await this.getErrorRate()

      // Get average response time
      const averageResponseTime = await this.getAverageResponseTime()

      // Get active connections (simplified)
      const activeConnections = await this.getActiveConnections()

      // Get memory usage (simplified)
      const memoryUsage = await this.getMemoryUsage()

      return {
        requestCount,
        errorRate,
        averageResponseTime,
        activeConnections,
        memoryUsage,
        timestamp: new Date()
      }
    } catch (error) {
      logger.error('Error collecting load metrics', error as Error)
      return {
        requestCount: 0,
        errorRate: 0,
        averageResponseTime: 0,
        activeConnections: 0,
        memoryUsage: 0,
        timestamp: new Date()
      }
    }
  }

  private static async getRequestCount(): Promise<number> {
    // This would aggregate request counts from monitoring data
    // For now, return a mock value
    const cacheKey = createCacheKey('request-count', 'last-minute')
    const cached = await cache.get<number>(cacheKey)
    return cached || 0
  }

  private static async getErrorRate(): Promise<number> {
    // Calculate error rate from recent requests
    const cacheKey = createCacheKey('error-rate', 'last-minute')
    const cached = await cache.get<number>(cacheKey)
    return cached || 0
  }

  private static async getAverageResponseTime(): Promise<number> {
    // Calculate average response time
    const cacheKey = createCacheKey('avg-response-time', 'last-minute')
    const cached = await cache.get<number>(cacheKey)
    return cached || 0
  }

  private static async getActiveConnections(): Promise<number> {
    // This would get from system metrics
    // For now, return mock
    return 100
  }

  private static async getMemoryUsage(): Promise<number> {
    // This would get from system metrics
    // For now, return mock
    return 70 // 70%
  }

  private static async shouldQueueRequest(): Promise<boolean> {
    // Check if queue is enabled and we're at capacity
    const queueSize = await this.getQueueSize()
    const maxQueueSize = 100 // Configurable

    return queueSize >= maxQueueSize
  }

  private static async getQueueSize(): Promise<number> {
    const cacheKey = createCacheKey('request-queue', 'size')
    const cached = await cache.get<number>(cacheKey)
    return cached || 0
  }

  private static createQueuedResponse(request: NextRequest): NextResponse {
    return new NextResponse(
      JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'Your request has been queued and will be processed when capacity is available.',
        retryAfter: 30,
        degradationLevel: this.currentLevel.name
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '30',
          'X-Degradation-Level': this.currentLevel.name
        }
      }
    )
  }

  private static async applyFeatureReduction(
    request: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Add degradation headers
    const response = await handler()

    if (response instanceof NextResponse) {
      response.headers.set('X-Degradation-Level', this.currentLevel.name)
      response.headers.set('X-Reduced-Features', 'true')
    }

    return response
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Update metrics (called by monitoring system)
  static async updateMetrics(metrics: Partial<LoadMetrics>): Promise<void> {
    const now = new Date()

    // Update request count
    if (metrics.requestCount !== undefined) {
      const cacheKey = createCacheKey('request-count', 'last-minute')
      await cache.set(cacheKey, metrics.requestCount, 60 * 1000) // 1 minute
    }

    // Update error rate
    if (metrics.errorRate !== undefined) {
      const cacheKey = createCacheKey('error-rate', 'last-minute')
      await cache.set(cacheKey, metrics.errorRate, 60 * 1000)
    }

    // Update response time
    if (metrics.averageResponseTime !== undefined) {
      const cacheKey = createCacheKey('avg-response-time', 'last-minute')
      await cache.set(cacheKey, metrics.averageResponseTime, 60 * 1000)
    }

    // Update active connections
    if (metrics.activeConnections !== undefined) {
      const cacheKey = createCacheKey('active-connections')
      await cache.set(cacheKey, metrics.activeConnections, 30 * 1000) // 30 seconds
    }
  }
}