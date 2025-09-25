/**
 * Database Operation Validation and Transaction Safety
 * Provides robust validation and transaction safety for database operations
 */

import { z } from 'zod'
import { ValidationError, ExternalServiceError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/errors'

// Database Operation Types
export enum DatabaseOperationType {
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
  SELECT = 'select',
  UPSERT = 'upsert',
  BULK_INSERT = 'bulk_insert',
  BULK_UPDATE = 'bulk_update',
  BULK_DELETE = 'bulk_delete',
  TRANSACTION = 'transaction'
}

// Transaction Isolation Levels
export enum TransactionIsolationLevel {
  READ_UNCOMMITTED = 'READ_UNCOMMITTED',
  READ_COMMITTED = 'READ_COMMITTED',
  REPEATABLE_READ = 'REPEATABLE_READ',
  SERIALIZABLE = 'SERIALIZABLE'
}

// Database Error Types
export enum DatabaseErrorType {
  CONNECTION_ERROR = 'connection_error',
  QUERY_ERROR = 'query_error',
  CONSTRAINT_VIOLATION = 'constraint_violation',
  DEADLOCK_ERROR = 'deadlock_error',
  TIMEOUT_ERROR = 'timeout_error',
  SERIALIZATION_ERROR = 'serialization_error',
  DATA_INTEGRITY_ERROR = 'data_integrity_error',
  RESOURCE_EXHAUSTED_ERROR = 'resource_exhausted_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// Database Operation Context
export interface DatabaseOperationContext {
  operation: DatabaseOperationType
  table: string
  schema?: string
  userId?: string
  tenantId?: string
  correlationId: string
  requestId: string
  startTime: number
  retryAttempt?: number
  metadata?: Record<string, unknown>
  transactionId?: string
  isolationLevel?: TransactionIsolationLevel
}

// Database Validation Rule
export interface DatabaseValidationRule {
  id: string
  name: string
  description: string
  table: string
  operation: DatabaseOperationType | 'all'
  condition: string // SQL condition or JavaScript expression
  severity: 'error' | 'warning'
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

// Database Constraint
export interface DatabaseConstraint {
  id: string
  name: string
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'not_null'
  table: string
  columns: string[]
  referencedTable?: string
  referencedColumns?: string[]
  checkExpression?: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

// Database Transaction
export interface DatabaseTransaction {
  id: string
  status: 'active' | 'committed' | 'rolled_back' | 'failed'
  isolationLevel: TransactionIsolationLevel
  operations: DatabaseOperation[]
  startedAt: Date
  committedAt?: Date
  rolledBackAt?: Date
  error?: DatabaseTransactionError
  metadata: Record<string, unknown>
}

// Database Operation
export interface DatabaseOperation {
  id: string
  type: DatabaseOperationType
  table: string
  schema?: string
  query: string
  parameters?: Record<string, unknown>
  status: 'pending' | 'executed' | 'failed' | 'rolled_back'
  startedAt: Date
  completedAt?: Date
  duration?: number
  affectedRows?: number
  error?: DatabaseOperationError
  validationResults?: DatabaseValidationResult[]
  retryCount: number
  metadata: Record<string, unknown>
}

// Database Validation Result
export interface DatabaseValidationResult {
  ruleId: string
  ruleName: string
  passed: boolean
  message: string
  severity: 'error' | 'warning'
  suggestedAction?: string
  timestamp: Date
}

// Database Operation Error
export interface DatabaseOperationError {
  type: DatabaseErrorType
  message: string
  code?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  retryable: boolean
  timestamp: Date
  context: Record<string, unknown>
  stackTrace?: string
}

// Database Transaction Error
export interface DatabaseTransactionError {
  type: DatabaseErrorType
  message: string
  operationId?: string
  timestamp: Date
  context: Record<string, unknown>
  recoveryActions: string[]
}

// Database Health Status
export interface DatabaseHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  connectionPool: {
    active: number
    idle: number
    pending: number
    total: number
  }
  performance: {
    averageQueryTime: number
    slowQueries: number
    deadlocks: number
    timeouts: number
  }
  replication?: {
    lag: number
    status: 'up' | 'down' | 'lag'
  }
  lastChecked: Date
}

// Database Query Validation
export interface DatabaseQueryValidation {
  isValid: boolean
  errors: Array<{
    type: string
    message: string
    line?: number
    column?: number
    suggestion?: string
  }>
  warnings: Array<{
    type: string
    message: string
    suggestion?: string
  }>
  performance: {
    estimatedCost: number
    potentialIssues: string[]
    optimizationSuggestions: string[]
  }
  security: {
    sqlInjectionRisk: 'low' | 'medium' | 'high'
    sensitiveDataAccess: boolean
    privilegeEscalationRisk: 'low' | 'medium' | 'high'
  }
}

// Database Connection Manager
class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager
  private connectionPool: Map<string, any> = new Map()
  private healthStatus: DatabaseHealthStatus = {
    status: 'healthy',
    connectionPool: { active: 0, idle: 0, pending: 0, total: 0 },
    performance: { averageQueryTime: 0, slowQueries: 0, deadlocks: 0, timeouts: 0 },
    lastChecked: new Date()
  }

  constructor() {
    this.initializeConnectionPool()
  }

  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager()
    }
    return DatabaseConnectionManager.instance
  }

  private initializeConnectionPool() {
    // Initialize connection pool based on configuration
    // This would typically connect to your database (Supabase, PostgreSQL, etc.)
  }

  async getConnection(context: DatabaseOperationContext): Promise<any> {
    // Get or create database connection
    const poolKey = `${context.tenantId || 'default'}_${context.isolationLevel || 'READ_COMMITTED'}`

    if (!this.connectionPool.has(poolKey)) {
      // Create new connection pool
      const connection = await this.createConnection(context)
      this.connectionPool.set(poolKey, connection)
    }

    const connection = this.connectionPool.get(poolKey)
    this.updateHealthStatus()

    return connection
  }

  private async createConnection(context: DatabaseOperationContext): Promise<any> {
    // Create database connection based on configuration
    // This would typically use your database client (Supabase client, etc.)
    return {}
  }

  private updateHealthStatus() {
    // Update health status based on current metrics
    this.healthStatus.lastChecked = new Date()
  }

  getHealthStatus(): DatabaseHealthStatus {
    return this.healthStatus
  }
}

