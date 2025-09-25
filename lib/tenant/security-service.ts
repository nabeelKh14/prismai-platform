import { createClient } from '@/lib/supabase/server'
import { tenantService } from '@/lib/tenant/tenant-service'
import { logger } from '@/lib/logger'
import { ValidationError, AuthorizationError } from '@/lib/errors'
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { internationalTransferService } from '@/lib/compliance/international-transfers'
import { adequacyDecisionsService } from '@/lib/compliance/adequacy-decisions'
import { transferImpactAssessmentService } from '@/lib/compliance/transfer-impact-assessments'

// Security event types
export type SecurityEventType =
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'password_change'
  | 'permission_change'
  | 'data_access'
  | 'data_export'
  | 'tenant_creation'
  | 'user_invitation'
  | 'security_alert'
  | 'compliance_check'

export interface SecurityEvent {
  id: string
  tenant_id: string
  user_id?: string
  event_type: SecurityEventType
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  ip_address?: string
  user_agent?: string
  metadata: Record<string, any>
  created_at: string
}

export interface ComplianceReport {
  tenant_id: string
  report_period: {
    start: string
    end: string
  }
  compliance_status: 'compliant' | 'non_compliant' | 'needs_review'
  checks: Array<{
    check_name: string
    status: 'pass' | 'fail' | 'warning'
    description: string
    details?: any
  }>
  recommendations: string[]
  generated_at: string
}

export interface DataEncryption {
  encrypt(data: string, tenantId: string): Promise<string>
  decrypt(encryptedData: string, tenantId: string): Promise<string>
  rotateKeys(tenantId: string): Promise<void>
}

export class TenantSecurityService {
  private readonly ALGORITHM = 'aes-256-gcm'
  private readonly KEY_LENGTH = 32
  private readonly IV_LENGTH = 16
  private readonly TAG_LENGTH = 16

