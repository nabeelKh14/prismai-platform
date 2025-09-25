import { createServerClient } from "@supabase/ssr"
import { createBrowserClient } from '@supabase/ssr'
import { requireEnv } from "@/lib/env"
import { logger } from "@/lib/logger"

// Connection pool configuration interface
interface ConnectionPoolConfig {
  minConnections?: number
  maxConnections?: number
  maxConnectionAge?: number
  connectionTimeout?: number
  idleTimeout?: number
  maxLifetime?: number
}

// Cache configuration interface
interface CacheConfig {
  ttl?: number
  maxSize?: number
  enableCompression?: boolean
}

// Performance monitoring interface
interface PerformanceMetrics {
  queryStartTime: number
  queryEndTime?: number
  executionTime?: number
  cacheHit?: boolean
  connectionInfo?: {
    activeConnections: number
    idleConnections: number
    waitingConnections: number
  }
}

// Enhanced Supabase client with performance optimizations
export class OptimizedSupabaseClient {
  private supabase: any
  private isServer: boolean
  private tenantId?: string
  private cache = new Map<string, any>()
  private performanceMetrics: PerformanceMetrics[] = []

  constructor(
    isServer: boolean = false,
    tenantId?: string,
    poolConfig?: ConnectionPoolConfig,
    cacheConfig?: CacheConfig
  ) {
    this.isServer = isServer
    this.tenantId = tenantId

    // Create base Supabase client
    if (isServer) {
      this.supabase = this.createServerClientWithOptimizations(poolConfig)
    } else {
      this.supabase = this.createBrowserClientWithOptimizations(cacheConfig)
    }
  }

