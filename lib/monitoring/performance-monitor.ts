import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface PerformanceMetric {
  id: string
  metric_type: 'api_response' | 'database_query' | 'memory_usage' | 'cpu_usage' | 'cache_hit_rate' | 'error_rate' | 'network_latency' | 'disk_io' | 'throughput' | 'concurrency' | 'response_size' | 'uptime' | 'load_average' | 'gc_metrics' | 'thread_count' | 'connection_pool'
  value: number
  unit: string
  timestamp: string
  metadata: Record<string, any>
  tags: Record<string, string>
}

export interface APIMetric {
  endpoint: string
  method: string
  response_time_ms: number
  status_code: number
  user_agent?: string
  ip_address?: string
  timestamp: string
}

export interface DatabaseMetric {
  query_type: 'select' | 'insert' | 'update' | 'delete'
  table_name: string
  execution_time_ms: number
  rows_affected?: number
  timestamp: string
}

export interface SystemMetric {
  memory_usage_mb: number
  memory_total_mb: number
  cpu_usage_percent: number
  active_connections: number
  timestamp: string
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetric[] = []
  private readonly maxMetricsInMemory = 1000

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Record API performance metric
   */
  async recordAPIMetric(metric: APIMetric): Promise<void> {
    try {
      const performanceMetric: Omit<PerformanceMetric, 'id'> = {
        metric_type: 'api_response',
        value: metric.response_time_ms,
        unit: 'ms',
        timestamp: metric.timestamp,
        metadata: {
          endpoint: metric.endpoint,
          method: metric.method,
          status_code: metric.status_code,
          user_agent: metric.user_agent,
          ip_address: metric.ip_address
        },
        tags: {
          endpoint: metric.endpoint,
          method: metric.method,
          status_code: metric.status_code.toString()
        }
      }

      await this.storeMetric(performanceMetric)

      // Log slow requests
      if (metric.response_time_ms > 5000) {
        logger.warn('Slow API response detected', {
          endpoint: metric.endpoint,
          method: metric.method,
          response_time_ms: metric.response_time_ms,
          status_code: metric.status_code
        })
      }

    } catch (error) {
      logger.error('Failed to record API metric', { error, metric })
    }
  }

  /**
   * Record database performance metric
   */
  async recordDatabaseMetric(metric: DatabaseMetric): Promise<void> {
    try {
      const performanceMetric: Omit<PerformanceMetric, 'id'> = {
        metric_type: 'database_query',
        value: metric.execution_time_ms,
        unit: 'ms',
        timestamp: metric.timestamp,
        metadata: {
          query_type: metric.query_type,
          table_name: metric.table_name,
          rows_affected: metric.rows_affected
        },
        tags: {
          query_type: metric.query_type,
          table_name: metric.table_name
        }
      }

      await this.storeMetric(performanceMetric)

      // Log slow queries
      if (metric.execution_time_ms > 1000) {
        logger.warn('Slow database query detected', {
          query_type: metric.query_type,
          table_name: metric.table_name,
          execution_time_ms: metric.execution_time_ms,
          rows_affected: metric.rows_affected
        })
      }

    } catch (error) {
      logger.error('Failed to record database metric', { error, metric })
    }
  }

  /**
   * Record system performance metric
   */
  async recordSystemMetric(metric: SystemMetric): Promise<void> {
    try {
      // Memory usage
      const memoryMetric: Omit<PerformanceMetric, 'id'> = {
        metric_type: 'memory_usage',
        value: metric.memory_usage_mb,
        unit: 'MB',
        timestamp: metric.timestamp,
        metadata: {
          memory_total_mb: metric.memory_total_mb,
          memory_usage_percent: (metric.memory_usage_mb / metric.memory_total_mb) * 100
        },
        tags: {
          type: 'usage'
        }
      }

      // CPU usage
      const cpuMetric: Omit<PerformanceMetric, 'id'> = {
        metric_type: 'cpu_usage',
        value: metric.cpu_usage_percent,
        unit: 'percent',
        timestamp: metric.timestamp,
        metadata: {
          active_connections: metric.active_connections
        },
        tags: {
          type: 'usage'
        }
      }

      await Promise.all([
        this.storeMetric(memoryMetric),
        this.storeMetric(cpuMetric)
      ])

      // Alert on high resource usage
      if (metric.memory_usage_mb > 800) { // 800MB threshold
        logger.warn('High memory usage detected', {
          memory_usage_mb: metric.memory_usage_mb,
          memory_total_mb: metric.memory_total_mb
        })
      }

      if (metric.cpu_usage_percent > 80) { // 80% threshold
        logger.warn('High CPU usage detected', {
          cpu_usage_percent: metric.cpu_usage_percent,
          active_connections: metric.active_connections
        })
      }

    } catch (error) {
      logger.error('Failed to record system metric', { error, metric })
    }
  }

