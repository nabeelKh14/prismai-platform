import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { logger } from '@/lib/logger'

export interface MemoryOptimizationConfig {
  enableGCOnThreshold?: boolean
  memoryThresholdMB?: number
  enableStreaming?: boolean
  maxStreamBufferSize?: number
  enableCompression?: boolean
  cleanupInterval?: number
  enableMetrics?: boolean
}

export interface StreamOptions {
  chunkSize?: number
  highWaterMark?: number
  enableCompression?: boolean
  enableProgressTracking?: boolean
}

export interface MemoryStats {
  used: number
  total: number
  free: number
  usagePercent: number
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
}

export class MemoryOptimizer {
  private config: Required<MemoryOptimizationConfig>
  private cleanupInterval?: NodeJS.Timeout
  private memoryThresholds: Map<string, number> = new Map()
  private activeStreams: Set<string> = new Set()
  private resourcePool: Map<string, any[]> = new Map()

  constructor(config?: MemoryOptimizationConfig) {
    this.config = {
      enableGCOnThreshold: true,
      memoryThresholdMB: 100,
      enableStreaming: true,
      maxStreamBufferSize: 1024 * 1024, // 1MB
      enableCompression: true,
      cleanupInterval: 60000, // 1 minute
      enableMetrics: true,
      ...config
    }

    this.startMemoryMonitoring()
    this.startCleanupTask()
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage()

    return {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      free: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024),
      usagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    }
  }

  /**
   * Check if memory usage is above threshold
   */
  isMemoryAboveThreshold(thresholdMB?: number): boolean {
    const stats = this.getMemoryStats()
    const threshold = thresholdMB || this.config.memoryThresholdMB
    return stats.used > threshold
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): void {
    if (typeof global.gc === 'function') {
      const beforeGC = this.getMemoryStats()
      global.gc()
      const afterGC = this.getMemoryStats()

      logger.info('Garbage collection performed', {
        beforeUsed: beforeGC.used,
        afterUsed: afterGC.used,
        freed: beforeGC.used - afterGC.used
      })

      // Record metrics
      if (this.config.enableMetrics) {
        performanceMonitor.recordGCMetrics(1, afterGC.used - beforeGC.used, beforeGC.used - afterGC.used, new Date().toISOString())
      }
    } else {
      logger.warn('Garbage collection not available (use --expose-gc flag)')
    }
  }

  /**
   * Optimize memory usage for large datasets
   */
  optimizeForLargeDataset<T>(
    data: T[],
    options?: {
      chunkSize?: number
      enableStreaming?: boolean
      enableCompression?: boolean
    }
  ): {
    chunks: T[][]
    totalSize: number
    estimatedMemoryUsage: number
    stream?: ReadableStream<T[]>
  } {
    const chunkSize = options?.chunkSize || 1000
    const chunks: T[][] = []

    // Split data into chunks
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize))
    }

    const totalSize = JSON.stringify(data).length
    const estimatedMemoryUsage = Math.round(totalSize / 1024 / 1024) // MB

    let stream: ReadableStream<T[]> | undefined

    if (options?.enableStreaming && this.config.enableStreaming) {
      stream = this.createChunkStream(chunks, options)
    }

    logger.info('Dataset optimized for memory', {
      totalItems: data.length,
      chunks: chunks.length,
      chunkSize,
      totalSize,
      estimatedMemoryUsage
    })

    return {
      chunks,
      totalSize,
      estimatedMemoryUsage,
      stream
    }
  }

  /**
   * Create streaming response for large datasets
   */
  createStreamResponse<T>(
    data: T[],
    options?: StreamOptions
  ): ReadableStream<Uint8Array> {
    const chunkSize = options?.chunkSize || 100
    const highWaterMark = options?.highWaterMark || 16
    const self = this // Capture this context

    let currentIndex = 0
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.activeStreams.add(streamId)

    return new ReadableStream({
      start(controller) {
        logger.debug('Stream started', { streamId })
      },

      pull(controller) {
        const endIndex = Math.min(currentIndex + chunkSize, data.length)
        const chunk = data.slice(currentIndex, endIndex)

        if (chunk.length === 0) {
          controller.close()
          self.activeStreams.delete(streamId)
          return
        }

        try {
          // Convert chunk to JSON and encode
          const jsonChunk = JSON.stringify(chunk)
          const encodedChunk = new TextEncoder().encode(jsonChunk)

          controller.enqueue(encodedChunk)
          currentIndex = endIndex

          // Record progress
          if (options?.enableProgressTracking) {
            const progress = Math.round((currentIndex / data.length) * 100)
            logger.debug('Stream progress', { streamId, progress, currentIndex, total: data.length })
          }

        } catch (error) {
          logger.error('Stream error', { error, streamId })
          controller.error(error)
        }
      },

      cancel(reason) {
        logger.info('Stream cancelled', { streamId, reason })
        self.activeStreams.delete(streamId)
      }
    }, {
      highWaterMark
    })
  }

  /**
   * Create chunk stream for processing
   */
  private createChunkStream<T>(
    chunks: T[][],
    options?: StreamOptions
  ): ReadableStream<T[]> {
    const self = this // Capture this context
    let currentChunkIndex = 0
    const streamId = `chunk_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.activeStreams.add(streamId)

    return new ReadableStream({
      pull(controller) {
        if (currentChunkIndex >= chunks.length) {
          controller.close()
          self.activeStreams.delete(streamId)
          return
        }

        const chunk = chunks[currentChunkIndex]
        controller.enqueue(chunk)
        currentChunkIndex++

        logger.debug('Chunk streamed', {
          streamId,
          chunkIndex: currentChunkIndex,
          chunkSize: chunk.length,
          totalChunks: chunks.length
        })
      },

      cancel(reason) {
        logger.info('Chunk stream cancelled', { streamId, reason })
        self.activeStreams.delete(streamId)
      }
    })
  }

  /**
   * Resource pool management for memory optimization
   */
  createResourcePool<T>(
    resourceType: string,
    factory: () => T,
    options?: {
      maxSize?: number
      maxAge?: number
      cleanupInterval?: number
    }
  ): {
    acquire: () => Promise<T>
    release: (resource: T) => void
    size: () => number
    clear: () => void
  } {
    const maxSize = options?.maxSize || 10
    const maxAge = options?.maxAge || 300000 // 5 minutes
    const poolKey = `pool_${resourceType}`

    if (!this.resourcePool.has(poolKey)) {
      this.resourcePool.set(poolKey, [])
    }

    const pool = this.resourcePool.get(poolKey)!

    const acquire = async (): Promise<T> => {
      // Try to get existing resource
      if (pool.length > 0) {
        const resource = pool.pop()!
        logger.debug('Resource acquired from pool', { resourceType, poolSize: pool.length })
        return resource
      }

      // Create new resource
      const resource = factory()
      logger.debug('New resource created', { resourceType, poolSize: pool.length })
      return resource
    }

    const release = (resource: T): void => {
      if (pool.length < maxSize) {
        pool.push(resource)
        logger.debug('Resource returned to pool', { resourceType, poolSize: pool.length })
      } else {
        logger.debug('Resource pool full, discarding resource', { resourceType, poolSize: pool.length })
      }
    }

    const size = (): number => pool.length

    const clear = (): void => {
      pool.length = 0
      logger.info('Resource pool cleared', { resourceType })
    }

    // Start cleanup for this pool
    if (options?.cleanupInterval) {
      setInterval(() => {
        const cutoffTime = Date.now() - maxAge
        // In a real implementation, you'd track creation time of resources
        // For now, just maintain max size
        while (pool.length > maxSize) {
          pool.shift()
        }
      }, options.cleanupInterval)
    }

    return { acquire, release, size, clear }
  }

  /**
   * Memory leak prevention utilities
   */
  preventMemoryLeaks(): {
    track: (obj: any, label: string) => void
    untrack: (label: string) => void
    detectLeaks: () => Promise<{ leaks: string[], totalSize: number }>
    cleanup: () => void
  } {
    const trackedObjects = new Map<string, { obj: any, size: number, timestamp: number }>()

    const track = (obj: any, label: string): void => {
      const size = this.estimateObjectSize(obj)
      trackedObjects.set(label, { obj, size, timestamp: Date.now() })

      logger.debug('Object tracked for memory leak detection', { label, size })
    }

    const untrack = (label: string): void => {
      trackedObjects.delete(label)
      logger.debug('Object untracked', { label })
    }

    const detectLeaks = async (): Promise<{ leaks: string[], totalSize: number }> => {
      const leaks: string[] = []
      let totalSize = 0
      const cutoffTime = Date.now() - 300000 // 5 minutes ago

      for (const [label, tracked] of trackedObjects.entries()) {
        if (tracked.timestamp < cutoffTime) {
          leaks.push(label)
          totalSize += tracked.size
        }
      }

      if (leaks.length > 0) {
        logger.warn('Potential memory leaks detected', { leaks, totalSize })
      }

      return { leaks, totalSize }
    }

    const cleanup = (): void => {
      trackedObjects.clear()
      logger.info('Memory leak tracking cleared')
    }

    return { track, untrack, detectLeaks, cleanup }
  }

  /**
   * Estimate object size in memory
   */
  private estimateObjectSize(obj: any): number {
    const objectList: any[] = []
    const stack: any[] = [obj]
    let bytes = 0

    while (stack.length) {
      const value = stack.pop()

      if (typeof value === 'boolean') {
        bytes += 4
      } else if (typeof value === 'string') {
        bytes += value.length * 2
      } else if (typeof value === 'number') {
        bytes += 8
      } else if (typeof value === 'object' && objectList.indexOf(value) === -1) {
        objectList.push(value)

        for (const i in value) {
          stack.push(value[i])
        }
      }
    }

    return bytes
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const stats = this.getMemoryStats()

      // Record metrics
      if (this.config.enableMetrics) {
        performanceMonitor.recordSystemMetric({
          memory_usage_mb: stats.used,
          memory_total_mb: stats.total,
          cpu_usage_percent: 0, // Would need actual CPU monitoring
          active_connections: 0, // Would need connection tracking
          timestamp: new Date().toISOString()
        })
      }

      // Trigger GC if above threshold
      if (this.config.enableGCOnThreshold && stats.used > this.config.memoryThresholdMB) {
        logger.warn('Memory usage above threshold, triggering GC', {
          used: stats.used,
          threshold: this.config.memoryThresholdMB
        })

        this.forceGarbageCollection()
      }

      // Log if memory usage is high
      if (stats.usagePercent > 80) {
        logger.warn('High memory usage detected', stats)
      }
    }, 30000) // Every 30 seconds
  }

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * Perform cleanup operations
   */
  private async performCleanup(): Promise<void> {
    try {
      // Clean up old streams
      const cutoffTime = Date.now() - 300000 // 5 minutes ago
      for (const streamId of this.activeStreams) {
        // In a real implementation, you'd track stream creation time
        // For now, just maintain active streams set
      }

      // Clean up resource pools
      for (const [poolKey, pool] of this.resourcePool.entries()) {
        // Remove null/undefined resources
        const validResources = pool.filter(resource => resource != null)
        this.resourcePool.set(poolKey, validResources)
      }

      // Force GC if memory usage is high
      const stats = this.getMemoryStats()
      if (stats.usagePercent > 70) {
        this.forceGarbageCollection()
      }

      logger.debug('Memory cleanup completed')
    } catch (error) {
      logger.error('Memory cleanup failed', { error })
    }
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    activeStreams: number
    resourcePools: Record<string, number>
    memoryStats: MemoryStats
    thresholds: Record<string, number>
  } {
    const poolStats: Record<string, number> = {}
    for (const [key, pool] of this.resourcePool.entries()) {
      poolStats[key] = pool.length
    }

    return {
      activeStreams: this.activeStreams.size,
      resourcePools: poolStats,
      memoryStats: this.getMemoryStats(),
      thresholds: {
        memoryThresholdMB: this.config.memoryThresholdMB,
        maxStreamBufferSize: this.config.maxStreamBufferSize
      }
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.activeStreams.clear()
    this.resourcePool.clear()
    this.memoryThresholds.clear()

    logger.info('Memory optimizer cleaned up')
  }
}

// Export singleton instance
export const memoryOptimizer = new MemoryOptimizer()

// Export factory function
export function createMemoryOptimizer(config?: MemoryOptimizationConfig): MemoryOptimizer {
  return new MemoryOptimizer(config)
}