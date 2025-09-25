/**
 * Comprehensive Lead Data Validation System
 * Provides robust validation for lead data, MCP sources, CRM integrations, and workflow processes
 */

import { z } from 'zod'
import { ValidationError, ExternalServiceError } from '@/lib/errors'
import { logger } from '@/lib/logger'

// Email validation regex patterns
const EMAIL_PATTERNS = {
  // Standard email validation
  standard: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Business email patterns (avoiding common free email providers)
  business: /^(?!.*@(gmail|yahoo|hotmail|outlook|aol|icloud|protonmail|mail|yandex|qq|zoho)\.).*@[^\s@]+\.[^\s@]+$/i,

  // Role-based email patterns
  roleBased: /^(?!.*(noreply|no-reply|donotreply|do-not-reply|admin|administrator|info|contact|support|help|sales|marketing|billing|accounts|hr|human.resources|jobs|careers|newsletter|news|press|media|pr|public.relations|legal|abuse|security|spam|postmaster|webmaster|hostmaster|root|sysadmin|it|tech|technology|dev|developer|engineering|qa|quality|test|staging|demo|trial|temp|temporary|example|sample|testmail|test-email)).*@[^\s@]+\.[^\s@]+$/i,

  // Disposable email patterns
  disposable: /^(?!.*@(10minutemail|guerrillamail|mailinator|temp-mail|throwaway|dispostable|maildrop|tempmail|10minmail|guerrillamailbox|mailin8r|temp-mailbox|tempmailbox|throwawaymail|disposablemail|tempmailbox|10minutemailbox|guerrillamailbox|mailinatorbox|temp-mailbox|throwawaymailbox|disposablemailbox|tempmailbox|10minutemailbox|guerrillamailbox|mailinatorbox|temp-mailbox|throwawaymailbox|disposablemailbox)).*@[^\s@]+\.[^\s@]+$/i
}

// Phone number validation patterns
const PHONE_PATTERNS = {
  // International phone number (basic validation)
  international: /^\+?[1-9]\d{1,14}$/,

  // US/Canada phone number
  usCanada: /^(\+?1)?[-.\s]?\(?([2-9][0-8][0-9])\)?[-.\s]?([2-9][0-9]{2})[-.\s]?([0-9]{4})$/,

  // E.164 format (international standard)
  e164: /^\+[1-9]\d{1,14}$/
}

// Company name validation patterns
const COMPANY_PATTERNS = {
  // Basic company name validation
  basic: /^[a-zA-Z0-9\s&.,'-]{2,100}$/,

  // Extended company name (allows more characters)
  extended: /^[a-zA-Z0-9\s&.,'()-]{2,150}$/,

  // Domain-like company names
  domainLike: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.?[a-zA-Z0-9-]*[a-zA-Z0-9]*$/
}

// Lead data validation schemas
export const LeadValidationSchemas = {
  // Basic lead creation schema
  create: z.object({
    email: z.string()
      .min(1, 'Email is required')
      .max(254, 'Email too long')
      .regex(EMAIL_PATTERNS.standard, 'Invalid email format')
      .regex(EMAIL_PATTERNS.roleBased, 'Role-based emails are not allowed')
      .refine((email) => {
        const domain = email.split('@')[1]?.toLowerCase()
        const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com']
        return !freeDomains.includes(domain)
      }, 'Free email providers are not allowed for business leads'),

    firstName: z.string()
      .min(1, 'First name is required')
      .max(50, 'First name too long')
      .regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters')
      .refine((name) => name.trim().length >= 2, 'First name must be at least 2 characters'),

    lastName: z.string()
      .min(1, 'Last name is required')
      .max(50, 'Last name too long')
      .regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters')
      .refine((name) => name.trim().length >= 2, 'Last name must be at least 2 characters'),

    company: z.string()
      .min(1, 'Company is required')
      .max(100, 'Company name too long')
      .regex(COMPANY_PATTERNS.extended, 'Company name contains invalid characters')
      .refine((company) => company.trim().length >= 2, 'Company name must be at least 2 characters'),

    jobTitle: z.string()
      .max(100, 'Job title too long')
      .regex(/^[a-zA-Z\s,.'"-]+$/, 'Job title contains invalid characters')
      .optional(),

    phone: z.string()
      .regex(PHONE_PATTERNS.e164, 'Phone must be in E.164 format (+1234567890)')
      .optional()
      .nullable(),

    sourceId: z.string().uuid('Invalid source ID').optional(),

    tags: z.array(z.string().max(50, 'Tag too long')).max(20, 'Too many tags').optional(),

    customFields: z.record(z.unknown()).optional(),

    // Optional enrichment data
    githubUsername: z.string()
      .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, 'Invalid GitHub username')
      .optional(),

    linkedinUrl: z.string()
      .url('Invalid LinkedIn URL')
      .refine((url) => url.includes('linkedin.com'), 'Must be a LinkedIn URL')
      .optional(),

    website: z.string()
      .url('Invalid website URL')
      .optional()
  }),

  // Lead update schema (all fields optional except ID)
  update: z.object({
    id: z.string().uuid('Invalid lead ID'),
    email: z.string()
      .max(254, 'Email too long')
      .regex(EMAIL_PATTERNS.standard, 'Invalid email format')
      .optional(),

    firstName: z.string()
      .max(50, 'First name too long')
      .regex(/^[a-zA-Z\s'-]+$/, 'First name contains invalid characters')
      .optional(),

    lastName: z.string()
      .max(50, 'Last name too long')
      .regex(/^[a-zA-Z\s'-]+$/, 'Last name contains invalid characters')
      .optional(),

    company: z.string()
      .max(100, 'Company name too long')
      .regex(COMPANY_PATTERNS.extended, 'Company name contains invalid characters')
      .optional(),

    jobTitle: z.string()
      .max(100, 'Job title too long')
      .regex(/^[a-zA-Z\s,.'"-]+$/, 'Job title contains invalid characters')
      .optional(),

    phone: z.string()
      .regex(PHONE_PATTERNS.e164, 'Phone must be in E.164 format (+1234567890)')
      .optional()
      .nullable(),

    tags: z.array(z.string().max(50, 'Tag too long')).max(20, 'Too many tags').optional(),

    customFields: z.record(z.unknown()).optional(),

    // Lead scoring and status
    leadScore: z.number().min(0).max(100).optional(),
    status: z.enum(['new', 'contacted', 'qualified', 'opportunity', 'customer', 'lost']).optional(),

    // Engagement tracking
    engagementScore: z.number().min(0).max(1000).optional(),
    conversionProbability: z.number().min(0).max(1).optional(),
    estimatedValue: z.number().min(0).optional()
  }),

  // Lead scoring schema
  scoring: z.object({
    email: z.string().email('Invalid email format'),
    company: z.string().min(1, 'Company is required'),
    jobTitle: z.string().optional(),
    engagement: z.object({
      form_completion: z.number().min(0).default(0),
      email_opens: z.number().min(0).default(0),
      email_clicks: z.number().min(0).default(0),
      website_visits: z.number().min(0).default(0),
      content_downloads: z.number().min(0).default(0)
    }).optional(),
    githubUsername: z.string().optional(),
    domain: z.string().optional()
  }),

  // Lead search and filtering schema
  search: z.object({
    query: z.string().min(1, 'Search query is required').max(100, 'Query too long'),
    filters: z.object({
      status: z.enum(['new', 'contacted', 'qualified', 'opportunity', 'customer', 'lost']).optional(),
      minScore: z.number().min(0).max(100).optional(),
      maxScore: z.number().min(0).max(100).optional(),
      segment: z.string().optional(),
      source: z.string().uuid().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
      tags: z.array(z.string()).optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional()
    }).optional(),
    pagination: z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
      sortBy: z.enum(['created_at', 'lead_score', 'engagement_score', 'company', 'last_name']).default('created_at'),
      sortOrder: z.enum(['asc', 'desc']).default('desc')
    }).optional()
  })
}

// MCP data source validation schemas
export const MCPValidationSchemas = {
  // GitHub profile validation
  githubProfile: z.object({
    username: z.string()
      .min(1, 'GitHub username is required')
      .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, 'Invalid GitHub username'),
    followers: z.number().min(0).optional(),
    publicRepos: z.number().min(0).optional(),
    company: z.string().optional(),
    accountAge: z.number().min(0).optional()
  }),

  // Company data validation (Clearbit style)
  companyData: z.object({
    domain: z.string().min(1, 'Domain is required'),
    name: z.string().min(1, 'Company name is required'),
    employees: z.number().min(0).optional(),
    funding: z.number().min(0).optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    foundedYear: z.number().min(1900).max(new Date().getFullYear()).optional()
  }),

  // Email verification validation (Hunter.io style)
  emailVerification: z.object({
    email: z.string().email('Invalid email format'),
    score: z.number().min(0).max(100).optional(),
    deliverable: z.boolean().optional(),
    webmail: z.boolean().optional(),
    smtpCheck: z.boolean().optional(),
    catchAll: z.boolean().optional()
  }),

  // Knowledge base validation (Wikipedia/StackOverflow)
  knowledgeData: z.object({
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    topics: z.array(z.string()).optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
    sources: z.array(z.string()).optional()
  })
}

// CRM integration validation schemas
export const CRMValidationSchemas = {
  // CRM sync configuration
  syncConfig: z.object({
    provider: z.enum(['salesforce', 'hubspot', 'pipedrive', 'zoho', 'dynamics']),
    fullSync: z.boolean().default(false),
    since: z.string().datetime().optional(),
    batchSize: z.number().min(1).max(1000).default(100),
    fields: z.array(z.string()).optional(),
    filters: z.record(z.unknown()).optional()
  }),

  // CRM customer data
  customerData: z.object({
    id: z.string().min(1, 'Customer ID is required'),
    email: z.string().email('Invalid email format'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    company: z.string().optional(),
    phone: z.string().optional(),
    status: z.string().optional(),
    value: z.number().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
    customFields: z.record(z.unknown()).optional()
  }),

  // CRM sync result
  syncResult: z.object({
    success: z.boolean(),
    totalProcessed: z.number().min(0),
    successful: z.number().min(0),
    failed: z.number().min(0),
    errors: z.array(z.object({
      recordId: z.string(),
      error: z.string(),
      timestamp: z.string().datetime()
    })).optional(),
    lastSyncAt: z.string().datetime(),
    nextSyncAt: z.string().datetime().optional()
  })
}

// Workflow validation schemas
export const WorkflowValidationSchemas = {
  // Workflow definition
  workflow: z.object({
    name: z.string()
      .min(1, 'Workflow name is required')
      .max(100, 'Workflow name too long')
      .regex(/^[a-zA-Z0-9\s_-]+$/, 'Workflow name contains invalid characters'),

    description: z.string()
      .max(500, 'Description too long')
      .optional(),

    triggerType: z.enum(['lead_created', 'score_changed', 'behavior', 'time_based', 'manual']),

    triggerConditions: z.record(z.unknown()).default({}),

    steps: z.array(z.object({
      id: z.string().uuid(),
      type: z.enum(['email', 'wait', 'condition', 'webhook', 'update_lead', 'create_task']),
      name: z.string().min(1, 'Step name is required'),
      config: z.record(z.unknown()),
      conditions: z.array(z.record(z.unknown())).optional(),
      delay: z.number().min(0).optional() // Delay in minutes
    })).min(1, 'Workflow must have at least one step'),

    status: z.enum(['draft', 'active', 'paused', 'archived']).default('draft'),

    settings: z.object({
      maxExecutionsPerDay: z.number().min(1).default(1000),
      retryFailedExecutions: z.boolean().default(true),
      notifyOnFailure: z.boolean().default(true),
      priority: z.enum(['low', 'medium', 'high']).default('medium')
    }).optional()
  }),

  // Workflow execution
  execution: z.object({
    workflowId: z.string().uuid('Invalid workflow ID'),
    leadId: z.string().uuid('Invalid lead ID'),
    triggerData: z.record(z.unknown()),
    context: z.record(z.unknown()).optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium')
  }),

  // A/B test validation
  abTest: z.object({
    name: z.string()
      .min(1, 'Test name is required')
      .max(100, 'Test name too long'),

    testType: z.enum(['email_subject', 'email_content', 'send_time', 'landing_page', 'cta_button']),

    variants: z.array(z.object({
      id: z.string().uuid(),
      name: z.string().min(1, 'Variant name is required'),
      content: z.string().min(1, 'Variant content is required'),
      weight: z.number().min(0).max(100).default(50)
    })).min(2, 'A/B test must have at least 2 variants').max(10, 'Too many variants'),

    targetAudience: z.object({
      segmentId: z.string().uuid().optional(),
      criteria: z.record(z.unknown()).optional(),
      sampleSize: z.number().min(10).max(10000).optional()
    }),

    winnerCriteria: z.object({
      metric: z.enum(['conversion_rate', 'click_rate', 'engagement_rate', 'revenue']),
      threshold: z.number().min(0).max(1),
      minDuration: z.number().min(1).default(7) // Days
    }),

    status: z.enum(['draft', 'running', 'completed', 'paused']).default('draft'),

    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
}

/**
 * Lead Data Validator Class
 * Provides comprehensive validation for lead data with detailed error reporting
 */
export class LeadDataValidator {
  private static instance: LeadDataValidator

  static getInstance(): LeadDataValidator {
    if (!LeadDataValidator.instance) {
      LeadDataValidator.instance = new LeadDataValidator()
    }
    return LeadDataValidator.instance
  }

  /**
   * Validate lead creation data
   */
  async validateLeadCreation(data: unknown): Promise<ValidatedLeadData> {
    try {
      const validated = LeadValidationSchemas.create.parse(data)

      // Additional business logic validation
      await this.validateBusinessRules(validated)

      // Sanitize and normalize data
      const sanitized = this.sanitizeLeadData(validated)

      return sanitized
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))

        logger.warn('Lead creation validation failed', {
          errors: validationErrors,
          input: data
        })

        throw new ValidationError('Lead data validation failed', { errors: validationErrors })
      }

      throw error
    }
  }

  /**
   * Validate lead update data
   */
  async validateLeadUpdate(data: unknown): Promise<ValidatedLeadUpdateData> {
    try {
      const validated = LeadValidationSchemas.update.parse(data)

      // Additional business logic validation
      await this.validateBusinessRules(validated)

      // Sanitize and normalize data
      const sanitized = this.sanitizeLeadData(validated)

      return sanitized
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          
          code: err.code
        }))

        logger.warn('Lead update validation failed', {
          errors: validationErrors,
          input: data
        })

        throw new ValidationError('Lead update data validation failed', { errors: validationErrors })
      }

      throw error
    }
  }

  /**
   * Validate MCP data sources
   */
  async validateMCPData(data: unknown, source: 'github' | 'company' | 'email' | 'knowledge'): Promise<ValidatedMCPData> {
    try {
      let validated: any

      switch (source) {
        case 'github':
          validated = MCPValidationSchemas.githubProfile.parse(data)
          break
        case 'company':
          validated = MCPValidationSchemas.companyData.parse(data)
          break
        case 'email':
          validated = MCPValidationSchemas.emailVerification.parse(data)
          break
        case 'knowledge':
          validated = MCPValidationSchemas.knowledgeData.parse(data)
          break
        default:
          throw new ValidationError(`Unknown MCP data source: ${source}`)
      }

      // Validate data quality and consistency
      await this.validateMCPDataQuality(validated, source)

      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))

        logger.warn(`MCP ${source} data validation failed`, {
          errors: validationErrors,
          input: data
        })

        throw new ValidationError(`${source} data validation failed`, { errors: validationErrors })
      }

      throw error
    }
  }

  /**
   * Validate CRM integration data
   */
  async validateCRMData(data: unknown, provider: string): Promise<ValidatedCRMData> {
    try {
      const validated = CRMValidationSchemas.customerData.parse(data)

      // Provider-specific validation
      await this.validateCRMProviderData(validated, provider)

      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          
          code: err.code
        }))

        logger.warn(`CRM ${provider} data validation failed`, {
          errors: validationErrors,
          input: data
        })

        throw new ValidationError(`${provider} data validation failed`, { errors: validationErrors })
      }

      throw error
    }
  }

  /**
   * Validate workflow data
   */
  async validateWorkflow(data: unknown): Promise<ValidatedWorkflowData> {
    try {
      const validated = WorkflowValidationSchemas.workflow.parse(data)

      // Validate workflow logic and dependencies
      await this.validateWorkflowLogic(validated)

      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          
          code: err.code
        }))

        logger.warn('Workflow validation failed', {
          errors: validationErrors,
          input: data
        })

        throw new ValidationError('Workflow validation failed', { errors: validationErrors })
      }

      throw error
    }
  }

  /**
   * Validate A/B test data
   */
  async validateABTest(data: unknown): Promise<ValidatedABTestData> {
    try {
      const validated = WorkflowValidationSchemas.abTest.parse(data)

      // Validate test logic and statistical validity
      await this.validateABTestLogic(validated)

      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          
          code: err.code
        }))

        logger.warn('A/B test validation failed', {
          errors: validationErrors,
          input: data
        })

        throw new ValidationError('A/B test validation failed', { errors: validationErrors })
      }

      throw error
    }
  }

  /**
   * Business rules validation
   */
  private async validateBusinessRules(data: any): Promise<void> {
    // Email domain validation
    if (data.email) {
      const domain = data.email.split('@')[1]?.toLowerCase()

      // Check for suspicious patterns
      if (domain && domain.length > 60) {
        throw new ValidationError('Email domain is suspiciously long')
      }

      // Check for consecutive special characters
      if (data.email.includes('++') || data.email.includes('..') || data.email.includes('@@')) {
        throw new ValidationError('Email contains invalid consecutive characters')
      }
    }

    // Name validation
    if (data.firstName && data.lastName) {
      const fullName = `${data.firstName} ${data.lastName}`.toLowerCase()

      // Check for obviously fake names
      const fakeNamePatterns = [
        /test/i,
        /demo/i,
        /sample/i,
        /example/i,
        /fake/i,
        /dummy/i,
        /lorem/i,
        /ipsum/i
      ]

      if (fakeNamePatterns.some(pattern => pattern.test(fullName))) {
        logger.warn('Potentially fake name detected', { name: fullName })
      }
    }

    // Company validation
    if (data.company) {
      const companyLower = data.company.toLowerCase()

      // Check for obviously fake company names
      const fakeCompanyPatterns = [
        /test/i,
        /demo/i,
        /sample/i,
        /example/i,
        /fake/i,
        /dummy/i,
        /lorem/i,
        /ipsum/i,
        /company/i,
        /corp/i,
        /inc/i,
        /llc/i,
        /ltd/i
      ]

      if (fakeCompanyPatterns.some(pattern => pattern.test(companyLower)) && data.company.length < 20) {
        logger.warn('Potentially fake company name detected', { company: data.company })
      }
    }
  }

  /**
   * MCP data quality validation
   */
  private async validateMCPDataQuality(data: any, source: string): Promise<void> {
    switch (source) {
      case 'github':
        if (data.followers !== undefined && data.followers < 0) {
          throw new ValidationError('GitHub followers cannot be negative')
        }
        if (data.publicRepos !== undefined && data.publicRepos < 0) {
          throw new ValidationError('GitHub public repos cannot be negative')
        }
        break

      case 'company':
        if (data.employees !== undefined && data.employees < 0) {
          throw new ValidationError('Company employees cannot be negative')
        }
        if (data.funding !== undefined && data.funding < 0) {
          throw new ValidationError('Company funding cannot be negative')
        }
        break

      case 'email':
        if (data.score !== undefined && (data.score < 0 || data.score > 100)) {
          throw new ValidationError('Email score must be between 0 and 100')
        }
        break
    }
  }

  /**
   * CRM provider-specific validation
   */
  private async validateCRMProviderData(data: any, provider: string): Promise<void> {
    switch (provider.toLowerCase()) {
      case 'salesforce':
        if (data.id && !data.id.startsWith('003')) {
          logger.warn('Salesforce ID format may be incorrect', { id: data.id })
        }
        break

      case 'hubspot':
        if (data.id && !/^\d+$/.test(data.id)) {
          logger.warn('HubSpot ID should be numeric', { id: data.id })
        }
        break

      case 'pipedrive':
        if (data.id && !/^\d+$/.test(data.id)) {
          logger.warn('Pipedrive ID should be numeric', { id: data.id })
        }
        break
    }
  }

  /**
   * Workflow logic validation
   */
  private async validateWorkflowLogic(workflow: any): Promise<void> {
    // Check for circular dependencies
    const stepIds = workflow.steps.map((step: any) => step.id)
    const uniqueIds = new Set(stepIds)

    if (stepIds.length !== uniqueIds.size) {
      throw new ValidationError('Workflow contains duplicate step IDs')
    }

    // Validate step dependencies
    for (const step of workflow.steps) {
      if (step.conditions) {
        for (const condition of step.conditions) {
          if (condition.dependsOn && !stepIds.includes(condition.dependsOn)) {
            throw new ValidationError(`Step ${step.id} depends on non-existent step ${condition.dependsOn}`)
          }
        }
      }
    }

    // Validate wait steps have reasonable delays
    for (const step of workflow.steps) {
      if (step.type === 'wait' && step.delay !== undefined) {
        if (step.delay < 1) {
          throw new ValidationError('Wait step delay must be at least 1 minute')
        }
        if (step.delay > 525600) { // 1 year in minutes
          throw new ValidationError('Wait step delay cannot exceed 1 year')
        }
      }
    }
  }

  /**
   * A/B test logic validation
   */
  private async validateABTestLogic(test: any): Promise<void> {
    // Validate variant weights sum to 100
    const totalWeight = test.variants.reduce((sum: number, variant: any) => sum + (variant.weight || 0), 0)

    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new ValidationError('A/B test variant weights must sum to 100')
    }

    // Validate winner criteria
    if (test.winnerCriteria.threshold <= 0 || test.winnerCriteria.threshold >= 1) {
      throw new ValidationError('Winner threshold must be between 0 and 1')
    }

    // Validate minimum duration
    if (test.winnerCriteria.minDuration < 1) {
      throw new ValidationError('Minimum test duration must be at least 1 day')
    }
  }

  /**
   * Sanitize and normalize lead data
   */
  private sanitizeLeadData(data: any): any {
    const sanitized = { ...data }

    // Normalize email
    if (sanitized.email) {
      sanitized.email = sanitized.email.toLowerCase().trim()
    }

    // Normalize names
    if (sanitized.firstName) {
      sanitized.firstName = sanitized.firstName.trim().replace(/\s+/g, ' ')
    }
    if (sanitized.lastName) {
      sanitized.lastName = sanitized.lastName.trim().replace(/\s+/g, ' ')
    }

    // Normalize company name
    if (sanitized.company) {
      sanitized.company = sanitized.company.trim().replace(/\s+/g, ' ')
    }

    // Normalize job title
    if (sanitized.jobTitle) {
      sanitized.jobTitle = sanitized.jobTitle.trim().replace(/\s+/g, ' ')
    }

    // Normalize phone
    if (sanitized.phone) {
      sanitized.phone = sanitized.phone.replace(/[\s\-\(\)]/g, '')
    }

    // Normalize tags
    if (sanitized.tags) {
      sanitized.tags = sanitized.tags.map((tag: string) =>
        tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
      ).filter((tag: string) => tag.length > 0)
    }

    return sanitized
  }
}

