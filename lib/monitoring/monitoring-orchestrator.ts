import { logger } from '@/lib/logger'
import { alertingSystem } from './alerting-system'
import { performanceMonitor } from './performance-monitor'
import { notificationService } from './notification-service'
import { businessMetricsTracker } from './business-metrics-tracker'
import { monitoringSecurity } from './security-wrapper'

export interface MonitoringConfig {
  enabled: boolean
  collection_interval_seconds: number
  alert_check_interval_seconds: number
  data_retention_days: number
  enable_notifications: boolean
  enable_security_monitoring: boolean
  enable_business_metrics: boolean
  enable_performance_monitoring: boolean
  notification_channels: string[]
  alert_thresholds: Record<string, number>
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'warning' | 'critical'
  components: {
    database: 'healthy' | 'warning' | 'critical'
    api: 'healthy' | 'warning' | 'critical'
    security: 'healthy' | 'warning' | 'critical'
    business: 'healthy' | 'warning' | 'critical'
  }
  metrics: {
    uptime: number
    response_time: number
    error_rate: number
    active_users: number
    throughput: number
  }
  last_updated: Date
}

export class MonitoringOrchestrator {
  private static instance: MonitoringOrchestrator
  private config: MonitoringConfig
  private isRunning = false
  private collectionInterval: NodeJS.Timeout | null = null
  private alertCheckInterval: NodeJS.Timeout | null = null
  private healthCheckInterval: NodeJS.Timeout | null = null

  static getInstance(): MonitoringOrchestrator {
    if (!MonitoringOrchestrator.instance) {
      MonitoringOrchestrator.instance = new MonitoringOrchestrator()
    }
    return MonitoringOrchestrator.instance
  }

  constructor() {
    this.config = this.getDefaultConfig()
    this.initializeComponents()
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): MonitoringConfig {
    return {
      enabled: true,
      collection_interval_seconds: 30,
      alert_check_interval_seconds: 60,
      data_retention_days: 30,
      enable_notifications: true,
      enable_security_monitoring: true,
      enable_business_metrics: true,
      enable_performance_monitoring: true,
      notification_channels: ['email', 'slack', 'dashboard'],
      alert_thresholds: {
        error_rate: 5,
        response_time: 5000
      }
    }
  }

  /**
   * Initialize all monitoring components
   */
  private initializeComponents(): void {
    try {
      // Configure notification service
      notificationService.configure({
        email: {
          enabled: this.config.enable_notifications,
          from_email: process.env.ALERT_FROM_EMAIL || 'alerts@system.local',
          from_name: 'Monitoring System'
        },
        slack: {
          enabled: this.config.enable_notifications,
          webhook_url: process.env.SLACK_WEBHOOK_URL || '',
          channel: process.env.SLACK_CHANNEL || '#alerts',
          username: 'MonitoringBot'
        },
        webhook: {
          enabled: this.config.enable_notifications,
          url: process.env.ALERT_WEBHOOK_URL || '',
          method: 'POST'
        },
        sms: {
          enabled: this.config.enable_notifications,
          from_number: process.env.TWILIO_PHONE_NUMBER || ''
        },
        whatsapp: {
          enabled: this.config.enable_notifications,
          from_number: process.env.TWILIO_PHONE_NUMBER || ''
        }
      })

      // Configure alerting system
      alertingSystem.addAlertRule({
        name: 'High CPU Usage',
        type: 'resource_exhaustion',
        severity: 'high',
        condition: (metrics) => metrics.cpu_usage_percent > this.config.alert_thresholds.cpu_usage,
        message: (metrics) => `CPU usage is at ${metrics.cpu_usage_percent.toFixed(1)}%`,
        channels: ['email', 'slack', 'dashboard'],
        enabled: true,
        cooldown_minutes: 10
      })

      alertingSystem.addAlertRule({
        name: 'High Memory Usage',
        type: 'resource_exhaustion',
        severity: 'high',
        condition: (metrics) => metrics.memory_usage_percent > this.config.alert_thresholds.memory_usage,
        message: (metrics) => `Memory usage is at ${metrics.memory_usage_percent.toFixed(1)}%`,
        channels: ['email', 'slack', 'dashboard'],
        enabled: true,
        cooldown_minutes: 15
      })

      alertingSystem.addAlertRule({
        name: 'High Error Rate',
        type: 'high_error_rate',
        severity: 'critical',
        condition: (metrics) => metrics.error_rate > this.config.alert_thresholds.error_rate,
        message: (metrics) => `Error rate has exceeded ${metrics.error_rate.toFixed(1)}%`,
        channels: ['email', 'slack', 'sms', 'dashboard'],
        enabled: true,
        cooldown_minutes: 5
      })

      alertingSystem.addAlertRule({
        name: 'Slow Response Time',
        type: 'slow_performance',
        severity: 'medium',
        condition: (metrics) => metrics.avg_response_time > this.config.alert_thresholds.response_time,
        message: (metrics) => `Average response time is ${metrics.avg_response_time}ms`,
        channels: ['email', 'dashboard'],
        enabled: true,
        cooldown_minutes: 10
      })

      logger.info('Monitoring components initialized successfully')

    } catch (error) {
      logger.error('Failed to initialize monitoring components', { error })
    }
  }

