import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { alertingSystem } from "@/lib/monitoring/alerting-system"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'active' | 'acknowledged' | 'resolved' | null
    const severity = searchParams.get('severity') as any
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get alerts from database
    let query = supabase
      .from('system_alerts')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data: alerts, error } = await query

    if (error) throw error

    const formattedAlerts = (alerts || []).map(alert => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata || {},
      triggered_at: alert.triggered_at,
      resolved_at: alert.resolved_at,
      acknowledged_at: alert.acknowledged_at,
      acknowledged_by: alert.acknowledged_by,
      channels_notified: alert.channels_notified || [],
      status: alert.status
    }))

    return NextResponse.json({
      alerts: formattedAlerts,
      total: formattedAlerts.length
    })

  } catch (error) {
    logger.error('Failed to fetch alerts', { error })
    return NextResponse.json({
      error: "Failed to fetch alerts",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action, alertId } = body

    if (!action || !alertId) {
      return NextResponse.json({ error: "Action and alertId are required" }, { status: 400 })
    }

    let success = false

    switch (action) {
      case 'acknowledge':
        success = await alertingSystem.acknowledgeAlert(alertId, user.id)
        break
      case 'resolve':
        success = await alertingSystem.resolveAlert(alertId)
        break
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!success) {
      return NextResponse.json({ error: "Failed to update alert" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Alert ${action}d successfully`
    })

  } catch (error) {
    logger.error('Failed to update alert', { error })
    return NextResponse.json({
      error: "Failed to update alert",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get alert rules
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has admin privileges (simplified check)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: "Admin privileges required" }, { status: 403 })
    }

    const body = await request.json()
    const { action, rule } = body

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 })
    }

    switch (action) {
      case 'add_rule':
        if (!rule) {
          return NextResponse.json({ error: "Rule data is required" }, { status: 400 })
        }
        alertingSystem.addAlertRule(rule)
        break
      case 'remove_rule':
        if (!rule?.id) {
          return NextResponse.json({ error: "Rule ID is required" }, { status: 400 })
        }
        alertingSystem.removeAlertRule(rule.id)
        break
      case 'get_rules':
        const rules = alertingSystem.getAlertRules()
        return NextResponse.json({ rules })
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Alert rule ${action.replace('_', ' ')}d successfully`
    })

  } catch (error) {
    logger.error('Failed to manage alert rules', { error })
    return NextResponse.json({
      error: "Failed to manage alert rules",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}