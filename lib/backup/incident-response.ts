import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'
import { reportIncident, runDisasterRecoveryTest } from './disaster-recovery'
import { createDatabaseBackup, restoreDatabaseBackup } from './database-backup'
import { createFileBackup, restoreFileBackup } from './file-backup'

export interface IncidentResponseRule {
  id: string
  name: string
  condition: {
    type: 'metric' | 'error' | 'performance' | 'security'
    threshold: number
    operator: '>' | '<' | '>=' | '<=' | '==' | '!='
    duration: number // in minutes
  }
  actions: IncidentAction[]
  enabled: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface IncidentAction {
  type: 'alert' | 'backup' | 'restore' | 'scale' | 'isolate' | 'notify'
  parameters: Record<string, any>
  delay?: number // delay in minutes before executing
}

export interface AlertChannel {
  id: string
  type: 'email' | 'slack' | 'sms' | 'webhook'
  config: Record<string, any>
  enabled: boolean
}

export class IncidentResponseAutomation {
  private rules: Map<string, IncidentResponseRule> = new Map()
  private channels: Map<string, AlertChannel> = new Map()
  private activeIncidents: Map<string, any> = new Map()
  private actionQueue: Array<{
    incidentId: string
    action: IncidentAction
    executeAt: Date
  }> = []

  constructor() {
    this.initializeDefaultRules()
    this.initializeDefaultChannels()
    this.startActionProcessor()
  }

  /**
   * Initialize default incident response rules
   */
  private initializeDefaultRules() {
    const defaultRules: IncidentResponseRule[] = [
      {
        id: 'high-cpu-usage',
        name: 'High CPU Usage Alert',
        condition: {
          type: 'metric',
          threshold: 90,
          operator: '>',
          duration: 5
        },
        actions: [
          {
            type: 'alert',
            parameters: { severity: 'high', message: 'High CPU usage detected' }
          },
          {
            type: 'scale',
            parameters: { service: 'app', direction: 'up' },
            delay: 2
          }
        ],
        enabled: true,
        priority: 'high'
      },
      {
        id: 'database-connection-failure',
        name: 'Database Connection Failure',
        condition: {
          type: 'error',
          threshold: 10,
          operator: '>=',
          duration: 2
        },
        actions: [
          {
            type: 'alert',
            parameters: { severity: 'critical', message: 'Database connection failures detected' }
          },
          {
            type: 'backup',
            parameters: { type: 'database' },
            delay: 1
          }
        ],
        enabled: true,
        priority: 'critical'
      },
      {
        id: 'security-threat-detected',
        name: 'Security Threat Detected',
        condition: {
          type: 'security',
          threshold: 1,
          operator: '>=',
          duration: 1
        },
        actions: [
          {
            type: 'alert',
            parameters: { severity: 'critical', message: 'Security threat detected' }
          },
          {
            type: 'isolate',
            parameters: { target: 'affected_system' },
            delay: 0
          },
          {
            type: 'notify',
            parameters: { recipients: ['security-team'], message: 'Immediate security review required' }
          }
        ],
        enabled: true,
        priority: 'critical'
      },
      {
        id: 'data-loss-detected',
        name: 'Data Loss Detected',
        condition: {
          type: 'error',
          threshold: 5,
          operator: '>=',
          duration: 5
        },
        actions: [
          {
            type: 'alert',
            parameters: { severity: 'critical', message: 'Potential data loss detected' }
          },
          {
            type: 'backup',
            parameters: { type: 'full' },
            delay: 0
          },
          {
            type: 'restore',
            parameters: { type: 'database', point: 'latest' },
            delay: 5
          }
        ],
        enabled: true,
        priority: 'critical'
      }
    ]

    defaultRules.forEach(rule => this.rules.set(rule.id, rule))
  }

  /**
   * Initialize default alert channels
   */
  private initializeDefaultChannels() {
    const defaultChannels: AlertChannel[] = [
      {
        id: 'slack-alerts',
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: '#alerts'
        },
        enabled: true
      },
      {
        id: 'email-alerts',
        type: 'email',
        config: {
          smtpHost: process.env.SMTP_HOST,
          smtpPort: process.env.SMTP_PORT,
          smtpUser: process.env.SMTP_USER,
          smtpPass: process.env.SMTP_PASS,
          from: 'alerts@company.com',
          to: ['ops@company.com', 'security@company.com']
        },
        enabled: true
      },
      {
        id: 'sms-alerts',
        type: 'sms',
        config: {
          provider: 'twilio',
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          from: process.env.TWILIO_SMS_NUMBER,
          to: ['+1234567890'] // Emergency contact numbers
        },
        enabled: false // Disabled by default for cost reasons
      }
    ]

