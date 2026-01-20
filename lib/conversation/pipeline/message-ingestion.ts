import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'

export type MessageChannel = 'chat' | 'voice' | 'email' | 'social' | 'sms' | 'webhook'

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent'

export interface IngestedMessage {
  id: string
  conversationId: string
  channel: MessageChannel
  content: {
    text?: string
    audio?: Buffer
    attachments?: Array<{
      type: string
      url: string
      filename: string
    }>
  }
  metadata: {
    senderId?: string
    senderName?: string
    timestamp: string
    language?: string
    priority: MessagePriority
    tenantId?: string
    userId?: string
    sessionId?: string
    source?: string
  }
  preprocessing: {
    cleaned: boolean
    normalized: boolean
    languageDetected: boolean
    validated: boolean
  }
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errors?: string[]
  createdAt: string
  processedAt?: string
}

export interface MessageIngestionConfig {
  maxQueueSize: number
  maxRetries: number
  retryDelay: number
  batchSize: number
  enablePreprocessing: boolean
  supportedLanguages: string[]
  maxMessageSize: number
}

export interface MessageIngestionResult {
  success: boolean
  messageId?: string
  errors?: string[]
  warnings?: string[]
}

export class MessageIngestionService {
  private messageQueue: IngestedMessage[] = []
  private processingQueue: Set<string> = new Set()
  private config: Required<MessageIngestionConfig>
  private retryTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(config?: Partial<MessageIngestionConfig>) {
    this.config = {
      maxQueueSize: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 50,
      enablePreprocessing: true,
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
      maxMessageSize: 10 * 1024 * 1024, // 10MB
      ...config
    }
  }

  /**
   * Ingest a single message from any channel
   */
  async ingestMessage(
    conversationId: string,
    channel: MessageChannel,
    content: IngestedMessage['content'],
    metadata: Partial<IngestedMessage['metadata']> = {}
  ): Promise<MessageIngestionResult> {
    try {
      // Validate input
      const validation = this.validateMessage(conversationId, channel, content, metadata)
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        }
      }

      // Create message object
      const message: IngestedMessage = {
        id: this.generateMessageId(),
        conversationId,
        channel,
        content,
        metadata: {
          timestamp: new Date().toISOString(),
          priority: 'normal',
          ...metadata
        },
        preprocessing: {
          cleaned: false,
          normalized: false,
          languageDetected: false,
          validated: true
        },
        status: 'pending',
        createdAt: new Date().toISOString()
      }

      // Preprocess if enabled
      if (this.config.enablePreprocessing) {
        await this.preprocessMessage(message)
      }

      // Add to queue
      this.addToQueue(message)

      logger.info('Message ingested successfully', {
        messageId: message.id,
        conversationId,
        channel,
        priority: message.metadata.priority
      })

