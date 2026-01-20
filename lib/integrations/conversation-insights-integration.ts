import { conversationSummarizationService } from '@/lib/ai/conversation-summarizer'
import { insightExtractionService } from '@/lib/ai/insight-extractor'
import { conversationPatternAnalysisService } from '@/lib/analytics/conversation-patterns'
import { emotionDetectionService } from '@/lib/ai/emotion-detection'
import { intentClassificationService } from '@/lib/ai/intent-classifier'
import { logger } from '@/lib/logger'

export interface ConversationData {
  conversationId: string
  messages: Array<{
    messageId: string
    text: string
    timestamp: string
    sender?: 'agent' | 'customer' | 'system'
    metadata?: Record<string, any>
  }>
  metadata?: {
    tenantId?: string
    agentId?: string
    customerId?: string
    channel?: string
    tags?: string[]
  }
}

export interface IntegratedAnalysisResult {
  conversationId: string
  summary?: Awaited<ReturnType<typeof conversationSummarizationService.summarizeConversation>>
  insights?: Awaited<ReturnType<typeof insightExtractionService.extractInsights>>
  emotionAnalysis?: Awaited<ReturnType<typeof emotionDetectionService.detectEmotions>>
  intentAnalysis?: Awaited<ReturnType<typeof intentClassificationService.classifyIntent>>
  qualityScore?: number
  processingTime: number
  timestamp: string
}

export interface BatchIntegrationRequest {
  conversations: ConversationData[]
  options?: {
    includeEmotions?: boolean
    includeIntents?: boolean
    includeSummary?: boolean
    includeInsights?: boolean
    includePatterns?: boolean
    qualityScoring?: boolean
  }
}

class ConversationInsightsIntegrationService {
  /**
   * Perform comprehensive analysis of a single conversation
   * Integrates all AI services for complete conversation understanding
   */
  async analyzeConversationComprehensive(data: ConversationData): Promise<IntegratedAnalysisResult> {
    const startTime = Date.now()

    try {
      logger.info('Starting comprehensive conversation analysis', {
        conversationId: data.conversationId,
        messageCount: data.messages.length
      })

      // Run all analyses in parallel for better performance
      const analysisPromises = []

      // Emotion analysis for each message
      if (data.messages.length > 0) {
        const emotionPromises = data.messages.map(message =>
          emotionDetectionService.detectEmotions({
            text: message.text,
            conversationId: data.conversationId,
            messageId: message.messageId,
            language: 'en' // Could be enhanced to detect language
          })
        )
        analysisPromises.push(...emotionPromises)

        // Intent analysis for each message
        const intentPromises = data.messages.map(message =>
          intentClassificationService.classifyIntent({
            text: message.text,
            conversationId: data.conversationId,
            messageId: message.messageId,
            language: 'en'
          })
        )
        analysisPromises.push(...intentPromises)
      }

      // Summary analysis
      const summaryPromise = conversationSummarizationService.summarizeConversation({
        conversationId: data.conversationId,
        messages: data.messages,
        format: 'detailed'
      })
      analysisPromises.push(summaryPromise)

      // Insight extraction
      const insightsPromise = insightExtractionService.extractInsights({
        conversationId: data.conversationId,
        messages: data.messages.map(msg => ({
          messageId: msg.messageId,
          text: msg.text,
          timestamp: msg.timestamp,
          sender: msg.sender
        }))
      })
      analysisPromises.push(insightsPromise)

      // Execute all analyses
      const results = await Promise.all(analysisPromises)

      // Parse results
      const emotionAnalyses = results.slice(0, data.messages.length) as any[]
      const intentAnalyses = results.slice(data.messages.length, data.messages.length * 2) as any[]
      const summary = results[results.length - 2] as any
      const insights = results[results.length - 1] as any[]

      // Calculate overall emotion and intent for the conversation
      const overallEmotion = this.aggregateEmotionAnalysis(emotionAnalyses)
      const overallIntent = this.aggregateIntentAnalysis(intentAnalyses)

      // Calculate quality score based on multiple factors
      const qualityScore = this.calculateQualityScore({
        emotionAnalyses,
        intentAnalyses,
        summary,
        insights
      })

      const processingTime = Date.now() - startTime

      const result: IntegratedAnalysisResult = {
        conversationId: data.conversationId,
        summary,
        insights,
        emotionAnalysis: overallEmotion,
        intentAnalysis: overallIntent,
        qualityScore,
        processingTime,
        timestamp: new Date().toISOString()
      }

      logger.info('Comprehensive conversation analysis completed', {
        conversationId: data.conversationId,
        insightsExtracted: insights.length,
        qualityScore,
        processingTime
      })

      return result

    } catch (error) {
      logger.error('Comprehensive conversation analysis failed', error as Error, {
        conversationId: data.conversationId
      })

      throw error
    }
  }

