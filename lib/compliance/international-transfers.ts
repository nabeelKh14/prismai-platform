import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'
import { accessControlService } from '@/lib/security/access-control'

export interface InternationalTransferRecord {
  id: string
  tenantId: string
  transferType: 'data_export' | 'data_import' | 'api_call' | 'database_replication' | 'backup' | 'third_party_access'
  sourceLocation: string
  destinationLocation: string
  dataVolumeBytes: number
  recordCount: number
  transferMechanism: 'adequacy' | 'scc' | 'binding_corporate_rules' | 'certification' | 'derogation'
  sccApplicationId?: string
  tiaAssessmentId?: string
  purpose: string
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_interest' | 'legitimate_interest'
  dataCategories: string[]
  retentionPeriodDays?: number
  status: 'initiated' | 'in_progress' | 'completed' | 'failed' | 'blocked'
  errorMessage?: string
  metadata: Record<string, any>
  createdAt: Date
  completedAt?: Date
}

export interface TransferValidationResult {
  isAllowed: boolean
  enforcementLevel: 'warning' | 'block' | 'redirect'
  requiredMechanism: string
  ruleName: string
  violations: string[]
  recommendations: string[]
}

export interface TransferAuditEntry {
  id: string
  tenantId: string
  transferRecordId: string
  userId?: string
  action: 'initiate' | 'approve' | 'deny' | 'complete' | 'fail' | 'block' | 'review'
  resourceType: string
  resourceId: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  changeDescription: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  complianceFlags: Record<string, any>
  createdAt: Date
}

export class InternationalTransferService {
  private supabase = createClient()

  // GDPR-compliant transfer mechanisms
  private validTransferMechanisms = {
    adequacy: ['GB', 'CA', 'JP', 'KR', 'CH', 'NZ', 'UY', 'AR'], // Countries with adequacy decisions
    scc: ['US', 'IN', 'BR', 'SG', 'AU', 'HK'], // Countries requiring SCCs
    binding_corporate_rules: ['internal_transfers'],
    certification: ['privacy_shield_certified'],
    derogation: ['occasional_transfers']
  }

  // Data categories that require special handling
  private sensitiveDataCategories = [
    'personal_data',
    'sensitive_data',
    'health_data',
    'financial_data',
    'biometric_data',
    'genetic_data',
    'criminal_conviction_data'
  ]

  /**
   * Initiate an international data transfer
   */
  async initiateTransfer(
    tenantId: string,
    transferData: Omit<InternationalTransferRecord, 'id' | 'tenantId' | 'createdAt' | 'completedAt' | 'status'>,
    initiatedBy: string
  ): Promise<InternationalTransferRecord> {
    try {
      // Validate transfer permissions
      const hasPermission = await accessControlService.hasPermission(
        initiatedBy,
        'international_transfer',
        'write'
      )

      if (!hasPermission) {
        throw new Error('Insufficient permissions to initiate international transfer')
      }

      // Pre-validate the transfer
      const validation = await this.validateTransfer(tenantId, transferData)
      if (!validation.isAllowed && validation.enforcementLevel === 'block') {
        throw new Error(`Transfer blocked: ${validation.violations.join(', ')}`)
      }

      // Create transfer record
      const transferRecord: Omit<InternationalTransferRecord, 'id'> = {
        ...transferData,
        tenantId,
        status: 'initiated',
        createdAt: new Date()
      }

      const supabase = await this.supabase
      const { data, error } = await supabase
        .from('international_transfer_records')
        .insert(transferRecord)
        .select()
        .single()

      if (error) throw error

      // Log the initiation
      await this.logTransferAudit(tenantId, data.id, initiatedBy, 'initiate', 'transfer_record', data.id, 'Transfer initiated', undefined, transferData)

      // Log security audit
      SecurityAudit.logSensitiveAction('international_transfer_initiated', initiatedBy, {
        transferId: data.id,
        source: transferData.sourceLocation,
        destination: transferData.destinationLocation,
        mechanism: transferData.transferMechanism,
        validationResult: validation
      })

      logger.info('International transfer initiated', {
        transferId: data.id,
        source: transferData.sourceLocation,
        destination: transferData.destinationLocation,
        initiatedBy
      })

      return data
    } catch (error) {
      logger.error('Failed to initiate international transfer', error as Error, {
        tenantId,
        transferData,
        initiatedBy
      })
      throw error
    }
  }

