import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { databaseMaintenanceManager } from "@/lib/monitoring/database-maintenance-manager"

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
      case 'tasks':
        // Get maintenance tasks status
        const tasks = databaseMaintenanceManager.getMaintenanceTasks()
        return NextResponse.json({
          tasks,
          lastUpdated: new Date().toISOString()
        })

      case 'health':
        // Get database health report
        const healthReport = await databaseMaintenanceManager.getHealthReport()
        return NextResponse.json(healthReport)

      default:
        return NextResponse.json({
          error: "Invalid action. Use 'tasks' or 'health'"
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in database maintenance API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for maintenance actions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action, taskId } = body

    switch (action) {
      case 'initialize':
        // Initialize maintenance tasks
        await databaseMaintenanceManager.initializeMaintenanceTasks()
        return NextResponse.json({
          success: true,
          message: 'Database maintenance tasks initialized'
        })

      case 'run_scheduled':
        // Run all scheduled maintenance tasks
        const scheduledResults = await databaseMaintenanceManager.runScheduledMaintenance()
        return NextResponse.json({
          success: true,
          message: 'Scheduled maintenance completed',
          results: scheduledResults
        })

      case 'run_task':
        // Run a specific maintenance task
        if (!taskId) {
          return NextResponse.json({
            error: "Missing taskId parameter"
          }, { status: 400 })
        }

        const taskResult = await databaseMaintenanceManager.triggerMaintenanceTask(taskId)
        return NextResponse.json({
          success: true,
          message: `Maintenance task ${taskId} completed`,
          result: taskResult
        })

      case 'run_all':
        // Run all maintenance tasks
        const allTasks = databaseMaintenanceManager.getMaintenanceTasks()
        const allResults = []

        for (const task of allTasks) {
          try {
            const result = await databaseMaintenanceManager.triggerMaintenanceTask(task.id)
            allResults.push(result)
          } catch (error) {
            allResults.push({
              taskId: task.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }

        return NextResponse.json({
          success: true,
          message: 'All maintenance tasks completed',
          results: allResults
        })

      default:
        return NextResponse.json({
          error: "Invalid action",
          supportedActions: ['initialize', 'run_scheduled', 'run_task', 'run_all']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in database maintenance action API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}