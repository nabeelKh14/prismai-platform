import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { performanceMonitor } from './performance-monitor'
import { AuthMonitor } from './auth-monitor'

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AlertType =
  | 'system_down'
  | 'high_error_rate'
  | 'slow_performance'
  | 'security_threat'
  | 'resource_exhaustion'
  | 'database_issue'
  | 'external_service_down'
  | 'custom'

export type AlertChannel = 'email' | 'slack' | 'webhook' | 'sms' | 'dashboard'

export interface AlertRule {
  id: string
  name: string
  type: AlertType
  severity: AlertSeverity
  condition: (metrics: any) => boolean
  message: (metrics: any) => string
  channels: AlertChannel[]
  enabled: boolean
  cooldown_minutes: number
  last_triggered?: Date
}

export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  metadata: Record<string, any>
  triggered_at: Date
  resolved_at?: Date
  acknowledged_at?: Date
  acknowledged_by?: string
  channels_notified: AlertChannel[]
  status: 'active' | 'acknowledged' | 'resolved'
}

export class AlertingSystem {
  private static instance: AlertingSystem
  private alertRules: AlertRule[] = []
  private activeAlerts: Map<string, Alert> = new Map()

  static getInstance(): AlertingSystem {
    if (!AlertingSystem.instance) {
      AlertingSystem.instance = new AlertingSystem()
    }
    return AlertingSystem.instance
  }

