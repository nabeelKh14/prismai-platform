import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'

export interface PrivacySettings {
  enableAnonymization: boolean
  requireConsent: boolean
  dataRetentionDays: number
  allowedEmotions: string[]
  allowedIntents: string[]
  maskPersonalData: boolean
}

export interface ConsentRecord {
  conversationId: string
  userId: string
  tenantId: string
  consentGiven: boolean
  consentTimestamp: string
  consentVersion: string
  ipAddress?: string
  userAgent?: string
}

export interface AnonymizationResult {
  originalText: string
  anonymizedText: string
  entitiesRemoved: string[]
  personalDataMasked: boolean
}

export class ConversationPrivacyService {
  private readonly DEFAULT_SETTINGS: PrivacySettings = {
    enableAnonymization: false,
    requireConsent: false,
    dataRetentionDays: 90,
    allowedEmotions: ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'anticipation', 'trust'],
    allowedIntents: ['inquiry', 'complaint', 'purchase_intent', 'support_request', 'feedback'],
    maskPersonalData: true
  }

  // Personal data patterns for anonymization
  private readonly PERSONAL_DATA_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(\+\d{1,3}[- ]?)?\d{10}|\(\d{3}\)\d{3}[- ]?\d{4}|\d{3}[- ]?\d{3}[- ]?\d{4}/g,
    ssn: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,
    creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Simple name pattern
    address: /\d+ [A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl|Court|Ct)\b/g
  }

  async getPrivacySettings(tenantId: string): Promise<PrivacySettings> {
    // In a real implementation, this would fetch from database
    // For now, return default settings
    logger.info('Retrieving privacy settings', { tenantId })

    return { ...this.DEFAULT_SETTINGS }
  }

  async updatePrivacySettings(
    tenantId: string,
    settings: Partial<PrivacySettings>,
    updatedBy: string
  ): Promise<PrivacySettings> {
    logger.info('Updating privacy settings', {
      tenantId,
      updatedBy,
      changes: Object.keys(settings)
    })

    const currentSettings = await this.getPrivacySettings(tenantId)
    const newSettings = { ...currentSettings, ...settings }

    // Validate settings
    this.validatePrivacySettings(newSettings)

    // In a real implementation, save to database
    // await this.savePrivacySettings(tenantId, newSettings, updatedBy)

    return newSettings
  }

  async recordConsent(consent: ConsentRecord): Promise<void> {
    logger.info('Recording conversation analysis consent', {
      conversationId: consent.conversationId,
      userId: consent.userId,
      tenantId: consent.tenantId,
      consentGiven: consent.consentGiven
    })

    // Validate consent record
    if (!consent.conversationId || !consent.userId || !consent.tenantId) {
      throw new ValidationError('Conversation ID, user ID, and tenant ID are required for consent record')
    }

    // In a real implementation, store in database
    // await this.storeConsentRecord(consent)

    // Log for audit purposes
    logger.info('Consent recorded successfully', {
      conversationId: consent.conversationId,
      consentGiven: consent.consentGiven,
      timestamp: consent.consentTimestamp
    })
  }

  async checkConsent(
    conversationId: string,
    userId: string,
    tenantId: string
  ): Promise<boolean> {
    const settings = await this.getPrivacySettings(tenantId)

    if (!settings.requireConsent) {
      return true // Consent not required
    }

    // In a real implementation, check database for consent record
    // const consentRecord = await this.getConsentRecord(conversationId, userId, tenantId)

    // For now, assume consent is given if not required
    logger.info('Checking consent for conversation analysis', {
      conversationId,
      userId,
      tenantId,
      consentRequired: settings.requireConsent
    })

    return true // Placeholder - implement actual consent checking
  }

  async anonymizeText(text: string, settings?: PrivacySettings): Promise<AnonymizationResult> {
    const startTime = Date.now()

    try {
      logger.info('Anonymizing conversation text', {
        textLength: text.length,
        enableAnonymization: settings?.enableAnonymization
      })

      if (!settings?.enableAnonymization) {
        return {
          originalText: text,
          anonymizedText: text,
          entitiesRemoved: [],
          personalDataMasked: false
        }
      }

      let anonymizedText = text
      const entitiesRemoved: string[] = []
      let personalDataMasked = false

      // Apply personal data masking if enabled
      if (settings.maskPersonalData) {
        for (const [entityType, pattern] of Object.entries(this.PERSONAL_DATA_PATTERNS)) {
          const matches = text.match(pattern)
          if (matches) {
            entitiesRemoved.push(...matches)
            anonymizedText = anonymizedText.replace(pattern, `[${entityType.toUpperCase()}_MASKED]`)
            personalDataMasked = true
          }
        }
      }

      const processingTime = Date.now() - startTime

      logger.info('Text anonymization completed', {
        originalLength: text.length,
        anonymizedLength: anonymizedText.length,
        entitiesRemoved: entitiesRemoved.length,
        personalDataMasked,
        processingTime
      })

      return {
        originalText: text,
        anonymizedText,
        entitiesRemoved,
        personalDataMasked
      }

    } catch (error) {
      logger.error('Text anonymization failed', error as Error, {
        textLength: text.length
      })

      throw error
    }
  }

  async anonymizeEmotionData(
    emotionData: any,
    settings: PrivacySettings
  ): Promise<any> {
    if (!settings.enableAnonymization) {
      return emotionData
    }

    // Filter out non-allowed emotions
    const filteredEmotions = emotionData.emotions?.filter((emotion: any) =>
      settings.allowedEmotions.includes(emotion.emotion)
    ) || []

    return {
      ...emotionData,
      emotions: filteredEmotions,
      dominantEmotion: filteredEmotions.length > 0
        ? filteredEmotions.reduce((prev: any, current: any) =>
            prev.confidence > current.confidence ? prev : current
          ).emotion
        : 'neutral',
      anonymized: true,
      allowedEmotions: settings.allowedEmotions
    }
  }

  async anonymizeIntentData(
    intentData: any,
    settings: PrivacySettings
  ): Promise<any> {
    if (!settings.enableAnonymization) {
      return intentData
    }

    // Filter out non-allowed intents
    const filteredIntents = intentData.intents?.filter((intent: any) =>
      settings.allowedIntents.includes(intent.intent)
    ) || []

    return {
      ...intentData,
      intents: filteredIntents,
      primaryIntent: filteredIntents.length > 0 ? filteredIntents[0].intent : 'off_topic',
      anonymized: true,
      allowedIntents: settings.allowedIntents
    }
  }

  async validateDataRetention(tenantId: string): Promise<{
    totalRecords: number
    expiredRecords: number
    retentionDays: number
  }> {
    const settings = await this.getPrivacySettings(tenantId)

    logger.info('Validating data retention policy', {
      tenantId,
      retentionDays: settings.dataRetentionDays
    })

    // In a real implementation, query database for records older than retention period
    // const { totalRecords, expiredRecords } = await this.checkExpiredRecords(tenantId, settings.dataRetentionDays)

    // Placeholder return
    return {
      totalRecords: 0,
      expiredRecords: 0,
      retentionDays: settings.dataRetentionDays
    }
  }

  async deleteExpiredData(tenantId: string): Promise<{
    deletedEmotions: number
    deletedIntents: number
    deletedInsights: number
  }> {
    const settings = await this.getPrivacySettings(tenantId)

    logger.info('Deleting expired conversation data', {
      tenantId,
      retentionDays: settings.dataRetentionDays
    })

    // In a real implementation, delete records older than retention period
    // const result = await this.performDataDeletion(tenantId, settings.dataRetentionDays)

    // Placeholder return
    return {
      deletedEmotions: 0,
      deletedIntents: 0,
      deletedInsights: 0
    }
  }

  private validatePrivacySettings(settings: PrivacySettings): void {
    if (settings.dataRetentionDays < 1 || settings.dataRetentionDays > 365) {
      throw new ValidationError('Data retention days must be between 1 and 365')
    }

    if (settings.allowedEmotions.length === 0) {
      throw new ValidationError('At least one emotion type must be allowed')
    }

    if (settings.allowedIntents.length === 0) {
      throw new ValidationError('At least one intent type must be allowed')
    }

  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const testAnonymization = await this.anonymizeText('Test email: john@example.com and phone: 555-123-4567')

      return testAnonymization.personalDataMasked === true &&
             testAnonymization.entitiesRemoved.length > 0
    } catch (error) {
      logger.error('Privacy service health check failed', error as Error)
      return false
    }
  }
}

// Export singleton instance
export const conversationPrivacyService = new ConversationPrivacyService()