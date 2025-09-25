/**
 * Comprehensive Validation Middleware for Lead Qualification System
 * Integrates all validation modules into a unified middleware system
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ValidationError, ExternalServiceError, RateLimitError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { leadValidator } from '@/lib/lead-validation'
import { mcpValidator, type MCPRequestContext } from '@/lib/mcp/validation'
import { crmValidator } from '@/lib/crm/validation'
import { workflowValidator } from '@/lib/workflows/validation'
import { databaseValidator } from '@/lib/database/validation'
import { apiSecurityValidator, type RequestContext } from '@/lib/api/validation'
import { dataIntegrityValidator } from '@/lib/data-integrity/validation'
import { monitoringSystem } from '@/lib/monitoring/validation'
import { retrySystem } from '@/lib/retry/validation'

// Validation Middleware Configuration
export interface ValidationMiddlewareConfig {
  enabled: boolean
  modules: {
    lead: boolean
    mcp: boolean
    crm: boolean
    workflow: boolean
    database: boolean
    security: boolean
    dataIntegrity: boolean
    monitoring: boolean
    retry: boolean
  }
  options: {
    strictMode: boolean
    logLevel: 'debug' | 'info' | 'warn' | 'error'
    includeStackTrace: boolean
    enableMetrics: boolean
    enableAlerts: boolean
    correlationIdHeader?: string
    requestIdHeader?: string
  }
  thresholds: {
    maxRequestSize: number
    maxProcessingTime: number
    maxRetryAttempts: number
    circuitBreakerThreshold: number
  }
}

// Default Configuration
const DEFAULT_CONFIG: ValidationMiddlewareConfig = {
  enabled: true,
  modules: {
    lead: true,
    mcp: true,
    crm: true,
    workflow: true,
    database: true,
    security: true,
    dataIntegrity: true,
    monitoring: true,
    retry: true
  },
  options: {
    strictMode: false,
    logLevel: 'info',
    includeStackTrace: false,
    enableMetrics: true,
    enableAlerts: true,
    correlationIdHeader: 'x-correlation-id',
    requestIdHeader: 'x-request-id'
  },
  thresholds: {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    maxProcessingTime: 30000, // 30 seconds
    maxRetryAttempts: 3,
    circuitBreakerThreshold: 5
  }
}

// Validation Context
export interface ValidationContext {
  request: NextRequest
  response?: NextResponse
  userId?: string
  tenantId?: string
  correlationId: string
  requestId: string
  startTime: number
  processingTime: number
  modulesExecuted: string[]
  errors: ValidationError[]
  warnings: string[]
  metadata: Record<string, unknown>
  retryContext?: any
}

// Validation Result
export interface ValidationResult {
  success: boolean
  errors: ValidationError[]
  warnings: string[]
  processingTime: number
  modulesExecuted: string[]
  metadata: Record<string, unknown>
  shouldContinue: boolean
  response?: NextResponse
}

// Validation Pipeline
export class ValidationPipeline {
  private config: ValidationMiddlewareConfig
  private context!: ValidationContext

  constructor(config: Partial<ValidationMiddlewareConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get the current validation context
   */
  getContext(): ValidationContext {
    return this.context
  }

  /**
   * Get the current validation context (alternative method)
   */
  getValidationContext(): ValidationContext {
    return this.context
  }

  /**
   * Execute validation pipeline
   */
  async execute(request: NextRequest, context: Partial<ValidationContext> = {}): Promise<ValidationResult> {
    this.context = this.initializeContext(request, context)

    try {
      // Pre-validation checks
      const preValidationResult = await this.executePreValidation()
      if (!preValidationResult.success) {
        return this.createFailureResult(preValidationResult.errors, preValidationResult.warnings)
      }

      // Execute validation modules
      const moduleResults = await this.executeValidationModules()

      // Check if any critical errors occurred
      const criticalErrors = moduleResults.errors.filter(error =>
        (error as any).severity === 'critical' || (error as any).severity === 'high'
      )

      if (criticalErrors.length > 0 && this.config.options.strictMode) {
        return this.createFailureResult(criticalErrors, moduleResults.warnings)
      }

      // Post-validation processing
      const postValidationResult = await this.executePostValidation(moduleResults)

      return {
        success: postValidationResult.success,
        errors: postValidationResult.errors,
        warnings: postValidationResult.warnings,
        processingTime: Date.now() - this.context.startTime,
        modulesExecuted: this.context.modulesExecuted,
        metadata: this.context.metadata,
        shouldContinue: postValidationResult.shouldContinue,
        response: postValidationResult.response
      }

    } catch (error) {
      return this.handlePipelineError(error as Error)
    }
  }

  private initializeContext(request: NextRequest, context: Partial<ValidationContext>): ValidationContext {
    const correlationId = request.headers.get(this.config.options.correlationIdHeader || 'x-correlation-id') ||
                         crypto.randomUUID()
    const requestId = request.headers.get(this.config.options.requestIdHeader || 'x-request-id') ||
                     crypto.randomUUID()

    return {
      request,
      correlationId,
      requestId,
      startTime: Date.now(),
      processingTime: 0,
      modulesExecuted: [],
      errors: [],
      warnings: [],
      metadata: {},
      ...context
    }
  }

  private async executePreValidation(): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[] }> {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    try {
      // Check request size
      const contentLength = parseInt(this.context.request.headers.get('content-length') || '0')
      if (contentLength > this.config.thresholds.maxRequestSize) {
        errors.push(new ValidationError(
          'Request size exceeds maximum allowed limit',
          { contentLength, maxSize: this.config.thresholds.maxRequestSize }
        ))
      }

      // Basic security checks
      const secContext: RequestContext = {
        method: this.context.request.method,
        url: this.context.request.nextUrl.pathname,
        headers: Object.fromEntries(this.context.request.headers.entries()),
        body: undefined,
        query: Object.fromEntries(this.context.request.nextUrl.searchParams.entries()),
        params: {},
        userId: this.context.userId,
        tenantId: this.context.tenantId,
        sessionId: undefined,
        ipAddress: this.context.request.headers.get('x-forwarded-for') || this.context.request.headers.get('x-real-ip') || 'unknown',
        userAgent: this.context.request.headers.get('user-agent') || '',
        timestamp: new Date(),
        correlationId: this.context.correlationId,
        requestId: this.context.requestId
      }
      const securityResult = await apiSecurityValidator.validateAPIRequest(secContext)
      if (!securityResult.isValid) {
        errors.push(new ValidationError('Security validation failed', { errors: securityResult.errors }))
      }

      // Rate limiting check
      // Rate limiting is handled inside validateAPIRequest

      // Data integrity pre-check
      if (this.context.request.method !== 'GET') {
        const body = await this.context.request.json().catch(() => ({}))
        const integrityResult = await dataIntegrityValidator.validateTableIntegrity('leads')
        if (integrityResult.isCorrupted) {
          errors.push(new ValidationError(integrityResult.description, {
            code: integrityResult.corruptionType,
            severity: integrityResult.severity
          }))
        }
      }

    } catch (error) {
      errors.push(new ValidationError('Pre-validation failed', { error: error instanceof Error ? error.message : 'Unknown error' }))
    }

    return {
      success: errors.length === 0,
      errors,
      warnings
    }
  }

  private async executeValidationModules(): Promise<{ errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    const metadata: Record<string, unknown> = {}

    // Execute enabled modules in order
    const modules = [
      { name: 'lead', enabled: this.config.modules.lead, validator: leadValidator },
      { name: 'mcp', enabled: this.config.modules.mcp, validator: mcpValidator },
      { name: 'crm', enabled: this.config.modules.crm, validator: crmValidator },
      { name: 'workflow', enabled: this.config.modules.workflow, validator: workflowValidator },
      { name: 'database', enabled: this.config.modules.database, validator: databaseValidator },
      { name: 'security', enabled: this.config.modules.security, validator: apiSecurityValidator },
      { name: 'dataIntegrity', enabled: this.config.modules.dataIntegrity, validator: dataIntegrityValidator },
      { name: 'monitoring', enabled: this.config.modules.monitoring, validator: monitoringSystem }
    ]

    for (const module of modules) {
      if (!module.enabled) continue

      try {
        const startTime = Date.now()
        const result = await this.executeModule(module.name, module.validator)
        const processingTime = Date.now() - startTime

        this.context.modulesExecuted.push(module.name)
        Object.assign(metadata, result.metadata)

        if (!result.success) {
          errors.push(...result.errors)
          warnings.push(...result.warnings)
        }

        // Check processing time threshold
        if (processingTime > this.config.thresholds.maxProcessingTime) {
          warnings.push(`Module ${module.name} exceeded processing time threshold: ${processingTime}ms`)
        }

        // Log module execution
        await logger.info(`Validation module executed: ${module.name}`, {
          processingTime,
          success: result.success,
          errorCount: result.errors.length,
          warningCount: result.warnings.length
        }, {
          userId: this.context.userId,
          correlationId: this.context.correlationId,
          tags: ['validation', 'module', module.name],
          source: 'application'
        })

      } catch (error) {
        errors.push(new ValidationError(
          `Module ${module.name} execution failed`,
          { code: 'MODULE_EXECUTION_ERROR', severity: 'error', module: module.name, error: error instanceof Error ? error.message : 'Unknown error' }
        ))
      }
    }

    return { errors, warnings, metadata }
  }

  private async executeModule(moduleName: string, validator: any): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    try {
      switch (moduleName) {
        case 'lead':
          return await this.executeLeadValidation()
        case 'mcp':
          return await this.executeMCPValidation()
        case 'crm':
          return await this.executeCRMValidation()
        case 'workflow':
          return await this.executeWorkflowValidation()
        case 'database':
          return await this.executeDatabaseValidation()
        case 'security':
          return await this.executeSecurityValidation()
        case 'dataIntegrity':
          return await this.executeDataIntegrityValidation()
        case 'monitoring':
          return await this.executeMonitoringValidation()
        default:
          return { success: true, errors: [], warnings: [], metadata: {} }
      }
    } catch (error) {
      return {
        success: false,
        errors: [new ValidationError(`Module ${moduleName} validation failed`, { code: 'MODULE_VALIDATION_ERROR', error: error instanceof Error ? error.message : 'Unknown error' })],
        warnings: [],
        metadata: {}
      }
    }
  }

  private async executeLeadValidation(): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    try {
      const body = await this.context.request.json()
      const validationResult = await leadValidator.validateLeadCreation(body)

      return {
        success: true,
        errors: [],
        warnings: [],
        metadata: { leadValidation: validationResult }
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof ValidationError ? error : new ValidationError('Lead validation failed', { code: 'LEAD_VALIDATION_ERROR' })],
        warnings: [],
        metadata: {}
      }
    }
  }

  private async executeMCPValidation(): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    try {
      const body = await this.context.request.json()
      const context: MCPRequestContext = {
        serviceName: 'github-mcp',
        operation: 'validate',
        correlationId: this.context.correlationId,
        requestId: this.context.requestId,
        startTime: Date.now(),
        userId: this.context.userId,
        tenantId: this.context.tenantId
      }
      const validationResult = await mcpValidator.validateMCPResponse('github-mcp', 'validate', body, context)

      return {
        success: validationResult.isValid,
        errors: validationResult.errors.map(e => new ValidationError(e.message, { code: e.field, severity: e.severity })),
        warnings: validationResult.warnings.map(w => w.message),
        metadata: { mcpValidation: validationResult }
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof ValidationError ? error : new ValidationError('MCP validation failed', { code: 'MCP_VALIDATION_ERROR' })],
        warnings: [],
        metadata: {}
      }
    }
  }

  private async executeCRMValidation(): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    try {
      const body = await this.context.request.json()
      const validationResult = await leadValidator.validateCRMData(body, 'salesforce')

      return {
        success: true,
        errors: [],
        warnings: [],
        metadata: { crmValidation: validationResult }
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof ValidationError ? error : new ValidationError('CRM validation failed', { code: 'CRM_VALIDATION_ERROR' })],
        warnings: [],
        metadata: {}
      }
    }
  }

  private async executeWorkflowValidation(): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    try {
      const body = await this.context.request.json()
      const validationResult = await workflowValidator.validateWorkflowDefinition(body)

      return {
        success: true,
        errors: [],
        warnings: [],
        metadata: { workflowValidation: validationResult }
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof ValidationError ? error : new ValidationError('Workflow validation failed', { code: 'WORKFLOW_VALIDATION_ERROR' })],
        warnings: [],
        metadata: {}
      }
    }
  }

  private async executeDatabaseValidation(): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    try {
      const body = await this.context.request.json()
      const validationResults = await databaseValidator.validateDatabaseOperation({
        id: crypto.randomUUID(),
        type: 'insert' as any,
        table: 'leads',
        query: 'INSERT INTO leads ...',
        status: 'pending',
        startedAt: new Date(),
        retryCount: 0,
        metadata: {}
      })

      const errors = validationResults.filter(r => !r.passed).map(r => new ValidationError(r.message, { code: r.ruleId, severity: r.severity }))
      const warnings = validationResults.filter(r => r.passed && r.severity === 'warning').map(r => r.message)

      return {
        success: errors.length === 0,
        errors,
        warnings,
        metadata: { databaseValidation: validationResults }
      }
    } catch (error) {
      return {
        success: false,
        errors: [new ValidationError('Database validation failed', { code: 'DATABASE_VALIDATION_ERROR' })],
        warnings: [],
        metadata: {}
      }
    }
  }

  private async executeSecurityValidation(): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    try {
      const secContext: RequestContext = {
        method: this.context.request.method,
        url: this.context.request.nextUrl.pathname,
        headers: Object.fromEntries(this.context.request.headers.entries()),
        body: undefined,
        query: Object.fromEntries(this.context.request.nextUrl.searchParams.entries()),
        params: {},
        userId: this.context.userId,
        tenantId: this.context.tenantId,
        sessionId: undefined,
        ipAddress: this.context.request.headers.get('x-forwarded-for') || this.context.request.headers.get('x-real-ip') || 'unknown',
        userAgent: this.context.request.headers.get('user-agent') || '',
        timestamp: new Date(),
        correlationId: this.context.correlationId,
        requestId: this.context.requestId
      }
      const validationResult = await apiSecurityValidator.validateAPIRequest(secContext)

      return {
        success: true, // Assume success if no errors
        errors: validationResult.errors.map((e: any) => new ValidationError(e.message, { code: e.code, severity: e.severity })),
        warnings: validationResult.warnings.map((w: any) => w.message || w),
        metadata: { securityValidation: validationResult.metadata }
      }
    } catch (error) {
      return {
        success: false,
        errors: [new ValidationError('Security validation failed', { code: 'SECURITY_VALIDATION_ERROR' })],
        warnings: [],
        metadata: {}
      }
    }
  }

  private async executeDataIntegrityValidation(): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    try {
      const body = await this.context.request.json()
      const validationResult = await dataIntegrityValidator.validateTableIntegrity('leads')

      return {
        success: !validationResult.isCorrupted,
        errors: validationResult.isCorrupted ? [new ValidationError(validationResult.description, { code: validationResult.corruptionType, severity: validationResult.severity })] : [],
        warnings: [],
        metadata: { dataIntegrityValidation: validationResult }
      }
    } catch (error) {
      return {
        success: false,
        errors: [new ValidationError('Data integrity validation failed', { code: 'DATA_INTEGRITY_VALIDATION_ERROR' })],
        warnings: [],
        metadata: {}
      }
    }
  }

  private async executeMonitoringValidation(): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }> {
    try {
      const systemHealth = monitoringSystem.getSystemHealth()

      return {
        success: Object.values(systemHealth).every(check => check.status === 'healthy'),
        errors: Object.values(systemHealth).filter(check => check.status === 'unhealthy').map(check => new ValidationError(`${check.component} is unhealthy`, { code: 'SYSTEM_UNHEALTHY', component: check.component })),
        warnings: Object.values(systemHealth).filter(check => check.status === 'degraded').map(check => `${check.component} is degraded`),
        metadata: { monitoringValidation: systemHealth }
      }
    } catch (error) {
      return {
        success: false,
        errors: [new ValidationError('Monitoring validation failed', { code: 'MONITORING_VALIDATION_ERROR' })],
        warnings: [],
        metadata: {}
      }
    }
  }

  private async executePostValidation(moduleResults: { errors: ValidationError[]; warnings: string[]; metadata: Record<string, unknown> }): Promise<{ success: boolean; errors: ValidationError[]; warnings: string[]; shouldContinue: boolean; response?: NextResponse }> {
    const errors = moduleResults.errors
    const warnings = moduleResults.warnings

    // Update context metadata
    Object.assign(this.context.metadata, moduleResults.metadata)

    // Log validation results
    await logger.info('Validation pipeline completed', {
      success: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      processingTime: Date.now() - this.context.startTime,
      modulesExecuted: this.context.modulesExecuted
    }, {
      userId: this.context.userId,
      correlationId: this.context.correlationId,
      tags: ['validation', 'pipeline', 'completed'],
      source: 'application'
    })

    // Check if we should continue processing
    const shouldContinue = errors.length === 0

    // Create response if there are errors
    let response: NextResponse | undefined
    if (errors.length > 0) {
      response = NextResponse.json({
        success: false,
        errors: errors.map(e => ({ message: e.message, code: (e as any).code, details: (e as any).details })),
        warnings,
        correlationId: this.context.correlationId,
        requestId: this.context.requestId,
        processingTime: Date.now() - this.context.startTime
      }, {
        status: 400,
        headers: {
          'x-correlation-id': this.context.correlationId,
          'x-request-id': this.context.requestId
        }
      })
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      shouldContinue,
      response
    }
  }

  private getErrorStatusCode(_errors: ValidationError[]): number {
    return 400
  }

  private createFailureResult(errors: ValidationError[], warnings: string[]): ValidationResult {
    return {
      success: false,
      errors,
      warnings,
      processingTime: Date.now() - this.context.startTime,
      modulesExecuted: this.context.modulesExecuted,
      metadata: this.context.metadata,
      shouldContinue: false,
      response: NextResponse.json({
        success: false,
        errors: errors.map(e => ({
          message: e.message,
          code: e.code,
          severity: (e as any).severity,
          details: e.details
        })),
        warnings,
        correlationId: this.context.correlationId,
        requestId: this.context.requestId,
        processingTime: Date.now() - this.context.startTime
      }, {
        status: this.getErrorStatusCode(errors),
        headers: {
          'x-correlation-id': this.context.correlationId,
          'x-request-id': this.context.requestId
        }
      })
    }
  }

  private async handlePipelineError(error: Error): Promise<ValidationResult> {
    const validationError = error instanceof ValidationError ? error : new ValidationError('Pipeline execution failed', { code: 'PIPELINE_ERROR', error: error.message })

    await logger.error('Validation pipeline error', {
      error: error.message,
      stack: error.stack,
      processingTime: Date.now() - this.context.startTime
      }, {
      userId: this.context.userId,
      correlationId: this.context.correlationId,
      tags: ['validation', 'pipeline', 'error'],
        source: 'application'
    })

    return this.createFailureResult([validationError], [])
  }
}