  /**
   * Validate a transfer against data residency rules and compliance requirements
   */
  async validateTransfer(
    tenantId: string,
    transferData: Partial<InternationalTransferRecord>
  ): Promise<TransferValidationResult> {
    const violations: string[] = []
    const recommendations: string[] = []

    try {
      // Check data residency rules
      for (const dataCategory of transferData.dataCategories || []) {
        const residencyResult = await this.checkDataResidency(tenantId, dataCategory, transferData.destinationLocation!)
        if (!residencyResult.isAllowed) {
          violations.push(`Data residency violation for ${dataCategory}: ${residencyResult.ruleName}`)
        }
        if (residencyResult.enforcementLevel === 'warning') {
          recommendations.push(`Consider ${residencyResult.requiredMechanism} for ${dataCategory}`)
        }
      }

      // Check if destination country requires specific mechanisms
      const countryAdequacy = await this.checkCountryAdequacy(transferData.destinationLocation!)
      if (!countryAdequacy.isAdequate && transferData.transferMechanism === 'adequacy') {
        violations.push(`Country ${transferData.destinationLocation} does not have adequacy decision`)
        recommendations.push('Use Standard Contractual Clauses (SCCs) instead')
      }

      // Validate sensitive data transfers
      const hasSensitiveData = transferData.dataCategories?.some(cat =>
        this.sensitiveDataCategories.includes(cat)
      )

      if (hasSensitiveData && transferData.transferMechanism === 'adequacy') {
        recommendations.push('Consider enhanced safeguards for sensitive data transfers')
      }

      // Check transfer mechanism validity
      if (!this.isValidTransferMechanism(transferData.transferMechanism!, transferData.destinationLocation!)) {
        violations.push(`Invalid transfer mechanism ${transferData.transferMechanism} for destination ${transferData.destinationLocation}`)
      }

      return {
        isAllowed: violations.length === 0,
        enforcementLevel: violations.length > 0 ? 'block' : 'warning',
        requiredMechanism: this.getRequiredMechanism(transferData.destinationLocation!),
        ruleName: 'GDPR Transfer Validation',
        violations,
        recommendations
      }
    } catch (error) {
      logger.error('Failed to validate transfer', error as Error, { tenantId, transferData })
      return {
        isAllowed: false,
        enforcementLevel: 'block',
        requiredMechanism: 'scc',
        ruleName: 'Error in Validation',
        violations: ['Validation failed due to system error'],
        recommendations: ['Contact system administrator']
      }
    }
  }

  /**
   * Execute the actual data transfer (placeholder for actual implementation)
   */
  async executeTransfer(transferId: string, executedBy: string): Promise<InternationalTransferRecord> {
    try {
      const hasPermission = await accessControlService.hasPermission(
        executedBy,
        'international_transfer',
        'write'
      )

      if (!hasPermission) {
        throw new Error('Insufficient permissions to execute transfer')
      }

      const supabase = await this.supabase

      // Update transfer status to in_progress
      const { data: transfer, error: updateError } = await supabase
        .from('international_transfer_records')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .select()
        .single()

      if (updateError) throw updateError

      // Log the execution
      await this.logTransferAudit(
        transfer.tenant_id,
        transferId,
        executedBy,
        'approve',
        'transfer_record',
        transferId,
        'Transfer execution started',
        { status: 'initiated' },
        { status: 'in_progress' }
      )

      // Here you would implement the actual transfer logic
      // For now, we'll simulate a successful transfer
      const completedTransfer = await this.completeTransfer(transferId, executedBy, {
        dataVolumeBytes: transfer.data_volume_bytes,
        recordCount: transfer.record_count
      })

      return completedTransfer
    } catch (error) {
      logger.error('Failed to execute transfer', error as Error, { transferId, executedBy })

      // Mark as failed
      await this.failTransfer(transferId, executedBy, (error as Error).message)
      throw error
    }
  }

  /**
   * Complete a successful transfer
   */
  async completeTransfer(
    transferId: string,
    completedBy: string,
    result: { dataVolumeBytes: number; recordCount: number }
  ): Promise<InternationalTransferRecord> {
    const supabase = await this.supabase

    const { data, error } = await supabase
      .from('international_transfer_records')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        data_volume_bytes: result.dataVolumeBytes,
        record_count: result.recordCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', transferId)
      .select()
      .single()

    if (error) throw error

    await this.logTransferAudit(
      data.tenant_id,
      transferId,
      completedBy,
      'complete',
      'transfer_record',
      transferId,
      'Transfer completed successfully',
      { status: 'in_progress' },
      { status: 'completed', completed_at: data.completed_at }
    )

    SecurityAudit.logSensitiveAction('international_transfer_completed', completedBy, {
      transferId,
      dataVolumeBytes: result.dataVolumeBytes,
      recordCount: result.recordCount
    })

    logger.info('International transfer completed', {
      transferId,
      completedBy,
      dataVolumeBytes: result.dataVolumeBytes,
      recordCount: result.recordCount
    })

    return data
  }

