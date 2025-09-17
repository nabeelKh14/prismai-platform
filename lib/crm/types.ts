// CRM Integration Types and Interfaces

export interface CRMConfig {
  id: string
  userId: string
  provider: CRMProvider
  apiKey?: string
  apiSecret?: string
  accessToken?: string
  refreshToken?: string
  instanceUrl?: string
  webhookUrl?: string
  isActive: boolean
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type CRMProvider = 'salesforce' | 'hubspot' | 'pipedrive'

export interface CustomerData {
  id: string
  externalId: string
  provider: CRMProvider
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  jobTitle?: string
  address?: Address
  tags?: string[]
  customFields?: Record<string, any>
  lastActivity?: Date
  lifecycleStage?: string
  leadScore?: number
  createdAt: Date
  updatedAt: Date
}

export interface Address {
  street?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export interface ConversationContext {
  customerId: string
  conversationId: string
  provider: CRMProvider
  contextData: {
    recentActivities?: Activity[]
    openDeals?: Deal[]
    supportTickets?: Ticket[]
    notes?: string[]
    preferences?: Record<string, any>
  }
  enrichedAt: Date
}

export interface Activity {
  id: string
  type: 'call' | 'email' | 'meeting' | 'note' | 'task'
  subject: string
  description?: string
  createdAt: Date
}

export interface Deal {
  id: string
  title: string
  value?: number
  stage: string
  closeDate?: Date
  createdAt: Date
}

export interface Ticket {
  id: string
  subject: string
  status: string
  priority: string
  createdAt: Date
}

export interface CRMConnector {
  provider: CRMProvider

  // Authentication
  authenticate(): Promise<boolean>
  refreshToken(): Promise<boolean>

  // Customer operations
  getCustomer(externalId: string): Promise<CustomerData | null>
  searchCustomers(query: string): Promise<CustomerData[]>
  createCustomer(customer: Partial<CustomerData>): Promise<CustomerData>
  updateCustomer(externalId: string, updates: Partial<CustomerData>): Promise<CustomerData>
  deleteCustomer(externalId: string): Promise<boolean>

  // Activity logging
  logActivity(customerId: string, activity: Omit<Activity, 'id' | 'createdAt'>): Promise<string>

  // Context enrichment
  getCustomerContext(externalId: string): Promise<ConversationContext | null>

  // Webhook handling
  validateWebhook(payload: any, signature: string): boolean
  processWebhook(payload: any): Promise<void>
}

export interface CRMConnectorFactory {
  createConnector(config: CRMConfig): CRMConnector
}

export interface SyncResult {
  success: boolean
  syncedCount: number
  errors: string[]
  lastSyncAt: Date
}

export interface CRMSyncOptions {
  fullSync?: boolean
  since?: Date
  batchSize?: number
  includeInactive?: boolean
}