  private async getSupabase() {
    return await createClient()
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    tenantId: string,
    eventType: SecurityEventType,
    severity: SecurityEvent['severity'],
    description: string,
    userId?: string,
    metadata?: Record<string, any>,
    request?: any
  ): Promise<void> {
    const supabase = await this.getSupabase()

    const ipAddress = request?.headers?.get?.('x-forwarded-for') ||
                     request?.headers?.get?.('x-real-ip') ||
                     request?.socket?.remoteAddress

    const userAgent = request?.headers?.get?.('user-agent')

    const { error } = await supabase
      .from('security_events')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        event_type: eventType,
        severity,
        description,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: metadata || {},
      })

    if (error) {
      logger.error('Failed to log security event', { error, tenantId, eventType })
    }

    // Check for security alerts
    await this.checkSecurityAlerts(tenantId, eventType, severity, metadata)
  }

  /**
   * Get security events for a tenant
   */
  async getSecurityEvents(
    tenantId: string,
    userId: string,
    filters?: {
      eventType?: SecurityEventType
      severity?: SecurityEvent['severity']
      userId?: string
      dateRange?: { start: string; end: string }
    }
  ): Promise<SecurityEvent[]> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    const supabase = await this.getSupabase()

    let query = supabase
      .from('security_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (filters?.eventType) {
      query = query.eq('event_type', filters.eventType)
    }

    if (filters?.severity) {
      query = query.eq('severity', filters.severity)
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters?.dateRange) {
      query = query
        .gte('created_at', filters.dateRange.start)
        .lte('created_at', filters.dateRange.end)
    }

    const { data: events, error } = await query

    if (error) throw error

    return events || []
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    userId: string,
    period?: { start: string; end: string }
  ): Promise<ComplianceReport> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    const reportPeriod = period || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      end: new Date().toISOString(),
    }

    const checks = await this.runComplianceChecks(tenantId, reportPeriod)
    const complianceStatus = this.determineComplianceStatus(checks)
    const recommendations = this.generateComplianceRecommendations(checks)

    return {
      tenant_id: tenantId,
      report_period: reportPeriod,
      compliance_status: complianceStatus,
      checks,
      recommendations,
      generated_at: new Date().toISOString(),
    }
  }

  /**
   * Encrypt sensitive tenant data
   */
  async encryptData(data: string, tenantId: string): Promise<string> {
    const key = await this.getTenantEncryptionKey(tenantId)
    const iv = randomBytes(this.IV_LENGTH)

    const cipher = createCipheriv(this.ALGORITHM, key, iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    // Return format: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
  }

  /**
   * Decrypt sensitive tenant data
   */
  async decryptData(encryptedData: string, tenantId: string): Promise<string> {
    const key = await this.getTenantEncryptionKey(tenantId)
    const parts = encryptedData.split(':')

    if (parts.length !== 3) {
      throw new ValidationError('Invalid encrypted data format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = createDecipheriv(this.ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * Rotate encryption keys for a tenant
   */
  async rotateEncryptionKeys(tenantId: string, userId: string): Promise<void> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    const supabase = await this.getSupabase()

    // Generate new key
    const newKey = randomBytes(this.KEY_LENGTH).toString('hex')

    // Store new key (in a real implementation, you'd use a key management service)
    const { error } = await supabase
      .from('tenant_encryption_keys')
      .insert({
        tenant_id: tenantId,
        key_hash: createHash('sha256').update(newKey).digest('hex'),
        created_by: userId,
      })

    if (error) throw error

    // Log key rotation
    await this.logSecurityEvent(
      tenantId,
      'security_alert',
      'high',
      'Encryption keys rotated',
      userId,
      { action: 'key_rotation' }
    )

    logger.info('Encryption keys rotated', { tenantId, userId })
  }

  /**
   * Check data residency compliance
   */
  async checkDataResidency(tenantId: string, userId: string): Promise<{
    compliant: boolean
    dataLocations: string[]
    violations: string[]
  }> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    // Get tenant's data residency requirements
    const { data: tenant } = await supabase
      .from('tenants')
      .select('data_residency_requirements')
      .eq('id', tenantId)
      .single()

    const requirements = tenant?.data_residency_requirements || {}

    // Check current data locations (simplified)
    const dataLocations = ['us-east-1'] // In real implementation, check actual data locations

    const violations: string[] = []

    if (requirements.allowed_regions && !requirements.allowed_regions.includes(dataLocations[0])) {
      violations.push(`Data stored in ${dataLocations[0]} but only ${requirements.allowed_regions.join(', ')} allowed`)
    }

    return {
      compliant: violations.length === 0,
      dataLocations,
      violations,
    }
  }

  /**
   * Audit data access patterns
   */
  async auditDataAccess(
    tenantId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    action: 'read' | 'write' | 'delete',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logSecurityEvent(
      tenantId,
      'data_access',
      'low',
      `Data ${action} on ${resourceType}`,
      userId,
      {
        resource_type: resourceType,
        resource_id: resourceId,
        action,
        ...metadata,
      }
    )
  }

  /**
   * Check for suspicious activities
   */
  async detectSuspiciousActivity(tenantId: string): Promise<Array<{
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    detected_at: string
  }>> {
    const supabase = await this.getSupabase()

    const issues: Array<{
      type: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      description: string
      detected_at: string
    }> = []

    // Check for failed login attempts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: failedLogins } = await supabase
      .from('security_events')
      .select('user_id, ip_address')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'login_failure')
      .gte('created_at', oneHourAgo)

    // Group by IP and count failures
    const ipFailures: Record<string, number> = {}
    for (const event of failedLogins || []) {
      const ip = event.ip_address || 'unknown'
      ipFailures[ip] = (ipFailures[ip] || 0) + 1
    }

    for (const [ip, count] of Object.entries(ipFailures)) {
      if (count >= 5) {
        issues.push({
          type: 'brute_force_attempt',
          severity: 'high',
          description: `Multiple failed login attempts from IP ${ip} (${count} attempts)`,
          detected_at: new Date().toISOString(),
        })
      }
    }

    // Check for unusual data access patterns
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: dataAccess } = await supabase
      .from('security_events')
      .select('user_id, metadata')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'data_access')
      .gte('created_at', oneDayAgo)

    // Check for users accessing unusual amounts of data
    const userAccess: Record<string, number> = {}
    for (const event of dataAccess || []) {
      const userId = event.user_id || 'unknown'
      userAccess[userId] = (userAccess[userId] || 0) + 1
    }

    const avgAccess = Object.values(userAccess).reduce((sum, count) => sum + count, 0) / Object.keys(userAccess).length
    for (const [userId, count] of Object.entries(userAccess)) {
      if (count > avgAccess * 3) {
        issues.push({
          type: 'unusual_data_access',
          severity: 'medium',
          description: `User ${userId} has unusual data access patterns (${count} accesses)`,
          detected_at: new Date().toISOString(),
        })
      }
    }

    return issues
  }

  // =====================================
  // INTERNATIONAL TRANSFER SECURITY CONTROLS
  // =====================================

  /**
   * Validate international data transfer
   */
  async validateInternationalTransfer(
    tenantId: string,
    transferData: {
      sourceLocation: string
      destinationLocation: string
      dataCategories: string[]
      transferMechanism: string
      purpose: string
      legalBasis: string
    },
    userId: string
  ): Promise<{
    isAllowed: boolean
    violations: string[]
    recommendations: string[]
    requiredAssessments: string[]
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  }> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const violations: string[] = []
    const recommendations: string[] = []
    const requiredAssessments: string[] = []

    try {
      // Check data residency rules
      const residencyCheck = await this.checkDataResidencyForTransfer(tenantId, transferData)
      if (!residencyCheck.compliant) {
        violations.push(...residencyCheck.violations)
      }

      // Check country adequacy
      const adequacyResult = await adequacyDecisionsService.validateAdequacy(transferData.destinationLocation)
      if (!adequacyResult.isAdequate) {
        violations.push(`Destination country ${transferData.destinationLocation} lacks adequate data protection`)
        recommendations.push('Use Standard Contractual Clauses (SCCs) for this transfer')
        requiredAssessments.push('Transfer Impact Assessment (TIA)')
      }

      // Check if sensitive data requires additional safeguards
      const hasSensitiveData = transferData.dataCategories.some(cat =>
        ['health_data', 'financial_data', 'biometric_data', 'genetic_data'].includes(cat)
      )

      if (hasSensitiveData) {
        recommendations.push('Implement enhanced security measures for sensitive data')
        requiredAssessments.push('Data Protection Impact Assessment (DPIA)')
      }

      // Determine risk level
      const riskLevel = this.calculateTransferRiskLevel(violations, adequacyResult, hasSensitiveData)

      // Log security event
      await this.logSecurityEvent(
        tenantId,
        'data_export',
        riskLevel === 'critical' ? 'high' : 'medium',
        `International transfer validation: ${transferData.sourceLocation} -> ${transferData.destinationLocation}`,
        userId,
        {
          transferData,
          violations: violations.length,
          riskLevel,
          hasSensitiveData
        }
      )

      return {
        isAllowed: violations.length === 0,
        violations,
        recommendations,
        requiredAssessments,
        riskLevel
      }
    } catch (error) {
      logger.error('Failed to validate international transfer', error as Error, {
        tenantId,
        transferData,
        userId
      })

      return {
        isAllowed: false,
        violations: ['Transfer validation failed due to system error'],
        recommendations: ['Contact system administrator'],
        requiredAssessments: ['Manual review required'],
        riskLevel: 'critical'
      }
    }
  }

  /**
   * Enforce data residency for international transfers
   */
  async enforceDataResidency(
    tenantId: string,
    transferData: {
      dataCategories: string[]
      destinationLocation: string
      enforcementLevel: 'warning' | 'block' | 'redirect'
    },
    userId: string
  ): Promise<{
    allowed: boolean
    action: 'allow' | 'block' | 'redirect'
    message: string
    alternativeLocations?: string[]
  }> {
    await tenantService.checkTenantAccess(userId, tenantId)

    try {
      const supabase = await this.getSupabase()

      // Get tenant's data residency rules
      const { data: rules } = await supabase
        .from('data_residency_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)

      let allowed = true
      let action: 'allow' | 'block' | 'redirect' = 'allow'
      let message = 'Transfer allowed'
      const alternativeLocations: string[] = []

      for (const dataCategory of transferData.dataCategories) {
        const applicableRules = rules?.filter(rule =>
          rule.data_category === dataCategory ||
          rule.data_category === 'personal_data'
        ) || []

        for (const rule of applicableRules) {
          // Check if destination is allowed
          if (rule.allowed_countries.length > 0 &&
              !rule.allowed_countries.includes(transferData.destinationLocation)) {
            allowed = false
            action = rule.enforcement_level
            message = `Data residency violation: ${dataCategory} cannot be transferred to ${transferData.destinationLocation}`

            // Find alternative locations
            alternativeLocations.push(...rule.allowed_countries.filter((country: string) =>
              country !== transferData.destinationLocation
            ))
          }

          // Check if destination is explicitly restricted
          if (rule.restricted_countries.includes(transferData.destinationLocation)) {
            allowed = false
            action = 'block'
            message = `Data residency violation: ${dataCategory} is restricted from ${transferData.destinationLocation}`
          }
        }
      }

      // Log enforcement action
      await this.logSecurityEvent(
        tenantId,
        'compliance_check',
        allowed ? 'low' : 'high',
        `Data residency enforcement: ${allowed ? 'allowed' : 'blocked'}`,
        userId,
        {
          transferData,
          action,
          allowed,
          alternativeLocations
        }
      )

      return {
        allowed,
        action,
        message,
        alternativeLocations: alternativeLocations.length > 0 ? alternativeLocations : undefined
      }
    } catch (error) {
      logger.error('Failed to enforce data residency', error as Error, {
        tenantId,
        transferData,
        userId
      })

      return {
        allowed: false,
        action: 'block',
        message: 'Data residency check failed - blocking transfer for security'
      }
    }
  }

  /**
   * Create automated Transfer Impact Assessment
   */
  async createAutomatedTIA(
    tenantId: string,
    transferDetails: {
      destinationCountries: string[]
      dataCategories: string[]
      transferVolume: 'low' | 'medium' | 'high'
      purpose: string
    },
    userId: string
  ): Promise<{
    assessmentId: string
    riskLevel: string
    recommendations: string[]
    requiresManualReview: boolean
  }> {
    await tenantService.checkTenantAccess(userId, tenantId)

    try {
      const assessment = await transferImpactAssessmentService.generateAutomatedTIA(
        tenantId,
        transferDetails,
        userId
      )

      const requiresManualReview = assessment.riskLevel === 'high' || assessment.riskLevel === 'critical'

      // Log TIA creation
      await this.logSecurityEvent(
        tenantId,
        'compliance_check',
        requiresManualReview ? 'high' : 'medium',
        `Automated TIA created for transfer to ${transferDetails.destinationCountries.join(', ')}`,
        userId,
        {
          assessmentId: assessment.id,
          riskLevel: assessment.riskLevel,
          requiresManualReview,
          destinationCountries: transferDetails.destinationCountries
        }
      )

      return {
        assessmentId: assessment.id,
        riskLevel: assessment.riskLevel,
        recommendations: assessment.supplementaryMeasures,
        requiresManualReview
      }
    } catch (error) {
      logger.error('Failed to create automated TIA', error as Error, {
        tenantId,
        transferDetails,
        userId
      })
      throw error
    }
  }

  /**
   * Get transfer security statistics
   */
  async getTransferSecurityStats(
    tenantId: string,
    userId: string,
    period?: { start: string; end: string }
  ): Promise<{
    totalTransfers: number
    blockedTransfers: number
    highRiskTransfers: number
    averageRiskScore: number
    topDestinations: Array<{ country: string; count: number }>
    complianceRate: number
  }> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const reportPeriod = period || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    }

    try {
      const supabase = await this.getSupabase()

      // Get transfer records
      const { data: transfers } = await supabase
        .from('international_transfer_records')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', reportPeriod.start)
        .lte('created_at', reportPeriod.end)

      if (!transfers || transfers.length === 0) {
        return {
          totalTransfers: 0,
          blockedTransfers: 0,
          highRiskTransfers: 0,
          averageRiskScore: 0,
          topDestinations: [],
          complianceRate: 100
        }
      }

      const blockedTransfers = transfers.filter(t => t.status === 'blocked').length
      const highRiskTransfers = transfers.filter(t => t.status === 'failed').length
      const totalRiskScore = transfers.reduce((sum, t) => sum + (t.metadata.riskScore || 0), 0)
      const averageRiskScore = totalRiskScore / transfers.length

      // Get top destinations
      const destinationCounts: Record<string, number> = {}
      transfers.forEach(transfer => {
        destinationCounts[transfer.destination_location] =
          (destinationCounts[transfer.destination_location] || 0) + 1
      })

      const topDestinations = Object.entries(destinationCounts)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const successfulTransfers = transfers.filter(t => t.status === 'completed').length
      const complianceRate = (successfulTransfers / transfers.length) * 100

      return {
        totalTransfers: transfers.length,
        blockedTransfers,
        highRiskTransfers,
        averageRiskScore,
        topDestinations,
        complianceRate
      }
    } catch (error) {
      logger.error('Failed to get transfer security stats', error as Error, {
        tenantId,
        userId,
        period
      })

      return {
        totalTransfers: 0,
        blockedTransfers: 0,
        highRiskTransfers: 0,
        averageRiskScore: 0,
        topDestinations: [],
        complianceRate: 0
      }
    }
  }

  /**
   * Check if transfer requires additional security measures
   */
  async checkTransferSecurityRequirements(
    tenantId: string,
    transferData: {
      dataCategories: string[]
      destinationLocation: string
      transferMechanism: string
    }
  ): Promise<{
    requiresEncryption: boolean
    requiresAuditLogging: boolean
    requiresAccessControls: boolean
    requiresDataMinimization: boolean
    securityMeasures: string[]
  }> {
    const securityMeasures: string[] = []
    let requiresEncryption = false
    let requiresAuditLogging = true // Always required for international transfers
    let requiresAccessControls = true // Always required for international transfers
    let requiresDataMinimization = false

    try {
      // Check if data categories require encryption
      const sensitiveCategories = ['health_data', 'financial_data', 'biometric_data', 'genetic_data']
      requiresEncryption = transferData.dataCategories.some(cat =>
        sensitiveCategories.includes(cat)
      )

      if (requiresEncryption) {
        securityMeasures.push('End-to-end encryption required')
        securityMeasures.push('Encryption key management')
        securityMeasures.push('Secure key exchange protocols')
      }

      // Check destination country risk
      const adequacyResult = await adequacyDecisionsService.validateAdequacy(transferData.destinationLocation)
      if (!adequacyResult.isAdequate) {
        requiresDataMinimization = true
        securityMeasures.push('Data minimization principles')
        securityMeasures.push('Purpose limitation enforcement')
        securityMeasures.push('Regular data retention reviews')
      }

      // Add standard security measures for international transfers
      securityMeasures.push('Comprehensive audit logging')
      securityMeasures.push('Access control and authentication')
      securityMeasures.push('Data classification and labeling')
      securityMeasures.push('Incident response procedures')

      return {
        requiresEncryption,
        requiresAuditLogging,
        requiresAccessControls,
        requiresDataMinimization,
        securityMeasures
      }
    } catch (error) {
      logger.error('Failed to check transfer security requirements', error as Error, {
        tenantId,
        transferData
      })

      // Return conservative defaults on error
      return {
        requiresEncryption: true,
        requiresAuditLogging: true,
        requiresAccessControls: true,
        requiresDataMinimization: true,
        securityMeasures: ['All security measures required due to validation error']
      }
    }
  }

  // =====================================
  // PRIVATE HELPERS
  // =====================================

  private async checkSecurityAlerts(
    tenantId: string,
    eventType: SecurityEventType,
    severity: SecurityEvent['severity'],
    metadata?: Record<string, any>
  ): Promise<void> {
    // Check for critical security events
    if (severity === 'critical') {
      await this.createSecurityAlert(
        tenantId,
        'Critical security event detected',
        `Critical ${eventType} event occurred`,
        metadata
      )
    }

    // Check for brute force patterns
    if (eventType === 'login_failure') {
      await this.checkBruteForceProtection(tenantId, metadata?.ip_address)
    }
  }

  private async createSecurityAlert(
    tenantId: string,
    title: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const supabase = await this.getSupabase()

    await supabase
      .from('tenant_alerts')
      .insert({
        tenant_id: tenantId,
        alert_type: 'security',
        severity: 'high',
        title,
        description,
        status: 'active',
        metadata: metadata || {},
      })
  }

  private async checkBruteForceProtection(tenantId: string, ipAddress?: string): Promise<void> {
    if (!ipAddress) return

    const supabase = await this.getSupabase()

    // Count failed attempts in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('event_type', 'login_failure')
      .eq('ip_address', ipAddress)
      .gte('created_at', oneHourAgo)

    if ((count || 0) >= 5) {
      // Implement rate limiting or blocking
      await this.createSecurityAlert(
        tenantId,
        'Brute Force Attack Detected',
        `Multiple failed login attempts from IP ${ipAddress}`,
        { ip_address: ipAddress, failed_attempts: count }
      )
    }
  }

  private async runComplianceChecks(
    tenantId: string,
    period: { start: string; end: string }
  ): Promise<ComplianceReport['checks']> {
    const supabase = await this.getSupabase()
    const checks: ComplianceReport['checks'] = []

    // Check data encryption
    const { data: encryptionKeys } = await supabase
      .from('tenant_encryption_keys')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)

    const lastKeyRotation = encryptionKeys?.[0]?.created_at
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    checks.push({
      check_name: 'data_encryption',
      status: lastKeyRotation && new Date(lastKeyRotation) > ninetyDaysAgo ? 'pass' : 'fail',
      description: 'Data encryption keys must be rotated every 90 days',
      details: { last_rotation: lastKeyRotation },
    })

    // Check audit logging
    const { count: auditEvents } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', period.start)
      .lte('created_at', period.end)

    checks.push({
      check_name: 'audit_logging',
      status: (auditEvents || 0) > 0 ? 'pass' : 'fail',
      description: 'Security events must be logged and monitored',
      details: { events_logged: auditEvents },
    })

    // Check user access reviews
    const { data: users } = await supabase
      .from('tenant_users')
      .select('last_access_review')
      .eq('tenant_id', tenantId)

    const usersNeedingReview = users?.filter(u =>
      !u.last_access_review ||
      new Date(u.last_access_review) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    ).length || 0

    checks.push({
      check_name: 'access_reviews',
      status: usersNeedingReview === 0 ? 'pass' : 'warning',
      description: 'User access must be reviewed every 90 days',
      details: { users_needing_review: usersNeedingReview },
    })

    return checks
  }

  private determineComplianceStatus(checks: ComplianceReport['checks']): ComplianceReport['compliance_status'] {
    const failures = checks.filter(c => c.status === 'fail').length
    const warnings = checks.filter(c => c.status === 'warning').length

    if (failures > 0) return 'non_compliant'
    if (warnings > 0) return 'needs_review'
    return 'compliant'
  }

  private generateComplianceRecommendations(checks: ComplianceReport['checks']): string[] {
    const recommendations: string[] = []

    for (const check of checks) {
      if (check.status === 'fail') {
        switch (check.check_name) {
          case 'data_encryption':
            recommendations.push('Rotate encryption keys immediately')
            break
          case 'audit_logging':
            recommendations.push('Enable comprehensive audit logging')
            break
          case 'access_reviews':
            recommendations.push('Conduct user access reviews for all team members')
            break
        }
      }
    }

    return recommendations
  }

  private async getTenantEncryptionKey(tenantId: string): Promise<Buffer> {
    // In a real implementation, you'd retrieve the key from a secure key management service
    // For now, we'll use a tenant-specific key derivation
    const keyMaterial = `tenant-${tenantId}-encryption-key`
    return createHash('sha256').update(keyMaterial).digest().slice(0, this.KEY_LENGTH)
  }

  private async checkDataResidencyForTransfer(
    tenantId: string,
    transferData: {
      sourceLocation: string
      destinationLocation: string
      dataCategories: string[]
      transferMechanism: string
      purpose: string
      legalBasis: string
    }
  ): Promise<{
    compliant: boolean
    violations: string[]
  }> {
    const supabase = await this.getSupabase()

    // Get tenant's data residency rules
    const { data: rules } = await supabase
      .from('data_residency_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    const violations: string[] = []

    for (const dataCategory of transferData.dataCategories) {
      const applicableRules = rules?.filter(rule =>
        rule.data_category === dataCategory ||
        rule.data_category === 'personal_data'
      ) || []

      for (const rule of applicableRules) {
        // Check if destination is allowed
        if (rule.allowed_countries.length > 0 &&
            !rule.allowed_countries.includes(transferData.destinationLocation)) {
          violations.push(`${dataCategory} cannot be transferred to ${transferData.destinationLocation}`)
        }

        // Check if destination is explicitly restricted
        if (rule.restricted_countries.includes(transferData.destinationLocation)) {
          violations.push(`${dataCategory} is restricted from ${transferData.destinationLocation}`)
        }
      }
    }

    return {
      compliant: violations.length === 0,
      violations
    }
  }

  private calculateTransferRiskLevel(
    violations: string[],
    adequacyResult: { isAdequate: boolean; requiresAdditionalSafeguards: boolean },
    hasSensitiveData: boolean
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length > 0) return 'critical'
    if (!adequacyResult.isAdequate) return 'high'
    if (adequacyResult.requiresAdditionalSafeguards || hasSensitiveData) return 'medium'
    return 'low'
  }
}

// Export singleton instance
export const tenantSecurityService = new TenantSecurityService()