import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { monitoringOrchestrator } from '@/lib/monitoring/monitoring-orchestrator'
import { alertingSystem } from '@/lib/monitoring/alerting-system'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { businessMetricsTracker } from '@/lib/monitoring/business-metrics-tracker'
import { notificationService } from '@/lib/monitoring/notification-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'health':
        return await getHealthStatus()
      case 'stats':
        return await getMonitoringStats()
      case 'start':
        return await startMonitoring()
      case 'stop':
        return await stopMonitoring()
      case 'restart':
        return await restartMonitoring()
      case 'config':
        return await getConfig()
      case 'update-config':
        return await updateConfig(request)
      default:
        return NextResponse.json({
          error: 'Invalid action. Available actions: health, stats, start, stop, restart, config, update-config'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in monitoring orchestrator API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'test-alert':
        return await testAlert(body)
      case 'send-notification':
        return await sendNotification(body)
      case 'track-event':
        return await trackEvent(body)
      default:
        return NextResponse.json({
          error: 'Invalid action. Available actions: test-alert, send-notification, track-event'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in monitoring orchestrator API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getHealthStatus() {
  try {
    const healthStatus = await monitoringOrchestrator.getHealthStatus()
    return NextResponse.json(healthStatus)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get health status' }, { status: 500 })
  }
}

async function getMonitoringStats() {
  try {
    const stats = await monitoringOrchestrator.getMonitoringStats()
    return NextResponse.json(stats)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get monitoring stats' }, { status: 500 })
  }
}

async function startMonitoring() {
  try {
    monitoringOrchestrator.start()
    return NextResponse.json({ message: 'Monitoring started successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to start monitoring' }, { status: 500 })
  }
}

async function stopMonitoring() {
  try {
    monitoringOrchestrator.stop()
    return NextResponse.json({ message: 'Monitoring stopped successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to stop monitoring' }, { status: 500 })
  }
}

async function restartMonitoring() {
  try {
    monitoringOrchestrator.restart()
    return NextResponse.json({ message: 'Monitoring restarted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to restart monitoring' }, { status: 500 })
  }
}

async function getConfig() {
  try {
    // Get current configuration from orchestrator
    const stats = await monitoringOrchestrator.getMonitoringStats()
    return NextResponse.json(stats.config)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get configuration' }, { status: 500 })
  }
}

async function updateConfig(request: NextRequest) {
  try {
    const body = await request.json()
    const { config } = body

    if (!config) {
      return NextResponse.json({ error: 'Configuration is required' }, { status: 400 })
    }

    monitoringOrchestrator.updateConfig(config)
    return NextResponse.json({ message: 'Configuration updated successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 })
  }
}

async function testAlert(body: any) {
  try {
    const { type = 'high_error_rate', severity = 'medium', message } = body

    // Create a test alert
    const testAlert = {
      type,
      severity,
      title: message || 'Test Alert',
      message: message || 'This is a test alert to verify the alerting system is working',
      metadata: { test: true, timestamp: new Date().toISOString() },
      channels_notified: [],
      status: 'active' as const
    }

    // Send test notification
    await notificationService.sendNotification({
      title: testAlert.title,
      message: testAlert.message,
      priority: severity,
      channels: ['email', 'slack'],
      metadata: testAlert.metadata
    })

    return NextResponse.json({ message: 'Test alert sent successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send test alert' }, { status: 500 })
  }
}

async function sendNotification(body: any) {
  try {
    const { title, message, priority = 'medium', channels = ['email'], recipient } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
    }

    await notificationService.sendNotification({
      title,
      message,
      priority,
      channels,
      recipient,
      metadata: { manual: true, timestamp: new Date().toISOString() }
    })

    return NextResponse.json({ message: 'Notification sent successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}

async function trackEvent(body: any) {
  try {
    const { event_type, event_data } = body

    if (!event_type || !event_data) {
      return NextResponse.json({ error: 'Event type and data are required' }, { status: 400 })
    }

    switch (event_type) {
      case 'user_activity':
        await businessMetricsTracker.trackUserActivity(event_data)
        break
      case 'api_usage':
        await businessMetricsTracker.trackAPIUsage(event_data)
        break
      case 'error':
        await businessMetricsTracker.trackError(event_data)
        break
      case 'feature_usage':
        await businessMetricsTracker.trackFeatureUsage(event_data)
        break
      default:
        return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Event tracked successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 })
  }
}