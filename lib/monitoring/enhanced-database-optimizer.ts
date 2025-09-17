import { createClient } from '@/lib/supabase/server'
import { performanceMonitor } from './performance-monitor'
import { logger } from '@/lib/logger'

export interface QueryExecutionPlan {
  query: string
  plan: any
  estimatedCost: number
  actualCost: number
  executionTime: number
  rowsEstimated: number
  rowsActual: number
  optimizationSuggestions: string[]
}

export interface PreparedStatement {
  id: string
  query: string
  params: any[]
  preparedAt: number
  lastUsed: number
  useCount: number
}

export interface QueryOptimizationResult {
  originalQuery: string
  optimizedQuery: string
  executionPlan: QueryExecutionPlan
  performanceImprovement: number
  optimizationApplied: string[]
}

export interface ConnectionPoolStats {
  activeConnections: number
  idleConnections: number
  totalConnections: number
  waitingRequests: number
  poolUtilization: number
}

export class EnhancedDatabaseOptimizer {
  private static instance: EnhancedDatabaseOptimizer
  private preparedStatements: Map<string, PreparedStatement> = new Map()
  private queryCache: Map<string, {
    result: any
    timestamp: number
    ttl: number
    dependencies: string[]
    hitCount: number
  }> = new Map()
  private connectionPool: any[] = [] // Would integrate with actual connection pool
  private slowQueryThreshold = 1000 // 1 second
  private maxPreparedStatements = 100
  private maxCacheSize = 1000

  static getInstance(): EnhancedDatabaseOptimizer {
    if (!EnhancedDatabaseOptimizer.instance) {
      EnhancedDatabaseOptimizer.instance = new EnhancedDatabaseOptimizer()
    }
    return EnhancedDatabaseOptimizer.instance
  }

  /**
   * Execute query with advanced optimization
   */
  async executeOptimizedQuery<T>(
    query: string,
    params?: any[],
    options?: {
      useCache?: boolean
      cacheTTL?: number
      analyzeQuery?: boolean
      usePreparedStatement?: boolean
      optimizeQuery?: boolean
    }
  ): Promise<T> {
    const startTime = Date.now()
    const queryHash = this.generateQueryHash(query, params)

    try {
      // Check cache first
      if (options?.useCache !== false) {
        const cachedResult = this.getFromCache(queryHash)
        if (cachedResult) {
          await this.recordCacheHit(queryHash, startTime)
          return cachedResult
        }
      }

      // Optimize query if requested
      let optimizedQuery = query
      let optimizationApplied: string[] = []

      if (options?.optimizeQuery !== false) {
        const optimization = await this.optimizeQuery(query, params)
        optimizedQuery = optimization.optimizedQuery
        optimizationApplied = optimization.optimizationApplied
      }

      // Use prepared statement if available and requested
      let result: any
      if (options?.usePreparedStatement !== false && this.shouldUsePreparedStatement(query)) {
        result = await this.executeWithPreparedStatement(optimizedQuery, params)
      } else {
        result = await this.executeDirectQuery(optimizedQuery, params)
      }

      const endTime = Date.now()
      const executionTime = endTime - startTime

      // Analyze query if requested
      if (options?.analyzeQuery) {
        await this.analyzeQueryExecution(optimizedQuery, params, executionTime)
      }

      // Cache result if caching is enabled
      if (options?.useCache !== false) {
        await this.setCache(queryHash, result, options?.cacheTTL || 300000, this.extractDependencies(query))
      }

      // Record performance metrics
      await this.recordQueryMetrics({
        query: optimizedQuery,
        executionTime,
        rowsAffected: Array.isArray(result) ? result.length : 1,
        optimizationApplied,
        slowQuery: executionTime > this.slowQueryThreshold
      })

      return result

    } catch (error) {
      const endTime = Date.now()
      const executionTime = endTime - startTime

      await this.recordQueryError(query, executionTime, error)
      throw error
    }
  }

