import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { databaseOptimizer } from "@/lib/monitoring/database-optimizer"
import { enhancedDatabaseOptimizer } from "@/lib/monitoring/enhanced-database-optimizer"
import { performanceMonitor } from "@/lib/monitoring/performance-monitor"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get basic database performance insights
    const insights = await databaseOptimizer.getPerformanceInsights()

    // Get cache statistics
    const cacheStats = databaseOptimizer.getCacheStats()

    // Get enhanced optimizer statistics
    const connectionPoolStats = await enhancedDatabaseOptimizer.getConnectionPoolStats()
    const queryPerformanceProfile = await enhancedDatabaseOptimizer.getQueryPerformanceProfile('24h')

    // Get database schema information
    const { data: schemaInfo, error: schemaError } = await supabase.rpc('get_database_schema_info')

    // Get index usage statistics
    const { data: indexStats, error: indexError } = await supabase.rpc('analyze_index_usage')

    // Get query optimization recommendations
    const { data: optimizationRecommendations, error: optError } = await supabase.rpc('get_query_optimization_recommendations')

    // Calculate comprehensive database metrics
    const databaseStats = {
      // Basic metrics
      ...insights,
      cacheHits: cacheStats.cacheHits,
      cacheMisses: cacheStats.cacheMisses,
      cacheEfficiency: cacheStats.hitRate,
      queryCount: cacheStats.totalRequests,

      // Connection pool metrics
      connectionPool: connectionPoolStats,

      // Query performance metrics
      slowQueries: queryPerformanceProfile.filter(q => q.execution_time_ms > 1000).length,
      avgQueryTime: queryPerformanceProfile.length > 0
        ? queryPerformanceProfile.reduce((sum, q) => sum + q.execution_time_ms, 0) / queryPerformanceProfile.length
        : 0,
      totalQueryExecutions: queryPerformanceProfile.length,

      // Schema information
      schema: schemaError ? null : schemaInfo,

      // Index information
      indexStats: indexError ? null : indexStats,

      // Optimization recommendations
      optimizationRecommendations: optError ? null : optimizationRecommendations,

      // System health indicators
      status: await determineDatabaseHealth(queryPerformanceProfile, connectionPoolStats),
      lastUpdated: new Date().toISOString(),

      // Performance baselines
      performanceBaselines: await getPerformanceBaselines(supabase)
    }

    return NextResponse.json(databaseStats)
  } catch (error) {
    console.error('Error in enhanced database API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to determine database health
async function determineDatabaseHealth(
  queryProfile: any[],
  connectionPool: any
): Promise<string> {
  try {
    const slowQueryRatio = queryProfile.length > 0
      ? queryProfile.filter(q => q.execution_time_ms > 5000).length / queryProfile.length
      : 0

    const connectionUtilization = connectionPool.poolUtilization || 0

    if (slowQueryRatio > 0.3 || connectionUtilization > 90) {
      return 'critical'
    } else if (slowQueryRatio > 0.15 || connectionUtilization > 75) {
      return 'warning'
    } else {
      return 'healthy'
    }
  } catch (error) {
    console.error('Error determining database health:', error)
    return 'unknown'
  }
}

// Helper function to get performance baselines
async function getPerformanceBaselines(supabase: any): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('query_performance_baselines')
      .select('*')
      .order('last_updated', { ascending: false })
      .limit(10)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching performance baselines:', error)
    return []
  }
}

// POST endpoint for triggering database optimization
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'optimize_queries':
        // Trigger query optimization analysis
        const { data: optResult, error: optError } = await supabase.rpc('perform_query_optimization_analysis')
        if (optError) throw optError

        return NextResponse.json({
          success: true,
          message: 'Query optimization analysis completed',
          result: optResult
        })

      case 'update_index_stats':
        // Update index usage statistics
        const { data: idxResult, error: idxError } = await supabase.rpc('update_index_usage_stats')
        if (idxError) throw idxError

        return NextResponse.json({
          success: true,
          message: 'Index usage statistics updated',
          result: idxResult
        })

      case 'cleanup_old_data':
        // Clean up old execution plans and metrics
        const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_old_execution_plans', { p_days: 30 })
        if (cleanupError) throw cleanupError

        return NextResponse.json({
          success: true,
          message: 'Old data cleanup completed',
          recordsDeleted: cleanupResult
        })

      default:
        return NextResponse.json({
          error: "Invalid action",
          supportedActions: ['optimize_queries', 'update_index_stats', 'cleanup_old_data']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in database optimization API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}