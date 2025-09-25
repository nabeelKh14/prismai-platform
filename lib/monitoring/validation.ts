/**
 * Comprehensive Logging and Monitoring System
 * Provides enhanced logging, monitoring, and alerting for the lead qualification system
 */

import { z } from 'zod'
import { ValidationError, ExternalServiceError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/errors'

// Monitoring Event Types
export enum MonitoringEventType {
  VALIDATION_SUCCESS = 'validation_success',
  VALIDATION_FAILURE = 'validation_failure',
  SECURITY_BREACH = 'security_breach',
  PERFORMANCE_ISSUE = 'performance_issue',
  DATA_CORRUPTION = 'data_corruption',
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  WORKFLOW_ERROR = 'workflow_error',
  DATABASE_ERROR = 'database_error',
  API_ERROR = 'api_error',
  SYSTEM_ALERT = 'system_alert',
  CUSTOM_METRIC = 'custom_metric'
}

// Alert Severity Levels
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Monitoring Metric Types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

// Alert Rule
export interface AlertRule {
  id: string
  name: string
  description: string
  eventType: MonitoringEventType | 'all'
  conditions: Array<{
    field: string
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex'
    value: unknown
    timeWindow?: number // minutes
  }>
  severity: AlertSeverity
  enabled: boolean
  cooldownPeriod: number // minutes between alerts
  channels: string[] // 'email', 'slack', 'webhook', 'sms'
  recipients: string[]
  createdAt: Date
  updatedAt: Date
}

// Monitoring Metric
export interface MonitoringMetric {
  id: string
  name: string
  description: string
  type: MetricType
  value: number
  labels: Record<string, string>
  timestamp: Date
  expiry?: Date
}

// Performance Metric
export interface PerformanceMetric {
  operation: string
  duration: number
  timestamp: Date
  endpoint?: string
  userId?: string
  tenantId?: string
  metadata: Record<string, unknown>
}

// System Health Check
export interface SystemHealthCheck {
  id: string
  component: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  lastChecked: Date
  details: Record<string, unknown>
  alerts: Array<{
    severity: AlertSeverity
    message: string
    timestamp: Date
  }>
}

// Monitoring Dashboard
export interface MonitoringDashboard {
  id: string
  name: string
  description: string
  widgets: Array<{
    id: string
    type: 'metric' | 'chart' | 'alert' | 'log'
    title: string
    config: Record<string, unknown>
    position: { x: number; y: number; width: number; height: number }
  }>
  refreshInterval: number // seconds
  createdAt: Date
  updatedAt: Date
}

// Log Aggregation
export interface LogAggregation {
  timeRange: {
    start: Date
    end: Date
  }
  filters: {
    level?: string
    source?: string
    userId?: string
    tenantId?: string
    tags?: string[]
  }
  groupBy: string[]
  aggregations: Array<{
    field: string
    function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct'
  }>
  result: Record<string, unknown>
}

// Alert History
export interface AlertHistory {
  id: string
  ruleId: string
  eventType: MonitoringEventType
  severity: AlertSeverity
  message: string
  context: Record<string, unknown>
  triggeredAt: Date
  resolvedAt?: Date
  acknowledgedBy?: string
  acknowledgedAt?: Date
  status: 'active' | 'acknowledged' | 'resolved'
  channels: string[]
  deliveryStatus: Record<string, 'sent' | 'failed' | 'pending'>
}

// Monitoring Configuration
export interface MonitoringConfiguration {
  enabled: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  retentionDays: number
  alertThresholds: Record<AlertSeverity, number>
  performanceThresholds: {
    slowQueryThreshold: number
    highMemoryThreshold: number
    lowDiskSpaceThreshold: number
    highErrorRateThreshold: number
  }
  integrations: {
    email?: {
      enabled: boolean
      smtpConfig: Record<string, unknown>
    }
    slack?: {
      enabled: boolean
      webhookUrl: string
      channel: string
    }
    webhook?: {
      enabled: boolean
      url: string
      headers: Record<string, string>
    }
  }
}

// Metrics Collector
class MetricsCollector {
  private static instance: MetricsCollector
  private metrics = new Map<string, MonitoringMetric[]>()
  private performanceMetrics: PerformanceMetric[] = []

  constructor() {
    // Initialize metrics collection
    this.startPeriodicCleanup()
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector()
    }
    return MetricsCollector.instance
  }

  private startPeriodicCleanup() {
    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics()
    }, 3600000)
  }

  private cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

    for (const [key, metricList] of this.metrics.entries()) {
      const filteredMetrics = metricList.filter(m => m.timestamp > cutoff)
      if (filteredMetrics.length === 0) {
        this.metrics.delete(key)
      } else {
        this.metrics.set(key, filteredMetrics)
      }
    }

    this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff)
  }

  async recordMetric(metric: MonitoringMetric): Promise<void> {
    const key = `${metric.type}:${metric.name}`

    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }

    const metricList = this.metrics.get(key)!
    metricList.push(metric)

    // Keep only last 1000 metrics per type/name combination
    if (metricList.length > 1000) {
      metricList.shift()
    }

    // Log significant metrics
    if (metric.type === MetricType.COUNTER && metric.value > 100) {
      await logger.info('High metric value recorded', {
        metricName: metric.name,
        value: metric.value,
        labels: metric.labels
      }, {
        tags: ['monitoring', 'metric', 'high-value'],
        source: 'system'
      })
    }
  }

  async recordPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    this.performanceMetrics.push(metric)

    // Keep only last 10000 performance metrics
    if (this.performanceMetrics.length > 10000) {
      this.performanceMetrics.shift()
    }

    // Alert on slow operations
    if (metric.duration > 5000) { // 5 seconds
      await logger.warn('Slow operation detected', {
        operation: metric.operation,
        duration: metric.duration,
        endpoint: metric.endpoint,
        userId: metric.userId
      }, {
        tags: ['monitoring', 'performance', 'slow-operation'],
        source: 'system'
      })
    }
  }

  getMetrics(
    name?: string,
    type?: MetricType,
    timeRange?: { start: Date; end: Date }
  ): MonitoringMetric[] {
    let metrics: MonitoringMetric[] = []

    for (const [key, metricList] of this.metrics.entries()) {
      if (name && !key.includes(name)) continue
      if (type && !key.startsWith(type)) continue

      metrics.push(...metricList)
    }

    if (timeRange) {
      metrics = metrics.filter(m =>
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      )
    }

    return metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  getPerformanceMetrics(
    operation?: string,
    timeRange?: { start: Date; end: Date }
  ): PerformanceMetric[] {
    let metrics = this.performanceMetrics

    if (operation) {
      metrics = metrics.filter(m => m.operation === operation)
    }

    if (timeRange) {
      metrics = metrics.filter(m =>
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      )
    }

    return metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  getMetricSummary(
    name: string,
    type: MetricType,
    timeRange: { start: Date; end: Date }
  ): { count: number; sum: number; avg: number; min: number; max: number } {
    const metrics = this.getMetrics(name, type, timeRange)

    if (metrics.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0 }
    }

    const values = metrics.map(m => m.value)
    const sum = values.reduce((a, b) => a + b, 0)
    const min = Math.min(...values)
    const max = Math.max(...values)

    return {
      count: metrics.length,
      sum,
      avg: sum / metrics.length,
      min,
      max
    }
  }
}