// Type definitions for validated data
export interface ValidatedLeadData {
  email: string
  firstName: string
  lastName: string
  company: string
  jobTitle?: string
  phone?: string
  sourceId?: string
  tags?: string[]
  customFields?: Record<string, unknown>
  githubUsername?: string
  linkedinUrl?: string
  website?: string
}

export interface ValidatedLeadUpdateData {
  id: string
  email?: string
  firstName?: string
  lastName?: string
  company?: string
  jobTitle?: string
  phone?: string
  tags?: string[]
  customFields?: Record<string, unknown>
  leadScore?: number
  status?: 'new' | 'contacted' | 'qualified' | 'opportunity' | 'customer' | 'lost'
  engagementScore?: number
  conversionProbability?: number
  estimatedValue?: number
}

export interface ValidatedMCPData {
  [key: string]: unknown
}

export interface ValidatedCRMData {
  id: string
  email: string
  firstName: string
  lastName: string
  company?: string
  phone?: string
  status?: string
  value?: number
  createdAt?: string
  updatedAt?: string
  customFields?: Record<string, unknown>
}

export interface ValidatedWorkflowData {
  name: string
  description?: string
  triggerType: string
  triggerConditions: Record<string, unknown>
  steps: Array<{
    id: string
    type: string
    name: string
    config: Record<string, unknown>
    conditions?: Array<Record<string, unknown>>
    delay?: number
  }>
  status: string
  settings?: {
    maxExecutionsPerDay: number
    retryFailedExecutions: boolean
    notifyOnFailure: boolean
    priority: string
  }
}

export interface ValidatedABTestData {
  name: string
  testType: string
  variants: Array<{
    id: string
    name: string
    content: string
    weight: number
  }>
  targetAudience: {
    segmentId?: string
    criteria?: Record<string, unknown>
    sampleSize?: number
  }
  winnerCriteria: {
    metric: string
    threshold: number
    minDuration: number
  }
  status: string
  startDate?: string
  endDate?: string
}

// Export singleton instance
export const leadValidator = LeadDataValidator.getInstance()
export default leadValidator