  constructor() {
    this.initializeDefaultRules()
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    this.alertRules = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        type: 'high_error_rate',
        severity: 'high',
        condition: (metrics) => metrics.error_rate > 5,
        message: (metrics) => `Error rate has exceeded ${metrics.error_rate.toFixed(1)}%`,
        channels: ['email', 'dashboard'],
        enabled: true,
        cooldown_minutes: 30
      },
      {
        id: 'slow_api_performance',
        name: 'Slow API Performance',
        type: 'slow_performance',
        severity: 'medium',
        condition: (metrics) => metrics.avg_response_time > 5000,
        message: (metrics) => `Average API response time is ${metrics.avg_response_time}ms`,
        channels: ['dashboard'],
        enabled: true,
        cooldown_minutes: 15
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        type: 'resource_exhaustion',
        severity: 'high',
        condition: (metrics) => metrics.memory_usage_percent > 85,
        message: (metrics) => `Memory usage is at ${metrics.memory_usage_percent}%`,
        channels: ['email', 'dashboard'],
        enabled: true,
        cooldown_minutes: 60
      },
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        type: 'resource_exhaustion',
        severity: 'high',
        condition: (metrics) => metrics.cpu_usage_percent > 80,
        message: (metrics) => `CPU usage is at ${metrics.cpu_usage_percent}%`,
        channels: ['email', 'dashboard'],
        enabled: true,
        cooldown_minutes: 30
      },
      {
        id: 'database_connection_issue',
        name: 'Database Connection Issue',
        type: 'database_issue',
        severity: 'critical',
        condition: (metrics) => !metrics.database_healthy,
        message: () => 'Database connection is unhealthy',
        channels: ['email', 'slack', 'dashboard'],
        enabled: true,
        cooldown_minutes: 5
      },
      {
        id: 'security_threat_detected',
        name: 'Security Threat Detected',
        type: 'security_threat',
        severity: 'critical',
        condition: (metrics) => metrics.failed_login_attempts > 10,
        message: (metrics) => `${metrics.failed_login_attempts} failed login attempts detected`,
        channels: ['email', 'slack', 'sms'],
        enabled: true,
        cooldown_minutes: 10
      }
    ]
  }

  /**
   * Check all alert rules and trigger alerts if conditions are met
   */
  async checkAlerts(): Promise<void> {
    try {
      const metrics = await this.collectSystemMetrics()

      for (const rule of this.alertRules) {
        if (!rule.enabled) continue

        // Check cooldown period
        if (rule.last_triggered) {
          const cooldownEnd = new Date(rule.last_triggered.getTime() + rule.cooldown_minutes * 60 * 1000)
          if (new Date() < cooldownEnd) continue
        }

        if (rule.condition(metrics)) {
          await this.triggerAlert(rule, metrics)
          rule.last_triggered = new Date()
        }
      }
    } catch (error) {
      logger.error('Failed to check alerts', { error })
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, metrics: any): Promise<void> {
    try {
      const alert: Omit<Alert, 'id'> = {
        type: rule.type,
        severity: rule.severity,
        title: rule.name,
        message: rule.message(metrics),
        metadata: metrics,
        triggered_at: new Date(),
        channels_notified: [],
        status: 'active'
      }

      // Send notifications
      for (const channel of rule.channels) {
        try {
          await this.sendNotification(channel, alert)
          alert.channels_notified.push(channel)
        } catch (error) {
          logger.error(`Failed to send alert notification via ${channel}`, { error })
        }
      }

      // Store alert
      const alertId = await this.storeAlert(alert)
      this.activeAlerts.set(alertId, { ...alert, id: alertId })

      logger.warn('Alert triggered', {
        alertId,
        type: rule.type,
        severity: rule.severity,
        title: rule.name
      })

    } catch (error) {
      logger.error('Failed to trigger alert', { error, rule: rule.name })
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('system_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId
        })
        .eq('id', alertId)

      if (error) throw error

      const alert = this.activeAlerts.get(alertId)
      if (alert) {
        alert.status = 'acknowledged'
        alert.acknowledged_at = new Date()
        alert.acknowledged_by = userId
      }

      logger.info('Alert acknowledged', { alertId, userId })
      return true

    } catch (error) {
      logger.error('Failed to acknowledge alert', { error, alertId })
      return false
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('system_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId)

      if (error) throw error

      const alert = this.activeAlerts.get(alertId)
      if (alert) {
        alert.status = 'resolved'
        alert.resolved_at = new Date()
        this.activeAlerts.delete(alertId)
      }

      logger.info('Alert resolved', { alertId })
      return true

    } catch (error) {
      logger.error('Failed to resolve alert', { error, alertId })
      return false
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('system_alerts')
        .select('*')
        .eq('status', 'active')
        .order('triggered_at', { ascending: false })

      if (error) throw error

      return (data || []).map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata || {},
        triggered_at: new Date(alert.triggered_at),
        resolved_at: alert.resolved_at ? new Date(alert.resolved_at) : undefined,
        acknowledged_at: alert.acknowledged_at ? new Date(alert.acknowledged_at) : undefined,
        acknowledged_by: alert.acknowledged_by,
        channels_notified: alert.channels_notified || [],
        status: alert.status
      }))

    } catch (error) {
      logger.error('Failed to get active alerts', { error })
      return []
    }
  }

  /**
   * Send notification via specified channel
   */
  private async sendNotification(channel: AlertChannel, alert: Omit<Alert, 'id'>): Promise<void> {
    switch (channel) {
      case 'email':
        await this.sendEmailNotification(alert)
        break
      case 'slack':
        await this.sendSlackNotification(alert)
        break
      case 'webhook':
        await this.sendWebhookNotification(alert)
        break
      case 'sms':
        await this.sendSMSNotification(alert)
        break
      case 'dashboard':
        // Dashboard notifications are handled by storing in database
        break
      default:
        logger.warn('Unknown alert channel', { channel })
    }
  }

  private async sendEmailNotification(alert: Omit<Alert, 'id'>): Promise<void> {
    // TODO: Implement email notification service
    logger.info('Email notification would be sent', {
      severity: alert.severity,
      title: alert.title,
      message: alert.message
    })
  }

  private async sendSlackNotification(alert: Omit<Alert, 'id'>): Promise<void> {
    // TODO: Implement Slack notification service
    logger.info('Slack notification would be sent', {
      severity: alert.severity,
      title: alert.title,
      message: alert.message
    })
  }

  private async sendWebhookNotification(alert: Omit<Alert, 'id'>): Promise<void> {
    // TODO: Implement webhook notification service
    logger.info('Webhook notification would be sent', {
      severity: alert.severity,
      title: alert.title,
      message: alert.message
    })
  }

  private async sendSMSNotification(alert: Omit<Alert, 'id'>): Promise<void> {
    // TODO: Implement SMS notification service
    logger.info('SMS notification would be sent', {
      severity: alert.severity,
      title: alert.title,
      message: alert.message
    })
  }

  /**
   * Collect system metrics for alert evaluation
   */
  private async collectSystemMetrics(): Promise<any> {
    try {
      // Get performance metrics
      const apiStats = await performanceMonitor.getAggregatedStats('api_response', '1h')
      const memoryStats = await performanceMonitor.getAggregatedStats('memory_usage', '1h')
      const cpuStats = await performanceMonitor.getAggregatedStats('cpu_usage', '1h')

      // Get auth metrics
      const authMetrics = await AuthMonitor.getAuthMetrics('hour')

      // Get database health
      const systemHealth = await AuthMonitor.getSystemHealth()

      return {
        error_rate: apiStats.count > 0 ? (apiStats.average / 100) : 0, // Simplified error rate calculation
        avg_response_time: apiStats.average,
        memory_usage_percent: memoryStats.average,
        cpu_usage_percent: cpuStats.average,
        failed_login_attempts: authMetrics.failedLoginAttempts,
        database_healthy: systemHealth.database === 'healthy'
      }

    } catch (error) {
      logger.error('Failed to collect system metrics', { error })
      return {}
    }
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alert: Omit<Alert, 'id'>): Promise<string> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('system_alerts')
        .insert({
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata,
          triggered_at: alert.triggered_at.toISOString(),
          channels_notified: alert.channels_notified,
          status: alert.status
        })
        .select()
        .single()

      if (error) throw error

      return data.id

    } catch (error) {
      logger.error('Failed to store alert', { error })
      throw error
    }
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id' | 'last_triggered'>): void {
    const newRule: AlertRule = {
      ...rule,
      id: `custom_${Date.now()}`,
      last_triggered: undefined
    }
    this.alertRules.push(newRule)
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules = this.alertRules.filter(rule => rule.id !== ruleId)
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules]
  }
}

// Export singleton instance
export const alertingSystem = AlertingSystem.getInstance()