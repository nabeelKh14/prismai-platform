import { logger } from '@/lib/logger'
import { emotionDetectionService, EmotionAnalysis } from '@/lib/ai/emotion-detection'
import { intentClassificationService, IntentAnalysis } from '@/lib/ai/intent-classifier'
import { conversationIntelligenceMonitor } from '@/lib/monitoring/conversation-intelligence-monitor'
import { IngestedMessage, MessageChannel } from './message-ingestion'

export interface ConversationContext {
  conversationId: string
  messages: Array<{
    id: string
    text: string
    timestamp: string
    senderId?: string
    channel: MessageChannel
  }>
  participants: Array<{
    id: string
    name?: string
    role: 'customer' | 'agent' | 'system'
  }>
  metadata: {
    tenantId?: string
    language?: string
    startedAt: string
    lastActivity: string
    messageCount: number
  }
}

export interface ProcessingResult {
  conversationId: string
  messageId: string
  emotion?: EmotionAnalysis
  intent?: IntentAnalysis
  processingTime: number
  timestamp: string
  cached: boolean
  errors?: string[]
}

export interface ConversationAnalysis {
  conversationId: string
  context: ConversationContext
  currentMessage: {
    id: string
    text: string
    timestamp: string
  }
  analysis: {
    emotion: EmotionAnalysis
    intent: IntentAnalysis
  }
  insights: {
    conversationFlow: 'smooth' | 'escalating' | 'resolving' | 'stuck'
    sentimentTrend: 'improving' | 'declining' | 'stable'
    urgencyLevel: 'low' | 'medium' | 'high'
    complexityLevel: 'simple' | 'moderate' | 'complex'
  }
  recommendations: string[]
  processingTime: number
  timestamp: string
}

export interface RealTimeProcessorConfig {
  maxConcurrentAnalyses: number
  cacheEnabled: boolean
  cacheTtl: number
  enableContextAggregation: boolean
  maxContextMessages: number
  performanceTargets: {
    maxProcessingTime: number
    targetP95Latency: number
    targetP99Latency: number
  }
  circuitBreakerThreshold: number
  fallbackToCacheOnError: boolean
}

export class RealTimeProcessor {
  private activeAnalyses: Map<string, AbortController> = new Map()
  private conversationCache: Map<string, { data: any; timestamp: number }> = new Map()
  private processingStats: {
    totalProcessed: number
    cacheHits: number
    averageProcessingTime: number
    errorCount: number
    lastReset: number
  } = {
    totalProcessed: 0,
    cacheHits: 0,
    averageProcessingTime: 0,
    errorCount: 0,
    lastReset: Date.now()
  }

  private config: Required<RealTimeProcessorConfig>

  constructor(config?: Partial<RealTimeProcessorConfig>) {
    this.config = {
      maxConcurrentAnalyses: 100,
      cacheEnabled: true,
      cacheTtl: 5 * 60 * 1000, // 5 minutes
      enableContextAggregation: true,
      maxContextMessages: 50,
      performanceTargets: {
        maxProcessingTime: 100, // 100ms target
        targetP95Latency: 150,
        targetP99Latency: 300
      },
      circuitBreakerThreshold: 0.1, // 10% error rate
      fallbackToCacheOnError: true,
      ...config
    }
  }

  /**
   * Process a single message in real-time
   */
  async processMessage(
    message: IngestedMessage,
    context?: ConversationContext
  ): Promise<ProcessingResult> {
    const startTime = Date.now()

    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = this.getCachedResult(message.id)
        if (cached) {
          this.processingStats.cacheHits++
          return {
            ...cached,
            cached: true,
            processingTime: Date.now() - startTime
          }
        }
      }

      // Check concurrent analysis limit
      if (this.activeAnalyses.size >= this.config.maxConcurrentAnalyses) {
        throw new Error('Maximum concurrent analyses reached')
      }

      // Cancel any existing analysis for this conversation
      this.cancelAnalysis(message.conversationId)

      // Create abort controller
      const abortController = new AbortController()
      this.activeAnalyses.set(message.conversationId, abortController)

