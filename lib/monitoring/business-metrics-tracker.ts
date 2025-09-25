import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { performanceMonitor } from './performance-monitor'

export interface BusinessMetric {
  id: string
  metric_type: 'user_activity' | 'api_usage' | 'error_tracking' | 'feature_usage' | 'conversion' | 'retention' | 'revenue'
  value: number
  unit: string
  timestamp: string
  metadata: Record<string, any>
  tags: Record<string, string>
}

export interface UserActivityEvent {
  user_id?: string
  session_id: string
  event_type: 'page_view' | 'button_click' | 'form_submit' | 'feature_use' | 'session_start' | 'session_end'
  event_name: string
  page_url?: string
  element_id?: string
  metadata?: Record<string, any>
  timestamp: string
}

export interface APIUsageEvent {
  endpoint: string
  method: string
  user_id?: string
  api_key?: string
  response_time_ms: number
  status_code: number
  request_size_bytes?: number
  response_size_bytes?: number
  timestamp: string
}

export interface ErrorEvent {
  error_type: 'javascript' | 'api' | 'network' | 'validation' | 'authentication' | 'authorization'
  error_message: string
  error_stack?: string
  user_id?: string
  page_url?: string
  user_agent?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, any>
  timestamp: string
}

export interface FeatureUsageEvent {
  feature_name: string
  user_id?: string
  session_id: string
  usage_duration_ms?: number
  usage_count: number
  metadata?: Record<string, any>
  timestamp: string
}

export class BusinessMetricsTracker {
  private static instance: BusinessMetricsTracker
  private eventBuffer: (UserActivityEvent | APIUsageEvent | ErrorEvent | FeatureUsageEvent)[] = []
  private readonly bufferSize = 100
  private readonly flushInterval = 30000 // 30 seconds

  static getInstance(): BusinessMetricsTracker {
    if (!BusinessMetricsTracker.instance) {
      BusinessMetricsTracker.instance = new BusinessMetricsTracker()
    }
    return BusinessMetricsTracker.instance
  }

  constructor() {
    this.startPeriodicFlush()
  }

  /**
   * Track user activity event
   */
  async trackUserActivity(event: UserActivityEvent): Promise<void> {
    try {
      this.eventBuffer.push(event)

      // Record as business metric
      const metric: Omit<BusinessMetric, 'id'> = {
        metric_type: 'user_activity',
        value: 1,
        unit: 'event',
        timestamp: event.timestamp,
        metadata: {
          event_type: event.event_type,
          event_name: event.event_name,
          page_url: event.page_url,
          element_id: event.element_id,
          user_id: event.user_id,
          session_id: event.session_id,
          ...event.metadata
        },
        tags: {
          event_type: event.event_type,
          event_name: event.event_name,
          user_id: event.user_id || 'anonymous',
          session_id: event.session_id
        }
      }

      await this.storeBusinessMetric(metric)

      // Flush buffer if it's getting full
      if (this.eventBuffer.length >= this.bufferSize) {
        await this.flushBuffer()
      }

    } catch (error) {
      logger.error('Failed to track user activity', { error, event })
    }
  }

  /**
   * Track API usage event
   */
  async trackAPIUsage(event: APIUsageEvent): Promise<void> {
    try {
      this.eventBuffer.push(event)

      // Record API performance metrics
      await performanceMonitor.recordAPIMetric({
        endpoint: event.endpoint,
        method: event.method,
        response_time_ms: event.response_time_ms,
        status_code: event.status_code,
        user_agent: 'system', // API usage tracking
        timestamp: event.timestamp
      })

      // Record as business metric
      const metric: Omit<BusinessMetric, 'id'> = {
        metric_type: 'api_usage',
        value: 1,
        unit: 'request',
        timestamp: event.timestamp,
        metadata: {
          endpoint: event.endpoint,
          method: event.method,
          status_code: event.status_code,
          response_time_ms: event.response_time_ms,
          request_size_bytes: event.request_size_bytes,
          response_size_bytes: event.response_size_bytes,
          user_id: event.user_id,
          api_key: event.api_key
        },
        tags: {
          endpoint: event.endpoint,
          method: event.method,
          status_code: event.status_code.toString(),
          user_id: event.user_id || 'anonymous'
        }
      }

      await this.storeBusinessMetric(metric)

    } catch (error) {
      logger.error('Failed to track API usage', { error, event })
    }
  }

  /**
   * Track error event
   */
  async trackError(event: ErrorEvent): Promise<void> {
    try {
      this.eventBuffer.push(event)

      // Record error rate metric
      await performanceMonitor.recordErrorRate(1, 1, 1, event.timestamp)

      // Record as business metric
      const metric: Omit<BusinessMetric, 'id'> = {
        metric_type: 'error_tracking',
        value: 1,
        unit: 'error',
        timestamp: event.timestamp,
        metadata: {
          error_type: event.error_type,
          error_message: event.error_message,
          error_stack: event.error_stack,
          severity: event.severity,
          page_url: event.page_url,
          user_agent: event.user_agent,
          user_id: event.user_id,
          ...event.context
        },
        tags: {
          error_type: event.error_type,
          severity: event.severity,
          user_id: event.user_id || 'anonymous'
        }
      }

      await this.storeBusinessMetric(metric)

      // Log error for immediate attention
      logger.error('Business error tracked', {
        error_type: event.error_type,
        error_message: event.error_message,
        severity: event.severity,
        user_id: event.user_id
      })

    } catch (error) {
      logger.error('Failed to track error', { error, event })
    }
  }