// Alert Manager
class AlertManager {
  private static instance: AlertManager
  private alertRules: AlertRule[] = []
  private alertHistory: AlertHistory[] = []
  private lastAlertTimes = new Map<string, Date>()

  constructor() {
    this.initializeAlertRules()
  }

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager()
    }
    return AlertManager.instance
  }

  private initializeAlertRules() {
    this.alertRules = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds threshold',
        eventType: MonitoringEventType.VALIDATION_FAILURE,
        conditions: [
          {
            field: 'errorCount',
            operator: 'greater_than',
            value: 10,
            timeWindow: 5
          }
        ],
        severity: AlertSeverity.HIGH,
        enabled: true,
        cooldownPeriod: 10,
        channels: ['email', 'slack'],
        recipients: ['admin@example.com'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'security_breach',
        name: 'Security Breach Detection',
        description: 'Alert on security breaches',
        eventType: MonitoringEventType.SECURITY_BREACH,
        conditions: [],
        severity: AlertSeverity.CRITICAL,
        enabled: true,
        cooldownPeriod: 0, // No cooldown for security alerts
        channels: ['email', 'slack', 'webhook'],
        recipients: ['security@example.com', 'admin@example.com'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'performance_degradation',
        name: 'Performance Degradation',
        description: 'Alert on performance issues',
        eventType: MonitoringEventType.PERFORMANCE_ISSUE,
        conditions: [
          {
            field: 'averageResponseTime',
            operator: 'greater_than',
            value: 2000,
            timeWindow: 10
          }
        ],
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        cooldownPeriod: 15,
        channels: ['email', 'slack'],
        recipients: ['devops@example.com'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  }

  async processEvent(event: {
    type: MonitoringEventType
    message: string
    context: Record<string, unknown>
    severity?: AlertSeverity
    userId?: string
    tenantId?: string
  }): Promise<void> {
    try {
      // Check if event matches any alert rules
      const matchingRules = this.alertRules.filter(rule =>
        (rule.eventType === event.type || rule.eventType === 'all') &&
        rule.enabled &&
        this.evaluateConditions(rule.conditions, event.context)
      )

      for (const rule of matchingRules) {
        await this.triggerAlert(rule, event)
      }

    } catch (error) {
      await logger.error('Alert processing error', error as Error, {
        eventType: event.type,
        eventMessage: event.message
      }, {
        tags: ['monitoring', 'alert', 'error'],
        source: 'system'
      })
    }
  }

  private evaluateConditions(
    conditions: Array<{ field: string; operator: string; value: unknown; timeWindow?: number }>,
    context: Record<string, unknown>
  ): boolean {
    for (const condition of conditions) {
      const fieldValue = this.getNestedValue(context, condition.field)

      switch (condition.operator) {
        case 'equals':
          if (fieldValue !== condition.value) return false
          break
        case 'not_equals':
          if (fieldValue === condition.value) return false
          break
        case 'greater_than':
          if (typeof fieldValue !== 'number' || typeof condition.value !== 'number' || !(fieldValue > condition.value)) return false
          break
        case 'less_than':
          if (typeof fieldValue !== 'number' || typeof condition.value !== 'number' || !(fieldValue < condition.value)) return false
          break
        case 'contains':
          if (typeof fieldValue !== 'string' || !fieldValue.includes(condition.value as string)) return false
          break
        case 'regex':
          if (typeof fieldValue !== 'string' || !(condition.value instanceof RegExp) || !condition.value.test(fieldValue)) return false
          break
      }
    }

    return true
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: any, key: string) => current?.[key], obj)
  }

  private async triggerAlert(rule: AlertRule, event: any): Promise<void> {
    const now = new Date()
    const lastAlertTime = this.lastAlertTimes.get(rule.id)

    // Check cooldown period
    if (lastAlertTime && (now.getTime() - lastAlertTime.getTime()) < (rule.cooldownPeriod * 60000)) {
      return // Still in cooldown period
    }

    const alert: AlertHistory = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      eventType: event.type,
      severity: rule.severity,
      message: event.message,
      context: event.context,
      triggeredAt: now,
      status: 'active',
      channels: rule.channels,
      deliveryStatus: {}
    }

    this.alertHistory.push(alert)
    this.lastAlertTimes.set(rule.id, now)

    // Send alerts to configured channels
    for (const channel of rule.channels) {
      try {
        await this.sendAlert(channel, alert, rule.recipients)
        alert.deliveryStatus[channel] = 'sent'
      } catch (error) {
        alert.deliveryStatus[channel] = 'failed'
        await logger.error('Alert delivery failed', error as Error, {
          channel,
          alertId: alert.id,
          ruleId: rule.id
        }, {
          tags: ['monitoring', 'alert', 'delivery-failed'],
          source: 'system'
        })
      }
    }

    await logger.warn('Alert triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      eventType: event.type,
      message: event.message,
      channels: rule.channels,
      recipientCount: rule.recipients.length
    }, {
      tags: ['monitoring', 'alert', 'triggered', rule.severity],
      source: 'system'
    })
  }

  private async sendAlert(
    channel: string,
    alert: AlertHistory,
    recipients: string[]
  ): Promise<void> {
    // This would implement actual alert delivery
    // For simulation, we'll just log the alert
    console.log(`Alert sent via ${channel}:`, {
      alertId: alert.id,
      message: alert.message,
      recipients,
      severity: alert.severity
    })
  }

  getAlertHistory(
    ruleId?: string,
    status?: 'active' | 'acknowledged' | 'resolved',
    timeRange?: { start: Date; end: Date }
  ): AlertHistory[] {
    let alerts = this.alertHistory

    if (ruleId) {
      alerts = alerts.filter(a => a.ruleId === ruleId)
    }

    if (status) {
      alerts = alerts.filter(a => a.status === status)
    }

    if (timeRange) {
      alerts = alerts.filter(a =>
        a.triggeredAt >= timeRange.start && a.triggeredAt <= timeRange.end
      )
    }

    return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.alertHistory.find(a => a.id === alertId)
    if (alert) {
      alert.status = 'acknowledged'
      alert.acknowledgedBy = userId
      alert.acknowledgedAt = new Date()

      await logger.info('Alert acknowledged', {
        alertId,
        userId,
        ruleId: alert.ruleId,
        severity: alert.severity
      }, {
        tags: ['monitoring', 'alert', 'acknowledged'],
        source: 'system'
      })
    }
  }

  async resolveAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.alertHistory.find(a => a.id === alertId)
    if (alert) {
      alert.status = 'resolved'
      alert.resolvedAt = new Date()

      await logger.info('Alert resolved', {
        alertId,
        userId,
        ruleId: alert.ruleId,
        severity: alert.severity
      }, {
        tags: ['monitoring', 'alert', 'resolved'],
        source: 'system'
      })
    }
  }
}

