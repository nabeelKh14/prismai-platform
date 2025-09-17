import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

export interface EncryptionKey {
  id: string
  key: Buffer
  iv: Buffer
  algorithm: string
  createdAt: Date
  expiresAt?: Date
  isActive: boolean
}

export interface EncryptedData {
  encrypted: string
  keyId: string
  iv: string
  algorithm: string
  authTag?: string // For GCM mode
}

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32
  private static readonly IV_LENGTH = 16
  private static readonly AUTH_TAG_LENGTH = 16

  private keys: Map<string, EncryptionKey> = new Map()
  private currentKeyId: string

  constructor() {
    // Initialize with a default key
    this.currentKeyId = this.generateKey()
  }

  // Generate a new encryption key
  private generateKey(): string {
    const keyId = randomBytes(16).toString('hex')
    const key = randomBytes(EncryptionService.KEY_LENGTH)
    const iv = randomBytes(EncryptionService.IV_LENGTH)

    const encryptionKey: EncryptionKey = {
      id: keyId,
      key,
      iv,
      algorithm: EncryptionService.ALGORITHM,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      isActive: true
    }

    this.keys.set(keyId, encryptionKey)
    return keyId
  }

  // Encrypt data
  async encrypt(data: string, keyId?: string): Promise<EncryptedData> {
    try {
      const key = keyId ? this.keys.get(keyId) : this.keys.get(this.currentKeyId)

      if (!key) {
        throw new Error('Encryption key not found')
      }

      const cipher = createCipheriv(key.algorithm, key.key, key.iv)
      let encrypted = cipher.update(data, 'utf8', 'hex')
      encrypted += cipher.final('hex')

      let authTag: Buffer | undefined
      if (key.algorithm.includes('gcm')) {
        authTag = (cipher as any).getAuthTag()
      }

      const result: EncryptedData = {
        encrypted,
        keyId: key.id,
        iv: key.iv.toString('hex'),
        algorithm: key.algorithm,
        authTag: authTag?.toString('hex')
      }

      SecurityAudit.logSensitiveAction('data_encrypted', 'system', {
        keyId: key.id,
        algorithm: key.algorithm,
        dataLength: data.length
      })

      return result
    } catch (error) {
      logger.error('Encryption failed', error as Error, { keyId })
      throw error
    }
  }

  // Decrypt data
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      const key = this.keys.get(encryptedData.keyId)

      if (!key) {
        throw new Error('Decryption key not found')
      }

      const decipher = createDecipheriv(
        encryptedData.algorithm,
        key.key,
        Buffer.from(encryptedData.iv, 'hex')
      )

      if (encryptedData.authTag && encryptedData.algorithm.includes('gcm')) {
        (decipher as any).setAuthTag(Buffer.from(encryptedData.authTag, 'hex'))
      }

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      SecurityAudit.logSensitiveAction('data_decrypted', 'system', {
        keyId: key.id,
        algorithm: encryptedData.algorithm
      })

      return decrypted
    } catch (error) {
      logger.error('Decryption failed', error as Error, {
        keyId: encryptedData.keyId,
        algorithm: encryptedData.algorithm
      })
      throw error
    }
  }

  // Encrypt conversation message
  async encryptMessage(message: string, conversationId: string, userId: string): Promise<EncryptedData> {
    const encrypted = await this.encrypt(message)

    logger.info('Message encrypted', {
      conversationId,
      userId,
      keyId: encrypted.keyId,
      algorithm: encrypted.algorithm
    })

    return encrypted
  }

  // Decrypt conversation message
  async decryptMessage(encryptedData: EncryptedData, conversationId: string, userId: string): Promise<string> {
    const decrypted = await this.decrypt(encryptedData)

    logger.info('Message decrypted', {
      conversationId,
      userId,
      keyId: encryptedData.keyId
    })

    return decrypted
  }

  // Generate key from password (for user-specific encryption)
  generateKeyFromPassword(password: string, salt: string): Buffer {
    return scryptSync(password, salt, EncryptionService.KEY_LENGTH)
  }

  // Rotate encryption keys
  async rotateKeys(): Promise<string> {
    try {
      const newKeyId = this.generateKey()

      // Mark old keys as inactive after a grace period
      for (const [keyId, key] of this.keys) {
        if (key.isActive && keyId !== newKeyId) {
          setTimeout(() => {
            key.isActive = false
            logger.info('Encryption key deactivated', { keyId })
          }, 24 * 60 * 60 * 1000) // 24 hours grace period
        }
      }

      this.currentKeyId = newKeyId

      SecurityAudit.logSensitiveAction('encryption_keys_rotated', 'system', {
        newKeyId,
        totalKeys: this.keys.size
      })

      logger.info('Encryption keys rotated', { newKeyId })
      return newKeyId
    } catch (error) {
      logger.error('Key rotation failed', error as Error)
      throw error
    }
  }

  // Get key info (without exposing the actual key)
  getKeyInfo(keyId: string): { id: string; algorithm: string; createdAt: Date; isActive: boolean } | null {
    const key = this.keys.get(keyId)
    if (!key) return null

    return {
      id: key.id,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      isActive: key.isActive
    }
  }

  // List active keys
  getActiveKeys(): Array<{ id: string; algorithm: string; createdAt: Date }> {
    return Array.from(this.keys.values())
      .filter(key => key.isActive)
      .map(key => ({
        id: key.id,
        algorithm: key.algorithm,
        createdAt: key.createdAt
      }))
  }

  // Secure file encryption
  async encryptFile(fileBuffer: Buffer, fileName: string, userId: string): Promise<{
    encrypted: Buffer
    keyId: string
    metadata: {
      originalName: string
      size: number
      hash: string
      encryptedAt: Date
    }
  }> {
    try {
      // Generate file hash for integrity
      const hash = createHash('sha256').update(fileBuffer).digest('hex')

      // Encrypt file data
      const encrypted = await this.encrypt(fileBuffer.toString('base64'))

      // Create encrypted buffer
      const encryptedBuffer = Buffer.from(encrypted.encrypted, 'hex')

      const result = {
        encrypted: encryptedBuffer,
        keyId: encrypted.keyId,
        metadata: {
          originalName: fileName,
          size: fileBuffer.length,
          hash,
          encryptedAt: new Date()
        }
      }

      SecurityAudit.logSensitiveAction('file_encrypted', userId, {
        fileName,
        size: fileBuffer.length,
        keyId: encrypted.keyId
      })

      return result
    } catch (error) {
      logger.error('File encryption failed', error as Error, { fileName, userId })
      throw error
    }
  }

  // Secure file decryption
  async decryptFile(
    encryptedBuffer: Buffer,
    keyId: string,
    metadata: any,
    userId: string
  ): Promise<{
    decrypted: Buffer
    verified: boolean
  }> {
    try {
      const encryptedData: EncryptedData = {
        encrypted: encryptedBuffer.toString('hex'),
        keyId,
        iv: '', // Would need to be stored with file metadata
        algorithm: EncryptionService.ALGORITHM
      }

      const decryptedBase64 = await this.decrypt(encryptedData)
      const decrypted = Buffer.from(decryptedBase64, 'base64')

      // Verify integrity
      const hash = createHash('sha256').update(decrypted).digest('hex')
      const verified = hash === metadata.hash

      if (!verified) {
        logger.warn('File integrity check failed', { fileName: metadata.originalName, userId })
      }

      SecurityAudit.logSensitiveAction('file_decrypted', userId, {
        fileName: metadata.originalName,
        verified
      })

      return { decrypted, verified }
    } catch (error) {
      logger.error('File decryption failed', error as Error, {
        fileName: metadata.originalName,
        userId
      })
      throw error
    }
  }

  // Key management utilities
  async backupKeys(): Promise<string> {
    // In a real implementation, this would securely backup keys to a key management service
    const keyInfo = Array.from(this.keys.entries()).map(([id, key]) => ({
      id,
      algorithm: key.algorithm,
      createdAt: key.createdAt,
      isActive: key.isActive
    }))

    logger.info('Encryption keys backed up', { keyCount: keyInfo.length })
    return JSON.stringify(keyInfo)
  }

  async restoreKeys(backupData: string): Promise<void> {
    try {
      const keyInfo = JSON.parse(backupData)

      // In a real implementation, this would restore keys from secure storage
      // For now, just log the restoration
      logger.info('Encryption keys restored', { keyCount: keyInfo.length })

      SecurityAudit.logSensitiveAction('encryption_keys_restored', 'system', {
        keyCount: keyInfo.length
      })
    } catch (error) {
      logger.error('Key restoration failed', error as Error)
      throw error
    }
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService()

// Utility functions for conversation encryption
export async function encryptConversationMessage(
  message: string,
  conversationId: string,
  userId: string
): Promise<EncryptedData> {
  return encryptionService.encryptMessage(message, conversationId, userId)
}

export async function decryptConversationMessage(
  encryptedData: EncryptedData,
  conversationId: string,
  userId: string
): Promise<string> {
  return encryptionService.decryptMessage(encryptedData, conversationId, userId)
}

// Enhanced database encryption helpers
export async function encryptDatabaseField(value: any, fieldName: string): Promise<string> {
  try {
    const jsonString = JSON.stringify(value)
    const encrypted = await encryptionService.encrypt(jsonString)

    SecurityAudit.logSensitiveAction('database_field_encrypted', 'system', {
      fieldName,
      keyId: encrypted.keyId,
      algorithm: encrypted.algorithm,
    })

    return JSON.stringify(encrypted)
  } catch (error) {
    logger.error('Database field encryption failed', error as Error, { fieldName })
    throw error
  }
}

export async function decryptDatabaseField(encryptedValue: string, fieldName: string): Promise<any> {
  try {
    const encrypted: EncryptedData = JSON.parse(encryptedValue)
    const decrypted = await encryptionService.decrypt(encrypted)

    SecurityAudit.logSensitiveAction('database_field_decrypted', 'system', {
      fieldName,
      keyId: encrypted.keyId,
      algorithm: encrypted.algorithm,
    })

    return JSON.parse(decrypted)
  } catch (error) {
    logger.error('Database field decryption failed', error as Error, { fieldName })
    throw error
  }
}

// Field-level encryption for specific database columns
export class DatabaseEncryption {
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'ssn',
    'credit_card',
    'bank_account',
    'social_security',
    'tax_id',
    'medical_record',
    'personal_info',
    'financial_data',
  ]

  /**
   * Encrypt sensitive fields before database insertion
   */
  static async encryptSensitiveFields(data: Record<string, any>, tableName: string): Promise<Record<string, any>> {
    const encryptedData = { ...data }

    for (const [fieldName, value] of Object.entries(data)) {
      if (this.isSensitiveField(fieldName) && value !== null && value !== undefined) {
        try {
          encryptedData[fieldName] = await encryptDatabaseField(value, `${tableName}.${fieldName}`)
        } catch (error) {
          logger.error('Failed to encrypt sensitive field', error as Error, {
            tableName,
            fieldName,
          })
          // Don't fail the entire operation, but log the error
        }
      }
    }

    return encryptedData
  }

  /**
   * Decrypt sensitive fields after database retrieval
   */
  static async decryptSensitiveFields(data: Record<string, any>, tableName: string): Promise<Record<string, any>> {
    const decryptedData = { ...data }

    for (const [fieldName, value] of Object.entries(data)) {
      if (this.isSensitiveField(fieldName) && value !== null && value !== undefined && typeof value === 'string') {
        try {
          // Check if the field is encrypted (starts with '{')
          if (value.startsWith('{')) {
            decryptedData[fieldName] = await decryptDatabaseField(value, `${tableName}.${fieldName}`)
          }
        } catch (error) {
          logger.error('Failed to decrypt sensitive field', error as Error, {
            tableName,
            fieldName,
          })
          // Keep the encrypted value if decryption fails
        }
      }
    }

    return decryptedData
  }

  /**
   * Check if a field should be encrypted
   */
  static isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase()
    return this.SENSITIVE_FIELDS.some(sensitiveField =>
      lowerFieldName.includes(sensitiveField) ||
      lowerFieldName.endsWith(`_${sensitiveField}`) ||
      lowerFieldName.startsWith(`${sensitiveField}_`)
    )
  }
}

