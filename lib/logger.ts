import { getEnv, isProduction } from '@/lib/env'

import { createClient as createBrowserClient } from '@/lib/supabase/client'

// Function to get the Supabase client (client-side only for logging)
async function getSupabaseClient() {
  return createBrowserClient()
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  userId?: string
  requestId?: string
  correlationId?: string
  tenantId?: string
  duration?: number
  stack?: string
  tags?: string[]
  source?: 'api' | 'database' | 'auth' | 'external' | 'system' | 'application' | 'audit'
}

interface AuditTrailEntry {
  userId?: string
  tenantId?: string
  action: string
  resourceType: string
  resourceId?: string
  method?: string
  endpoint?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  metadata?: Record<string, any>
  success?: boolean
  errorMessage?: string
  duration?: number
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  complianceFlags?: string[]
}

class Logger {
  private logLevel: LogLevel
  private enableRequestLogging: boolean
  private enableAuditLogging: boolean
  private enableDatabaseLogging: boolean

  constructor() {
    this.logLevel = (getEnv('LOG_LEVEL') as LogLevel) || 'info'
    this.enableRequestLogging = Boolean(getEnv('ENABLE_REQUEST_LOGGING')) || false
    this.enableAuditLogging = process.env.ENABLE_AUDIT_LOGGING !== 'false'
    this.enableDatabaseLogging = process.env.ENABLE_DATABASE_LOGGING !== 'false'

    // Disable database logging if we're in a test environment or if explicitly disabled
    if (process.env.NODE_ENV === 'test' || process.env.ENABLE_DATABASE_LOGGING === 'false') {
      this.enableDatabaseLogging = false
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }
    return levels[level] >= levels[this.logLevel]
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, userId, requestId, correlationId, tenantId, duration, stack, tags, source } = entry