// Enhanced Monitoring System
export class EnhancedMonitoringSystem {
  private static instance: EnhancedMonitoringSystem
  private metricsCollector: MetricsCollector
  private alertManager: AlertManager
  private systemHealth: Map<string, SystemHealthCheck> = new Map()

  constructor() {
    this.metricsCollector = MetricsCollector.getInstance()
    this.alertManager = AlertManager.getInstance()
    this.startHealthChecks()
  }

  static getInstance(): EnhancedMonitoringSystem {
    if (!EnhancedMonitoringSystem.instance) {
      EnhancedMonitoringSystem.instance = new EnhancedMonitoringSystem()
    }
    return EnhancedMonitoringSystem.instance
  }

  private startHealthChecks() {
    // Perform health checks every 5 minutes
    setInterval(() => {
      this.performHealthChecks()
    }, 300000)
  }

  private async performHealthChecks() {
    const components = ['database', 'api', 'mcp', 'workflow', 'validation']

    for (const component of components) {
      try {
        const healthCheck = await this.checkComponentHealth(component)
        this.systemHealth.set(component, healthCheck)

        if (healthCheck.status !== 'healthy') {
          await this.alertManager.processEvent({
            type: MonitoringEventType.SYSTEM_ALERT,
            message: `${component} health check failed: ${healthCheck.status}`,
            context: {
              component,
              status: healthCheck.status,
              responseTime: healthCheck.responseTime,
              details: healthCheck.details
            },
            severity: healthCheck.status === 'unhealthy' ? AlertSeverity.HIGH : AlertSeverity.MEDIUM
          })
        }
      } catch (error) {
        await logger.error('Health check failed', error as Error, {
          component
        }, {
          tags: ['monitoring', 'health-check', 'error'],
          source: 'system'
        })
      }
    }
  }

