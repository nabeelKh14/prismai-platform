# PrismAI Monitoring & Alerting Guide

## Overview

This guide provides comprehensive information about monitoring, alerting, and observability features in the PrismAI Platform. The system includes real-time monitoring, performance metrics, health checks, and intelligent alerting to ensure optimal system performance and reliability.

## Monitoring Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   Monitoring Infrastructure                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ Performance │  │   System    │  │   Security  │  │ Business│ │
│  │  Monitor    │  │   Health    │  │ Monitoring  │  │ Metrics │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│         │                │                │                │     │
│         ▼                ▼                ▼                ▼     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │    Real-    │  │   Health    │  │   Security  │  │   Agent │ │
│  │   Time      │  │   Checks    │  │   Events    │  │Performance│ │
│  │ Dashboards  │  │   API       │  │   Logging   │  │  Metrics │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Monitoring Components

#### 1. Performance Monitor (lib/monitoring/performance-monitor.ts)
- **API Response Times**: Track endpoint performance with real-time metrics
- **Database Queries**: Monitor query execution times and connection pooling
- **External Services**: Monitor AI services (Gemini, VAPI, ElevenLabs) response times
- **Resource Usage**: CPU, memory, disk utilization with trend analysis
- **Cache Performance**: Redis cache hit rates and efficiency metrics

#### 2. Alerting System (lib/monitoring/alerting-system.ts)
- **Rule-based Alerts**: Configurable alert conditions with escalation
- **Multi-channel Notifications**: Email, Slack, SMS, WhatsApp, Webhooks
- **Alert Escalation**: Priority-based alert handling with auto-resolution
- **Alert Management**: Acknowledge, resolve, and track alerts with audit trail

#### 3. Log Aggregator (lib/monitoring/log-aggregator.ts)
- **Centralized Logging**: Structured JSON logging with correlation IDs
- **Log Levels**: debug, info, warn, error, fatal with configurable levels
- **Security Event Logging**: Complete audit trail for security events
- **Performance Logging**: Application performance and business metrics

## Health Check System

### Health Check API Endpoints

#### Application Health
**GET** `/api/v1/health`

Returns overall system health status with comprehensive checks.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-10T21:31:24.584Z",
  "version": "2.0.0",
  "environment": "production",
  "uptime": "7d 12h 30m 45s",
  "response_time": "45ms",
  "checks": {
    "database": {
      "status": "healthy",
      "connection_pool": {
        "active": 5,
        "idle": 15,
        "waiting": 0
      },
      "response_time": "12ms"
    },
    "redis": {
      "status": "healthy",
      "connection_status": "connected",
      "memory_usage": "67MB",
      "hit_rate": "94.2%"
    },
    "ai_services": {
      "gemini": {
        "status": "healthy",
        "response_time": "120ms",
        "last_check": "2025-11-10T21:31:20.000Z"
      },
      "vapi": {
        "status": "healthy",
        "response_time": "85ms",
        "last_check": "2025-11-10T21:31:19.000Z"
      },
      "elevenlabs": {
        "status": "healthy",
        "response_time": "95ms",
        "last_check": "2025-11-10T21:31:21.000Z"
      }
    },
    "external_apis": {
      "twilio": {
        "status": "healthy",
        "response_time": "45ms",
        "last_check": "2025-11-10T21:31:18.000Z"
      },
      "supabase": {
        "status": "healthy",
        "response_time": "25ms",
        "last_check": "2025-11-10T21:31:22.000Z"
      }
    }
  }
}
```

#### System Metrics
**GET** `/api/monitoring/metrics`

Returns comprehensive system performance metrics.

**Response:**
```json
{
  "timestamp": "2025-11-10T21:31:24.584Z",
  "system": {
    "cpu": {
      "usage": 45.2,
      "load_average": [1.2, 1.1, 0.9]
    },
    "memory": {
      "used": "2.1GB",
      "total": "4GB",
      "usage_percent": 52.5,
      "heap_used": "450MB",
      "heap_total": "600MB"
    },
    "disk": {
      "used": "15.2GB",
      "total": "50GB",
      "usage_percent": 30.4
    },
    "network": {
      "bytes_sent": 1250000,
      "bytes_received": 890000,
      "packets_sent": 1250,
      "packets_received": 890
    }
  },
  "application": {
    "active_connections": 25,
    "active_sessions": 18,
    "requests_per_minute": 450,
    "average_response_time": 180,
    "error_rate": 0.8,
    "throughput": "150 requests/second"
  },
  "database": {
    "active_connections": 5,
    "query_performance": {
      "average_time": "12ms",
      "slow_queries": 0,
      "query_cache_hit_rate": 85.2
    }
  }
}
```

#### Agent Performance Metrics
**GET** `/api/monitoring/agents`

Returns agent performance and availability metrics.

**Response:**
```json
{
  "timestamp": "2025-11-10T21:31:24.584Z",
  "agents": {
    "total": 12,
    "active": 8,
    "online": 8,
    "busy": 3,
    "available": 5,
    "offline": 4
  },
  "performance": {
    "average_response_time": "2.3min",
    "average_resolution_time": "8.5min",
    "customer_satisfaction": 92.5,
    "conversations_per_hour": 45,
    "escalation_rate": 5.2
  },
  "conversations": {
    "active": 23,
    "waiting": 2,
    "assigned": 21,
    "average_wait_time": "1.2min"
  }
}
```

### Health Check Implementation

```typescript
// Health check service from lib/monitoring/performance-monitor.ts
export class HealthCheckService {
  // Database health check
  static async checkDatabase(): Promise<HealthStatus> {
    const startTime = Date.now()
    try {
      const { data, error } = await supabase
        .from('health_check')
        .select('*')
        .limit(1)

      const responseTime = Date.now() - startTime

      if (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          responseTime
        }
      }

      return {
        status: 'healthy',
        responseTime,
        details: {
          connection_pool: await this.getConnectionPoolStatus(),
          query_performance: await this.getQueryPerformance()
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      }
    }
  }

