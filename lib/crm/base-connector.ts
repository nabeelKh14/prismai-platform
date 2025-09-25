import { CRMConfig, CRMConnector, CustomerData, ConversationContext, Activity } from './types'
import { logger } from '@/lib/logger'
import { createHash } from 'crypto'
import { crmErrorHandler, CRMError, CRMErrorContext } from './error-handler'
import { retryManager } from './retry-mechanism'
import { crmRateLimitManager } from './rate-limiter'
import { circuitBreakerManager } from './circuit-breaker'

export abstract class BaseCRMConnector implements CRMConnector {
  protected config: CRMConfig
  protected baseUrl: string
  protected authHeaders: Record<string, string> = {}

  constructor(config: CRMConfig) {
    this.config = config
    this.baseUrl = this.getBaseUrl()
  }

  abstract get provider(): 'salesforce' | 'hubspot' | 'pipedrive'

  protected abstract getBaseUrl(): string
  protected abstract getAuthHeaders(): Promise<Record<string, string>>

  async authenticate(): Promise<boolean> {
    try {
      this.authHeaders = await this.getAuthHeaders()
      // Test authentication with a simple API call
      const testResponse = await this.makeRequest('/test-auth', 'GET')
      return testResponse.ok
    } catch (error) {
      logger.error(`CRM authentication failed for ${this.provider}`, error as Error, {
        userId: this.config.userId,
        provider: this.provider
      })
      return false
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      // Implementation depends on the specific CRM provider
      // This is a placeholder that should be overridden by subclasses
      return true
    } catch (error) {
      logger.error(`Token refresh failed for ${this.provider}`, error as Error, {
        userId: this.config.userId,
        provider: this.provider
      })
      return false
    }
  }

  async getCustomer(externalId: string): Promise<CustomerData | null> {
    const context: CRMErrorContext = {
      userId: this.config.userId,
      provider: this.provider,
      operation: 'getCustomer',
      customerId: externalId,
      timestamp: new Date()
    }

    try {
      const endpoint = this.getCustomerEndpoint(externalId)
      const response = await this.makeRequest(endpoint, 'GET')

      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`Failed to get customer: ${response.statusText}`)
      }

