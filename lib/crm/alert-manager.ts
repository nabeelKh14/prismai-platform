import { logger } from '@/lib/logger'
import { alertingSystem, AlertSeverity, AlertType } from '@/lib/monitoring/alerting-system'
import { crmErrorHandler, CRMError, CRMErrorType, CRMErrorSeverity } from './error-handler'
import { circuitBreakerManager, CircuitState } from './circuit-breaker'
import { recoveryManager } from './recovery-manager'
import { crmRateLimitManager } from './rate-limiter'

export interface CRMAlertRule {
  id: string
  name: string
  provider: string
  condition: (metrics: CRMAlertMetrics) => boolean
  severity: AlertSeverity
  message: (metrics: CRMAlertMetrics) => string
  channels: ('email' | 'slack' | 'webhook' | 'sms' | 'dashboard')[]
  cooldownMinutes: number
  autoRecovery: boolean
  recoveryAction?: string
  enabled: boolean
  lastTriggered?: Date
}

export interface CRMAlertMetrics {
  provider: string
  errorCount: number
  errorRate: number
  circuitBreakerOpen: boolean
  rateLimitHit: boolean
  averageResponseTime: number
  failedOperations: number
  totalOperations: number
  healthScore: number
  lastErrorTime?: Date
  consecutiveFailures: number
}

export interface CRMAlert {
  id: string
  ruleId: string
  provider: string
  severity: AlertSeverity
  title: string
  message: string
  metrics: CRMAlertMetrics
  triggeredAt: Date
  resolvedAt?: Date
  acknowledgedAt?: Date
  acknowledgedBy?: string
  channelsNotified: string[]
  status: 'active' | 'acknowledged' | 'resolved'
  autoRecoveryAttempted: boolean
  recoveryResult?: string
}

export class CRMAlertManager {
  private static instance: CRMAlertManager
  private alertRules: Map<string, CRMAlertRule> = new Map()
  private activeAlerts: Map<string, CRMAlert> = new Map()
  private isRunning: boolean = false
  private checkInterval: NodeJS.Timeout | null = null

  static getInstance(): CRMAlertManager {
    if (!CRMAlertManager.instance) {
      CRMAlertManager.instance = new CRMAlertManager()
    }
    return CRMAlertManager.instance
  }

  constructor() {
    this.initializeDefaultRules()
    this.startAlertChecking()
  }

