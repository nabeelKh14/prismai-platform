/**
 * Workflow Process Validation and Error Recovery
 * Provides robust validation and error handling for workflow processes
 */

import { z } from 'zod'
import { ValidationError, ExternalServiceError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/errors'

// Workflow Status Types
export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ARCHIVED = 'archived'
}

export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRY = 'retry',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled'
}

export enum WorkflowStepType {
  EMAIL = 'email',
  WAIT = 'wait',
  CONDITION = 'condition',
  WEBHOOK = 'webhook',
  UPDATE_LEAD = 'update_lead',
  CREATE_TASK = 'create_task',
  SEND_SMS = 'send_sms',
  SEND_WHATSAPP = 'send_whatsapp',
  API_CALL = 'api_call',
  CUSTOM_ACTION = 'custom_action'
}

export enum WorkflowTriggerType {
  LEAD_CREATED = 'lead_created',
  SCORE_CHANGED = 'score_changed',
  BEHAVIOR = 'behavior',
  TIME_BASED = 'time_based',
  MANUAL = 'manual',
  SEGMENT_CHANGED = 'segment_changed',
  CAMPAIGN_TRIGGER = 'campaign_trigger'
}

// Workflow Error Types
export enum WorkflowErrorType {
  VALIDATION_ERROR = 'validation_error',
  EXECUTION_ERROR = 'execution_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
  DATA_CORRUPTION_ERROR = 'data_corruption_error',
  CONFIGURATION_ERROR = 'configuration_error',
  PERMISSION_ERROR = 'permission_error',
  RESOURCE_EXHAUSTED_ERROR = 'resource_exhausted_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// Workflow Definition
export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  triggerType: WorkflowTriggerType
  triggerConditions: Record<string, unknown>
  steps: WorkflowStep[]
  status: WorkflowStatus
  settings: WorkflowSettings
  metadata: WorkflowMetadata
  version: number
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
}

// Workflow Step
export interface WorkflowStep {
  id: string
  type: WorkflowStepType
  name: string
  description?: string
  config: Record<string, unknown>
  conditions?: WorkflowCondition[]
  delay?: number // Delay in minutes before executing this step
  retryPolicy?: RetryPolicy
  errorHandling?: ErrorHandlingPolicy
  order: number
  isActive: boolean
}

// Workflow Condition
export interface WorkflowCondition {
  id: string
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty'
  value?: unknown
  nextStepId?: string // If condition fails, go to this step
}

// Workflow Settings
export interface WorkflowSettings {
  maxExecutionsPerDay: number
  maxRetriesPerStep: number
  retryFailedExecutions: boolean
  notifyOnFailure: boolean
  priority: 'low' | 'medium' | 'high'
  timeoutMinutes: number
  concurrencyLimit: number
  errorThreshold: number // Percentage of failures that should pause the workflow
}

// Workflow Metadata
export interface WorkflowMetadata {
  tags: string[]
  category: string
  estimatedDuration: number // Estimated duration in minutes
  complexity: 'simple' | 'medium' | 'complex'
  dependencies: string[] // IDs of workflows this depends on
  dependents: string[] // IDs of workflows that depend on this
  lastExecutionAt?: Date
  lastSuccessfulExecutionAt?: Date
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
}

// Retry Policy
export interface RetryPolicy {
  maxRetries: number
  backoffStrategy: 'fixed' | 'linear' | 'exponential' | 'fibonacci'
  baseDelay: number // Base delay in seconds
  maxDelay: number // Maximum delay in seconds
  retryableErrors: WorkflowErrorType[]
  retryCondition?: string // Custom condition for retrying
}

// Error Handling Policy
export interface ErrorHandlingPolicy {
  onError: 'stop' | 'continue' | 'retry' | 'skip' | 'custom'
  fallbackStepId?: string
  notificationChannels: string[]
  escalationPolicy?: {
    thresholds: Array<{
      errorCount: number
      timeWindow: number // minutes
      action: 'notify' | 'pause' | 'stop'
      recipients: string[]
    }>
  }
}

