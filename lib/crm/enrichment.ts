import { createClient } from '@/lib/supabase/server'
import { crmService } from './service'
import { CustomerData, ConversationContext } from './types'
import { logger } from '@/lib/logger'

export class ContextEnrichmentService {
  private supabase = createClient()

  // Enrich conversation with CRM context
  async enrichConversation(conversationId: string): Promise<ConversationContext | null> {
    try {
      // Get conversation details to find customer information
      const conversation = await this.getConversationDetails(conversationId)
      if (!conversation) return null

      // Try to identify customer from conversation
      const customerIdentifier = await this.identifyCustomerFromConversation(conversation)
      if (!customerIdentifier) return null

      // Find customer in CRM systems
      const customer = await this.findCustomerInCRM(conversation.user_id, customerIdentifier)
      if (!customer) return null

      // Get CRM context
      const context = await crmService.enrichConversationContext(
        conversationId,
        customer.externalId,
        customer.provider
      )

      if (context) {
        // Add CRM-specific tags to conversation
        await this.addCRMTagsToConversation(conversationId, customer, context)

        // Log the enrichment
        logger.info('Conversation enriched with CRM context', {
          conversationId,
          customerId: customer.externalId,
          provider: customer.provider
        })
      }

      return context
    } catch (error) {
      logger.error('Failed to enrich conversation', error as Error, { conversationId })
      return null
    }
  }

  // Identify customer from conversation data
  private async identifyCustomerFromConversation(conversation: any): Promise<string | null> {
    // Try different strategies to identify the customer

    // 1. Check if customer email/phone is stored in conversation
    if (conversation.customer_email) {
      return conversation.customer_email
    }

    if (conversation.customer_phone) {
      return conversation.customer_phone
    }

    // 2. Extract from conversation messages
    const messages = await this.getConversationMessages(conversation.id)
    const customerInfo = this.extractCustomerInfoFromMessages(messages)

    return customerInfo.email || customerInfo.phone || null
  }

  // Find customer in connected CRM systems
  private async findCustomerInCRM(userId: string, identifier: string): Promise<CustomerData | null> {
    // Get active CRM configurations
    const configs = await crmService.getActiveCRMConfigs(userId)

    for (const config of configs) {
      try {
        // Search for customer in this CRM
        const customers = await crmService.searchCustomers(userId, identifier, config.provider)

        if (customers.length > 0) {
          // Return the first match
          return customers[0]
        }
      } catch (error) {
        logger.warn(`Failed to search in ${config.provider}`, { error: (error as Error).message, userId })
      }
    }

    return null
  }

  // Add CRM-specific tags and routing rules
  private async addCRMTagsToConversation(
    conversationId: string,
    customer: CustomerData,
    context: ConversationContext
  ): Promise<void> {
    const tags: string[] = []
    const routingRules: any[] = []

    // Add provider-specific tags
    tags.push(`crm:${customer.provider}`)

    // Add lifecycle stage tags
    if (customer.lifecycleStage) {
      tags.push(`lifecycle:${customer.lifecycleStage}`)
    }

    // Add lead score tags
    if (customer.leadScore) {
      if (customer.leadScore >= 80) tags.push('priority:high')
      else if (customer.leadScore >= 50) tags.push('priority:medium')
      else tags.push('priority:low')
    }

    // Add company tags
    if (customer.company) {
      tags.push(`company:${customer.company.toLowerCase().replace(/\s+/g, '_')}`)
    }

    // Add deal-related tags
    if (context.contextData.openDeals && context.contextData.openDeals.length > 0) {
      tags.push('has_open_deals')
      const highValueDeals = context.contextData.openDeals.filter(deal => deal.value && deal.value > 10000)
      if (highValueDeals.length > 0) {
        tags.push('high_value_customer')
      }
    }

    // Add support ticket tags
    if (context.contextData.supportTickets && context.contextData.supportTickets.length > 0) {
      tags.push('has_support_tickets')
      const openTickets = context.contextData.supportTickets.filter(ticket => ticket.status !== 'closed')
      if (openTickets.length > 0) {
        tags.push('has_open_tickets')
      }
    }

    // Create routing rules based on context
    if (customer.leadScore && customer.leadScore >= 80) {
      routingRules.push({
        type: 'priority_routing',
        priority: 'high',
        reason: 'High lead score customer'
      })
    }

    if (context.contextData.openDeals && context.contextData.openDeals.length > 0) {
      routingRules.push({
        type: 'agent_routing',
        agent_type: 'sales',
        reason: 'Customer has open deals'
      })
    }

    // Update conversation with tags and routing
    const supabase = await this.supabase
    await supabase
      .from('chat_conversations')
      .update({
        tags: tags,
        routing_rules: routingRules,
        crm_customer_id: customer.externalId,
        crm_provider: customer.provider,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
  }

  // Extract customer information from conversation messages
  private extractCustomerInfoFromMessages(messages: any[]): { email?: string; phone?: string } {
    const info: { email?: string; phone?: string } = {}

    // Simple regex patterns to extract email and phone
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/

    for (const message of messages) {
      if (message.content) {
        const content = message.content.toLowerCase()

        // Look for email
        const emailMatch = content.match(emailRegex)
        if (emailMatch && !info.email) {
          info.email = emailMatch[0]
        }

        // Look for phone
        const phoneMatch = content.match(phoneRegex)
        if (phoneMatch && !info.phone) {
          info.phone = phoneMatch[0]
        }
      }
    }

    return info
  }

  // Helper methods
  private async getConversationDetails(conversationId: string): Promise<any> {
    const supabase = await this.supabase
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (error) throw error
    return data
  }

  private async getConversationMessages(conversationId: string): Promise<any[]> {
    const supabase = await this.supabase
    const { data, error } = await supabase
      .from('chat_messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) throw error
    return data || []
  }

  // Auto-enrichment trigger for new conversations
  async autoEnrichNewConversation(conversationId: string): Promise<void> {
    try {
      // Wait a bit for initial messages to be added
      setTimeout(async () => {
        await this.enrichConversation(conversationId)
      }, 5000) // 5 seconds delay
    } catch (error) {
      logger.error('Failed to auto-enrich conversation', error as Error, { conversationId })
    }
  }

  // Batch enrichment for existing conversations
  async batchEnrichConversations(userId: string, limit: number = 100): Promise<number> {
    try {
      const supabase = await this.supabase
      const { data: conversations, error } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('user_id', userId)
        .is('crm_customer_id', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      let enrichedCount = 0
      for (const conversation of conversations || []) {
        try {
          const context = await this.enrichConversation(conversation.id)
          if (context) enrichedCount++
        } catch (error) {
          logger.warn('Failed to enrich conversation in batch', {
            conversationId: conversation.id,
            error: (error as Error).message
          })
        }
      }

      logger.info('Batch enrichment completed', { userId, enrichedCount, totalProcessed: conversations?.length || 0 })
      return enrichedCount
    } catch (error) {
      logger.error('Failed to batch enrich conversations', error as Error, { userId })
      return 0
    }
  }
}

// Export singleton instance
export const contextEnrichmentService = new ContextEnrichmentService()