      const data = await response.json()
      return this.mapToCustomerData(data)
    } catch (error) {
      return crmErrorHandler.handleError(error as Error, context, () => this.getCustomer(externalId))
        .then(result => result as CustomerData | null)
        .catch(() => null)
    }
  }

  async searchCustomers(query: string): Promise<CustomerData[]> {
    try {
      const endpoint = this.getSearchEndpoint(query)
      const response = await this.makeRequest(endpoint, 'GET')

      if (!response.ok) {
        throw new Error(`Failed to search customers: ${response.statusText}`)
      }

      const data = await response.json()
      const results = Array.isArray(data) ? data : data.results || []
      return results.map((item: any) => this.mapToCustomerData(item)).filter(Boolean)
    } catch (error) {
      logger.error(`Failed to search customers in ${this.provider}`, error as Error, {
        userId: this.config.userId,
        query,
        provider: this.provider
      })
      return []
    }
  }

  async createCustomer(customer: Partial<CustomerData>): Promise<CustomerData> {
    const context: CRMErrorContext = {
      userId: this.config.userId,
      provider: this.provider,
      operation: 'createCustomer',
      customerId: customer.externalId,
      timestamp: new Date()
    }

    try {
      const endpoint = this.getCreateCustomerEndpoint()
      const payload = this.mapFromCustomerData(customer)

      const response = await this.makeRequest(endpoint, 'POST', payload)

      if (!response.ok) {
        throw new Error(`Failed to create customer: ${response.statusText}`)
      }

      const data = await response.json()
      return this.mapToCustomerData(data)
    } catch (error) {
      return crmErrorHandler.handleError(error as Error, context, () => this.createCustomer(customer))
        .then(result => result as CustomerData)
    }
  }

  async updateCustomer(externalId: string, updates: Partial<CustomerData>): Promise<CustomerData> {
    try {
      const endpoint = this.getUpdateCustomerEndpoint(externalId)
      const payload = this.mapFromCustomerData(updates)

      const response = await this.makeRequest(endpoint, 'PATCH', payload)

      if (!response.ok) {
        throw new Error(`Failed to update customer: ${response.statusText}`)
      }

      const data = await response.json()
      return this.mapToCustomerData(data)
    } catch (error) {
      logger.error(`Failed to update customer in ${this.provider}`, error as Error, {
        userId: this.config.userId,
        externalId,
        updates,
        provider: this.provider
      })
      throw error
    }
  }

  async deleteCustomer(externalId: string): Promise<boolean> {
    try {
      const endpoint = this.getDeleteCustomerEndpoint(externalId)
      const response = await this.makeRequest(endpoint, 'DELETE')

      return response.ok
    } catch (error) {
      logger.error(`Failed to delete customer from ${this.provider}`, error as Error, {
        userId: this.config.userId,
        externalId,
        provider: this.provider
      })
      return false
    }
  }

  async logActivity(customerId: string, activity: Omit<Activity, 'id' | 'createdAt'>): Promise<string> {
    try {
      const endpoint = this.getLogActivityEndpoint(customerId)
      const payload = this.mapActivityData(activity)

      const response = await this.makeRequest(endpoint, 'POST', payload)

      if (!response.ok) {
        throw new Error(`Failed to log activity: ${response.statusText}`)
      }

      const data = await response.json()
      return data.id || customerId
    } catch (error) {
      logger.error(`Failed to log activity in ${this.provider}`, error as Error, {
        userId: this.config.userId,
        customerId,
        activity,
        provider: this.provider
      })
      throw error
    }
  }

  async getCustomerContext(externalId: string): Promise<ConversationContext | null> {
    try {
      const [activities, deals, tickets] = await Promise.all([
        this.getCustomerActivities(externalId),
        this.getCustomerDeals(externalId),
        this.getCustomerTickets(externalId)
      ])

      return {
        customerId: externalId,
        conversationId: '', // Will be set by caller
        provider: this.provider,
        contextData: {
          recentActivities: activities,
          openDeals: deals,
          supportTickets: tickets
        },
        enrichedAt: new Date()
      }
    } catch (error) {
      logger.error(`Failed to get customer context from ${this.provider}`, error as Error, {
        userId: this.config.userId,
        externalId,
        provider: this.provider
      })
      return null
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    try {
      const expectedSignature = this.generateWebhookSignature(payload)
      return signature === expectedSignature
    } catch (error) {
      logger.error(`Webhook validation failed for ${this.provider}`, error as Error, {
        userId: this.config.userId,
        provider: this.provider
      })
      return false
    }
  }

  async processWebhook(payload: any): Promise<void> {
    // Base implementation - should be overridden by subclasses
    logger.info(`Processing webhook for ${this.provider}`, {
      userId: this.config.userId,
      provider: this.provider,
      payload
    })
  }

  // Protected helper methods
  protected async makeRequest(endpoint: string, method: string = 'GET', body?: any): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`
    const operation = `${method} ${endpoint}`

    const context: CRMErrorContext = {
      userId: this.config.userId,
      provider: this.provider,
      operation,
      endpoint,
      timestamp: new Date()
    }

    // Execute with comprehensive reliability features
    return retryManager.executeWithProviderRetry(
      this.provider,
      operation,
      async () => {
        // Check rate limits
        const rateLimitStatus = await crmRateLimitManager.checkRateLimit(
          this.provider,
          operation,
          'medium'
        )

        if (!rateLimitStatus.allowed) {
          throw new CRMError(
            'rate_limit_error' as any,
            `Rate limit exceeded for ${this.provider}`,
            context,
            undefined,
            429
          )
        }

        const headers = {
          'Content-Type': 'application/json',
          ...this.authHeaders
        }

        const options: RequestInit = {
          method,
          headers
        }

        if (body) {
          options.body = JSON.stringify(body)
        }

        const response = await fetch(url, options)

        // Handle token refresh on 401
        if (response.status === 401 && this.config.refreshToken) {
          const refreshed = await this.refreshToken()
          if (refreshed) {
            // Retry the request with new token
            this.authHeaders = await this.getAuthHeaders()
            return this.makeRequest(endpoint, method, body)
          }
        }

        return response
      },
      context
    )
  }

  protected generateWebhookSignature(payload: any): string {
    const secret = this.config.apiSecret || ''
    const payloadString = JSON.stringify(payload)
    return createHash('sha256')
      .update(payloadString + secret)
      .digest('hex')
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract getCustomerEndpoint(externalId: string): string
  protected abstract getSearchEndpoint(query: string): string
  protected abstract getCreateCustomerEndpoint(): string
  protected abstract getUpdateCustomerEndpoint(externalId: string): string
  protected abstract getDeleteCustomerEndpoint(externalId: string): string
  protected abstract getLogActivityEndpoint(customerId: string): string
  protected abstract mapToCustomerData(data: any): CustomerData
  protected abstract mapFromCustomerData(customer: Partial<CustomerData>): any
  protected abstract mapActivityData(activity: Omit<Activity, 'id' | 'createdAt'>): any
  protected abstract getCustomerActivities(externalId: string): Promise<Activity[]>
  protected abstract getCustomerDeals(externalId: string): Promise<any[]>
  protected abstract getCustomerTickets(externalId: string): Promise<any[]>
}