// Workflow Execution
export interface WorkflowExecution {
  id: string
  workflowId: string
  leadId: string
  status: WorkflowExecutionStatus
  currentStepId?: string
  currentStepIndex: number
  context: ExecutionContext
  results: ExecutionResult[]
  error?: WorkflowExecutionError
  startedAt: Date
  completedAt?: Date
  nextExecutionAt?: Date
  retryCount: number
  metadata: Record<string, unknown>
}

// Execution Context
export interface ExecutionContext {
  lead: Record<string, unknown>
  triggerData: Record<string, unknown>
  variables: Record<string, unknown>
  history: ExecutionHistory[]
  correlationId: string
  userId?: string
  tenantId?: string
}

// Execution Result
export interface ExecutionResult {
  stepId: string
  stepType: WorkflowStepType
  status: 'success' | 'failed' | 'skipped' | 'retry'
  startedAt: Date
  completedAt: Date
  duration: number
  output?: Record<string, unknown>
  error?: WorkflowStepError
  retryAttempt: number
}

// Execution History
export interface ExecutionHistory {
  timestamp: Date
  event: string
  details: Record<string, unknown>
  stepId?: string
  userId?: string
}

// Workflow Execution Error
export interface WorkflowExecutionError {
  type: WorkflowErrorType
  message: string
  stepId?: string
  timestamp: Date
  context: Record<string, unknown>
  stackTrace?: string
  retryable: boolean
  recoveryActions: string[]
}

// Workflow Step Error
export interface WorkflowStepError {
  type: WorkflowErrorType
  message: string
  stepId: string
  timestamp: Date
  context: Record<string, unknown>
  retryable: boolean
  suggestedActions: string[]
}

// Workflow Validation Result
export interface WorkflowValidationResult {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
    severity: 'error' | 'warning'
    code?: string
    suggestion?: string
  }>
  warnings: Array<{
    field: string
    message: string
    suggestion?: string
  }>
  recommendations: string[]
  estimatedComplexity: 'simple' | 'medium' | 'complex'
  estimatedDuration: number
  potentialIssues: string[]
}

// Workflow Recovery Plan
export interface WorkflowRecoveryPlan {
  executionId: string
  failedStepId: string
  recoveryStrategy: 'retry' | 'skip' | 'rollback' | 'manual_intervention' | 'compensating_action'
  compensatingActions: Array<{
    type: string
    description: string
    parameters: Record<string, unknown>
    order: number
  }>
  estimatedRecoveryTime: number
  riskLevel: 'low' | 'medium' | 'high'
  requiresApproval: boolean
  approvalRequiredFrom?: string[]
}

// Workflow Circuit Breaker
class WorkflowCircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private threshold: number,
    private resetTimeout: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new ExternalServiceError('Workflow circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      threshold: this.threshold,
      resetTimeout: this.resetTimeout
    }
  }
}

// Workflow Validator
export class WorkflowValidator {
  private static instance: WorkflowValidator
  private circuitBreakers = new Map<string, WorkflowCircuitBreaker>()

  constructor() {
    this.initializeCircuitBreakers()
  }

  static getInstance(): WorkflowValidator {
    if (!WorkflowValidator.instance) {
      WorkflowValidator.instance = new WorkflowValidator()
    }
    return WorkflowValidator.instance
  }

  private initializeCircuitBreakers() {
    // Initialize circuit breakers for different workflow types
    const workflowTypes = ['lead_nurturing', 'email_campaign', 'data_sync', 'integration', 'custom']

    for (const type of workflowTypes) {
      this.circuitBreakers.set(type, new WorkflowCircuitBreaker(5, 300000)) // 5 failures, 5 minutes reset
    }
  }

  /**
   * Validate workflow definition
   */
  async validateWorkflowDefinition(definition: unknown): Promise<WorkflowValidationResult> {
    const validation: WorkflowValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: [],
      estimatedComplexity: 'simple',
      estimatedDuration: 0,
      potentialIssues: []
    }