  private async checkComponentHealth(component: string): Promise<SystemHealthCheck> {
    const startTime = Date.now()

    try {
      // This would perform actual health checks based on component type
      // For simulation, we'll return a mock health check
      const responseTime = Math.random() * 1000 // 0-1000ms
      const status = responseTime > 500 ? 'degraded' : 'healthy'

      return {
        id: crypto.randomUUID(),
        component,
        status,
        responseTime,
        lastChecked: new Date(),
        details: {
          version: '1.0.0',
          uptime: Date.now() - startTime,
          memoryUsage: Math.random() * 100
        },
        alerts: []
      }
    } catch (error) {
      return {
        id: crypto.randomUUID(),
        component,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        alerts: []
      }
    }
  }

  /**
   * Record monitoring metric
   */
  async recordMetric(metric: MonitoringMetric): Promise<void> {
    await this.metricsCollector.recordMetric(metric)
  }

  /**
   * Record performance metric
   */
  async recordPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    await this.metricsCollector.recordPerformanceMetric(metric)
  }

  /**
   * Process monitoring event
   */
  async processEvent(event: {
    type: MonitoringEventType
    message: string
    context: Record<string, unknown>
    severity?: AlertSeverity
    userId?: string
    tenantId?: string
  }): Promise<void> {
    await this.alertManager.processEvent(event)
  }

  /**
   * Get system health status
   */
  getSystemHealth(): Record<string, SystemHealthCheck> {
    const health: Record<string, SystemHealthCheck> = {}
    for (const [component, check] of this.systemHealth.entries()) {
      health[component] = check
    }
    return health
  }

  /**
   * Get monitoring metrics
   */
  getMetrics(
    name?: string,
    type?: MetricType,
    timeRange?: { start: Date; end: Date }
  ): MonitoringMetric[] {
    return this.metricsCollector.getMetrics(name, type, timeRange)
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(
    operation?: string,
    timeRange?: { start: Date; end: Date }
  ): PerformanceMetric[] {
    return this.metricsCollector.getPerformanceMetrics(operation, timeRange)
  }

  /**
   * Get metric summary
   */
  getMetricSummary(
    name: string,
    type: MetricType,
    timeRange: { start: Date; end: Date }
  ): { count: number; sum: number; avg: number; min: number; max: number } {
    return this.metricsCollector.getMetricSummary(name, type, timeRange)
  }

  /**
   * Get alert history
   */
  getAlertHistory(
    ruleId?: string,
    status?: 'active' | 'acknowledged' | 'resolved',
    timeRange?: { start: Date; end: Date }
  ): AlertHistory[] {
    return this.alertManager.getAlertHistory(ruleId, status, timeRange)
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await this.alertManager.acknowledgeAlert(alertId, userId)
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, userId: string): Promise<void> {
    await this.alertManager.resolveAlert(alertId, userId)
  }

  /**
   * Create monitoring dashboard
   */
  async createDashboard(dashboard: Omit<MonitoringDashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<MonitoringDashboard> {
    const newDashboard: MonitoringDashboard = {
      id: crypto.randomUUID(),
      ...dashboard,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await logger.info('Monitoring dashboard created', {
      dashboardId: newDashboard.id,
      dashboardName: newDashboard.name,
      widgetCount: newDashboard.widgets.length
    }, {
      tags: ['monitoring', 'dashboard', 'created'],
      source: 'system'
    })

    return newDashboard
  }

  /**
   * Log monitoring event with enhanced context
   */
  async logMonitoringEvent(
    eventType: MonitoringEventType,
    message: string,
    context: Record<string, unknown>,
    severity: AlertSeverity = AlertSeverity.MEDIUM,
    userId?: string,
    tenantId?: string
  ): Promise<void> {
    // Record as metric
    await this.recordMetric({
      id: crypto.randomUUID(),
      name: eventType,
      description: message,
      type: MetricType.COUNTER,
      value: 1,
      labels: {
        severity,
        userId: userId || 'unknown',
        tenantId: tenantId || 'unknown'
      },
      timestamp: new Date()
    })

    // Process as alert if needed
    await this.processEvent({
      type: eventType,
      message,
      context,
      severity,
      userId,
      tenantId
    })

    // Log with enhanced context
    const logContext = {
      ...context,
      eventType,
      severity,
      monitoringSystem: 'enhanced'
    }

    const logOptions = {
      userId,
      tags: ['monitoring', 'event', eventType, severity],
      source: 'system' as const
    }

    switch (severity) {
      case AlertSeverity.CRITICAL:
        await logger.error(message, new Error(message), logContext, logOptions)
        break
      case AlertSeverity.HIGH:
        await logger.warn(message, logContext, logOptions)
        break
      case AlertSeverity.MEDIUM:
        await logger.info(message, logContext, logOptions)
        break
      case AlertSeverity.LOW:
        await logger.debug(message, logContext, logOptions)
        break
    }
  }
}

// Export singleton instance
export const monitoringSystem = EnhancedMonitoringSystem.getInstance()
export default monitoringSystem