import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SMSClient } from '@/lib/twilio/sms-client'
import { WhatsAppClient } from '@/lib/twilio/whatsapp-client'

export type NotificationChannel = 'email' | 'slack' | 'webhook' | 'sms' | 'whatsapp'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'

export interface NotificationMessage {
  id: string
  title: string
  message: string
  priority: NotificationPriority
  channels: NotificationChannel[]
  metadata?: Record<string, any>
  timestamp: Date
  recipient?: string
  template_id?: string
}

export interface NotificationTemplate {
  id: string
  name: string
  channel: NotificationChannel
  subject_template: string
  body_template: string
  priority: NotificationPriority
  enabled: boolean
}

export interface NotificationConfig {
  email?: {
    enabled: boolean
    smtp_host?: string
    smtp_port?: number
    smtp_user?: string
    smtp_password?: string
    from_email: string
    from_name: string
  }
  slack?: {
    enabled: boolean
    webhook_url: string
    channel: string
    username: string
  }
  webhook?: {
    enabled: boolean
    url: string
    headers?: Record<string, string>
    method: 'POST' | 'PUT'
  }
  sms?: {
    enabled: boolean
    from_number: string
  }
  whatsapp?: {
    enabled: boolean
    from_number: string
  }
}

export class NotificationService {
  private static instance: NotificationService
  private config: NotificationConfig = {}
  private templates: Map<string, NotificationTemplate> = new Map()
  private smsClient: SMSClient
  private whatsappClient: WhatsAppClient

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  constructor() {
    // Initialize with placeholder credentials - should be configured properly
    this.smsClient = new SMSClient(
      process.env.TWILIO_ACCOUNT_SID || '',
      process.env.TWILIO_AUTH_TOKEN || '',
      process.env.TWILIO_PHONE_NUMBER || ''
    )
    this.whatsappClient = new WhatsAppClient(
      process.env.TWILIO_ACCOUNT_SID || '',
      process.env.TWILIO_AUTH_TOKEN || '',
      process.env.TWILIO_PHONE_NUMBER || ''
    )
    this.initializeDefaultTemplates()
  }

  /**
   * Configure notification service
   */
  configure(config: NotificationConfig): void {
    this.config = { ...this.config, ...config }
    logger.info('Notification service configured', {
      email_enabled: !!this.config.email?.enabled,
      slack_enabled: !!this.config.slack?.enabled,
      webhook_enabled: !!this.config.webhook?.enabled,
      sms_enabled: !!this.config.sms?.enabled,
      whatsapp_enabled: !!this.config.whatsapp?.enabled
    })
  }

  /**
   * Send notification through specified channels
   */
  async sendNotification(message: Omit<NotificationMessage, 'id' | 'timestamp'>): Promise<boolean> {
    try {
      const notification: NotificationMessage = {
        ...message,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date()
      }

      // Store notification in database
      await this.storeNotification(notification)

      // Send through each channel
      const results = await Promise.allSettled(
        message.channels.map(channel => this.sendByChannel(channel, notification))
      )

      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failureCount = results.filter(r => r.status === 'rejected').length

      logger.info('Notification sent', {
        notification_id: notification.id,
        channels: message.channels,
        success_count: successCount,
        failure_count: failureCount
      })

      return failureCount === 0

    } catch (error) {
      logger.error('Failed to send notification', { error, message })
      return false
    }
  }

