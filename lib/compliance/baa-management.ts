import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'
import { baaTemplateService, BAATemplate, BAATemplateVersion } from './baa-templates'

export interface BAAAgreement {
  id: string
  userId: string
  templateId: string
  templateVersionId: string
  vendorName: string
  vendorContactName?: string
  vendorContactEmail?: string
  vendorContactPhone?: string
  vendorAddress?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  agreementNumber: string
  effectiveDate: Date
  expirationDate: Date
  renewalNoticeDays: number
  status: 'draft' | 'review' | 'pending_signature' | 'executed' | 'expired' | 'terminated' | 'renewed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  customVariables: Record<string, any>
  customizedContent?: {
    sections: Array<{
      title: string
      content: string
      order: number
    }>
  }
  executedAt?: Date
  executedBy?: string
  executionMethod?: 'electronic' | 'wet_signature' | 'verbal'
  tags: string[]
  notes?: string
  attachments: Array<{
    name: string
    url: string
    type: string
    uploadedAt: Date
  }>
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface BAALifecycleEvent {
  id: string
  agreementId: string
  eventType: 'created' | 'updated' | 'submitted_for_review' | 'approved' | 'executed' | 'expired' | 'renewed' | 'terminated' | 'draft' | 'review' | 'pending_signature'
  eventDate: Date
  performedBy: string
  notes?: string
  metadata?: Record<string, any>
}

export class BAAManagementService {
  private supabase = createClient()

  /**
   * Create a new BAA agreement from template
   * HIPAA Compliance: Ensures proper initialization with audit trail
   */
  async createAgreement(
    userId: string,
    agreementData: {
      templateId: string
      vendorName: string
      vendorContactName?: string
      vendorContactEmail?: string
      vendorContactPhone?: string
      vendorAddress?: BAAAgreement['vendorAddress']
      effectiveDate: Date
      expirationDate: Date
      renewalNoticeDays?: number
      priority?: BAAAgreement['priority']
      customVariables?: Record<string, any>
      tags?: string[]
      notes?: string
    }
  ): Promise<BAAAgreement> {
    try {
      const supabase = await this.supabase

      // Get template with current version
      const templateService = await baaTemplateService
      const { template, versions } = await templateService.getTemplateWithVersions(userId, agreementData.templateId)
      const currentVersion = versions.find(v => v.isCurrent)

      if (!currentVersion) {
        throw new Error('No current version found for template')
      }

      // Generate agreement number
      const agreementNumber = await this.generateAgreementNumber(userId)

      // Generate customized content if custom variables provided
      let customizedContent: BAAAgreement['customizedContent']
      if (agreementData.customVariables) {
        const { customizedContent: content } = await templateService.generateCustomizedBAA(
          userId,
          agreementData.templateId,
          agreementData.customVariables
        )
        customizedContent = content
      }

      // Create agreement
      const { data: agreement, error } = await supabase
        .from('baa_agreements')
        .insert({
          user_id: userId,
          template_id: agreementData.templateId,
          template_version_id: currentVersion.id,
          vendor_name: agreementData.vendorName,
          vendor_contact_name: agreementData.vendorContactName,
          vendor_contact_email: agreementData.vendorContactEmail,
          vendor_contact_phone: agreementData.vendorContactPhone,
          vendor_address: agreementData.vendorAddress,
          agreement_number: agreementNumber,
          effective_date: agreementData.effectiveDate.toISOString().split('T')[0],
          expiration_date: agreementData.expirationDate.toISOString().split('T')[0],
          renewal_notice_days: agreementData.renewalNoticeDays || 90,
          status: 'draft',
          priority: agreementData.priority || 'medium',
          custom_variables: agreementData.customVariables || {},
          customized_content: customizedContent,
          tags: agreementData.tags || [],
          notes: agreementData.notes,
          attachments: [],
          created_by: userId
        })
        .select()
        .single()

      if (error) throw error

      // Log audit trail
      await this.logAuditEvent(userId, 'agreement_created', 'agreement', agreement.id, {
        agreementNumber,
        vendorName: agreementData.vendorName,
        templateId: agreementData.templateId
      })

      SecurityAudit.logSensitiveAction('baa_agreement_created', userId, {
        agreementId: agreement.id,
        agreementNumber,
        vendorName: agreementData.vendorName
      })

      return this.mapAgreementFromDB(agreement)
    } catch (error) {
      logger.error('Failed to create BAA agreement', error as Error, {
        userId,
        vendorName: agreementData.vendorName
      })
      throw error
    }
  }

