import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { connectionPoolManager } from "@/lib/monitoring/connection-pool-manager"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'stats':
        // Get connection pool statistics
        const stats = await connectionPoolManager.getPoolStats()
        return NextResponse.json({
          stats,
          lastUpdated: new Date().toISOString()
        })

      case 'metrics':
        // Get pool performance metrics
        const metrics = connectionPoolManager.getPoolMetrics()
        return NextResponse.json({
          metrics,
          lastUpdated: new Date().toISOString()
        })

      case 'health':
        // Get pool health check
        const health = await connectionPoolManager.healthCheck()
        return NextResponse.json(health)

      default:
        return NextResponse.json({
          error: "Invalid action. Use 'stats', 'metrics', or 'health'"
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in connection pool API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for connection pool actions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'optimize':
        // Optimize pool configuration
        await connectionPoolManager.optimizePoolConfig()
        return NextResponse.json({
          success: true,
          message: 'Connection pool optimization completed'
        })

      case 'update_config':
        // Update pool configuration
        if (params.config) {
          connectionPoolManager.updateConfig(params.config)
          return NextResponse.json({
            success: true,
            message: 'Connection pool configuration updated',
            newConfig: params.config
          })
        } else {
          return NextResponse.json({
            error: "Missing config parameter"
          }, { status: 400 })
        }

      case 'reset_metrics':
        // Reset pool metrics
        connectionPoolManager.resetMetrics()
        return NextResponse.json({
          success: true,
          message: 'Connection pool metrics reset'
        })

      case 'get_optimized_client':
        // Get an optimized client (for testing)
        try {
          const client = await connectionPoolManager.getOptimizedClient(params.options)
          await connectionPoolManager.releaseConnection(client)
          return NextResponse.json({
            success: true,
            message: 'Optimized client acquired and released successfully'
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get optimized client'
          })
        }

      default:
        return NextResponse.json({
          error: "Invalid action",
          supportedActions: ['optimize', 'update_config', 'reset_metrics', 'get_optimized_client']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in connection pool action API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}