    const baseInfo = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(userId && { userId }),
      ...(requestId && { requestId }),
      ...(correlationId && { correlationId }),
      ...(tenantId && { tenantId }),
      ...(duration && { duration: `${duration}ms` }),
      ...(tags && tags.length > 0 && { tags }),
      ...(source && { source }),
    }

    const logData = {
      ...baseInfo,
      ...(context && { context }),
      ...(stack && !isProduction && { stack }),
    }

    return JSON.stringify(logData, null, isProduction ? 0 : 2)
  }

  private async log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    options?: {
      userId?: string
      requestId?: string
      correlationId?: string
      tenantId?: string
      tags?: string[]
      source?: LogEntry['source']
    }
  ): Promise<void> {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId: options?.userId,
      requestId: options?.requestId,
      correlationId: options?.correlationId,
      tenantId: options?.tenantId,
      tags: options?.tags,
      source: options?.source || 'application',
    }

    const formattedLog = this.formatLog(entry)

    // Console output with appropriate method
    switch (level) {
      case 'debug':
        console.debug(formattedLog)
        break
      case 'info':
        console.info(formattedLog)
        break
      case 'warn':
        console.warn(formattedLog)
        break
      case 'error':
        console.error(formattedLog)
        break
    }

    // Log to database if enabled
    if (this.enableDatabaseLogging) {
      try {
        await this.logToDatabase(level, message, context, options)
      } catch (error) {
        // Silently fail database logging to prevent recursive errors
        // Only log to console if not already logging an error to avoid spam
        if (level !== 'error') {
          console.warn('Database logging failed, continuing with console logging only')
        }
      }
    }

    // In production, you might want to send logs to external service
    if (isProduction && level === 'error') {
      this.sendToExternalService(entry)
    }
  }

  private async logToDatabase(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    options?: Parameters<Logger['log']>[3]
  ): Promise<void> {
    try {
      const supabase = await getSupabaseClient()

      // Skip database logging if client is not available (e.g., client-side)
      if (!supabase) return

      const logEntry = {
        level,
        source: options?.source || 'application',
        message,
        metadata: context || {},
        user_id: options?.userId,
        session_id: undefined, // Will be set by middleware
        request_id: options?.requestId,
        ip_address: undefined, // Will be set by middleware
        user_agent: undefined, // Will be set by middleware
        error_stack: level === 'error' && context?.stack ? context.stack : undefined,
        tags: options?.tags || [],
        timestamp: new Date().toISOString()
      }

      await supabase
        .from('system_logs')
        .insert(logEntry)

    } catch (error) {
      // Re-throw the error so the calling code can handle it
      throw error
    }
  }

  private async sendToExternalService(entry: LogEntry): Promise<void> {
    // Implement external logging service integration here
    // Examples: DataDog, Sentry, CloudWatch, etc.
    try {
      // Example implementation for a generic webhook
      const webhookUrl = process.env.LOG_WEBHOOK_URL
      if (webhookUrl && typeof webhookUrl === 'string') {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        })
      }
    } catch (error) {
      // Fail silently to avoid infinite logging loops
      console.error('Failed to send log to external service:', error)
    }
  }

  /**
   * Log audit trail entry
   */
  async logAuditTrail(entry: AuditTrailEntry): Promise<void> {
    if (!this.enableAuditLogging) return

    try {
      const supabase = await getSupabaseClient()

      // Skip audit logging if client is not available (e.g., client-side)
      if (!supabase) return

      const auditEntry = {
        user_id: entry.userId,
        tenant_id: entry.tenantId,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        method: entry.method,
        endpoint: entry.endpoint,
        old_values: entry.oldValues,
        new_values: entry.newValues,
        metadata: entry.metadata,
        success: entry.success !== false,
        error_message: entry.errorMessage,
        duration_ms: entry.duration,
        risk_level: entry.riskLevel || 'low',
        compliance_flags: entry.complianceFlags || [],
        ip_address: null, // Will be set by middleware
        user_agent: null, // Will be set by middleware
        session_id: null, // Will be set by middleware
        request_id: null, // Will be set by middleware
        correlation_id: null, // Will be set by middleware
      }

      await supabase
        .from('audit_trails')
        .insert(auditEntry)

      // Also log to system logs for correlation
      try {
        await this.logToDatabase(
          entry.success !== false ? 'info' : 'warn',
          `Audit: ${entry.action} on ${entry.resourceType}`,
          {
            audit_entry: auditEntry,
            risk_level: entry.riskLevel,
            compliance_flags: entry.complianceFlags
          },
          {
            userId: entry.userId,
            tags: ['audit', entry.resourceType, entry.action],
            source: 'application'
          }
        )
      } catch (dbError) {
        // Silently fail audit logging to prevent recursive errors
        if (entry.success !== false) {
          console.warn('Database audit logging failed, continuing without audit log')
        }
      }

    } catch (error) {
      console.error('Failed to log audit trail:', error)
    }
  }

  async debug(message: string, context?: Record<string, any>, options?: Parameters<Logger['log']>[3]): Promise<void> {
    await this.log('debug', message, context, options)
  }

  async info(message: string, context?: Record<string, any>, options?: Parameters<Logger['log']>[3]): Promise<void> {
    await this.log('info', message, context, options)
  }

  async warn(message: string, context?: Record<string, any>, options?: Parameters<Logger['log']>[3]): Promise<void> {
    await this.log('warn', message, context, options)
  }

  async error(message: string, error?: Error | Record<string, any> | unknown, context?: Record<string, any>, options?: Parameters<Logger['log']>[3]): Promise<void> {
    let logContext = context || {}
    let stack: string | undefined

    if (error instanceof Error) {
      logContext = {
        ...logContext,
        error: {
          name: error.name,
          message: error.message,
        }
      }
      stack = error.stack
    } else if (error && typeof error === 'object' && error !== null) {
      logContext = { ...logContext, ...error }
    }

    if (stack) {
      logContext.stack = stack
    }

    await this.log('error', message, logContext, options)
  }

  // Enterprise logging methods
  async logWithCorrelation(
    level: LogLevel,
    message: string,
    correlationId: string,
    context?: Record<string, any>,
    options?: Omit<Parameters<Logger['log']>[3], 'correlationId'>
  ): Promise<void> {
    await this.log(level, message, context, { ...options, correlationId })
  }

  async logUserAction(
    action: string,
    userId: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, any>,
    options?: {
      riskLevel?: AuditTrailEntry['riskLevel']
      complianceFlags?: string[]
      correlationId?: string
    }
  ): Promise<void> {
    // Log to audit trails
    await this.logAuditTrail({
      userId,
      action,
      resourceType,
      resourceId,
      metadata: details,
      riskLevel: options?.riskLevel,
      complianceFlags: options?.complianceFlags,
    })

    // Also log to system logs
    await this.log(
      'info',
      `User action: ${action}`,
      { resourceType, resourceId, ...details },
      {
        userId,
        correlationId: options?.correlationId,
        tags: ['user-action', action, resourceType],
        source: 'application'
      }
    )
  }

  async logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string,
    details?: Record<string, any>,
    options?: {
      correlationId?: string
      ipAddress?: string
      userAgent?: string
    }
  ): Promise<void> {
    const level = severity === 'critical' ? 'error' : severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info'

    await this.log(
      level,
      `Security event: ${event}`,
      { severity, ...details },
      {
        userId,
        correlationId: options?.correlationId,
        tags: ['security', severity, event],
        source: 'system'
      }
    )
  }

  // Utility functions
  static generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }


  logAPICall(service: string, endpoint: string, success: boolean, duration?: number, error?: string) {
    const level = success ? 'info' : 'error'
    this.log(level, `External API call: ${service}`, {
      service,
      endpoint,
      success,
      duration,
      error,
    })
  }

  logDatabaseOperation(operation: string, table: string, success: boolean, duration?: number, error?: string) {
    const level = success ? 'debug' : 'error'
    this.log(level, `Database operation: ${operation}`, {
      operation,
      table,
      success,
      duration,
      error,
    })
  }

  logSecurity(event: string, userId?: string, details?: Record<string, any>) {
    this.warn('Security event', {
      event,
      userId,
      ...details,
    })
  }
}

