import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { auditTrailsService } from './audit-trails'
import { logRetentionService } from './log-retention'

export interface ComplianceReport {
  id: string
  reportType: 'gdpr_audit' | 'ccpa_audit' | 'security_audit' | 'access_audit' | 'retention_audit' | 'custom_audit'
  periodStart: Date
  periodEnd: Date
  generatedBy: string
  generatedAt: Date
  status: 'generating' | 'completed' | 'failed'
  findings: Record<string, any>
  recommendations: string[]
  complianceScore: number
  criticalIssues: number
  highIssues: number
  mediumIssues: number
  lowIssues: number
  totalRecordsReviewed: number
  approvedBy?: string
  approvedAt?: Date
  approvalNotes?: string
  nextAuditDate?: Date
  metadata: Record<string, any>
}

export interface ComplianceCheck {
  checkName: string
  status: 'pass' | 'fail' | 'warning'
  description: string
  details: Record<string, any>
  severity: 'critical' | 'high' | 'medium' | 'low'
  recommendation?: string
}

export class ComplianceReportingService {
  private static instance: ComplianceReportingService

  static getInstance(): ComplianceReportingService {
    if (!ComplianceReportingService.instance) {
      ComplianceReportingService.instance = new ComplianceReportingService()
    }
    return ComplianceReportingService.instance
  }

  /**
   * Generate a compliance audit report
   */
  async generateComplianceReport(
    reportType: ComplianceReport['reportType'],
    periodStart: Date,
    periodEnd: Date,
    generatedBy: string,
    options: {
      tenantId?: string
      customChecks?: ComplianceCheck[]
      includeHistoricalData?: boolean
    } = {}
  ): Promise<ComplianceReport> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      // Create initial report record
      const report: ComplianceReport = {
        id: reportId,
        reportType,
        periodStart,
        periodEnd,
        generatedBy,
        generatedAt: new Date(),
        status: 'generating',
        findings: {},
        recommendations: [],
        complianceScore: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        totalRecordsReviewed: 0,
        metadata: {
          tenantId: options.tenantId,
          includeHistoricalData: options.includeHistoricalData
        }
      }

      await logger.info(`Starting ${reportType} compliance report generation`, {
        reportId,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        generatedBy
      })

      // Generate report based on type
      switch (reportType) {
        case 'gdpr_audit':
          await this.generateGDPRAudit(report, options)
          break
        case 'ccpa_audit':
          await this.generateCCPAudit(report, options)
          break
        case 'security_audit':
          await this.generateSecurityAudit(report, options)
          break
        case 'access_audit':
          await this.generateAccessAudit(report, options)
          break
        case 'retention_audit':
          await this.generateRetentionAudit(report, options)
          break
        case 'custom_audit':
          await this.generateCustomAudit(report, options.customChecks || [])
          break
      }

      // Calculate compliance score
      report.complianceScore = this.calculateComplianceScore(report)

      // Set next audit date (typically quarterly for compliance)
      report.nextAuditDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

      // Mark as completed
      report.status = 'completed'

      // Save report to database
      await this.saveComplianceReport(report)

      await logger.info(`${reportType} compliance report completed`, {
        reportId,
        complianceScore: report.complianceScore,
        criticalIssues: report.criticalIssues,
        recommendations: report.recommendations.length
      })

