import { BaseCRMConnector } from './base-connector'
import { CRMConfig, CustomerData, Activity } from './types'
import { logger } from '@/lib/logger'

export class PipedriveConnector extends BaseCRMConnector {
  get provider() { return 'pipedrive' as const }

  protected getBaseUrl(): string {
    return 'https://api.pipedrive.com/v1'
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.config.apiKey) {
      throw new Error('API key not available')
    }

    return {
      'Content-Type': 'application/json'
    }
  }

  protected getCustomerEndpoint(externalId: string): string {
    return `/persons/${externalId}?api_token=${this.config.apiKey}`
  }

  protected getSearchEndpoint(query: string): string {
    return `/persons/search?term=${encodeURIComponent(query)}&api_token=${this.config.apiKey}`
  }

  protected getCreateCustomerEndpoint(): string {
    return `/persons?api_token=${this.config.apiKey}`
  }

  protected getUpdateCustomerEndpoint(externalId: string): string {
    return `/persons/${externalId}?api_token=${this.config.apiKey}`
  }

  protected getDeleteCustomerEndpoint(externalId: string): string {
    return `/persons/${externalId}?api_token=${this.config.apiKey}`
  }

  protected getLogActivityEndpoint(customerId: string): string {
    return `/activities?api_token=${this.config.apiKey}`
  }

  protected mapToCustomerData(data: any): CustomerData {
    return {
      id: data.id.toString(),
      externalId: data.id.toString(),
      provider: 'pipedrive',
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email?.[0]?.value,
      phone: data.phone?.[0]?.value,
      company: data.org_name,
      jobTitle: data.job_title,
      address: data.address ? {
        street: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.postal_code,
        country: data.country
      } : undefined,
      tags: data.label_ids || [],
      customFields: {
        orgId: data.org_id,
        ownerId: data.owner_id,
        leadStatus: data.lead_status
      },
      lastActivity: data.last_activity_date ? new Date(data.last_activity_date) : undefined,
      createdAt: new Date(data.add_time),
      updatedAt: new Date(data.update_time)
    }
  }

  protected mapFromCustomerData(customer: Partial<CustomerData>): any {
    const data: any = {}

    if (customer.firstName) data.first_name = customer.firstName
    if (customer.lastName) data.last_name = customer.lastName
    if (customer.email) data.email = [{ value: customer.email, primary: true }]
    if (customer.phone) data.phone = [{ value: customer.phone, primary: true }]
    if (customer.company) data.org_name = customer.company
    if (customer.jobTitle) data.job_title = customer.jobTitle

    if (customer.address) {
      if (customer.address.street) data.address = customer.address.street
      if (customer.address.city) data.city = customer.address.city
      if (customer.address.state) data.state = customer.address.state
      if (customer.address.zipCode) data.postal_code = customer.address.zipCode
      if (customer.address.country) data.country = customer.address.country
    }

    return data
  }

  protected mapActivityData(activity: Omit<Activity, 'id' | 'createdAt'>): any {
    return {
      subject: activity.subject,
      type: this.mapActivityType(activity.type),
      note: activity.description,
      person_id: null, // Would need to be set by caller
      done: 1
    }
  }

  protected async getCustomerActivities(externalId: string): Promise<Activity[]> {
    try {
      const response = await this.makeRequest(`/persons/${externalId}/activities?api_token=${this.config.apiKey}`, 'GET')

      if (!response.ok) return []

      const data = await response.json()
      return (data.data || []).slice(0, 10).map((activity: any) => ({
        id: activity.id.toString(),
        type: this.mapPipedriveActivityType(activity.type),
        subject: activity.subject,
        description: activity.note,
        createdAt: new Date(activity.add_time)
      }))
    } catch (error) {
      logger.error('Failed to get Pipedrive activities', error as Error, {
        userId: this.config.userId,
        externalId
      })
      return []
    }
  }

  protected async getCustomerDeals(externalId: string): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/persons/${externalId}/deals?api_token=${this.config.apiKey}`, 'GET')

      if (!response.ok) return []

      const data = await response.json()
      return (data.data || []).slice(0, 5).map((deal: any) => ({
        id: deal.id.toString(),
        title: deal.title,
        value: deal.value,
        stage: deal.stage_id?.toString(),
        closeDate: deal.close_time ? new Date(deal.close_time) : undefined,
        createdAt: new Date(deal.add_time)
      }))
    } catch (error) {
      logger.error('Failed to get Pipedrive deals', error as Error, {
        userId: this.config.userId,
        externalId
      })
      return []
    }
  }

  protected async getCustomerTickets(externalId: string): Promise<any[]> {
    // Pipedrive doesn't have built-in tickets, but we can check for activities that might be support-related
    try {
      const response = await this.makeRequest(`/persons/${externalId}/activities?type=call&api_token=${this.config.apiKey}`, 'GET')

      if (!response.ok) return []

      const data = await response.json()
      return (data.data || []).slice(0, 5).map((activity: any) => ({
        id: activity.id.toString(),
        subject: activity.subject,
        status: activity.done ? 'completed' : 'open',
        priority: 'normal',
        createdAt: new Date(activity.add_time)
      }))
    } catch (error) {
      logger.error('Failed to get Pipedrive support activities', error as Error, {
        userId: this.config.userId,
        externalId
      })
      return []
    }
  }

  private mapActivityType(type: 'call' | 'email' | 'meeting' | 'note' | 'task'): string {
    switch (type) {
      case 'call': return 'call'
      case 'email': return 'email'
      case 'meeting': return 'meeting'
      case 'note': return 'note'
      case 'task': return 'task'
      default: return 'task'
    }
  }

  private mapPipedriveActivityType(type: string): 'call' | 'email' | 'meeting' | 'note' | 'task' {
    switch (type) {
      case 'call': return 'call'
      case 'email': return 'email'
      case 'meeting': return 'meeting'
      case 'note': return 'note'
      case 'task': return 'task'
      default: return 'task'
    }
  }

  async refreshToken(): Promise<boolean> {
    // Pipedrive uses API keys, not OAuth tokens, so no refresh needed
    return true
  }

  async searchCustomers(query: string): Promise<CustomerData[]> {
    try {
      const response = await this.makeRequest(`/persons/search?term=${encodeURIComponent(query)}&api_token=${this.config.apiKey}`, 'GET')

      if (!response.ok) {
        throw new Error(`Failed to search customers: ${response.statusText}`)
      }

      const data = await response.json()
      return (data.data?.items || []).map((item: any) => this.mapToCustomerData(item.item))
    } catch (error) {
      logger.error(`Failed to search customers in Pipedrive`, error as Error, {
        userId: this.config.userId,
        query
      })
      return []
    }
  }

  async logActivity(customerId: string, activity: Omit<Activity, 'id' | 'createdAt'>): Promise<string> {
    try {
      const endpoint = `/activities?api_token=${this.config.apiKey}`
      const payload = {
        ...this.mapActivityData(activity),
        person_id: parseInt(customerId)
      }

      const response = await this.makeRequest(endpoint, 'POST', payload)

      if (!response.ok) {
        throw new Error(`Failed to log activity: ${response.statusText}`)
      }

      const data = await response.json()
      return data.data?.id?.toString() || customerId
    } catch (error) {
      logger.error(`Failed to log activity in Pipedrive`, error as Error, {
        userId: this.config.userId,
        customerId,
        activity
      })
      throw error
    }
  }
}