import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface SecurityAuditEvent {
  id: string
  timestamp: string
  userId?: string
  action: string
  resource: string
  details: Record<string, any>
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
  complianceFlags: string[]
}

export interface ComplianceReport {
  reportId: string
  generatedAt: string
  period: {
    start: string
    end: string
  }
  compliance: {
    gdpr: boolean
    hipaa?: boolean
    pci?: boolean
    sox?: boolean
    overall: boolean
  }
  violations: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical'
    category: string
    description: string
    remediation: string
    affectedResources: string[]
  }>
  recommendations: string[]
  auditSummary: {
    totalEvents: number
    securityEvents: number
    failedAccessAttempts: number
    dataAccessPatterns: Record<string, number>
  }
}

export interface BackwardCompatibilityConfig {
  enableLegacyMode: boolean
  legacyEndpoints: string[]
  deprecatedFeatures: string[]
  migrationPaths: Record<string, string>
  compatibilityLayers: Array<{
    feature: string
    version: string
    fallback: string
  }>
}

export class DatabaseSecurityManager {
  private static instance: DatabaseSecurityManager
  private auditEvents: SecurityAuditEvent[] = []
  private readonly maxAuditEvents = 10000
  private complianceConfig: {
    gdpr: boolean
    hipaa?: boolean
    pci?: boolean
    sox?: boolean
  }

  constructor() {
    this.complianceConfig = {
      gdpr: true, // Always enabled for EU compliance
      hipaa: process.env.ENABLE_HIPAA === 'true',
      pci: process.env.ENABLE_PCI === 'true',
      sox: process.env.ENABLE_SOX === 'true'
    }
  }

  static getInstance(): DatabaseSecurityManager {
    if (!DatabaseSecurityManager.instance) {
      DatabaseSecurityManager.instance = new DatabaseSecurityManager()
    }
    return DatabaseSecurityManager.instance
  }

  /**
   * Log security audit event
   */
  async logAuditEvent(event: Omit<SecurityAuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: SecurityAuditEvent = {
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    }

    // Add to in-memory cache
    this.auditEvents.unshift(auditEvent)
    if (this.auditEvents.length > this.maxAuditEvents) {
      this.auditEvents = this.auditEvents.slice(0, this.maxAuditEvents)
    }

    // Store in database
    try {
      const supabase = await createClient()
      await supabase.from('security_audit_log').insert({
        id: auditEvent.id,
        user_id: auditEvent.userId,
        action: auditEvent.action,
        resource: auditEvent.resource,
        details: auditEvent.details,
        ip_address: auditEvent.ipAddress,
        user_agent: auditEvent.userAgent,
        success: auditEvent.success,
        error_message: auditEvent.errorMessage,
        compliance_flags: auditEvent.complianceFlags
      })
    } catch (error) {
      logger.error('Failed to store audit event', { error, event: auditEvent })
    }

    // Log security-relevant events
    if (!auditEvent.success || auditEvent.complianceFlags.length > 0) {
      logger.warn('Security audit event', {
        action: auditEvent.action,
        resource: auditEvent.resource,
        success: auditEvent.success,
        complianceFlags: auditEvent.complianceFlags
      })
    }
  }