  /**
   * Update agreement status through lifecycle
   * HIPAA Compliance: Maintains proper workflow and audit trail
   */
  async updateAgreementStatus(
    userId: string,
    agreementId: string,
    newStatus: BAAAgreement['status'],
    notes?: string,
    metadata?: Record<string, any>
  ): Promise<BAAAgreement> {
    try {
      const supabase = await this.supabase

      // Get current agreement
      const { data: currentAgreement, error: fetchError } = await supabase
        .from('baa_agreements')
        .select('*')
        .eq('id', agreementId)
        .single()

      if (fetchError) throw fetchError
      if (currentAgreement.user_id !== userId) {
        throw new Error('Access denied: Agreement not owned by user')
      }

      // Validate status transition
      this.validateStatusTransition(currentAgreement.status, newStatus)

      // Prepare update data
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      // Add execution data if status is executed
      if (newStatus === 'executed') {
        updateData.executed_at = new Date().toISOString()
        updateData.executed_by = userId
        updateData.execution_method = metadata?.executionMethod || 'electronic'
      }

      // Update agreement
      const { data: agreement, error: updateError } = await supabase
        .from('baa_agreements')
        .update(updateData)
        .eq('id', agreementId)
        .select()
        .single()

      if (updateError) throw updateError

      // Log lifecycle event
      await this.logLifecycleEvent(agreementId, newStatus, userId, notes, metadata)

      // Log audit trail
      await this.logAuditEvent(userId, 'agreement_updated', 'agreement', agreementId, {
        oldStatus: currentAgreement.status,
        newStatus,
        notes
      })

      SecurityAudit.logSensitiveAction('baa_agreement_status_updated', userId, {
        agreementId,
        oldStatus: currentAgreement.status,
        newStatus,
        notes
      })

      return this.mapAgreementFromDB(agreement)
    } catch (error) {
      logger.error('Failed to update agreement status', error as Error, {
        userId,
        agreementId,
        newStatus
      })
      throw error
    }
  }

  /**
   * Get agreements with expiration warnings
   * HIPAA Compliance: Proactive monitoring for compliance
   */
  async getAgreementsWithExpirationWarnings(
    userId: string,
    daysAhead: number = 90
  ): Promise<Array<BAAAgreement & { daysUntilExpiration: number }>> {
    try {
      const supabase = await this.supabase

      const { data: agreements, error } = await supabase
        .rpc('get_baa_expiration_warnings', { days_ahead: daysAhead })
        .eq('user_id', userId)

      if (error) throw error

      return agreements.map((agreement: any) => ({
        ...this.mapAgreementFromDB(agreement),
        daysUntilExpiration: agreement.days_until_expiration
      }))
    } catch (error) {
      logger.error('Failed to get expiration warnings', error as Error, {
        userId,
        daysAhead
      })
      throw error
    }
  }

