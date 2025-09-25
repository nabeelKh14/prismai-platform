import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

export interface BAALogEntry {
  id: string
  userId: string
  activityType: 'template_created' | 'template_updated' | 'template_versioned' | 'template_deactivated' |
                'agreement_created' | 'agreement_updated' | 'agreement_executed' | 'agreement_expired' | 'agreement_terminated' | 'agreement_renewed' |
                'vendor_created' | 'vendor_updated' | 'vendor_assessed' |
                'compliance_incident_created' | 'compliance_incident_updated' | 'compliance_incident_resolved' |
                'access_granted' | 'access_revoked' | 'access_attempt_denied' | 'phi_access_attempt' | 'template_customized' |
                'audit_report_generated' | 'audit_logs_cleaned'
  entityType: 'template' | 'agreement' | 'vendor' | 'assessment' | 'incident' | 'access_control' | 'phi_data' | 'audit_report' | 'audit_logs'
  entityId: string
  relatedEntityType?: 'template' | 'agreement' | 'vendor' | 'assessment' | 'incident' | 'access_control' | 'phi_data'
  relatedEntityId?: string
  description: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  createdAt: Date
}

export interface BAAAuditReport {
  id: string
  userId: string
  reportType: 'activity_summary' | 'access_patterns' | 'compliance_gaps' | 'security_incidents' | 'vendor_risk'
  dateRange: {
    startDate: Date
    endDate: Date
  }
  filters?: {
    activityTypes?: string[]
    entityTypes?: string[]
    userIds?: string[]
    riskLevels?: string[]
  }
  summary: {
    totalActivities: number
    uniqueUsers: number
    highRiskActivities: number
    complianceIssues: number
  }
  details: any[]
  recommendations: string[]
  generatedAt: Date
  generatedBy: string
}

export class BAALoggingService {
  private supabase = createClient()

