import { createClient } from '@/lib/supabase/server'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogSource = 'api' | 'database' | 'auth' | 'external' | 'system' | 'application'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: LogSource
  message: string
  metadata: Record<string, any>
  user_id?: string
  session_id?: string
  request_id?: string
  ip_address?: string
  user_agent?: string
  error_stack?: string
  tags: string[]
}

export interface LogQuery {
  level?: LogLevel
  source?: LogSource
  user_id?: string
  session_id?: string
  request_id?: string
  start_time?: string
  end_time?: string
  search_term?: string
  tags?: string[]
  limit?: number
  offset?: number
}

export interface LogAnalytics {
  total_logs: number
  logs_by_level: Record<LogLevel, number>
  logs_by_source: Record<LogSource, number>
  error_rate: number
  top_errors: Array<{
    message: string
    count: number
    last_occurrence: string
  }>
  logs_over_time: Array<{
    timestamp: string
    count: number
    level: LogLevel
  }>
}

export class LogAggregator {
  private static instance: LogAggregator
  private logBuffer: LogEntry[] = []
  private readonly bufferSize = 100
  private flushInterval: NodeJS.Timeout | null = null

  static getInstance(): LogAggregator {
    if (!LogAggregator.instance) {
      LogAggregator.instance = new LogAggregator()
    }
    return LogAggregator.instance
  }

  constructor() {
    this.startPeriodicFlush()
  }

  /**
   * Log an entry
   */
  async log(
    level: LogLevel,
    source: LogSource,
    message: string,
    metadata: Record<string, any> = {},
    options?: {
      user_id?: string
      session_id?: string
      request_id?: string
      ip_address?: string
      user_agent?: string
      error_stack?: string
      tags?: string[]
    }
  ): Promise<void> {
    try {
      const logEntry: Omit<LogEntry, 'id'> = {
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
        metadata,
        user_id: options?.user_id,
        session_id: options?.session_id,
        request_id: options?.request_id,
        ip_address: options?.ip_address,
        user_agent: options?.user_agent,
        error_stack: options?.error_stack,
        tags: options?.tags || []
      }

      // Add to buffer for batch processing
      this.logBuffer.push({ ...logEntry, id: this.generateId() })

      // Flush if buffer is full
      if (this.logBuffer.length >= this.bufferSize) {
        await this.flush()
      }

      // Note: Removed circular dependency with logger
      // The log-aggregator now handles its own database logging

    } catch (error) {
      console.error('Failed to log entry:', error)
    }
  }

  /**
   * Query logs with filtering and pagination
   */
  async queryLogs(query: LogQuery): Promise<{
    logs: LogEntry[]
    total: number
    has_more: boolean
  }> {
    try {
      const supabase = await createClient()

      let dbQuery = supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })

      // Apply filters
      if (query.level) {
        dbQuery = dbQuery.eq('level', query.level)
      }

      if (query.source) {
        dbQuery = dbQuery.eq('source', query.source)
      }

      if (query.user_id) {
        dbQuery = dbQuery.eq('user_id', query.user_id)
      }

      if (query.session_id) {
        dbQuery = dbQuery.eq('session_id', query.session_id)
      }

      if (query.request_id) {
        dbQuery = dbQuery.eq('request_id', query.request_id)
      }

      if (query.start_time) {
        dbQuery = dbQuery.gte('timestamp', query.start_time)
      }

      if (query.end_time) {
        dbQuery = dbQuery.lte('timestamp', query.end_time)
      }

      if (query.search_term) {
        dbQuery = dbQuery.ilike('message', `%${query.search_term}%`)
      }

      if (query.tags && query.tags.length > 0) {
        dbQuery = dbQuery.overlaps('tags', query.tags)
      }

      // Apply pagination
      const limit = query.limit || 50
      const offset = query.offset || 0
      dbQuery = dbQuery.range(offset, offset + limit - 1)

      const { data, error, count } = await dbQuery

      if (error) throw error