  // AI services health check
  static async checkAIServices(): Promise<HealthStatus> {
    const services = {
      gemini: await this.checkGeminiAPI(),
      vapi: await this.checkVAPI(),
      elevenlabs: await this.checkElevenLabs()
    }

    const unhealthyServices = Object.entries(services)
      .filter(([_, status]) => status.status === 'unhealthy')
      .map(([service, _]) => service)

    return {
      status: unhealthyServices.length === 0 ? 'healthy' : 'degraded',
      details: services,
      warning: unhealthyServices.length > 0 ? `Unhealthy services: ${unhealthyServices.join(', ')}` : undefined
    }
  }

  // Redis cache health check
  static async checkRedis(): Promise<HealthStatus> {
    try {
      const redis = new Redis(process.env.REDIS_URL)
      const startTime = Date.now()
      
      await redis.ping()
      const info = await redis.info('memory')
      const responseTime = Date.now() - startTime
      
      await redis.disconnect()

      // Parse memory info
      const memoryMatch = info.match(/used_memory:(\d+)/)
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) / 1024 / 1024 : 0

      return {
        status: 'healthy',
        responseTime,
        details: {
          connection_status: 'connected',
          memory_usage: `${memoryUsage.toFixed(2)}MB`
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Redis connection failed',
        responseTime: 0
      }
    }
  }
}
```

## Performance Monitoring

### Metrics Collection System

#### Real-time Performance Tracking

```typescript
// Performance monitor from lib/monitoring/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, MetricData[]> = new Map()
  private readonly maxMetricsHistory = 1000

  // Record API performance metrics
  static recordAPIMetric(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    userId?: string,
    additionalData?: Record<string, any>
  ): void {
    const metric: APIMetric = {
      endpoint,
      method,
      responseTime,
      statusCode,
      timestamp: new Date().toISOString(),
      userId,
      ...additionalData
    }

    this.addMetric('api_performance', metric)

    // Real-time alerting
    this.checkPerformanceThresholds(metric)
  }

  // Record database query performance
  static recordDatabaseMetric(
    query: string,
    executionTime: number,
    rowCount: number,
    connectionId: string
  ): void {
    const metric: DatabaseMetric = {
      query,
      executionTime,
      rowCount,
      connectionId,
      timestamp: new Date().toISOString()
    }

    this.addMetric('database_performance', metric)
  }

  // Record business metrics
  static recordBusinessMetric(
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ): void {
    const metric: BusinessMetric = {
      name: metricName,
      value,
      metadata,
      timestamp: new Date().toISOString()
    }

    this.addMetric('business_metrics', metric)
  }

  // Get performance metrics
  static getMetrics(
    type: MetricType,
    timeRange: string = '1h',
    filters?: Record<string, any>
  ): MetricData[] {
    const cutoff = this.getTimeRangeCutoff(timeRange)
    const metrics = this.metrics.get(type) || []
    
    return metrics.filter(metric => {
      const metricTime = new Date(metric.timestamp).getTime()
      if (metricTime < cutoff) return false
      
      if (filters) {
        return Object.entries(filters).every(([key, value]) => {
          return metric[key] === value
        })
      }
      
      return true
    })
  }

  // Generate performance report
  static generatePerformanceReport(timeRange: string = '24h'): PerformanceReport {
    const apiMetrics = this.getMetrics('api_performance', timeRange)
    const dbMetrics = this.getMetrics('database_performance', timeRange)
    const businessMetrics = this.getMetrics('business_metrics', timeRange)

    return {
      timeRange,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRequests: apiMetrics.length,
        averageResponseTime: this.calculateAverage(apiMetrics, 'responseTime'),
        errorRate: this.calculateErrorRate(apiMetrics),
        totalDatabaseQueries: dbMetrics.length,
        averageQueryTime: this.calculateAverage(dbMetrics, 'executionTime')
      },
      api: {
        endpoints: this.groupByEndpoint(apiMetrics),
        responseTimeDistribution: this.createDistribution(apiMetrics, 'responseTime'),
        errorBreakdown: this.breakdownByStatusCode(apiMetrics)
      },
      database: {
        slowQueries: dbMetrics.filter(m => m.executionTime > 1000),
        queryDistribution: this.createDistribution(dbMetrics, 'executionTime')
      },
      business: this.aggregateBusinessMetrics(businessMetrics)
    }
  }
}
```

#### System Resource Monitoring

```typescript
// System metrics from lib/monitoring/performance-monitor.ts
export class SystemMonitor {
  // Monitor system resources
  static async getSystemMetrics(): Promise<SystemMetrics> {
    const [cpu, memory, disk, network] = await Promise.all([
      this.getCPUMetrics(),
      this.getMemoryMetrics(),
      this.getDiskMetrics(),
      this.getNetworkMetrics()
    ])

    return {
      timestamp: new Date().toISOString(),
      cpu,
      memory,
      disk,
      network,
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    }
  }