// Export singleton instance
export const logger = new Logger()

// Request logging middleware for API routes
export function withRequestLogging<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  options: { operation?: string; userId?: string; tenantId?: string; correlationId?: string } = {}
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()
    const requestId = crypto.randomUUID()
    const correlationId = options.correlationId || crypto.randomUUID()
    const request = args[0] as any // Assume first arg is request object

    const method = request?.method || 'UNKNOWN'
    const url = request?.url || request?.nextUrl?.pathname || 'UNKNOWN'
    const ipAddress = request?.headers?.get('x-forwarded-for') ||
                     request?.headers?.get('x-real-ip') ||
                     request?.ip ||
                     'unknown'
    const userAgent = request?.headers?.get('user-agent') || 'unknown'

    // Log request start
    await logger.info(
      `Request started: ${method} ${url}`,
      {
        method,
        url,
        ipAddress,
        userAgent,
        operation: options.operation
      },
      {
        userId: options.userId,
        requestId,
        correlationId,
        tenantId: options.tenantId,
        tags: ['api', 'request', method.toLowerCase()],
        source: 'api'
      }
    )

    try {
      const result = await handler(...args)
      const duration = Date.now() - startTime

      // Try to extract status code from result
      const statusCode = (result as any)?.status || 200
      const level = statusCode >= 400 ? 'warn' : 'info'

      if (level === 'warn') {
        await logger.warn(
          `Request completed: ${method} ${url} ${statusCode}`,
          {
            method,
            url,
            statusCode,
            duration,
            operation: options.operation
          },
          {
            userId: options.userId,
            requestId,
            correlationId,
            tenantId: options.tenantId,
            tags: ['api', 'response', method.toLowerCase(), statusCode.toString()],
            source: 'api'
          }
        )
      } else {
        await logger.info(
          `Request completed: ${method} ${url} ${statusCode}`,
          {
            method,
            url,
            statusCode,
            duration,
            operation: options.operation
          },
          {
            userId: options.userId,
            requestId,
            correlationId,
            tenantId: options.tenantId,
            tags: ['api', 'response', method.toLowerCase(), statusCode.toString()],
            source: 'api'
          }
        )
      }

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      await logger.error(
        `${options.operation || 'API operation'} failed: ${method} ${url}`,
        error as Error,
        {
          method,
          url,
          duration,
          operation: options.operation,
          ipAddress,
          userAgent
        },
        {
          userId: options.userId,
          requestId,
          correlationId,
          tenantId: options.tenantId,
          tags: ['api', 'error', method.toLowerCase()],
          source: 'api'
        }
      )
      throw error
    }
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static timers = new Map<string, number>()

  static start(operation: string): string {
    const id = `${operation}-${Date.now()}-${Math.random()}`
    this.timers.set(id, Date.now())
    return id
  }

  static end(id: string, operation?: string): number {
    const startTime = this.timers.get(id)
    if (!startTime) {
      console.warn('Performance timer not found', { timerId: id })
      return 0
    }

    const duration = Date.now() - startTime
    this.timers.delete(id)

    if (operation) {
      logger.debug('Performance measurement', {
        operation,
        duration,
        timerId: id,
      })
    }

    return duration
  }

  static measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const timerId = this.start(operation)
      try {
        const result = await fn()
        this.end(timerId, operation)
        resolve(result)
      } catch (error) {
        this.end(timerId, operation)
        console.error(`Performance measurement failed for ${operation}:`, error)
        reject(error)
      }
    })
  }
}