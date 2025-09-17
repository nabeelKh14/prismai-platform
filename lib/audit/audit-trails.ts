import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { accessControlService } from '@/lib/security/access-control'

export interface AuditEvent {
  id: string
  timestamp: Date
  userId: string
  tenantId?: string
  action: string
  resourceType: string
  resourceId?: string
  method?: string
  endpoint?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  metadata?: Record<string, any>
  success: boolean
  errorMessage?: string
  duration?: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  complianceFlags?: string[]
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  requestId?: string
  correlationId?: string
}

export interface AuditQuery {
  userId?: string
  tenantId?: string
  action?: string
  resourceType?: string
  resourceId?: string
  riskLevel?: AuditEvent['riskLevel']
  complianceFlags?: string[]
  startDate?: Date
  endDate?: Date
  success?: boolean
  limit?: number
  offset?: number
}

export interface AuditSummary {
  totalEvents: number
  eventsByRiskLevel: Record<string, number>
  eventsByAction: Record<string, number>
  eventsByResourceType: Record<string, number>
  topUsers: Array<{ userId: string; count: number }>
  recentEvents: AuditEvent[]
  complianceViolations: number
}

export class AuditTrailsService {
  private static instance: AuditTrailsService

  static getInstance(): AuditTrailsService {
    if (!AuditTrailsService.instance) {
      AuditTrailsService.instance = new AuditTrailsService()
    }
    return AuditTrailsService.instance
  }

  /**
   * Log an audit event
   */
  async logAuditEvent(
    userId: string,
    action: string,
    resourceType: string,
    options: {
      resourceId?: string
      method?: string
      endpoint?: string
      oldValues?: Record<string, any>
      newValues?: Record<string, any>
      metadata?: Record<string, any>
      success?: boolean
      errorMessage?: string
      duration?: number
      riskLevel?: AuditEvent['riskLevel']
      complianceFlags?: string[]
      tenantId?: string
      ipAddress?: string
      userAgent?: string
      sessionId?: string
      requestId?: string
      correlationId?: string
    } = {}
  ): Promise<void> {
    try {
      // Check if audit logging is enabled for this action
      if (!this.shouldAuditAction(action, resourceType, options.riskLevel)) {
        return
      }

      const auditEvent: Omit<AuditEvent, 'id'> = {
        timestamp: new Date(),
        userId,
        tenantId: options.tenantId,
        action,
        resourceType,
        resourceId: options.resourceId,
        method: options.method,
        endpoint: options.endpoint,
        oldValues: options.oldValues,
        newValues: options.newValues,
        metadata: options.metadata,
        success: options.success !== false,
        errorMessage: options.errorMessage,
        duration: options.duration,
        riskLevel: options.riskLevel || this.calculateRiskLevel(action, resourceType),
        complianceFlags: options.complianceFlags || this.getComplianceFlags(action, resourceType),
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        sessionId: options.sessionId,
        requestId: options.requestId,
        correlationId: options.correlationId,
      }

      // Store in database
      const supabase = await createClient()
      await supabase
        .from('audit_trails')
        .insert({
          user_id: auditEvent.userId,
          tenant_id: auditEvent.tenantId,
          action: auditEvent.action,
          resource_type: auditEvent.resourceType,
          resource_id: auditEvent.resourceId,
          method: auditEvent.method,
          endpoint: auditEvent.endpoint,
          old_values: auditEvent.oldValues,
          new_values: auditEvent.newValues,
          metadata: auditEvent.metadata,
          success: auditEvent.success,
          error_message: auditEvent.errorMessage,
          duration_ms: auditEvent.duration,
          risk_level: auditEvent.riskLevel,
          compliance_flags: auditEvent.complianceFlags,
          ip_address: auditEvent.ipAddress,
          user_agent: auditEvent.userAgent,
          session_id: auditEvent.sessionId,
          request_id: auditEvent.requestId,
          correlation_id: auditEvent.correlationId,
        })

      // Log to application logger with appropriate level
      const logData = {
        resourceId: auditEvent.resourceId,
        success: auditEvent.success,
        riskLevel: auditEvent.riskLevel,
        complianceFlags: auditEvent.complianceFlags,
        ...auditEvent.metadata
      }

      const logOptions = {
        userId: auditEvent.userId,
        correlationId: auditEvent.correlationId,
        tenantId: auditEvent.tenantId,
        tags: ['audit', action, resourceType, auditEvent.riskLevel],
        source: 'audit' as const
      }

      if (auditEvent.riskLevel === 'critical') {
        await logger.error(`Audit: ${action} on ${resourceType}`, undefined, logData, logOptions)
      } else if (auditEvent.riskLevel === 'high') {
        await logger.warn(`Audit: ${action} on ${resourceType}`, logData, logOptions)
      } else {
        await logger.info(`Audit: ${action} on ${resourceType}`, logData, logOptions)
      }

      // Trigger alerts for high-risk events
      if (auditEvent.riskLevel === 'high' || auditEvent.riskLevel === 'critical') {
        await this.triggerAuditAlert(auditEvent)
      }

    } catch (error) {
      console.error('Failed to log audit event:', error)
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Query audit events
   */
  async queryAuditEvents(query: AuditQuery): Promise<{
    events: AuditEvent[]
    total: number
    hasMore: boolean
  }> {
    try {
      const supabase = await createClient()

      let dbQuery = supabase
        .from('audit_trails')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })

      // Apply filters
      if (query.userId) {
        dbQuery = dbQuery.eq('user_id', query.userId)
      }

      if (query.tenantId) {
        dbQuery = dbQuery.eq('tenant_id', query.tenantId)
      }

      if (query.action) {
        dbQuery = dbQuery.eq('action', query.action)
      }

      if (query.resourceType) {
        dbQuery = dbQuery.eq('resource_type', query.resourceType)
      }

      if (query.resourceId) {
        dbQuery = dbQuery.eq('resource_id', query.resourceId)
      }

      if (query.riskLevel) {
        dbQuery = dbQuery.eq('risk_level', query.riskLevel)
      }

      if (query.complianceFlags && query.complianceFlags.length > 0) {
        dbQuery = dbQuery.overlaps('compliance_flags', query.complianceFlags)
      }

      if (query.success !== undefined) {
        dbQuery = dbQuery.eq('success', query.success)
      }

      if (query.startDate) {
        dbQuery = dbQuery.gte('timestamp', query.startDate.toISOString())
      }

      if (query.endDate) {
        dbQuery = dbQuery.lte('timestamp', query.endDate.toISOString())
      }

      const limit = query.limit || 50
      const offset = query.offset || 0
      dbQuery = dbQuery.range(offset, offset + limit - 1)

      const { data, error, count } = await dbQuery

      if (error) throw error

      const events: AuditEvent[] = (data || []).map(event => ({
        id: event.id,
        timestamp: new Date(event.timestamp),
        userId: event.user_id,
        tenantId: event.tenant_id,
        action: event.action,
        resourceType: event.resource_type,
        resourceId: event.resource_id,
        method: event.method,
        endpoint: event.endpoint,
        oldValues: event.old_values,
        newValues: event.new_values,
        metadata: event.metadata,
        success: event.success,
        errorMessage: event.error_message,
        duration: event.duration_ms,
        riskLevel: event.risk_level,
        complianceFlags: event.compliance_flags,
        ipAddress: event.ip_address,
        userAgent: event.user_agent,
        sessionId: event.session_id,
        requestId: event.request_id,
        correlationId: event.correlation_id,
      }))

      return {
        events,
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      }

    } catch (error) {
      logger.error('Failed to query audit events', { error, query })
      return { events: [], total: 0, hasMore: false }
    }
  }

