import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface IndexRecommendation {
  id: string
  tableName: string
  columnName: string
  recommendationType: 'single_column' | 'composite' | 'partial' | 'covering' | 'gin' | 'gist'
  reasoning: string
  estimatedImpact: string
  sqlStatement: string
  priority: 'high' | 'medium' | 'low'
  confidence: number // 0-100
  createdAt: string
  implemented: boolean
  implementedAt?: string
  performanceGain?: number
}

export interface IndexAnalysisResult {
  recommendations: IndexRecommendation[]
  analysisSummary: {
    totalTables: number
    totalIndexes: number
    unusedIndexes: number
    missingIndexes: number
    potentialPerformanceGain: number
  }
  executionTime: number
}

export class IndexRecommendationEngine {
  private static instance: IndexRecommendationEngine
  private analysisCache: Map<string, { result: IndexAnalysisResult; timestamp: number }> = new Map()
  private readonly cacheTTL = 3600000 // 1 hour

  static getInstance(): IndexRecommendationEngine {
    if (!IndexRecommendationEngine.instance) {
      IndexRecommendationEngine.instance = new IndexRecommendationEngine()
    }
    return IndexRecommendationEngine.instance
  }

  /**
   * Analyze database and generate index recommendations
   */
  async analyzeAndRecommendIndexes(): Promise<IndexAnalysisResult> {
    const startTime = Date.now()
    const cacheKey = 'index_analysis'

    // Check cache first
    const cached = this.analysisCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result
    }