  /**
   * Renew an expiring agreement
   * HIPAA Compliance: Ensures continuous coverage
   */
  async renewAgreement(
    userId: string,
    agreementId: string,
    renewalData: {
      newExpirationDate: Date
      renewalNoticeDays?: number
      notes?: string
    }
  ): Promise<BAAAgreement> {
    try {
      const supabase = await this.supabase

      // Get current agreement
      const { data: currentAgreement, error: fetchError } = await supabase
        .from('baa_agreements')
        .select('*')
        .eq('id', agreementId)
        .single()

      if (fetchError) throw fetchError
      if (currentAgreement.user_id !== userId) {
        throw new Error('Access denied: Agreement not owned by user')
      }

      // Update agreement
      const { data: agreement, error: updateError } = await supabase
        .from('baa_agreements')
        .update({
          expiration_date: renewalData.newExpirationDate.toISOString().split('T')[0],
          renewal_notice_days: renewalData.renewalNoticeDays || currentAgreement.renewal_notice_days,
          status: 'renewed',
          updated_at: new Date().toISOString()
        })
        .eq('id', agreementId)
        .select()
        .single()

      if (updateError) throw updateError

      // Log lifecycle event
      await this.logLifecycleEvent(agreementId, 'renewed', userId, renewalData.notes, {
        newExpirationDate: renewalData.newExpirationDate.toISOString(),
        previousExpirationDate: currentAgreement.expiration_date
      })

      // Log audit trail
      await this.logAuditEvent(userId, 'agreement_renewed', 'agreement', agreementId, {
        newExpirationDate: renewalData.newExpirationDate.toISOString(),
        previousExpirationDate: currentAgreement.expiration_date
      })

      SecurityAudit.logSensitiveAction('baa_agreement_renewed', userId, {
        agreementId,
        newExpirationDate: renewalData.newExpirationDate.toISOString(),
        previousExpirationDate: currentAgreement.expiration_date
      })

      return this.mapAgreementFromDB(agreement)
    } catch (error) {
      logger.error('Failed to renew agreement', error as Error, {
        userId,
        agreementId,
        newExpirationDate: renewalData.newExpirationDate
      })
      throw error
    }
  }

  /**
   * Terminate an agreement
   * HIPAA Compliance: Proper termination with documentation
   */
  async terminateAgreement(
    userId: string,
    agreementId: string,
    terminationData: {
      terminationDate: Date
      reason: string
      notes?: string
    }
  ): Promise<BAAAgreement> {
    try {
      const supabase = await this.supabase

      // Get current agreement
      const { data: currentAgreement, error: fetchError } = await supabase
        .from('baa_agreements')
        .select('*')
        .eq('id', agreementId)
        .single()

      if (fetchError) throw fetchError
      if (currentAgreement.user_id !== userId) {
        throw new Error('Access denied: Agreement not owned by user')
      }

      // Update agreement
      const { data: agreement, error: updateError } = await supabase
        .from('baa_agreements')
        .update({
          status: 'terminated',
          updated_at: new Date().toISOString()
        })
        .eq('id', agreementId)
        .select()
        .single()

      if (updateError) throw updateError

      // Log lifecycle event
      await this.logLifecycleEvent(agreementId, 'terminated', userId, terminationData.notes, {
        terminationDate: terminationData.terminationDate.toISOString(),
        reason: terminationData.reason
      })

      // Log audit trail
      await this.logAuditEvent(userId, 'agreement_terminated', 'agreement', agreementId, {
        terminationDate: terminationData.terminationDate.toISOString(),
        reason: terminationData.reason
      })

      SecurityAudit.logSensitiveAction('baa_agreement_terminated', userId, {
        agreementId,
        terminationDate: terminationData.terminationDate.toISOString(),
        reason: terminationData.reason
      })

      return this.mapAgreementFromDB(agreement)
    } catch (error) {
      logger.error('Failed to terminate agreement', error as Error, {
        userId,
        agreementId,
        reason: terminationData.reason
      })
      throw error
    }
  }

  /**
   * Get agreements by status for workflow management
   * HIPAA Compliance: Workflow visibility for compliance oversight
   */
  async getAgreementsByStatus(
    userId: string,
    status: BAAAgreement['status']
  ): Promise<BAAAgreement[]> {
    try {
      const supabase = await this.supabase

      const { data: agreements, error } = await supabase
        .from('baa_agreements')
        .select('*')
        .eq('user_id', userId)
        .eq('status', status)
        .order('created_at', { ascending: false })

      if (error) throw error

      return agreements.map(agreement => this.mapAgreementFromDB(agreement))
    } catch (error) {
      logger.error('Failed to get agreements by status', error as Error, {
        userId,
        status
      })
      throw error
    }
  }

