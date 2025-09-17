import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'
import { accessControlService } from '@/lib/security/access-control'

export interface RetentionPolicy {
  id: string
  name: string
  description: string
  resourceType: 'conversation' | 'message' | 'customer' | 'file' | 'audit_log'
  retentionPeriod: number // in days
  deletionMethod: 'hard_delete' | 'anonymize' | 'archive'
  conditions?: {
    status?: string
    priority?: string
    hasAttachments?: boolean
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface DeletionSchedule {
  id: string
  resourceType: string
  resourceId: string
  scheduledDeletionDate: Date
  reason: string
  requestedBy: string
  approvedBy?: string
  status: 'pending' | 'approved' | 'executed' | 'cancelled'
  createdAt: Date
  executedAt?: Date
}

export class DataRetentionService {
  private supabase = createClient()

  // Default retention policies
  private defaultPolicies: RetentionPolicy[] = [
    {
      id: 'conversation-resolved',
      name: 'Resolved Conversations',
      description: 'Delete resolved conversations after 2 years',
      resourceType: 'conversation',
      retentionPeriod: 730, // 2 years
      deletionMethod: 'hard_delete',
      conditions: { status: 'resolved' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'conversation-abandoned',
      name: 'Abandoned Conversations',
      description: 'Delete abandoned conversations after 90 days',
      resourceType: 'conversation',
      retentionPeriod: 90,
      deletionMethod: 'hard_delete',
      conditions: { status: 'abandoned' },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'customer-inactive',
      name: 'Inactive Customers',
      description: 'Anonymize inactive customer data after 3 years',
      resourceType: 'customer',
      retentionPeriod: 1095, // 3 years
      deletionMethod: 'anonymize',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'audit-logs',
      name: 'Audit Logs',
      description: 'Archive audit logs after 7 years',
      resourceType: 'audit_log',
      retentionPeriod: 2555, // 7 years
      deletionMethod: 'archive',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'file-attachments',
      name: 'File Attachments',
      description: 'Delete file attachments after conversation retention period',
      resourceType: 'file',
      retentionPeriod: 730, // Match conversation retention
      deletionMethod: 'hard_delete',
      conditions: { hasAttachments: true },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  // Apply retention policies
  async applyRetentionPolicies(): Promise<{
    processed: number
    deleted: number
    archived: number
    anonymized: number
  }> {
    const result = {
      processed: 0,
      deleted: 0,
      archived: 0,
      anonymized: 0
    }

    try {
      for (const policy of this.defaultPolicies) {
        if (!policy.isActive) continue

        const processed = await this.processRetentionPolicy(policy)
        result.processed += processed.count
        result.deleted += processed.deleted
        result.archived += processed.archived
        result.anonymized += processed.anonymized
      }

      logger.info('Retention policies applied', result)
      SecurityAudit.logSensitiveAction('retention_policies_applied', 'system', result)

    } catch (error) {
      logger.error('Failed to apply retention policies', error as Error)
      throw error
    }

    return result
  }

  // Process a specific retention policy
  private async processRetentionPolicy(policy: RetentionPolicy): Promise<{
    count: number
    deleted: number
    archived: number
    anonymized: number
  }> {
    const result = { count: 0, deleted: 0, archived: 0, anonymized: 0 }
    const cutoffDate = new Date(Date.now() - policy.retentionPeriod * 24 * 60 * 60 * 1000)

    try {
      switch (policy.resourceType) {
        case 'conversation':
          const conversationResult = await this.processConversationRetention(policy, cutoffDate)
          Object.assign(result, conversationResult)
          break

        case 'customer':
          const customerResult = await this.processCustomerRetention(policy, cutoffDate)
          Object.assign(result, customerResult)
          break

        case 'file':
          const fileResult = await this.processFileRetention(policy, cutoffDate)
          Object.assign(result, fileResult)
          break

        case 'audit_log':
          const auditResult = await this.processAuditLogRetention(policy, cutoffDate)
          Object.assign(result, auditResult)
          break
      }
    } catch (error) {
      logger.error(`Failed to process retention policy ${policy.id}`, error as Error)
    }

    return result
  }

  // Process conversation retention
  private async processConversationRetention(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ count: number; deleted: number; archived: number; anonymized: number }> {
    const result = { count: 0, deleted: 0, archived: 0, anonymized: 0 }

    try {
      const supabase = await this.supabase

      // Find conversations that match the policy conditions and are older than cutoff
      let query = supabase
        .from('chat_conversations')
        .select('id, status, created_at')
        .lt('created_at', cutoffDate.toISOString())

      if (policy.conditions?.status) {
        query = query.eq('status', policy.conditions.status)
      }

      const { data: conversations, error } = await query

      if (error) throw error

      result.count = conversations?.length || 0

      for (const conversation of conversations || []) {
        try {
          if (policy.deletionMethod === 'hard_delete') {
            await this.deleteConversation(conversation.id)
            result.deleted++
          } else if (policy.deletionMethod === 'anonymize') {
            await this.anonymizeConversation(conversation.id)
            result.anonymized++
          } else if (policy.deletionMethod === 'archive') {
            await this.archiveConversation(conversation.id)
            result.archived++
          }
        } catch (error) {
          logger.error(`Failed to process conversation ${conversation.id}`, error as Error)
        }
      }
    } catch (error) {
      logger.error('Failed to process conversation retention', error as Error)
    }

    return result
  }

  // Process customer retention
  private async processCustomerRetention(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ count: number; deleted: number; archived: number; anonymized: number }> {
    const result = { count: 0, deleted: 0, archived: 0, anonymized: 0 }

    try {
      const supabase = await this.supabase

      // Find inactive customers
      const { data: customers, error } = await supabase
        .from('crm_customers')
        .select('id, last_activity, updated_at')
        .or(`last_activity.lt.${cutoffDate.toISOString()},last_activity.is.null`)
        .lt('updated_at', cutoffDate.toISOString())

      if (error) throw error

      result.count = customers?.length || 0

      for (const customer of customers || []) {
        try {
          if (policy.deletionMethod === 'anonymize') {
            await this.anonymizeCustomer(customer.id)
            result.anonymized++
          } else if (policy.deletionMethod === 'hard_delete') {
            await this.deleteCustomer(customer.id)
            result.deleted++
          }
        } catch (error) {
          logger.error(`Failed to process customer ${customer.id}`, error as Error)
        }
      }
    } catch (error) {
      logger.error('Failed to process customer retention', error as Error)
    }

    return result
  }

  // Process file retention
  private async processFileRetention(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ count: number; deleted: number; archived: number; anonymized: number }> {
    const result = { count: 0, deleted: 0, archived: 0, anonymized: 0 }

    // This would integrate with the secure file storage service
    // For now, return empty result
    return result
  }

  // Process audit log retention
  private async processAuditLogRetention(
    policy: RetentionPolicy,
    cutoffDate: Date
  ): Promise<{ count: number; deleted: number; archived: number; anonymized: number }> {
    const result = { count: 0, deleted: 0, archived: 0, anonymized: 0 }

    // This would process audit logs
    // For now, return empty result
    return result
  }

  // Delete conversation and related data
  private async deleteConversation(conversationId: string): Promise<void> {
    const supabase = await this.supabase

    // Delete messages
    await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId)

    // Delete conversation context
    await supabase
      .from('crm_conversation_context')
      .delete()
      .eq('conversation_id', conversationId)

    // Delete conversation
    await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId)

    logger.info('Conversation deleted', { conversationId })
  }

  // Anonymize conversation
  private async anonymizeConversation(conversationId: string): Promise<void> {
    const supabase = await this.supabase

    // Anonymize customer information
    await supabase
      .from('chat_conversations')
      .update({
        customer_name: 'Anonymous',
        customer_email: null,
        customer_phone: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    // Anonymize messages
    await supabase
      .from('chat_messages')
      .update({
        content: '[Content anonymized for privacy]',
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', conversationId)

    logger.info('Conversation anonymized', { conversationId })
  }

  // Archive conversation
  private async archiveConversation(conversationId: string): Promise<void> {
    const supabase = await this.supabase

    // Mark as archived
    await supabase
      .from('chat_conversations')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    logger.info('Conversation archived', { conversationId })
  }

  // Anonymize customer
  private async anonymizeCustomer(customerId: string): Promise<void> {
    const supabase = await this.supabase

    await supabase
      .from('crm_customers')
      .update({
        first_name: 'Anonymous',
        last_name: 'User',
        email: null,
        phone: null,
        address_street: null,
        address_city: null,
        address_state: null,
        address_zip_code: null,
        address_country: null,
        custom_fields: {},
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId)

    logger.info('Customer anonymized', { customerId })
  }

  // Delete customer
  private async deleteCustomer(customerId: string): Promise<void> {
    const supabase = await this.supabase

    await supabase
      .from('crm_customers')
      .delete()
      .eq('id', customerId)

    logger.info('Customer deleted', { customerId })
  }

  // GDPR/CCPA compliance methods
  async handleDataDeletionRequest(
    userId: string,
    requestedBy: string,
    reason: string
  ): Promise<DeletionSchedule> {
    try {
      // Check permissions
      const hasPermission = await accessControlService.hasPermission(
        requestedBy,
        'customer',
        'delete'
      )

      if (!hasPermission) {
        throw new Error('Insufficient permissions to request data deletion')
      }

      // Schedule deletion (typically 30 days for compliance)
      const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      const schedule: DeletionSchedule = {
        id: `deletion_${Date.now()}_${userId}`,
        resourceType: 'customer',
        resourceId: userId,
        scheduledDeletionDate: deletionDate,
        reason,
        requestedBy,
        status: 'pending',
        createdAt: new Date()
      }

      // In production, this would be stored in a database
      logger.info('Data deletion requested', {
        userId,
        requestedBy,
        reason,
        deletionDate: deletionDate.toISOString()
      })

      SecurityAudit.logSensitiveAction('data_deletion_requested', requestedBy, {
        targetUserId: userId,
        reason,
        deletionDate
      })

      return schedule
    } catch (error) {
      logger.error('Failed to handle data deletion request', error as Error, {
        userId,
        requestedBy
      })
      throw error
    }
  }

  async handleDataExportRequest(
    userId: string,
    requestedBy: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    try {
      // Check permissions
      const hasPermission = await accessControlService.hasPermission(
        requestedBy,
        'customer',
        'read'
      )

      if (!hasPermission && requestedBy !== userId) {
        throw new Error('Insufficient permissions to export data')
      }

      const supabase = await this.supabase

      // Export customer data
      const { data: customerData, error: customerError } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', userId)
        .single()

      if (customerError && customerError.code !== 'PGRST116') {
        throw customerError
      }

      // Export conversations
      const { data: conversations, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', userId)

      if (convError) throw convError

      const exportData = {
        customer: customerData,
        conversations: conversations || [],
        exportedAt: new Date().toISOString(),
        exportedBy: requestedBy
      }

      SecurityAudit.logSensitiveAction('data_export_performed', requestedBy, {
        targetUserId: userId,
        format
      })

      return exportData
    } catch (error) {
      logger.error('Failed to handle data export request', error as Error, {
        userId,
        requestedBy
      })
      throw error
    }
  }

  // Get retention policy statistics
  async getRetentionStats(): Promise<{
    policies: RetentionPolicy[]
    upcomingDeletions: number
    totalProcessed: number
  }> {
    // Calculate upcoming deletions in the next 30 days
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    let upcomingDeletions = 0

    for (const policy of this.defaultPolicies) {
      if (!policy.isActive) continue

      const cutoffDate = new Date(Date.now() - policy.retentionPeriod * 24 * 60 * 60 * 1000)

      // This would query the database to count records that will be affected
      // For now, return a placeholder
      upcomingDeletions += Math.floor(Math.random() * 100) // Placeholder
    }

    return {
      policies: this.defaultPolicies,
      upcomingDeletions,
      totalProcessed: 0 // Would be calculated from logs
    }
  }
}

// Export singleton instance
export const dataRetentionService = new DataRetentionService()