  /**
   * Get audit summary
   */
  async getAuditSummary(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<AuditSummary> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('audit_trails')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())

      if (tenantId) {
        query = query.eq('tenant_id', tenantId)
      }

      const { data, error } = await query

      if (error) throw error

      const events = data || []
      const totalEvents = events.length

      // Calculate metrics
      const eventsByRiskLevel: Record<string, number> = {}
      const eventsByAction: Record<string, number> = {}
      const eventsByResourceType: Record<string, number> = {}
      const userCounts: Record<string, number> = {}

      let complianceViolations = 0

      for (const event of events) {
        // Risk level counts
        eventsByRiskLevel[event.risk_level] = (eventsByRiskLevel[event.risk_level] || 0) + 1

        // Action counts
        eventsByAction[event.action] = (eventsByAction[event.action] || 0) + 1

        // Resource type counts
        eventsByResourceType[event.resource_type] = (eventsByResourceType[event.resource_type] || 0) + 1

        // User counts
        userCounts[event.user_id] = (userCounts[event.user_id] || 0) + 1

        // Compliance violations
        if (event.compliance_flags && event.compliance_flags.length > 0) {
          complianceViolations++
        }
      }

      const topUsers = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }))

      const recentEvents = events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20)
        .map(event => ({
          id: event.id,
          timestamp: new Date(event.timestamp),
          userId: event.user_id,
          tenantId: event.tenant_id,
          action: event.action,
          resourceType: event.resource_type,
          resourceId: event.resource_id,
          method: event.method,
          endpoint: event.endpoint,
          oldValues: event.old_values,
          newValues: event.new_values,
          metadata: event.metadata,
          success: event.success,
          errorMessage: event.error_message,
          duration: event.duration_ms,
          riskLevel: event.risk_level,
          complianceFlags: event.compliance_flags,
          ipAddress: event.ip_address,
          userAgent: event.user_agent,
          sessionId: event.session_id,
          requestId: event.request_id,
          correlationId: event.correlation_id,
        }))

      return {
        totalEvents,
        eventsByRiskLevel,
        eventsByAction,
        eventsByResourceType,
        topUsers,
        recentEvents,
        complianceViolations
      }

    } catch (error) {
      logger.error('Failed to get audit summary', { error })
      return {
        totalEvents: 0,
        eventsByRiskLevel: {},
        eventsByAction: {},
        eventsByResourceType: {},
        topUsers: [],
        recentEvents: [],
        complianceViolations: 0
      }
    }
  }

  /**
   * Export audit events
   */
  async exportAuditEvents(
    query: AuditQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const { events } = await this.queryAuditEvents({ ...query, limit: 10000 })

    if (format === 'csv') {
      return this.convertToCSV(events)
    } else {
      return JSON.stringify(events, null, 2)
    }
  }

  /**
   * Check if an action should be audited
   */
  private shouldAuditAction(
    action: string,
    resourceType: string,
    riskLevel?: string
  ): boolean {
    // Always audit high-risk and critical actions
    if (riskLevel === 'high' || riskLevel === 'critical') {
      return true
    }

    // Audit sensitive actions
    const sensitiveActions = [
      'login', 'logout', 'password_change', 'permission_change',
      'data_export', 'data_delete', 'admin_action', 'config_change'
    ]

    const sensitiveResourceTypes = [
      'user', 'permission', 'security', 'config', 'audit_log'
    ]

    return sensitiveActions.includes(action) ||
           sensitiveResourceTypes.includes(resourceType)
  }

  /**
   * Calculate risk level for an action
   */
  private calculateRiskLevel(action: string, resourceType: string): AuditEvent['riskLevel'] {
    const highRiskActions = ['delete', 'admin_action', 'permission_change', 'data_export']
    const criticalActions = ['security_breach', 'data_breach', 'system_compromise']

    if (criticalActions.includes(action)) return 'critical'
    if (highRiskActions.includes(action)) return 'high'
    if (resourceType === 'user' || resourceType === 'security') return 'medium'

    return 'low'
  }

  /**
   * Get compliance flags for an action
   */
  private getComplianceFlags(action: string, resourceType: string): string[] {
    const flags: string[] = []

    // GDPR compliance
    if (['data_export', 'data_delete', 'data_access'].includes(action)) {
      flags.push('gdpr')
    }

    // CCPA compliance
    if (['data_sharing', 'opt_out', 'data_sale'].includes(action)) {
      flags.push('ccpa')
    }

    // SOX compliance
    if (['financial_data', 'audit_log'].includes(resourceType)) {
      flags.push('sox')
    }

    // ISO 27001
    if (resourceType === 'security' || action.includes('security')) {
      flags.push('iso27001')
    }

    return flags
  }

  /**
   * Trigger audit alert for high-risk events
   */
  private async triggerAuditAlert(event: Omit<AuditEvent, 'id'>): Promise<void> {
    try {
      await logger.logSecurityEvent(
        `High-risk audit event: ${event.action}`,
        event.riskLevel as any,
        event.userId,
        {
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          riskLevel: event.riskLevel
        },
        {
          correlationId: event.correlationId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent
        }
      )
    } catch (error) {
      console.error('Failed to trigger audit alert:', error)
    }
  }

  /**
   * Convert audit events to CSV
   */
  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      'id', 'timestamp', 'userId', 'tenantId', 'action', 'resourceType',
      'resourceId', 'method', 'endpoint', 'success', 'errorMessage',
      'duration', 'riskLevel', 'ipAddress', 'userAgent', 'correlationId'
    ]

    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.userId,
      event.tenantId || '',
      event.action,
      event.resourceType,
      event.resourceId || '',
      event.method || '',
      event.endpoint || '',
      event.success.toString(),
      event.errorMessage || '',
      event.duration?.toString() || '',
      event.riskLevel,
      event.ipAddress || '',
      event.userAgent || '',
      event.correlationId || ''
    ])

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')
  }
}

// Export singleton instance
export const auditTrailsService = AuditTrailsService.getInstance()

// Convenience functions
export async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  options?: Parameters<AuditTrailsService['logAuditEvent']>[3]
): Promise<void> {
  return auditTrailsService.logAuditEvent(userId, action, resourceType, options)
}

export async function queryAuditEvents(query: AuditQuery) {
  return auditTrailsService.queryAuditEvents(query)
}

export async function getAuditSummary(startDate: Date, endDate: Date, tenantId?: string) {
  return auditTrailsService.getAuditSummary(startDate, endDate, tenantId)
}