  /**
   * Get agreement statistics for compliance reporting
   * HIPAA Compliance: Metrics for compliance monitoring
   */
  async getAgreementStatistics(userId: string): Promise<{
    totalAgreements: number
    byStatus: Record<string, number>
    expiringWithin30Days: number
    expiringWithin90Days: number
    expiredAgreements: number
  }> {
    try {
      const supabase = await this.supabase

      // Get all agreements
      const { data: agreements, error } = await supabase
        .from('baa_agreements')
        .select('status, expiration_date')
        .eq('user_id', userId)

      if (error) throw error

      const now = new Date()
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

      const stats = {
        totalAgreements: agreements.length,
        byStatus: {} as Record<string, number>,
        expiringWithin30Days: 0,
        expiringWithin90Days: 0,
        expiredAgreements: 0
      }

      agreements.forEach(agreement => {
        // Count by status
        stats.byStatus[agreement.status] = (stats.byStatus[agreement.status] || 0) + 1

        // Check expiration
        const expirationDate = new Date(agreement.expiration_date)
        if (expirationDate < now) {
          stats.expiredAgreements++
        } else if (expirationDate <= thirtyDaysFromNow) {
          stats.expiringWithin30Days++
        } else if (expirationDate <= ninetyDaysFromNow) {
          stats.expiringWithin90Days++
        }
      })

      return stats
    } catch (error) {
      logger.error('Failed to get agreement statistics', error as Error, { userId })
      throw error
    }
  }

  // Private helper methods

  private async generateAgreementNumber(userId: string): Promise<string> {
    try {
      const supabase = await this.supabase

      const { data, error } = await supabase
        .rpc('generate_baa_agreement_number')

      if (error) throw error

      return data
    } catch (error) {
      logger.error('Failed to generate agreement number', error as Error, { userId })
      // Fallback to timestamp-based number
      return `BAA-${Date.now()}`
    }
  }

  private validateStatusTransition(
    currentStatus: BAAAgreement['status'],
    newStatus: BAAAgreement['status']
  ): void {
    const validTransitions: Record<string, string[]> = {
      'draft': ['review', 'pending_signature', 'executed', 'terminated'],
      'review': ['draft', 'pending_signature', 'executed', 'terminated'],
      'pending_signature': ['draft', 'review', 'executed', 'terminated'],
      'executed': ['expired', 'renewed', 'terminated'],
      'expired': ['renewed', 'terminated'],
      'renewed': ['expired', 'terminated'],
      'terminated': [] // Final state
    }

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`)
    }
  }

  private async logLifecycleEvent(
    agreementId: string,
    eventType: BAALifecycleEvent['eventType'],
    performedBy: string,
    notes?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const supabase = await this.supabase

      await supabase
        .from('baa_lifecycle_events')
        .insert({
          agreement_id: agreementId,
          event_type: eventType,
          event_date: new Date().toISOString(),
          performed_by: performedBy,
          notes,
          metadata
        })
    } catch (error) {
      logger.error('Failed to log lifecycle event', error as Error, {
        agreementId,
        eventType,
        performedBy
      })
    }
  }

  private async logAuditEvent(
    userId: string,
    activityType: string,
    entityType: string,
    entityId: string,
    metadata: any
  ): Promise<void> {
    try {
      const supabase = await this.supabase

      await supabase
        .from('baa_audit_logs')
        .insert({
          user_id: userId,
          activity_type: activityType,
          entity_type: entityType,
          entity_id: entityId,
          description: `${activityType} performed on ${entityType}`,
          metadata: metadata,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      logger.error('Failed to log audit event', error as Error, {
        userId,
        activityType,
        entityType,
        entityId
      })
    }
  }

  private mapAgreementFromDB(data: any): BAAAgreement {
    return {
      id: data.id,
      userId: data.user_id,
      templateId: data.template_id,
      templateVersionId: data.template_version_id,
      vendorName: data.vendor_name,
      vendorContactName: data.vendor_contact_name,
      vendorContactEmail: data.vendor_contact_email,
      vendorContactPhone: data.vendor_contact_phone,
      vendorAddress: data.vendor_address,
      agreementNumber: data.agreement_number,
      effectiveDate: new Date(data.effective_date),
      expirationDate: new Date(data.expiration_date),
      renewalNoticeDays: data.renewal_notice_days,
      status: data.status,
      priority: data.priority,
      customVariables: data.custom_variables,
      customizedContent: data.customized_content,
      executedAt: data.executed_at ? new Date(data.executed_at) : undefined,
      executedBy: data.executed_by,
      executionMethod: data.execution_method,
      tags: data.tags || [],
      notes: data.notes,
      attachments: data.attachments || [],
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
}

// Export singleton instance
export const baaManagementService = new BAAManagementService()