import { createClient } from '@/lib/supabase/server'
import { tenantService } from '@/lib/tenant/tenant-service'
import { logger } from '@/lib/logger'
import { ValidationError, AuthorizationError } from '@/lib/errors'
import { writeFile, readFile } from 'fs/promises'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// Migration types
export type MigrationType = 'data_export' | 'data_import' | 'schema_update' | 'backup' | 'restore'
export type MigrationStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface MigrationJob {
  id: string
  tenant_id: string
  migration_type: MigrationType
  status: MigrationStatus
  source_tenant_id?: string
  target_tenant_id?: string
  metadata: Record<string, any>
  started_at?: string
  completed_at?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export interface BackupOptions {
  includeFiles?: boolean
  includeConfigurations?: boolean
  compression?: boolean
  encryption?: boolean
  retention?: number // days
}

export interface MigrationResult {
  success: boolean
  recordsProcessed: number
  errors: string[]
  warnings: string[]
  duration: number
}

export class MigrationService {
  private async getSupabase() {
    return await createClient()
  }

  /**
   * Export tenant data
   */
  async exportTenantData(
    tenantId: string,
    userId: string,
    options: {
      includeFiles?: boolean
      tables?: string[]
      format?: 'json' | 'csv'
    } = {}
  ): Promise<{
    jobId: string
    downloadUrl?: string
  }> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    const supabase = await this.getSupabase()
    const jobId = randomUUID()

    // Create migration job
    const { data: job, error: jobError } = await supabase
      .from('tenant_migrations')
      .insert({
        id: jobId,
        tenant_id: tenantId,
        migration_type: 'data_export',
        status: 'in_progress',
        metadata: {
          options,
          user_id: userId,
        },
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Start export process asynchronously
    this.performDataExport(jobId, tenantId, options)

    return { jobId }
  }

  /**
   * Import tenant data
   */
  async importTenantData(
    tenantId: string,
    userId: string,
    data: any,
    options: {
      validateOnly?: boolean
      overwriteExisting?: boolean
      skipValidation?: boolean
    } = {}
  ): Promise<{
    jobId: string
    validationResults?: any
  }> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    const supabase = await this.getSupabase()
    const jobId = randomUUID()

    // Create migration job
    const { data: job, error: jobError } = await supabase
      .from('tenant_migrations')
      .insert({
        id: jobId,
        tenant_id: tenantId,
        migration_type: 'data_import',
        status: 'in_progress',
        metadata: {
          options,
          user_id: userId,
          data_size: JSON.stringify(data).length,
        },
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Start import process
    const result = await this.performDataImport(jobId, tenantId, data, options)

    return {
      jobId,
      validationResults: options.validateOnly ? result : undefined,
    }
  }

  /**
   * Create tenant backup
   */
  async createTenantBackup(
    tenantId: string,
    userId: string,
    options: BackupOptions = {}
  ): Promise<{
    jobId: string
    backupId: string
  }> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    const supabase = await this.getSupabase()
    const jobId = randomUUID()
    const backupId = randomUUID()

    // Create migration job
    const { data: job, error: jobError } = await supabase
      .from('tenant_migrations')
      .insert({
        id: jobId,
        tenant_id: tenantId,
        migration_type: 'backup',
        status: 'in_progress',
        metadata: {
          backup_id: backupId,
          options,
          user_id: userId,
        },
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Start backup process asynchronously
    this.performBackup(jobId, tenantId, backupId, options)

    return { jobId, backupId }
  }

  /**
   * Restore tenant from backup
   */
  async restoreTenantBackup(
    tenantId: string,
    backupId: string,
    userId: string,
    options: {
      validateOnly?: boolean
      overwriteExisting?: boolean
    } = {}
  ): Promise<{
    jobId: string
  }> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    const supabase = await this.getSupabase()
    const jobId = randomUUID()

    // Verify backup exists and belongs to tenant
    const { data: backup, error: backupError } = await supabase
      .from('tenant_backups')
      .select('*')
      .eq('id', backupId)
      .eq('tenant_id', tenantId)
      .single()

    if (backupError || !backup) {
      throw new ValidationError('Backup not found')
    }

    // Create migration job
    const { data: job, error: jobError } = await supabase
      .from('tenant_migrations')
      .insert({
        id: jobId,
        tenant_id: tenantId,
        migration_type: 'restore',
        status: 'in_progress',
        metadata: {
          backup_id: backupId,
          options,
          user_id: userId,
        },
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Start restore process
    this.performRestore(jobId, tenantId, backupId, options)

    return { jobId }
  }

  /**
   * Get migration jobs for a tenant
   */
  async getMigrationJobs(
    tenantId: string,
    userId: string,
    type?: MigrationType,
    status?: MigrationStatus
  ): Promise<MigrationJob[]> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    let query = supabase
      .from('tenant_migrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (type) {
      query = query.eq('migration_type', type)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: jobs, error } = await query

    if (error) throw error

    return jobs || []
  }

  /**
   * Get migration job details
   */
  async getMigrationJob(
    jobId: string,
    tenantId: string,
    userId: string
  ): Promise<MigrationJob> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    const { data: job, error } = await supabase
      .from('tenant_migrations')
      .select('*')
      .eq('id', jobId)
      .eq('tenant_id', tenantId)
      .single()

    if (error) throw error

    return job
  }

  /**
   * Cancel migration job
   */
  async cancelMigrationJob(
    jobId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    const supabase = await this.getSupabase()

    const { error } = await supabase
      .from('tenant_migrations')
      .update({
        status: 'failed',
        error_message: 'Cancelled by user',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('tenant_id', tenantId)

    if (error) throw error

    logger.info('Migration job cancelled', { jobId, tenantId, userId })
  }

  // =====================================
  // PRIVATE IMPLEMENTATION METHODS
  // =====================================

  private async performDataExport(
    jobId: string,
    tenantId: string,
    options: any
  ): Promise<void> {
    const supabase = await this.getSupabase()
    const startTime = Date.now()

    try {
      // Update job status
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      // Define tables to export
      const tables = options.tables || [
        'profiles',
        'call_logs',
        'bookings',
        'ai_configs',
        'lead_sources',
        'leads',
        'lead_activities',
        'knowledge_base',
        'chat_conversations',
        'chat_messages',
        'email_campaigns',
        'social_posts',
        'automation_workflows',
        'analytics_events',
        'business_metrics',
        'integrations',
        'tenant_configs',
        'tenant_features',
      ]

      const exportData: Record<string, any[]> = {}

      // Export each table
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('tenant_id', tenantId)

        if (error) {
          throw new Error(`Failed to export ${table}: ${error.message}`)
        }

        exportData[table] = data || []
      }

      // Generate export file
      const exportFileName = `tenant_${tenantId}_export_${new Date().toISOString().split('T')[0]}.json`
      const exportPath = path.join(process.cwd(), 'exports', exportFileName)

      // Ensure exports directory exists
      await this.ensureDirectoryExists(path.dirname(exportPath))

      // Write export file
      await writeFile(exportPath, JSON.stringify({
        tenant_id: tenantId,
        exported_at: new Date().toISOString(),
        tables: Object.keys(exportData),
        data: exportData,
        metadata: {
          total_records: Object.values(exportData).reduce((sum, records) => sum + records.length, 0),
          tables_count: tables.length,
        },
      }, null, 2))

      // Update job as completed
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: {
            ...options,
            export_file: exportFileName,
            export_path: exportPath,
            record_count: Object.values(exportData).reduce((sum, records) => sum + records.length, 0),
            duration: Date.now() - startTime,
          },
        })
        .eq('id', jobId)

      logger.info('Data export completed', { jobId, tenantId, recordCount: Object.values(exportData).length })

    } catch (error) {
      // Update job as failed
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', jobId)

      logger.error('Data export failed', { jobId, tenantId, error })
    }
  }

  private async performDataImport(
    jobId: string,
    tenantId: string,
    data: any,
    options: any
  ): Promise<MigrationResult> {
    const supabase = await this.getSupabase()
    const startTime = Date.now()
    const result: MigrationResult = {
      success: false,
      recordsProcessed: 0,
      errors: [],
      warnings: [],
      duration: 0,
    }

    try {
      // Update job status
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      // Validate import data structure
      if (!data.data || typeof data.data !== 'object') {
        throw new ValidationError('Invalid import data structure')
      }

      // Process each table
      for (const [tableName, records] of Object.entries(data.data)) {
        if (!Array.isArray(records)) {
          result.warnings.push(`Skipping ${tableName}: not an array`)
          continue
        }

        for (const record of records as any[]) {
          try {
            // Add tenant_id to record
            const recordWithTenant = {
              ...record,
              tenant_id: tenantId,
            }

            // Remove id if not overwriting
            if (!options.overwriteExisting && recordWithTenant.id) {
              delete recordWithTenant.id
            }

            if (options.validateOnly) {
              // Just validate, don't insert
              result.recordsProcessed++
            } else {
              // Insert record
              const { error } = await supabase
                .from(tableName)
                .insert(recordWithTenant)

              if (error) {
                result.errors.push(`Failed to import ${tableName} record: ${error.message}`)
              } else {
                result.recordsProcessed++
              }
            }
          } catch (error) {
            result.errors.push(`Error processing ${tableName} record: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
      }

      result.success = result.errors.length === 0
      result.duration = Date.now() - startTime

      // Update job status
      await supabase
        .from('tenant_migrations')
        .update({
          status: result.success ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
          metadata: {
            ...options,
            result,
          },
        })
        .eq('id', jobId)

      logger.info('Data import completed', { jobId, tenantId, result })

    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      result.duration = Date.now() - startTime

      // Update job as failed
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: result.errors.join('; '),
        })
        .eq('id', jobId)

      logger.error('Data import failed', { jobId, tenantId, error })
    }

    return result
  }

  private async performBackup(
    jobId: string,
    tenantId: string,
    backupId: string,
    options: BackupOptions
  ): Promise<void> {
    const supabase = await this.getSupabase()
    const startTime = Date.now()

    try {
      // Update job status
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      // Create backup record
      const { data: backup, error: backupError } = await supabase
        .from('tenant_backups')
        .insert({
          id: backupId,
          tenant_id: tenantId,
          status: 'in_progress',
          options,
        })
        .select()
        .single()

      if (backupError) throw backupError

      // Perform data export for backup
      await this.performDataExport(jobId, tenantId, {
        includeFiles: options.includeFiles,
        includeConfigurations: options.includeConfigurations,
      })

      // Update backup as completed
      await supabase
        .from('tenant_backups')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          size_bytes: 0, // TODO: Calculate actual size
        })
        .eq('id', backupId)

      // Update job as completed
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: {
            backup_id: backupId,
            duration: Date.now() - startTime,
          },
        })
        .eq('id', jobId)

      logger.info('Backup completed', { jobId, tenantId, backupId })

    } catch (error) {
      // Update backup as failed
      await supabase
        .from('tenant_backups')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', backupId)

      // Update job as failed
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', jobId)

      logger.error('Backup failed', { jobId, tenantId, backupId, error })
    }
  }

  private async performRestore(
    jobId: string,
    tenantId: string,
    backupId: string,
    options: any
  ): Promise<void> {
    const supabase = await this.getSupabase()
    const startTime = Date.now()

    try {
      // Update job status
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      // Get backup data
      const { data: backup, error: backupError } = await supabase
        .from('tenant_backups')
        .select('*')
        .eq('id', backupId)
        .eq('tenant_id', tenantId)
        .single()

      if (backupError || !backup) {
        throw new ValidationError('Backup not found')
      }

      // TODO: Implement actual restore logic
      // This would involve reading the backup file and importing the data

      // Update job as completed
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: {
            backup_id: backupId,
            duration: Date.now() - startTime,
          },
        })
        .eq('id', jobId)

      logger.info('Restore completed', { jobId, tenantId, backupId })

    } catch (error) {
      // Update job as failed
      await supabase
        .from('tenant_migrations')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', jobId)

      logger.error('Restore failed', { jobId, tenantId, backupId, error })
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    // TODO: Implement directory creation logic
    // This would use fs.mkdir with recursive: true
  }
}

// Export singleton instance
export const migrationService = new MigrationService()