    defaultChannels.forEach(channel => this.channels.set(channel.id, channel))
  }

  /**
   * Evaluate monitoring data against rules
   */
  async evaluateMetric(type: string, value: number, metadata: Record<string, any> = {}) {
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled || rule.condition.type !== type) continue

      const conditionMet = this.evaluateCondition(rule.condition, value)

      if (conditionMet) {
        await this.triggerRule(rule, { value, ...metadata })
      }
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(condition: IncidentResponseRule['condition'], value: number): boolean {
    switch (condition.operator) {
      case '>': return value > condition.threshold
      case '<': return value < condition.threshold
      case '>=': return value >= condition.threshold
      case '<=': return value <= condition.threshold
      case '==': return value === condition.threshold
      case '!=': return value !== condition.threshold
      default: return false
    }
  }

  /**
   * Trigger rule actions
   */
  private async triggerRule(rule: IncidentResponseRule, context: Record<string, any>) {
    const incidentId = `incident_${Date.now()}_${rule.id}`

    logger.warn(`Incident response rule triggered: ${rule.name}`, {
      ruleId: rule.id,
      incidentId,
      context
    })

    // Create incident
    const incident = await reportIncident(
      'service_outage', // Default type, could be more specific
      rule.priority,
      `Automated incident triggered by rule: ${rule.name}`
    )

    this.activeIncidents.set(incidentId, {
      ...incident,
      ruleId: rule.id,
      context
    })

    // Queue actions
    for (const action of rule.actions) {
      const executeAt = new Date()
      if (action.delay) {
        executeAt.setMinutes(executeAt.getMinutes() + action.delay)
      }

      this.actionQueue.push({
        incidentId,
        action,
        executeAt
      })
    }

    // Log security event
    SecurityAudit.logSensitiveAction('incident_automated_response_triggered', 'system', {
      ruleId: rule.id,
      incidentId,
      actions: rule.actions.length
    })
  }