    try {
      // Parse and validate against schema
      const workflowSchema = z.object({
        id: z.string().uuid('Invalid workflow ID'),
        name: z.string()
          .min(1, 'Workflow name is required')
          .max(100, 'Workflow name too long')
          .regex(/^[a-zA-Z0-9\s_-]+$/, 'Workflow name contains invalid characters'),

        description: z.string()
          .max(500, 'Description too long')
          .optional(),

        triggerType: z.nativeEnum(WorkflowTriggerType),

        triggerConditions: z.record(z.unknown()).default({}),

        steps: z.array(z.object({
          id: z.string().uuid('Invalid step ID'),
          type: z.nativeEnum(WorkflowStepType),
          name: z.string().min(1, 'Step name is required'),
          description: z.string().optional(),
          config: z.record(z.unknown()),
          conditions: z.array(z.object({
            id: z.string().uuid('Invalid condition ID'),
            field: z.string().min(1, 'Condition field is required'),
            operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in', 'is_empty', 'is_not_empty']),
            value: z.unknown(),
            nextStepId: z.string().uuid().optional()
          })).optional(),
          delay: z.number().min(0).optional(),
          retryPolicy: z.object({
            maxRetries: z.number().min(0).max(10),
            backoffStrategy: z.enum(['fixed', 'linear', 'exponential', 'fibonacci']),
            baseDelay: z.number().min(1),
            maxDelay: z.number().min(1),
            retryableErrors: z.array(z.nativeEnum(WorkflowErrorType)),
            retryCondition: z.string().optional()
          }).optional(),
          errorHandling: z.object({
            onError: z.enum(['stop', 'continue', 'retry', 'skip', 'custom']),
            fallbackStepId: z.string().uuid().optional(),
            notificationChannels: z.array(z.string()),
            escalationPolicy: z.object({
              thresholds: z.array(z.object({
                errorCount: z.number().min(1),
                timeWindow: z.number().min(1),
                action: z.enum(['notify', 'pause', 'stop']),
                recipients: z.array(z.string())
              }))
            }).optional()
          }).optional(),
          order: z.number().min(0),
          isActive: z.boolean().default(true)
        })).min(1, 'Workflow must have at least one step'),

        status: z.nativeEnum(WorkflowStatus).default(WorkflowStatus.DRAFT),

        settings: z.object({
          maxExecutionsPerDay: z.number().min(1).default(1000),
          maxRetriesPerStep: z.number().min(0).max(10).default(3),
          retryFailedExecutions: z.boolean().default(true),
          notifyOnFailure: z.boolean().default(true),
          priority: z.enum(['low', 'medium', 'high']).default('medium'),
          timeoutMinutes: z.number().min(1).max(1440).default(60), // Max 24 hours
          concurrencyLimit: z.number().min(1).default(10),
          errorThreshold: z.number().min(0).max(100).default(10) // Percentage
        }),

        metadata: z.object({
          tags: z.array(z.string()).default([]),
          category: z.string().default('general'),
          estimatedDuration: z.number().min(0).default(0),
          complexity: z.enum(['simple', 'medium', 'complex']).default('simple'),
          dependencies: z.array(z.string()).default([]),
          dependents: z.array(z.string()).default([]),
          totalExecutions: z.number().min(0).default(0),
          successfulExecutions: z.number().min(0).default(0),
          failedExecutions: z.number().min(0).default(0)
        }),

        version: z.number().min(1).default(1),
        createdAt: z.date(),
        updatedAt: z.date(),
        createdBy: z.string().min(1, 'Created by is required'),
        updatedBy: z.string().min(1, 'Updated by is required')
      })

      const validated = workflowSchema.parse(definition)

      // Additional business logic validation
      await this.validateWorkflowLogic(validated, validation)

      // Calculate estimated complexity and duration
      validation.estimatedComplexity = this.calculateComplexity(validated)
      validation.estimatedDuration = this.calculateEstimatedDuration(validated)

      // Generate recommendations
      validation.recommendations = this.generateRecommendations(validated)

      // Identify potential issues
      validation.potentialIssues = this.identifyPotentialIssues(validated)

      // Log validation results
      await logger.info('Workflow definition validation completed', {
        workflowId: validated.id,
        workflowName: validated.name,
        isValid: validation.isValid,
        estimatedComplexity: validation.estimatedComplexity,
        estimatedDuration: validation.estimatedDuration,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      }, {
        tags: ['workflow', 'validation', validated.triggerType],
        source: 'system'
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        validation.isValid = false
        validation.errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          severity: 'error',
          code: err.code
        }))
      } else {
        validation.isValid = false
        validation.errors.push({
          field: 'validation',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        })
      }

      await logger.error('Workflow definition validation error', error as Error, {
        workflowDefinition: definition
      }, {
        tags: ['workflow', 'validation', 'error'],
        source: 'system'
      })
    }

    return validation
  }

  /**
   * Validate workflow execution
   */
  async validateWorkflowExecution(execution: unknown): Promise<WorkflowExecution> {
    try {
      const executionSchema = z.object({
        id: z.string().uuid('Invalid execution ID'),
        workflowId: z.string().uuid('Invalid workflow ID'),
        leadId: z.string().uuid('Invalid lead ID'),
        status: z.nativeEnum(WorkflowExecutionStatus).default(WorkflowExecutionStatus.PENDING),
        currentStepIndex: z.number().min(0).default(0),
        startedAt: z.date(),
        context: z.object({
          lead: z.record(z.unknown()),
          triggerData: z.record(z.unknown()),
          variables: z.record(z.unknown()).default({}),
          history: z.array(z.object({
            timestamp: z.date(),
            event: z.string(),
            details: z.record(z.unknown()),
            stepId: z.string().optional(),
            userId: z.string().optional()
          })).default([]),
          correlationId: z.string().uuid('Invalid correlation ID'),
          userId: z.string().optional(),
          tenantId: z.string().optional()
        }),
        results: z.array(z.object({
          stepId: z.string().uuid(),
          stepType: z.nativeEnum(WorkflowStepType),
          status: z.enum(['success', 'failed', 'skipped', 'retry']),
          startedAt: z.date(),
          completedAt: z.date(),
          duration: z.number().min(0),
          output: z.record(z.unknown()).optional(),
          error: z.object({
            type: z.nativeEnum(WorkflowErrorType),
            message: z.string(),
            stepId: z.string().uuid(),
            timestamp: z.date(),
            context: z.record(z.unknown()),
            retryable: z.boolean(),
            suggestedActions: z.array(z.string())
          }).optional(),
          retryAttempt: z.number().min(0).default(0)
        })).default([]),
        retryCount: z.number().min(0).default(0),
        metadata: z.record(z.unknown()).default({})
      })

      const validated = executionSchema.parse(execution)

      // Additional validation
      await this.validateExecutionContext(validated)

      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))

        logger.warn('Workflow execution validation failed', {
          errors: validationErrors,
          input: execution
        })

        throw new ValidationError('Workflow execution validation failed', { errors: validationErrors })
      }

      throw error
    }
  }

  /**
   * Validate workflow logic and dependencies
   */
  private async validateWorkflowLogic(workflow: WorkflowDefinition, validation: WorkflowValidationResult): Promise<void> {
    // Check for circular dependencies in steps
    const stepIds = workflow.steps.map(step => step.id)
    const uniqueIds = new Set(stepIds)

    if (stepIds.length !== uniqueIds.size) {
      validation.isValid = false
      validation.errors.push({
        field: 'steps',
        message: 'Workflow contains duplicate step IDs',
        severity: 'error'
      })
    }

    // Validate step dependencies
    for (const step of workflow.steps) {
      if (step.conditions) {
        for (const condition of step.conditions) {
          if (condition.nextStepId && !stepIds.includes(condition.nextStepId)) {
            validation.isValid = false
            validation.errors.push({
              field: `steps[${workflow.steps.indexOf(step)}].conditions`,
              message: `Step ${step.id} references non-existent step ${condition.nextStepId}`,
              severity: 'error'
            })
          }
        }
      }

      if (step.errorHandling?.fallbackStepId && !stepIds.includes(step.errorHandling.fallbackStepId)) {
        validation.warnings.push({
          field: `steps[${workflow.steps.indexOf(step)}].errorHandling.fallbackStepId`,
          message: `Step ${step.id} references non-existent fallback step ${step.errorHandling.fallbackStepId}`,
          suggestion: 'Remove or correct the fallback step reference'
        })
      }
    }

    // Validate wait steps have reasonable delays
    for (const step of workflow.steps) {
      if (step.type === WorkflowStepType.WAIT && step.delay !== undefined) {
        if (step.delay < 1) {
          validation.isValid = false
          validation.errors.push({
            field: `steps[${workflow.steps.indexOf(step)}].delay`,
            message: 'Wait step delay must be at least 1 minute',
            severity: 'error'
          })
        }
        if (step.delay > 525600) { // 1 year in minutes
          validation.warnings.push({
            field: `steps[${workflow.steps.indexOf(step)}].delay`,
            message: 'Wait step delay is very long (over 1 year)',
            suggestion: 'Consider if this delay is appropriate for your use case'
          })
        }
      }
    }

    // Validate retry policies
    for (const step of workflow.steps) {
      if (step.retryPolicy) {
        if (step.retryPolicy.maxRetries < 0 || step.retryPolicy.maxRetries > 10) {
          validation.warnings.push({
            field: `steps[${workflow.steps.indexOf(step)}].retryPolicy.maxRetries`,
            message: 'Retry count should be between 0 and 10',
            suggestion: 'Consider reducing the retry count to avoid excessive resource usage'
          })
        }

        if (step.retryPolicy.baseDelay < 1) {
          validation.isValid = false
          validation.errors.push({
            field: `steps[${workflow.steps.indexOf(step)}].retryPolicy.baseDelay`,
            message: 'Base delay must be at least 1 second',
            severity: 'error'
          })
        }
      }
    }
  }

  /**
   * Validate execution context
   */
  private async validateExecutionContext(execution: WorkflowExecution): Promise<void> {
    // Validate lead data exists
    if (!execution.context.lead || Object.keys(execution.context.lead).length === 0) {
      throw new ValidationError('Execution context must contain lead data')
    }

    // Validate correlation ID format
    if (!execution.context.correlationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(execution.context.correlationId)) {
      throw new ValidationError('Invalid correlation ID format')
    }

    // Validate step results consistency
    if (execution.results.length > 0) {
      const stepIds = execution.results.map(result => result.stepId)
      const uniqueStepIds = new Set(stepIds)

      if (stepIds.length !== uniqueStepIds.size) {
        logger.warn('Duplicate step results found in execution', {
          executionId: execution.id,
          duplicateSteps: stepIds.filter((id, index) => stepIds.indexOf(id) !== index)
        })
      }
    }
  }

  /**
   * Calculate workflow complexity
   */
  private calculateComplexity(workflow: WorkflowDefinition): 'simple' | 'medium' | 'complex' {
    const stepCount = workflow.steps.length
    const conditionCount = workflow.steps.reduce((count, step) => count + (step.conditions?.length || 0), 0)
    const externalSteps = workflow.steps.filter(step =>
      [WorkflowStepType.WEBHOOK, WorkflowStepType.API_CALL, WorkflowStepType.CUSTOM_ACTION].includes(step.type)
    ).length

    if (stepCount <= 3 && conditionCount === 0 && externalSteps === 0) {
      return 'simple'
    } else if (stepCount <= 10 && conditionCount <= 5 && externalSteps <= 2) {
      return 'medium'
    } else {
      return 'complex'
    }
  }

  /**
   * Calculate estimated duration
   */
  private calculateEstimatedDuration(workflow: WorkflowDefinition): number {
    let duration = 0

    for (const step of workflow.steps) {
      // Base duration for each step type
      const baseDurations: Record<WorkflowStepType, number> = {
        [WorkflowStepType.EMAIL]: 2, // 2 minutes for email processing
        [WorkflowStepType.WAIT]: step.delay || 0,
        [WorkflowStepType.CONDITION]: 1, // 1 minute for condition evaluation
        [WorkflowStepType.WEBHOOK]: 5, // 5 minutes for webhook calls
        [WorkflowStepType.UPDATE_LEAD]: 1, // 1 minute for lead updates
        [WorkflowStepType.CREATE_TASK]: 1, // 1 minute for task creation
        [WorkflowStepType.SEND_SMS]: 1, // 1 minute for SMS sending
        [WorkflowStepType.SEND_WHATSAPP]: 1, // 1 minute for WhatsApp sending
        [WorkflowStepType.API_CALL]: 3, // 3 minutes for API calls
        [WorkflowStepType.CUSTOM_ACTION]: 5 // 5 minutes for custom actions
      }

      duration += baseDurations[step.type] || 1

      // Add retry delays if configured
      if (step.retryPolicy) {
        const avgRetries = step.retryPolicy.maxRetries / 2 // Assume average retries
        const avgDelay = (step.retryPolicy.baseDelay + step.retryPolicy.maxDelay) / 2
        duration += avgRetries * avgDelay / 60 // Convert to minutes
      }
    }

    return Math.max(1, Math.round(duration))
  }

  /**
   * Generate workflow recommendations
   */
  private generateRecommendations(workflow: WorkflowDefinition): string[] {
    const recommendations: string[] = []

    // Check for missing error handling
    const stepsWithoutErrorHandling = workflow.steps.filter(step => !step.errorHandling)
    if (stepsWithoutErrorHandling.length > 0) {
      recommendations.push('Consider adding error handling policies to steps that don\'t have them')
    }

    // Check for missing retry policies
    const stepsWithoutRetry = workflow.steps.filter(step => !step.retryPolicy)
    if (stepsWithoutRetry.length > 0) {
      recommendations.push('Consider adding retry policies to steps that make external calls')
    }

    // Check for long wait times
    const longWaitSteps = workflow.steps.filter(step =>
      step.type === WorkflowStepType.WAIT && step.delay && step.delay > 1440 // 24 hours
    )
    if (longWaitSteps.length > 0) {
      recommendations.push('Consider breaking down long wait times into smaller chunks')
    }

    // Check for complex conditions
    const complexConditions = workflow.steps.filter(step =>
      step.conditions && step.conditions.length > 3
    )
    if (complexConditions.length > 0) {
      recommendations.push('Consider simplifying complex conditional logic')
    }

    // Performance recommendations
    if (workflow.settings.concurrencyLimit > 50) {
      recommendations.push('High concurrency limit may impact system performance')
    }

    if (workflow.settings.maxExecutionsPerDay > 10000) {
      recommendations.push('High execution limit may require additional system resources')
    }

    return recommendations
  }

  /**
   * Identify potential issues
   */
  private identifyPotentialIssues(workflow: WorkflowDefinition): string[] {
    const issues: string[] = []

    // Check for potential infinite loops
    const hasPotentialLoop = workflow.steps.some(step =>
      step.conditions?.some(condition =>
        condition.nextStepId && workflow.steps.some(s =>
          s.conditions?.some(c => c.nextStepId === step.id)
        )
      )
    )

    if (hasPotentialLoop) {
      issues.push('Potential infinite loop detected in workflow conditions')
    }

    // Check for webhook dependencies
    const webhookSteps = workflow.steps.filter(step => step.type === WorkflowStepType.WEBHOOK)
    if (webhookSteps.length > workflow.steps.length / 2) {
      issues.push('Workflow heavily depends on external webhooks which may be unreliable')
    }

    // Check for resource-intensive operations
    const resourceIntensiveSteps = workflow.steps.filter(step =>
      [WorkflowStepType.API_CALL, WorkflowStepType.CUSTOM_ACTION].includes(step.type)
    )

    if (resourceIntensiveSteps.length > 5) {
      issues.push('Multiple resource-intensive steps may cause performance issues')
    }

    // Check for timeout risks
    const totalEstimatedDuration = this.calculateEstimatedDuration(workflow)
    if (totalEstimatedDuration > workflow.settings.timeoutMinutes) {
      issues.push('Estimated workflow duration exceeds configured timeout')
    }

    return issues
  }

  /**
   * Execute workflow with circuit breaker protection
   */
  async executeWithProtection<T>(
    workflowType: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(workflowType)
    if (!circuitBreaker) {
      throw new ExternalServiceError(`No circuit breaker configured for workflow type: ${workflowType}`)
    }

    return await circuitBreaker.execute(operation)
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(workflowType: string) {
    const circuitBreaker = this.circuitBreakers.get(workflowType)
    return circuitBreaker?.getState()
  }
}

// Export singleton instance
export const workflowValidator = WorkflowValidator.getInstance()
export default workflowValidator