  /**
   * Start the monitoring orchestrator
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Monitoring orchestrator is already running')
      return
    }

    try {
      this.isRunning = true

      // Start periodic data collection
      this.collectionInterval = setInterval(() => {
        this.collectAllMetrics()
      }, this.config.collection_interval_seconds * 1000)

      // Start periodic alert checking
      this.alertCheckInterval = setInterval(() => {
        this.checkAllAlerts()
      }, this.config.alert_check_interval_seconds * 1000)

      // Start periodic health checks
      this.healthCheckInterval = setInterval(() => {
        this.performHealthCheck()
      }, 30000) // Every 30 seconds

      logger.info('Monitoring orchestrator started successfully', {
        collection_interval: this.config.collection_interval_seconds,
        alert_check_interval: this.config.alert_check_interval_seconds
      })

    } catch (error) {
      logger.error('Failed to start monitoring orchestrator', { error })
      this.isRunning = false
    }
  }

  /**
   * Stop the monitoring orchestrator
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Monitoring orchestrator is not running')
      return
    }

    try {
      this.isRunning = false

      // Clear intervals
      if (this.collectionInterval) {
        clearInterval(this.collectionInterval)
        this.collectionInterval = null
      }

      if (this.alertCheckInterval) {
        clearInterval(this.alertCheckInterval)
        this.alertCheckInterval = null
      }

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      logger.info('Monitoring orchestrator stopped successfully')

    } catch (error) {
      logger.error('Failed to stop monitoring orchestrator', { error })
    }
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...newConfig }

    logger.info('Monitoring configuration updated', {
      changes: Object.keys(newConfig),
      old_config: oldConfig,
      new_config: this.config
    })

    // Reinitialize components if needed
    if (newConfig.enable_notifications !== undefined ||
        newConfig.notification_channels !== undefined) {
      this.initializeComponents()
    }
  }

  /**
   * Collect all metrics from all components
   */
  private async collectAllMetrics(): Promise<void> {
    try {
      const timestamp = new Date().toISOString()

      // Collect performance metrics
      if (this.config.enable_performance_monitoring) {
        // Performance metrics are collected automatically by middleware
        // This is just to ensure the system is working
        const apiStats = await performanceMonitor.getAggregatedStats('api_response', '1h')
        if (apiStats.count > 0) {
          logger.debug('Performance metrics collected', {
            api_requests: apiStats.count,
            avg_response_time: apiStats.average
          })
        }
      }

      // Collect business metrics
      if (this.config.enable_business_metrics) {
        // Business metrics are collected by individual tracking calls
        // This is just to ensure the system is working
        const businessStats = await businessMetricsTracker.getAggregatedBusinessStats('user_activity', '1h')
        if (businessStats.count > 0) {
          logger.debug('Business metrics collected', {
            user_activity_events: businessStats.count,
            unique_users: businessStats.unique_users
          })
        }
      }

    } catch (error) {
      logger.error('Failed to collect all metrics', { error })
    }
  }

