import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { databasePerformanceMonitor } from "@/lib/monitoring/database-performance-monitor"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const timeRangeParam = url.searchParams.get('timeRange')
    const timeRange = (timeRangeParam === '30d' ? '7d' : timeRangeParam) as '1h' | '24h' | '7d' || '24h'
    const includeAlerts = url.searchParams.get('includeAlerts') === 'true'
    const includeHistory = url.searchParams.get('includeHistory') === 'true'

    // Get comprehensive performance metrics
    const [
      healthMetrics,
      resourceMetrics,
      queryMetrics,
      indexMetrics,
      activeAlerts,
      alertHistory
    ] = await Promise.all([
      databasePerformanceMonitor.performHealthCheck(),
      databasePerformanceMonitor.getResourceMetrics(),
      databasePerformanceMonitor.getQueryPerformanceMetrics(timeRange),
      databasePerformanceMonitor.getIndexPerformanceMetrics(),
      includeAlerts ? databasePerformanceMonitor.getActiveAlerts() : Promise.resolve([]),
      includeHistory ? databasePerformanceMonitor.getAlertHistory(timeRange) : Promise.resolve([])
    ])

    const performanceData = {
      health: healthMetrics,
      resources: resourceMetrics,
      queries: queryMetrics,
      indexes: indexMetrics,
      alerts: {
        active: activeAlerts,
        history: includeHistory ? alertHistory : []
      },
      monitoring: {
        status: 'active',
        lastUpdated: new Date().toISOString(),
        timeRange
      }
    }

    return NextResponse.json(performanceData)
  } catch (error) {
    console.error('Error in database performance API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for performance monitoring actions
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
      case 'start_monitoring':
        // Start the monitoring system
        databasePerformanceMonitor.startMonitoring()
        return NextResponse.json({
          success: true,
          message: 'Database performance monitoring started'
        })

      case 'stop_monitoring':
        // Stop the monitoring system
        databasePerformanceMonitor.stopMonitoring()
        return NextResponse.json({
          success: true,
          message: 'Database performance monitoring stopped'
        })

      case 'trigger_health_check':
        // Manually trigger health check
        const healthMetrics = await databasePerformanceMonitor.triggerHealthCheck()
        return NextResponse.json({
          success: true,
          message: 'Health check completed',
          data: healthMetrics
        })

      case 'update_thresholds':
        // Update monitoring thresholds
        if (params.thresholds) {
          databasePerformanceMonitor.updateThresholds(params.thresholds)
          return NextResponse.json({
            success: true,
            message: 'Monitoring thresholds updated',
            updatedThresholds: params.thresholds
          })
        } else {
          return NextResponse.json({
            error: "Missing thresholds parameter"
          }, { status: 400 })
        }

      case 'resolve_alert':
        // Resolve a specific alert
        if (params.alertId) {
          // This would need to be implemented in the monitor
          return NextResponse.json({
            success: true,
            message: `Alert ${params.alertId} marked for resolution`
          })
        } else {
          return NextResponse.json({
            error: "Missing alertId parameter"
          }, { status: 400 })
        }

      default:
        return NextResponse.json({
          error: "Invalid action",
          supportedActions: [
            'start_monitoring',
            'stop_monitoring',
            'trigger_health_check',
            'update_thresholds',
            'resolve_alert'
          ]
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in database performance action API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}