  /**
   * Process multiple conversations with integrated analysis
   */
  async analyzeConversationsBatch(request: BatchIntegrationRequest): Promise<IntegratedAnalysisResult[]> {
    const startTime = Date.now()

    try {
      logger.info('Starting batch integrated conversation analysis', {
        conversationCount: request.conversations.length
      })

      // Process conversations in parallel
      const analysisPromises = request.conversations.map(conversation =>
        this.analyzeConversationComprehensive(conversation)
      )

      const results = await Promise.all(analysisPromises)

      const processingTime = Date.now() - startTime

      logger.info('Batch integrated conversation analysis completed', {
        totalConversations: request.conversations.length,
        totalAnalyses: results.length,
        processingTime
      })

      return results

    } catch (error) {
      logger.error('Batch integrated conversation analysis failed', error as Error, {
        conversationCount: request.conversations.length
      })

      throw error
    }
  }

  /**
   * Hook into existing conversation pipeline for real-time processing
   */
  async processRealTimeConversation(data: ConversationData): Promise<void> {
    try {
      logger.info('Processing real-time conversation for insights', {
        conversationId: data.conversationId,
        messageCount: data.messages.length
      })

      // Run lightweight analysis for real-time processing
      const [emotionAnalysis, intentAnalysis] = await Promise.all([
        emotionDetectionService.detectEmotions({
          text: data.messages[data.messages.length - 1].text,
          conversationId: data.conversationId,
          messageId: data.messages[data.messages.length - 1].messageId
        }),
        intentClassificationService.classifyIntent({
          text: data.messages[data.messages.length - 1].text,
          conversationId: data.conversationId,
          messageId: data.messages[data.messages.length - 1].messageId
        })
      ])

      // Check if conversation needs immediate attention
      if (this.requiresImmediateAttention(emotionAnalysis, intentAnalysis)) {
        logger.warn('Conversation requires immediate attention', {
          conversationId: data.conversationId,
          dominantEmotion: emotionAnalysis.dominantEmotion,
          primaryIntent: intentAnalysis.primaryIntent,
          urgency: intentAnalysis.urgency
        })

        // Could trigger alerts, escalations, or notifications here
      }

      // Store real-time insights for later comprehensive analysis
      await this.storeRealTimeInsights(data, emotionAnalysis, intentAnalysis)

    } catch (error) {
      logger.error('Real-time conversation processing failed', error as Error, {
        conversationId: data.conversationId
      })
    }
  }

  /**
   * Integrate with quality scoring system
   */
  async enhanceQualityScoring(conversationId: string, existingScore?: number): Promise<number> {
    try {
      // Get conversation insights
      const insights = await insightExtractionService.extractInsights({
        conversationId,
        messages: [] // Would be populated from database
      })

      // Get conversation summary
      const summary = await conversationSummarizationService.summarizeConversation({
        conversationId,
        messages: [] // Would be populated from database
      })

      // Calculate enhanced quality score
      const enhancedScore = this.calculateQualityScore({
        emotionAnalyses: [], // Would be populated from database
        intentAnalyses: [], // Would be populated from database
        summary,
        insights
      })

      logger.info('Quality scoring enhanced with insights', {
        conversationId,
        originalScore: existingScore,
        enhancedScore,
        improvement: existingScore ? enhancedScore - existingScore : 0
      })

      return enhancedScore

    } catch (error) {
      logger.error('Quality scoring enhancement failed', error as Error, {
        conversationId
      })

      return existingScore || 0
    }
  }