  /**
   * Mark a transfer as failed
   */
  async failTransfer(transferId: string, failedBy: string, errorMessage: string): Promise<void> {
    const supabase = await this.supabase

    const { error } = await supabase
      .from('international_transfer_records')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', transferId)

    if (error) throw error

    await this.logTransferAudit(
      '', // We'll get tenant_id from the record
      transferId,
      failedBy,
      'fail',
      'transfer_record',
      transferId,
      `Transfer failed: ${errorMessage}`,
      { status: 'in_progress' },
      { status: 'failed', error_message: errorMessage }
    )

    SecurityAudit.logSensitiveAction('international_transfer_failed', failedBy, {
      transferId,
      errorMessage
    })

    logger.error('International transfer failed', {
      transferId,
      failedBy,
      errorMessage
    })
  }

  /**
   * Get transfer statistics for compliance reporting
   */
  async getTransferStats(tenantId: string): Promise<{
    totalTransfers: number
    transfersByMechanism: Record<string, number>
    transfersByDestination: Record<string, number>
    failedTransfers: number
    pendingApprovals: number
    monthlyVolume: number
  }> {
    const supabase = await this.supabase

    // Get all transfers for the tenant
    const { data: transfers, error } = await supabase
      .from('international_transfer_records')
      .select('*')
      .eq('tenant_id', tenantId)

    if (error) throw error

    const stats = {
      totalTransfers: transfers?.length || 0,
      transfersByMechanism: {} as Record<string, number>,
      transfersByDestination: {} as Record<string, number>,
      failedTransfers: 0,
      pendingApprovals: 0,
      monthlyVolume: 0
    }

    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    for (const transfer of transfers || []) {
      // Count by mechanism
      stats.transfersByMechanism[transfer.transfer_mechanism] =
        (stats.transfersByMechanism[transfer.transfer_mechanism] || 0) + 1

      // Count by destination
      stats.transfersByDestination[transfer.destination_location] =
        (stats.transfersByDestination[transfer.destination_location] || 0) + 1

      // Count failures
      if (transfer.status === 'failed') {
        stats.failedTransfers++
      }

      // Count pending (initiated but not completed)
      if (transfer.status === 'initiated') {
        stats.pendingApprovals++
      }

      // Calculate monthly volume
      if (transfer.created_at.startsWith(currentMonth) && transfer.status === 'completed') {
        stats.monthlyVolume += transfer.data_volume_bytes
      }
    }

    return stats
  }

  /**
   * Private helper methods
   */
  private async checkDataResidency(
    tenantId: string,
    dataCategory: string,
    destinationCountry: string
  ): Promise<{ isAllowed: boolean; enforcementLevel: string; requiredMechanism: string; ruleName: string }> {
    const supabase = await this.supabase

    const { data, error } = await supabase
      .rpc('validate_data_residency', {
        tenant_id_param: tenantId,
        data_category_param: dataCategory,
        destination_country_param: destinationCountry
      })

    if (error) throw error
    return data[0]
  }

  private async checkCountryAdequacy(countryCode: string): Promise<{ isAdequate: boolean; status: string; decisionDate: Date; restrictions: string[] }> {
    const supabase = await this.supabase

    const { data, error } = await supabase
      .rpc('check_country_adequacy', { country_code_param: countryCode })

    if (error) throw error
    return data[0]
  }

  private isValidTransferMechanism(mechanism: string, destinationCountry: string): boolean {
    if (mechanism === 'adequacy') {
      return this.validTransferMechanisms.adequacy.includes(destinationCountry)
    }
    if (mechanism === 'scc') {
      return this.validTransferMechanisms.scc.includes(destinationCountry)
    }
    return true // For other mechanisms, assume valid
  }

  private getRequiredMechanism(destinationCountry: string): string {
    if (this.validTransferMechanisms.adequacy.includes(destinationCountry)) {
      return 'adequacy'
    }
    return 'scc'
  }

  private async logTransferAudit(
    tenantId: string,
    transferRecordId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    changeDescription: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<void> {
    const supabase = await this.supabase

    const auditEntry: Omit<TransferAuditEntry, 'id'> = {
      tenantId,
      transferRecordId,
      userId,
      action: action as any,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      changeDescription,
      complianceFlags: {
        gdpr_article_46: true,
        transfer_mechanism_compliant: true,
        audit_logged: true
      },
      createdAt: new Date()
    }

    const { error } = await supabase
      .from('transfer_audit_logs')
      .insert(auditEntry)

    if (error) {
      logger.error('Failed to log transfer audit', error as Error, { auditEntry })
    }
  }
}

// Export singleton instance
export const internationalTransferService = new InternationalTransferService()