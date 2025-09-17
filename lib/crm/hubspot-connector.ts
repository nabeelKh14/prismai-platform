import { BaseCRMConnector } from './base-connector'
import { CRMConfig, CustomerData, Activity } from './types'
import { logger } from '@/lib/logger'

export class HubSpotConnector extends BaseCRMConnector {
  get provider() { return 'hubspot' as const }

  protected getBaseUrl(): string {
    return 'https://api.hubapi.com'
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.config.accessToken) {
      throw new Error('Access token not available')
    }

    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json'
    }
  }

  protected getCustomerEndpoint(externalId: string): string {
    return `/crm/v3/objects/contacts/${externalId}`
  }

  protected getSearchEndpoint(query: string): string {
    return `/crm/v3/objects/contacts/search`
  }

  protected getCreateCustomerEndpoint(): string {
    return '/crm/v3/objects/contacts'
  }

  protected getUpdateCustomerEndpoint(externalId: string): string {
    return `/crm/v3/objects/contacts/${externalId}`
  }

  protected getDeleteCustomerEndpoint(externalId: string): string {
    return `/crm/v3/objects/contacts/${externalId}`
  }

  protected getLogActivityEndpoint(customerId: string): string {
    return '/crm/v3/objects/notes'
  }

  protected mapToCustomerData(data: any): CustomerData {
    const properties = data.properties || {}

    return {
      id: data.id,
      externalId: data.id,
      provider: 'hubspot',
      firstName: properties.firstname,
      lastName: properties.lastname,
      email: properties.email,
      phone: properties.phone,
      company: properties.company,
      jobTitle: properties.jobtitle,
      address: properties.address ? {
        street: properties.address,
        city: properties.city,
        state: properties.state,
        zipCode: properties.zip,
        country: properties.country
      } : undefined,
      tags: properties.hs_tags ? properties.hs_tags.split(';') : [],
      lifecycleStage: properties.lifecyclestage,
      leadScore: properties.hs_lead_score ? parseInt(properties.hs_lead_score) : undefined,
      customFields: {
        website: properties.website,
        industry: properties.industry,
        annualRevenue: properties.annualrevenue
      },
      lastActivity: properties.hs_lastactivitydate ? new Date(parseInt(properties.hs_lastactivitydate)) : undefined,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    }
  }

  protected mapFromCustomerData(customer: Partial<CustomerData>): any {
    const properties: any = {}

    if (customer.firstName) properties.firstname = customer.firstName
    if (customer.lastName) properties.lastname = customer.lastName
    if (customer.email) properties.email = customer.email
    if (customer.phone) properties.phone = customer.phone
    if (customer.company) properties.company = customer.company
    if (customer.jobTitle) properties.jobtitle = customer.jobTitle
    if (customer.tags) properties.hs_tags = customer.tags.join(';')

    if (customer.address) {
      if (customer.address.street) properties.address = customer.address.street
      if (customer.address.city) properties.city = customer.address.city
      if (customer.address.state) properties.state = customer.address.state
      if (customer.address.zipCode) properties.zip = customer.address.zipCode
      if (customer.address.country) properties.country = customer.address.country
    }

    return { properties }
  }

  protected mapActivityData(activity: Omit<Activity, 'id' | 'createdAt'>): any {
    return {
      properties: {
        hs_note_body: `${activity.subject}\n\n${activity.description || ''}`,
        hs_timestamp: Date.now().toString()
      },
      associations: [] // Would need to associate with contact
    }
  }

  protected async getCustomerActivities(externalId: string): Promise<Activity[]> {
    try {
      const response = await this.makeRequest(`/crm/v3/objects/contacts/${externalId}/associations/notes`, 'GET')

      if (!response.ok) return []

      const data = await response.json()
      const noteIds = data.results?.map((assoc: any) => assoc.toObjectId) || []

      if (noteIds.length === 0) return []

      const notesResponse = await this.makeRequest(`/crm/v3/objects/notes/batch/read`, 'POST', {
        properties: ['hs_note_body', 'hs_createdate'],
        inputs: noteIds.slice(0, 10).map((id: string) => ({ id }))
      })

      if (!notesResponse.ok) return []

      const notesData = await notesResponse.json()
      return (notesData.results || []).map((note: any) => ({
        id: note.id,
        type: 'note' as const,
        subject: note.properties.hs_note_body?.split('\n')[0] || 'Note',
        description: note.properties.hs_note_body,
        createdAt: new Date(parseInt(note.properties.hs_createdate))
      }))
    } catch (error) {
      logger.error('Failed to get HubSpot activities', error as Error, {
        userId: this.config.userId,
        externalId
      })
      return []
    }
  }

  protected async getCustomerDeals(externalId: string): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/crm/v3/objects/contacts/${externalId}/associations/deals`, 'GET')

      if (!response.ok) return []

      const data = await response.json()
      const dealIds = data.results?.map((assoc: any) => assoc.toObjectId) || []

      if (dealIds.length === 0) return []

      const dealsResponse = await this.makeRequest(`/crm/v3/objects/deals/batch/read`, 'POST', {
        properties: ['dealname', 'amount', 'dealstage', 'closedate', 'createdate'],
        inputs: dealIds.slice(0, 5).map((id: string) => ({ id }))
      })

      if (!dealsResponse.ok) return []

      const dealsData = await dealsResponse.json()
      return (dealsData.results || []).map((deal: any) => ({
        id: deal.id,
        title: deal.properties.dealname,
        value: deal.properties.amount ? parseFloat(deal.properties.amount) : undefined,
        stage: deal.properties.dealstage,
        closeDate: deal.properties.closedate ? new Date(parseInt(deal.properties.closedate)) : undefined,
        createdAt: new Date(parseInt(deal.properties.createdate))
      }))
    } catch (error) {
      logger.error('Failed to get HubSpot deals', error as Error, {
        userId: this.config.userId,
        externalId
      })
      return []
    }
  }

  protected async getCustomerTickets(externalId: string): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/crm/v3/objects/contacts/${externalId}/associations/tickets`, 'GET')

      if (!response.ok) return []

      const data = await response.json()
      const ticketIds = data.results?.map((assoc: any) => assoc.toObjectId) || []

      if (ticketIds.length === 0) return []

      const ticketsResponse = await this.makeRequest(`/crm/v3/objects/tickets/batch/read`, 'POST', {
        properties: ['subject', 'hs_ticket_status', 'hs_ticket_priority', 'createdate'],
        inputs: ticketIds.slice(0, 5).map((id: string) => ({ id }))
      })

      if (!ticketsResponse.ok) return []

      const ticketsData = await ticketsResponse.json()
      return (ticketsData.results || []).map((ticket: any) => ({
        id: ticket.id,
        subject: ticket.properties.subject,
        status: ticket.properties.hs_ticket_status,
        priority: ticket.properties.hs_ticket_priority,
        createdAt: new Date(parseInt(ticket.properties.createdate))
      }))
    } catch (error) {
      logger.error('Failed to get HubSpot tickets', error as Error, {
        userId: this.config.userId,
        externalId
      })
      return []
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      if (!this.config.refreshToken || !this.config.apiKey || !this.config.apiSecret) {
        return false
      }

      const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.config.refreshToken,
          client_id: this.config.apiKey,
          client_secret: this.config.apiSecret
        })
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Update config with new tokens
      this.config.accessToken = data.access_token
      if (data.refresh_token) {
        this.config.refreshToken = data.refresh_token
      }

      return true
    } catch (error) {
      logger.error('HubSpot token refresh failed', error as Error, {
        userId: this.config.userId
      })
      return false
    }
  }

  async searchCustomers(query: string): Promise<CustomerData[]> {
    try {
      const response = await this.makeRequest('/crm/v3/objects/contacts/search', 'POST', {
        filterGroups: [{
          filters: [
            {
              propertyName: 'email',
              operator: 'CONTAINS_TOKEN',
              value: query
            }
          ]
        }],
        properties: ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'city', 'state', 'country'],
        limit: 20
      })

      if (!response.ok) {
        throw new Error(`Failed to search customers: ${response.statusText}`)
      }

      const data = await response.json()
      return (data.results || []).map((item: any) => this.mapToCustomerData(item))
    } catch (error) {
      logger.error(`Failed to search customers in HubSpot`, error as Error, {
        userId: this.config.userId,
        query
      })
      return []
    }
  }
}