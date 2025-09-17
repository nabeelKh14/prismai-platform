import { BaseCRMConnector } from './base-connector'
import { CRMConfig, CustomerData, Activity } from './types'
import { logger } from '@/lib/logger'

export class SalesforceConnector extends BaseCRMConnector {
  get provider() { return 'salesforce' as const }

  protected getBaseUrl(): string {
    return this.config.instanceUrl || 'https://login.salesforce.com'
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
    return `/services/data/v57.0/sobjects/Contact/${externalId}`
  }

  protected getSearchEndpoint(query: string): string {
    const encodedQuery = encodeURIComponent(`SELECT Id, FirstName, LastName, Email, Phone, Account.Name, Title, MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry FROM Contact WHERE Name LIKE '%${query}%' OR Email LIKE '%${query}%' LIMIT 20`)
    return `/services/data/v57.0/query?q=${encodedQuery}`
  }

  protected getCreateCustomerEndpoint(): string {
    return '/services/data/v57.0/sobjects/Contact'
  }

  protected getUpdateCustomerEndpoint(externalId: string): string {
    return `/services/data/v57.0/sobjects/Contact/${externalId}`
  }

  protected getDeleteCustomerEndpoint(externalId: string): string {
    return `/services/data/v57.0/sobjects/Contact/${externalId}`
  }

  protected getLogActivityEndpoint(customerId: string): string {
    return '/services/data/v57.0/sobjects/Task'
  }

  protected mapToCustomerData(data: any): CustomerData {
    return {
      id: data.Id,
      externalId: data.Id,
      provider: 'salesforce',
      firstName: data.FirstName,
      lastName: data.LastName,
      email: data.Email,
      phone: data.Phone,
      company: data.Account?.Name,
      jobTitle: data.Title,
      address: data.MailingStreet ? {
        street: data.MailingStreet,
        city: data.MailingCity,
        state: data.MailingState,
        zipCode: data.MailingPostalCode,
        country: data.MailingCountry
      } : undefined,
      customFields: {
        accountId: data.AccountId,
        department: data.Department,
        leadSource: data.LeadSource
      },
      createdAt: new Date(data.CreatedDate),
      updatedAt: new Date(data.LastModifiedDate)
    }
  }

  protected mapFromCustomerData(customer: Partial<CustomerData>): any {
    const data: any = {}

    if (customer.firstName) data.FirstName = customer.firstName
    if (customer.lastName) data.LastName = customer.lastName
    if (customer.email) data.Email = customer.email
    if (customer.phone) data.Phone = customer.phone
    if (customer.jobTitle) data.Title = customer.jobTitle
    if (customer.company) data.Account = { Name: customer.company }

    if (customer.address) {
      if (customer.address.street) data.MailingStreet = customer.address.street
      if (customer.address.city) data.MailingCity = customer.address.city
      if (customer.address.state) data.MailingState = customer.address.state
      if (customer.address.zipCode) data.MailingPostalCode = customer.address.zipCode
      if (customer.address.country) data.MailingCountry = customer.address.country
    }

    return data
  }

  protected mapActivityData(activity: Omit<Activity, 'id' | 'createdAt'>): any {
    return {
      Subject: activity.subject,
      Description: activity.description,
      Status: 'Completed',
      Priority: 'Normal',
      Type: activity.type === 'call' ? 'Call' : activity.type === 'meeting' ? 'Meeting' : 'Other',
      ActivityDate: new Date().toISOString().split('T')[0]
    }
  }

  protected async getCustomerActivities(externalId: string): Promise<Activity[]> {
    try {
      const query = encodeURIComponent(`SELECT Id, Subject, Description, Type, CreatedDate FROM Task WHERE WhoId = '${externalId}' ORDER BY CreatedDate DESC LIMIT 10`)
      const response = await this.makeRequest(`/services/data/v57.0/query?q=${query}`, 'GET')

      if (!response.ok) return []

      const data = await response.json()
      return (data.records || []).map((record: any) => ({
        id: record.Id,
        type: this.mapSalesforceActivityType(record.Type),
        subject: record.Subject,
        description: record.Description,
        createdAt: new Date(record.CreatedDate)
      }))
    } catch (error) {
      logger.error('Failed to get Salesforce activities', error as Error, {
        userId: this.config.userId,
        externalId
      })
      return []
    }
  }

  protected async getCustomerDeals(externalId: string): Promise<any[]> {
    try {
      const query = encodeURIComponent(`SELECT Id, Name, Amount, StageName, CloseDate, CreatedDate FROM Opportunity WHERE AccountId IN (SELECT AccountId FROM Contact WHERE Id = '${externalId}') AND IsClosed = false ORDER BY CreatedDate DESC LIMIT 5`)
      const response = await this.makeRequest(`/services/data/v57.0/query?q=${query}`, 'GET')

      if (!response.ok) return []

      const data = await response.json()
      return (data.records || []).map((record: any) => ({
        id: record.Id,
        title: record.Name,
        value: record.Amount,
        stage: record.StageName,
        closeDate: record.CloseDate ? new Date(record.CloseDate) : undefined,
        createdAt: new Date(record.CreatedDate)
      }))
    } catch (error) {
      logger.error('Failed to get Salesforce deals', error as Error, {
        userId: this.config.userId,
        externalId
      })
      return []
    }
  }

  protected async getCustomerTickets(externalId: string): Promise<any[]> {
    try {
      const query = encodeURIComponent(`SELECT Id, Subject, Status, Priority, CreatedDate FROM Case WHERE ContactId = '${externalId}' ORDER BY CreatedDate DESC LIMIT 5`)
      const response = await this.makeRequest(`/services/data/v57.0/query?q=${query}`, 'GET')

      if (!response.ok) return []

      const data = await response.json()
      return (data.records || []).map((record: any) => ({
        id: record.Id,
        subject: record.Subject,
        status: record.Status,
        priority: record.Priority,
        createdAt: new Date(record.CreatedDate)
      }))
    } catch (error) {
      logger.error('Failed to get Salesforce cases', error as Error, {
        userId: this.config.userId,
        externalId
      })
      return []
    }
  }

  private mapSalesforceActivityType(type: string): 'call' | 'email' | 'meeting' | 'note' | 'task' {
    switch (type) {
      case 'Call': return 'call'
      case 'Email': return 'email'
      case 'Meeting': return 'meeting'
      default: return 'task'
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      if (!this.config.refreshToken || !this.config.apiKey || !this.config.apiSecret) {
        return false
      }

      const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
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
      if (data.instance_url) {
        this.config.instanceUrl = data.instance_url
      }

      return true
    } catch (error) {
      logger.error('Salesforce token refresh failed', error as Error, {
        userId: this.config.userId
      })
      return false
    }
  }
}