  /**
   * Record cache performance metric
   */
  async recordCacheMetric(hitRate: number, totalRequests: number, timestamp: string): Promise<void> {
    try {
      const cacheMetric: Omit<PerformanceMetric, 'id'> = {
        metric_type: 'cache_hit_rate',
        value: hitRate,
        unit: 'percent',
        timestamp,
        metadata: {
          total_requests: totalRequests,
          cache_hits: Math.round((hitRate / 100) * totalRequests),
          cache_misses: Math.round(((100 - hitRate) / 100) * totalRequests)
        },
        tags: {
          type: 'hit_rate'
        }
      }

      await this.storeMetric(cacheMetric)

    } catch (error) {
      logger.error('Failed to record cache metric', { error, hitRate, totalRequests })
    }
  }

  /**
    * Record error rate metric
    */
   async recordErrorRate(errorCount: number, totalRequests: number, timeWindowMinutes: number, timestamp: string): Promise<void> {
     try {
       const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0

       const errorMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'error_rate',
         value: errorRate,
         unit: 'percent',
         timestamp,
         metadata: {
           error_count: errorCount,
           total_requests: totalRequests,
           time_window_minutes: timeWindowMinutes
         },
         tags: {
           time_window: `${timeWindowMinutes}m`
         }
       }

       await this.storeMetric(errorMetric)

       // Alert on high error rates
       if (errorRate > 5) {
         logger.error('High error rate detected', {
           error_rate: errorRate,
           error_count: errorCount,
           total_requests: totalRequests,
           time_window_minutes: timeWindowMinutes
         })
       }

     } catch (error) {
       logger.error('Failed to record error rate metric', { error, errorCount, totalRequests })
     }
   }

  /**
    * Record network latency metric
    */
   async recordNetworkLatency(latencyMs: number, endpoint: string, timestamp: string): Promise<void> {
     try {
       const networkMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'network_latency',
         value: latencyMs,
         unit: 'ms',
         timestamp,
         metadata: {
           endpoint,
           latency_category: latencyMs < 100 ? 'fast' : latencyMs < 500 ? 'medium' : 'slow'
         },
         tags: {
           endpoint,
           category: latencyMs < 100 ? 'fast' : latencyMs < 500 ? 'medium' : 'slow'
         }
       }

       await this.storeMetric(networkMetric)

     } catch (error) {
       logger.error('Failed to record network latency metric', { error, latencyMs, endpoint })
     }
   }

  /**
    * Record disk I/O metric
    */
   async recordDiskIOMetric(readBytes: number, writeBytes: number, timestamp: string): Promise<void> {
     try {
       // Record read throughput
       const readMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'disk_io',
         value: readBytes,
         unit: 'bytes',
         timestamp,
         metadata: {
           operation: 'read',
           write_bytes: writeBytes
         },
         tags: {
           operation: 'read'
         }
       }

       // Record write throughput
       const writeMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'disk_io',
         value: writeBytes,
         unit: 'bytes',
         timestamp,
         metadata: {
           operation: 'write',
           read_bytes: readBytes
         },
         tags: {
           operation: 'write'
         }
       }

       await Promise.all([
         this.storeMetric(readMetric),
         this.storeMetric(writeMetric)
       ])

     } catch (error) {
       logger.error('Failed to record disk I/O metric', { error, readBytes, writeBytes })
     }
   }

  /**
    * Record throughput metric
    */
   async recordThroughputMetric(requestsPerSecond: number, timestamp: string, service?: string): Promise<void> {
     try {
       const throughputMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'throughput',
         value: requestsPerSecond,
         unit: 'requests_per_second',
         timestamp,
         metadata: {
           service: service || 'api'
         },
         tags: {
           service: service || 'api'
         }
       }

       await this.storeMetric(throughputMetric)

     } catch (error) {
       logger.error('Failed to record throughput metric', { error, requestsPerSecond, service })
     }
   }

  /**
    * Record concurrency metric
    */
   async recordConcurrencyMetric(activeConnections: number, timestamp: string, service?: string): Promise<void> {
     try {
       const concurrencyMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'concurrency',
         value: activeConnections,
         unit: 'connections',
         timestamp,
         metadata: {
           service: service || 'api'
         },
         tags: {
           service: service || 'api'
         }
       }

       await this.storeMetric(concurrencyMetric)

     } catch (error) {
       logger.error('Failed to record concurrency metric', { error, activeConnections, service })
     }
   }

  /**
    * Record response size metric
    */
   async recordResponseSizeMetric(sizeBytes: number, endpoint: string, timestamp: string): Promise<void> {
     try {
       const sizeMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'response_size',
         value: sizeBytes,
         unit: 'bytes',
         timestamp,
         metadata: {
           endpoint,
           size_category: sizeBytes < 1024 ? 'small' : sizeBytes < 10240 ? 'medium' : 'large'
         },
         tags: {
           endpoint,
           category: sizeBytes < 1024 ? 'small' : sizeBytes < 10240 ? 'medium' : 'large'
         }
       }

       await this.storeMetric(sizeMetric)

     } catch (error) {
       logger.error('Failed to record response size metric', { error, sizeBytes, endpoint })
     }
   }

  /**
    * Record uptime metric
    */
   async recordUptimeMetric(uptimeSeconds: number, timestamp: string): Promise<void> {
     try {
       const uptimeMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'uptime',
         value: uptimeSeconds,
         unit: 'seconds',
         timestamp,
         metadata: {
           uptime_hours: uptimeSeconds / 3600,
           uptime_days: uptimeSeconds / 86400
         },
         tags: {
           status: 'operational'
         }
       }

       await this.storeMetric(uptimeMetric)

     } catch (error) {
       logger.error('Failed to record uptime metric', { error, uptimeSeconds })
     }
   }

  /**
    * Record load average metric
    */
   async recordLoadAverageMetric(load1: number, load5: number, load15: number, timestamp: string): Promise<void> {
     try {
       const loadMetrics = [
         {
           metric_type: 'load_average' as const,
           value: load1,
           unit: 'load',
           timestamp,
           metadata: { period: '1m', load5, load15 },
           tags: { period: '1m' }
         },
         {
           metric_type: 'load_average' as const,
           value: load5,
           unit: 'load',
           timestamp,
           metadata: { period: '5m', load1, load15 },
           tags: { period: '5m' }
         },
         {
           metric_type: 'load_average' as const,
           value: load15,
           unit: 'load',
           timestamp,
           metadata: { period: '15m', load1, load5 },
           tags: { period: '15m' }
         }
       ]

       await Promise.all(loadMetrics.map(metric => this.storeMetric(metric)))

     } catch (error) {
       logger.error('Failed to record load average metric', { error, load1, load5, load15 })
     }
   }

  /**
    * Record garbage collection metrics
    */
   async recordGCMetrics(collections: number, durationMs: number, freedBytes: number, timestamp: string): Promise<void> {
     try {
       const gcMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'gc_metrics',
         value: durationMs,
         unit: 'ms',
         timestamp,
         metadata: {
           collections,
           freed_bytes: freedBytes,
           avg_collection_time: durationMs / collections
         },
         tags: {
           type: 'collection_duration'
         }
       }

       await this.storeMetric(gcMetric)

     } catch (error) {
       logger.error('Failed to record GC metrics', { error, collections, durationMs, freedBytes })
     }
   }

  /**
    * Record thread count metric
    */
   async recordThreadCountMetric(activeThreads: number, totalThreads: number, timestamp: string): Promise<void> {
     try {
       const threadMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'thread_count',
         value: activeThreads,
         unit: 'threads',
         timestamp,
         metadata: {
           total_threads: totalThreads,
           utilization_percent: (activeThreads / totalThreads) * 100
         },
         tags: {
           type: 'active'
         }
       }

       await this.storeMetric(threadMetric)

     } catch (error) {
       logger.error('Failed to record thread count metric', { error, activeThreads, totalThreads })
     }
   }

  /**
    * Record connection pool metric
    */
   async recordConnectionPoolMetric(activeConnections: number, idleConnections: number, totalConnections: number, timestamp: string): Promise<void> {
     try {
       const poolMetric: Omit<PerformanceMetric, 'id'> = {
         metric_type: 'connection_pool',
         value: activeConnections,
         unit: 'connections',
         timestamp,
         metadata: {
           idle_connections: idleConnections,
           total_connections: totalConnections,
           utilization_percent: (activeConnections / totalConnections) * 100
         },
         tags: {
           type: 'active'
         }
       }

       await this.storeMetric(poolMetric)

     } catch (error) {
       logger.error('Failed to record connection pool metric', { error, activeConnections, idleConnections, totalConnections })
     }
   }

  /**
   * Get performance metrics with filtering
   */
  async getMetrics(
    metricType?: PerformanceMetric['metric_type'],
    startTime?: string,
    endTime?: string,
    tags?: Record<string, string>,
    limit: number = 100
  ): Promise<PerformanceMetric[]> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('performance_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (metricType) {
        query = query.eq('metric_type', metricType)
      }

      if (startTime) {
        query = query.gte('timestamp', startTime)
      }

      if (endTime) {
        query = query.lte('timestamp', endTime)
      }

      if (tags) {
        for (const [key, value] of Object.entries(tags)) {
          query = query.eq(`tags->>${key}`, value)
        }
      }

      const { data, error } = await query

      if (error) throw error

      return (data || []).map(metric => ({
        id: metric.id,
        metric_type: metric.metric_type,
        value: metric.value,
        unit: metric.unit,
        timestamp: metric.timestamp,
        metadata: metric.metadata || {},
        tags: metric.tags || {}
      }))

    } catch (error) {
      logger.error('Failed to get performance metrics', { error })
      return []
    }
  }

  /**
   * Get aggregated performance statistics
   */
  async getAggregatedStats(
    metricType: PerformanceMetric['metric_type'],
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    count: number
    average: number
    min: number
    max: number
    p95: number
    p99: number
  }> {
    try {
      const supabase = await createClient()

      // Calculate time range
      const now = new Date()
      const startTime = new Date()

      switch (timeRange) {
        case '1h':
          startTime.setHours(now.getHours() - 1)
          break
        case '24h':
          startTime.setDate(now.getDate() - 1)
          break
        case '7d':
          startTime.setDate(now.getDate() - 7)
          break
        case '30d':
          startTime.setMonth(now.getMonth() - 1)
          break
      }

      const { data, error } = await supabase
        .from('performance_metrics')
        .select('value')
        .eq('metric_type', metricType)
        .gte('timestamp', startTime.toISOString())

      if (error) throw error

      const values = (data || []).map(d => d.value).sort((a, b) => a - b)

      if (values.length === 0) {
        return { count: 0, average: 0, min: 0, max: 0, p95: 0, p99: 0 }
      }

      const average = values.reduce((sum, val) => sum + val, 0) / values.length
      const min = values[0]
      const max = values[values.length - 1]
      const p95Index = Math.floor(values.length * 0.95)
      const p99Index = Math.floor(values.length * 0.99)

      return {
        count: values.length,
        average: Math.round(average * 100) / 100,
        min,
        max,
        p95: values[p95Index] || max,
        p99: values[p99Index] || max
      }

    } catch (error) {
      logger.error('Failed to get aggregated performance stats', { error })
      return { count: 0, average: 0, min: 0, max: 0, p95: 0, p99: 0 }
    }
  }

  /**
   * Clean up old metrics (keep last 30 days)
   */
  async cleanupOldMetrics(): Promise<void> {
    try {
      const supabase = await createClient()

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { error } = await supabase
        .from('performance_metrics')
        .delete()
        .lt('timestamp', thirtyDaysAgo.toISOString())

      if (error) throw error

      logger.info('Cleaned up old performance metrics', { cutoff_date: thirtyDaysAgo.toISOString() })

    } catch (error) {
      logger.error('Failed to cleanup old performance metrics', { error })
    }
  }

  /**
   * Store metric in database
   */
  private async storeMetric(metric: Omit<PerformanceMetric, 'id'>): Promise<void> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('performance_metrics')
        .insert({
          metric_type: metric.metric_type,
          value: metric.value,
          unit: metric.unit,
          timestamp: metric.timestamp,
          metadata: metric.metadata,
          tags: metric.tags
        })

      if (error) throw error

      // Keep in-memory cache for quick access
      this.metrics.unshift({ ...metric, id: Date.now().toString() })
      if (this.metrics.length > this.maxMetricsInMemory) {
        this.metrics = this.metrics.slice(0, this.maxMetricsInMemory)
      }

    } catch (error) {
      logger.error('Failed to store performance metric', { error, metric })
      throw error
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()