  /**
   * Generate agent performance insights
   */
  async generateAgentPerformanceInsights(
    agentId: string,
    tenantId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<any> {
    try {
      // Get conversation patterns for the agent
      const patterns = await conversationPatternAnalysisService.analyzePatterns({
        tenantId,
        timeRange,
        filters: { agentIds: [agentId] }
      })

      // Get insights related to the agent
      const insights = await insightExtractionService.getInsightAnalytics(
        [], // conversationIds - would be populated from database
        timeRange.startDate,
        timeRange.endDate
      )

      // Analyze agent performance trends
      const performanceMetrics = {
        totalConversations: 0, // Would be calculated from database
        averageQualityScore: 0,
        improvementAreas: [] as string[],
        strengths: [] as string[],
        recommendations: [] as string[]
      }

      logger.info('Agent performance insights generated', {
        agentId,
        patternsAnalyzed: patterns.length,
        insightsFound: Object.keys(insights.insightsByCategory).length
      })

      return performanceMetrics

    } catch (error) {
      logger.error('Agent performance insights generation failed', error as Error, {
        agentId,
        tenantId
      })

      throw error
    }
  }

  // Helper methods

  private aggregateEmotionAnalysis(analyses: any[]): any {
    if (analyses.length === 0) return null

    // Calculate average confidence and most common emotions
    const emotionCounts: Record<string, number> = {}
    let totalConfidence = 0

    for (const analysis of analyses) {
      totalConfidence += analysis.confidence
      for (const emotion of analysis.emotions) {
        emotionCounts[emotion.emotion] = (emotionCounts[emotion.emotion] || 0) + 1
      }
    }

    const dominantEmotion = Object.entries(emotionCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'neutral'

    return {
      conversationId: analyses[0].conversationId,
      emotions: analyses.flatMap(a => a.emotions),
      dominantEmotion,
      overallSentiment: analyses[analyses.length - 1].overallSentiment, // Use final sentiment
      confidence: totalConfidence / analyses.length,
      language: analyses[0].language,
      processingTime: analyses.reduce((sum, a) => sum + a.processingTime, 0),
      timestamp: new Date().toISOString()
    }
  }

  private aggregateIntentAnalysis(analyses: any[]): any {
    if (analyses.length === 0) return null

    // Calculate most common intents and urgency levels
    const intentCounts: Record<string, number> = {}
    const urgencyCounts: Record<string, number> = { low: 0, medium: 0, high: 0 }
    let totalConfidence = 0

    for (const analysis of analyses) {
      totalConfidence += analysis.confidence
      intentCounts[analysis.primaryIntent] = (intentCounts[analysis.primaryIntent] || 0) + 1
      urgencyCounts[analysis.urgency] = (urgencyCounts[analysis.urgency] || 0) + 1
    }

    const primaryIntent = Object.entries(intentCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'off_topic'

    return {
      conversationId: analyses[0].conversationId,
      intents: analyses.flatMap(a => a.intents),
      primaryIntent,
      secondaryIntent: analyses[analyses.length - 1].secondaryIntent, // Use final secondary intent
      entities: analyses.flatMap(a => Object.entries(a.entities)).reduce((acc, [k, v]) => {
        acc[k] = [...(acc[k] || []), ...(v as string[])]
        return acc
      }, {} as Record<string, string[]>),
      contextKeywords: [...new Set(analyses.flatMap(a => a.contextKeywords))],
      urgency: Object.entries(urgencyCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'low',
      complexity: analyses[analyses.length - 1].complexity, // Use final complexity
      confidence: totalConfidence / analyses.length,
      language: analyses[0].language,
      processingTime: analyses.reduce((sum, a) => sum + a.processingTime, 0),
      timestamp: new Date().toISOString()
    }
  }

  private calculateQualityScore(data: {
    emotionAnalyses: any[]
    intentAnalyses: any[]
    summary: any
    insights: any[]
  }): number {
    let score = 50 // Base score

    // Factor in sentiment (positive sentiment increases score)
    if (data.emotionAnalyses.length > 0) {
      const finalSentiment = data.emotionAnalyses[data.emotionAnalyses.length - 1]
      if (finalSentiment.overallSentiment === 'positive') score += 20
      else if (finalSentiment.overallSentiment === 'negative') score -= 15
    }

    // Factor in intent resolution
    if (data.intentAnalyses.length > 0) {
      const finalIntent = data.intentAnalyses[data.intentAnalyses.length - 1]
      if (finalIntent.primaryIntent === 'appreciation') score += 15
      else if (finalIntent.urgency === 'low') score += 5
      else if (finalIntent.urgency === 'high') score -= 10
    }

    // Factor in summary confidence
    if (data.summary && data.summary.confidence > 0.7) score += 10
    else if (data.summary && data.summary.confidence < 0.4) score -= 10

    // Factor in actionable insights
    const actionableInsights = data.insights.filter(i => i.actionable)
    score += Math.min(actionableInsights.length * 3, 15) // Max 15 points for insights

    return Math.max(0, Math.min(100, score)) // Clamp between 0-100
  }

  private requiresImmediateAttention(emotion: any, intent: any): boolean {
    return (
      emotion.overallSentiment === 'negative' && emotion.confidence > 0.7
    ) || (
      intent.urgency === 'high' && intent.confidence > 0.7
    ) || (
      emotion.dominantEmotion === 'anger' && emotion.confidence > 0.8
    )
  }

  private async storeRealTimeInsights(
    conversation: ConversationData,
    emotion: any,
    intent: any
  ): Promise<void> {
    // This would store real-time insights in a cache or database
    // for later retrieval and comprehensive analysis
    logger.debug('Storing real-time insights', {
      conversationId: conversation.conversationId,
      dominantEmotion: emotion.dominantEmotion,
      primaryIntent: intent.primaryIntent
    })
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const testConversation: ConversationData = {
        conversationId: 'integration-health-check',
        messages: [
          {
            messageId: 'test-1',
            text: 'I need help with my account login issue.',
            timestamp: new Date().toISOString(),
            sender: 'customer'
          }
        ]
      }

      const result = await this.analyzeConversationComprehensive(testConversation)

      return (result.qualityScore ?? 0) > 0 && result.processingTime < 30000 // Less than 30 seconds
    } catch (error) {
      logger.error('Integration service health check failed', error as Error)
      return false
    }
  }
}

// Export singleton instance
export const conversationInsightsIntegrationService = new ConversationInsightsIntegrationService()