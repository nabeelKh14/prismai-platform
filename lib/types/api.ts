/**
 * Common API types and interfaces
 */

// Base entity types
export interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
}

// User types
export interface User extends BaseEntity {
  email: string
  name?: string
  avatar_url?: string
}

// Conversation types
export interface Conversation extends BaseEntity {
  user_id: string
  customer_identifier: string
  channel: 'whatsapp' | 'sms' | 'website' | 'email'
  status: 'active' | 'resolved' | 'waiting' | 'assigned' | 'escalated'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  metadata?: Record<string, unknown>
}

export interface Message extends BaseEntity {
  conversation_id: string
  content: string
  sender_type: 'user' | 'agent' | 'system'
  message_type?: 'text' | 'image' | 'file' | 'location'
  metadata?: Record<string, unknown>
}

// Survey types
export interface SurveyTemplate extends BaseEntity {
  user_id: string
  name: string
  description?: string
  questions: SurveyQuestion[]
  settings?: SurveySettings
}

export interface SurveyQuestion {
  id: string
  type: 'text' | 'rating' | 'multiple_choice' | 'yes_no'
  question: string
  required: boolean
  options?: string[]
  validation?: QuestionValidation
}

export interface QuestionValidation {
  min_length?: number
  max_length?: number
  pattern?: string
}

export interface SurveySettings {
  allow_anonymous?: boolean
  show_progress?: boolean
  shuffle_questions?: boolean
  time_limit?: number
}

export interface Survey extends BaseEntity {
  user_id: string
  template_id: string
  conversation_id?: string
  customer_identifier: string
  delivery_channel: 'whatsapp' | 'sms' | 'email' | 'web'
  status: 'draft' | 'sent' | 'in_progress' | 'completed' | 'expired'
  expires_at?: string
  sent_at?: string
  completed_at?: string
  responses?: SurveyResponse[]
}

export interface SurveyResponse {
  question_id: string
  response_value: string | number | boolean
  response_type: 'text' | 'number' | 'boolean' | 'choice'
  metadata?: Record<string, unknown>
}

// Analytics types
export interface AnalyticsData {
  totalConversations: number
  resolvedConversations: number
  activeConversations: number
  resolutionRate: number
  averageResolutionTime: number
  customerSatisfaction: number
  channelBreakdown: {
    whatsapp: number
    sms: number
    website: number
    email?: number
  }
  dailyVolume: Array<{
    date: string
    conversations: number
    resolved: number
    satisfaction: number
  }>
  agentPerformance: Array<{
    id: string
    name: string
    conversations: number
    resolutionRate: number
    avgResponseTime: number
    satisfactionScore: number
    efficiency: number
  }>
  conversationOutcomes: {
    resolved: number
    escalated: number
    abandoned: number
    transferred: number
  }
  satisfactionTrends: Array<{
    date: string
    score: number
  }>
}

// Monitoring types
export interface ConversationMonitoring {
  id: string
  customer_identifier: string
  channel: string
  status: string
  sentiment: 'positive' | 'negative' | 'neutral'
  tags: string[]
  duration: number
  messages: number
  lastActivity: string
}

// Performance types
export interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  memoryUsage: number
  firstContentfulPaint?: number
  largestContentfulPaint?: number
  firstInputDelay?: number
  cumulativeLayoutShift?: number
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  code?: string
  timestamp: string
  requestId?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Error types
export interface ApiError {
  message: string
  code?: string
  details?: unknown
  timestamp: string
  requestId?: string
}

// Request/Response utilities
export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface FilterParams {
  status?: string
  channel?: string
  date_from?: string
  date_to?: string
  search?: string
}

// Webhook types
export interface WebhookPayload {
  event: string
  data: Record<string, unknown>
  timestamp: string
  signature?: string
}

export interface WebhookResponse {
  success: boolean
  message?: string
  retryable?: boolean
}

// File upload types
export interface FileUpload {
  id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  url: string
  uploaded_at: string
}

// Notification types
export interface Notification {
  id: string
  user_id: string
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  read: boolean
  created_at: string
  metadata?: Record<string, unknown>
}

// Lead types
export interface Lead {
  id: string
  user_id: string
  name: string
  email?: string
  phone?: string
  source: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  score?: number
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

// Campaign types
export interface Campaign {
  id: string
  user_id: string
  name: string
  description?: string
  type: 'email' | 'sms' | 'whatsapp' | 'mixed'
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed'
  target_audience: CampaignAudience
  content: CampaignContent
  schedule?: CampaignSchedule
  metrics?: CampaignMetrics
}

export interface CampaignAudience {
  total_contacts: number
  filters?: Record<string, unknown>
  segments?: string[]
}

export interface CampaignContent {
  subject?: string
  message: string
  media_urls?: string[]
  variables?: Record<string, string>
}

export interface CampaignSchedule {
  start_date: string
  end_date?: string
  timezone: string
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly'
}

export interface CampaignMetrics {
  sent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
  bounced: number
  unsubscribed: number
}