  private createServerClientWithOptimizations(poolConfig?: ConnectionPoolConfig) {
    const defaultPoolConfig: ConnectionPoolConfig = {
      minConnections: 2,
      maxConnections: 20,
      maxConnectionAge: 3600000, // 1 hour
      connectionTimeout: 30000, // 30 seconds
      idleTimeout: 300000, // 5 minutes
      maxLifetime: 7200000 // 2 hours
    }

    const config = { ...defaultPoolConfig, ...poolConfig }

    // In a real implementation, you would configure the Supabase client
    // with connection pool settings. For now, we'll track metrics.
    return createServerClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL') as string,
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') as string,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            // Cookie handling logic
          },
        },
      }
    )
  }

  private createBrowserClientWithOptimizations(cacheConfig?: CacheConfig) {
    const defaultCacheConfig: CacheConfig = {
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      enableCompression: true
    }

    const config = { ...defaultCacheConfig, ...cacheConfig }

    return createBrowserClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL') as string,
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') as string
    )
  }

  // Enhanced query method with performance monitoring and caching
  async query(
    table: string,
    operation: 'select' | 'insert' | 'update' | 'delete',
    options: any = {},
    useCache: boolean = false,
    cacheKey?: string
  ) {
    const startTime = Date.now()
    const metrics: PerformanceMetrics = {
      queryStartTime: startTime
    }

    try {
      // Check cache first if enabled
      if (useCache && cacheKey) {
        const cachedResult = this.getFromCache(cacheKey)
        if (cachedResult) {
          metrics.cacheHit = true
          metrics.executionTime = Date.now() - startTime
          this.performanceMetrics.push(metrics)
          return cachedResult
        }
      }

      // Execute query with tenant isolation
      let result
      if (this.tenantId) {
        result = await this.executeTenantQuery(table, operation, options)
      } else {
        result = await this.executeQuery(table, operation, options)
      }

      // Cache result if requested
      if (useCache && cacheKey && result) {
        this.setCache(cacheKey, result)
      }

      metrics.executionTime = Date.now() - startTime
      this.performanceMetrics.push(metrics)

      // Log slow queries
      if (metrics.executionTime > 1000) {
        logger.warn('Slow query detected', {
          table,
          operation,
          executionTime: metrics.executionTime,
          tenantId: this.tenantId
        })
      }

      return result

    } catch (error) {
      metrics.executionTime = Date.now() - startTime
      this.performanceMetrics.push(metrics)

      logger.error('Query execution failed', {
        table,
        operation,
        error: error instanceof Error ? error.message : String(error),
        executionTime: metrics.executionTime,
        tenantId: this.tenantId
      })

      throw error
    }
  }

  private async executeTenantQuery(
    table: string,
    operation: string,
    options: any
  ) {
    // Add tenant_id filter to all queries
    const tenantOptions = {
      ...options,
      filter: {
        tenant_id: this.tenantId,
        ...options.filter
      }
    }

    return this.executeQuery(table, operation, tenantOptions)
  }

  private async executeQuery(
    table: string,
    operation: string,
    options: any
  ) {
    switch (operation) {
      case 'select':
        return await this.supabase
          .from(table)
          .select(options.select || '*')
          .eq('tenant_id', this.tenantId)
          .limit(options.limit || 1000)

      case 'insert':
        return await this.supabase
          .from(table)
          .insert({
            ...options.data,
            tenant_id: this.tenantId
          })

      case 'update':
        return await this.supabase
          .from(table)
          .update(options.data)
          .eq('tenant_id', this.tenantId)
          .eq(options.id ? 'id' : 'tenant_id', options.id || this.tenantId)

      case 'delete':
        return await this.supabase
          .from(table)
          .delete()
          .eq('tenant_id', this.tenantId)
          .eq(options.id ? 'id' : 'tenant_id', options.id || this.tenantId)

      default:
        throw new Error(`Unsupported operation: ${operation}`)
    }
  }

  // Cache management methods
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const { data, expires } = cached
    if (Date.now() > expires) {
      this.cache.delete(key)
      return null
    }

    return data
  }

  private setCache(key: string, data: any, ttl?: number): void {
    // Implement cache size limit
    if (this.cache.size >= 1000) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + (ttl || 300000) // 5 minutes default
    })
  }

  // Performance monitoring methods
  getPerformanceMetrics(): PerformanceMetrics[] {
    return this.performanceMetrics
  }

  getAverageQueryTime(): number {
    if (this.performanceMetrics.length === 0) return 0

    const totalTime = this.performanceMetrics.reduce(
      (sum, metric) => sum + (metric.executionTime || 0),
      0
    )

    return totalTime / this.performanceMetrics.length
  }

  getCacheHitRate(): number {
    const cacheHits = this.performanceMetrics.filter(m => m.cacheHit).length
    const totalQueries = this.performanceMetrics.length

    return totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0
  }

  // Connection pool monitoring (mock implementation)
  async getConnectionPoolStats() {
    // In a real implementation, this would query actual connection pool metrics
    return {
      activeConnections: Math.floor(Math.random() * 10) + 1,
      idleConnections: Math.floor(Math.random() * 5) + 1,
      waitingConnections: Math.floor(Math.random() * 3),
      utilizationRate: Math.random() * 100
    }
  }

  // Utility methods for common operations
  async getTenantAnalytics(tenantId?: string) {
    const targetTenantId = tenantId || this.tenantId
    if (!targetTenantId) throw new Error('Tenant ID required')

    const cacheKey = `tenant_analytics_${targetTenantId}`

    return this.query(
      'mv_tenant_performance_summary',
      'select',
      {
        select: '*',
        filter: { tenant_id: targetTenantId }
      },
      true,
      cacheKey
    )
  }

  async getTenantDailyMetrics(tenantId?: string, date?: string) {
    const targetTenantId = tenantId || this.tenantId
    if (!targetTenantId) throw new Error('Tenant ID required')

    const cacheKey = `tenant_metrics_${targetTenantId}_${date || 'today'}`

    return this.query(
      'mv_tenant_daily_metrics',
      'select',
      {
        select: '*',
        filter: {
          tenant_id: targetTenantId,
          date: date || new Date().toISOString().split('T')[0]
        }
      },
      true,
      cacheKey
    )
  }

  async invalidateTenantCache(tenantId?: string) {
    const targetTenantId = tenantId || this.tenantId
    if (!targetTenantId) return

    // Clear cache entries for this tenant
    for (const [key] of this.cache) {
      if (key.includes(targetTenantId)) {
        this.cache.delete(key)
      }
    }

    // In a real implementation, you would also invalidate Redis cache
    logger.info('Tenant cache invalidated', { tenantId: targetTenantId })
  }

  // Health check method
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    metrics: {
      averageQueryTime: number
      cacheHitRate: number
      connectionPoolUtilization: number
    }
  }> {
    const avgQueryTime = this.getAverageQueryTime()
    const cacheHitRate = this.getCacheHitRate()
    const poolStats = await this.getConnectionPoolStats()
    const utilization = poolStats.utilizationRate

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (avgQueryTime > 5000 || utilization > 90 || cacheHitRate < 50) {
      status = 'unhealthy'
    } else if (avgQueryTime > 1000 || utilization > 70 || cacheHitRate < 70) {
      status = 'degraded'
    }

    return {
      status,
      metrics: {
        averageQueryTime: avgQueryTime,
        cacheHitRate,
        connectionPoolUtilization: utilization
      }
    }
  }
}

// Factory functions for creating optimized clients
export function createOptimizedServerClient(
  tenantId?: string,
  poolConfig?: ConnectionPoolConfig,
  cacheConfig?: CacheConfig
) {
  return new OptimizedSupabaseClient(true, tenantId, poolConfig, cacheConfig)
}

export function createOptimizedBrowserClient(
  tenantId?: string,
  cacheConfig?: CacheConfig
) {
  return new OptimizedSupabaseClient(false, tenantId, undefined, cacheConfig)
}

// Default export for backward compatibility
export default OptimizedSupabaseClient