      try {
        // Build conversation context if not provided
        const fullContext = context || await this.buildConversationContext(message)

        // Run parallel analysis
        const [emotionResult, intentResult] = await Promise.all([
          this.analyzeEmotion(message, fullContext),
          this.analyzeIntent(message, fullContext)
        ])

        const processingTime = Date.now() - startTime

        // Create result
        const result: ProcessingResult = {
          conversationId: message.conversationId,
          messageId: message.id,
          emotion: emotionResult,
          intent: intentResult,
          processingTime,
          timestamp: new Date().toISOString(),
          cached: false
        }

        // Cache the result
        if (this.config.cacheEnabled) {
          this.cacheResult(message.id, result)
        }

        // Update statistics
        this.updateProcessingStats(processingTime, true)

        // Record success in monitor
        conversationIntelligenceMonitor.recordSuccess(
          message.conversationId,
          message.metadata.tenantId || 'default',
          processingTime,
          emotionResult?.confidence,
          intentResult?.confidence
        )

        logger.info('Real-time message processing completed', {
          conversationId: message.conversationId,
          messageId: message.id,
          processingTime,
          cached: false
        })

        return result

      } finally {
        this.activeAnalyses.delete(message.conversationId)
      }

    } catch (error) {
      const processingTime = Date.now() - startTime
      this.updateProcessingStats(processingTime, false)

      // Record failure in monitor
      conversationIntelligenceMonitor.recordFailure(
        message.conversationId,
        message.metadata.tenantId || 'default',
        error as Error
      )

      logger.error('Real-time message processing failed', error as Error, {
        conversationId: message.conversationId,
        messageId: message.id,
        processingTime
      })

      // Try to return cached result as fallback
      if (this.config.fallbackToCacheOnError) {
        const cached = this.getCachedResult(message.id)
        if (cached) {
          return {
            ...cached,
            cached: true,
            processingTime: Date.now() - startTime,
            errors: [(error as Error).message]
          }
        }
      }

      return {
        conversationId: message.conversationId,
        messageId: message.id,
        processingTime,
        timestamp: new Date().toISOString(),
        cached: false,
        errors: [(error as Error).message]
      }
    }
  }

  /**
   * Process conversation with full context analysis
   */
  async processConversation(
    conversationId: string,
    context: ConversationContext
  ): Promise<ConversationAnalysis> {
    const startTime = Date.now()

    try {
      // Get the latest message from context
      const latestMessage = context.messages[context.messages.length - 1]
      if (!latestMessage) {
        throw new Error('No messages found in conversation context')
      }

      // Create ingested message for processing
      const message: IngestedMessage = {
        id: latestMessage.id,
        conversationId,
        channel: latestMessage.channel,
        content: { text: latestMessage.text },
        metadata: {
          timestamp: latestMessage.timestamp,
          priority: 'normal' as const,
          tenantId: context.metadata.tenantId,
          language: context.metadata.language
        },
        preprocessing: {
          cleaned: true,
          normalized: true,
          languageDetected: true,
          validated: true
        },
        status: 'processing',
        createdAt: latestMessage.timestamp
      }

      // Process the message
      const result = await this.processMessage(message, context)

      if (!result.emotion || !result.intent) {
        throw new Error('Analysis results are incomplete')
      }

      // Generate insights
      const insights = this.generateConversationInsights(context, result)

      const processingTime = Date.now() - startTime

      const analysis: ConversationAnalysis = {
        conversationId,
        context,
        currentMessage: {
          id: latestMessage.id,
          text: latestMessage.text,
          timestamp: latestMessage.timestamp
        },
        analysis: {
          emotion: result.emotion,
          intent: result.intent
        },
        insights,
        recommendations: this.generateRecommendations(insights, result),
        processingTime,
        timestamp: new Date().toISOString()
      }

      logger.info('Conversation analysis completed', {
        conversationId,
        processingTime,
        insights
      })

      return analysis

    } catch (error) {
      logger.error('Conversation analysis failed', error as Error, {
        conversationId,
        processingTime: Date.now() - startTime
      })
      throw error
    }
  }

  /**
   * Process multiple messages in batch for efficiency
   */
  async processBatch(
    messages: IngestedMessage[],
    context?: Map<string, ConversationContext>
  ): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = []
    const semaphore = new Semaphore(this.config.maxConcurrentAnalyses)

    // Process messages with concurrency control
    const batchPromises = messages.map(async (message) => {
      await semaphore.acquire()

      try {
        const messageContext = context?.get(message.conversationId)
        const result = await this.processMessage(message, messageContext)
        results.push(result)
      } finally {
        semaphore.release()
      }
    })

    await Promise.all(batchPromises)
    return results
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    activeAnalyses: number
    cacheSize: number
    totalProcessed: number
    cacheHitRate: number
    averageProcessingTime: number
    errorRate: number
    uptime: number
  } {
    const cacheHitRate = this.processingStats.totalProcessed > 0
      ? this.processingStats.cacheHits / this.processingStats.totalProcessed
      : 0

    const errorRate = this.processingStats.totalProcessed > 0
      ? this.processingStats.errorCount / this.processingStats.totalProcessed
      : 0

    return {
      activeAnalyses: this.activeAnalyses.size,
      cacheSize: this.conversationCache.size,
      totalProcessed: this.processingStats.totalProcessed,
      cacheHitRate,
      averageProcessingTime: this.processingStats.averageProcessingTime,
      errorRate,
      uptime: Date.now() - this.processingStats.lastReset
    }
  }

  /**
   * Cancel analysis for a conversation
   */
  cancelAnalysis(conversationId: string): void {
    const controller = this.activeAnalyses.get(conversationId)
    if (controller) {
      controller.abort()
      this.activeAnalyses.delete(conversationId)
      logger.info('Cancelled real-time analysis', { conversationId })
    }
  }

  /**
   * Clean up old cache entries
   */
  cleanupCache(): number {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, value] of this.conversationCache.entries()) {
      if (now - value.timestamp > this.config.cacheTtl) {
        this.conversationCache.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up cache entries', { cleanedCount })
    }

    return cleanedCount
  }

  private async analyzeEmotion(
    message: IngestedMessage,
    context: ConversationContext
  ): Promise<EmotionAnalysis> {
    const contextMessages = this.config.enableContextAggregation
      ? context.messages.slice(-this.config.maxContextMessages).map(m => m.text)
      : []

    return await emotionDetectionService.detectEmotions({
      text: message.content.text || '',
      conversationId: message.conversationId,
      messageId: message.id,
      language: message.metadata.language,
      context: contextMessages,
      options: {
        minConfidence: 0.3,
        includeIntensity: true
      }
    })
  }

  private async analyzeIntent(
    message: IngestedMessage,
    context: ConversationContext
  ): Promise<IntentAnalysis> {
    const contextMessages = this.config.enableContextAggregation
      ? context.messages.slice(-this.config.maxContextMessages).map(m => m.text)
      : []

    return await intentClassificationService.classifyIntent({
      text: message.content.text || '',
      conversationId: message.conversationId,
      messageId: message.id,
      language: message.metadata.language,
      context: contextMessages,
      options: {
        minConfidence: 0.3,
        includeEntities: true,
        includeContextKeywords: true
      }
    })
  }

  private async buildConversationContext(message: IngestedMessage): Promise<ConversationContext> {
    // In a real implementation, this would fetch conversation history from database
    // For now, return a basic context
    return {
      conversationId: message.conversationId,
      messages: [{
        id: message.id,
        text: message.content.text || '',
        timestamp: message.metadata.timestamp,
        channel: message.channel
      }],
      participants: [
        {
          id: message.metadata.senderId || 'unknown',
          role: 'customer'
        }
      ],
      metadata: {
        tenantId: message.metadata.tenantId,
        language: message.metadata.language,
        startedAt: message.metadata.timestamp,
        lastActivity: message.metadata.timestamp,
        messageCount: 1
      }
    }
  }

  private generateConversationInsights(
    context: ConversationContext,
    result: ProcessingResult
  ): ConversationAnalysis['insights'] {
    // Analyze conversation flow
    const messageCount = context.messages.length
    const timeSpan = Date.now() - new Date(context.metadata.startedAt).getTime()
    const messagesPerMinute = (messageCount / timeSpan) * 60000

    let conversationFlow: ConversationAnalysis['insights']['conversationFlow'] = 'smooth'
    if (messagesPerMinute > 10) conversationFlow = 'escalating'
    if (messagesPerMinute < 1 && timeSpan > 300000) conversationFlow = 'stuck' // 5 minutes

    // Analyze sentiment trend (simplified)
    const sentimentTrend: ConversationAnalysis['insights']['sentimentTrend'] = 'stable'

    // Determine urgency level
    const urgencyLevel: ConversationAnalysis['insights']['urgencyLevel'] =
      result.intent?.urgency === 'high' ? 'high' :
      result.intent?.urgency === 'medium' ? 'medium' : 'low'

    // Determine complexity level
    const complexityLevel: ConversationAnalysis['insights']['complexityLevel'] =
      result.intent?.complexity === 'complex' ? 'complex' :
      result.intent?.complexity === 'moderate' ? 'moderate' : 'simple'

    return {
      conversationFlow,
      sentimentTrend,
      urgencyLevel,
      complexityLevel
    }
  }

  private generateRecommendations(
    insights: ConversationAnalysis['insights'],
    result: ProcessingResult
  ): string[] {
    const recommendations: string[] = []

    if (insights.conversationFlow === 'escalating') {
      recommendations.push('Conversation pace is increasing rapidly - consider assigning to experienced agent')
    }

    if (insights.conversationFlow === 'stuck') {
      recommendations.push('Conversation appears stuck - suggest providing alternative solutions')
    }

    if (insights.urgencyLevel === 'high') {
      recommendations.push('High urgency detected - prioritize immediate response')
    }

    if (insights.complexityLevel === 'complex') {
      recommendations.push('Complex issue detected - may require specialist assistance')
    }

    if (result.emotion?.overallSentiment === 'negative') {
      recommendations.push('Customer showing negative sentiment - focus on empathy and quick resolution')
    }

    if (result.intent?.primaryIntent === 'escalation') {
      recommendations.push('Customer requesting escalation - involve supervisor if needed')
    }

    return recommendations
  }

  private getCachedResult(messageId: string): ProcessingResult | null {
    const cached = this.conversationCache.get(messageId)
    if (cached && Date.now() - cached.timestamp < this.config.cacheTtl) {
      return cached.data as ProcessingResult
    }
    return null
  }

  private cacheResult(messageId: string, result: ProcessingResult): void {
    this.conversationCache.set(messageId, {
      data: result,
      timestamp: Date.now()
    })
  }

  private updateProcessingStats(processingTime: number, success: boolean): void {
    this.processingStats.totalProcessed++

    if (!success) {
      this.processingStats.errorCount++
    }

    // Update rolling average
    const alpha = 0.1 // Smoothing factor
    this.processingStats.averageProcessingTime =
      (1 - alpha) * this.processingStats.averageProcessingTime + alpha * processingTime
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic processing functionality
      const testMessage: IngestedMessage = {
        id: 'health-check',
        conversationId: 'health-check-conversation',
        channel: 'chat',
        content: { text: 'This is a health check message' },
        metadata: {
          timestamp: new Date().toISOString(),
          priority: 'low'
        },
        preprocessing: {
          cleaned: true,
          normalized: true,
          languageDetected: true,
          validated: true
        },
        status: 'processing',
        createdAt: new Date().toISOString()
      }

      const result = await this.processMessage(testMessage)

      return result.processingTime < this.config.performanceTargets.maxProcessingTime
    } catch (error) {
      logger.error('Real-time processor health check failed', error as Error)
      return false
    }
  }
}

// Simple semaphore implementation for concurrency control
class Semaphore {
  private permits: number
  private waiting: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise(resolve => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    this.permits++
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()
      next?.()
    }
  }
}

// Export singleton instance
export const realTimeProcessor = new RealTimeProcessor()