  /**
   * Send notification by specific channel
   */
  private async sendByChannel(channel: NotificationChannel, message: NotificationMessage): Promise<void> {
    switch (channel) {
      case 'email':
        await this.sendEmail(message)
        break
      case 'slack':
        await this.sendSlack(message)
        break
      case 'webhook':
        await this.sendWebhook(message)
        break
      case 'sms':
        await this.sendSMS(message)
        break
      case 'whatsapp':
        await this.sendWhatsApp(message)
        break
      default:
        throw new Error(`Unsupported notification channel: ${channel}`)
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(message: NotificationMessage): Promise<void> {
    if (!this.config.email?.enabled) {
      logger.debug('Email notifications disabled')
      return
    }

    try {
      // In production, implement actual email sending
      // For now, just log the email that would be sent
      logger.info('Email notification would be sent', {
        to: message.recipient || 'admin@example.com',
        subject: this.formatTemplate(this.getTemplate('email', message.priority)?.subject_template || '{{title}}', message),
        body: this.formatTemplate(this.getTemplate('email', message.priority)?.body_template || '{{message}}', message),
        priority: message.priority
      })

      // TODO: Implement actual email sending using nodemailer or similar
      // const transporter = nodemailer.createTransporter({...})
      // await transporter.sendMail({...})

    } catch (error) {
      logger.error('Failed to send email notification', { error, message })
      throw error
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(message: NotificationMessage): Promise<void> {
    if (!this.config.slack?.enabled) {
      logger.debug('Slack notifications disabled')
      return
    }

    try {
      const template = this.getTemplate('slack', message.priority)
      const text = this.formatTemplate(template?.body_template || '{{title}}: {{message}}', message)

      const payload = {
        channel: this.config.slack.channel,
        username: this.config.slack.username,
        text,
        attachments: [{
          color: this.getSlackColor(message.priority),
          fields: [
            {
              title: 'Priority',
              value: message.priority.toUpperCase(),
              short: true
            },
            {
              title: 'Time',
              value: message.timestamp.toISOString(),
              short: true
            }
          ],
          footer: 'Monitoring System',
          ts: Math.floor(message.timestamp.getTime() / 1000)
        }]
      }

      const response = await fetch(this.config.slack.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`)
      }

      logger.info('Slack notification sent', { message_id: message.id })

    } catch (error) {
      logger.error('Failed to send Slack notification', { error, message })
      throw error
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(message: NotificationMessage): Promise<void> {
    if (!this.config.webhook?.enabled) {
      logger.debug('Webhook notifications disabled')
      return
    }

    try {
      const payload = {
        id: message.id,
        title: message.title,
        message: message.message,
        priority: message.priority,
        timestamp: message.timestamp.toISOString(),
        metadata: message.metadata
      }

      const headers = {
        'Content-Type': 'application/json',
        ...this.config.webhook.headers
      }

      const response = await fetch(this.config.webhook.url, {
        method: this.config.webhook.method,
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
      }

      logger.info('Webhook notification sent', { message_id: message.id, url: this.config.webhook.url })

    } catch (error) {
      logger.error('Failed to send webhook notification', { error, message })
      throw error
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(message: NotificationMessage): Promise<void> {
    if (!this.config.sms?.enabled) {
      logger.debug('SMS notifications disabled')
      return
    }

    try {
      const template = this.getTemplate('sms', message.priority)
      const text = this.formatTemplate(template?.body_template || '{{title}}: {{message}}', message)

      await this.smsClient.sendMessage(
        message.recipient || '+1234567890', // Default recipient
        text
      )

      logger.info('SMS notification sent', { message_id: message.id })

    } catch (error) {
      logger.error('Failed to send SMS notification', { error, message })
      throw error
    }
  }

  /**
   * Send WhatsApp notification
   */
  private async sendWhatsApp(message: NotificationMessage): Promise<void> {
    if (!this.config.whatsapp?.enabled) {
      logger.debug('WhatsApp notifications disabled')
      return
    }

    try {
      const template = this.getTemplate('whatsapp', message.priority)
      const text = this.formatTemplate(template?.body_template || '{{title}}: {{message}}', message)

      await this.whatsappClient.sendMessage(
        message.recipient || '+1234567890', // Default recipient
        text
      )

      logger.info('WhatsApp notification sent', { message_id: message.id })

    } catch (error) {
      logger.error('Failed to send WhatsApp notification', { error, message })
      throw error
    }
  }

  /**
   * Initialize default notification templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      // Email templates
      {
        id: 'email_critical',
        name: 'Critical Alert Email',
        channel: 'email',
        subject_template: '🚨 CRITICAL: {{title}}',
        body_template: `
          <h2>{{title}}</h2>
          <p><strong>Priority:</strong> {{priority}}</p>
          <p><strong>Time:</strong> {{timestamp}}</p>
          <p><strong>Message:</strong> {{message}}</p>
          {{#if metadata}}
          <p><strong>Details:</strong></p>
          <pre>{{json metadata}}</pre>
          {{/if}}
        `,
        priority: 'critical',
        enabled: true
      },
      {
        id: 'email_high',
        name: 'High Priority Email',
        channel: 'email',
        subject_template: '⚠️ HIGH: {{title}}',
        body_template: `
          <h2>{{title}}</h2>
          <p><strong>Priority:</strong> {{priority}}</p>
          <p><strong>Time:</strong> {{timestamp}}</p>
          <p><strong>Message:</strong> {{message}}</p>
        `,
        priority: 'high',
        enabled: true
      },
      // Slack templates
      {
        id: 'slack_critical',
        name: 'Critical Alert Slack',
        channel: 'slack',
        subject_template: '',
        body_template: '🚨 *{{title}}*\n{{message}}\n_Priority: {{priority}}_',
        priority: 'critical',
        enabled: true
      },
      {
        id: 'slack_high',
        name: 'High Priority Slack',
        channel: 'slack',
        subject_template: '',
        body_template: '⚠️ *{{title}}*\n{{message}}\n_Priority: {{priority}}_',
        priority: 'high',
        enabled: true
      },
      // SMS templates
      {
        id: 'sms_critical',
        name: 'Critical Alert SMS',
        channel: 'sms',
        subject_template: '',
        body_template: 'CRITICAL: {{title}} - {{message}}',
        priority: 'critical',
        enabled: true
      },
      {
        id: 'sms_high',
        name: 'High Priority SMS',
        channel: 'sms',
        subject_template: '',
        body_template: 'HIGH: {{title}} - {{message}}',
        priority: 'high',
        enabled: true
      }
    ]

    defaultTemplates.forEach(template => {
      this.templates.set(`${template.channel}_${template.priority}`, template)
    })
  }

  /**
   * Get notification template
   */
  private getTemplate(channel: NotificationChannel, priority: NotificationPriority): NotificationTemplate | undefined {
    return this.templates.get(`${channel}_${priority}`)
  }

  /**
   * Format template with message data
   */
  private formatTemplate(template: string, message: NotificationMessage): string {
    return template
      .replace(/\{\{title\}\}/g, message.title)
      .replace(/\{\{message\}\}/g, message.message)
      .replace(/\{\{priority\}\}/g, message.priority)
      .replace(/\{\{timestamp\}\}/g, message.timestamp.toISOString())
      .replace(/\{\{json (.*?)\}\}/g, (match, path) => {
        try {
          const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], message)
          return JSON.stringify(value, null, 2)
        } catch {
          return 'null'
        }
      })
  }

  /**
   * Get Slack color for priority
   */
  private getSlackColor(priority: NotificationPriority): string {
    switch (priority) {
      case 'critical': return 'danger'
      case 'high': return 'warning'
      case 'medium': return 'good'
      case 'low': return '#439FE0'
      default: return 'good'
    }
  }

  /**
   * Store notification in database
   */
  private async storeNotification(notification: NotificationMessage): Promise<void> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('system_notifications')
        .insert({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          channels: notification.channels,
          metadata: notification.metadata,
          timestamp: notification.timestamp.toISOString(),
          recipient: notification.recipient,
          template_id: notification.template_id
        })

      if (error) throw error

    } catch (error) {
      logger.error('Failed to store notification', { error, notification })
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(
    limit: number = 100,
    channel?: NotificationChannel,
    priority?: NotificationPriority
  ): Promise<NotificationMessage[]> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('system_notifications')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (channel) {
        query = query.eq('channels', channel)
      }

      if (priority) {
        query = query.eq('priority', priority)
      }

      const { data, error } = await query

      if (error) throw error

      return (data || []).map(notification => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        channels: notification.channels,
        metadata: notification.metadata,
        timestamp: new Date(notification.timestamp),
        recipient: notification.recipient,
        template_id: notification.template_id
      }))

    } catch (error) {
      logger.error('Failed to get notification history', { error })
      return []
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance()