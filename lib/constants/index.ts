/**
 * Application constants and configuration
 */

// API Configuration
export const API_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_TIMEOUT: 30000,
  MAX_TIMEOUT: 120000,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
} as const

// Database Configuration
export const DB_CONFIG = {
  MAX_CONNECTIONS: 20,
  CONNECTION_TIMEOUT: 10000,
  QUERY_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const

// Time Intervals
export const TIME_INTERVALS = {
  SECOND: 1000,
  MINUTE: 60000,
  HOUR: 3600000,
  DAY: 86400000,
  WEEK: 604800000,
  MONTH: 2592000000, // 30 days
} as const

// Date Range Presets
export const DATE_RANGES = {
  LAST_HOUR: '1h',
  LAST_DAY: '1d',
  LAST_WEEK: '7d',
  LAST_MONTH: '30d',
  LAST_QUARTER: '90d',
  LAST_YEAR: '365d',
} as const

// Conversation Status
export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  WAITING: 'waiting',
  ASSIGNED: 'assigned',
  ESCALATED: 'escalated',
  CLOSED: 'closed',
} as const

// Conversation Channels
export const CONVERSATION_CHANNELS = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  WEBSITE: 'website',
  EMAIL: 'email',
  PHONE: 'phone',
} as const

// Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  LOCATION: 'location',
  AUDIO: 'audio',
  VIDEO: 'video',
} as const

// Message Sender Types
export const SENDER_TYPES = {
  USER: 'user',
  AGENT: 'agent',
  SYSTEM: 'system',
  BOT: 'bot',
} as const

// Survey Status
export const SURVEY_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
} as const

// Survey Delivery Channels
export const SURVEY_CHANNELS = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  EMAIL: 'email',
  WEB: 'web',
} as const

// Priority Levels
export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const

// Sentiment Analysis
export const SENTIMENT = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
} as const

// Performance Thresholds
export const PERFORMANCE_THRESHOLDS = {
  FCP_GOOD: 1800, // First Contentful Paint (ms)
  FCP_NEEDS_IMPROVEMENT: 3000,
  LCP_GOOD: 2500, // Largest Contentful Paint (ms)
  LCP_NEEDS_IMPROVEMENT: 4000,
  FID_GOOD: 100, // First Input Delay (ms)
  FID_NEEDS_IMPROVEMENT: 300,
  CLS_GOOD: 0.1, // Cumulative Layout Shift
  CLS_NEEDS_IMPROVEMENT: 0.25,
} as const

// File Upload Limits
export const FILE_UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES_PER_UPLOAD: 5,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
} as const

// Notification Types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
} as const

// Lead Status
export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
  LOST: 'lost',
} as const

// Campaign Status
export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

// Campaign Types
export const CAMPAIGN_TYPES = {
  EMAIL: 'email',
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  MIXED: 'mixed',
} as const

// Campaign Frequency
export const CAMPAIGN_FREQUENCY = {
  ONCE: 'once',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const

// Webhook Events
export const WEBHOOK_EVENTS = {
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_UPDATED: 'conversation.updated',
  MESSAGE_RECEIVED: 'message.received',
  SURVEY_COMPLETED: 'survey.completed',
  LEAD_CREATED: 'lead.created',
  CAMPAIGN_SENT: 'campaign.sent',
} as const

// Error Codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
} as const

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const

// Pagination Defaults
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: API_CONFIG.DEFAULT_PAGE_SIZE,
  SORT: 'created_at',
  ORDER: 'desc' as const,
} as const

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[\d\s\-\(\)]+$/,
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  MESSAGE_MAX_LENGTH: 2000,
} as const

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_ANALYTICS: 'enable_analytics',
  ENABLE_MONITORING: 'enable_monitoring',
  ENABLE_SURVEYS: 'enable_surveys',
  ENABLE_LEAD_GENERATION: 'enable_lead_generation',
  ENABLE_CAMPAIGNS: 'enable_campaigns',
  ENABLE_WEBHOOKS: 'enable_webhooks',
  ENABLE_FILE_UPLOADS: 'enable_file_uploads',
  ENABLE_REAL_TIME_CHAT: 'enable_real_time_chat',
} as const

// Environment Variables
export const ENV_VARS = {
  DATABASE_URL: 'DATABASE_URL',
  SUPABASE_URL: 'NEXT_PUBLIC_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  TWILIO_ACCOUNT_SID: 'TWILIO_ACCOUNT_SID',
  TWILIO_AUTH_TOKEN: 'TWILIO_AUTH_TOKEN',
  TWILIO_PHONE_NUMBER: 'TWILIO_PHONE_NUMBER',
  SMTP_HOST: 'SMTP_HOST',
  SMTP_PORT: 'SMTP_PORT',
  SMTP_USER: 'SMTP_USER',
  SMTP_PASS: 'SMTP_PASS',
  REDIS_URL: 'REDIS_URL',
  JWT_SECRET: 'JWT_SECRET',
  ENCRYPTION_KEY: 'ENCRYPTION_KEY',
} as const

// Cache TTL (Time To Live)
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const

// Retry Configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,
  MAX_DELAY: 10000,
  BACKOFF_FACTOR: 2,
} as const

// Logging Levels
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const

// Theme Configuration
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const

// Language Codes
export const LANGUAGES = {
  EN: 'en',
  ES: 'es',
  FR: 'fr',
  DE: 'de',
  IT: 'it',
  PT: 'pt',
  RU: 'ru',
  JA: 'ja',
  KO: 'ko',
  ZH: 'zh',
} as const