      return report

    } catch (error) {
      await logger.error(`Failed to generate ${reportType} compliance report`, {
        error,
        reportId,
        reportType
      })

      // Update report status to failed
      const failedReport: ComplianceReport = {
        id: reportId,
        reportType,
        periodStart,
        periodEnd,
        generatedBy,
        generatedAt: new Date(),
        status: 'failed',
        findings: { error: error instanceof Error ? error.message : 'Unknown error' },
        recommendations: [],
        complianceScore: 0,
        criticalIssues: 1,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        totalRecordsReviewed: 0,
        metadata: {}
      }

      await this.saveComplianceReport(failedReport)
      throw error
    }
  }

  /**
   * Generate GDPR compliance audit
   */
  private async generateGDPRAudit(
    report: ComplianceReport,
    options: { tenantId?: string; includeHistoricalData?: boolean }
  ): Promise<void> {
    const checks: ComplianceCheck[] = []

    // Data processing consent checks
    checks.push(await this.checkDataProcessingConsent(options.tenantId))

    // Data retention compliance
    checks.push(await this.checkDataRetentionCompliance(report.periodStart, report.periodEnd, options.tenantId))

    // Data subject rights
    checks.push(await this.checkDataSubjectRights(options.tenantId))

    // Data breach notifications
    checks.push(await this.checkDataBreachNotifications(report.periodStart, report.periodEnd, options.tenantId))

    // International data transfers
    checks.push(await this.checkInternationalDataTransfers(options.tenantId))

    // Data minimization
    checks.push(await this.checkDataMinimization(options.tenantId))

    // Purpose limitation
    checks.push(await this.checkPurposeLimitation(options.tenantId))

    // Process checks
    report.findings.gdpr = { checks }
    this.processComplianceChecks(report, checks)

    // GDPR-specific recommendations
    report.recommendations.push(
      'Implement comprehensive consent management system',
      'Establish data protection impact assessment procedures',
      'Train staff on GDPR compliance requirements',
      'Implement data mapping and inventory procedures',
      'Establish breach notification procedures within 72 hours'
    )
  }

  /**
   * Generate CCPA compliance audit
   */
  private async generateCCPAudit(
    report: ComplianceReport,
    options: { tenantId?: string; includeHistoricalData?: boolean }
  ): Promise<void> {
    const checks: ComplianceCheck[] = []

    // Privacy notice compliance
    checks.push(await this.checkPrivacyNoticeCompliance(options.tenantId))

    // Opt-out mechanism effectiveness
    checks.push(await this.checkOptOutMechanisms(options.tenantId))

    // Data sharing practices
    checks.push(await this.checkDataSharingPractices(report.periodStart, report.periodEnd, options.tenantId))

    // Data deletion requests
    checks.push(await this.checkDataDeletionRequests(report.periodStart, report.periodEnd, options.tenantId))

    // Data sale tracking
    checks.push(await this.checkDataSaleTracking(report.periodStart, report.periodEnd, options.tenantId))

    // Process checks
    report.findings.ccpa = { checks }
    this.processComplianceChecks(report, checks)

    // CCPA-specific recommendations
    report.recommendations.push(
      'Enhance privacy notice visibility and clarity',
      'Implement robust opt-out mechanisms for all data practices',
      'Establish data sharing transparency reports',
      'Create data deletion request processing workflows',
      'Implement data sale opt-out verification procedures'
    )
  }

  /**
   * Generate security audit
   */
  private async generateSecurityAudit(
    report: ComplianceReport,
    options: { tenantId?: string; includeHistoricalData?: boolean }
  ): Promise<void> {
    const checks: ComplianceCheck[] = []

    // Access control effectiveness
    checks.push(await this.checkAccessControlEffectiveness(options.tenantId))

    // Authentication security
    checks.push(await this.checkAuthenticationSecurity(report.periodStart, report.periodEnd, options.tenantId))

    // Data encryption
    checks.push(await this.checkDataEncryption(options.tenantId))

    // Security monitoring
    checks.push(await this.checkSecurityMonitoring(report.periodStart, report.periodEnd, options.tenantId))

    // Incident response
    checks.push(await this.checkIncidentResponseCapabilities(options.tenantId))

    // Process checks
    report.findings.security = { checks }
    this.processComplianceChecks(report, checks)

    // Security-specific recommendations
    report.recommendations.push(
      'Implement multi-factor authentication for all users',
      'Enhance encryption for data at rest and in transit',
      'Deploy comprehensive security monitoring and alerting',
      'Establish incident response and breach notification procedures',
      'Conduct regular security assessments and penetration testing'
    )
  }

  /**
   * Generate access audit
   */
  private async generateAccessAudit(
    report: ComplianceReport,
    options: { tenantId?: string; includeHistoricalData?: boolean }
  ): Promise<void> {
    // Get audit summary
    const auditSummary = await auditTrailsService.getAuditSummary(
      report.periodStart,
      report.periodEnd,
      options.tenantId
    )

    report.findings.access = {
      summary: auditSummary,
      privilegedAccess: await this.analyzePrivilegedAccess(report.periodStart, report.periodEnd, options.tenantId),
      unusualAccessPatterns: await this.analyzeUnusualAccessPatterns(report.periodStart, report.periodEnd, options.tenantId)
    }

    // Count issues based on audit findings
    report.criticalIssues = auditSummary.eventsByRiskLevel.critical || 0
    report.highIssues = auditSummary.eventsByRiskLevel.high || 0
    report.mediumIssues = auditSummary.eventsByRiskLevel.medium || 0
    report.lowIssues = auditSummary.eventsByRiskLevel.low || 0
    report.totalRecordsReviewed = auditSummary.totalEvents

    report.recommendations.push(
      'Review and mitigate critical access violations',
      'Implement additional monitoring for high-risk actions',
      'Establish access review procedures',
      'Enhance audit trail monitoring and alerting'
    )
  }

  /**
   * Generate retention audit
   */
  private async generateRetentionAudit(
    report: ComplianceReport,
    options: { tenantId?: string; includeHistoricalData?: boolean }
  ): Promise<void> {
    const retentionStats = await logRetentionService.getRetentionStats()

    report.findings.retention = {
      policies: retentionStats.policies,
      complianceStatus: await this.checkRetentionCompliance(retentionStats),
      dataCleanupStatus: await this.checkDataCleanupStatus()
    }

    // Simple scoring based on retention stats
    const hasActivePolicies = retentionStats.policies.some(p => p.isActive)
    const hasRecentCleanup = retentionStats.totalDeleted > 0

    if (hasActivePolicies && hasRecentCleanup) {
      report.complianceScore = 85
    } else if (hasActivePolicies) {
      report.complianceScore = 70
      report.mediumIssues = 1
      report.recommendations.push('Implement automated data cleanup procedures')
    } else {
      report.complianceScore = 40
      report.highIssues = 1
      report.recommendations.push('Establish comprehensive data retention policies')
    }

    report.totalRecordsReviewed = retentionStats.totalArchived + retentionStats.totalDeleted
  }

  /**
   * Generate custom audit
   */
  private async generateCustomAudit(
    report: ComplianceReport,
    customChecks: ComplianceCheck[]
  ): Promise<void> {
    report.findings.custom = { checks: customChecks }
    this.processComplianceChecks(report, customChecks)
  }

  // Compliance check implementations

  private async checkDataProcessingConsent(tenantId?: string): Promise<ComplianceCheck> {
    // Check if consent records exist and are properly managed
    const supabase = await createClient()
    const { count } = await supabase
      .from('audit_trails')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'consent_given')

    return {
      checkName: 'Data Processing Consent',
      status: (count || 0) > 0 ? 'pass' : 'fail',
      description: 'Verify that data processing consent is properly collected and managed',
      details: { consentRecords: count || 0 },
      severity: 'high',
      recommendation: 'Implement comprehensive consent management system'
    }
  }

  private async checkDataRetentionCompliance(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<ComplianceCheck> {
    const retentionStats = await logRetentionService.getRetentionStats()

    return {
      checkName: 'Data Retention Compliance',
      status: retentionStats.policies.length > 0 ? 'pass' : 'fail',
      description: 'Verify compliance with data retention policies and schedules',
      details: retentionStats,
      severity: 'high',
      recommendation: 'Establish and enforce data retention policies'
    }
  }

  private async checkDataSubjectRights(tenantId?: string): Promise<ComplianceCheck> {
    // Check if data subject rights are implemented
    const supabase = await createClient()
    const { count } = await supabase
      .from('audit_trails')
      .select('*', { count: 'exact', head: true })
      .in('action', ['data_access_request', 'data_deletion_request', 'data_portability_request'])

    return {
      checkName: 'Data Subject Rights',
      status: (count || 0) > 0 ? 'pass' : 'warning',
      description: 'Verify implementation of data subject rights (access, rectification, erasure, etc.)',
      details: { rightsRequests: count || 0 },
      severity: 'high',
      recommendation: 'Implement data subject rights request processing system'
    }
  }

  private async checkDataBreachNotifications(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<ComplianceCheck> {
    // Check for breach-related audit events
    const supabase = await createClient()
    const { count } = await supabase
      .from('audit_trails')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'data_breach_detected')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())

    return {
      checkName: 'Data Breach Notifications',
      status: (count || 0) === 0 ? 'pass' : 'warning', // No breaches is good, but check if they were handled properly
      description: 'Verify that data breaches are properly detected and notified',
      details: { breachEvents: count || 0 },
      severity: 'critical',
      recommendation: 'Establish breach detection and notification procedures'
    }
  }

  private async checkInternationalDataTransfers(tenantId?: string): Promise<ComplianceCheck> {
    // This would check for international data transfers and adequacy decisions
    return {
      checkName: 'International Data Transfers',
      status: 'warning', // Requires manual verification
      description: 'Verify compliance with international data transfer requirements',
      details: { requiresManualReview: true },
      severity: 'high',
      recommendation: 'Document and verify international data transfer mechanisms'
    }
  }

  private async checkDataMinimization(tenantId?: string): Promise<ComplianceCheck> {
    // Check if data collection is minimized
    return {
      checkName: 'Data Minimization',
      status: 'warning', // Requires manual verification
      description: 'Verify that only necessary data is collected and processed',
      details: { requiresManualReview: true },
      severity: 'medium',
      recommendation: 'Review data collection practices for minimization'
    }
  }

  private async checkPurposeLimitation(tenantId?: string): Promise<ComplianceCheck> {
    // Check if data is used only for specified purposes
    return {
      checkName: 'Purpose Limitation',
      status: 'warning', // Requires manual verification
      description: 'Verify that data is processed only for legitimate purposes',
      details: { requiresManualReview: true },
      severity: 'high',
      recommendation: 'Document and enforce data processing purposes'
    }
  }

  private async checkPrivacyNoticeCompliance(tenantId?: string): Promise<ComplianceCheck> {
    return {
      checkName: 'Privacy Notice Compliance',
      status: 'warning', // Requires manual verification
      description: 'Verify that privacy notices meet CCPA requirements',
      details: { requiresManualReview: true },
      severity: 'high',
      recommendation: 'Review and update privacy notices for CCPA compliance'
    }
  }

  private async checkOptOutMechanisms(tenantId?: string): Promise<ComplianceCheck> {
    const supabase = await createClient()
    const { count } = await supabase
      .from('audit_trails')
      .select('*', { count: 'exact', head: true })
      .in('action', ['opt_out_sale', 'opt_out_sharing'])

    return {
      checkName: 'Opt-out Mechanisms',
      status: (count || 0) > 0 ? 'pass' : 'warning',
      description: 'Verify that opt-out mechanisms are implemented and effective',
      details: { optOutRequests: count || 0 },
      severity: 'high',
      recommendation: 'Implement comprehensive opt-out mechanisms'
    }
  }

  private async checkDataSharingPractices(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<ComplianceCheck> {
    const supabase = await createClient()
    const { count } = await supabase
      .from('audit_trails')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'data_shared')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())

    return {
      checkName: 'Data Sharing Practices',
      status: 'warning', // Requires verification of sharing practices
      description: 'Verify that data sharing practices comply with CCPA',
      details: { sharingEvents: count || 0 },
      severity: 'medium',
      recommendation: 'Document and verify data sharing practices'
    }
  }

  private async checkDataDeletionRequests(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<ComplianceCheck> {
    const supabase = await createClient()
    const { count } = await supabase
      .from('audit_trails')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'data_deletion_request')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())

    return {
      checkName: 'Data Deletion Requests',
      status: (count || 0) > 0 ? 'pass' : 'warning',
      description: 'Verify that data deletion requests are processed properly',
      details: { deletionRequests: count || 0 },
      severity: 'high',
      recommendation: 'Implement data deletion request processing system'
    }
  }

  private async checkDataSaleTracking(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<ComplianceCheck> {
    return {
      checkName: 'Data Sale Tracking',
      status: 'warning', // Requires manual verification
      description: 'Verify that data sales are properly tracked and opt-outs honored',
      details: { requiresManualReview: true },
      severity: 'high',
      recommendation: 'Implement data sale tracking and opt-out verification'
    }
  }

  private async checkAccessControlEffectiveness(tenantId?: string): Promise<ComplianceCheck> {
    const auditSummary = await auditTrailsService.getAuditSummary(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(),
      tenantId
    )

    const unauthorizedAccess = auditSummary.eventsByAction['unauthorized_access'] || 0

    return {
      checkName: 'Access Control Effectiveness',
      status: unauthorizedAccess === 0 ? 'pass' : 'fail',
      description: 'Verify that access controls are effective',
      details: { unauthorizedAccess, totalEvents: auditSummary.totalEvents },
      severity: 'critical',
      recommendation: 'Review and strengthen access control mechanisms'
    }
  }

  private async checkAuthenticationSecurity(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<ComplianceCheck> {
    const supabase = await createClient()
    const { count: failedLogins } = await supabase
      .from('audit_trails')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login_failed')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())

    const { count: successfulLogins } = await supabase
      .from('audit_trails')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login_success')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())

    const failureRate = successfulLogins && successfulLogins > 0 ?
      (failedLogins || 0) / successfulLogins : 0

    return {
      checkName: 'Authentication Security',
      status: failureRate < 0.1 ? 'pass' : 'warning', // Less than 10% failure rate
      description: 'Verify authentication security and brute force protection',
      details: { failedLogins, successfulLogins, failureRate },
      severity: 'high',
      recommendation: 'Implement additional authentication security measures'
    }
  }

  private async checkDataEncryption(tenantId?: string): Promise<ComplianceCheck> {
    // This would check encryption status - simplified for now
    return {
      checkName: 'Data Encryption',
      status: 'warning', // Requires manual verification
      description: 'Verify that data is properly encrypted at rest and in transit',
      details: { requiresManualReview: true },
      severity: 'high',
      recommendation: 'Implement comprehensive data encryption'
    }
  }

  private async checkSecurityMonitoring(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<ComplianceCheck> {
    const supabase = await createClient()
    const { count } = await supabase
      .from('audit_trails')
      .select('*', { count: 'exact', head: true })
      .in('risk_level', ['high', 'critical'])
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())

    return {
      checkName: 'Security Monitoring',
      status: (count || 0) > 0 ? 'pass' : 'warning',
      description: 'Verify that security events are properly monitored and alerted',
      details: { securityEvents: count || 0 },
      severity: 'high',
      recommendation: 'Enhance security monitoring and alerting systems'
    }
  }

  private async checkIncidentResponseCapabilities(tenantId?: string): Promise<ComplianceCheck> {
    return {
      checkName: 'Incident Response',
      status: 'warning', // Requires manual verification
      description: 'Verify that incident response procedures are established',
      details: { requiresManualReview: true },
      severity: 'high',
      recommendation: 'Establish comprehensive incident response procedures'
    }
  }

  private async analyzePrivilegedAccess(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<any> {
    // Analyze privileged access patterns
    const supabase = await createClient()
    const { data } = await supabase
      .from('audit_trails')
      .select('*')
      .in('action', ['admin_login', 'permission_change', 'system_config_change'])
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .limit(100)

    return {
      privilegedActions: data?.length || 0,
      uniqueUsers: [...new Set(data?.map(d => d.user_id) || [])].length,
      actions: data || []
    }
  }

  private async analyzeUnusualAccessPatterns(
    startDate: Date,
    endDate: Date,
    tenantId?: string
  ): Promise<any> {
    // This would implement more sophisticated access pattern analysis
    return {
      unusualPatterns: 0,
      flaggedEvents: []
    }
  }

  private async checkRetentionCompliance(retentionStats: any): Promise<any> {
    return {
      hasActivePolicies: retentionStats.policies.some((p: any) => p.isActive),
      totalPolicies: retentionStats.policies.length,
      complianceStatus: 'compliant' // Simplified
    }
  }

  private async checkDataCleanupStatus(): Promise<any> {
    const retentionStats = await logRetentionService.getRetentionStats()
    return {
      lastCleanup: new Date(), // Would be tracked separately
      recordsProcessed: retentionStats.totalDeleted + retentionStats.totalArchived,
      upcomingCleanups: retentionStats.upcomingDeletions + retentionStats.upcomingArchives
    }
  }

  /**
   * Process compliance checks and update report
   */
  private processComplianceChecks(report: ComplianceReport, checks: ComplianceCheck[]): void {
    for (const check of checks) {
      report.totalRecordsReviewed++

      switch (check.status) {
        case 'fail':
          switch (check.severity) {
            case 'critical':
              report.criticalIssues++
              break
            case 'high':
              report.highIssues++
              break
            case 'medium':
              report.mediumIssues++
              break
            case 'low':
              report.lowIssues++
              break
          }
          break
        case 'warning':
          report.mediumIssues++
          break
      }

      if (check.recommendation) {
        report.recommendations.push(check.recommendation)
      }
    }
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(report: ComplianceReport): number {
    const totalIssues = report.criticalIssues + report.highIssues + report.mediumIssues + report.lowIssues

    if (totalIssues === 0) return 100

    // Weighted scoring: critical=10, high=5, medium=2, low=1
    const weightedIssues = (report.criticalIssues * 10) + (report.highIssues * 5) +
                          (report.mediumIssues * 2) + report.lowIssues

    const maxPossibleIssues = report.totalRecordsReviewed * 10 // Assuming 10 is max weight per check
    const score = Math.max(0, 100 - (weightedIssues / Math.max(maxPossibleIssues, 1)) * 100)

    return Math.round(score)
  }

  /**
   * Save compliance report to database
   */
  private async saveComplianceReport(report: ComplianceReport): Promise<void> {
    const supabase = await createClient()

    await supabase
      .from('compliance_audit_reports')
      .insert({
        report_type: report.reportType,
        period_start: report.periodStart.toISOString(),
        period_end: report.periodEnd.toISOString(),
        generated_by: report.generatedBy,
        generated_at: report.generatedAt.toISOString(),
        status: report.status,
        findings: report.findings,
        recommendations: report.recommendations,
        compliance_score: report.complianceScore,
        critical_issues: report.criticalIssues,
        high_issues: report.highIssues,
        medium_issues: report.mediumIssues,
        low_issues: report.lowIssues,
        total_records_reviewed: report.totalRecordsReviewed,
        approved_by: report.approvedBy,
        approved_at: report.approvedAt?.toISOString(),
        approval_notes: report.approvalNotes,
        next_audit_date: report.nextAuditDate?.toISOString(),
        metadata: report.metadata
      })
  }

  /**
   * Get compliance report history
   */
  async getComplianceReports(
    reportType?: ComplianceReport['reportType'],
    limit: number = 50,
    offset: number = 0
  ): Promise<ComplianceReport[]> {
    const supabase = await createClient()

    let query = supabase
      .from('compliance_audit_reports')
      .select('*')
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (reportType) {
      query = query.eq('report_type', reportType)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(report => ({
      id: report.id,
      reportType: report.report_type,
      periodStart: new Date(report.period_start),
      periodEnd: new Date(report.period_end),
      generatedBy: report.generated_by,
      generatedAt: new Date(report.generated_at),
      status: report.status,
      findings: report.findings || {},
      recommendations: report.recommendations || [],
      complianceScore: report.compliance_score,
      criticalIssues: report.critical_issues,
      highIssues: report.high_issues,
      mediumIssues: report.medium_issues,
      lowIssues: report.low_issues,
      totalRecordsReviewed: report.total_records_reviewed,
      approvedBy: report.approved_by,
      approvedAt: report.approved_at ? new Date(report.approved_at) : undefined,
      approvalNotes: report.approval_notes,
      nextAuditDate: report.next_audit_date ? new Date(report.next_audit_date) : undefined,
      metadata: report.metadata || {}
    }))
  }
}

// Export singleton instance
export const complianceReportingService = ComplianceReportingService.getInstance()

// Scheduled job function
export async function runComplianceAudits(): Promise<void> {
  try {
    const now = new Date()
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0)

    // Generate quarterly compliance reports
    const reports = await Promise.allSettled([
      complianceReportingService.generateComplianceReport('gdpr_audit', quarterStart, quarterEnd, 'system'),
      complianceReportingService.generateComplianceReport('ccpa_audit', quarterStart, quarterEnd, 'system'),
      complianceReportingService.generateComplianceReport('security_audit', quarterStart, quarterEnd, 'system')
    ])

    const successful = reports.filter(r => r.status === 'fulfilled').length
    const failed = reports.filter(r => r.status === 'rejected').length

    await logger.info('Compliance audits completed', {
      totalReports: reports.length,
      successful,
      failed
    })

  } catch (error) {
    await logger.error('Compliance audits failed', { error })
  }
}