      const logs: LogEntry[] = (data || []).map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        level: log.level,
        source: log.source,
        message: log.message,
        metadata: log.metadata || {},
        user_id: log.user_id,
        session_id: log.session_id,
        request_id: log.request_id,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        error_stack: log.error_stack,
        tags: log.tags || []
      }))

      return {
        logs,
        total: count || 0,
        has_more: (count || 0) > offset + limit
      }

    } catch (error) {
      console.error('Failed to query logs:', error)
      return { logs: [], total: 0, has_more: false }
    }
  }

  /**
   * Get log analytics
   */
  async getAnalytics(
    startTime: string,
    endTime: string,
    groupBy: 'hour' | 'day' = 'hour'
  ): Promise<LogAnalytics> {
    try {
      const supabase = await createClient()

      // Get total logs count
      const { count: totalLogs } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)

      // Get logs by level
      const levelPromises = (['debug', 'info', 'warn', 'error', 'fatal'] as LogLevel[]).map(async (level) => {
        const { count } = await supabase
          .from('system_logs')
          .select('*', { count: 'exact', head: true })
          .eq('level', level)
          .gte('timestamp', startTime)
          .lte('timestamp', endTime)
        return { level, count: count || 0 }
      })

      const levelResults = await Promise.all(levelPromises)
      const logsByLevel = levelResults.reduce((acc, { level, count }) => {
        acc[level] = count
        return acc
      }, {} as Record<LogLevel, number>)

      // Get logs by source
      const sourcePromises = (['api', 'database', 'auth', 'external', 'system', 'application'] as LogSource[]).map(async (source) => {
        const { count } = await supabase
          .from('system_logs')
          .select('*', { count: 'exact', head: true })
          .eq('source', source)
          .gte('timestamp', startTime)
          .lte('timestamp', endTime)
        return { source, count: count || 0 }
      })

      const sourceResults = await Promise.all(sourcePromises)
      const logsBySource = sourceResults.reduce((acc, { source, count }) => {
        acc[source] = count
        return acc
      }, {} as Record<LogSource, number>)

      // Calculate error rate
      const totalErrors = logsByLevel.error + logsByLevel.fatal
      const errorRate = totalLogs && totalLogs > 0 ? (totalErrors / totalLogs) * 100 : 0

      // Get top errors
      const { data: errorLogs } = await supabase
        .from('system_logs')
        .select('message, timestamp')
        .in('level', ['error', 'fatal'])
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)
        .order('timestamp', { ascending: false })
        .limit(100)

      const errorCounts: Record<string, { count: number; last_occurrence: string }> = {}
      for (const log of errorLogs || []) {
        const key = log.message.substring(0, 100) // Truncate for grouping
        if (!errorCounts[key]) {
          errorCounts[key] = { count: 0, last_occurrence: log.timestamp }
        }
        errorCounts[key].count++
        if (new Date(log.timestamp) > new Date(errorCounts[key].last_occurrence)) {
          errorCounts[key].last_occurrence = log.timestamp
        }
      }

      const topErrors = Object.entries(errorCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 10)
        .map(([message, data]) => ({
          message,
          count: data.count,
          last_occurrence: data.last_occurrence
        }))

      // Get logs over time
      const logsOverTime = await this.getLogsOverTime(startTime, endTime, groupBy)

      return {
        total_logs: totalLogs || 0,
        logs_by_level: logsByLevel,
        logs_by_source: logsBySource,
        error_rate: Math.round(errorRate * 100) / 100,
        top_errors: topErrors,
        logs_over_time: logsOverTime
      }

    } catch (error) {
      console.error('Failed to get log analytics:', error)
      return {
        total_logs: 0,
        logs_by_level: { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 },
        logs_by_source: { api: 0, database: 0, auth: 0, external: 0, system: 0, application: 0 },
        error_rate: 0,
        top_errors: [],
        logs_over_time: []
      }
    }
  }

  /**
   * Clean up old logs (keep last 30 days)
   */
  async cleanupOldLogs(): Promise<void> {
    try {
      const supabase = await createClient()

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { error } = await supabase
        .from('system_logs')
        .delete()
        .lt('timestamp', thirtyDaysAgo.toISOString())

      if (error) throw error

      console.info('Cleaned up old system logs', { cutoff_date: thirtyDaysAgo.toISOString() })

    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
    }
  }

  /**
   * Flush buffered logs to database
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return

    try {
      const supabase = await createClient()

      const logsToInsert = this.logBuffer.map(log => ({
        level: log.level,
        source: log.source,
        message: log.message,
        metadata: log.metadata,
        user_id: log.user_id,
        session_id: log.session_id,
        request_id: log.request_id,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        error_stack: log.error_stack,
        tags: log.tags,
        timestamp: log.timestamp
      }))

      const { error } = await supabase
        .from('system_logs')
        .insert(logsToInsert)

      if (error) throw error

      this.logBuffer = []

    } catch (error) {
      console.error('Failed to flush logs to database:', error)
      // Keep logs in buffer for retry
    }
  }

  /**
   * Start periodic flush of buffered logs
   */
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      await this.flush()
    }, 30000) // Flush every 30 seconds
  }

  /**
   * Stop periodic flush
   */
  stopPeriodicFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
  }

  /**
   * Get logs over time for analytics
   */
  private async getLogsOverTime(
    startTime: string,
    endTime: string,
    groupBy: 'hour' | 'day'
  ): Promise<Array<{ timestamp: string; count: number; level: LogLevel }>> {
    try {
      const supabase = await createClient()

      // This is a simplified implementation
      // In production, you might want to use database-specific time bucketing functions
      const { data } = await supabase
        .from('system_logs')
        .select('timestamp, level')
        .gte('timestamp', startTime)
        .lte('timestamp', endTime)
        .order('timestamp', { ascending: true })

      const timeBuckets: Record<string, Record<LogLevel, number>> = {}

      for (const log of data || []) {
        const date = new Date(log.timestamp)
        let bucketKey: string

        if (groupBy === 'hour') {
          bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
        } else {
          bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        }

        if (!timeBuckets[bucketKey]) {
          timeBuckets[bucketKey] = { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 }
        }

        timeBuckets[bucketKey][log.level as LogLevel]++
      }

      const result: Array<{ timestamp: string; count: number; level: LogLevel }> = []

      for (const [timestamp, levels] of Object.entries(timeBuckets)) {
        for (const [level, count] of Object.entries(levels) as [LogLevel, number][]) {
          if (count > 0) {
            result.push({ timestamp, count, level })
          }
        }
      }

      return result.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    } catch (error) {
      console.error('Failed to get logs over time:', error)
      return []
    }
  }

  /**
   * Generate unique ID for log entry
   */
  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const logAggregator = LogAggregator.getInstance()