  /**
   * Log BAA-related activity with comprehensive context
   * HIPAA Compliance: Complete audit trail for all BAA activities
   */
  async logActivity(
    userId: string,
    activityType: BAALogEntry['activityType'],
    entityType: BAALogEntry['entityType'],
    entityId: string,
    description: string,
    context?: {
      oldValues?: Record<string, any>
      newValues?: Record<string, any>
      metadata?: Record<string, any>
      relatedEntityType?: BAALogEntry['relatedEntityType']
      relatedEntityId?: string
      ipAddress?: string
      userAgent?: string
      sessionId?: string
    }
  ): Promise<string> {
    try {
      const supabase = await this.supabase

      const { data: logEntry, error } = await supabase
        .from('baa_audit_logs')
        .insert({
          user_id: userId,
          activity_type: activityType,
          entity_type: entityType,
          entity_id: entityId,
          related_entity_type: context?.relatedEntityType,
          related_entity_id: context?.relatedEntityId,
          description,
          old_values: context?.oldValues,
          new_values: context?.newValues,
          metadata: context?.metadata,
          ip_address: context?.ipAddress,
          user_agent: context?.userAgent,
          session_id: context?.sessionId,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      // Log to security audit system for high-risk activities
      if (this.isHighRiskActivity(activityType)) {
        SecurityAudit.logSensitiveAction(`baa_${activityType}`, userId, {
          entityType,
          entityId,
          description,
          ...context?.metadata
        })
      }

      logger.info('BAA activity logged', {
        userId,
        activityType,
        entityType,
        entityId,
        description
      })

      return logEntry.id
    } catch (error) {
      logger.error('Failed to log BAA activity', error as Error, {
        userId,
        activityType,
        entityType,
        entityId,
        description
      })
      throw error
    }
  }

  /**
   * Log PHI access attempts for HIPAA compliance
   * HIPAA Compliance: Critical for breach notification and access monitoring
   */
  async logPHIAccess(
    userId: string,
    phiResource: string,
    accessType: 'view' | 'create' | 'update' | 'delete' | 'export',
    context: {
      agreementId?: string
      vendorId?: string
      purpose?: string
      success: boolean
      ipAddress?: string
      userAgent?: string
      sessionId?: string
      metadata?: Record<string, any>
    }
  ): Promise<string> {
    try {
      const description = `PHI ${accessType} attempt: ${context.success ? 'SUCCESS' : 'DENIED'} - ${phiResource}`

      const logId = await this.logActivity(
        userId,
        'phi_access_attempt',
        'phi_data',
        phiResource,
        description,
        {
          oldValues: context.success ? undefined : { access_denied: true },
          newValues: context.success ? { access_granted: true } : undefined,
          metadata: {
            accessType,
            purpose: context.purpose,
            success: context.success,
            agreementId: context.agreementId,
            vendorId: context.vendorId,
            ...context.metadata
          },
          relatedEntityType: context.agreementId ? 'agreement' : context.vendorId ? 'vendor' : undefined,
          relatedEntityId: context.agreementId || context.vendorId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          sessionId: context.sessionId
        }
      )

      // Additional security logging for failed PHI access attempts
      if (!context.success) {
        SecurityAudit.logSensitiveAction('phi_access_denied', userId, {
          resource: phiResource,
          accessType,
          reason: 'BAA access control restriction',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        })
      }

      return logId
    } catch (error) {
      logger.error('Failed to log PHI access', error as Error, {
        userId,
        phiResource,
        accessType,
        success: context.success
      })
      throw error
    }
  }

  /**
   * Generate comprehensive audit report
   * HIPAA Compliance: Required for compliance audits and reviews
   */
  async generateAuditReport(
    userId: string,
    reportType: BAAAuditReport['reportType'],
    dateRange: { startDate: Date; endDate: Date },
    filters?: BAAAuditReport['filters']
  ): Promise<BAAAuditReport> {
    try {
      const supabase = await this.supabase

      // Build query with filters
      let query = supabase
        .from('baa_audit_logs')
        .select('*')
        .gte('created_at', dateRange.startDate.toISOString())
        .lte('created_at', dateRange.endDate.toISOString())

      if (filters?.activityTypes?.length) {
        query = query.in('activity_type', filters.activityTypes)
      }

      if (filters?.entityTypes?.length) {
        query = query.in('entity_type', filters.entityTypes)
      }

      if (filters?.userIds?.length) {
        query = query.in('user_id', filters.userIds)
      }

      const { data: logs, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Analyze logs based on report type
      const analysis = await this.analyzeLogs(logs, reportType, filters)

      const report: BAAAuditReport = {
        id: `report_${Date.now()}`,
        userId,
        reportType,
        dateRange,
        filters,
        summary: analysis.summary,
        details: analysis.details,
        recommendations: analysis.recommendations,
        generatedAt: new Date(),
        generatedBy: userId
      }

      // Log the report generation
      await this.logActivity(
        userId,
        'audit_report_generated',
        'audit_report',
        report.id,
        `Generated ${reportType} audit report for ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`,
        {
          metadata: {
            reportType,
            totalActivities: analysis.summary.totalActivities,
            dateRange: {
              start: dateRange.startDate.toISOString(),
              end: dateRange.endDate.toISOString()
            }
          }
        }
      )

      return report
    } catch (error) {
      logger.error('Failed to generate audit report', error as Error, {
        userId,
        reportType,
        dateRange
      })
      throw error
    }
  }

  /**
   * Get audit trail for specific entity
   * HIPAA Compliance: Entity-specific audit history
   */
  async getEntityAuditTrail(
    entityType: BAALogEntry['entityType'],
    entityId: string,
    limit: number = 100
  ): Promise<BAALogEntry[]> {
    try {
      const supabase = await this.supabase

      const { data: logs, error } = await supabase
        .from('baa_audit_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return logs.map(log => this.mapLogFromDB(log))
    } catch (error) {
      logger.error('Failed to get entity audit trail', error as Error, {
        entityType,
        entityId,
        limit
      })
      throw error
    }
  }

  /**
   * Get access patterns for compliance analysis
   * HIPAA Compliance: Identify unusual access patterns
   */
  async getAccessPatterns(
    userId: string,
    dateRange: { startDate: Date; endDate: Date },
    filters?: {
      entityTypes?: string[]
      activityTypes?: string[]
    }
  ): Promise<{
    userActivity: Array<{
      date: string
      activityCount: number
      uniqueEntities: number
      riskScore: number
    }>
    resourceAccess: Array<{
      entityType: string
      entityId: string
      accessCount: number
      uniqueUsers: number
      lastAccess: Date
    }>
    anomalies: Array<{
      type: string
      description: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      timestamp: Date
    }>
  }> {
    try {
      const supabase = await this.supabase

      let query = supabase
        .from('baa_audit_logs')
        .select('*')
        .gte('created_at', dateRange.startDate.toISOString())
        .lte('created_at', dateRange.endDate.toISOString())

      if (filters?.entityTypes?.length) {
        query = query.in('entity_type', filters.entityTypes)
      }

      if (filters?.activityTypes?.length) {
        query = query.in('activity_type', filters.activityTypes)
      }

      const { data: logs, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Analyze patterns
      const userActivity = this.analyzeUserActivity(logs)
      const resourceAccess = this.analyzeResourceAccess(logs)
      const anomalies = this.detectAnomalies(logs)

      return {
        userActivity,
        resourceAccess,
        anomalies
      }
    } catch (error) {
      logger.error('Failed to get access patterns', error as Error, {
        userId,
        dateRange
      })
      throw error
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   * HIPAA Compliance: Data retention management
   */
  async cleanupOldLogs(
    userId: string,
    retentionDays: number = 2555, // 7 years for HIPAA compliance
    dryRun: boolean = true
  ): Promise<{
    logsToDelete: number
    totalSize: number
    deletedLogs: number
  }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const supabase = await this.supabase

      // Get logs to delete
      const { data: logsToDelete, error: countError } = await supabase
        .from('baa_audit_logs')
        .select('id')
        .eq('user_id', userId)
        .lt('created_at', cutoffDate.toISOString())

      if (countError) throw countError

      const result = {
        logsToDelete: logsToDelete.length,
        totalSize: logsToDelete.length * 1024, // Approximate size
        deletedLogs: 0
      }

      if (!dryRun && logsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('baa_audit_logs')
          .delete()
          .in('id', logsToDelete.map(log => log.id))

        if (deleteError) throw deleteError

        result.deletedLogs = logsToDelete.length

        // Log the cleanup activity
        await this.logActivity(
          userId,
          'audit_logs_cleaned',
          'audit_logs',
          'cleanup',
          `Cleaned up ${logsToDelete.length} audit logs older than ${retentionDays} days`,
          {
            metadata: {
              retentionDays,
              cutoffDate: cutoffDate.toISOString(),
              dryRun: false
            }
          }
        )
      }

      return result
    } catch (error) {
      logger.error('Failed to cleanup old logs', error as Error, {
        userId,
        retentionDays,
        dryRun
      })
      throw error
    }
  }

  // Private helper methods

  private isHighRiskActivity(activityType: string): boolean {
    const highRiskActivities = [
      'agreement_executed',
      'agreement_terminated',
      'compliance_incident_created',
      'phi_access_attempt',
      'access_granted',
      'access_revoked'
    ]
    return highRiskActivities.includes(activityType)
  }

  private async analyzeLogs(
    logs: any[],
    reportType: string,
    filters?: any
  ): Promise<{
    summary: BAAAuditReport['summary']
    details: any[]
    recommendations: string[]
  }> {
    const summary = {
      totalActivities: logs.length,
      uniqueUsers: new Set(logs.map(log => log.user_id)).size,
      highRiskActivities: logs.filter(log => this.isHighRiskActivity(log.activity_type)).length,
      complianceIssues: logs.filter(log =>
        log.activity_type.includes('incident') ||
        log.metadata?.severity === 'high' ||
        log.metadata?.severity === 'critical'
      ).length
    }

    const details = logs.map(log => this.mapLogFromDB(log))

    const recommendations: string[] = []

    if (summary.complianceIssues > 0) {
      recommendations.push('Address identified compliance issues immediately')
    }

    if (summary.highRiskActivities > summary.totalActivities * 0.1) {
      recommendations.push('High volume of high-risk activities detected - review access controls')
    }

    if (logs.some(log => log.activity_type === 'phi_access_attempt' && !log.metadata?.success)) {
      recommendations.push('Unauthorized PHI access attempts detected - investigate immediately')
    }

    return { summary, details, recommendations }
  }

  private analyzeUserActivity(logs: any[]): Array<{
    date: string
    activityCount: number
    uniqueEntities: number
    riskScore: number
  }> {
    const dailyActivity = new Map<string, { count: number; entities: Set<string>; riskScore: number }>()

    logs.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0]
      const riskScore = this.calculateRiskScore(log.activity_type)

      if (!dailyActivity.has(date)) {
        dailyActivity.set(date, { count: 0, entities: new Set(), riskScore: 0 })
      }

      const dayData = dailyActivity.get(date)!
      dayData.count++
      dayData.entities.add(log.entity_id)
      dayData.riskScore += riskScore
    })

    return Array.from(dailyActivity.entries()).map(([date, data]) => ({
      date,
      activityCount: data.count,
      uniqueEntities: data.entities.size,
      riskScore: data.riskScore
    }))
  }

  private analyzeResourceAccess(logs: any[]): Array<{
    entityType: string
    entityId: string
    accessCount: number
    uniqueUsers: number
    lastAccess: Date
  }> {
    const resourceAccess = new Map<string, {
      count: number
      users: Set<string>
      lastAccess: Date
    }>()

    logs.forEach(log => {
      const key = `${log.entity_type}:${log.entity_id}`

      if (!resourceAccess.has(key)) {
        resourceAccess.set(key, { count: 0, users: new Set(), lastAccess: new Date(log.created_at) })
      }

      const resource = resourceAccess.get(key)!
      resource.count++
      resource.users.add(log.user_id)
      if (new Date(log.created_at) > resource.lastAccess) {
        resource.lastAccess = new Date(log.created_at)
      }
    })

    return Array.from(resourceAccess.entries()).map(([key, data]) => {
      const [entityType, entityId] = key.split(':')
      return {
        entityType,
        entityId,
        accessCount: data.count,
        uniqueUsers: data.users.size,
        lastAccess: data.lastAccess
      }
    })
  }

  private detectAnomalies(logs: any[]): Array<{
    type: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    timestamp: Date
  }> {
    const anomalies: Array<{
      type: string
      description: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      timestamp: Date
    }> = []

    // Group by user and hour
    const hourlyActivity = new Map<string, number>()

    logs.forEach(log => {
      const hour = new Date(log.created_at).toISOString().slice(0, 13) // YYYY-MM-DDTHH
      const userKey = `${log.user_id}:${hour}`

      hourlyActivity.set(userKey, (hourlyActivity.get(userKey) || 0) + 1)
    })

    // Detect unusual activity spikes
    for (const [userKey, count] of hourlyActivity.entries()) {
      if (count > 50) { // Arbitrary threshold for unusual activity
        const [userId, hour] = userKey.split(':')
        anomalies.push({
          type: 'unusual_activity_spike',
          description: `User ${userId} performed ${count} activities in hour ${hour}`,
          severity: count > 100 ? 'critical' : count > 75 ? 'high' : 'medium',
          timestamp: new Date(hour + ':00:00.000Z')
        })
      }
    }

    return anomalies
  }

  private calculateRiskScore(activityType: string): number {
    const riskScores: Record<string, number> = {
      'phi_access_attempt': 10,
      'agreement_executed': 8,
      'agreement_terminated': 8,
      'compliance_incident_created': 9,
      'access_granted': 6,
      'access_revoked': 6,
      'template_created': 3,
      'agreement_created': 4,
      'vendor_created': 3,
      'vendor_assessed': 5
    }

    return riskScores[activityType] || 1
  }

  private mapLogFromDB(data: any): BAALogEntry {
    return {
      id: data.id,
      userId: data.user_id,
      activityType: data.activity_type,
      entityType: data.entity_type,
      entityId: data.entity_id,
      relatedEntityType: data.related_entity_type,
      relatedEntityId: data.related_entity_id,
      description: data.description,
      oldValues: data.old_values,
      newValues: data.new_values,
      metadata: data.metadata,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      sessionId: data.session_id,
      createdAt: new Date(data.created_at)
    }
  }
}

// Export singleton instance
export const baaLoggingService = new BAALoggingService()