// API response encryption for sensitive data
export class APIResponseEncryption {
  /**
   * Encrypt sensitive fields in API responses
   */
  static async encryptResponseFields(
    response: any,
    sensitivePaths: string[] = []
  ): Promise<any> {
    if (!response || typeof response !== 'object') {
      return response
    }

    const encrypted = { ...response }

    // Encrypt known sensitive paths
    for (const path of sensitivePaths) {
      const value = this.getNestedValue(response, path)
      if (value !== undefined) {
        const encryptedValue = await encryptDatabaseField(value, `api_response.${path}`)
        this.setNestedValue(encrypted, path, encryptedValue)
      }
    }

    // Auto-detect and encrypt sensitive fields
    await this.autoEncryptSensitiveFields(encrypted, 'api_response')

    return encrypted
  }

  /**
   * Decrypt sensitive fields in API responses
   */
  static async decryptResponseFields(
    response: any,
    sensitivePaths: string[] = []
  ): Promise<any> {
    if (!response || typeof response !== 'object') {
      return response
    }

    const decrypted = { ...response }

    // Decrypt known sensitive paths
    for (const path of sensitivePaths) {
      const value = this.getNestedValue(response, path)
      if (value !== undefined && typeof value === 'string' && value.startsWith('{')) {
        try {
          const decryptedValue = await decryptDatabaseField(value, `api_response.${path}`)
          this.setNestedValue(decrypted, path, decryptedValue)
        } catch (error) {
          logger.error('Failed to decrypt API response field', error as Error, { path })
        }
      }
    }

    // Auto-decrypt encrypted fields
    await this.autoDecryptEncryptedFields(decrypted, 'api_response')

    return decrypted
  }