  private initializeDefaultRules(): void {
    const defaultRules: CRMAlertRule[] = [
      {
        id: 'crm_high_error_rate',
        name: 'High CRM Error Rate',
        provider: 'all',
        condition: (metrics) => metrics.errorRate > 5.0,
        severity: 'high',
        message: (metrics) => `CRM ${metrics.provider} error rate is ${metrics.errorRate.toFixed(1)}% (${metrics.errorCount} errors out of ${metrics.totalOperations} operations)`,
        channels: ['email', 'dashboard'],
        cooldownMinutes: 15,
        autoRecovery: true,
        recoveryAction: 'provider_restart',
        enabled: true
      },
      {
        id: 'crm_circuit_breaker_open',
        name: 'CRM Circuit Breaker Open',
        provider: 'all',
        condition: (metrics) => metrics.circuitBreakerOpen,
        severity: 'critical',
        message: (metrics) => `CRM ${metrics.provider} circuit breaker is OPEN - service unavailable`,
        channels: ['email', 'slack', 'dashboard'],
        cooldownMinutes: 5,
        autoRecovery: true,
        recoveryAction: 'circuit_reset',
        enabled: true
      },
      {
        id: 'crm_rate_limit_exceeded',
        name: 'CRM Rate Limit Exceeded',
        provider: 'all',
        condition: (metrics) => metrics.rateLimitHit,
        severity: 'medium',
        message: (metrics) => `CRM ${metrics.provider} rate limit exceeded - requests being throttled`,
        channels: ['dashboard'],
        cooldownMinutes: 10,
        autoRecovery: true,
        recoveryAction: 'rate_limit_reset',
        enabled: true
      },
      {
        id: 'crm_slow_response_time',
        name: 'CRM Slow Response Time',
        provider: 'all',
        condition: (metrics) => metrics.averageResponseTime > 10000, // 10 seconds
        severity: 'medium',
        message: (metrics) => `CRM ${metrics.provider} average response time is ${metrics.averageResponseTime}ms`,
        channels: ['dashboard'],
        cooldownMinutes: 30,
        autoRecovery: false,
        enabled: true
      },
      {
        id: 'crm_health_score_low',
        name: 'CRM Health Score Low',
        provider: 'all',
        condition: (metrics) => metrics.healthScore < 0.7,
        severity: 'high',
        message: (metrics) => `CRM ${metrics.provider} health score is ${(metrics.healthScore * 100).toFixed(1)}%`,
        channels: ['email', 'dashboard'],
        cooldownMinutes: 20,
        autoRecovery: true,
        recoveryAction: 'health_check',
        enabled: true
      },
      {
        id: 'crm_consecutive_failures',
        name: 'CRM Consecutive Failures',
        provider: 'all',
        condition: (metrics) => metrics.consecutiveFailures >= 5,
        severity: 'high',
        message: (metrics) => `CRM ${metrics.provider} has ${metrics.consecutiveFailures} consecutive failures`,
        channels: ['email', 'slack', 'dashboard'],
        cooldownMinutes: 10,
        autoRecovery: true,
        recoveryAction: 'provider_restart',
        enabled: true
      }
    ]

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule)
    }
  }

  async checkAlerts(): Promise<void> {
    if (this.isRunning) return

    this.isRunning = true

    try {
      // Collect metrics for all providers
      const metrics = await this.collectCRMAlertMetrics()

      // Check each alert rule
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) continue

        // Check cooldown period
        if (rule.lastTriggered) {
          const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldownMinutes * 60 * 1000)
          if (new Date() < cooldownEnd) continue
        }

        // Get metrics for specific provider or all providers
        const ruleMetrics = rule.provider === 'all'
          ? Object.values(metrics)
          : [metrics[rule.provider]].filter(Boolean)

        for (const providerMetrics of ruleMetrics) {
          if (rule.condition(providerMetrics)) {
            await this.triggerAlert(rule, providerMetrics)
            rule.lastTriggered = new Date()
          }
        }
      }

    } catch (error) {
      logger.error('Failed to check CRM alerts', error as Error)
    } finally {
      this.isRunning = false
    }
  }

  private async collectCRMAlertMetrics(): Promise<Record<string, CRMAlertMetrics>> {
    const metrics: Record<string, CRMAlertMetrics> = {}

    // Get error statistics
    const errorStats = crmErrorHandler.getErrorStats()

    // Get circuit breaker status
    const circuitBreakerStats = circuitBreakerManager.getAllStats()

    // Get rate limiting status
    const rateLimitStats = crmRateLimitManager.getAllRateLimitStats()

    // Get health scores (simplified calculation)
    const healthScores = await this.calculateHealthScores()

    // Calculate metrics for each provider
    const providers = ['salesforce', 'hubspot', 'pipedrive']

    for (const provider of providers) {
      const providerErrors = Object.entries(errorStats)
        .filter(([key]) => key.startsWith(`${provider}:`))
        .reduce((sum, [, stats]) => sum + stats.count, 0)

      const providerCircuitBreakers = Object.entries(circuitBreakerStats)
        .filter(([key]) => key.includes(provider))
        .map(([, stats]) => stats)

      const circuitBreakerOpen = providerCircuitBreakers.some(cb => cb.state === CircuitState.OPEN)

      const providerRateLimitStats = Object.entries(rateLimitStats)
        .filter(([key]) => key.startsWith(`${provider}:`))
        .map(([, stats]) => stats)

      const rateLimitHit = providerRateLimitStats.some(stats =>
        stats.lastRateLimitHit &&
        Date.now() - stats.lastRateLimitHit.getTime() < 300000 // Last 5 minutes
      )

      const healthScore = healthScores[provider] || 1.0

      // Calculate consecutive failures (simplified)
      const consecutiveFailures = providerErrors > 0 ? Math.min(providerErrors, 10) : 0

      metrics[provider] = {
        provider,
        errorCount: providerErrors,
        errorRate: 0, // Would need operation count to calculate properly
        circuitBreakerOpen,
        rateLimitHit,
        averageResponseTime: 0, // Would need actual response time data
        failedOperations: providerErrors,
        totalOperations: providerErrors * 2, // Estimate
        healthScore,
        consecutiveFailures
      }
    }

    return metrics
  }

  private async calculateHealthScores(): Promise<Record<string, number>> {
    // This would use more sophisticated health calculation
    // For now, return basic health scores
    return {
      'salesforce': 0.95,
      'hubspot': 0.88,
      'pipedrive': 0.82
    }
  }

  private async triggerAlert(rule: CRMAlertRule, metrics: CRMAlertMetrics): Promise<void> {
    try {
      const alertId = `crm_${rule.id}_${Date.now()}`

      const alert: Omit<CRMAlert, 'id'> = {
        ruleId: rule.id,
        provider: metrics.provider,
        severity: rule.severity,
        title: rule.name,
        message: rule.message(metrics),
        metrics,
        triggeredAt: new Date(),
        channelsNotified: [],
        status: 'active',
        autoRecoveryAttempted: false
      }

      // Send notifications via configured channels
      for (const channel of rule.channels) {
        try {
          await this.sendNotification(channel, alert)
          alert.channelsNotified.push(channel)
        } catch (error) {
          logger.error(`Failed to send CRM alert notification via ${channel}`, error as Error)
        }
      }

      // Store the alert
      this.activeAlerts.set(alertId, { ...alert, id: alertId })

      // Attempt auto-recovery if configured
      if (rule.autoRecovery && rule.recoveryAction) {
        await this.attemptAutoRecovery(alert, rule.recoveryAction)
      }

      logger.warn('CRM alert triggered', {
        alertId,
        ruleId: rule.id,
        provider: metrics.provider,
        severity: rule.severity,
        title: rule.name
      })

    } catch (error) {
      logger.error('Failed to trigger CRM alert', error as Error)
    }
  }

  private async sendNotification(channel: string, alert: Omit<CRMAlert, 'id'>): Promise<void> {
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
        logger.warn('Unknown CRM alert channel', { channel })
    }
  }

  private async sendEmailNotification(alert: Omit<CRMAlert, 'id'>): Promise<void> {
    // Integration with email service would go here
    logger.info('CRM Email notification would be sent', {
      to: 'admin@example.com',
      subject: `CRM Alert: ${alert.title}`,
      provider: alert.provider,
      severity: alert.severity,
      message: alert.message
    })
  }

  private async sendSlackNotification(alert: Omit<CRMAlert, 'id'>): Promise<void> {
    // Integration with Slack webhook would go here
    logger.info('CRM Slack notification would be sent', {
      channel: '#crm-alerts',
      provider: alert.provider,
      severity: alert.severity,
      message: alert.message
    })
  }

  private async sendWebhookNotification(alert: Omit<CRMAlert, 'id'>): Promise<void> {
    // Integration with webhook endpoint would go here
    logger.info('CRM Webhook notification would be sent', {
      url: 'https://example.com/webhooks/crm-alerts',
      provider: alert.provider,
      severity: alert.severity,
      message: alert.message
    })
  }

  private async sendSMSNotification(alert: Omit<CRMAlert, 'id'>): Promise<void> {
    // Integration with SMS service would go here
    logger.info('CRM SMS notification would be sent', {
      to: '+1234567890',
      provider: alert.provider,
      severity: alert.severity,
      message: alert.message
    })
  }

  private async attemptAutoRecovery(alert: Omit<CRMAlert, 'id'>, recoveryAction: string): Promise<void> {
    try {
      logger.info('Attempting automatic recovery for CRM alert', {
        provider: alert.provider,
        recoveryAction,
        ruleId: alert.ruleId
      })

      const recoveryResults = await recoveryManager.executeRecovery(alert.provider, recoveryAction)

      // Update alert with recovery information
      const alertId = `crm_${alert.ruleId}_${alert.triggeredAt.getTime()}`
      const activeAlert = this.activeAlerts.get(alertId)

      if (activeAlert) {
        activeAlert.autoRecoveryAttempted = true
        activeAlert.recoveryResult = recoveryResults.map(r =>
          `${r.action}: ${r.success ? 'success' : 'failed'}`
        ).join(', ')

        // If recovery was successful, resolve the alert
        const allSuccessful = recoveryResults.every(r => r.success)
        if (allSuccessful) {
          activeAlert.status = 'resolved'
          activeAlert.resolvedAt = new Date()

          logger.info('CRM alert automatically resolved after successful recovery', {
            alertId,
            provider: alert.provider,
            recoveryAction
          })
        }
      }

    } catch (error) {
      logger.error('Automatic recovery failed for CRM alert', {
        provider: alert.provider,
        recoveryAction,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private startAlertChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    // Check alerts every 2 minutes
    this.checkInterval = setInterval(async () => {
      await this.checkAlerts()
    }, 2 * 60 * 1000) // 2 minutes
  }

  // Public API methods
  getActiveAlerts(provider?: string): CRMAlert[] {
    const alerts: CRMAlert[] = []

    for (const alert of this.activeAlerts.values()) {
      if (!provider || alert.provider === provider) {
        alerts.push({ ...alert })
      }
    }

    return alerts
  }

  getAlertRules(provider?: string): CRMAlertRule[] {
    const rules: CRMAlertRule[] = []

    for (const rule of this.alertRules.values()) {
      if (!provider || rule.provider === provider || rule.provider === 'all') {
        rules.push({ ...rule })
      }
    }

    return rules
  }

  addAlertRule(rule: Omit<CRMAlertRule, 'id' | 'lastTriggered'>): void {
    const newRule: CRMAlertRule = {
      ...rule,
      id: `custom_${Date.now()}`,
      lastTriggered: undefined
    }

    this.alertRules.set(newRule.id, newRule)
    logger.info('Added custom CRM alert rule', { ruleId: newRule.id, name: newRule.name })
  }

  updateAlertRule(ruleId: string, updates: Partial<CRMAlertRule>): void {
    const rule = this.alertRules.get(ruleId)
    if (rule) {
      Object.assign(rule, updates)
      logger.info('Updated CRM alert rule', { ruleId, updates })
    }
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId)
    logger.info('Removed CRM alert rule', { ruleId })
  }

  acknowledgeAlert(alertId: string, userId: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged'
      alert.acknowledgedAt = new Date()
      alert.acknowledgedBy = userId

      logger.info('CRM alert acknowledged', { alertId, userId })
      return true
    }
    return false
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (alert && (alert.status === 'active' || alert.status === 'acknowledged')) {
      alert.status = 'resolved'
      alert.resolvedAt = new Date()

      logger.info('CRM alert resolved', { alertId })
      return true
    }
    return false
  }

  stopAlertChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  restartAlertChecking(): void {
    this.stopAlertChecking()
    this.startAlertChecking()
  }
}

// Export singleton instance
export const crmAlertManager = CRMAlertManager.getInstance()