  /**
   * Track feature usage event
   */
  async trackFeatureUsage(event: FeatureUsageEvent): Promise<void> {
    try {
      this.eventBuffer.push(event)

      // Record as business metric
      const metric: Omit<BusinessMetric, 'id'> = {
        metric_type: 'feature_usage',
        value: event.usage_count,
        unit: 'usage',
        timestamp: event.timestamp,
        metadata: {
          feature_name: event.feature_name,
          usage_duration_ms: event.usage_duration_ms,
          usage_count: event.usage_count,
          user_id: event.user_id,
          session_id: event.session_id,
          ...event.metadata
        },
        tags: {
          feature_name: event.feature_name,
          user_id: event.user_id || 'anonymous',
          session_id: event.session_id
        }
      }

      await this.storeBusinessMetric(metric)

    } catch (error) {
      logger.error('Failed to track feature usage', { error, event })
    }
  }

  /**
   * Get business metrics with filtering
   */
  async getBusinessMetrics(
    metricType?: BusinessMetric['metric_type'],
    startTime?: string,
    endTime?: string,
    tags?: Record<string, string>,
    limit: number = 100
  ): Promise<BusinessMetric[]> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('business_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (metricType) {
        query = query.eq('metric_type', metricType)
      }

      if (startTime) {
        query = query.gte('timestamp', startTime)
      }

      if (endTime) {
        query = query.lte('timestamp', endTime)
      }

      if (tags) {
        for (const [key, value] of Object.entries(tags)) {
          query = query.eq(`tags->>${key}`, value)
        }
      }

      const { data, error } = await query

      if (error) throw error