  /**
   * Get nested object value by path
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Set nested object value by path
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      return current[key]
    }, obj)
    target[lastKey] = value
  }

  /**
   * Auto-encrypt sensitive fields in objects
   */
  private static async autoEncryptSensitiveFields(obj: any, context: string): Promise<void> {
    for (const [key, value] of Object.entries(obj)) {
      if (DatabaseEncryption.isSensitiveField(key) && value !== null && value !== undefined) {
        if (typeof value === 'object') {
          await this.autoEncryptSensitiveFields(value, `${context}.${key}`)
        } else {
          obj[key] = await encryptDatabaseField(value, `${context}.${key}`)
        }
      } else if (typeof value === 'object' && value !== null) {
        await this.autoEncryptSensitiveFields(value, `${context}.${key}`)
      }
    }
  }

  /**
   * Auto-decrypt encrypted fields in objects
   */
  private static async autoDecryptEncryptedFields(obj: any, context: string): Promise<void> {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('{')) {
        try {
          obj[key] = await decryptDatabaseField(value, `${context}.${key}`)
        } catch (error) {
          logger.error('Failed to auto-decrypt field', error as Error, { context, key })
        }
      } else if (typeof value === 'object' && value !== null) {
        await this.autoDecryptEncryptedFields(value, `${context}.${key}`)
      }
    }
  }
}