    try {
      const supabase = await createClient()

      // Get database schema information
      const { data: schemaInfo, error: schemaError } = await supabase.rpc('get_database_schema_info')
      if (schemaError) throw schemaError

      // Get query performance data
      const { data: queryStats, error: queryError } = await supabase.rpc('get_query_performance_metrics', { p_time_range: '7d' })
      if (queryError) throw queryError

      // Get existing index information
      const { data: indexStats, error: indexError } = await supabase.rpc('get_index_performance_metrics')
      if (indexError) throw indexError

      // Analyze and generate recommendations
      const recommendations = await this.generateRecommendations(schemaInfo, queryStats, indexStats)

      const analysisResult: IndexAnalysisResult = {
        recommendations,
        analysisSummary: {
          totalTables: schemaInfo?.table_count || 0,
          totalIndexes: indexStats?.total_indexes || 0,
          unusedIndexes: indexStats?.unused_indexes || 0,
          missingIndexes: recommendations.length,
          potentialPerformanceGain: this.calculatePotentialGain(recommendations)
        },
        executionTime: Date.now() - startTime
      }

      // Cache the result
      this.analysisCache.set(cacheKey, {
        result: analysisResult,
        timestamp: Date.now()
      })

      // Store recommendations in database
      await this.storeRecommendations(recommendations)

      return analysisResult

    } catch (error) {
      logger.error('Error analyzing indexes and generating recommendations', { error })
      throw error
    }
  }

  /**
   * Get existing recommendations
   */
  async getExistingRecommendations(
    status?: 'pending' | 'implemented' | 'rejected',
    priority?: 'high' | 'medium' | 'low'
  ): Promise<IndexRecommendation[]> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('index_recommendations')
        .select('*')
        .order('created_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      if (priority) {
        query = query.eq('priority', priority)
      }

      const { data, error } = await query.limit(50)
      if (error) throw error

      return (data || []).map(rec => ({
        id: rec.id,
        tableName: rec.table_name,
        columnName: rec.column_name,
        recommendationType: rec.recommendation_type,
        reasoning: rec.reasoning,
        estimatedImpact: rec.estimated_impact,
        sqlStatement: rec.sql_statement,
        priority: rec.priority,
        confidence: rec.confidence || 50,
        createdAt: rec.created_at,
        implemented: rec.implemented || false,
        implementedAt: rec.implemented_at,
        performanceGain: rec.performance_gain
      }))

    } catch (error) {
      logger.error('Error getting existing recommendations', { error })
      return []
    }
  }

  /**
   * Implement a specific index recommendation
   */
  async implementRecommendation(recommendationId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      // Get the recommendation
      const { data: recommendation, error: fetchError } = await supabase
        .from('index_recommendations')
        .select('*')
        .eq('id', recommendationId)
        .single()

      if (fetchError || !recommendation) {
        throw new Error('Recommendation not found')
      }

      // Execute the index creation
      const { error: execError } = await supabase.rpc('execute_query', {
        query_text: recommendation.sql_statement,
        query_params: []
      })

      if (execError) {
        // Mark as rejected if execution fails
        await supabase
          .from('index_recommendations')
          .update({
            status: 'rejected',
            error_message: execError.message
          })
          .eq('id', recommendationId)

        logger.warn('Index recommendation implementation failed', {
          recommendationId,
          error: execError.message
        })
        return false
      }

      // Mark as implemented
      await supabase
        .from('index_recommendations')
        .update({
          status: 'implemented',
          implemented_at: new Date().toISOString()
        })
        .eq('id', recommendationId)

      logger.info('Index recommendation implemented successfully', {
        recommendationId,
        tableName: recommendation.table_name,
        indexType: recommendation.recommendation_type
      })

      return true

    } catch (error) {
      logger.error('Error implementing index recommendation', { error, recommendationId })
      return false
    }
  }

  /**
   * Generate comprehensive index recommendations
   */
  private async generateRecommendations(
    schemaInfo: any,
    queryStats: any,
    indexStats: any
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = []

    // Analyze each table for missing indexes
    if (schemaInfo?.tables) {
      for (const table of schemaInfo.tables) {
        const tableRecommendations = await this.analyzeTableForIndexes(table, queryStats, indexStats)
        recommendations.push(...tableRecommendations)
      }
    }

    // Analyze query patterns for composite indexes
    const queryRecommendations = this.analyzeQueryPatternsForIndexes(queryStats)
    recommendations.push(...queryRecommendations)

    // Analyze for unused indexes that could be removed
    const cleanupRecommendations = this.analyzeUnusedIndexes(indexStats)
    recommendations.push(...cleanupRecommendations)

    // Sort by priority and confidence
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.confidence - a.confidence
    })
  }

  /**
   * Analyze a specific table for missing indexes
   */
  private async analyzeTableForIndexes(
    table: any,
    queryStats: any,
    indexStats: any
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = []

    try {
      const supabase = await createClient()

      // Get column statistics for the table
      const { data: columnStats, error } = await supabase
        .from('pg_stats')
        .select('*')
        .eq('schemaname', 'public')
        .eq('tablename', table.table_name)

      if (error || !columnStats) return recommendations

      for (const column of columnStats) {
        // Skip if index already exists
        const indexExists = table.indexes?.some((idx: any) =>
          idx.index_name.includes(column.attname)
        )

        if (indexExists) continue

        // Analyze column for indexing potential
        const recommendation = this.evaluateColumnForIndexing(column, table, queryStats)
        if (recommendation) {
          recommendations.push(recommendation)
        }
      }

    } catch (error) {
      logger.warn('Error analyzing table for indexes', {
        tableName: table.table_name,
        error
      })
    }

    return recommendations
  }

  /**
   * Evaluate a column for indexing potential
   */
  private evaluateColumnForIndexing(
    column: any,
    table: any,
    queryStats: any
  ): IndexRecommendation | null {
    const { attname, n_distinct, correlation, most_common_vals } = column

    // Skip columns with very low selectivity
    if (n_distinct < 10) return null

    // Calculate confidence based on various factors
    let confidence = 50
    let reasoning = ''
    let priority: 'high' | 'medium' | 'low' = 'medium'

    // High selectivity columns
    if (n_distinct > 10000) {
      confidence += 20
      reasoning += 'High selectivity column with many distinct values. '
      priority = 'high'
    }

    // Foreign key candidates
    if (attname.includes('_id') || attname.endsWith('id')) {
      confidence += 15
      reasoning += 'Potential foreign key column. '
      priority = 'high'
    }

    // Frequently queried columns (based on query patterns)
    if (this.isFrequentlyQueried(attname, table.table_name, queryStats)) {
      confidence += 10
      reasoning += 'Frequently appears in WHERE clauses. '
      priority = 'high'
    }

    // Time-based columns
    if (attname.includes('created_at') || attname.includes('updated_at') || attname.includes('date')) {
      confidence += 5
      reasoning += 'Time-based column often used for range queries. '
    }

    // Status or enum columns
    if (attname.includes('status') || attname.includes('type') || attname.includes('state')) {
      confidence += 5
      reasoning += 'Status/enum column commonly filtered. '
    }

    if (confidence < 60) return null

    const sqlStatement = `CREATE INDEX CONCURRENTLY idx_${table.table_name}_${attname} ON public.${table.table_name}(${attname});`

    return {
      id: `rec_${table.table_name}_${attname}_${Date.now()}`,
      tableName: table.table_name,
      columnName: attname,
      recommendationType: 'single_column',
      reasoning: reasoning.trim(),
      estimatedImpact: this.estimateIndexImpact(column, table),
      sqlStatement,
      priority,
      confidence: Math.min(confidence, 95),
      createdAt: new Date().toISOString(),
      implemented: false
    }
  }

  /**
   * Analyze query patterns for composite indexes
   */
  private analyzeQueryPatternsForIndexes(queryStats: any): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = []

    // This would analyze slow queries to identify common WHERE clause patterns
    // For now, return empty array as this requires more complex query log analysis
    return recommendations
  }

  /**
   * Analyze unused indexes for cleanup recommendations
   */
  private analyzeUnusedIndexes(indexStats: any): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = []

    if (indexStats?.index_usage_stats) {
      for (const index of indexStats.index_usage_stats) {
        if (index.scans === 0) {
          recommendations.push({
            id: `cleanup_${index.index_name}_${Date.now()}`,
            tableName: index.table_name,
            columnName: index.index_name,
            recommendationType: 'single_column',
            reasoning: 'Index has never been used and could be removed to save space',
            estimatedImpact: 'Minimal performance impact, potential space savings',
            sqlStatement: `DROP INDEX CONCURRENTLY public.${index.index_name};`,
            priority: 'low',
            confidence: 80,
            createdAt: new Date().toISOString(),
            implemented: false
          })
        }
      }
    }

    return recommendations
  }

  /**
   * Estimate the performance impact of an index
   */
  private estimateIndexImpact(column: any, table: any): string {
    const { n_distinct, correlation } = column

    if (n_distinct > 100000) {
      return 'High - Significant improvement for selective queries'
    } else if (n_distinct > 10000) {
      return 'Medium - Good improvement for moderately selective queries'
    } else {
      return 'Low - Minor improvement for low selectivity queries'
    }
  }

  /**
   * Check if a column is frequently queried
   */
  private isFrequentlyQueried(columnName: string, tableName: string, queryStats: any): boolean {
    // This would analyze query logs to determine frequency
    // For now, use heuristics based on column naming
    return columnName.includes('email') ||
           columnName.includes('phone') ||
           columnName.includes('status') ||
           columnName.includes('_id')
  }

  /**
   * Calculate potential performance gain from recommendations
   */
  private calculatePotentialGain(recommendations: IndexRecommendation[]): number {
    return recommendations.reduce((total, rec) => {
      switch (rec.priority) {
        case 'high': return total + 30
        case 'medium': return total + 15
        case 'low': return total + 5
        default: return total
      }
    }, 0)
  }

  /**
   * Store recommendations in database
   */
  private async storeRecommendations(recommendations: IndexRecommendation[]): Promise<void> {
    try {
      const supabase = await createClient()

      const recommendationsData = recommendations.map(rec => ({
        id: rec.id,
        table_name: rec.tableName,
        column_name: rec.columnName,
        recommendation_type: rec.recommendationType,
        reasoning: rec.reasoning,
        estimated_impact: rec.estimatedImpact,
        sql_statement: rec.sqlStatement,
        priority: rec.priority,
        confidence: rec.confidence,
        created_at: rec.createdAt,
        implemented: rec.implemented,
        status: 'pending'
      }))

      // Upsert recommendations
      for (const rec of recommendationsData) {
        const { error } = await supabase
          .from('index_recommendations')
          .upsert(rec, { onConflict: 'id' })

        if (error) {
          logger.warn('Error storing index recommendation', { error, recommendationId: rec.id })
        }
      }

    } catch (error) {
      logger.error('Error storing index recommendations', { error })
    }
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear()
    logger.info('Index recommendation analysis cache cleared')
  }
}

// Export singleton instance
export const indexRecommendationEngine = IndexRecommendationEngine.getInstance()