  /**
   * Check all alerts
   */
  private async checkAllAlerts(): Promise<void> {
    try {
      await alertingSystem.checkAlerts()
      logger.debug('Alert check completed')
    } catch (error) {
      logger.error('Failed to check alerts', { error })
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<SystemHealthStatus> {
    try {
      const timestamp = new Date()

      // Get database health (simplified)
      const databaseHealth = 'healthy' // Would check actual database connection

      // Get API health
      const apiStats = await performanceMonitor.getAggregatedStats('api_response', '1h')
      let apiHealth: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (apiStats.average > 5000) apiHealth = 'warning'
      if (apiStats.average > 10000) apiHealth = 'critical'

      // Get security health
      const securityStats = monitoringSecurity.getSecurityStats()
      let securityHealth: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (securityStats.blockedRequests > 10) securityHealth = 'warning'
      if (securityStats.blockedRequests > 50) securityHealth = 'critical'

      // Get business health
      const businessStats = await businessMetricsTracker.getAggregatedBusinessStats('user_activity', '1h')
      let businessHealth: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (businessStats.count < 10) businessHealth = 'warning' // Low activity

      // Determine overall health
      const components = { database: databaseHealth as 'healthy' | 'warning' | 'critical', api: apiHealth, security: securityHealth, business: businessHealth }
      const criticalCount = Object.values(components).filter(s => s === 'critical').length
      const warningCount = Object.values(components).filter(s => s === 'warning').length

      let overall: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (criticalCount > 0) overall = 'critical'
      else if (warningCount > 1) overall = 'warning'

      const healthStatus: SystemHealthStatus = {
        overall,
        components,
        metrics: {
          uptime: 99.9, // Would calculate from actual uptime
          response_time: apiStats.average,
          error_rate: 0.1, // Would calculate from error tracking
          active_users: businessStats.unique_users,
          throughput: apiStats.count / 5 // requests per minute
        },
        last_updated: timestamp
      }

      // Log health status
      logger.info('Health check completed', {
        overall: healthStatus.overall,
        components: healthStatus.components,
        metrics: healthStatus.metrics
      })

      return healthStatus

    } catch (error) {
      logger.error('Failed to perform health check', { error })
      return {
        overall: 'critical',
        components: {
          database: 'critical',
          api: 'critical',
          security: 'critical',
          business: 'critical'
        },
        metrics: {
          uptime: 0,
          response_time: 0,
          error_rate: 100,
          active_users: 0,
          throughput: 0
        },
        last_updated: new Date()
      }
    }
  }

  /**
   * Get current system health status
   */
  async getHealthStatus(): Promise<SystemHealthStatus> {
    return await this.performHealthCheck()
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(): Promise<{
    is_running: boolean
    config: MonitoringConfig
    components_status: Record<string, boolean>
    last_health_check: SystemHealthStatus
    alerts_active: number
    metrics_collected_today: number
  }> {
    try {
      const healthStatus = await this.getHealthStatus()
      const activeAlerts = await alertingSystem.getActiveAlerts()

      // Get metrics count (simplified)
      const metricsCount = 0 // Would query actual metrics count

      return {
        is_running: this.isRunning,
        config: this.config,
        components_status: {
          performance_monitoring: this.config.enable_performance_monitoring,
          security_monitoring: this.config.enable_security_monitoring,
          business_metrics: this.config.enable_business_metrics,
          notifications: this.config.enable_notifications
        },
        last_health_check: healthStatus,
        alerts_active: activeAlerts.length,
        metrics_collected_today: metricsCount
      }

    } catch (error) {
      logger.error('Failed to get monitoring stats', { error })
      return {
        is_running: false,
        config: this.config,
        components_status: {
          system_monitoring: false,
          performance_monitoring: false,
          security_monitoring: false,
          business_metrics: false,
          notifications: false
        },
        last_health_check: {
          overall: 'critical',
          components: {
            database: 'critical',
            api: 'critical',
            security: 'critical',
            business: 'critical'
          },
          metrics: {
            uptime: 0,
            response_time: 0,
            error_rate: 0,
            active_users: 0,
            throughput: 0
          },
          last_updated: new Date()
        },
        alerts_active: 0,
        metrics_collected_today: 0
      }
    }
  }

  /**
   * Emergency stop - stops all monitoring and clears all intervals
   */
  emergencyStop(): void {
    logger.warn('Emergency stop initiated for monitoring orchestrator')

    this.isRunning = false

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
      this.collectionInterval = null
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval)
      this.alertCheckInterval = null
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    logger.warn('Monitoring orchestrator emergency stopped')
  }

  /**
   * Restart the monitoring orchestrator
   */
  restart(): void {
    logger.info('Restarting monitoring orchestrator')

    this.stop()
    setTimeout(() => {
      this.start()
    }, 1000)
  }
}

// Export singleton instance
export const monitoringOrchestrator = MonitoringOrchestrator.getInstance()