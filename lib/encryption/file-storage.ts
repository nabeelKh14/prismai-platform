import { createReadStream, createWriteStream, promises as fs } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { encryptionService } from './service'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

export interface SecureFileMetadata {
  id: string
  originalName: string
  encryptedName: string
  size: number
  mimeType: string
  hash: string
  keyId: string
  uploadedBy: string
  uploadedAt: Date
  expiresAt?: Date
  accessCount: number
  lastAccessedAt?: Date
  permissions: {
    read: string[]
    write: string[]
    delete: string[]
  }
}

export class SecureFileStorage {
  private storagePath: string
  private metadata: Map<string, SecureFileMetadata> = new Map()

  constructor(storagePath: string = './secure-storage') {
    this.storagePath = storagePath
  }

  // Store encrypted file
  async storeFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    uploadedBy: string,
    permissions: SecureFileMetadata['permissions'] = {
      read: [uploadedBy],
      write: [uploadedBy],
      delete: [uploadedBy]
    }
  ): Promise<SecureFileMetadata> {
    try {
      // Generate unique file ID and encrypted filename
      const fileId = randomBytes(16).toString('hex')
      const encryptedName = `${fileId}.enc`

      // Encrypt the file
      const encryptedResult = await encryptionService.encryptFile(
        fileBuffer,
        originalName,
        uploadedBy
      )

      // Ensure storage directory exists
      await fs.mkdir(this.storagePath, { recursive: true })

      // Write encrypted file to disk
      const filePath = join(this.storagePath, encryptedName)
      await fs.writeFile(filePath, encryptedResult.encrypted)

      // Create metadata
      const metadata: SecureFileMetadata = {
        id: fileId,
        originalName,
        encryptedName,
        size: fileBuffer.length,
        mimeType,
        hash: encryptedResult.metadata.hash,
        keyId: encryptedResult.keyId,
        uploadedBy,
        uploadedAt: new Date(),
        accessCount: 0,
        permissions
      }

      // Store metadata in memory (in production, this would be in database)
      this.metadata.set(fileId, metadata)

      SecurityAudit.logSensitiveAction('file_stored_securely', uploadedBy, {
        fileId,
        originalName,
        size: fileBuffer.length,
        mimeType
      })

      logger.info('File stored securely', {
        fileId,
        originalName,
        uploadedBy,
        size: fileBuffer.length
      })

      return metadata
    } catch (error) {
      logger.error('Failed to store file securely', error as Error, {
        originalName,
        uploadedBy
      })
      throw error
    }
  }

  // Retrieve and decrypt file
  async retrieveFile(
    fileId: string,
    userId: string
  ): Promise<{
    buffer: Buffer
    metadata: SecureFileMetadata
    verified: boolean
  }> {
    try {
      const metadata = this.metadata.get(fileId)
      if (!metadata) {
        throw new Error('File not found')
      }

      // Check read permissions
      if (!metadata.permissions.read.includes(userId) && !metadata.permissions.read.includes('*')) {
        throw new Error('Access denied')
      }

      // Check expiration
      if (metadata.expiresAt && metadata.expiresAt < new Date()) {
        throw new Error('File has expired')
      }

      // Read encrypted file
      const filePath = join(this.storagePath, metadata.encryptedName)
      const encryptedBuffer = await fs.readFile(filePath)

      // Decrypt file
      const decryptedResult = await encryptionService.decryptFile(
        encryptedBuffer,
        metadata.keyId,
        {
          originalName: metadata.originalName,
          size: metadata.size,
          hash: metadata.hash,
          encryptedAt: metadata.uploadedAt
        },
        userId
      )

      // Update access tracking
      metadata.accessCount++
      metadata.lastAccessedAt = new Date()

      SecurityAudit.logDataAccess('secure_file', userId, 'read', {
        fileId,
        originalName: metadata.originalName,
        verified: decryptedResult.verified
      })

      logger.info('File retrieved securely', {
        fileId,
        userId,
        verified: decryptedResult.verified
      })

      return {
        buffer: decryptedResult.decrypted,
        metadata,
        verified: decryptedResult.verified
      }
    } catch (error) {
      logger.error('Failed to retrieve file securely', error as Error, {
        fileId,
        userId
      })
      throw error
    }
  }

  // Delete file securely
  async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      const metadata = this.metadata.get(fileId)
      if (!metadata) {
        throw new Error('File not found')
      }

      // Check delete permissions
      if (!metadata.permissions.delete.includes(userId) && !metadata.permissions.delete.includes('*')) {
        throw new Error('Access denied')
      }

      // Delete encrypted file
      const filePath = join(this.storagePath, metadata.encryptedName)
      await fs.unlink(filePath)

      // Remove metadata
      this.metadata.delete(fileId)

      SecurityAudit.logSensitiveAction('secure_file_deleted', userId, {
        fileId,
        originalName: metadata.originalName
      })

      logger.info('File deleted securely', {
        fileId,
        userId,
        originalName: metadata.originalName
      })
    } catch (error) {
      logger.error('Failed to delete file securely', error as Error, {
        fileId,
        userId
      })
      throw error
    }
  }

  // Update file permissions
  async updatePermissions(
    fileId: string,
    userId: string,
    permissions: Partial<SecureFileMetadata['permissions']>
  ): Promise<void> {
    try {
      const metadata = this.metadata.get(fileId)
      if (!metadata) {
        throw new Error('File not found')
      }

      // Check write permissions
      if (!metadata.permissions.write.includes(userId) && !metadata.permissions.write.includes('*')) {
        throw new Error('Access denied')
      }

      // Update permissions
      metadata.permissions = {
        ...metadata.permissions,
        ...permissions
      }

      SecurityAudit.logSensitiveAction('file_permissions_updated', userId, {
        fileId,
        permissions
      })

      logger.info('File permissions updated', {
        fileId,
        userId,
        permissions
      })
    } catch (error) {
      logger.error('Failed to update file permissions', error as Error, {
        fileId,
        userId
      })
      throw error
    }
  }

  // List files accessible by user
  listFiles(userId: string): SecureFileMetadata[] {
    return Array.from(this.metadata.values())
      .filter(metadata =>
        metadata.permissions.read.includes(userId) ||
        metadata.permissions.read.includes('*') ||
        metadata.uploadedBy === userId
      )
      .map(metadata => ({
        ...metadata,
        // Remove sensitive information
        keyId: undefined as any
      }))
  }

  // Get file metadata
  getFileMetadata(fileId: string, userId: string): SecureFileMetadata | null {
    const metadata = this.metadata.get(fileId)
    if (!metadata) return null

    // Check read permissions
    if (!metadata.permissions.read.includes(userId) &&
        !metadata.permissions.read.includes('*') &&
        metadata.uploadedBy !== userId) {
      return null
    }

    return {
      ...metadata,
      // Remove sensitive information
      keyId: undefined as any
    }
  }

  // Clean up expired files
  async cleanupExpiredFiles(): Promise<number> {
    let cleanedCount = 0

    for (const [fileId, metadata] of this.metadata) {
      if (metadata.expiresAt && metadata.expiresAt < new Date()) {
        try {
          await this.deleteFile(fileId, 'system')
          cleanedCount++
        } catch (error) {
          logger.warn('Failed to cleanup expired file', {
            fileId,
            error: (error as Error).message
          })
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info('Expired files cleaned up', { cleanedCount })
    }

    return cleanedCount
  }

  // Get storage statistics
  getStorageStats(): {
    totalFiles: number
    totalSize: number
    activeKeys: number
  } {
    const files = Array.from(this.metadata.values())
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)

    return {
      totalFiles: files.length,
      totalSize,
      activeKeys: encryptionService.getActiveKeys().length
    }
  }
}

// Export singleton instance
export const secureFileStorage = new SecureFileStorage()

// Utility functions for conversation file attachments
export async function storeConversationFile(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  conversationId: string,
  userId: string
): Promise<SecureFileMetadata> {
  return secureFileStorage.storeFile(
    fileBuffer,
    originalName,
    mimeType,
    userId,
    {
      read: [userId, 'conversation:' + conversationId],
      write: [userId],
      delete: [userId]
    }
  )
}

export async function retrieveConversationFile(
  fileId: string,
  conversationId: string,
  userId: string
): Promise<{
  buffer: Buffer
  metadata: SecureFileMetadata
  verified: boolean
}> {
  // Check if user has access to the conversation
  // This would typically be done by checking conversation permissions

  return secureFileStorage.retrieveFile(fileId, userId)
}