      return {
        success: true,
        messageId: message.id,
        warnings: message.errors
      }

    } catch (error) {
      logger.error('Message ingestion failed', error as Error, {
        conversationId,
        channel
      })

      return {
        success: false,
        errors: [(error as Error).message]
      }
    }
  }

  /**
   * Ingest multiple messages in batch
   */
  async ingestBatch(
    messages: Array<{
      conversationId: string
      channel: MessageChannel
      content: IngestedMessage['content']
      metadata?: Partial<IngestedMessage['metadata']>
    }>
  ): Promise<MessageIngestionResult[]> {
    const results: MessageIngestionResult[] = []

    // Process in smaller batches to avoid overwhelming the system
    const batchSize = Math.min(this.config.batchSize, messages.length)
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)
      const batchPromises = batch.map(msg => this.ingestMessage(
        msg.conversationId,
        msg.channel,
        msg.content,
        msg.metadata
      ))

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Get messages from queue for processing
   */
  getMessagesForProcessing(limit?: number): IngestedMessage[] {
    const availableMessages = this.messageQueue
      .filter(msg => msg.status === 'pending')
      .sort((a, b) => {
        // Sort by priority first, then by timestamp
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
        const aPriority = priorityOrder[a.metadata.priority]
        const bPriority = priorityOrder[b.metadata.priority]

        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })

    return availableMessages.slice(0, limit || this.config.batchSize)
  }

  /**
   * Mark message as processed
   */
  markAsProcessed(messageId: string): void {
    const message = this.messageQueue.find(msg => msg.id === messageId)
    if (message) {
      message.status = 'completed'
      message.processedAt = new Date().toISOString()
      this.processingQueue.delete(messageId)
      this.clearRetryTimer(messageId)

      logger.info('Message marked as processed', { messageId })
    }
  }

  /**
   * Mark message as failed and schedule retry
   */
  markAsFailed(messageId: string, error: string): void {
    const message = this.messageQueue.find(msg => msg.id === messageId)
    if (message) {
      message.status = 'failed'
      message.errors = message.errors || []
      message.errors.push(error)
      this.processingQueue.delete(messageId)

      // Schedule retry if under max retries
      if (message.errors.length < this.config.maxRetries) {
        this.scheduleRetry(message)
      } else {
        logger.error('Message permanently failed after max retries', {
          messageId,
          error,
          retryCount: message.errors.length
        })
      }
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
    byChannel: Record<MessageChannel, number>
    byPriority: Record<MessagePriority, number>
  } {
    const stats = {
      total: this.messageQueue.length,
      pending: 0,
      processing: this.processingQueue.size,
      completed: 0,
      failed: 0,
      byChannel: {} as Record<MessageChannel, number>,
      byPriority: {} as Record<MessagePriority, number>
    }

    for (const message of this.messageQueue) {
      stats[message.status]++

      // Count by channel
      stats.byChannel[message.channel] = (stats.byChannel[message.channel] || 0) + 1

      // Count by priority
      stats.byPriority[message.metadata.priority] = (stats.byPriority[message.metadata.priority] || 0) + 1
    }

    return stats
  }

  /**
   * Clean up old completed/failed messages
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number { // 24 hours default
    const cutoffTime = Date.now() - maxAge
    const initialCount = this.messageQueue.length

    this.messageQueue = this.messageQueue.filter(message => {
      const messageTime = new Date(message.createdAt).getTime()
      return messageTime > cutoffTime || message.status === 'pending' || message.status === 'processing'
    })

    const cleanedCount = initialCount - this.messageQueue.length

    if (cleanedCount > 0) {
      logger.info('Cleaned up old messages', { cleanedCount })
    }

    return cleanedCount
  }

  private validateMessage(
    conversationId: string,
    channel: MessageChannel,
    content: IngestedMessage['content'],
    metadata: Partial<IngestedMessage['metadata']>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!conversationId?.trim()) {
      errors.push('Conversation ID is required')
    }

    if (!channel) {
      errors.push('Channel is required')
    }

    // Check if content is empty
    const hasText = content.text?.trim()
    const hasAudio = content.audio && content.audio.length > 0
    const hasAttachments = content.attachments && content.attachments.length > 0

    if (!hasText && !hasAudio && !hasAttachments) {
      errors.push('Message content is required (text, audio, or attachments)')
    }

    // Check message size
    if (content.text && Buffer.byteLength(content.text, 'utf8') > this.config.maxMessageSize) {
      errors.push('Message text exceeds maximum size limit')
    }

    if (content.audio && content.audio.length > this.config.maxMessageSize) {
      errors.push('Audio content exceeds maximum size limit')
    }

    // Validate language if specified
    if (metadata.language && !this.config.supportedLanguages.includes(metadata.language)) {
      errors.push(`Unsupported language: ${metadata.language}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private async preprocessMessage(message: IngestedMessage): Promise<void> {
    try {
      // Clean text content
      if (message.content.text) {
        message.content.text = this.cleanText(message.content.text)
        message.preprocessing.cleaned = true
      }

      // Normalize text
      if (message.content.text) {
        message.content.text = this.normalizeText(message.content.text)
        message.preprocessing.normalized = true
      }

      // Detect language if not provided
      if (message.content.text && !message.metadata.language) {
        message.metadata.language = await this.detectLanguage(message.content.text)
        message.preprocessing.languageDetected = true
      }

      logger.debug('Message preprocessing completed', {
        messageId: message.id,
        preprocessing: message.preprocessing
      })

    } catch (error) {
      logger.error('Message preprocessing failed', error as Error, {
        messageId: message.id
      })

      // Don't fail ingestion due to preprocessing errors
      message.errors = message.errors || []
      message.errors.push(`Preprocessing error: ${(error as Error).message}`)
    }
  }

  private cleanText(text: string): string {
    return text
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove null bytes and control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Trim whitespace
      .trim()
  }

  private normalizeText(text: string): string {
    return text
      // Normalize unicode
      .normalize('NFKC')
      // Convert to lowercase for consistent processing
      .toLowerCase()
      // Remove extra spaces around punctuation
      .replace(/\s*([.,!?;:])\s*/g, '$1 ')
  }

  private async detectLanguage(text: string): Promise<string> {
    // Simple language detection based on common words
    // In production, you might use a proper language detection service
    const commonWords = {
      en: ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of'],
      es: ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no'],
      fr: ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir'],
      de: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich'],
      it: ['il', 'di', 'che', 'e', 'in', 'un', 'per', 'una', 'è', 'la'],
      pt: ['o', 'a', 'de', 'do', 'da', 'em', 'um', 'para', 'é', 'com']
    }

    const words = text.toLowerCase().split(/\s+/)
    const scores: Record<string, number> = {}

    for (const [lang, langWords] of Object.entries(commonWords)) {
      scores[lang] = 0
      for (const word of words) {
        if (langWords.includes(word)) {
          scores[lang]++
        }
      }
    }

    // Return language with highest score, default to English
    const detectedLang = Object.entries(scores).reduce((a, b) =>
      scores[a[0]] > scores[b[0]] ? a : b
    )[0]

    return detectedLang || 'en'
  }

  private addToQueue(message: IngestedMessage): void {
    // Check queue size limit
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      // Remove oldest completed/failed messages to make room
      const removableMessages = this.messageQueue.filter(
        msg => msg.status === 'completed' || msg.status === 'failed'
      )

      if (removableMessages.length > 0) {
        this.messageQueue = this.messageQueue.filter(
          msg => msg.status === 'pending' || msg.status === 'processing'
        )
      } else {
        throw new ValidationError('Message queue is full')
      }
    }

    this.messageQueue.push(message)
  }

  private scheduleRetry(message: IngestedMessage): void {
    const retryCount = message.errors?.length || 0
    const delay = this.config.retryDelay * Math.pow(2, retryCount) // Exponential backoff

    const timer = setTimeout(() => {
      message.status = 'pending'
      this.retryTimers.delete(message.id)
      logger.info('Retrying failed message', {
        messageId: message.id,
        retryCount: retryCount + 1
      })
    }, delay)

    this.retryTimers.set(message.id, timer)
  }

  private clearRetryTimer(messageId: string): void {
    const timer = this.retryTimers.get(messageId)
    if (timer) {
      clearTimeout(timer)
      this.retryTimers.delete(messageId)
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic functionality
      const testResult = await this.ingestMessage(
        'health-check-conversation',
        'chat',
        { text: 'Health check message' },
        { priority: 'low' }
      )

      return testResult.success
    } catch (error) {
      logger.error('Message ingestion health check failed', error as Error)
      return false
    }
  }
}

// Export singleton instance
export const messageIngestionService = new MessageIngestionService()