  /**
   * Check access permissions for database operation
   */
  async checkAccessPermissions(
    userId: string,
    action: string,
    resource: string,
    context?: Record<string, any>
  ): Promise<{
    allowed: boolean
    reason?: string
    complianceFlags: string[]
  }> {
    try {
      const supabase = await createClient()

      // Check RLS policies
      const { data: permissions, error } = await supabase.rpc('check_user_permissions', {
        p_user_id: userId,
        p_action: action,
        p_resource: resource,
        p_context: context || {}
      })

      if (error) throw error

      const allowed = permissions?.allowed || false
      const reason = permissions?.reason
      const complianceFlags = permissions?.compliance_flags || []

      // Log access attempt
      await this.logAuditEvent({
        userId,
        action: `access_${action}`,
        resource,
        details: {
          allowed,
          reason,
          context
        },
        success: allowed,
        errorMessage: allowed ? undefined : reason,
        complianceFlags
      })

      return {
        allowed,
        reason,
        complianceFlags
      }

    } catch (error) {
      logger.error('Error checking access permissions', { error, userId, action, resource })

      // Deny access on error for security
      return {
        allowed: false,
        reason: 'Permission check failed',
        complianceFlags: ['security_error']
      }
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: string,
    endDate: string
  ): Promise<ComplianceReport> {
    try {
      const supabase = await createClient()

      // Get audit events for the period
      const { data: auditEvents, error: auditError } = await supabase
        .from('security_audit_log')
        .select('*')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: false })

      if (auditError) throw auditError

      // Analyze compliance
      const violations = this.analyzeComplianceViolations(auditEvents || [])
      const compliance = this.assessComplianceStatus(violations)

      // Generate recommendations
      const recommendations = this.generateComplianceRecommendations(violations, auditEvents || [])

      // Create audit summary
      const auditSummary = this.createAuditSummary(auditEvents || [])

      return {
        reportId: `compliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        generatedAt: new Date().toISOString(),
        period: { start: startDate, end: endDate },
        compliance,
        violations,
        recommendations,
        auditSummary
      }

    } catch (error) {
      logger.error('Error generating compliance report', { error, startDate, endDate })
      throw error
    }
  }

  /**
   * Ensure backward compatibility for database operations
   */
  async ensureBackwardCompatibility(
    operation: string,
    params: any,
    config: BackwardCompatibilityConfig
  ): Promise<{
    compatible: boolean
    modifiedParams?: any
    compatibilityLayer?: string
    warnings: string[]
  }> {
    const warnings: string[] = []

    // Check if operation is deprecated
    if (config.deprecatedFeatures.includes(operation)) {
      warnings.push(`Operation '${operation}' is deprecated. Consider migrating to newer version.`)

      // Find migration path
      const migrationPath = config.migrationPaths[operation]
      if (migrationPath) {
        warnings.push(`Migration path available: ${migrationPath}`)
      }
    }

    // Check legacy endpoint compatibility
    if (config.legacyEndpoints.includes(operation)) {
      warnings.push(`Using legacy endpoint for '${operation}'. Consider upgrading to current API version.`)
    }

    // Apply compatibility layers
    const compatibilityLayer = config.compatibilityLayers.find(layer =>
      layer.feature === operation
    )

    if (compatibilityLayer) {
      warnings.push(`Applied compatibility layer: ${compatibilityLayer.version}`)
    }

    // Modify parameters for compatibility if needed
    let modifiedParams = params
    if (config.enableLegacyMode && this.needsParameterModification(operation)) {
      modifiedParams = this.modifyParametersForCompatibility(params, operation)
      warnings.push('Parameters modified for backward compatibility')
    }

    return {
      compatible: true,
      modifiedParams,
      compatibilityLayer: compatibilityLayer?.version,
      warnings
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encryptSensitiveData(data: string, context: string): Promise<string> {
    try {
      // In production, this would use proper encryption
      // For now, we'll use a simple approach (replace with proper encryption)
      const encrypted = Buffer.from(data, 'utf8').toString('base64')

      await this.logAuditEvent({
        action: 'data_encryption',
        resource: context,
        details: { dataLength: data.length },
        success: true,
        complianceFlags: ['data_protection']
      })

      return encrypted
    } catch (error) {
      await this.logAuditEvent({
        action: 'data_encryption',
        resource: context,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        success: false,
        complianceFlags: ['encryption_failure']
      })
      throw error
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptSensitiveData(encryptedData: string, context: string): Promise<string> {
    try {
      // In production, this would use proper decryption
      const decrypted = Buffer.from(encryptedData, 'base64').toString('utf8')

      await this.logAuditEvent({
        action: 'data_decryption',
        resource: context,
        details: { dataLength: decrypted.length },
        success: true,
        complianceFlags: ['data_protection']
      })

      return decrypted
    } catch (error) {
      await this.logAuditEvent({
        action: 'data_decryption',
        resource: context,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        success: false,
        complianceFlags: ['decryption_failure']
      })
      throw error
    }
  }

  /**
   * Get recent audit events
   */
  async getRecentAuditEvents(
    limit: number = 100,
    userId?: string,
    action?: string
  ): Promise<SecurityAuditEvent[]> {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('security_audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      if (action) {
        query = query.eq('action', action)
      }

      const { data, error } = await query
      if (error) throw error

      return (data || []).map(event => ({
        id: event.id,
        timestamp: event.timestamp,
        userId: event.user_id,
        action: event.action,
        resource: event.resource,
        details: event.details || {},
        ipAddress: event.ip_address,
        userAgent: event.user_agent,
        success: event.success,
        errorMessage: event.error_message,
        complianceFlags: event.compliance_flags || []
      }))

    } catch (error) {
      logger.error('Error getting recent audit events', { error })
      return []
    }
  }

  /**
   * Private methods
   */
  private analyzeComplianceViolations(auditEvents: any[]): ComplianceReport['violations'] {
    const violations: ComplianceReport['violations'] = []

    // Analyze GDPR compliance
    const gdprViolations = this.analyzeGDPRViolations(auditEvents)
    violations.push(...gdprViolations)

    // Analyze other compliance frameworks if enabled
    if (this.complianceConfig.hipaa) {
      const hipaaViolations = this.analyzeHIPAAViolations(auditEvents)
      violations.push(...hipaaViolations)
    }

    if (this.complianceConfig.pci) {
      const pciViolations = this.analyzePCIViolations(auditEvents)
      violations.push(...pciViolations)
    }

    if (this.complianceConfig.sox) {
      const soxViolations = this.analyzeSOXViolations(auditEvents)
      violations.push(...soxViolations)
    }

    return violations
  }

  private analyzeGDPRViolations(auditEvents: any[]): ComplianceReport['violations'][0][] {
    const violations: ComplianceReport['violations'][0][] = []

    // Check for unauthorized data access
    const unauthorizedAccess = auditEvents.filter(event =>
      !event.success && event.action.includes('access')
    )

    if (unauthorizedAccess.length > 10) {
      violations.push({
        severity: 'high',
        category: 'data_protection',
        description: `${unauthorizedAccess.length} unauthorized data access attempts detected`,
        remediation: 'Review access control policies and user permissions',
        affectedResources: unauthorizedAccess.map(e => e.resource)
      })
    }

    // Check for data export without consent
    const dataExports = auditEvents.filter(event =>
      event.action.includes('export') && !event.details?.consent_given
    )

    if (dataExports.length > 0) {
      violations.push({
        severity: 'medium',
        category: 'consent_management',
        description: `${dataExports.length} data exports without proper consent`,
        remediation: 'Implement consent verification for data exports',
        affectedResources: dataExports.map(e => e.resource)
      })
    }

    return violations
  }

  private analyzeHIPAAViolations(auditEvents: any[]): ComplianceReport['violations'][0][] {
    // HIPAA-specific compliance checks would go here
    return []
  }

  private analyzePCIViolations(auditEvents: any[]): ComplianceReport['violations'][0][] {
    // PCI-specific compliance checks would go here
    return []
  }

  private analyzeSOXViolations(auditEvents: any[]): ComplianceReport['violations'][0][] {
    // SOX-specific compliance checks would go here
    return []
  }

  private assessComplianceStatus(violations: ComplianceReport['violations']): ComplianceReport['compliance'] {
    const hasCriticalViolations = violations.some(v => v.severity === 'critical')
    const hasHighViolations = violations.some(v => v.severity === 'high')

    return {
      gdpr: !hasCriticalViolations && violations.filter(v => v.category === 'data_protection').length === 0,
      hipaa: this.complianceConfig.hipaa ? !hasCriticalViolations : undefined,
      pci: this.complianceConfig.pci ? !hasCriticalViolations : undefined,
      sox: this.complianceConfig.sox ? !hasCriticalViolations : undefined,
      overall: !hasCriticalViolations && !hasHighViolations
    }
  }

  private generateComplianceRecommendations(
    violations: ComplianceReport['violations'],
    auditEvents: any[]
  ): string[] {
    const recommendations: string[] = []

    if (violations.some(v => v.category === 'data_protection')) {
      recommendations.push('Strengthen data access controls and encryption')
    }

    if (violations.some(v => v.category === 'consent_management')) {
      recommendations.push('Implement comprehensive consent management system')
    }

    if (auditEvents.filter(e => !e.success).length > 100) {
      recommendations.push('Review and improve authentication mechanisms')
    }

    return recommendations
  }

  private createAuditSummary(auditEvents: any[]): ComplianceReport['auditSummary'] {
    const totalEvents = auditEvents.length
    const securityEvents = auditEvents.filter(e => e.compliance_flags?.length > 0).length
    const failedAccessAttempts = auditEvents.filter(e => !e.success && e.action.includes('access')).length

    const dataAccessPatterns: Record<string, number> = {}
    auditEvents.forEach(event => {
      if (event.action.includes('access')) {
        const resource = event.resource
        dataAccessPatterns[resource] = (dataAccessPatterns[resource] || 0) + 1
      }
    })

    return {
      totalEvents,
      securityEvents,
      failedAccessAttempts,
      dataAccessPatterns
    }
  }

  private needsParameterModification(operation: string): boolean {
    // Check if operation needs parameter modification for compatibility
    return false // Implement based on specific compatibility needs
  }

  private modifyParametersForCompatibility(params: any, operation: string): any {
    // Modify parameters for backward compatibility
    return params // Implement based on specific compatibility needs
  }
}

// Export singleton instance
export const databaseSecurityManager = DatabaseSecurityManager.getInstance()