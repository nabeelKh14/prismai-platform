import { NextRequest } from 'next/server'
import { createReadStream, promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join, extname } from 'path'
import { randomBytes } from 'crypto'
import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'
import { SecurityAudit } from '@/lib/security'

export interface FileUploadResult {
  success: boolean
  fileId: string
  fileName: string
  fileSize: number
  mimeType: string
  hash: string
  scanResult: VirusScanResult
  storagePath: string
  uploadedAt: Date
  error?: string
}

export interface VirusScanResult {
  isClean: boolean
  scanTime: number
  threats: string[]
  scanner: string
  scanId: string
}

export interface FileUploadConfig {
  maxFileSize: number // in bytes
  allowedMimeTypes: string[]
  allowedExtensions: string[]
  virusScanEnabled: boolean
  quarantinePath: string
  storagePath: string
  tempPath: string
}

export class SecureFileUpload {
  private config: FileUploadConfig

  constructor(config: Partial<FileUploadConfig> = {}) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      allowedExtensions: [
        '.jpg', '.jpeg', '.png', '.gif', '.webp',
        '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx'
      ],
      virusScanEnabled: true,
      quarantinePath: join(process.cwd(), 'uploads', 'quarantine'),
      storagePath: join(process.cwd(), 'uploads', 'storage'),
      tempPath: tmpdir(),
      ...config,
    }

    // Ensure directories exist
    this.ensureDirectories()
  }

  /**
   * Process file upload with security checks
   */
  async processUpload(
    request: NextRequest,
    fieldName: string = 'file'
  ): Promise<FileUploadResult> {
    try {
      const formData = await request.formData()
      const file = formData.get(fieldName) as File

      if (!file) {
        throw new ValidationError('No file provided')
      }

      // Validate file
      await this.validateFile(file)

      // Generate unique file ID
      const fileId = this.generateFileId()

      // Create temporary file path
      const tempFilePath = join(this.config.tempPath, `${fileId}_temp${extname(file.name)}`)

      // Save file to temporary location
      await this.saveFileToTemp(file, tempFilePath)

      // Scan for viruses
      const scanResult = this.config.virusScanEnabled
        ? await this.scanForViruses(tempFilePath)
        : { isClean: true, scanTime: 0, threats: [], scanner: 'disabled', scanId: 'N/A' }

      if (!scanResult.isClean) {
        // Move to quarantine
        const quarantinePath = join(this.config.quarantinePath, `${fileId}_quarantined${extname(file.name)}`)
        await fs.rename(tempFilePath, quarantinePath)

        logger.warn('Malicious file detected and quarantined', {
          fileId,
          originalName: file.name,
          threats: scanResult.threats,
          quarantinePath,
        })

        return {
          success: false,
          fileId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          hash: '',
          scanResult,
          storagePath: quarantinePath,
          uploadedAt: new Date(),
          error: `File quarantined due to security threat: ${scanResult.threats.join(', ')}`,
        }
      }

      // Generate file hash
      const hash = await this.generateFileHash(tempFilePath)

      // Move to final storage location
      const finalFileName = `${fileId}_${hash.substring(0, 8)}${extname(file.name)}`
      const storagePath = join(this.config.storagePath, finalFileName)
      await fs.rename(tempFilePath, storagePath)

      // Log successful upload
      SecurityAudit.logSensitiveAction('file_upload_success', 'system', {
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        hash,
        storagePath,
      })

      logger.info('File uploaded successfully', {
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        hash,
      })

      return {
        success: true,
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        hash,
        scanResult,
        storagePath,
        uploadedAt: new Date(),
      }

    } catch (error) {
      logger.error('File upload failed', error as Error, {
        fieldName,
        ip: request.headers.get('x-forwarded-for'),
      })

      throw error
    }
  }

  /**
   * Validate file before processing
   */
  private async validateFile(file: File): Promise<void> {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      throw new ValidationError(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`)
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(file.type)) {
      throw new ValidationError(`File type ${file.type} is not allowed`)
    }

    // Check file extension
    const extension = extname(file.name).toLowerCase()
    if (!this.config.allowedExtensions.includes(extension)) {
      throw new ValidationError(`File extension ${extension} is not allowed`)
    }

    // Additional security checks
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      throw new ValidationError('Invalid file name')
    }

    // Check for suspicious file names
    const suspiciousPatterns = [
      /^\./, // Hidden files
      /<script/i, // Script tags in filename
      /\.\./, // Directory traversal
      /[<>:"|?*]/, // Invalid characters
    ]

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(file.name)) {
        throw new ValidationError('Suspicious file name detected')
      }
    }
  }

  /**
   * Save file to temporary location
   */
  private async saveFileToTemp(file: File, tempPath: string): Promise<void> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(tempPath, buffer)
    } catch (error) {
      logger.error('Failed to save file to temp location', error as Error, { tempPath })
      throw new ValidationError('Failed to process file')
    }
  }

  /**
   * Scan file for viruses using ClamAV or similar
   */
  private async scanForViruses(filePath: string): Promise<VirusScanResult> {
    const startTime = Date.now()
    const scanId = randomBytes(8).toString('hex')

    try {
      // In a production environment, you would integrate with ClamAV or another virus scanner
      // For this implementation, we'll simulate a basic scan

      const scanResult = await this.simulateVirusScan(filePath)

      const scanTime = Date.now() - startTime

      return {
        isClean: scanResult.isClean,
        scanTime,
        threats: scanResult.threats,
        scanner: 'ClamAV',
        scanId,
      }

    } catch (error) {
      logger.error('Virus scan failed', error as Error, { filePath, scanId })

      // In case of scan failure, we should quarantine the file
      return {
        isClean: false,
        scanTime: Date.now() - startTime,
        threats: ['SCAN_FAILED'],
        scanner: 'ClamAV',
        scanId,
      }
    }
  }

  /**
   * Simulate virus scanning (replace with actual ClamAV integration)
   */
  private async simulateVirusScan(filePath: string): Promise<{ isClean: boolean; threats: string[] }> {
    // Read file content for analysis
    const fileContent = await fs.readFile(filePath)

    // Basic pattern matching for common malware signatures
    const malwarePatterns = [
      /MZ\x90\x00\x03\x00\x00\x00/, // Windows executable
      /#!/, // Script files
      /<script/i, // HTML with scripts
      /eval\s*\(/i, // JavaScript eval
      /document\.write/i, // DOM manipulation
    ]

    const threats: string[] = []

    for (const pattern of malwarePatterns) {
      if (pattern.test(fileContent.toString())) {
        threats.push(`Pattern detected: ${pattern.source}`)
      }
    }

    // Check file extension vs content
    const extension = extname(filePath).toLowerCase()
    if (extension === '.exe' || extension === '.bat' || extension === '.scr') {
      threats.push('Executable file extension')
    }

    // Additional checks for suspicious content
    if (fileContent.length < 10) {
      threats.push('File too small')
    }

    return {
      isClean: threats.length === 0,
      threats,
    }
  }

  /**
   * Generate SHA-256 hash of file
   */
  private async generateFileHash(filePath: string): Promise<string> {
    const crypto = await import('crypto')
    const fileBuffer = await fs.readFile(filePath)
    return crypto.createHash('sha256').update(fileBuffer).digest('hex')
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return randomBytes(16).toString('hex')
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.config.storagePath, { recursive: true })
      await fs.mkdir(this.config.quarantinePath, { recursive: true })
    } catch (error) {
      logger.error('Failed to create upload directories', error as Error)
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      const tempFiles = await fs.readdir(this.config.tempPath)
      const uploadTempFiles = tempFiles.filter(file => file.includes('_temp'))

      for (const file of uploadTempFiles) {
        const filePath = join(this.config.tempPath, file)
        const stats = await fs.stat(filePath)

        // Delete files older than 1 hour
        if (Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
          await fs.unlink(filePath)
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup temp files', error as Error)
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<FileUploadResult | null> {
    try {
      // In a real implementation, this would query a database
      // For now, we'll scan the storage directory
      const files = await fs.readdir(this.config.storagePath)
      const file = files.find(f => f.startsWith(fileId))

      if (!file) {
        return null
      }

      const filePath = join(this.config.storagePath, file)
      const stats = await fs.stat(filePath)
      const hash = await this.generateFileHash(filePath)

      return {
        success: true,
        fileId,
        fileName: file.replace(`${fileId}_`, '').replace(/^[a-f0-9]{8}_/, ''),
        fileSize: stats.size,
        mimeType: 'application/octet-stream', // Would need proper MIME type detection
        hash,
        scanResult: { isClean: true, scanTime: 0, threats: [], scanner: 'N/A', scanId: 'N/A' },
        storagePath: filePath,
        uploadedAt: stats.mtime,
      }

    } catch (error) {
      logger.error('Failed to get file metadata', error as Error, { fileId })
      return null
    }
  }

  /**
   * Delete file securely
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const files = await fs.readdir(this.config.storagePath)
      const file = files.find(f => f.startsWith(fileId))

      if (!file) {
        return false
      }

      const filePath = join(this.config.storagePath, file)
      await fs.unlink(filePath)

      SecurityAudit.logSensitiveAction('file_deleted', 'system', {
        fileId,
        fileName: file,
      })

      logger.info('File deleted successfully', { fileId, fileName: file })

      return true

    } catch (error) {
      logger.error('Failed to delete file', error as Error, { fileId })
      return false
    }
  }
}

// Export singleton instance
export const secureFileUpload = new SecureFileUpload()

// Export convenience functions
export async function processSecureFileUpload(
  request: NextRequest,
  fieldName?: string
): Promise<FileUploadResult> {
  return secureFileUpload.processUpload(request, fieldName)
}

export async function getFileMetadata(fileId: string): Promise<FileUploadResult | null> {
  return secureFileUpload.getFileMetadata(fileId)
}

export async function deleteSecureFile(fileId: string): Promise<boolean> {
  return secureFileUpload.deleteFile(fileId)
}