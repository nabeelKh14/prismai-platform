# PrismAI Monitoring & Alerting Guide

## Overview

This guide provides comprehensive information about monitoring, alerting, and observability features in the PrismAI platform. The system includes real-time monitoring, performance metrics, health checks, and intelligent alerting to ensure optimal system performance and reliability.

## Monitoring Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Metrics       │    │   Health        │    │   Alerting      │
│   Collection    │◄──►│   Checks        │◄──►│   System        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Performance   │    │   System        │    │   Notification  │
│   Monitor       │    │   Monitor       │    │   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Monitoring Components

#### 1. Performance Monitor
- **API Response Times**: Track endpoint performance
- **Database Queries**: Monitor query execution times
- **External Services**: Monitor third-party API calls
- **Resource Usage**: CPU, memory, disk utilization

#### 2. System Health Monitor
- **Application Health**: Core service availability
- **Database Connectivity**: Connection pool status
- **External Dependencies**: AI services, communication APIs
- **Infrastructure**: Server resources and network

#### 3. Alerting System
- **Rule-based Alerts**: Configurable alert conditions
- **Multi-channel Notifications**: Email, Slack, SMS, WhatsApp
- **Alert Escalation**: Priority-based alert handling
- **Alert Management**: Acknowledge, resolve, and track alerts

## Health Check System

### Health Check Endpoints

#### Application Health
**GET** `/api/v1/health`

Returns overall system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "2.0.0",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "ai_services": "healthy",
    "external_apis": "healthy"
  },
  "uptime": "7d 12h 30m",
  "response_time": "45ms"
}
```

#### Database Health
**GET** `/api/v1/health/database`

Checks database connectivity and performance.

**Response:**
```json
{
  "status": "healthy",
  "connection_count": 5,
  "active_queries": 2,
  "connection_pool": {
    "active": 3,
    "idle": 7,
    "waiting": 0
  },
  "performance": {
    "avg_query_time": "12ms",
    "slow_queries": 0
  }
}
```

#### External Services Health
**GET** `/api/v1/health/services`

Monitors external service dependencies.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "gemini_api": {
      "status": "healthy",
      "response_time": "120ms",
      "last_check": "2024-01-01T00:00:00Z"
    },
    "elevenlabs_api": {
      "status": "healthy",
      "response_time": "85ms",
      "last_check": "2024-01-01T00:00:00Z"
    },
    "twilio_api": {
      "status": "healthy",
      "response_time": "45ms",
      "last_check": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Health Check Configuration

#### Custom Health Checks

```typescript
// Add custom health check
import { healthCheckService } from '@/lib/monitoring/health-check-service'

healthCheckService.addCheck({
  name: 'custom_service',
  check: async () => {
    // Custom health check logic
    const response = await fetch('https://api.example.com/health')
    return response.ok ? 'healthy' : 'unhealthy'
  },
  timeout: 5000,
  retry: 3
})
```

#### Health Check Thresholds

```typescript
// Configure health check thresholds
export const healthCheckConfig = {
  timeout: 10000,        // 10 seconds
  retries: 3,            // Retry 3 times
  interval: 30000,       // Check every 30 seconds
  thresholds: {
    response_time_warning: 1000,   // 1 second
    response_time_critical: 5000,  // 5 seconds
    error_rate_warning: 5,         // 5%
    error_rate_critical: 10        // 10%
  }
}
```

## Performance Monitoring

### Metrics Collection

#### API Performance Metrics

```typescript
// API endpoint monitoring
const apiMetrics = {
  endpoint: '/api/chat',
  method: 'POST',
  response_time: 150,    // milliseconds
  status_code: 200,
  user_id: 'user123',
  timestamp: new Date()
}

// Track API metrics
performanceMonitor.recordMetric('api_response', {
  endpoint: apiMetrics.endpoint,
  method: apiMetrics.method,
  response_time: apiMetrics.response_time,
  status_code: apiMetrics.status_code,
  user_id: apiMetrics.user_id
})
```

#### Database Performance Metrics

```typescript
// Database query monitoring
const dbMetrics = {
  query: 'SELECT * FROM conversations WHERE user_id = $1',
  execution_time: 25,    // milliseconds
  row_count: 150,
  connection_pool: 8,
  timestamp: new Date()
}

