import { exec } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { logger } from '@/lib/logger'
import { requireEnv } from '@/lib/env'
import { SecurityAudit } from '@/lib/security'

export interface BackupConfig {
  schedule: string // cron expression
  retentionDays: number
  backupPath: string
  compressionEnabled: boolean
  encryptionEnabled: boolean
  encryptionKey?: string
  maxConcurrentBackups: number
}

export interface BackupResult {
  success: boolean
  backupId: string
  filePath: string
  fileSize: number
  duration: number
  checksum: string
  error?: string
}

export class DatabaseBackupService {
  private config: BackupConfig
  private activeBackups: Set<string> = new Set()

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      schedule: '0 2 * * *', // Daily at 2 AM
      retentionDays: 30,
      backupPath: join(process.cwd(), 'backups', 'database'),
      compressionEnabled: true,
      encryptionEnabled: true,
      maxConcurrentBackups: 3,
      ...config,
    }

    this.ensureBackupDirectory()
  }

  /**
   * Create a full database backup
   */
  async createBackup(): Promise<BackupResult> {
    const backupId = this.generateBackupId()
    const startTime = Date.now()

    try {
      // Check concurrent backup limit
      if (this.activeBackups.size >= this.config.maxConcurrentBackups) {
        throw new Error('Maximum concurrent backups reached')
      }

      this.activeBackups.add(backupId)

      // Get database connection details
      const dbUrl = this.getDatabaseUrl()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const baseFileName = `backup_${timestamp}_${backupId}`

      let fileName = baseFileName
      if (this.config.compressionEnabled) {
        fileName += '.sql.gz'
      } else {
        fileName += '.sql'
      }

      const filePath = join(this.config.backupPath, fileName)

      // Execute pg_dump
      await this.executePgDump(dbUrl, filePath)

      // Get file stats
      const stats = await fs.stat(filePath)
      const fileSize = stats.size

      // Generate checksum
      const checksum = await this.generateChecksum(filePath)

      // Encrypt if enabled
      if (this.config.encryptionEnabled) {
        await this.encryptBackup(filePath)
      }

      // Log successful backup
      SecurityAudit.logSensitiveAction('database_backup_created', 'system', {
        backupId,
        filePath,
        fileSize,
        checksum,
      })

      logger.info('Database backup completed successfully', {
        backupId,
        filePath,
        fileSize,
        duration: Date.now() - startTime,
      })

      const result: BackupResult = {
        success: true,
        backupId,
        filePath,
        fileSize,
        duration: Date.now() - startTime,
        checksum,
      }

      // Cleanup old backups
      await this.cleanupOldBackups()

      return result

    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('Database backup failed', error as Error, {
        backupId,
        duration,
      })

      return {
        success: false,
        backupId,
        filePath: '',
        fileSize: 0,
        duration,
        checksum: '',
        error: (error as Error).message,
      }
    } finally {
      this.activeBackups.delete(backupId)
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const backupFile = await this.findBackupFile(backupId)
      if (!backupFile) {
        throw new Error(`Backup file not found for ID: ${backupId}`)
      }

      // Decrypt if needed
      let restoreFile = backupFile
      if (this.config.encryptionEnabled && backupFile.endsWith('.enc')) {
        restoreFile = await this.decryptBackup(backupFile)
      }

      // Decompress if needed
      if (restoreFile.endsWith('.gz')) {
        restoreFile = await this.decompressBackup(restoreFile)
      }

      // Execute pg_restore or psql
      const dbUrl = this.getDatabaseUrl()
      await this.executeRestore(dbUrl, restoreFile)

      SecurityAudit.logSensitiveAction('database_backup_restored', 'system', {
        backupId,
        backupFile,
      })

      logger.info('Database restore completed successfully', { backupId })

      return { success: true }

    } catch (error) {
      logger.error('Database restore failed', error as Error, { backupId })
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{
    backupId: string
    fileName: string
    fileSize: number
    createdAt: Date
    checksum: string
  }>> {
    try {
      const files = await fs.readdir(this.config.backupPath)
      const backups = []

      for (const file of files) {
        if (file.startsWith('backup_') && (file.endsWith('.sql') || file.endsWith('.sql.gz') || file.endsWith('.enc'))) {
          const filePath = join(this.config.backupPath, file)
          const stats = await fs.stat(filePath)
          const checksum = await this.generateChecksum(filePath)

          // Extract backup ID from filename
          const parts = file.split('_')
          const backupId = parts[2] // backup_TIMESTAMP_ID

          backups.push({
            backupId,
            fileName: file,
            fileSize: stats.size,
            createdAt: stats.mtime,
            checksum,
          })
        }
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    } catch (error) {
      logger.error('Failed to list backups', error as Error)
      return []
    }
  }

  /**
   * Execute pg_dump command
   */
  private async executePgDump(dbUrl: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = `pg_dump "${dbUrl}"`

      if (this.config.compressionEnabled) {
        command += ` | gzip > "${outputPath}"`
      } else {
        command += ` > "${outputPath}"`
      }

      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`pg_dump failed: ${error.message}\n${stderr}`))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Execute database restore
   */
  private async executeRestore(dbUrl: string, backupFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = `psql "${dbUrl}" < "${backupFile}"`

      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Database restore failed: ${error.message}\n${stderr}`))
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Encrypt backup file
   */
  private async encryptBackup(filePath: string): Promise<void> {
    const encryptedPath = `${filePath}.enc`
    const key = this.config.encryptionKey || requireEnv('ENCRYPTION_KEY')

    return new Promise((resolve, reject) => {
      const command = `openssl enc -aes-256-cbc -salt -in "${filePath}" -out "${encryptedPath}" -k "${key}"`

      exec(command, (error) => {
        if (error) {
          reject(new Error(`Encryption failed: ${error.message}`))
        } else {
          // Remove original file
          fs.unlink(filePath).then(() => resolve()).catch(reject)
        }
      })
    })
  }

  /**
   * Decrypt backup file
   */
  private async decryptBackup(encryptedPath: string): Promise<string> {
    const decryptedPath = encryptedPath.replace('.enc', '')
    const key = this.config.encryptionKey || requireEnv('ENCRYPTION_KEY')

    return new Promise((resolve, reject) => {
      const command = `openssl enc -d -aes-256-cbc -in "${encryptedPath}" -out "${decryptedPath}" -k "${key}"`

      exec(command, (error) => {
        if (error) {
          reject(new Error(`Decryption failed: ${error.message}`))
        } else {
          resolve(decryptedPath)
        }
      })
    })
  }

  /**
   * Decompress backup file
   */
  private async decompressBackup(compressedPath: string): Promise<string> {
    const decompressedPath = compressedPath.replace('.gz', '')

    return new Promise((resolve, reject) => {
      const command = `gzip -d -c "${compressedPath}" > "${decompressedPath}"`

      exec(command, (error) => {
        if (error) {
          reject(new Error(`Decompression failed: ${error.message}`))
        } else {
          resolve(decompressedPath)
        }
      })
    })
  }

  /**
   * Generate file checksum
   */
  private async generateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto')
    const fileBuffer = await fs.readFile(filePath)
    return crypto.createHash('sha256').update(fileBuffer).digest('hex')
  }

  /**
   * Find backup file by ID
   */
  private async findBackupFile(backupId: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.config.backupPath)

      for (const file of files) {
        if (file.includes(backupId)) {
          return join(this.config.backupPath, file)
        }
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * Cleanup old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.backupPath)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      for (const file of files) {
        if (file.startsWith('backup_')) {
          const filePath = join(this.config.backupPath, file)
          const stats = await fs.stat(filePath)

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath)
            logger.info('Old backup file deleted', { fileName: file })
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups', error as Error)
    }
  }

  /**
   * Get database connection URL
   */
  private getDatabaseUrl(): string {
    // For Supabase, construct connection string
    const host = process.env.SUPABASE_DB_HOST || 'db.bhvlbginotauyewadwvx.supabase.co'
    const port = process.env.SUPABASE_DB_PORT || '5432'
    const database = process.env.SUPABASE_DB_NAME || 'postgres'
    const user = process.env.SUPABASE_DB_USER || 'postgres'
    const password = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    return `postgresql://${user}:${password}@${host}:${port}/${database}`
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    return require('crypto').randomBytes(8).toString('hex')
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.backupPath, { recursive: true })
    } catch (error) {
      logger.error('Failed to create backup directory', error as Error)
    }
  }
}

// Export singleton instance
export const databaseBackupService = new DatabaseBackupService()

// Export convenience functions
export async function createDatabaseBackup(): Promise<BackupResult> {
  return databaseBackupService.createBackup()
}

export async function restoreDatabaseBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
  return databaseBackupService.restoreBackup(backupId)
}

export async function listDatabaseBackups(): Promise<Array<{
  backupId: string
  fileName: string
  fileSize: number
  createdAt: Date
  checksum: string
}>> {
  return databaseBackupService.listBackups()
}