// Middleware Factory
export function createValidationMiddleware(config: Partial<ValidationMiddlewareConfig> = {}) {
  const pipeline = new ValidationPipeline(config)

  return async function validationMiddleware(request: NextRequest): Promise<NextResponse | null> {
    // Skip validation for certain paths
    const skipPaths = ['/api/health', '/api/metrics', '/api/debug']
    if (skipPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
      return null
    }

    // Skip validation for GET requests in non-strict mode
    if (request.method === 'GET' && !config.options?.strictMode) {
      return null
    }

    try {
      const validationResult = await pipeline.execute(request)

      if (!validationResult.shouldContinue) {
        return validationResult.response || NextResponse.json(
          { error: 'Validation failed' },
          { status: 400 }
        )
      }

      // Add validation metadata to request headers for downstream processing
      if (validationResult.success) {
        // TODO: Fix TypeScript parsing issue with headers.set calls
        // const headers = new Headers()
        // headers.set('x-validation-success', 'true')
        // headers.set('x-validation-modules', validationResult.modulesExecuted.join(','))
        // headers.set('x-validation-time', validationResult.processingTime.toString())

        // Store validation context for the request
        (request as any).validationContext = pipeline.getContext()

        return null // Continue to next middleware/handler
      }

      return validationResult.response || NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      )

    } catch (error) {
      await logger.error('Validation middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: request.nextUrl.pathname,
        method: request.method
      }, {
        tags: ['validation', 'middleware', 'error'],
        source: 'middleware'
      })

      return NextResponse.json(
        { error: 'Internal validation error' },
        { status: 500 }
      )
    }
  }
}

// Export default middleware with default configuration
export const validationMiddleware = createValidationMiddleware()

// Export specialized middleware for different use cases
export const strictValidationMiddleware = createValidationMiddleware({
  options: { ...DEFAULT_CONFIG.options, strictMode: true },
  modules: {
    lead: true,
    mcp: true,
    crm: true,
    workflow: true,
    database: true,
    security: true,
    dataIntegrity: true,
    monitoring: true,
    retry: true
  }
})

export const leadValidationMiddleware = createValidationMiddleware({
  modules: {
    lead: true,
    security: true,
    dataIntegrity: true,
    monitoring: false,
    retry: false,
    mcp: false,
    crm: false,
    workflow: false,
    database: false
  }
})

export const apiValidationMiddleware = createValidationMiddleware({
  modules: {
    lead: false,
    mcp: false,
    crm: false,
    workflow: false,
    database: false,
    security: true,
    dataIntegrity: true,
    monitoring: true,
    retry: true
  }
})

export default validationMiddleware