// Track database metrics
performanceMonitor.recordMetric('database_query', {
  query_type: 'SELECT',
  execution_time: dbMetrics.execution_time,
  row_count: dbMetrics.row_count,
  connection_pool: dbMetrics.connection_pool
})
```

#### System Resource Metrics

```typescript
// System resource monitoring
const systemMetrics = {
  cpu_usage: 45.2,       // percentage
  memory_usage: 67.8,    // percentage
  disk_usage: 34.1,      // percentage
  network_io: 125000,    // bytes per second
  timestamp: new Date()
}

// Track system metrics
performanceMonitor.recordMetric('system_resources', systemMetrics)
```

### Performance Dashboards

#### Real-time Dashboard

The platform provides real-time performance dashboards accessible through:

- **Web Interface**: `/dashboard/monitoring`
- **API Endpoint**: `/api/v1/metrics/dashboard`
- **External Tools**: Prometheus/Grafana integration

#### Dashboard Components

1. **System Overview**
   - CPU, memory, disk utilization
   - Network I/O and throughput
   - Active connections and sessions

2. **Application Performance**
   - API response times and error rates
   - Database query performance
   - Cache hit rates and efficiency

3. **Business Metrics**
   - Active conversations and queue length
   - Agent availability and performance
   - Customer satisfaction scores

4. **AI Services Performance**
   - Gemini API response times
   - ElevenLabs TTS processing
   - VAPI voice AI metrics

## Alerting System

### Alert Types and Severity

#### System Alerts

| Alert Type | Description | Severity | Threshold |
|------------|-------------|----------|-----------|
| `system_down` | Core system unavailable | Critical | Service unavailable |
| `high_error_rate` | API errors exceed threshold | High | >5% error rate |
| `slow_performance` | Response times too slow | Medium | >5s average |
| `resource_exhaustion` | System resources depleted | High | >85% utilization |
| `database_issue` | Database connectivity problems | Critical | Connection failure |
| `external_service_down` | Third-party service failure | High | Service unavailable |
| `security_threat` | Security incidents detected | Critical | Suspicious activity |

#### Business Alerts

| Alert Type | Description | Severity | Threshold |
|------------|-------------|----------|-----------|
| `high_queue_length` | Chat queue too long | Medium | >10 waiting |
| `agent_availability` | Low agent availability | High | <50% online |
| `customer_satisfaction` | Low satisfaction scores | Medium | <80% satisfaction |
| `conversation_volume` | Unusual traffic patterns | Low | >2x normal volume |

### Alert Configuration

#### Creating Custom Alert Rules

```typescript
// Add custom alert rule
alertingSystem.addAlertRule({
  name: 'Custom API Performance Alert',
  type: 'slow_performance',
  severity: 'medium',
  condition: (metrics) => metrics.avg_response_time > 3000,
  message: (metrics) => `API response time is ${metrics.avg_response_time}ms`,
  channels: ['email', 'slack'],
  enabled: true,
  cooldown_minutes: 15
})
```

#### Alert Channels

1. **Email Notifications**
   - Configurable recipients
   - HTML and plain text formats
   - Priority-based subject lines

2. **Slack Integration**
   - Rich message formatting
   - Channel and user mentions
   - Interactive buttons for acknowledgment

3. **SMS Notifications**
   - Critical alerts only
   - Rate-limited to prevent spam
   - Emergency contact numbers

4. **WhatsApp Messages**
   - Rich media support
   - Group notifications
   - Quick acknowledgment

5. **Webhook Notifications**
   - Custom integrations
   - JSON payload delivery
   - Retry logic for failed deliveries

### Alert Management

#### Acknowledging Alerts

```typescript
// Acknowledge alert via API
const response = await fetch('/api/v1/alerts/acknowledge', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    alert_id: 'alert123',
    user_id: 'user456'
  })
})
```

#### Resolving Alerts

```typescript
// Resolve alert via API
const response = await fetch('/api/v1/alerts/resolve', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    alert_id: 'alert123'
  })
})
```

#### Alert History

```typescript
// Get alert history
const response = await fetch('/api/v1/alerts/history?limit=100&status=resolved', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
})