// Environment variable encryption
export class EnvironmentEncryption {
  private static readonly ENCRYPTED_VARS = new Set([
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'API_KEY',
    'ENCRYPTION_KEY',
    'OAUTH_CLIENT_SECRET',
  ])

  /**
   * Encrypt sensitive environment variables
   */
  static async encryptEnvironmentVariables(): Promise<void> {
    for (const [key, value] of Object.entries(process.env)) {
      if (this.ENCRYPTED_VARS.has(key) && value && !this.isEncrypted(value)) {
        try {
          const encrypted = await encryptionService.encrypt(value)
          process.env[key] = JSON.stringify(encrypted)

          logger.info('Environment variable encrypted', { key })
        } catch (error) {
          logger.error('Failed to encrypt environment variable', error as Error, { key })
        }
      }
    }
  }

  /**
   * Decrypt sensitive environment variables
   */
  static async decryptEnvironmentVariables(): Promise<void> {
    for (const [key, value] of Object.entries(process.env)) {
      if (this.ENCRYPTED_VARS.has(key) && value && this.isEncrypted(value)) {
        try {
          const encrypted: EncryptedData = JSON.parse(value)
          process.env[key] = await encryptionService.decrypt(encrypted)

          logger.info('Environment variable decrypted', { key })
        } catch (error) {
          logger.error('Failed to decrypt environment variable', error as Error, { key })
        }
      }
    }
  }

  /**
   * Check if a value is encrypted
   */
  private static isEncrypted(value: string): boolean {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' &&
             parsed.hasOwnProperty('encrypted') &&
             parsed.hasOwnProperty('keyId')
    } catch {
      return false
    }
  }
}

// Key rotation and management
export class KeyRotationManager {
  private static readonly ROTATION_INTERVAL = 30 * 24 * 60 * 60 * 1000 // 30 days

  /**
   * Check if keys need rotation
   */
  static async checkKeyRotation(): Promise<boolean> {
    const activeKeys = encryptionService.getActiveKeys()

    for (const key of activeKeys) {
      const keyAge = Date.now() - key.createdAt.getTime()
      if (keyAge > this.ROTATION_INTERVAL) {
        return true
      }
    }

    return false
  }

  /**
   * Rotate encryption keys
   */
  static async rotateKeys(): Promise<string> {
    try {
      const newKeyId = await encryptionService.rotateKeys()

      // In a production system, you would also need to:
      // 1. Re-encrypt existing data with new keys
      // 2. Update key references in database
      // 3. Notify other services of key rotation

      logger.info('Encryption keys rotated successfully', { newKeyId })
      return newKeyId

    } catch (error) {
      logger.error('Key rotation failed', error as Error)
      throw error
    }
  }

  /**
   * Schedule automatic key rotation
   */
  static scheduleKeyRotation(): void {
    setInterval(async () => {
      try {
        if (await this.checkKeyRotation()) {
          await this.rotateKeys()
        }
      } catch (error) {
        logger.error('Scheduled key rotation failed', error as Error)
      }
    }, 24 * 60 * 60 * 1000) // Check daily
  }
}