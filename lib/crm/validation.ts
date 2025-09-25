/**
 * CRM Integration Validation and Retry Mechanisms
 * Provides robust validation and error handling for CRM integrations
 */

import { z } from 'zod'
import { ValidationError, ExternalServiceError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/errors'

// CRM Provider Types
export enum CRMProvider {
  SALESFORCE = 'salesforce',
  HUBSPOT = 'hubspot',
  PIPEDRIVE = 'pipedrive',
  ZOHO = 'zoho',
  DYNAMICS = 'dynamics',
  CUSTOM = 'custom'
}

// CRM Sync Status
export enum CRMSyncStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

// CRM Error Types
export enum CRMErrorType {
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  DATA_CONFLICT_ERROR = 'data_conflict_error',
  RESOURCE_NOT_FOUND_ERROR = 'resource_not_found_error',
  PERMISSION_ERROR = 'permission_error',
  QUOTA_EXCEEDED_ERROR = 'quota_exceeded_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// CRM Provider Configuration
export interface CRMProviderConfig {
  name: CRMProvider
  baseUrl: string
  apiVersion: string
  timeout: number
  retryAttempts: number
  retryDelay: number
  rateLimit: {
    requestsPerSecond: number
    requestsPerHour: number
    burstLimit: number
  }
  authentication: {
    type: 'oauth2' | 'api_key' | 'basic' | 'bearer'
    tokenEndpoint?: string
    scopes?: string[]
  }
  fieldMapping: {
    leadFields: Record<string, string>
    contactFields: Record<string, string>
    companyFields: Record<string, string>
    customFields: Record<string, string>
  }
  validationRules: {
    requiredFields: string[]
    fieldConstraints: Array<{
      field: string
      type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'phone' | 'url'
      maxLength?: number
      minLength?: number
      pattern?: string
      enum?: string[]
    }>
  }
}

// CRM Sync Configuration
export interface CRMSyncConfig {
  provider: CRMProvider
  fullSync: boolean
  since?: Date
  batchSize: number
  fields: string[]
  filters?: Record<string, unknown>
  conflictResolution: 'overwrite' | 'skip' | 'merge' | 'error'
  retryFailedRecords: boolean
  validateBeforeSync: boolean
  createMissingRecords: boolean
}

// CRM Sync Result
export interface CRMSyncResult {
  success: boolean
  totalProcessed: number
  successful: number
  failed: number
  skipped: number
  errors: Array<{
    recordId: string
    recordType: string
    error: string
    errorType: CRMErrorType
    timestamp: Date
    retryable: boolean
  }>
  warnings: Array<{
    recordId: string
    recordType: string
    message: string
    timestamp: Date
  }>
  lastSyncAt: Date
  nextSyncAt?: Date
  duration: number
  metadata: Record<string, unknown>
}

// CRM Record Validation
export interface CRMRecordValidation {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
    severity: 'error' | 'warning'
    code?: string
  }>
  warnings: Array<{
    field: string
    message: string
    suggestion?: string
  }>
  sanitizedData: Record<string, unknown>
  confidenceScore: number
}

// CRM Provider Registry
class CRMProviderRegistry {
  private static instance: CRMProviderRegistry
  private providers = new Map<CRMProvider, CRMProviderConfig>()

  constructor() {
    this.initializeProviders()
  }

  static getInstance(): CRMProviderRegistry {
    if (!CRMProviderRegistry.instance) {
      CRMProviderRegistry.instance = new CRMProviderRegistry()
    }
    return CRMProviderRegistry.instance
  }

  private initializeProviders() {
    const defaultConfigs: Record<CRMProvider, CRMProviderConfig> = {
      [CRMProvider.SALESFORCE]: {
        name: CRMProvider.SALESFORCE,
        baseUrl: 'https://your-instance.salesforce.com',
        apiVersion: 'v59.0',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 2000,
        rateLimit: { requestsPerSecond: 10, requestsPerHour: 10000, burstLimit: 50 },
        authentication: { type: 'oauth2', scopes: ['api', 'refresh_token'] },
        fieldMapping: {
          leadFields: {
            email: 'Email',
            firstName: 'FirstName',
            lastName: 'LastName',
            company: 'Company',
            jobTitle: 'Title',
            phone: 'Phone'
          },
          contactFields: {
            email: 'Email',
            firstName: 'FirstName',
            lastName: 'LastName',
            company: 'Account.Name',
            jobTitle: 'Title',
            phone: 'Phone'
          },
          companyFields: {
            name: 'Name',
            industry: 'Industry',
            employees: 'NumberOfEmployees',
            website: 'Website'
          },
          customFields: {}
        },
        validationRules: {
          requiredFields: ['email', 'firstName', 'lastName'],
          fieldConstraints: [
            {
              field: 'email',
              type: 'email',
              maxLength: 254
            },
            {
              field: 'firstName',
              type: 'string',
              maxLength: 50
            },
            {
              field: 'lastName',
              type: 'string',
              maxLength: 50
            },
            {
              field: 'company',
              type: 'string',
              maxLength: 100
            }
          ]
        }
      },
      [CRMProvider.HUBSPOT]: {
        name: CRMProvider.HUBSPOT,
        baseUrl: 'https://api.hubapi.com',
        apiVersion: 'v1',
        timeout: 15000,
        retryAttempts: 5,
        retryDelay: 1000,
        rateLimit: { requestsPerSecond: 100, requestsPerHour: 120000, burstLimit: 100 },
        authentication: { type: 'bearer' },
        fieldMapping: {
          leadFields: {
            email: 'email',
            firstName: 'firstname',
            lastName: 'lastname',
            company: 'company',
            jobTitle: 'jobtitle',
            phone: 'phone'
          },
          contactFields: {
            email: 'email',
            firstName: 'firstname',
            lastName: 'lastname',
            company: 'company',
            jobTitle: 'jobtitle',
            phone: 'phone'
          },
          companyFields: {
            name: 'name',
            industry: 'industry',
            employees: 'numberofemployees',
            website: 'website'
          },
          customFields: {}
        },
        validationRules: {
          requiredFields: ['email'],
          fieldConstraints: [
            {
              field: 'email',
              type: 'email',
              maxLength: 254
            },
            {
              field: 'firstName',
              type: 'string',
              maxLength: 100
            },
            {
              field: 'lastName',
              type: 'string',
              maxLength: 100
            }
          ]
        }
      },
      [CRMProvider.PIPEDRIVE]: {
        name: CRMProvider.PIPEDRIVE,
        baseUrl: 'https://api.pipedrive.com',
        apiVersion: 'v1',
        timeout: 20000,
        retryAttempts: 3,
        retryDelay: 3000,
        rateLimit: { requestsPerSecond: 20, requestsPerHour: 20000, burstLimit: 100 },
        authentication: { type: 'api_key' },
        fieldMapping: {
          leadFields: {
            email: 'email',
            firstName: 'first_name',
            lastName: 'last_name',
            company: 'org_name',
            jobTitle: 'title',
            phone: 'phone'
          },
          contactFields: {
            email: 'email',
            firstName: 'first_name',
            lastName: 'last_name',
            company: 'org_name',
            jobTitle: 'title',
            phone: 'phone'
          },
          companyFields: {
            name: 'name',
            industry: 'industry',
            employees: 'number_of_employees',
            website: 'website'
          },
          customFields: {}
        },
        validationRules: {
          requiredFields: ['email', 'firstName', 'lastName'],
          fieldConstraints: [
            {
              field: 'email',
              type: 'email',
              maxLength: 254
            },
            {
              field: 'firstName',
              type: 'string',
              maxLength: 255
            },
            {
              field: 'lastName',
              type: 'string',
              maxLength: 255
            }
          ]
        }
      },
      [CRMProvider.ZOHO]: {
        name: CRMProvider.ZOHO,
        baseUrl: 'https://www.zohoapis.com',
        apiVersion: 'v2',
        timeout: 25000,
        retryAttempts: 2,
        retryDelay: 5000,
        rateLimit: { requestsPerSecond: 10, requestsPerHour: 10000, burstLimit: 50 },
        authentication: { type: 'oauth2', scopes: ['ZohoCRM.modules.ALL'] },
        fieldMapping: {
          leadFields: {
            email: 'Email',
            firstName: 'First_Name',
            lastName: 'Last_Name',
            company: 'Company',
            jobTitle: 'Title',
            phone: 'Phone'
          },
          contactFields: {
            email: 'Email',
            firstName: 'First_Name',
            lastName: 'Last_Name',
            company: 'Company',
            jobTitle: 'Title',
            phone: 'Phone'
          },
          companyFields: {
            name: 'Account_Name',
            industry: 'Industry',
            employees: 'Employees',
            website: 'Website'
          },
          customFields: {}
        },
        validationRules: {
          requiredFields: ['email', 'firstName', 'lastName'],
          fieldConstraints: [
            {
              field: 'email',
              type: 'email',
              maxLength: 254
            },
            {
              field: 'firstName',
              type: 'string',
              maxLength: 50
            },
            {
              field: 'lastName',
              type: 'string',
              maxLength: 50
            }
          ]
        }
      },
      [CRMProvider.DYNAMICS]: {
        name: CRMProvider.DYNAMICS,
        baseUrl: 'https://your-org.crm.dynamics.com',
        apiVersion: 'v9.2',
        timeout: 30000,
        retryAttempts: 2,
        retryDelay: 5000,
        rateLimit: { requestsPerSecond: 5, requestsPerHour: 5000, burstLimit: 20 },
        authentication: { type: 'oauth2', scopes: ['https://your-org.crm.dynamics.com/.default'] },
        fieldMapping: {
          leadFields: {
            email: 'emailaddress1',
            firstName: 'firstname',
            lastName: 'lastname',
            company: 'companyname',
            jobTitle: 'jobtitle',
            phone: 'telephone1'
          },
          contactFields: {
            email: 'emailaddress1',
            firstName: 'firstname',
            lastName: 'lastname',
            company: 'parentcustomerid',
            jobTitle: 'jobtitle',
            phone: 'telephone1'
          },
          companyFields: {
            name: 'name',
            industry: 'industrycode',
            employees: 'numberofemployees',
            website: 'websiteurl'
          },
          customFields: {}
        },
        validationRules: {
          requiredFields: ['email', 'firstName', 'lastName'],
          fieldConstraints: [
            {
              field: 'email',
              type: 'email',
              maxLength: 254
            },
            {
              field: 'firstName',
              type: 'string',
              maxLength: 50
            },
            {
              field: 'lastName',
              type: 'string',
              maxLength: 50
            }
          ]
        }
      },
      [CRMProvider.CUSTOM]: {
        name: CRMProvider.CUSTOM,
        baseUrl: '',
        apiVersion: 'v1',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 2000,
        rateLimit: { requestsPerSecond: 10, requestsPerHour: 10000, burstLimit: 50 },
        authentication: { type: 'bearer' },
        fieldMapping: {
          leadFields: {},
          contactFields: {},
          companyFields: {},
          customFields: {}
        },
        validationRules: {
          requiredFields: ['email'],
          fieldConstraints: []
        }
      }
    }

    for (const [provider, config] of Object.entries(defaultConfigs)) {
      this.providers.set(provider as CRMProvider, config)
    }
  }

  getProviderConfig(provider: CRMProvider): CRMProviderConfig | undefined {
    return this.providers.get(provider)
  }

  registerProvider(provider: CRMProvider, config: CRMProviderConfig): void {
    this.providers.set(provider, config)
  }

  getAllProviders(): CRMProvider[] {
    return Array.from(this.providers.keys())
  }
}

// CRM Data Validator
export class CRMDataValidator {
  private static instance: CRMDataValidator
  private providerRegistry: CRMProviderRegistry

  constructor() {
    this.providerRegistry = CRMProviderRegistry.getInstance()
  }

  static getInstance(): CRMDataValidator {
    if (!CRMDataValidator.instance) {
      CRMDataValidator.instance = new CRMDataValidator()
    }
    return CRMDataValidator.instance
  }

  /**
   * Validate CRM record data
   */
  async validateCRMRecord(
    provider: CRMProvider,
    recordType: 'lead' | 'contact' | 'company',
    data: unknown
  ): Promise<CRMRecordValidation> {
    const validation: CRMRecordValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizedData: {},
      confidenceScore: 1.0
    }

    try {
      const providerConfig = this.providerRegistry.getProviderConfig(provider)
      if (!providerConfig) {
        validation.isValid = false
        validation.errors.push({
          field: 'provider',
          message: `Unknown CRM provider: ${provider}`,
          severity: 'error'
        })
        return validation
      }

      // Get field mapping for record type
      const fieldMapping = this.getFieldMapping(providerConfig, recordType)
      if (!fieldMapping) {
        validation.isValid = false
        validation.errors.push({
          field: 'recordType',
          message: `Unsupported record type: ${recordType}`,
          severity: 'error'
        })
        return validation
      }

      // Validate required fields
      for (const requiredField of providerConfig.validationRules.requiredFields) {
        const mappedField = fieldMapping[requiredField]
        if (!mappedField) {
          validation.warnings.push({
            field: requiredField,
            message: `Field '${requiredField}' is not mapped for provider ${provider}`,
            suggestion: 'Consider adding field mapping in provider configuration'
          })
          continue
        }

        if (!data || typeof data !== 'object' || !(mappedField in data)) {
          validation.isValid = false
          validation.errors.push({
            field: requiredField,
            message: `Required field '${requiredField}' is missing`,
            severity: 'error'
          })
        }
      }

      // Validate field constraints
      for (const constraint of providerConfig.validationRules.fieldConstraints) {
        const mappedField = fieldMapping[constraint.field]
        if (!mappedField || !data || typeof data !== 'object') continue

        const value = (data as any)[mappedField]
        if (value === undefined || value === null) continue

        const fieldValidation = this.validateFieldValue(constraint, value)
        if (!fieldValidation.isValid) {
          validation.isValid = false
          validation.errors.push({
            field: constraint.field,
            message: fieldValidation.message,
            severity: 'error',
            code: fieldValidation.code
          })
        }
      }

      // Sanitize data
      validation.sanitizedData = this.sanitizeCRMData(data, providerConfig, fieldMapping)

      // Calculate confidence score
      validation.confidenceScore = this.calculateConfidenceScore(data, providerConfig, validation)

      // Log validation results
      await logger.info('CRM record validation completed', {
        provider,
        recordType,
        isValid: validation.isValid,
        confidenceScore: validation.confidenceScore,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      }, {
        tags: ['crm', 'validation', provider, recordType],
        source: 'system'
      })

    } catch (error) {
      validation.isValid = false
      validation.errors.push({
        field: 'validation',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      })

      await logger.error('CRM record validation error', error as Error, {
        provider,
        recordType,
        data
      }, {
        tags: ['crm', 'validation', 'error'],
        source: 'system'
      })
    }

    return validation
  }

  /**
   * Validate sync configuration
   */
  async validateSyncConfig(config: unknown): Promise<CRMSyncConfig> {
    try {
      const syncConfigSchema = z.object({
        provider: z.nativeEnum(CRMProvider),
        fullSync: z.boolean().default(false),
        since: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
        batchSize: z.number().min(1).max(1000).default(100),
        fields: z.array(z.string()).min(1, 'At least one field must be specified'),
        filters: z.record(z.unknown()).optional(),
        conflictResolution: z.enum(['overwrite', 'skip', 'merge', 'error']).default('skip'),
        retryFailedRecords: z.boolean().default(true),
        validateBeforeSync: z.boolean().default(true),
        createMissingRecords: z.boolean().default(false)
      })

      const validated = syncConfigSchema.parse(config)

      // Additional validation
      const providerConfig = this.providerRegistry.getProviderConfig(validated.provider)
      if (!providerConfig) {
        throw new ValidationError(`Unknown CRM provider: ${validated.provider}`)
      }

      // Validate field names against provider capabilities
      const availableFields = this.getAvailableFields(providerConfig)
      for (const field of validated.fields) {
        if (!availableFields.includes(field)) {
          logger.warn(`Field '${field}' may not be available for provider ${validated.provider}`)
        }
      }

      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))

        logger.warn('CRM sync config validation failed', {
          errors: validationErrors,
          input: config
        })

        throw new ValidationError('CRM sync configuration validation failed', { errors: validationErrors })
      }

      throw error
    }
  }

  /**
   * Validate sync result
   */
  async validateSyncResult(result: unknown): Promise<CRMSyncResult> {
    try {
      const syncResultSchema = z.object({
        success: z.boolean(),
        totalProcessed: z.number().min(0),
        successful: z.number().min(0),
        failed: z.number().min(0),
        skipped: z.number().min(0),
        errors: z.array(z.object({
          recordId: z.string(),
          recordType: z.string(),
          error: z.string(),
          errorType: z.nativeEnum(CRMErrorType),
          timestamp: z.string().datetime().transform(val => new Date(val)),
          retryable: z.boolean()
        })).default([]),
        warnings: z.array(z.object({
          recordId: z.string(),
          recordType: z.string(),
          message: z.string(),
          timestamp: z.string().datetime().transform(val => new Date(val))
        })).default([]),
        lastSyncAt: z.string().datetime().transform(val => new Date(val)),
        nextSyncAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
        duration: z.number().min(0),
        metadata: z.record(z.unknown()).default({})
      })

      const validated = syncResultSchema.parse(result)

      // Validate result consistency
      const expectedTotal = validated.successful + validated.failed + validated.skipped
      if (Math.abs(expectedTotal - validated.totalProcessed) > 0) {
        logger.warn('Sync result totals may be inconsistent', {
          expected: expectedTotal,
          actual: validated.totalProcessed
        })
      }

      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))

        logger.warn('CRM sync result validation failed', {
          errors: validationErrors,
          input: result
        })

        throw new ValidationError('CRM sync result validation failed', { errors: validationErrors })
      }

      throw error
    }
  }

  /**
   * Get field mapping for record type
   */
  private getFieldMapping(config: CRMProviderConfig, recordType: string): Record<string, string> | null {
    switch (recordType) {
      case 'lead':
        return config.fieldMapping.leadFields
      case 'contact':
        return config.fieldMapping.contactFields
      case 'company':
        return config.fieldMapping.companyFields
      default:
        return null
    }
  }

  /**
   * Get available fields for provider
   */
  private getAvailableFields(config: CRMProviderConfig): string[] {
    const fields = [
      ...Object.keys(config.fieldMapping.leadFields),
      ...Object.keys(config.fieldMapping.contactFields),
      ...Object.keys(config.fieldMapping.companyFields),
      ...Object.keys(config.fieldMapping.customFields)
    ]
    return [...new Set(fields)]
  }

  /**
   * Validate field value against constraint
   */
  private validateFieldValue(constraint: any, value: unknown): { isValid: boolean; message: string; code?: string } {
    try {
      switch (constraint.type) {
        case 'string':
          if (typeof value !== 'string') {
            return { isValid: false, message: `Field must be a string`, code: 'INVALID_TYPE' }
          }
          if (constraint.minLength && value.length < constraint.minLength) {
            return { isValid: false, message: `Field must be at least ${constraint.minLength} characters`, code: 'TOO_SHORT' }
          }
          if (constraint.maxLength && value.length > constraint.maxLength) {
            return { isValid: false, message: `Field must be at most ${constraint.maxLength} characters`, code: 'TOO_LONG' }
          }
          if (constraint.pattern && !new RegExp(constraint.pattern).test(value)) {
            return { isValid: false, message: `Field does not match required pattern`, code: 'INVALID_PATTERN' }
          }
          if (constraint.enum && !constraint.enum.includes(value)) {
            return { isValid: false, message: `Field must be one of: ${constraint.enum.join(', ')}`, code: 'INVALID_VALUE' }
          }
          break

        case 'number':
          if (typeof value !== 'number') {
            return { isValid: false, message: `Field must be a number`, code: 'INVALID_TYPE' }
          }
          break

        case 'boolean':
          if (typeof value !== 'boolean') {
            return { isValid: false, message: `Field must be a boolean`, code: 'INVALID_TYPE' }
          }
          break

        case 'date':
          if (!(value instanceof Date) && typeof value !== 'string') {
            return { isValid: false, message: `Field must be a valid date`, code: 'INVALID_TYPE' }
          }
          break

        case 'email':
          if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return { isValid: false, message: `Field must be a valid email address`, code: 'INVALID_EMAIL' }
          }
          break

        case 'phone':
          if (typeof value !== 'string' || !/^\+?[1-9]\d{1,14}$/.test(value.replace(/[\s\-\(\)]/g, ''))) {
            return { isValid: false, message: `Field must be a valid phone number`, code: 'INVALID_PHONE' }
          }
          break

        case 'url':
          try {
            new URL(value as string)
          } catch {
            return { isValid: false, message: `Field must be a valid URL`, code: 'INVALID_URL' }
          }
          break
      }

      return { isValid: true, message: 'Field is valid' }
    } catch (error) {
      return { isValid: false, message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`, code: 'VALIDATION_ERROR' }
    }
  }

  /**
   * Sanitize CRM data
   */
  private sanitizeCRMData(data: unknown, config: CRMProviderConfig, fieldMapping: Record<string, string>): Record<string, unknown> {
    if (!data || typeof data !== 'object') {
      return {}
    }

    const sanitized: Record<string, unknown> = {}
    const dataObj = data as Record<string, unknown>

    for (const [field, mappedField] of Object.entries(fieldMapping)) {
      if (mappedField in dataObj) {
        let value = dataObj[mappedField]

        // Basic sanitization
        if (typeof value === 'string') {
          value = value.trim().replace(/\s+/g, ' ')
        }

        sanitized[mappedField] = value
      }
    }

    return sanitized
  }

  /**
   * Calculate confidence score for validation
   */
  private calculateConfidenceScore(
    data: unknown,
    config: CRMProviderConfig,
    validation: CRMRecordValidation
  ): number {
    if (!data || typeof data !== 'object') {
      return 0
    }

    let score = 1.0
    const dataObj = data as Record<string, unknown>

    // Completeness score
    const requiredFieldsPresent = config.validationRules.requiredFields.filter(
      field => field in dataObj
    ).length
    const completenessScore = requiredFieldsPresent / config.validationRules.requiredFields.length
    score *= completenessScore

    // Error penalty
    if (validation.errors.length > 0) {
      score *= Math.max(0.1, 1 - (validation.errors.length * 0.2))
    }

    // Warning penalty
    if (validation.warnings.length > 0) {
      score *= Math.max(0.5, 1 - (validation.warnings.length * 0.1))
    }

    return Math.max(0, Math.min(1, score))
  }
}

// Export singleton instance
export const crmValidator = CRMDataValidator.getInstance()
export default crmValidator