  // Monitor application performance
  static getApplicationMetrics(): ApplicationMetrics {
    return {
      timestamp: new Date().toISOString(),
      connections: this.getActiveConnections(),
      sessions: this.getActiveSessions(),
      queueLength: this.getQueueLength(),
      throughput: this.getThroughput(),
      errorRate: this.getErrorRate()
    }
  }

  // Real-time monitoring with WebSocket
  static startRealTimeMonitoring(socket: WebSocket): void {
    const interval = setInterval(async () => {
      const metrics = await this.getSystemMetrics()
      const appMetrics = this.getApplicationMetrics()
      
      socket.send(JSON.stringify({
        type: 'metrics_update',
        data: {
          system: metrics,
          application: appMetrics
        }
      }))
    }, 5000) // Update every 5 seconds

    socket.on('close', () => clearInterval(interval))
  }
}
```

### Performance Dashboards

#### Real-time Dashboard Components

The platform provides comprehensive real-time dashboards through:

- **Web Interface**: `/dashboard/monitoring` with live charts
- **API Endpoint**: `/api/monitoring/metrics` with JSON data
- **React Components**: `components/performance-monitor.tsx`
- **Dashboard Components**: `components/monitoring/*`

```typescript
// Performance monitor component from components/performance-monitor.tsx
export function PerformanceMonitorDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('1h')

  useEffect(() => {
    // Real-time WebSocket connection
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/monitoring`)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'metrics_update') {
        setMetrics(data.data)
      }
    }

    ws.onopen = () => {
      setIsLoading(false)
      // Request initial metrics
      ws.send(JSON.stringify({ type: 'request_metrics', timeRange }))
    }

    return () => ws.close()
  }, [timeRange])

  return (
    <div className="performance-dashboard">
      <div className="dashboard-header">
        <h1>Performance Monitoring</h1>
        <TimeRangeSelector 
          value={timeRange} 
          onChange={setTimeRange} 
        />
      </div>
      
      <div className="metrics-grid">
        <MetricCard
          title="Response Time"
          value={metrics?.api?.averageResponseTime}
          trend={metrics?.api?.responseTimeTrend}
        />
        <MetricCard
          title="Throughput"
          value={metrics?.application?.throughput}
          trend={metrics?.application?.throughputTrend}
        />
        <MetricCard
          title="Error Rate"
          value={metrics?.api?.errorRate}
          trend={metrics?.api?.errorRateTrend}
          type="percentage"
        />
        <MetricCard
          title="Active Connections"
          value={metrics?.application?.connections}
        />
      </div>

      <div className="charts-section">
        <ResponseTimeChart data={metrics?.charts?.responseTime} />
        <ErrorRateChart data={metrics?.charts?.errorRate} />
        <ThroughputChart data={metrics?.charts?.throughput} />
      </div>
    </div>
  )
}
```

## Alerting System

### Alert Configuration and Management

```typescript
// Alerting system from lib/monitoring/alerting-system.ts
export class AlertingSystem {
  private alertRules: Map<string, AlertRule> = new Map()
  private activeAlerts: Map<string, Alert> = new Map()
  private alertHistory: Alert[] = []

  // Add alert rule
  static addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule)
    logger.info('Alert rule added', { ruleId: rule.id, ruleName: rule.name })
  }

  // Check alert conditions
  static checkAlerts(metrics: SystemMetrics): void {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue

      const isTriggered = rule.condition(metrics)
      
      if (isTriggered && !this.activeAlerts.has(ruleId)) {
        // Alert triggered
        this.triggerAlert(rule, metrics)
      } else if (!isTriggered && this.activeAlerts.has(ruleId)) {
        // Alert resolved
        this.resolveAlert(ruleId)
      }
    }
  }

  // Trigger alert
  private static async triggerAlert(rule: AlertRule, metrics: SystemMetrics): Promise<void> {
    const alert: Alert = {
      id: generateId(),
      ruleId: rule.id,
      name: rule.name,
      severity: rule.severity,
      status: 'active',
      triggeredAt: new Date().toISOString(),
      message: rule.message(metrics),
      details: {
        condition: rule.name,
        metrics: metrics,
        threshold: rule.threshold
      }
    }

    this.activeAlerts.set(rule.id, alert)
    this.alertHistory.push(alert)

    // Send notifications
    await this.sendNotifications(alert, rule.channels)

    // Log alert
    logger.warn('Alert triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: rule.severity,
      message: alert.message
    })
  }

  // Send notifications to configured channels
  private static async sendNotifications(alert: Alert, channels: NotificationChannel[]): Promise<void> {
    const notificationPromises = channels.map(channel => {
      switch (channel.type) {
        case 'email':
          return this.sendEmailNotification(channel, alert)
        case 'slack':
          return this.sendSlackNotification(channel, alert)
        case 'sms':
          return this.sendSMSNotification(channel, alert)
        case 'whatsapp':
          return this.sendWhatsAppNotification(channel, alert)
        case 'webhook':
          return this.sendWebhookNotification(channel, alert)
        default:
          logger.warn('Unknown notification channel', { channel: channel.type })
          return Promise.resolve()
      }
    })

    await Promise.allSettled(notificationPromises)
  }

  // Acknowledge alert
  static async acknowledgeAlert(alertId: string, userId: string, comment?: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId)
    if (!alert) {
      throw new Error('Alert not found')
    }

    alert.status = 'acknowledged'
    alert.acknowledgedBy = userId
    alert.acknowledgedAt = new Date().toISOString()
    alert.acknowledgmentComment = comment

    logger.info('Alert acknowledged', {
      alertId,
      userId,
      comment
    })
  }

  // Resolve alert
  static resolveAlert(alertId: string, resolvedBy?: string, comment?: string): void {
    const alert = this.activeAlerts.get(alertId)
    if (!alert) return

    alert.status = 'resolved'
    alert.resolvedAt = new Date().toISOString()
    alert.resolvedBy = resolvedBy
    alert.resolutionComment = comment

    // Move to history
    this.alertHistory.push(alert)
    this.activeAlerts.delete(alertId)

    logger.info('Alert resolved', {
      alertId,
      resolvedBy,
      comment
    })
  }
}
```

### Alert Rules Configuration

```typescript
// Pre-configured alert rules
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'high_response_time',
    name: 'High API Response Time',
    severity: 'medium',
    condition: (metrics) => metrics.api?.averageResponseTime > 2000,
    message: (metrics) => `API response time is ${metrics.api?.averageResponseTime}ms (threshold: 2000ms)`,
    channels: ['email', 'slack'],
    enabled: true,
    cooldown_minutes: 15
  },
  {
    id: 'high_error_rate',
    name: 'High Error Rate',
    severity: 'high',
    condition: (metrics) => metrics.api?.errorRate > 5,
    message: (metrics) => `Error rate is ${metrics.api?.errorRate}% (threshold: 5%)`,
    channels: ['email', 'slack', 'sms'],
    enabled: true,
    cooldown_minutes: 10
  },
  {
    id: 'database_connection_issue',
    name: 'Database Connection Issue',
    severity: 'critical',
    condition: (metrics) => metrics.database?.status === 'unhealthy',
    message: (metrics) => `Database connection is unhealthy: ${metrics.database?.error}`,
    channels: ['email', 'slack', 'sms', 'webhook'],
    enabled: true,
    cooldown_minutes: 5
  },
  {
    id: 'high_cpu_usage',
    name: 'High CPU Usage',
    severity: 'medium',
    condition: (metrics) => metrics.system?.cpu?.usage > 80,
    message: (metrics) => `CPU usage is ${metrics.system?.cpu?.usage}% (threshold: 80%)`,
    channels: ['email', 'slack'],
    enabled: true,
    cooldown_minutes: 20
  },
  {
    id: 'low_agent_availability',
    name: 'Low Agent Availability',
    severity: 'high',
    condition: (metrics) => metrics.agents?.availability_rate < 50,
    message: (metrics) => `Agent availability is ${metrics.agents?.availability_rate}% (threshold: 50%)`,
    channels: ['email', 'slack', 'sms'],
    enabled: true,
    cooldown_minutes: 30
  }
]
```

### Notification Channels

```typescript
// Notification service implementation
export class NotificationService {
  // Email notification
  static async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const emailData = {
      to: channel.config.recipients,
      subject: `[${alert.severity.toUpperCase()}] ${alert.name}`,
      html: this.generateEmailTemplate(alert)
    }

    try {
      await resend.emails.send(emailData)
      logger.info('Email notification sent', { alertId: alert.id, recipients: channel.config.recipients })
    } catch (error) {
      logger.error('Failed to send email notification', { alertId: alert.id, error })
    }
  }

  // Slack notification
  static async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const slackMessage = {
      channel: channel.config.channel,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:${this.getAlertIcon(alert.severity)}: *${alert.name}*\n${alert.message}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Severity: ${alert.severity.toUpperCase()} | Triggered: ${alert.triggeredAt}`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Acknowledge'
              },
              style: 'primary',
              value: alert.id,
              action_id: 'acknowledge_alert'
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Dashboard'
              },
              url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/monitoring`
            }
          ]
        }
      ]
    }

    try {
      await fetch(`https://hooks.slack.com/services/${channel.config.webhookUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage)
      })
    } catch (error) {
      logger.error('Failed to send Slack notification', { alertId: alert.id, error })
    }
  }

  // SMS notification (Twilio)
  static async sendSMSNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const message = `[PRISMAI ALERT] ${alert.severity.toUpperCase()}: ${alert.name} - ${alert.message}`

    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: channel.config.phoneNumber
      })
    } catch (error) {
      logger.error('Failed to send SMS notification', { alertId: alert.id, error })
    }
  }

  // WhatsApp notification
  static async sendWhatsAppNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    const message = {
      from: 'whatsapp:' + process.env.WHATSAPP_PHONE_NUMBER_ID,
      to: 'whatsapp:' + channel.config.phoneNumber,
      content: {
        body: `🚨 PrismAI Alert\n\n*${alert.name}*\n\n${alert.message}\n\nSeverity: ${alert.severity.toUpperCase()}`
      }
    }

    try {
      await twilioClient.messages.create(message)
    } catch (error) {
      logger.error('Failed to send WhatsApp notification', { alertId: alert.id, error })
    }
  }
}
```

## Business Metrics Monitoring

### Key Performance Indicators (KPIs)

```typescript
// Business metrics collection from performance monitor
export class BusinessMetricsMonitor {
  // Monitor customer service metrics
  static recordCustomerServiceMetrics(metrics: CustomerServiceMetrics): void {
    PerformanceMonitor.recordBusinessMetric('customer_satisfaction', metrics.satisfactionScore, {
      period: 'daily',
      sample_size: metrics.sampleSize,
      source: 'survey_responses'
    })

    PerformanceMonitor.recordBusinessMetric('average_resolution_time', metrics.avgResolutionTime, {
      period: 'hourly',
      unit: 'minutes'
    })

    PerformanceMonitor.recordBusinessMetric('first_response_time', metrics.firstResponseTime, {
      period: 'hourly',
      unit: 'minutes'
    })
  }

  // Monitor agent performance
  static recordAgentMetrics(agentId: string, metrics: AgentMetrics): void {
    PerformanceMonitor.recordBusinessMetric('agent_response_time', metrics.responseTime, {
      agent_id: agentId,
      period: 'session'
    })

    PerformanceMonitor.recordBusinessMetric('agent_conversations_handled', metrics.conversationsHandled, {
      agent_id: agentId,
      period: 'daily'
    })

    PerformanceMonitor.recordBusinessMetric('agent_utilization', metrics.utilizationRate, {
      agent_id: agentId,
      period: 'hourly',
      unit: 'percentage'
    })
  }

  // Monitor conversation analytics
  static recordConversationMetrics(conversationId: string, metrics: ConversationMetrics): void {
    PerformanceMonitor.recordBusinessMetric('conversation_duration', metrics.duration, {
      conversation_id: conversationId,
      period: 'conversation',
      unit: 'minutes'
    })

    PerformanceMonitor.recordBusinessMetric('message_count', metrics.messageCount, {
      conversation_id: conversationId,
      period: 'conversation'
    })

    PerformanceMonitor.recordBusinessMetric('sentiment_score', metrics.sentimentScore, {
      conversation_id: conversationId,
      period: 'conversation'
    })
  }

  // Generate business dashboard data
  static getBusinessDashboardData(timeRange: string = '24h'): BusinessDashboardData {
    const customerSatisfaction = PerformanceMonitor.getMetrics('business_metrics', timeRange, { 
      name: 'customer_satisfaction' 
    })

    const agentPerformance = PerformanceMonitor.getMetrics('business_metrics', timeRange, {
      name: 'agent_utilization'
    })

    const conversationMetrics = PerformanceMonitor.getMetrics('business_metrics', timeRange, {
      name: 'conversation_duration'
    })

    return {
      customerSatisfaction: {
        current: this.calculateLatestValue(customerSatisfaction),
        trend: this.calculateTrend(customerSatisfaction, 'value'),
        target: 90
      },
      agentPerformance: {
        averageUtilization: this.calculateAverage(agentPerformance, 'value'),
        activeAgents: this.countActiveAgents(agentPerformance),
        productivity: this.calculateProductivityScore(agentPerformance)
      },
      conversationAnalytics: {
        totalConversations: this.countConversations(conversationMetrics),
        averageDuration: this.calculateAverage(conversationMetrics, 'value'),
        resolutionRate: this.calculateResolutionRate(conversationMetrics)
      }
    }
  }
}
```

## Log Management and Analysis

### Structured Logging System

```typescript
// Logger implementation from lib/logger.ts
export class Logger {
  private static instance: Logger
  private logBuffer: LogEntry[] = []
  private readonly maxBufferSize = 1000

  // Create singleton instance
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  // Log with structured data
  log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata: {
        ...metadata,
        correlation_id: this.getCorrelationId(),
        user_id: this.getCurrentUserId(),
        session_id: this.getSessionId(),
        request_id: this.getRequestId()
      }
    }

    // Add to buffer
    this.logBuffer.push(logEntry)
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift()
    }

    // Write to external log service
    this.writeToLogService(logEntry)

    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level.toUpperCase()}] ${message}`, metadata)
    }
  }

  // Specialized logging methods
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata)
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata)
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('error', message, {
      ...metadata,
      error_message: error?.message,
      error_stack: error?.stack,
      error_name: error?.name
    })
  }

  // Security event logging
  logSecurityEvent(event: SecurityEvent): void {
    this.log('warn', 'Security event detected', {
      event_type: event.type,
      severity: event.severity,
      source_ip: event.sourceIP,
      user_agent: event.userAgent,
      user_id: event.userId,
      resource: event.resource,
      action: event.action,
      result: event.result
    })
  }

  // Performance logging
  logPerformanceMetric(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.log('info', 'Performance metric', {
      operation,
      duration,
      ...metadata,
      performance_metric: true
    })
  }

  // Business event logging
  logBusinessEvent(eventType: string, eventData: Record<string, any>): void {
    this.log('info', 'Business event', {
      event_type: eventType,
      ...eventData,
      business_event: true
    })
  }
}
```

### Log Analysis and Search

```typescript
// Log analysis service from lib/monitoring/log-aggregator.ts
export class LogAnalysisService {
  // Search logs
  static async searchLogs(query: LogSearchQuery): Promise<LogSearchResult> {
    try {
      const response = await fetch(`${process.env.LOG_SERVICE_URL}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LOG_SERVICE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
      })

      if (!response.ok) {
        throw new Error(`Log search failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      logger.error('Log search failed', error)
      throw error
    }
  }

  // Analyze error patterns
  static async analyzeErrorPatterns(timeRange: string = '24h'): Promise<ErrorAnalysis> {
    const logs = await this.searchLogs({
      query: 'level:error',
      time_range: timeRange,
      limit: 1000
    })

    const errorGroups = this.groupErrorsByPattern(logs.entries)
    const topErrors = this.getTopErrors(errorGroups)
    const errorTrends = this.calculateErrorTrends(logs.entries)

    return {
      totalErrors: logs.entries.length,
      uniqueErrorPatterns: errorGroups.length,
      topErrors,
      errorTrends,
      recommendations: this.generateRecommendations(errorGroups)
    }
  }

  // Performance analysis
  static async analyzePerformance(timeRange: string = '1h'): Promise<PerformanceAnalysis> {
    const logs = await this.searchLogs({
      query: 'performance_metric:true',
      time_range: timeRange,
      limit: 5000
    })

    const operations = this.groupByOperation(logs.entries)
    const slowOperations = this.identifySlowOperations(operations)
    const performanceTrends = this.calculatePerformanceTrends(operations)

    return {
      totalOperations: logs.entries.length,
      averageResponseTime: this.calculateAverageResponseTime(operations),
      slowOperations,
      performanceTrends,
      recommendations: this.generatePerformanceRecommendations(slowOperations)
    }
  }

  // Real-time log monitoring
  static startRealTimeMonitoring(callback: (log: LogEntry) => void): () => void {
    const eventSource = new EventSource(`${process.env.LOG_SERVICE_URL}/stream`)

    eventSource.onmessage = (event) => {
      const logEntry = JSON.parse(event.data)
      callback(logEntry)
    }

    eventSource.onerror = (error) => {
      logger.error('Log streaming error', error)
    }

    return () => eventSource.close()
  }
}
```

## Monitoring Best Practices

### Alert Configuration Best Practices

```typescript
// Best practices for alert configuration
export const ALERT_BEST_PRACTICES = {
  // Set realistic thresholds
  thresholds: {
    use_historical_data: true,
    consider_business_hours: true,
    account_for_seasonal_patterns: true,
    implement_grace_periods: true
  },
  
  // Avoid alert fatigue
  alert_management: {
    use_cooldown_periods: true,
    group_related_alerts: true,
    prioritize_critical_alerts: true,
    implement_alert_escalation: true
  },
  
  // Test alert rules
  testing: {
    test_in_staging: true,
    verify_notification_delivery: true,
    validate_alert_conditions: true,
    test_escalation_paths: true
  }
}

// Example alert rule with best practices
const BEST_PRACTICE_ALERT_RULE: AlertRule = {
  id: 'api_performance_best_practice',
  name: 'API Performance Monitoring',
  severity: 'medium',
  condition: (metrics) => {
    // Use rolling average instead of single measurement
    const recentMetrics = getRecentMetrics('api_performance', '5m')
    const averageResponseTime = calculateAverage(recentMetrics, 'responseTime')
    
    // Consider time of day
    const hour = new Date().getHours()
    const isBusinessHours = hour >= 9 && hour <= 17
    
    // Different thresholds for business hours
    const threshold = isBusinessHours ? 1500 : 2500
    
    return averageResponseTime > threshold
  },
  message: (metrics) => `API response time is elevated: ${metrics.api?.averageResponseTime}ms`,
  channels: ['email', 'slack'],
  enabled: true,
  cooldown_minutes: 30, // Prevent alert spam
  escalation: {
    enabled: true,
    after_minutes: 60,
    channels: ['sms', 'whatsapp']
  }
}
```

### Performance Monitoring Best Practices

```typescript
// Performance monitoring configuration
export const PERFORMANCE_MONITORING_CONFIG = {
  // Focus on user-facing metrics
  key_metrics: [
    'api_response_time',
    'page_load_time',
    'database_query_time',
    'external_api_response_time'
  ],
  
  // Collect appropriate granularity
  sampling: {
    real_time_metrics: '5s',
    business_metrics: '1m',
    system_metrics: '30s'
  },
  
  // Retain metrics appropriately
  retention: {
    high_frequency: '7d',    // 5s, 30s, 1m metrics
    medium_frequency: '30d', // 5m, 15m metrics
    low_frequency: '1y'      // 1h, 1d metrics
  }
}

// Business hours aware monitoring
export class BusinessHoursMonitor {
  static isBusinessHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()
    
    // Monday-Friday, 9 AM - 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17
  }
  
  static getContextualThreshold(baseThreshold: number, metric: string): number {
    const isBusinessHours = this.isBusinessHours()
    const multiplier = isBusinessHours ? 0.8 : 1.2 // Tighter thresholds during business hours
    
    return baseThreshold * multiplier
  }
}
```

## Troubleshooting and Support

### Common Monitoring Issues

#### Alert Configuration Issues

```typescript
// Debug alert configuration
export class AlertDebugging {
  static async testAlertRule(ruleId: string): Promise<AlertTestResult> {
    const rule = AlertingSystem.getAlertRule(ruleId)
    if (!rule) {
      throw new Error('Alert rule not found')
    }

    // Get recent metrics
    const metrics = await SystemMonitor.getSystemMetrics()
    
    // Test condition
    const isTriggered = rule.condition(metrics)
    
    // Test notification channels
    const channelTestResults = await Promise.all(
      rule.channels.map(channel => this.testNotificationChannel(channel))
    )

    return {
      ruleId,
      conditionTest: {
        triggered: isTriggered,
        metrics: metrics,
        threshold: rule.threshold
      },
      notificationTests: channelTestResults,
      recommendations: this.generateRecommendations(rule, isTriggered, channelTestResults)
    }
  }

  static async debugMissingMetrics(metricType: string, timeRange: string): Promise<DebugResult> {
    const metrics = PerformanceMonitor.getMetrics(metricType, timeRange)
    
    if (metrics.length === 0) {
      return {
        issue: 'No metrics collected',
        possible_causes: [
          'Metrics collection not started',
          'Time range filter too restrictive',
          'Metric type configuration incorrect',
          'Data retention policy expired'
        ],
        debugging_steps: [
          'Check if metrics collection is running',
          'Verify metric configuration',
          'Check data retention settings',
          'Review application logs for collection errors'
        ]
      }
    }

    return {
      issue: null,
      metrics_found: metrics.length,
      time_range: timeRange,
      metric_type: metricType
    }
  }
}
```

#### Performance Issue Resolution

```typescript
// Performance issue diagnosis
export class PerformanceDiagnostics {
  // Diagnose slow API responses
  static async diagnoseSlowAPI(): Promise<PerformanceDiagnosis> {
    const recentMetrics = PerformanceMonitor.getMetrics('api_performance', '15m')
    const slowRequests = recentMetrics.filter(m => m.responseTime > 2000)
    
    if (slowRequests.length === 0) {
      return { issue: 'No slow requests found in the last 15 minutes' }
    }

    // Analyze patterns
    const endpointBreakdown = this.breakdownByEndpoint(slowRequests)
    const timeBreakdown = this.breakdownByTime(slowRequests)
    
    const diagnosis = {
      slow_requests: slowRequests.length,
      affected_endpoints: Object.keys(endpointBreakdown),
      time_pattern: timeBreakdown,
      possible_causes: this.identifyPossibleCauses(slowRequests),
      recommendations: this.generateRecommendations(slowRequests)
    }

    return diagnosis
  }

  // Database performance analysis
  static async analyzeDatabasePerformance(): Promise<DatabaseDiagnosis> {
    const dbMetrics = PerformanceMonitor.getMetrics('database_performance', '1h')
    const slowQueries = dbMetrics.filter(m => m.executionTime > 1000)
    
    // Check connection pool
    const connectionPool = await this.getConnectionPoolStatus()
    
    return {
      slow_queries: slowQueries.length,
      average_query_time: this.calculateAverage(dbMetrics, 'executionTime'),
      connection_pool_status: connectionPool,
      recommendations: [
        'Optimize slow queries',
        'Review index usage',
        'Check connection pool sizing',
        'Monitor query execution plans'
      ]
    }
  }

  // System resource analysis
  static async analyzeSystemResources(): Promise<SystemDiagnosis> {
    const systemMetrics = await SystemMonitor.getSystemMetrics()
    const { cpu, memory, disk } = systemMetrics

    const issues = []
    const recommendations = []

    if (cpu.usage > 80) {
      issues.push('High CPU usage')
      recommendations.push('Scale up CPU or optimize CPU-intensive operations')
    }

    if (memory.usage_percent > 85) {
      issues.push('High memory usage')
      recommendations.push('Scale up memory or optimize memory usage')
    }

    if (disk.usage_percent > 90) {
      issues.push('High disk usage')
      recommendations.push('Clean up disk space or increase disk capacity')
    }

    return {
      current_usage: { cpu: cpu.usage, memory: memory.usage_percent, disk: disk.usage_percent },
      issues,
      recommendations
    }
  }
}
```

This monitoring guide provides comprehensive information for maintaining optimal system performance and reliability through effective monitoring, alerting, and observability practices, reflecting the actual monitoring infrastructure implemented in the PrismAI platform.