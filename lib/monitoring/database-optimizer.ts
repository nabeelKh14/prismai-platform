import { createClient } from '@/lib/supabase/server'
import { performanceMonitor } from './performance-monitor'
import { logger } from '@/lib/logger'

export interface QueryMetrics {
  query: string
  executionTime: number
  rowsAffected: number
  timestamp: string
  slowQuery: boolean
}

export interface QueryPlan {
  query: string
  plan: any
  estimatedCost: number
  actualCost: number
  executionTime: number
}

export interface CacheMetrics {
  cacheHits: number
  cacheMisses: number
  hitRate: number
  totalRequests: number
}

export class DatabaseOptimizer {
  private static instance: DatabaseOptimizer
  private queryCache: Map<string, { result: any; timestamp: number; ttl: number }> = new Map()
  private slowQueryThreshold = 1000 // 1 second
  private cacheMetrics: CacheMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    totalRequests: 0
  }

  static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer()
    }
    return DatabaseOptimizer.instance
  }

  /**
   * Execute query with monitoring and optimization
   */
  async executeQuery<T>(
    query: string,
    params?: any[],
    options?: {
      useCache?: boolean
      cacheTTL?: number
      analyzeQuery?: boolean
    }
  ): Promise<T> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(query, params)
    const timestamp = new Date().toISOString()

    try {
      // Check cache first if enabled
      if (options?.useCache !== false) {
        const cachedResult = this.getFromCache(cacheKey)
        if (cachedResult) {
          this.cacheMetrics.cacheHits++
          this.cacheMetrics.totalRequests++

          await performanceMonitor.recordCacheMetric(
            this.cacheMetrics.hitRate,
            this.cacheMetrics.totalRequests,
            timestamp
          )

          return cachedResult
        }
      }

      this.cacheMetrics.cacheMisses++
      this.cacheMetrics.totalRequests++
      this.cacheMetrics.hitRate = this.cacheMetrics.cacheHits / this.cacheMetrics.totalRequests

      // Execute query
      const supabase = await createClient()
      const { data, error } = await supabase.rpc('execute_query', {
        query_text: query,
        query_params: params || []
      })

      if (error) throw error

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // Record query metrics
      await this.recordQueryMetrics({
        query,
        executionTime,
        rowsAffected: Array.isArray(data) ? data.length : 1,
        timestamp,
        slowQuery: executionTime > this.slowQueryThreshold
      })

      // Analyze query if requested
      if (options?.analyzeQuery) {
        await this.analyzeQuery(query, params)
      }

      // Cache result if caching is enabled
      if (options?.useCache !== false) {
        this.setCache(cacheKey, data, options?.cacheTTL || 300000) // 5 minutes default
      }

      return data

    } catch (error) {
      const endTime = Date.now()
      const executionTime = endTime - startTime

      await this.recordQueryMetrics({
        query,
        executionTime,
        rowsAffected: 0,
        timestamp,
        slowQuery: true
      })

      logger.error('Database query error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
        executionTime
      })

      throw error
    }
  }

  /**
   * Execute SELECT query with optimization
   */
  async executeSelect<T>(
    table: string,
    filters?: Record<string, any>,
    options?: {
      useCache?: boolean
      cacheTTL?: number
      limit?: number
      orderBy?: string
      analyzeQuery?: boolean
    }
  ): Promise<T[]> {
    const supabase = await createClient()

    let query = supabase.from(table).select('*')

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      })
    }

    // Apply ordering
    if (options?.orderBy) {
      query = query.order(options.orderBy)
    }

    // Apply limit
    if (options?.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) throw error

    // Record metrics
    const timestamp = new Date().toISOString()
    await performanceMonitor.recordDatabaseMetric({
      query_type: 'select',
      table_name: table,
      execution_time_ms: 0, // Would need to be measured properly
      timestamp
    })

    return data || []
  }

  /**
   * Execute INSERT with optimization
   */
  async executeInsert(
    table: string,
    data: Record<string, any> | Record<string, any>[],
    options?: {
      analyzeQuery?: boolean
      batchSize?: number
    }
  ): Promise<any> {
    const supabase = await createClient()
    const timestamp = new Date().toISOString()

    // Handle batch inserts
    if (Array.isArray(data) && data.length > (options?.batchSize || 100)) {
      const batches = this.chunkArray(data, options?.batchSize || 100)
      const results = []

      for (const batch of batches) {
        const { data: result, error } = await supabase
          .from(table)
          .insert(batch)
          .select()

        if (error) throw error
        results.push(result)
      }

      await performanceMonitor.recordDatabaseMetric({
        query_type: 'insert',
        table_name: table,
        execution_time_ms: 0,
        rows_affected: data.length,
        timestamp
      })

      return results.flat()
    }

    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()

    if (error) throw error

    await performanceMonitor.recordDatabaseMetric({
      query_type: 'insert',
      table_name: table,
      execution_time_ms: 0,
      rows_affected: Array.isArray(data) ? data.length : 1,
      timestamp
    })

    return result
  }

  /**
   * Execute UPDATE with optimization
   */
  async executeUpdate(
    table: string,
    updates: Record<string, any>,
    filters: Record<string, any>,
    options?: {
      analyzeQuery?: boolean
    }
  ): Promise<any> {
    const supabase = await createClient()
    const timestamp = new Date().toISOString()

    let query = supabase.from(table).update(updates)

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    })

    const { data, error } = await query.select()

    if (error) throw error

    await performanceMonitor.recordDatabaseMetric({
      query_type: 'update',
      table_name: table,
      execution_time_ms: 0,
      rows_affected: data?.length || 0,
      timestamp
    })

    return data
  }

  /**
   * Execute DELETE with optimization
   */
  async executeDelete(
    table: string,
    filters: Record<string, any>,
    options?: {
      analyzeQuery?: boolean
    }
  ): Promise<any> {
    const supabase = await createClient()
    const timestamp = new Date().toISOString()

    let query = supabase.from(table).delete()

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    })

    const { data, error } = await query.select()

    if (error) throw error

    await performanceMonitor.recordDatabaseMetric({
      query_type: 'delete',
      table_name: table,
      execution_time_ms: 0,
      rows_affected: data?.length || 0,
      timestamp
    })

    return data
  }

  /**
   * Analyze query performance
   */
  private async analyzeQuery(query: string, params?: any[]): Promise<void> {
    try {
      const supabase = await createClient()

      // Use EXPLAIN to analyze query
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS) ${query}`
      const { data, error } = await supabase.rpc('execute_query', {
        query_text: explainQuery,
        query_params: params || []
      })

      if (error) {
        logger.warn('Failed to analyze query', { error, query })
        return
      }

      // Parse explain output and log insights
      logger.info('Query analysis completed', {
        query: query.substring(0, 100) + '...',
        analysis: data
      })

    } catch (error) {
      logger.warn('Query analysis failed', { error, query })
    }
  }

  /**
   * Record query metrics
   */
  private async recordQueryMetrics(metrics: QueryMetrics): Promise<void> {
    await performanceMonitor.recordDatabaseMetric({
      query_type: 'select', // Default - would need to parse query to determine type
      table_name: 'unknown', // Would need to parse query
      execution_time_ms: metrics.executionTime,
      rows_affected: metrics.rowsAffected,
      timestamp: metrics.timestamp
    })

    if (metrics.slowQuery) {
      logger.warn('Slow database query detected', {
        query: metrics.query.substring(0, 200) + '...',
        execution_time_ms: metrics.executionTime,
        rows_affected: metrics.rowsAffected
      })
    }
  }

  /**
   * Cache management
   */
  private generateCacheKey(query: string, params?: any[]): string {
    const paramStr = params ? JSON.stringify(params) : ''
    return `${query}:${paramStr}`
  }

  private getFromCache(key: string): any | null {
    const cached = this.queryCache.get(key)
    if (!cached) return null

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key)
      return null
    }

    return cached.result
  }

  private setCache(key: string, result: any, ttl: number): void {
    this.queryCache.set(key, {
      result,
      timestamp: Date.now(),
      ttl
    })

    // Clean up old cache entries periodically
    if (this.queryCache.size > 1000) {
      this.cleanupCache()
    }
  }

  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.queryCache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheMetrics {
    return { ...this.cacheMetrics }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.queryCache.clear()
    this.cacheMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      totalRequests: 0
    }
    logger.info('Database query cache cleared')
  }

  /**
   * Utility function to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Get database performance insights
   */
  async getPerformanceInsights(): Promise<{
    slowQueries: QueryMetrics[]
    cacheEfficiency: number
    connectionPoolStats: any
  }> {
    // This would integrate with actual database monitoring
    // For now, return basic stats
    return {
      slowQueries: [],
      cacheEfficiency: this.cacheMetrics.hitRate,
      connectionPoolStats: {}
    }
  }
}

// Export singleton instance
export const databaseOptimizer = DatabaseOptimizer.getInstance()