// Database Validator
export class DatabaseValidator {
  private static instance: DatabaseValidator
  private connectionManager: DatabaseConnectionManager
  private validationRules: Map<string, DatabaseValidationRule[]> = new Map()
  private constraints: Map<string, DatabaseConstraint[]> = new Map()

  constructor() {
    this.connectionManager = DatabaseConnectionManager.getInstance()
    this.initializeValidationRules()
    this.initializeConstraints()
  }

  static getInstance(): DatabaseValidator {
    if (!DatabaseValidator.instance) {
      DatabaseValidator.instance = new DatabaseValidator()
    }
    return DatabaseValidator.instance
  }

  private initializeValidationRules() {
    // Initialize default validation rules for common tables
    const defaultRules: DatabaseValidationRule[] = [
      {
        id: 'lead_email_unique',
        name: 'Lead Email Uniqueness',
        description: 'Ensure lead email addresses are unique',
        table: 'leads',
        operation: DatabaseOperationType.INSERT,
        condition: 'NOT EXISTS (SELECT 1 FROM leads WHERE email = $1 AND user_id = $2)',
        severity: 'error',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'lead_score_range',
        name: 'Lead Score Range',
        description: 'Ensure lead score is between 0 and 100',
        table: 'leads',
        operation: DatabaseOperationType.UPDATE,
        condition: 'lead_score >= 0 AND lead_score <= 100',
        severity: 'error',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'workflow_step_order',
        name: 'Workflow Step Order',
        description: 'Ensure workflow steps have sequential order',
        table: 'workflow_steps',
        operation: DatabaseOperationType.INSERT,
        condition: 'step_order >= 0 AND NOT EXISTS (SELECT 1 FROM workflow_steps WHERE workflow_id = $1 AND step_order = $2)',
        severity: 'error',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    for (const rule of defaultRules) {
      if (!this.validationRules.has(rule.table)) {
        this.validationRules.set(rule.table, [])
      }
      this.validationRules.get(rule.table)!.push(rule)
    }
  }

  private initializeConstraints() {
    // Initialize database constraints
    const defaultConstraints: DatabaseConstraint[] = [
      {
        id: 'pk_leads',
        name: 'Primary Key - Leads',
        type: 'primary_key',
        table: 'leads',
        columns: ['id'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'fk_leads_user',
        name: 'Foreign Key - Leads to Users',
        type: 'foreign_key',
        table: 'leads',
        columns: ['user_id'],
        referencedTable: 'auth.users',
        referencedColumns: ['id'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'unique_lead_email',
        name: 'Unique Lead Email',
        type: 'unique',
        table: 'leads',
        columns: ['email', 'user_id'],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    for (const constraint of defaultConstraints) {
      if (!this.constraints.has(constraint.table)) {
        this.constraints.set(constraint.table, [])
      }
      this.constraints.get(constraint.table)!.push(constraint)
    }
  }

  /**
   * Validate database operation
   */
  async validateDatabaseOperation(
    operation: DatabaseOperation,
    context?: DatabaseOperationContext
  ): Promise<DatabaseValidationResult[]> {
    const validationResults: DatabaseValidationResult[] = []

    try {
      // Get validation rules for the table
      const rules = this.validationRules.get(operation.table) || []

      // Filter rules by operation type
      const applicableRules = rules.filter(rule =>
        rule.operation === operation.type || rule.operation === 'all'
      )

      // Validate against each rule
      for (const rule of applicableRules) {
        if (!rule.enabled) continue

        const result = await this.validateAgainstRule(operation, rule, context || {
          operation: DatabaseOperationType.SELECT,
          table: operation.table,
          correlationId: 'default',
          requestId: 'default',
          startTime: Date.now()
        })
        validationResults.push(result)
      }

      // Log validation results
      const failedValidations = validationResults.filter(r => !r.passed)
      if (failedValidations.length > 0) {
        await logger.warn('Database operation validation failed', {
          operationId: operation.id,
          operationType: operation.type,
          table: operation.table,
          failedCount: failedValidations.length,
          validationResults
        }, {
          userId: context?.userId,
          correlationId: context?.correlationId,
          tags: ['database', 'validation', 'failed'],
          source: 'system'
        })
      } else {
        await logger.debug('Database operation validation passed', {
          operationId: operation.id,
          operationType: operation.type,
          table: operation.table,
          validationCount: validationResults.length
        }, {
          userId: context?.userId,
          correlationId: context?.correlationId,
          tags: ['database', 'validation', 'success'],
          source: 'system'
        })
      }

    } catch (error) {
      await logger.error('Database operation validation error', error as Error, {
        operationId: operation.id,
        operationType: operation.type,
        table: operation.table,
        context
      }, {
        userId: context?.userId,
        correlationId: context?.correlationId,
        tags: ['database', 'validation', 'error'],
        source: 'system'
      })
    }

    return validationResults
  }

  /**
   * Validate against specific rule
   */
  private async validateAgainstRule(
    operation: DatabaseOperation,
    rule: DatabaseValidationRule,
    context: DatabaseOperationContext
  ): Promise<DatabaseValidationResult> {
    try {
      // This would execute the validation condition against the database
      // For now, we'll simulate the validation
      const isValid = await this.executeValidationRule(operation, rule, context)

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        passed: isValid,
        message: isValid ? 'Validation passed' : `Validation failed: ${rule.description}`,
        severity: rule.severity,
        suggestedAction: isValid ? undefined : 'Review data and fix validation errors',
        timestamp: new Date()
      }
    } catch (error) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        passed: false,
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        suggestedAction: 'Check validation rule configuration',
        timestamp: new Date()
      }
    }
  }

  /**
   * Execute validation rule
   */
  private async executeValidationRule(
    operation: DatabaseOperation,
    rule: DatabaseValidationRule,
    context: DatabaseOperationContext
  ): Promise<boolean> {
    // This would execute the actual validation query against the database
    // For demonstration, we'll return true (assuming validation passes)
    // In a real implementation, this would execute the rule.condition as a SQL query

    // Simulate some validation logic
    if (rule.id === 'lead_email_unique') {
      // Check if email already exists (simulated)
      return true
    }

    if (rule.id === 'lead_score_range') {
      // Check if score is in valid range (simulated)
      return true
    }

    if (rule.id === 'workflow_step_order') {
      // Check if step order is sequential (simulated)
      return true
    }

    return true
  }

  /**
   * Validate database query
   */
  async validateDatabaseQuery(
    query: string,
    context: DatabaseOperationContext,
    parameters?: Record<string, unknown>
  ): Promise<DatabaseQueryValidation> {
    const validation: DatabaseQueryValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      performance: {
        estimatedCost: 1,
        potentialIssues: [],
        optimizationSuggestions: []
      },
      security: {
        sqlInjectionRisk: 'low',
        sensitiveDataAccess: false,
        privilegeEscalationRisk: 'low'
      }
    }

    try {
      // Basic SQL injection detection
      if (this.detectSQLInjection(query)) {
        validation.isValid = false
        validation.errors.push({
          type: 'security',
          message: 'Potential SQL injection detected',
          suggestion: 'Use parameterized queries instead of string interpolation'
        })
        validation.security.sqlInjectionRisk = 'high'
      }

      // Check for sensitive data access
      if (this.detectSensitiveDataAccess(query)) {
        validation.warnings.push({
          type: 'security',
          message: 'Query accesses sensitive data',
          suggestion: 'Ensure proper authorization checks are in place'
        })
        validation.security.sensitiveDataAccess = true
      }

      // Performance analysis
      validation.performance = this.analyzeQueryPerformance(query, parameters)

      // Security analysis
      validation.security = this.analyzeQuerySecurity(query, context)

      // Log validation results
      if (!validation.isValid || validation.warnings.length > 0) {
        await logger.warn('Database query validation issues detected', {
          query: query.substring(0, 100) + '...',
          isValid: validation.isValid,
          errorCount: validation.errors.length,
          warningCount: validation.warnings.length,
          context
        }, {
          userId: context?.userId,
          correlationId: context?.correlationId,
          tags: ['database', 'query', 'validation'],
          source: 'system'
        })
      }

    } catch (error) {
      validation.isValid = false
      validation.errors.push({
        type: 'validation',
        message: `Query validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: 'Review query syntax and structure'
      })

      await logger.error('Database query validation error', error as Error, {
        query: query.substring(0, 100) + '...',
        context
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['database', 'query', 'validation', 'error'],
        source: 'system'
      })
    }

    return validation
  }

  /**
   * Detect SQL injection patterns
   */
  private detectSQLInjection(query: string): boolean {
    const dangerousPatterns = [
      /(\bselect\b.*\bfrom\b.*\bwhere\b.*\b1=1\b)/i,
      /(\bor\b\s+\d+\s*=\s*\d+)/i,
      /(\bunion\b.*\bselect\b)/i,
      /(--.*)/,
      /(\*.*from.*)/i,
      /(;\s*drop\s)/i,
      /(;\s*delete\s)/i,
      /(;\s*update\s)/i
    ]

    return dangerousPatterns.some(pattern => pattern.test(query))
  }

  /**
   * Detect sensitive data access
   */
  private detectSensitiveDataAccess(query: string): boolean {
    const sensitivePatterns = [
      /\bpassword\b/i,
      /\bsecret\b/i,
      /\btoken\b/i,
      /\bkey\b/i,
      /\bcredit_card\b/i,
      /\bssn\b/i,
      /\bsocial_security\b/i
    ]

    return sensitivePatterns.some(pattern => pattern.test(query))
  }

  /**
   * Analyze query performance
   */
  private analyzeQueryPerformance(
    query: string,
    parameters?: Record<string, unknown>
  ): DatabaseQueryValidation['performance'] {
    const issues: string[] = []
    const suggestions: string[] = []

    // Check for missing WHERE clauses
    if (query.toLowerCase().includes('select') && !query.toLowerCase().includes('where')) {
      issues.push('SELECT query without WHERE clause may return large datasets')
      suggestions.push('Add appropriate WHERE conditions to limit result set')
    }

    // Check for missing indexes (basic detection)
    if (query.toLowerCase().includes('where') && query.toLowerCase().includes('=') && !query.toLowerCase().includes('primary')) {
      suggestions.push('Consider adding indexes for columns used in WHERE clauses')
    }

    // Check for subqueries
    if (query.toLowerCase().includes('select') && query.toLowerCase().includes('(')) {
      issues.push('Subqueries may impact performance')
      suggestions.push('Consider using JOINs instead of subqueries where possible')
    }

    return {
      estimatedCost: issues.length + 1,
      potentialIssues: issues,
      optimizationSuggestions: suggestions
    }
  }

  /**
   * Analyze query security
   */
  private analyzeQuerySecurity(
    query: string,
    context: DatabaseOperationContext
  ): DatabaseQueryValidation['security'] {
    let sqlInjectionRisk: 'low' | 'medium' | 'high' = 'low'
    let sensitiveDataAccess = false
    let privilegeEscalationRisk: 'low' | 'medium' | 'high' = 'low'

    // SQL injection risk assessment
    if (query.includes('$') || query.includes('?')) {
      sqlInjectionRisk = 'low' // Parameterized query
    } else if (query.includes('+') || query.includes('||')) {
      sqlInjectionRisk = 'high' // String concatenation
    } else {
      sqlInjectionRisk = 'medium' // Mixed usage
    }

    // Sensitive data detection
    sensitiveDataAccess = this.detectSensitiveDataAccess(query)

    // Privilege escalation risk
    if (query.toLowerCase().includes('admin') || query.toLowerCase().includes('superuser')) {
      privilegeEscalationRisk = 'high'
    } else if (query.toLowerCase().includes('role') || query.toLowerCase().includes('permission')) {
      privilegeEscalationRisk = 'medium'
    }

    return {
      sqlInjectionRisk,
      sensitiveDataAccess,
      privilegeEscalationRisk
    }
  }

  /**
   * Execute database operation with validation
   */
  async executeWithValidation<T>(
    operation: DatabaseOperation,
    context: DatabaseOperationContext,
    executor: (operation: DatabaseOperation) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()

    try {
      // Validate operation
      const validationResults = await this.validateDatabaseOperation(operation, context)

      // Check for critical validation failures
      const criticalFailures = validationResults.filter(r => !r.passed && r.severity === 'error')
      if (criticalFailures.length > 0) {
        throw new ValidationError('Database operation validation failed', {
          operationId: operation.id,
          validationResults: criticalFailures
        })
      }

      // Validate query if it's a SELECT/UPDATE/DELETE operation
      if (operation.query && [DatabaseOperationType.SELECT, DatabaseOperationType.UPDATE, DatabaseOperationType.DELETE].includes(operation.type)) {
        const queryValidation = await this.validateDatabaseQuery(operation.query, context, operation.parameters)

        if (!queryValidation.isValid) {
          throw new ValidationError('Database query validation failed', {
            operationId: operation.id,
            queryValidation
          })
        }
      }

      // Execute operation
      const result = await executor(operation)

      // Log successful execution
      const duration = Date.now() - startTime
      await logger.info('Database operation completed successfully', {
        operationId: operation.id,
        operationType: operation.type,
        table: operation.table,
        duration,
        affectedRows: operation.affectedRows,
        context
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['database', 'operation', 'success'],
        source: 'system'
      })

      return result

    } catch (error) {
      const duration = Date.now() - startTime
      const errorType = this.classifyDatabaseError(error as Error)

      await logger.error('Database operation failed', error as Error, {
        operationId: operation.id,
        operationType: operation.type,
        table: operation.table,
        duration,
        errorType,
        context
      }, {
        userId: context.userId,
        correlationId: context.correlationId,
        tags: ['database', 'operation', 'error', errorType],
        source: 'system'
      })

      throw error
    }
  }

  /**
   * Classify database error type
   */
  private classifyDatabaseError(error: Error): DatabaseErrorType {
    const message = error.message.toLowerCase()

    if (message.includes('connection') || message.includes('econnrefused')) {
      return DatabaseErrorType.CONNECTION_ERROR
    }

    if (message.includes('deadlock') || message.includes('lock')) {
      return DatabaseErrorType.DEADLOCK_ERROR
    }

    if (message.includes('timeout') || message.includes('cancelled')) {
      return DatabaseErrorType.TIMEOUT_ERROR
    }

    if (message.includes('constraint') || message.includes('violation')) {
      return DatabaseErrorType.CONSTRAINT_VIOLATION
    }

    if (message.includes('serialization') || message.includes('concurrent')) {
      return DatabaseErrorType.SERIALIZATION_ERROR
    }

    if (message.includes('integrity') || message.includes('corrupt')) {
      return DatabaseErrorType.DATA_INTEGRITY_ERROR
    }

    return DatabaseErrorType.UNKNOWN_ERROR
  }

  /**
   * Get database health status
   */
  getDatabaseHealthStatus(): DatabaseHealthStatus {
    return this.connectionManager.getHealthStatus()
  }
}

// Export singleton instance
export const databaseValidator = DatabaseValidator.getInstance()
export default databaseValidator