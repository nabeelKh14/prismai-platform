import { promises as fs } from 'fs'
import { join, relative, extname } from 'path'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

export interface FileBackupConfig {
  sourcePaths: string[]
  backupPath: string
  schedule: string // cron expression
  retentionDays: number
  compressionEnabled: boolean
  encryptionEnabled: boolean
  encryptionKey?: string
  excludePatterns: string[]
  maxFileSize: number // in bytes
  incrementalBackup: boolean
}

export interface FileBackupResult {
  success: boolean
  backupId: string
  totalFiles: number
  totalSize: number
  duration: number
  checksum: string
  error?: string
}

export class FileBackupService {
  private config: FileBackupConfig

  constructor(config: Partial<FileBackupConfig> = {}) {
    this.config = {
      sourcePaths: [join(process.cwd(), 'uploads')],
      backupPath: join(process.cwd(), 'backups', 'files'),
      schedule: '0 3 * * *', // Daily at 3 AM
      retentionDays: 30,
      compressionEnabled: true,
      encryptionEnabled: true,
      excludePatterns: ['*.tmp', '*.log', 'node_modules/**'],
      maxFileSize: 100 * 1024 * 1024, // 100MB
      incrementalBackup: true,
      ...config,
    }

    this.ensureBackupDirectory()
  }

  /**
   * Create a full file system backup
   */
  async createBackup(): Promise<FileBackupResult> {
    const backupId = this.generateBackupId()
    const startTime = Date.now()

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupDir = join(this.config.backupPath, `backup_${timestamp}_${backupId}`)

      // Create backup directory
      await fs.mkdir(backupDir, { recursive: true })

      let totalFiles = 0
      let totalSize = 0
      const fileList: string[] = []

      // Process each source path
      for (const sourcePath of this.config.sourcePaths) {
        const { files, size } = await this.backupDirectory(sourcePath, backupDir, backupId)
        totalFiles += files.length
        totalSize += size
        fileList.push(...files.map(f => relative(sourcePath, f)))
      }

      // Create manifest file
      const manifest = {
        backupId,
        timestamp: new Date().toISOString(),
        sourcePaths: this.config.sourcePaths,
        totalFiles,
        totalSize,
        fileList,
        config: {
          compressionEnabled: this.config.compressionEnabled,
          encryptionEnabled: this.config.encryptionEnabled,
          incrementalBackup: this.config.incrementalBackup,
        },
      }

      await fs.writeFile(
        join(backupDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      )

      // Compress backup if enabled
      if (this.config.compressionEnabled) {
        await this.compressBackup(backupDir)
      }

      // Encrypt backup if enabled
      if (this.config.encryptionEnabled) {
        await this.encryptBackup(backupDir)
      }

      // Generate checksum
      const checksum = await this.generateDirectoryChecksum(backupDir)

      // Log successful backup
      SecurityAudit.logSensitiveAction('file_backup_created', 'system', {
        backupId,
        backupDir,
        totalFiles,
        totalSize,
        checksum,
      })

      logger.info('File backup completed successfully', {
        backupId,
        backupDir,
        totalFiles,
        totalSize,
        duration: Date.now() - startTime,
      })

      const result: FileBackupResult = {
        success: true,
        backupId,
        totalFiles,
        totalSize,
        duration: Date.now() - startTime,
        checksum,
      }

      // Cleanup old backups
      await this.cleanupOldBackups()

      return result

    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('File backup failed', error as Error, {
        backupId,
        duration,
      })

      return {
        success: false,
        backupId,
        totalFiles: 0,
        totalSize: 0,
        duration,
        checksum: '',
        error: (error as Error).message,
      }
    }
  }

