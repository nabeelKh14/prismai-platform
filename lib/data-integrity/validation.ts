/**
 * Data Corruption Prevention and Integrity Validation
 * Provides comprehensive data integrity checks and corruption prevention mechanisms
 */

import { z } from 'zod'
import { ValidationError, ExternalServiceError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/errors'

// Data Integrity Types
export enum DataIntegrityLevel {
  LOW = 'low',           // Basic checksum validation
  MEDIUM = 'medium',     // Checksum + schema validation
  HIGH = 'high',         // Full validation + cross-reference checks
  CRITICAL = 'critical'  // Complete validation + historical analysis
}

// Corruption Detection Types
export enum CorruptionType {
  DATA_TRUNCATION = 'data_truncation',
  SCHEMA_MISMATCH = 'schema_mismatch',
  CONSTRAINT_VIOLATION = 'constraint_violation',
  ORPHANED_RECORDS = 'orphaned_records',
  DUPLICATE_DATA = 'duplicate_data',
  INCONSISTENT_REFERENCES = 'inconsistent_references',
  MISSING_REQUIRED_FIELDS = 'missing_required_fields',
  DATA_TYPE_MISMATCH = 'data_type_mismatch',
  CHECKSUM_FAILURE = 'checksum_failure',
  ENCRYPTION_ERROR = 'encryption_error'
}

// Data Validation Rule
export interface DataValidationRule {
  id: string
  name: string
  description: string
  table: string
  fields: string[]
  ruleType: 'required' | 'unique' | 'foreign_key' | 'check' | 'custom'
  condition: string
  severity: 'error' | 'warning'
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

// Data Integrity Check
export interface DataIntegrityCheck {
  id: string
  name: string
  description: string
  tables: string[]
  checkType: 'completeness' | 'consistency' | 'accuracy' | 'uniqueness' | 'referential_integrity'
  query: string
  expectedResult?: unknown
  threshold?: number // For percentage-based checks
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  schedule: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual'
  lastRun?: Date
  lastResult?: boolean
  createdAt: Date
  updatedAt: Date
}

// Corruption Detection Result
export interface CorruptionDetectionResult {
  isCorrupted: boolean
  corruptionType: CorruptionType
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedRecords: number
  affectedTables: string[]
  details: Record<string, unknown>
  recommendations: string[]
  timestamp: Date
  recoveryActions: Array<{
    type: 'rollback' | 'repair' | 'quarantine' | 'manual_review'
    description: string
    automated: boolean
    priority: 'low' | 'medium' | 'high' | 'critical'
  }>
}

// Data Backup Validation
export interface BackupValidationResult {
  isValid: boolean
  backupId: string
  backupDate: Date
  size: number
  checksum: string
  tables: string[]
  recordCounts: Record<string, number>
  issues: Array<{
    type: string
    message: string
    severity: 'error' | 'warning'
    table?: string
    field?: string
  }>
  integrityScore: number
  validationTime: Date
}

// Data Recovery Plan
export interface DataRecoveryPlan {
  corruptionId: string
  recoveryStrategy: 'point_in_time' | 'table_restore' | 'field_repair' | 'full_restore'
  affectedTables: string[]
  steps: Array<{
    order: number
    type: 'backup' | 'repair' | 'validate' | 'notify'
    description: string
    parameters: Record<string, unknown>
    estimatedDuration: number
    riskLevel: 'low' | 'medium' | 'high'
  }>
  estimatedRecoveryTime: number
  requiresApproval: boolean
  approvalRequiredFrom?: string[]
  rollbackPlan?: string
}

// Data Quarantine
export interface DataQuarantine {
  id: string
  table: string
  recordId: string
  reason: string
  quarantinedAt: Date
  quarantinedBy: string
  data: Record<string, unknown>
  originalLocation?: string
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'restored'
  reviewedAt?: Date
  reviewedBy?: string
  notes?: string
}

// Checksum Manager
class ChecksumManager {
  private static instance: ChecksumManager
  private checksums = new Map<string, string>()

  constructor() {
    // Initialize with known good checksums
    this.initializeChecksums()
  }

  static getInstance(): ChecksumManager {
    if (!ChecksumManager.instance) {
      ChecksumManager.instance = new ChecksumManager()
    }
    return ChecksumManager.instance
  }

  private initializeChecksums() {
    // Initialize with baseline checksums for critical tables
    // This would typically be loaded from a secure configuration
  }

  async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async validateChecksum(data: string, expectedChecksum: string): Promise<boolean> {
    const calculatedChecksum = await this.calculateChecksum(data)
    return calculatedChecksum === expectedChecksum
  }

  storeChecksum(key: string, checksum: string): void {
    this.checksums.set(key, checksum)
  }

  getChecksum(key: string): string | undefined {
    return this.checksums.get(key)
  }

  async verifyDataIntegrity(key: string, data: string): Promise<boolean> {
    const storedChecksum = this.getChecksum(key)
    if (!storedChecksum) {
      return false
    }

    return await this.validateChecksum(data, storedChecksum)
  }
}

// Data Corruption Detector
class DataCorruptionDetector {
  private static instance: DataCorruptionDetector
  private integrityChecks: DataIntegrityCheck[] = []
  private validationRules: DataValidationRule[] = []

  constructor() {
    this.initializeIntegrityChecks()
    this.initializeValidationRules()
  }

  static getInstance(): DataCorruptionDetector {
    if (!DataCorruptionDetector.instance) {
      DataCorruptionDetector.instance = new DataCorruptionDetector()
    }
    return DataCorruptionDetector.instance
  }

  private initializeIntegrityChecks() {
    this.integrityChecks = [
      {
        id: 'lead_completeness_check',
        name: 'Lead Data Completeness',
        description: 'Check for missing required fields in leads table',
        tables: ['leads'],
        checkType: 'completeness',
        query: 'SELECT COUNT(*) FROM leads WHERE email IS NULL OR first_name IS NULL OR last_name IS NULL',
        expectedResult: 0,
        threshold: 0,
        severity: 'high',
        enabled: true,
        schedule: 'hourly',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'lead_referential_integrity',
        name: 'Lead Referential Integrity',
        description: 'Check for orphaned leads without valid user references',
        tables: ['leads', 'auth.users'],
        checkType: 'referential_integrity',
        query: 'SELECT COUNT(*) FROM leads l LEFT JOIN auth.users u ON l.user_id = u.id WHERE u.id IS NULL',
        expectedResult: 0,
        severity: 'critical',
        enabled: true,
        schedule: 'daily',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'workflow_consistency_check',
        name: 'Workflow Step Consistency',
        description: 'Check for workflow steps with invalid references',
        tables: ['lead_workflows', 'workflow_executions'],
        checkType: 'consistency',
        query: 'SELECT COUNT(*) FROM workflow_executions we LEFT JOIN lead_workflows w ON we.workflow_id = w.id WHERE w.id IS NULL',
        expectedResult: 0,
        severity: 'high',
        enabled: true,
        schedule: 'hourly',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  }

  private initializeValidationRules() {
    this.validationRules = [
      {
        id: 'email_format_validation',
        name: 'Email Format Validation',
        description: 'Validate email format for all leads',
        table: 'leads',
        fields: ['email'],
        ruleType: 'check',
        condition: 'email ~* \'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$\'',
        severity: 'error',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'lead_score_range',
        name: 'Lead Score Range',
        description: 'Ensure lead scores are within valid range',
        table: 'leads',
        fields: ['lead_score'],
        ruleType: 'check',
        condition: 'lead_score >= 0 AND lead_score <= 100',
        severity: 'error',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'unique_lead_email',
        name: 'Unique Lead Email',
        description: 'Ensure lead emails are unique per user',
        table: 'leads',
        fields: ['email', 'user_id'],
        ruleType: 'unique',
        condition: 'COUNT(*) = 1',
        severity: 'error',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  }

  async detectCorruption(
    table: string,
    recordId?: string,
    level: DataIntegrityLevel = DataIntegrityLevel.MEDIUM
  ): Promise<CorruptionDetectionResult> {
    const result: CorruptionDetectionResult = {
      isCorrupted: false,
      corruptionType: CorruptionType.DATA_TRUNCATION,
      severity: 'low',
      description: 'No corruption detected',
      affectedRecords: 0,
      affectedTables: [table],
      details: {},
      recommendations: [],
      timestamp: new Date(),
      recoveryActions: []
    }

    try {
      // Run integrity checks based on level
      const applicableChecks = this.integrityChecks.filter(check =>
        check.tables.includes(table) && check.enabled
      )

      for (const check of applicableChecks) {
        const checkResult = await this.runIntegrityCheck(check, recordId)
        if (!checkResult.passed) {
          result.isCorrupted = true
          result.severity = check.severity as 'low' | 'medium' | 'high' | 'critical'
          result.affectedRecords += checkResult.affectedRecords
          result.details[check.id] = checkResult
        }
      }

      // Run validation rules based on level
      if (level !== DataIntegrityLevel.LOW) {
        const applicableRules = this.validationRules.filter(rule =>
          rule.table === table && rule.enabled
        )

        for (const rule of applicableRules) {
          const ruleResult = await this.runValidationRule(rule, recordId)
          if (!ruleResult.passed) {
            result.isCorrupted = true
            result.severity = rule.severity === 'error' ? 'high' : 'medium'
            result.affectedRecords += ruleResult.affectedRecords
            result.details[rule.id] = ruleResult
          }
        }
      }

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result)

      // Create recovery actions
      result.recoveryActions = this.generateRecoveryActions(result)

      // Log detection results
      if (result.isCorrupted) {
        await logger.error('Data corruption detected', {
          table,
          recordId,
          corruptionType: result.corruptionType,
          severity: result.severity,
          affectedRecords: result.affectedRecords,
          details: result.details
        }, {
          tags: ['data-integrity', 'corruption', 'detected', result.severity],
          source: 'system'
        })
      } else {
        await logger.debug('Data integrity check passed', {
          table,
          recordId,
          level
        }, {
          tags: ['data-integrity', 'validation', 'success'],
          source: 'system'
        })
      }

    } catch (error) {
      result.isCorrupted = true
      result.severity = 'critical'
      result.description = `Corruption detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`

      await logger.error('Data corruption detection error', error as Error, {
        table,
        recordId,
        level
      }, {
        tags: ['data-integrity', 'corruption', 'error'],
        source: 'system'
      })
    }

    return result
  }

  private async runIntegrityCheck(
    check: DataIntegrityCheck,
    recordId?: string
  ): Promise<{ passed: boolean; affectedRecords: number; details: Record<string, unknown> }> {
    try {
      // This would execute the actual integrity check query
      // For simulation, we'll return a mock result
      const passed = Math.random() > 0.1 // 90% pass rate for simulation
      const affectedRecords = passed ? 0 : Math.floor(Math.random() * 10)

      return {
        passed,
        affectedRecords,
        details: {
          checkId: check.id,
          checkName: check.name,
          executedAt: new Date(),
          query: check.query
        }
      }
    } catch (error) {
      return {
        passed: false,
        affectedRecords: 1,
        details: {
          checkId: check.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  private async runValidationRule(
    rule: DataValidationRule,
    recordId?: string
  ): Promise<{ passed: boolean; affectedRecords: number; details: Record<string, unknown> }> {
    try {
      // This would execute the actual validation rule
      // For simulation, we'll return a mock result
      const passed = Math.random() > 0.05 // 95% pass rate for simulation
      const affectedRecords = passed ? 0 : Math.floor(Math.random() * 5)

      return {
        passed,
        affectedRecords,
        details: {
          ruleId: rule.id,
          ruleName: rule.name,
          executedAt: new Date(),
          condition: rule.condition
        }
      }
    } catch (error) {
      return {
        passed: false,
        affectedRecords: 1,
        details: {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  private generateRecommendations(result: CorruptionDetectionResult): string[] {
    const recommendations: string[] = []

    if (result.corruptionType === CorruptionType.MISSING_REQUIRED_FIELDS) {
      recommendations.push('Run data completion scripts to fill missing required fields')
      recommendations.push('Implement stricter validation at data entry points')
    }

    if (result.corruptionType === CorruptionType.ORPHANED_RECORDS) {
      recommendations.push('Clean up orphaned records using CASCADE delete rules')
      recommendations.push('Implement regular referential integrity checks')
    }

    if (result.corruptionType === CorruptionType.DUPLICATE_DATA) {
      recommendations.push('Implement deduplication procedures')
      recommendations.push('Add unique constraints where appropriate')
    }

    if (result.corruptionType === CorruptionType.INCONSISTENT_REFERENCES) {
      recommendations.push('Review and fix foreign key relationships')
      recommendations.push('Implement data consistency validation triggers')
    }

    if (result.severity === 'critical') {
      recommendations.push('Consider restoring from backup')
      recommendations.push('Notify system administrators immediately')
    }

    return recommendations
  }

  private generateRecoveryActions(result: CorruptionDetectionResult): Array<{
    type: 'rollback' | 'repair' | 'quarantine' | 'manual_review'
    description: string
    automated: boolean
    priority: 'low' | 'medium' | 'high' | 'critical'
  }> {
    const actions = []

    if (result.affectedRecords < 10) {
      actions.push({
        type: 'repair' as const,
        description: 'Automatically repair corrupted records',
        automated: true,
        priority: 'medium' as const
      })
    } else if (result.affectedRecords < 100) {
      actions.push({
        type: 'quarantine' as const,
        description: 'Quarantine affected records for manual review',
        automated: true,
        priority: 'high' as const
      })
    } else {
      actions.push({
        type: 'manual_review' as const,
        description: 'Manual review required for large-scale corruption',
        automated: false,
        priority: 'critical' as const
      })
    }

    return actions
  }
}

// Data Integrity Validator
export class DataIntegrityValidator {
  private static instance: DataIntegrityValidator
  private checksumManager: ChecksumManager
  private corruptionDetector: DataCorruptionDetector
  private integrityLevel: DataIntegrityLevel = DataIntegrityLevel.MEDIUM

  constructor() {
    this.checksumManager = ChecksumManager.getInstance()
    this.corruptionDetector = DataCorruptionDetector.getInstance()
  }

  static getInstance(): DataIntegrityValidator {
    if (!DataIntegrityValidator.instance) {
      DataIntegrityValidator.instance = new DataIntegrityValidator()
    }
    return DataIntegrityValidator.instance
  }

  /**
   * Validate data integrity for a table
   */
  async validateTableIntegrity(
    table: string,
    level: DataIntegrityLevel = DataIntegrityLevel.MEDIUM
  ): Promise<CorruptionDetectionResult> {
    return await this.corruptionDetector.detectCorruption(table, undefined, level)
  }

  /**
   * Validate data integrity for a specific record
   */
  async validateRecordIntegrity(
    table: string,
    recordId: string,
    level: DataIntegrityLevel = DataIntegrityLevel.MEDIUM
  ): Promise<CorruptionDetectionResult> {
    return await this.corruptionDetector.detectCorruption(table, recordId, level)
  }

  /**
   * Validate backup integrity
   */
  async validateBackupIntegrity(
    backupId: string,
    backupData: Record<string, unknown>
  ): Promise<BackupValidationResult> {
    const result: BackupValidationResult = {
      isValid: true,
      backupId,
      backupDate: new Date(),
      size: JSON.stringify(backupData).length,
      checksum: '',
      tables: [],
      recordCounts: {},
      issues: [],
      integrityScore: 1.0,
      validationTime: new Date()
    }

    try {
      // Calculate checksum
      result.checksum = await this.checksumManager.calculateChecksum(JSON.stringify(backupData))

      // Extract table information
      if (backupData.tables && typeof backupData.tables === 'object') {
        result.tables = Object.keys(backupData.tables as Record<string, unknown>)
      }

      // Count records per table
      if (backupData.data && typeof backupData.data === 'object') {
        const data = backupData.data as Record<string, unknown>
        for (const [table, records] of Object.entries(data)) {
          if (Array.isArray(records)) {
            result.recordCounts[table] = records.length
          }
        }
      }

      // Validate each table's data
      for (const table of result.tables) {
        const corruptionResult = await this.validateTableIntegrity(table, DataIntegrityLevel.HIGH)
        if (corruptionResult.isCorrupted) {
          result.isValid = false
          result.issues.push({
            type: corruptionResult.corruptionType,
            message: corruptionResult.description,
            severity: corruptionResult.severity === 'critical' ? 'error' : 'warning',
            table
          })
        }
      }

      // Calculate integrity score
      const errorCount = result.issues.filter(i => i.severity === 'error').length
      const warningCount = result.issues.filter(i => i.severity === 'warning').length
      result.integrityScore = Math.max(0, 1 - (errorCount * 0.3 + warningCount * 0.1))

      // Log validation results
      await logger.info('Backup integrity validation completed', {
        backupId,
        isValid: result.isValid,
        integrityScore: result.integrityScore,
        tableCount: result.tables.length,
        totalRecords: Object.values(result.recordCounts).reduce((sum, count) => sum + count, 0),
        issueCount: result.issues.length
      }, {
        tags: ['backup', 'validation', result.isValid ? 'success' : 'failed'],
        source: 'system'
      })

    } catch (error) {
      result.isValid = false
      result.issues.push({
        type: 'validation_error',
        message: `Backup validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      })

      await logger.error('Backup integrity validation error', error as Error, {
        backupId
      }, {
        tags: ['backup', 'validation', 'error'],
        source: 'system'
      })
    }

    return result
  }

  /**
   * Quarantine corrupted data
   */
  async quarantineData(
    table: string,
    recordId: string,
    reason: string,
    data: Record<string, unknown>,
    quarantinedBy: string
  ): Promise<DataQuarantine> {
    const quarantine: DataQuarantine = {
      id: crypto.randomUUID(),
      table,
      recordId,
      reason,
      quarantinedAt: new Date(),
      quarantinedBy,
      data,
      reviewStatus: 'pending'
    }

    try {
      // Store quarantine information
      await this.storeQuarantineRecord(quarantine)

      // Log quarantine action
      await logger.warn('Data quarantined', {
        quarantineId: quarantine.id,
        table,
        recordId,
        reason,
        quarantinedBy
      }, {
        tags: ['data-integrity', 'quarantine', 'created'],
        source: 'system'
      })

    } catch (error) {
      await logger.error('Data quarantine error', error as Error, {
        table,
        recordId,
        reason,
        quarantinedBy
      }, {
        tags: ['data-integrity', 'quarantine', 'error'],
        source: 'system'
      })
    }

    return quarantine
  }

  /**
   * Generate recovery plan
   */
  async generateRecoveryPlan(
    corruptionResult: CorruptionDetectionResult
  ): Promise<DataRecoveryPlan> {
    const plan: DataRecoveryPlan = {
      corruptionId: crypto.randomUUID(),
      recoveryStrategy: 'field_repair',
      affectedTables: corruptionResult.affectedTables,
      steps: [],
      estimatedRecoveryTime: 0,
      requiresApproval: corruptionResult.severity === 'critical',
      approvalRequiredFrom: corruptionResult.severity === 'critical' ? ['admin', 'data-steward'] : undefined
    }

    // Determine recovery strategy based on corruption type and severity
    if (corruptionResult.corruptionType === CorruptionType.MISSING_REQUIRED_FIELDS) {
      plan.recoveryStrategy = 'field_repair'
      plan.steps = [
        {
          order: 1,
          type: 'repair',
          description: 'Fill missing required fields with default values',
          parameters: { fillDefaults: true },
          estimatedDuration: 30,
          riskLevel: 'low'
        },
        {
          order: 2,
          type: 'validate',
          description: 'Validate repaired data',
          parameters: {},
          estimatedDuration: 15,
          riskLevel: 'low'
        }
      ]
    } else if (corruptionResult.corruptionType === CorruptionType.ORPHANED_RECORDS) {
      plan.recoveryStrategy = 'table_restore'
      plan.steps = [
        {
          order: 1,
          type: 'backup',
          description: 'Create backup of current state',
          parameters: {},
          estimatedDuration: 10,
          riskLevel: 'low'
        },
        {
          order: 2,
          type: 'repair',
          description: 'Remove or repair orphaned records',
          parameters: { removeOrphans: true },
          estimatedDuration: 60,
          riskLevel: 'medium'
        }
      ]
    } else {
      plan.recoveryStrategy = 'full_restore'
      plan.steps = [
        {
          order: 1,
          type: 'backup',
          description: 'Create backup before recovery',
          parameters: {},
          estimatedDuration: 15,
          riskLevel: 'low'
        },
        {
          order: 2,
          type: 'repair',
          description: 'Restore from latest valid backup',
          parameters: {},
          estimatedDuration: 120,
          riskLevel: 'high'
        },
        {
          order: 3,
          type: 'validate',
          description: 'Validate restored data',
          parameters: {},
          estimatedDuration: 30,
          riskLevel: 'medium'
        }
      ]
    }

    plan.estimatedRecoveryTime = plan.steps.reduce((total, step) => total + step.estimatedDuration, 0)

    return plan
  }

  /**
   * Store quarantine record (simulated)
   */
  private async storeQuarantineRecord(quarantine: DataQuarantine): Promise<void> {
    // This would typically store the quarantine record in a database
    // For simulation, we'll just log it
    console.log('Quarantine record stored:', quarantine)
  }

  /**
   * Set integrity validation level
   */
  setIntegrityLevel(level: DataIntegrityLevel): void {
    this.integrityLevel = level
  }

  /**
   * Get current integrity level
   */
  getIntegrityLevel(): DataIntegrityLevel {
    return this.integrityLevel
  }
}

// Export singleton instance
export const dataIntegrityValidator = DataIntegrityValidator.getInstance()
export default dataIntegrityValidator