  /**
   * Analyze query execution plan
   */
  async analyzeQueryExecution(
    query: string,
    params?: any[],
    actualExecutionTime?: number
  ): Promise<QueryExecutionPlan> {
    try {
      const supabase = await createClient()

      // Get EXPLAIN plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
      const { data: explainData, error } = await supabase.rpc('execute_query', {
        query_text: explainQuery,
        query_params: params || []
      })

      if (error) {
        logger.warn('Failed to analyze query execution plan', { error, query })
        return this.createBasicExecutionPlan(query, actualExecutionTime || 0)
      }

      const plan = this.parseExplainPlan(explainData)
      const suggestions = this.generateOptimizationSuggestions(plan, query)

      const executionPlan: QueryExecutionPlan = {
        query,
        plan,
        estimatedCost: plan.estimatedCost || 0,
        actualCost: plan.actualCost || 0,
        executionTime: actualExecutionTime || plan.executionTime || 0,
        rowsEstimated: plan.rowsEstimated || 0,
        rowsActual: plan.rowsActual || 0,
        optimizationSuggestions: suggestions
      }

      // Store execution plan for future reference
      await this.storeExecutionPlan(executionPlan)

      return executionPlan

    } catch (error) {
      logger.error('Error analyzing query execution', { error, query })
      return this.createBasicExecutionPlan(query, actualExecutionTime || 0)
    }
  }

  /**
   * Optimize query automatically
   */
  async optimizeQuery(query: string, params?: any[]): Promise<QueryOptimizationResult> {
    const originalQuery = query
    let optimizedQuery = query
    const optimizationApplied: string[] = []

    try {
      // Analyze current execution plan
      const currentPlan = await this.analyzeQueryExecution(query, params)

      // Apply optimization strategies
      optimizedQuery = await this.applyQueryOptimizations(query, currentPlan, optimizationApplied)

      // Compare performance
      const optimizedPlan = await this.analyzeQueryExecution(optimizedQuery, params)
      const performanceImprovement = this.calculatePerformanceImprovement(currentPlan, optimizedPlan)

      return {
        originalQuery,
        optimizedQuery,
        executionPlan: optimizedPlan,
        performanceImprovement,
        optimizationApplied
      }

    } catch (error) {
      logger.warn('Query optimization failed, using original query', { error, query })
      return {
        originalQuery,
        optimizedQuery: originalQuery,
        executionPlan: await this.analyzeQueryExecution(originalQuery, params),
        performanceImprovement: 0,
        optimizationApplied: []
      }
    }
  }

  /**
   * Execute query with prepared statement
   */
  private async executeWithPreparedStatement(query: string, params?: any[]): Promise<any> {
    const statementId = this.getOrCreatePreparedStatement(query)

    try {
      const supabase = await createClient()

      // Execute using prepared statement
      const { data, error } = await supabase.rpc('execute_prepared_statement', {
        statement_id: statementId,
        params: params || []
      })

      if (error) throw error

      // Update prepared statement usage
      this.updatePreparedStatementUsage(statementId)

      return data

    } catch (error) {
      // Fallback to direct execution if prepared statement fails
      logger.warn('Prepared statement execution failed, falling back to direct query', { error, statementId })
      return this.executeDirectQuery(query, params)
    }
  }

  /**
   * Execute direct query
   */
  private async executeDirectQuery(query: string, params?: any[]): Promise<any> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('execute_query', {
      query_text: query,
      query_params: params || []
    })