  /**
   * Restore files from backup
   */
  async restoreBackup(backupId: string, targetPath?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const backupDir = await this.findBackupDirectory(backupId)
      if (!backupDir) {
        throw new Error(`Backup directory not found for ID: ${backupId}`)
      }

      // Decrypt if needed
      let restoreDir = backupDir
      if (this.config.encryptionEnabled && backupDir.endsWith('.enc')) {
        restoreDir = await this.decryptBackup(backupDir)
      }

      // Decompress if needed
      if (restoreDir.endsWith('.tar.gz')) {
        restoreDir = await this.decompressBackup(restoreDir)
      }

      // Read manifest
      const manifestPath = join(restoreDir, 'manifest.json')
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'))

      // Restore files
      const restoreTarget = targetPath || manifest.sourcePaths[0]
      await this.restoreDirectory(restoreDir, restoreTarget, manifest)

      SecurityAudit.logSensitiveAction('file_backup_restored', 'system', {
        backupId,
        backupDir,
        targetPath: restoreTarget,
      })

      logger.info('File restore completed successfully', {
        backupId,
        targetPath: restoreTarget,
      })

      return { success: true }

    } catch (error) {
      logger.error('File restore failed', error as Error, { backupId })
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  /**
   * List available file backups
   */
  async listBackups(): Promise<Array<{
    backupId: string
    directory: string
    totalFiles: number
    totalSize: number
    createdAt: Date
    checksum: string
  }>> {
    try {
      const entries = await fs.readdir(this.config.backupPath, { withFileTypes: true })
      const backups = []

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('backup_')) {
          const backupDir = join(this.config.backupPath, entry.name)
          const manifestPath = join(backupDir, 'manifest.json')

          try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'))
            const checksum = await this.generateDirectoryChecksum(backupDir)

            backups.push({
              backupId: manifest.backupId,
              directory: entry.name,
              totalFiles: manifest.totalFiles,
              totalSize: manifest.totalSize,
              createdAt: new Date(manifest.timestamp),
              checksum,
            })
          } catch {
            // Skip invalid backup directories
          }
        }
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    } catch (error) {
      logger.error('Failed to list file backups', error as Error)
      return []
    }
  }

  /**
   * Backup a directory recursively
   */
  private async backupDirectory(
    sourceDir: string,
    backupDir: string,
    backupId: string
  ): Promise<{ files: string[]; size: number }> {
    const files: string[] = []
    let totalSize = 0

    try {
      const entries = await fs.readdir(sourceDir, { withFileTypes: true })

      for (const entry of entries) {
        const sourcePath = join(sourceDir, entry.name)
        const relativePath = relative(this.config.sourcePaths[0], sourcePath)
        const backupPath = join(backupDir, relativePath)

        // Check exclude patterns
        if (this.shouldExclude(relativePath)) {
          continue
        }

        if (entry.isDirectory()) {
          // Create directory in backup
          await fs.mkdir(backupPath, { recursive: true })

          // Recursively backup subdirectory
          const subResult = await this.backupDirectory(sourcePath, backupDir, backupId)
          files.push(...subResult.files)
          totalSize += subResult.size
        } else if (entry.isFile()) {
          // Check file size
          const stats = await fs.stat(sourcePath)
          if (stats.size > this.config.maxFileSize) {
            logger.warn('File too large for backup, skipping', {
              filePath: sourcePath,
              size: stats.size,
            })
            continue
          }

          // Copy file
          await fs.mkdir(join(backupPath, '..'), { recursive: true })
          await fs.copyFile(sourcePath, backupPath)

          files.push(sourcePath)
          totalSize += stats.size
        }
      }
    } catch (error) {
      logger.error('Failed to backup directory', error as Error, { sourceDir })
    }

    return { files, size: totalSize }
  }

  /**
   * Restore a directory from backup
   */
  private async restoreDirectory(
    backupDir: string,
    targetDir: string,
    manifest: any
  ): Promise<void> {
    for (const filePath of manifest.fileList) {
      const backupPath = join(backupDir, filePath)
      const targetPath = join(targetDir, filePath)

      try {
        // Ensure target directory exists
        await fs.mkdir(join(targetPath, '..'), { recursive: true })

        // Copy file
        await fs.copyFile(backupPath, targetPath)
      } catch (error) {
        logger.error('Failed to restore file', error as Error, {
          backupPath,
          targetPath,
        })
      }
    }
  }

  /**
   * Compress backup directory
   */
  private async compressBackup(backupDir: string): Promise<void> {
    const { exec } = require('child_process')
    const archivePath = `${backupDir}.tar.gz`

    return new Promise((resolve, reject) => {
      const command = `tar -czf "${archivePath}" -C "${join(backupDir, '..')}" "${require('path').basename(backupDir)}"`

      exec(command, (error: any) => {
        if (error) {
          reject(new Error(`Compression failed: ${error.message}`))
        } else {
          // Remove original directory
          fs.rm(backupDir, { recursive: true, force: true })
            .then(() => resolve())
            .catch(reject)
        }
      })
    })
  }

  /**
   * Decompress backup archive
   */
  private async decompressBackup(archivePath: string): Promise<string> {
    const { exec } = require('child_process')
    const extractDir = archivePath.replace('.tar.gz', '')

    return new Promise((resolve, reject) => {
      const command = `tar -xzf "${archivePath}" -C "${require('path').dirname(archivePath)}"`

      exec(command, (error: any) => {
        if (error) {
          reject(new Error(`Decompression failed: ${error.message}`))
        } else {
          resolve(extractDir)
        }
      })
    })
  }

  /**
   * Encrypt backup
   */
  private async encryptBackup(backupPath: string): Promise<void> {
    const { exec } = require('child_process')
    const encryptedPath = `${backupPath}.enc`
    const key = this.config.encryptionKey || process.env.ENCRYPTION_KEY

    if (!key) {
      throw new Error('Encryption key not found')
    }

    return new Promise((resolve, reject) => {
      const command = `openssl enc -aes-256-cbc -salt -in "${backupPath}" -out "${encryptedPath}" -k "${key}"`

      exec(command, (error: any) => {
        if (error) {
          reject(new Error(`Encryption failed: ${error.message}`))
        } else {
          // Remove original
          fs.rm(backupPath, { recursive: true, force: true })
            .then(() => resolve())
            .catch(reject)
        }
      })
    })
  }

  /**
   * Decrypt backup
   */
  private async decryptBackup(encryptedPath: string): Promise<string> {
    const { exec } = require('child_process')
    const decryptedPath = encryptedPath.replace('.enc', '')
    const key = this.config.encryptionKey || process.env.ENCRYPTION_KEY

    if (!key) {
      throw new Error('Encryption key not found')
    }

    return new Promise((resolve, reject) => {
      const command = `openssl enc -d -aes-256-cbc -in "${encryptedPath}" -out "${decryptedPath}" -k "${key}"`

      exec(command, (error: any) => {
        if (error) {
          reject(new Error(`Decryption failed: ${error.message}`))
        } else {
          resolve(decryptedPath)
        }
      })
    })
  }

  /**
   * Generate directory checksum
   */
  private async generateDirectoryChecksum(dirPath: string): Promise<string> {
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256')

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true })

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = join(dirPath, entry.name)
          const content = await fs.readFile(filePath)
          hash.update(content)
        }
      }
    } catch {
      // If directory doesn't exist or can't be read, return empty hash
    }

    return hash.digest('hex')
  }

  /**
   * Check if path should be excluded
   */
  private shouldExclude(relativePath: string): boolean {
    for (const pattern of this.config.excludePatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true
      }
    }
    return false
  }

  /**
   * Simple pattern matching for exclude patterns
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regex = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\//g, '\\/')

    return new RegExp(`^${regex}$`).test(path)
  }

  /**
   * Find backup directory by ID
   */
  private async findBackupDirectory(backupId: string): Promise<string | null> {
    try {
      const entries = await fs.readdir(this.config.backupPath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.includes(backupId)) {
          return join(this.config.backupPath, entry.name)
        }
      }

      return null
    } catch {
      return null
    }
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const entries = await fs.readdir(this.config.backupPath, { withFileTypes: true })
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      for (const entry of entries) {
        if (entry.name.startsWith('backup_')) {
          const fullPath = join(this.config.backupPath, entry.name)
          const stats = await fs.stat(fullPath)

          if (stats.mtime < cutoffDate) {
            await fs.rm(fullPath, { recursive: true, force: true })
            logger.info('Old file backup deleted', { backupName: entry.name })
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old file backups', error as Error)
    }
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
      logger.error('Failed to create file backup directory', error as Error)
    }
  }
}

// Export singleton instance
export const fileBackupService = new FileBackupService()

// Export convenience functions
export async function createFileBackup(): Promise<FileBackupResult> {
  return fileBackupService.createBackup()
}

export async function restoreFileBackup(backupId: string, targetPath?: string): Promise<{ success: boolean; error?: string }> {
  return fileBackupService.restoreBackup(backupId, targetPath)
}

export async function listFileBackups(): Promise<Array<{
  backupId: string
  directory: string
  totalFiles: number
  totalSize: number
  createdAt: Date
  checksum: string
}>> {
  return fileBackupService.listBackups()
}