const alerts = await response.json()
```

## Metrics and Analytics

### Key Performance Indicators (KPIs)

#### System KPIs

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Response Time** | Average API response time | <500ms | >2000ms |
| **Error Rate** | Percentage of failed requests | <1% | >5% |
| **Throughput** | Requests per minute | Variable | N/A |
| **Uptime** | System availability | 99.9% | <99.5% |
| **CPU Usage** | System CPU utilization | <70% | >85% |
| **Memory Usage** | System memory utilization | <80% | >90% |

#### Business KPIs

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Queue Length** | Waiting conversations | <5 | >20 |
| **Resolution Time** | Average conversation duration | <10min | >30min |
| **Agent Utilization** | Agent chat capacity | 70-90% | <50% or >95% |
| **Customer Satisfaction** | CSAT score | >90% | <80% |
| **First Response Time** | Time to first agent response | <2min | >5min |

### Metrics Collection

#### Prometheus Integration

```yaml
# Prometheus scraping configuration
scrape_configs:
  - job_name: 'prismai'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 15s
    metrics_path: '/api/v1/metrics/prometheus'
    params:
      format: ['prometheus']
```

#### Custom Metrics

```typescript
// Record custom business metric
performanceMonitor.recordMetric('business_kpi', {
  metric_name: 'customer_satisfaction',
  value: 92.5,
  timestamp: new Date(),
  metadata: {
    period: 'daily',
    sample_size: 150
  }
})