      return (data || []).map(metric => ({
        id: metric.id,
        metric_type: metric.metric_type,
        value: metric.value,
        unit: metric.unit,
        timestamp: metric.timestamp,
        metadata: metric.metadata || {},
        tags: metric.tags || {}
      }))

    } catch (error) {
      logger.error('Failed to get business metrics', { error })
      return []
    }
  }

  /**
   * Get aggregated business statistics
   */
  async getAggregatedBusinessStats(
    metricType: BusinessMetric['metric_type'],
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    count: number
    total: number
    average: number
    min: number
    max: number
    unique_users: number
    unique_sessions: number
  }> {
    try {
      const supabase = await createClient()

      // Calculate time range
      const now = new Date()
      const startTime = new Date()

      switch (timeRange) {
        case '1h':
          startTime.setHours(now.getHours() - 1)
          break
        case '24h':
          startTime.setDate(now.getDate() - 1)
          break
        case '7d':
          startTime.setDate(now.getDate() - 7)
          break
        case '30d':
          startTime.setMonth(now.getMonth() - 1)
          break
      }

      const { data, error } = await supabase
        .from('business_metrics')
        .select('value, metadata')
        .eq('metric_type', metricType)
        .gte('timestamp', startTime.toISOString())

      if (error) throw error

      const values = (data || []).map(d => d.value)
      const uniqueUsers = new Set(
        (data || [])
          .map(d => d.metadata?.user_id)
          .filter(Boolean)
      ).size

      const uniqueSessions = new Set(
        (data || [])
          .map(d => d.metadata?.session_id)
          .filter(Boolean)
      ).size

      if (values.length === 0) {
        return {
          count: 0,
          total: 0,
          average: 0,
          min: 0,
          max: 0,
          unique_users: 0,
          unique_sessions: 0
        }
      }

      const total = values.reduce((sum, val) => sum + val, 0)
      const average = total / values.length
      const min = Math.min(...values)
      const max = Math.max(...values)

      return {
        count: values.length,
        total: Math.round(total * 100) / 100,
        average: Math.round(average * 100) / 100,
        min,
        max,
        unique_users: uniqueUsers,
        unique_sessions: uniqueSessions
      }

    } catch (error) {
      logger.error('Failed to get aggregated business stats', { error })
      return {
        count: 0,
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        unique_users: 0,
        unique_sessions: 0
      }
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    total_users: number
    active_users: number
    sessions_per_user: number
    average_session_duration: number
    bounce_rate: number
    page_views_per_session: number
  }> {
    try {
      const userActivityStats = await this.getAggregatedBusinessStats('user_activity', timeRange)
      const sessionStats = await this.getAggregatedBusinessStats('feature_usage', timeRange)

      // Calculate engagement metrics
      const totalUsers = userActivityStats.unique_users
      const totalSessions = userActivityStats.unique_sessions
      const sessionsPerUser = totalUsers > 0 ? totalSessions / totalUsers : 0

      // Estimate session duration (simplified)
      const averageSessionDuration = sessionStats.average * 60 // Convert to seconds

      // Estimate bounce rate (simplified - sessions with only one event)
      const bounceRate = sessionsPerUser > 0 ? 1 / sessionsPerUser * 100 : 0

      // Estimate page views per session
      const pageViewsPerSession = userActivityStats.average

      return {
        total_users: totalUsers,
        active_users: userActivityStats.unique_users,
        sessions_per_user: Math.round(sessionsPerUser * 100) / 100,
        average_session_duration: Math.round(averageSessionDuration),
        bounce_rate: Math.round(bounceRate * 100) / 100,
        page_views_per_session: Math.round(pageViewsPerSession * 100) / 100
      }

    } catch (error) {
      logger.error('Failed to get user engagement metrics', { error })
      return {
        total_users: 0,
        active_users: 0,
        sessions_per_user: 0,
        average_session_duration: 0,
        bounce_rate: 0,
        page_views_per_session: 0
      }
    }
  }

  /**
   * Get API usage analytics
   */
  async getAPIUsageAnalytics(
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    total_requests: number
    unique_endpoints: number
    error_rate: number
    average_response_time: number
    top_endpoints: Array<{ endpoint: string; count: number; avg_response_time: number }>
    usage_by_hour: Array<{ hour: number; count: number }>
  }> {
    try {
      const apiStats = await this.getAggregatedBusinessStats('api_usage', timeRange)

      // Get top endpoints
      const supabase = await createClient()
      const { data: endpointData } = await supabase
        .from('business_metrics')
        .select('metadata')
        .eq('metric_type', 'api_usage')
        .gte('timestamp', new Date(Date.now() - this.parseTimeRange(timeRange)).toISOString())

      const endpointCounts = new Map<string, { count: number; totalResponseTime: number }>()
      ;(endpointData || []).forEach(item => {
        const endpoint = item.metadata?.endpoint
        const responseTime = item.metadata?.response_time_ms || 0
        if (endpoint) {
          const existing = endpointCounts.get(endpoint) || { count: 0, totalResponseTime: 0 }
          endpointCounts.set(endpoint, {
            count: existing.count + 1,
            totalResponseTime: existing.totalResponseTime + responseTime
          })
        }
      })

      const topEndpoints = Array.from(endpointCounts.entries())
        .map(([endpoint, stats]) => ({
          endpoint,
          count: stats.count,
          avg_response_time: stats.count > 0 ? stats.totalResponseTime / stats.count : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Get usage by hour (simplified)
      const usageByHour = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: Math.floor(Math.random() * 100) // Placeholder - would calculate from actual data
      }))

      return {
        total_requests: apiStats.count,
        unique_endpoints: endpointCounts.size,
        error_rate: 0, // Would calculate from error tracking data
        average_response_time: apiStats.average,
        top_endpoints: topEndpoints,
        usage_by_hour: usageByHour
      }

    } catch (error) {
      logger.error('Failed to get API usage analytics', { error })
      return {
        total_requests: 0,
        unique_endpoints: 0,
        error_rate: 0,
        average_response_time: 0,
        top_endpoints: [],
        usage_by_hour: []
      }
    }
  }

  /**
   * Store business metric in database
   */
  private async storeBusinessMetric(metric: Omit<BusinessMetric, 'id'>): Promise<void> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('business_metrics')
        .insert({
          metric_type: metric.metric_type,
          value: metric.value,
          unit: metric.unit,
          timestamp: metric.timestamp,
          metadata: metric.metadata,
          tags: metric.tags
        })

      if (error) throw error

    } catch (error) {
      logger.error('Failed to store business metric', { error, metric })
      throw error
    }
  }

  /**
   * Flush event buffer to database
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return

    try {
      const events = [...this.eventBuffer]
      this.eventBuffer = []

      // Store events in batches
      const batchSize = 50
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize)

        // Convert events to metrics and store
        const metrics = batch.map(event => {
          // This is a simplified conversion - in production you'd have specific tables for each event type
          return {
            metric_type: 'user_activity' as const,
            value: 1,
            unit: 'event',
            timestamp: (event as any).timestamp,
            metadata: event,
            tags: { event_type: (event as any).event_type || 'unknown' }
          }
        })

        await Promise.all(metrics.map(metric => this.storeBusinessMetric(metric)))
      }

      logger.info('Flushed business metrics buffer', { event_count: events.length })

    } catch (error) {
      logger.error('Failed to flush business metrics buffer', { error })
    }
  }

  /**
   * Start periodic buffer flush
   */
  private startPeriodicFlush(): void {
    setInterval(async () => {
      await this.flushBuffer()
    }, this.flushInterval)
  }

  /**
   * Parse time range to milliseconds
   */
  private parseTimeRange(timeRange: string): number {
    const unit = timeRange.slice(-1)
    const value = parseInt(timeRange.slice(0, -1))

    switch (unit) {
      case 'h': return value * 60 * 60 * 1000
      case 'd': return value * 24 * 60 * 60 * 1000
      default: return 60 * 60 * 1000 // default 1 hour
    }
  }
}

// Export singleton instance
export const businessMetricsTracker = BusinessMetricsTracker.getInstance()