    if (error) throw error
    return data
  }

  /**
   * Apply query optimizations
   */
  private async applyQueryOptimizations(
    query: string,
    plan: QueryExecutionPlan,
    optimizationApplied: string[]
  ): Promise<string> {
    let optimizedQuery = query

    // 1. Add missing JOIN conditions if detected
    if (this.hasMissingJoinConditions(plan)) {
      optimizedQuery = this.addJoinConditions(optimizedQuery)
      optimizationApplied.push('Added missing JOIN conditions')
    }

    // 2. Optimize WHERE clauses
    if (this.hasOptimizableWhereClause(query)) {
      optimizedQuery = this.optimizeWhereClause(optimizedQuery)
      optimizationApplied.push('Optimized WHERE clause')
    }

    // 3. Add query hints for better execution
    if (this.shouldAddQueryHints(plan)) {
      optimizedQuery = this.addQueryHints(optimizedQuery, plan)
      optimizationApplied.push('Added query execution hints')
    }

    // 4. Optimize subqueries
    if (this.hasSubqueryOptimizations(query)) {
      optimizedQuery = this.optimizeSubqueries(optimizedQuery)
      optimizationApplied.push('Optimized subqueries')
    }

    // 5. Add LIMIT/OFFSET optimizations
    if (this.shouldOptimizeLimitOffset(query)) {
      optimizedQuery = this.optimizeLimitOffset(optimizedQuery)
      optimizationApplied.push('Optimized LIMIT/OFFSET usage')
    }

    return optimizedQuery
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(plan: any, query: string): string[] {
    const suggestions: string[] = []

    // Check for sequential scans on large tables
    if (this.hasSequentialScan(plan)) {
      suggestions.push('Consider adding indexes on frequently queried columns')
    }

    // Check for high cost operations
    if (plan.estimatedCost > 10000) {
      suggestions.push('Query has high estimated cost - consider optimization')
    }

    // Check for missing indexes
    const missingIndexes = this.identifyMissingIndexes(plan)
    if (missingIndexes.length > 0) {
      suggestions.push(`Consider creating indexes on: ${missingIndexes.join(', ')}`)
    }

    // Check for inefficient joins
    if (this.hasInefficientJoins(plan)) {
      suggestions.push('Consider reordering JOINs or adding composite indexes')
    }

    return suggestions
  }

  /**
   * Cache management with smart invalidation
   */
  private getFromCache(queryHash: string): any | null {
    const cached = this.queryCache.get(queryHash)
    if (!cached) return null

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(queryHash)
      return null
    }

    cached.hitCount++
    return cached.result
  }

  private async setCache(
    queryHash: string,
    result: any,
    ttl: number,
    dependencies: string[]
  ): Promise<void> {
    // Clean up old cache entries
    if (this.queryCache.size >= this.maxCacheSize) {
      this.cleanupCache()
    }

    this.queryCache.set(queryHash, {
      result,
      timestamp: Date.now(),
      ttl,
      dependencies,
      hitCount: 0
    })
  }

  private async recordCacheHit(queryHash: string, startTime: number): Promise<void> {
    const cached = this.queryCache.get(queryHash)
    if (cached) {
      cached.hitCount++

      await performanceMonitor.recordCacheMetric(
        this.calculateCacheHitRate(),
        this.queryCache.size,
        new Date().toISOString()
      )
    }
  }

  /**
   * Prepared statement management
   */
  private getOrCreatePreparedStatement(query: string): string {
    const queryHash = this.generateQueryHash(query)

    let statement = this.preparedStatements.get(queryHash)
    if (!statement) {
      statement = {
        id: `stmt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query,
        params: [],
        preparedAt: Date.now(),
        lastUsed: Date.now(),
        useCount: 0
      }
      this.preparedStatements.set(queryHash, statement)

      // Clean up old prepared statements
      if (this.preparedStatements.size > this.maxPreparedStatements) {
        this.cleanupPreparedStatements()
      }
    }

    return statement.id
  }

  private updatePreparedStatementUsage(statementId: string): void {
    for (const [hash, statement] of this.preparedStatements.entries()) {
      if (statement.id === statementId) {
        statement.lastUsed = Date.now()
        statement.useCount++
        break
      }
    }
  }

  private shouldUsePreparedStatement(query: string): boolean {
    // Use prepared statements for queries that will be executed multiple times
    const queryHash = this.generateQueryHash(query)
    const statement = this.preparedStatements.get(queryHash)
    return statement ? statement.useCount > 1 : false
  }

  /**
   * Connection pool monitoring
   */
  async getConnectionPoolStats(): Promise<ConnectionPoolStats> {
    // This would integrate with actual connection pool metrics
    // For now, return mock data
    return {
      activeConnections: 5,
      idleConnections: 10,
      totalConnections: 15,
      waitingRequests: 0,
      poolUtilization: 33.33
    }
  }

  /**
   * Query performance profiling
   */
  async getQueryPerformanceProfile(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<any[]> {
    try {
      const supabase = await createClient()

      const timeFilter = this.getTimeFilter(timeRange)

      const { data, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('metric_type', 'database_query')
        .gte('timestamp', timeFilter)
        .order('value', { ascending: false })
        .limit(50)

      if (error) throw error

      return data || []

    } catch (error) {
      logger.error('Failed to get query performance profile', { error })
      return []
    }
  }

  /**
   * Utility methods
   */
  private generateQueryHash(query: string, params?: any[]): string {
    const paramStr = params ? JSON.stringify(params) : ''
    return `${query}:${paramStr}`
  }

  private calculateCacheHitRate(): number {
    const totalRequests = Array.from(this.queryCache.values())
      .reduce((sum, cached) => sum + cached.hitCount, 0)

    if (totalRequests === 0) return 0

    const totalHits = Array.from(this.queryCache.values())
      .reduce((sum, cached) => sum + cached.hitCount, 0)

    return (totalHits / totalRequests) * 100
  }

  private cleanupCache(): void {
    // Remove least recently used items
    const entries = Array.from(this.queryCache.entries())
      .sort(([,a], [,b]) => a.timestamp - b.timestamp)

    const toRemove = entries.slice(0, Math.floor(this.maxCacheSize * 0.1))
    toRemove.forEach(([key]) => this.queryCache.delete(key))
  }

  private cleanupPreparedStatements(): void {
    // Remove least recently used prepared statements
    const entries = Array.from(this.preparedStatements.entries())
      .sort(([,a], [,b]) => a.lastUsed - b.lastUsed)

    const toRemove = entries.slice(0, Math.floor(this.maxPreparedStatements * 0.2))
    toRemove.forEach(([key]) => this.preparedStatements.delete(key))
  }

  private getTimeFilter(timeRange: string): string {
    const now = new Date()
    switch (timeRange) {
      case '1h': now.setHours(now.getHours() - 1); break
      case '24h': now.setDate(now.getDate() - 1); break
      case '7d': now.setDate(now.getDate() - 7); break
    }
    return now.toISOString()
  }

  // Placeholder methods for optimization logic
  private hasMissingJoinConditions(plan: any): boolean { return false }
  private addJoinConditions(query: string): string { return query }
  private hasOptimizableWhereClause(query: string): boolean { return false }
  private optimizeWhereClause(query: string): string { return query }
  private shouldAddQueryHints(plan: any): boolean { return false }
  private addQueryHints(query: string, plan: any): string { return query }
  private hasSubqueryOptimizations(query: string): boolean { return false }
  private optimizeSubqueries(query: string): string { return query }
  private shouldOptimizeLimitOffset(query: string): boolean { return false }
  private optimizeLimitOffset(query: string): string { return query }
  private hasSequentialScan(plan: any): boolean { return false }
  private identifyMissingIndexes(plan: any): string[] { return [] }
  private hasInefficientJoins(plan: any): boolean { return false }
  private parseExplainPlan(data: any): any { return data }
  private createBasicExecutionPlan(query: string, executionTime: number): QueryExecutionPlan {
    return {
      query,
      plan: null,
      estimatedCost: 0,
      actualCost: 0,
      executionTime,
      rowsEstimated: 0,
      rowsActual: 0,
      optimizationSuggestions: []
    }
  }
  private calculatePerformanceImprovement(current: QueryExecutionPlan, optimized: QueryExecutionPlan): number {
    if (current.executionTime === 0) return 0
    return ((current.executionTime - optimized.executionTime) / current.executionTime) * 100
  }
  private extractDependencies(query: string): string[] { return [] }

  /**
   * Record metrics
   */
  private async recordQueryMetrics(metrics: any): Promise<void> {
    await performanceMonitor.recordDatabaseMetric({
      query_type: 'select', // Use 'select' as default for optimized queries
      table_name: 'multiple',
      execution_time_ms: metrics.executionTime,
      rows_affected: metrics.rowsAffected,
      timestamp: new Date().toISOString()
    })

    if (metrics.slowQuery) {
      logger.warn('Slow optimized query detected', {
        query: metrics.query.substring(0, 200) + '...',
        execution_time_ms: metrics.executionTime,
        optimizations_applied: metrics.optimizationApplied
      })
    }
  }

  private async recordQueryError(query: string, executionTime: number, error: any): Promise<void> {
    await performanceMonitor.recordDatabaseMetric({
      query_type: 'select', // Use 'select' as default for failed queries
      table_name: 'unknown',
      execution_time_ms: executionTime,
      rows_affected: 0,
      timestamp: new Date().toISOString()
    })

    logger.error('Database query error in optimizer', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: query.substring(0, 200) + '...',
      execution_time_ms: executionTime
    })
  }

  private async storeExecutionPlan(plan: QueryExecutionPlan): Promise<void> {
    // Store execution plan in database for analysis
    try {
      const supabase = await createClient()
      await supabase.from('query_execution_plans').insert({
        query: plan.query,
        execution_plan: plan.plan,
        estimated_cost: plan.estimatedCost,
        actual_cost: plan.actualCost,
        execution_time_ms: plan.executionTime,
        rows_estimated: plan.rowsEstimated,
        rows_actual: plan.rowsActual,
        optimization_suggestions: plan.optimizationSuggestions,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      logger.warn('Failed to store execution plan', { error })
    }
  }
}

// Export singleton instance
export const enhancedDatabaseOptimizer = EnhancedDatabaseOptimizer.getInstance()