// Record AI service metrics
performanceMonitor.recordMetric('ai_service', {
  service: 'gemini',
  operation: 'chat_completion',
  response_time: 120,
  tokens_used: 150,
  success: true
})
```

### Analytics Dashboard

#### Dashboard Features

1. **Real-time Charts**
   - Live updating graphs
   - Customizable time ranges
   - Multiple chart types (line, bar, pie)

2. **Historical Analysis**
   - Trend analysis over time
   - Comparative period analysis
   - Anomaly detection

3. **Drill-down Capabilities**
   - Detailed metric breakdowns
   - Filter by dimensions
   - Export functionality

4. **Custom Reports**
   - Scheduled report generation
   - Email delivery
   - PDF/CSV export options

## Log Management

### Application Logging

#### Log Levels

```typescript
// Configure log levels
export const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'magenta'
  }
}
```

#### Structured Logging

```typescript
// Structured log entry
logger.info('User action performed', {
  user_id: 'user123',
  action: 'login',
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0...',
  timestamp: new Date(),
  duration: 150,
  success: true
})
```

### Log Aggregation

#### Centralized Logging

```typescript
// Configure centralized logging
export const centralizedLogging = {
  enabled: true,
  endpoint: 'https://logs.example.com/api/v1/logs',
  api_key: process.env.LOG_AGGREGATOR_API_KEY,
  batch_size: 100,
  flush_interval: 5000,
  retry_attempts: 3
}
```

#### Log Search and Analysis

```typescript
// Search logs
const logs = await logService.search({
  query: 'ERROR AND user_id:user123',
  time_range: {
    start: '2024-01-01T00:00:00Z',
    end: '2024-01-02T00:00:00Z'
  },
  limit: 100,
  sort: 'timestamp_desc'
})
```

## Monitoring Best Practices

### Alert Configuration Best Practices

1. **Set Appropriate Thresholds**
   - Use historical data to set realistic thresholds
   - Consider normal business hour variations
   - Account for seasonal traffic patterns

2. **Avoid Alert Fatigue**
   - Use alert cooldown periods
   - Group related alerts
   - Prioritize critical alerts

3. **Test Alert Rules**
   - Test alerts in staging environment
   - Verify notification delivery
   - Validate alert conditions

### Performance Monitoring Best Practices

1. **Monitor Key Metrics**
   - Focus on user-facing performance
   - Track business-critical operations
   - Monitor resource utilization

2. **Set Up Baselines**
   - Establish normal performance baselines
   - Track performance trends over time
   - Identify seasonal patterns

3. **Use Appropriate Tools**
   - Leverage built-in monitoring features
   - Integrate with external monitoring tools
   - Set up automated alerting

### Security Monitoring Best Practices

1. **Monitor Security Events**
   - Track authentication failures
   - Monitor suspicious activities
   - Alert on security policy violations

2. **Log Security Events**
   - Log all security-related events
   - Store logs securely
   - Implement log retention policies

3. **Regular Security Audits**
   - Review security logs regularly
   - Conduct periodic security assessments
   - Update security configurations

## Troubleshooting

### Common Monitoring Issues

#### False Positives

```typescript
// Adjust alert thresholds
alertingSystem.updateAlertRule('high_error_rate', {
  condition: (metrics) => metrics.error_rate > 10, // Increased from 5
  cooldown_minutes: 60 // Increased from 30
})
```

#### Missing Metrics

```typescript
// Check metrics collection
const metrics = await performanceMonitor.getMetrics('api_response', '1h')
if (metrics.length === 0) {
  // Investigate metrics collection
  logger.warn('No metrics collected for api_response in the last hour')
}
```

#### Alert Delivery Issues

```typescript
// Test notification channels
await notificationService.testChannel('email', 'admin@example.com')
await notificationService.testChannel('slack', '#alerts')
```

### Performance Issues

#### Slow Response Times

```typescript
// Analyze slow queries
const slowQueries = await performanceMonitor.getSlowQueries(1000) // >1s
slowQueries.forEach(query => {
  logger.warn('Slow query detected', {
    query: query.sql,
    duration: query.execution_time,
    timestamp: query.timestamp
  })
})
```

#### High Resource Usage

```typescript
// Monitor resource usage
const resourceMetrics = await performanceMonitor.getResourceMetrics()
if (resourceMetrics.memory_usage > 90) {
  // Trigger memory optimization
  await memoryOptimizer.optimize()
}
```

## Integration with External Tools

### Prometheus Integration

```yaml
# Prometheus configuration for PrismAI
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prismai'
    static_configs:
      - targets: ['prismai-app:3000']
    metrics_path: '/api/v1/metrics/prometheus'
    params:
      format: ['prometheus']
```

### Grafana Integration

```json
{
  "dashboard": {
    "title": "PrismAI Performance Dashboard",
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "prismai_api_response_time_seconds",
            "legendFormat": "{{endpoint}}"
          }
        ]
      },
      {
        "title": "Active Conversations",
        "type": "stat",
        "targets": [
          {
            "expr": "prismai_active_conversations",
            "legendFormat": "Active"
          }
        ]
      }
    ]
  }
}
```

### ELK Stack Integration

```json
{
  "logstash": {
    "input": {
      "http": {
        "port": 8080,
        "codec": "json"
      }
    },
    "output": {
      "elasticsearch": {
        "hosts": ["localhost:9200"]
      }
    }
  }
}
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Daily**
   - Review active alerts
   - Check system performance
   - Monitor resource utilization

2. **Weekly**
   - Review alert configurations
   - Analyze performance trends
   - Update monitoring thresholds

3. **Monthly**
   - Security log review
   - Performance optimization
   - Monitoring system updates

### Support Channels

- **Documentation**: [https://docs.prismai.com/monitoring](https://docs.prismai.com/monitoring)
- **Community**: [https://community.prismai.com/monitoring](https://community.prismai.com/monitoring)
- **Support**: monitoring@prismai.com
- **Emergency**: emergency-monitoring@prismai.com

This monitoring guide provides comprehensive information for maintaining optimal system performance and reliability through effective monitoring, alerting, and observability practices.