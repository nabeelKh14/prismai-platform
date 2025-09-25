import { createClient } from '@/lib/supabase/server'
import { CRMConfig, CustomerData, ConversationContext, SyncResult, CRMSyncOptions } from './types'
import { createCRMConnector } from './factory'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

export class CRMService {
  private supabasePromise = createClient()
  private async getClient() {
    return await this.supabasePromise
  }

  // Configuration management
  async getCRMConfig(userId: string, provider: string): Promise<CRMConfig | null> {
    try {
      const supabase = await this.getClient()
      const { data, error } = await supabase
        .from('crm_configs')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data
    } catch (error) {
      logger.error('Failed to get CRM config', error as Error, { userId, provider })
      return null
    }
  }

  async saveCRMConfig(config: Omit<CRMConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<CRMConfig> {
    try {
      const supabase = await this.getClient()
      const { data, error } = await supabase
        .from('crm_configs')
        .upsert({
          ...config,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      SecurityAudit.logSensitiveAction('crm_config_updated', config.userId, {
        provider: config.provider,
        isActive: config.isActive
      })

      return data
    } catch (error) {
      logger.error('Failed to save CRM config', error as Error, {
        userId: config.userId,
        provider: config.provider
      })
      throw error
    }
  }

  async getActiveCRMConfigs(userId: string): Promise<CRMConfig[]> {
    try {
      const supabase = await this.getClient()
      const { data, error } = await supabase
        .from('crm_configs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Failed to get active CRM configs', error as Error, { userId })
      return []
    }
  }

  // Customer data management
  async getCustomer(userId: string, provider: string, externalId: string): Promise<CustomerData | null> {
    try {
      const supabase = await this.getClient()
      const { data, error } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('external_id', externalId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data
    } catch (error) {
      logger.error('Failed to get customer', error as Error, { userId, provider, externalId })
      return null
    }
  }

  async saveCustomer(customer: any): Promise<CustomerData> {
    try {
      const supabase = await this.getClient()
      const { data, error } = await supabase
        .from('crm_customers')
        .upsert({
          ...customer,
          user_id: customer.userId ?? customer.user_id,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      logger.error('Failed to save customer', error as Error, {
        userId: customer.userId,
        provider: customer.provider,
        externalId: customer.externalId
      })
      throw error
    }
  }

  async searchCustomers(userId: string, query: string, provider?: string): Promise<CustomerData[]> {
    try {
      const supabase = await this.getClient()
      let queryBuilder = supabase
        .from('crm_customers')
        .select('*')
        .eq('user_id', userId)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
        .limit(20)

      if (provider) {
        queryBuilder = queryBuilder.eq('provider', provider)
      }

      const { data, error } = await queryBuilder

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Failed to search customers', error as Error, { userId, query, provider })
      return []
    }
  }

  // Context enrichment
  async enrichConversationContext(conversationId: string, customerId: string, provider: string): Promise<ConversationContext | null> {
    try {
      const config = await this.getCRMConfig('', provider) // Need to get userId from conversation
      if (!config || !config.isActive) return null

      const connector = createCRMConnector(config)
      const context = await connector.getCustomerContext(customerId)

      if (context) {
        // Save context to database
        const supabase = await this.getClient()
        await supabase
          .from('crm_conversation_context')
          .upsert({
            conversation_id: conversationId,
            customer_id: customerId,
            provider: provider,
            context_data: context.contextData,
            enriched_at: context.enrichedAt.toISOString()
          })

        SecurityAudit.logDataAccess('crm_context', config.userId, 'read', {
          conversationId,
          customerId,
          provider
        })
      }

      return context
    } catch (error) {
      logger.error('Failed to enrich conversation context', error as Error, {
        conversationId,
        customerId,
        provider
      })
      return null
    }
  }

  async getConversationContext(conversationId: string, customerId: string, provider: string): Promise<ConversationContext | null> {
    try {
      const supabase2 = await this.getClient()
      const { data, error } = await supabase2
        .from('crm_conversation_context')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('customer_id', customerId)
        .eq('provider', provider)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        return {
          customerId: data.customer_id,
          conversationId: data.conversation_id,
          provider: data.provider as any,
          contextData: data.context_data,
          enrichedAt: new Date(data.enriched_at)
        }
      }

      return null
    } catch (error) {
      logger.error('Failed to get conversation context', error as Error, {
        conversationId,
        customerId,
        provider
      })
      return null
    }
  }

  // Synchronization
  async syncCustomers(userId: string, provider: string, options: CRMSyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      syncedCount: 0,
      errors: [],
      lastSyncAt: new Date()
    }

    try {
      const config = await this.getCRMConfig(userId, provider)
      if (!config || !config.isActive) {
        result.errors.push('CRM configuration not found or inactive')
        return result
      }

      const connector = createCRMConnector(config)

      // Test authentication
      const authenticated = await connector.authenticate()
      if (!authenticated) {
        result.errors.push('CRM authentication failed')
        return result
      }

      // Get customers from CRM (simplified - in real implementation, handle pagination)
      const crmCustomers = await connector.searchCustomers('') // Empty query to get all

      let syncedCount = 0
      const errors: string[] = []

      for (const crmCustomer of crmCustomers) {
        try {
          await this.saveCustomer({
            ...crmCustomer,
            userId
          })
          syncedCount++
        } catch (error) {
          errors.push(`Failed to sync customer ${crmCustomer.externalId}: ${error}`)
        }
      }

      // Update last sync time
      {
        const supabase = await this.getClient()
        await supabase
        .from('crm_configs')
        .update({ last_sync_at: result.lastSyncAt.toISOString() })
        .eq('user_id', userId)
        .eq('provider', provider)
      }

      // Log sync result
      {
        const supabase = await this.getClient()
        await supabase
        .from('crm_sync_logs')
        .insert({
          user_id: userId,
          provider: provider as any,
          sync_type: options.fullSync ? 'full' : 'incremental',
          status: errors.length === 0 ? 'success' : 'partial',
          records_processed: syncedCount,
          errors: errors.length > 0 ? errors : undefined,
          completed_at: result.lastSyncAt.toISOString()
        })
      }

      result.success = errors.length === 0
      result.syncedCount = syncedCount
      result.errors = errors

      SecurityAudit.logSensitiveAction('crm_sync_completed', userId, {
        provider,
        syncedCount,
        errorsCount: errors.length
      })

    } catch (error) {
      result.errors.push(`Sync failed: ${error}`)
      logger.error('CRM sync failed', error as Error, { userId, provider })
    }

    return result
  }

  // Activity logging
  async logActivity(
    userId: string,
    conversationId: string,
    customerId: string,
    provider: string,
    activity: { type: 'call' | 'email' | 'meeting' | 'note' | 'task', subject: string, description?: string }
  ): Promise<string | null> {
    try {
      const config = await this.getCRMConfig(userId, provider)
      if (!config || !config.isActive) return null

      const connector = createCRMConnector(config)
      const externalActivityId = await connector.logActivity(customerId, activity)

      // Log to our database
      const supabase = await this.getClient()
      await supabase
        .from('crm_activity_logs')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          customer_id: customerId,
          provider: provider as any,
          activity_type: activity.type,
          subject: activity.subject,
          description: activity.description,
          external_activity_id: externalActivityId
        })

      SecurityAudit.logDataAccess('crm_activity', userId, 'write', {
        conversationId,
        customerId,
        provider,
        activityType: activity.type
      })

      return externalActivityId
    } catch (error) {
      logger.error('Failed to log CRM activity', error as Error, {
        userId,
        conversationId,
        customerId,
        provider
      })
      return null
    }
  }

  // Webhook processing
  async processCRMWebhook(userId: string, provider: string, payload: any, signature: string): Promise<void> {
    try {
      const config = await this.getCRMConfig(userId, provider)
      if (!config || !config.isActive) {
        throw new Error('CRM configuration not found or inactive')
      }

      const connector = createCRMConnector(config)

      // Validate webhook signature
      const isValid = connector.validateWebhook(payload, signature)
      if (!isValid) {
        throw new Error('Invalid webhook signature')
      }

      // Process webhook
      await connector.processWebhook(payload)

      logger.info('CRM webhook processed successfully', {
        userId,
        provider,
        payloadType: payload.type || 'unknown'
      })

    } catch (error) {
      logger.error('CRM webhook processing failed', error as Error, {
        userId,
        provider
      })
      throw error
    }
  }
}

// Export singleton instance
export const crmService = new CRMService()