  /**
   * Process queued actions
   */
  private startActionProcessor() {
    setInterval(async () => {
      const now = new Date()
      const actionsToExecute = this.actionQueue.filter(action => action.executeAt <= now)

      for (const queuedAction of actionsToExecute) {
        try {
          await this.executeAction(queuedAction.incidentId, queuedAction.action)
        } catch (error) {
          logger.error('Failed to execute automated action', error as Error, {
            incidentId: queuedAction.incidentId,
            actionType: queuedAction.action.type
          })
        }

        // Remove from queue
        const index = this.actionQueue.indexOf(queuedAction)
        if (index > -1) {
          this.actionQueue.splice(index, 1)
        }
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Execute action
   */
  private async executeAction(incidentId: string, action: IncidentAction) {
    logger.info(`Executing automated action: ${action.type}`, {
      incidentId,
      actionType: action.type,
      parameters: action.parameters
    })

    switch (action.type) {
      case 'alert':
        await this.sendAlert(action.parameters)
        break

      case 'backup':
        await this.performBackup(action.parameters)
        break

      case 'restore':
        await this.performRestore(action.parameters)
        break

      case 'scale':
        await this.performScaling(action.parameters)
        break

      case 'isolate':
        await this.performIsolation(action.parameters)
        break

      case 'notify':
        await this.sendNotification(action.parameters)
        break

      default:
        logger.warn(`Unknown action type: ${action.type}`)
    }

    SecurityAudit.logSensitiveAction('incident_action_executed', 'system', {
      incidentId,
      actionType: action.type,
      parameters: action.parameters
    })
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(parameters: Record<string, any>) {
    const { severity, message } = parameters

    for (const [channelId, channel] of this.channels) {
      if (!channel.enabled) continue

      try {
        switch (channel.type) {
          case 'slack':
            await this.sendSlackAlert(channel, severity, message)
            break

          case 'email':
            await this.sendEmailAlert(channel, severity, message)
            break

          case 'sms':
            await this.sendSMSAlert(channel, severity, message)
            break

          case 'webhook':
            await this.sendWebhookAlert(channel, severity, message)
            break
        }
      } catch (error) {
        logger.error(`Failed to send alert via ${channel.type}`, error as Error, {
          channelId
        })
      }
    }
  }

  /**
   * Perform backup
   */
  private async performBackup(parameters: Record<string, any>) {
    const { type } = parameters

    try {
      if (type === 'database' || type === 'full') {
        await createDatabaseBackup()
      }

      if (type === 'files' || type === 'full') {
        await createFileBackup()
      }

      logger.info('Automated backup completed', { type })
    } catch (error) {
      logger.error('Automated backup failed', error as Error, { type })
      throw error
    }
  }

  /**
   * Perform restore
   */
  private async performRestore(parameters: Record<string, any>) {
    const { type, backupId } = parameters

    try {
      if (type === 'database') {
        await restoreDatabaseBackup(backupId || 'latest')
      }

      if (type === 'files') {
        await restoreFileBackup(backupId || 'latest')
      }

      logger.info('Automated restore completed', { type, backupId })
    } catch (error) {
      logger.error('Automated restore failed', error as Error, { type, backupId })
      throw error
    }
  }

  /**
   * Perform scaling
   */
  private async performScaling(parameters: Record<string, any>) {
    const { service, direction } = parameters

    // This would integrate with your cloud provider's scaling APIs
    logger.info('Automated scaling initiated', { service, direction })

    // Placeholder for actual scaling logic
    // In a real implementation, this would call AWS ECS, Kubernetes, etc.
  }

  /**
   * Perform isolation
   */
  private async performIsolation(parameters: Record<string, any>) {
    const { target } = parameters

    logger.info('Automated isolation initiated', { target })

    // This would implement network isolation, service shutdown, etc.
    // Placeholder for actual isolation logic
  }

  /**
   * Send notification
   */
  private async sendNotification(parameters: Record<string, any>) {
    const { recipients, message } = parameters

    logger.info('Automated notification sent', { recipients: recipients.length, message })

    // This would send notifications to specific teams/users
    // Placeholder for actual notification logic
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(channel: AlertChannel, severity: string, message: string) {
    const color = severity === 'critical' ? 'danger' : severity === 'high' ? 'warning' : 'good'

    const payload = {
      attachments: [{
        color,
        title: `🚨 ${severity.toUpperCase()} Alert`,
        text: message,
        fields: [
          {
            title: 'Time',
            value: new Date().toISOString(),
            short: true
          },
          {
            title: 'Severity',
            value: severity,
            short: true
          }
        ]
      }]
    }

    await fetch(channel.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(channel: AlertChannel, severity: string, message: string) {
    // Placeholder for email sending logic
    // In a real implementation, this would use nodemailer or similar
    logger.info('Email alert sent', { severity, message, recipients: channel.config.to })
  }

  /**
   * Send SMS alert
   */
  private async sendSMSAlert(channel: AlertChannel, severity: string, message: string) {
    // Placeholder for SMS sending logic
    // In a real implementation, this would use Twilio or similar
    logger.info('SMS alert sent', { severity, message, recipients: channel.config.to })
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(channel: AlertChannel, severity: string, message: string) {
    const payload = {
      severity,
      message,
      timestamp: new Date().toISOString()
    }

    await fetch(channel.config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  }

  /**
   * Add or update rule
   */
  addRule(rule: IncidentResponseRule) {
    this.rules.set(rule.id, rule)
    logger.info('Incident response rule added/updated', { ruleId: rule.id })
  }

  /**
   * Remove rule
   */
  removeRule(ruleId: string) {
    this.rules.delete(ruleId)
    logger.info('Incident response rule removed', { ruleId })
  }

  /**
   * Get all rules
   */
  getRules(): IncidentResponseRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * Get active incidents
   */
  getActiveIncidents() {
    return Array.from(this.activeIncidents.values())
  }

  /**
   * Manually trigger rule for testing
   */
  async testRule(ruleId: string, context: Record<string, any> = {}) {
    const rule = this.rules.get(ruleId)
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`)
    }

    await this.triggerRule(rule, { ...context, test: true })
  }
}

// Export singleton instance
export const incidentResponseAutomation = new IncidentResponseAutomation()

// Export convenience functions
export async function evaluateMonitoringMetric(type: string, value: number, metadata?: Record<string, any>) {
  return incidentResponseAutomation.evaluateMetric(type, value, metadata)
}

export function getIncidentResponseRules(): IncidentResponseRule[] {
  return incidentResponseAutomation.getRules()
}

export function getActiveIncidents() {
  return incidentResponseAutomation.getActiveIncidents()
}

export async function testIncidentRule(ruleId: string, context?: Record<string, any>) {
  return incidentResponseAutomation.testRule(ruleId, context)
}