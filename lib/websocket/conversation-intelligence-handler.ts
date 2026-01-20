import { logger } from '@/lib/logger'
import { emotionDetectionService } from '@/lib/ai/emotion-detection'
import { intentClassificationService } from '@/lib/ai/intent-classifier'

export interface ConversationIntelligenceMessage {
  type: 'conversation_analysis' | 'batch_analysis' | 'realtime_update'
  conversationId: string
  messageId?: string
  text?: string
  tenantId?: string
  userId?: string
  timestamp: string
}

export interface ConversationIntelligenceResponse {
  type: 'analysis_result' | 'error' | 'status'
  conversationId: string
  messageId?: string
  emotion?: any
  intent?: any
  error?: string
  timestamp: string
}

export class ConversationIntelligenceHandler {
  private activeAnalyses: Map<string, AbortController> = new Map()

  async handleMessage(message: ConversationIntelligenceMessage): Promise<ConversationIntelligenceResponse> {
    const startTime = Date.now()

    try {
      logger.info('Processing conversation intelligence message', {
        type: message.type,
        conversationId: message.conversationId,
        messageId: message.messageId
      })

      switch (message.type) {
        case 'conversation_analysis':
          return await this.handleConversationAnalysis(message)

        case 'batch_analysis':
          return await this.handleBatchAnalysis(message)

        case 'realtime_update':
          return await this.handleRealtimeUpdate(message)

        default:
          throw new Error(`Unknown message type: ${message.type}`)
      }

    } catch (error) {
      logger.error('Conversation intelligence message handling failed', error as Error, {
        type: message.type,
        conversationId: message.conversationId
      })

      return {
        type: 'error',
        conversationId: message.conversationId,
        messageId: message.messageId,
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      }
    }
  }

  private async handleConversationAnalysis(message: ConversationIntelligenceMessage): Promise<ConversationIntelligenceResponse> {
    if (!message.text) {
      throw new Error('Text content is required for conversation analysis')
    }

    // Cancel any existing analysis for this conversation
    this.cancelAnalysis(message.conversationId)

    // Create abort controller for this analysis
    const abortController = new AbortController()
    this.activeAnalyses.set(message.conversationId, abortController)

    try {
      // Run emotion and intent analysis in parallel
      const [emotionAnalysis, intentAnalysis] = await Promise.all([
        emotionDetectionService.detectEmotions({
          text: message.text,
          conversationId: message.conversationId,
          messageId: message.messageId,
          language: 'en'
        }),
        intentClassificationService.classifyIntent({
          text: message.text,
          conversationId: message.conversationId,
          messageId: message.messageId,
          language: 'en'
        })
      ])

      return {
        type: 'analysis_result',
        conversationId: message.conversationId,
        messageId: message.messageId,
        emotion: emotionAnalysis,
        intent: intentAnalysis,
        timestamp: new Date().toISOString()
      }

    } finally {
      this.activeAnalyses.delete(message.conversationId)
    }
  }

  private async handleBatchAnalysis(message: ConversationIntelligenceMessage): Promise<ConversationIntelligenceResponse> {
    // For batch analysis, we would typically process multiple conversations
    // This is a placeholder implementation
    logger.info('Batch analysis requested', {
      conversationId: message.conversationId,
      tenantId: message.tenantId
    })

    return {
      type: 'status',
      conversationId: message.conversationId,
      error: 'Batch analysis not implemented in WebSocket handler',
      timestamp: new Date().toISOString()
    }
  }

  private async handleRealtimeUpdate(message: ConversationIntelligenceMessage): Promise<ConversationIntelligenceResponse> {
    // Handle real-time updates for ongoing conversations
    if (!message.text) {
      throw new Error('Text content is required for realtime update')
    }

    logger.info('Processing realtime conversation update', {
      conversationId: message.conversationId,
      textLength: message.text.length
    })

    // Run quick analysis for real-time updates
    const [emotionAnalysis, intentAnalysis] = await Promise.all([
      emotionDetectionService.detectEmotions({
        text: message.text,
        conversationId: message.conversationId,
        messageId: message.messageId,
        language: 'en',
        options: { minConfidence: 0.5 } // Higher confidence threshold for real-time
      }),
      intentClassificationService.classifyIntent({
        text: message.text,
        conversationId: message.conversationId,
        messageId: message.messageId,
        language: 'en',
        options: { minConfidence: 0.5 } // Higher confidence threshold for real-time
      })
    ])

    return {
      type: 'analysis_result',
      conversationId: message.conversationId,
      messageId: message.messageId,
      emotion: emotionAnalysis,
      intent: intentAnalysis,
      timestamp: new Date().toISOString()
    }
  }

  private cancelAnalysis(conversationId: string): void {
    const controller = this.activeAnalyses.get(conversationId)
    if (controller) {
      controller.abort()
      this.activeAnalyses.delete(conversationId)
      logger.info('Cancelled existing analysis', { conversationId })
    }
  }

  // Get active analysis status
  getActiveAnalyses(): Array<{ conversationId: string, startTime: Date }> {
    return Array.from(this.activeAnalyses.entries()).map(([conversationId, controller]) => ({
      conversationId,
      startTime: new Date() // In a real implementation, track actual start time
    }))
  }

  // Cancel all active analyses
  cancelAllAnalyses(): void {
    for (const [conversationId, controller] of this.activeAnalyses.entries()) {
      controller.abort()
      logger.info('Cancelled analysis', { conversationId })
    }
    this.activeAnalyses.clear()
  }
}

// Export singleton instance
export const conversationIntelligenceHandler = new ConversationIntelligenceHandler()