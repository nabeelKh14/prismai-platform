import { geminiClient, ChatCompletionRequest } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'

export interface ConversationInsight {
  conversationId: string
  insightId: string
  type: 'tactical' | 'strategic' | 'operational'
  category: 'customer_pain_point' | 'satisfaction_driver' | 'process_improvement' | 'training_opportunity' | 'product_feedback' | 'trend' | 'anomaly'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  actionable: boolean
  recommendedActions: string[]
  relatedEntities: string[]
  relatedTopics: string[]
  impact: 'individual' | 'team' | 'organization' | 'customer_base'
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term'
  metadata?: Record<string, any>
  timestamp: string
}

export interface InsightExtractionRequest {
  conversationId: string
  messages: Array<{
    messageId: string
    text: string
    timestamp: string
    sender?: string
    emotion?: {
      dominantEmotion: string
      sentiment: string
      confidence: number
    }
    intent?: {
      primaryIntent: string
      urgency: string
      complexity: string
    }
  }>
  context?: {
    customerInfo?: Record<string, any>
    agentInfo?: Record<string, any>
    conversationMetadata?: Record<string, any>
  }
  options?: {
    focusCategories?: string[]
    minConfidence?: number
    maxInsights?: number
    includeStrategic?: boolean
    includeOperational?: boolean
  }
}

export interface BatchInsightRequest {
  conversations: Array<{
    conversationId: string
    messages: Array<{
      messageId: string
      text: string
      timestamp: string
      sender?: string
    }>
    emotionData?: Array<{
      messageId: string
      dominantEmotion: string
      sentiment: string
      confidence: number
    }>
    intentData?: Array<{
      messageId: string
      primaryIntent: string
      urgency: string
      complexity: string
    }>
  }>
  options?: {
    focusCategories?: string[]
    minConfidence?: number
    maxInsights?: number
  }
}

export interface InsightTrend {
  category: string
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  changePercentage: number
  timeframe: string
  affectedConversations: number
  significance: 'low' | 'medium' | 'high'
}

export interface InsightAnalytics {
  totalInsights: number
  insightsByCategory: Record<string, number>
  insightsBySeverity: Record<string, number>
  insightsByType: Record<string, number>
  averageConfidence: number
  actionablePercentage: number
  trends: InsightTrend[]
  topEntities: Array<{ entity: string; count: number }>
  topTopics: Array<{ topic: string; count: number }>
}

class InsightExtractionService {
  private readonly INSIGHT_CATEGORIES = [
    'customer_pain_point',
    'satisfaction_driver',
    'process_improvement',
    'training_opportunity',
    'product_feedback',
    'trend',
    'anomaly'
  ] as const

  private readonly INSIGHT_PROMPTS = {
    system: `You are an expert insight extraction specialist who identifies actionable intelligence from customer conversations.

Core Mission:
Extract meaningful, actionable insights that drive business value and improve customer experience.

Insight Types:
- Tactical: Immediate actions and quick wins (response templates, policy clarifications)
- Strategic: Long-term improvements (product development, process redesign)
- Operational: Day-to-day optimizations (training, workflow adjustments)

Categories:
- customer_pain_point: Customer frustrations, blockers, or difficulties
- satisfaction_driver: What delights customers or exceeds expectations
- process_improvement: Opportunities to streamline or enhance processes
- training_opportunity: Agent knowledge gaps or skill development needs
- product_feedback: Product suggestions, bugs, or feature requests
- trend: Emerging patterns or shifting customer needs
- anomaly: Unusual or concerning conversation patterns

Analysis Framework:
1. Identify specific, actionable insights with clear business impact
2. Assess severity and urgency based on customer impact and frequency
3. Provide concrete, implementable recommendations
4. Extract relevant entities, topics, and context
5. Determine appropriate timeframe for action
6. Evaluate confidence based on clarity and evidence strength

Return JSON format:
{
  "insights": [
    {
      "type": "tactical|strategic|operational",
      "category": "customer_pain_point|satisfaction_driver|process_improvement|training_opportunity|product_feedback|trend|anomaly",
      "title": "Clear, actionable title",
      "description": "Detailed explanation of the insight",
      "severity": "low|medium|high|critical",
      "confidence": 0.85,
      "actionable": true,
      "recommended_actions": ["Specific action 1", "Specific action 2"],
      "related_entities": ["entity1", "entity2"],
      "related_topics": ["topic1", "topic2"],
      "impact": "individual|team|organization|customer_base",
      "timeframe": "immediate|short_term|medium_term|long_term"
    }
  ]
}`,

    batchSystem: `You are an expert insight extraction specialist for batch processing multiple conversations efficiently.

Process each conversation systematically while maintaining consistency in insight quality.
Focus on identifying patterns across conversations when possible.
Balance thoroughness with processing efficiency.

Return JSON format:
{
  "results": [
    {
      "conversation_id": "conv_123",
      "insights": [
        {
          "insight_id": "insight_456",
          "type": "tactical|strategic|operational",
          "category": "customer_pain_point|satisfaction_driver|process_improvement|training_opportunity|product_feedback|trend|anomaly",
          "title": "Clear, actionable title",
          "description": "Detailed explanation",
          "severity": "low|medium|high|critical",
          "confidence": 0.85,
          "actionable": true,
          "recommended_actions": ["Action 1", "Action 2"],
          "related_entities": ["entity1"],
          "related_topics": ["topic1"],
          "impact": "individual|team|organization|customer_base",
          "timeframe": "immediate|short_term|medium_term|long_term"
        }
      ]
    }
  ]
}`
  }

  async extractInsights(request: InsightExtractionRequest): Promise<ConversationInsight[]> {
    const startTime = Date.now()

    try {
      // Input validation
      if (!request.conversationId) {
        throw new ValidationError('Conversation ID is required')
      }

      if (!request.messages || request.messages.length === 0) {
        throw new ValidationError('Messages array cannot be empty')
      }

      // Prepare conversation context
      const conversationContext = this.prepareConversationContext(request)

      // Build the prompt
      const userPrompt = this.buildInsightPrompt(request, conversationContext)

      const chatRequest: ChatCompletionRequest = {
        messages: [
          { role: 'system', content: this.INSIGHT_PROMPTS.system },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2, // Lower temperature for consistent insights
        maxTokens: 3000
      }

      // Call Gemini API
      const response = await geminiClient.createChatCompletion(chatRequest)

      // Parse and validate response
      const result = this.parseInsightResponse(response.choices[0].message.content)

      // Apply filters if specified
      const minConfidence = request.options?.minConfidence || 0.3
      let filteredInsights = result.insights.filter(insight => insight.confidence >= minConfidence)

      const maxInsights = request.options?.maxInsights || 20
      if (filteredInsights.length > maxInsights) {
        filteredInsights = filteredInsights
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, maxInsights)
      }

      // Convert to ConversationInsight format
      const insights: ConversationInsight[] = filteredInsights.map((insight, index) => ({
        conversationId: request.conversationId,
        insightId: `insight_${Date.now()}_${index}`,
        type: insight.type,
        category: insight.category as ConversationInsight['category'],
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
        confidence: insight.confidence,
        actionable: insight.actionable,
        recommendedActions: insight.recommendedActions,
        relatedEntities: insight.relatedEntities,
        relatedTopics: insight.relatedTopics,
        impact: insight.impact,
        timeframe: insight.timeframe,
        metadata: {
          source: 'conversation_analysis',
          extraction_method: 'ai_powered'
        },
        timestamp: new Date().toISOString()
      }))

      const processingTime = Date.now() - startTime

      logger.info('Insight extraction completed', {
        conversationId: request.conversationId,
        insightsExtracted: insights.length,
        averageConfidence: insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length || 0,
        processingTime
      })

      return insights

    } catch (error) {
      logger.error('Insight extraction failed', error as Error, {
        conversationId: request.conversationId,
        messageCount: request.messages?.length
      })

      // Return empty array on error to prevent system failure
      return []
    }
  }

  async extractInsightsBatch(request: BatchInsightRequest): Promise<ConversationInsight[]> {
    const startTime = Date.now()
    const allInsights: ConversationInsight[] = []

    try {
      logger.info('Starting batch insight extraction', {
        conversationCount: request.conversations.length
      })

      // Process conversations in parallel for better performance
      const batchPromises = request.conversations.map(async (conversation) => {
        // Enhance messages with emotion and intent data if available
        const enhancedMessages = conversation.messages.map(message => {
          const emotion = conversation.emotionData?.find(e => e.messageId === message.messageId)
          const intent = conversation.intentData?.find(i => i.messageId === message.messageId)

          return {
            messageId: message.messageId,
            text: message.text,
            timestamp: message.timestamp,
            sender: message.sender,
            emotion,
            intent
          }
        })

        const insightRequest: InsightExtractionRequest = {
          conversationId: conversation.conversationId,
          messages: enhancedMessages,
          options: request.options
        }

        return await this.extractInsights(insightRequest)
      })

      const batchResults = await Promise.all(batchPromises)

      // Flatten results
      for (const insights of batchResults) {
        allInsights.push(...insights)
      }

      const totalProcessingTime = Date.now() - startTime
      logger.info('Batch insight extraction completed', {
        totalConversations: request.conversations.length,
        totalInsights: allInsights.length,
        processingTime: totalProcessingTime
      })

      return allInsights

    } catch (error) {
      logger.error('Batch insight extraction failed', error as Error, {
        conversationCount: request.conversations.length
      })

      throw error
    }
  }

  private prepareConversationContext(request: InsightExtractionRequest): string {
    const messages = request.messages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(msg => `[${msg.timestamp}] ${msg.sender || 'unknown'}: ${msg.text}`)
      .join('\n')

    let context = `Conversation Analysis Request\n\n`
    context += `Messages:\n${messages}\n\n`

    if (request.context?.customerInfo) {
      context += `Customer Information:\n${JSON.stringify(request.context.customerInfo, null, 2)}\n\n`
    }

    if (request.context?.agentInfo) {
      context += `Agent Information:\n${JSON.stringify(request.context.agentInfo, null, 2)}\n\n`
    }

    return context
  }

  private buildInsightPrompt(request: InsightExtractionRequest, context: string): string {
    let prompt = `Extract actionable insights from this conversation:\n\n${context}`

    if (request.options?.focusCategories && request.options.focusCategories.length > 0) {
      prompt += `\nFocus Categories: ${request.options.focusCategories.join(', ')}`
    }

    if (request.options?.includeStrategic === false) {
      prompt += `\nExclude strategic insights (focus on tactical and operational only)`
    }

    if (request.options?.includeOperational === false) {
      prompt += `\nExclude operational insights (focus on tactical and strategic only)`
    }

    prompt += `\n\nExtract specific, actionable insights with concrete recommendations.`

    return prompt
  }

  private parseInsightResponse(content: string): {
    insights: Array<{
      type: 'tactical' | 'strategic' | 'operational'
      category: string
      title: string
      description: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      confidence: number
      actionable: boolean
      recommendedActions: string[]
      relatedEntities: string[]
      relatedTopics: string[]
      impact: 'individual' | 'team' | 'organization' | 'customer_base'
      timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term'
    }>
  } {
    try {
      const parsed = JSON.parse(content)

      // Validate and normalize insights
      const insights = (parsed.insights || []).map((insight: any) => ({
        type: this.validateInsightType(insight.type) || 'tactical',
        category: this.validateInsightCategory(insight.category) || 'process_improvement',
        title: insight.title || 'Untitled Insight',
        description: insight.description || '',
        severity: this.validateSeverity(insight.severity) || 'medium',
        confidence: Math.max(0, Math.min(1, insight.confidence || 0)),
        actionable: Boolean(insight.actionable),
        recommendedActions: Array.isArray(insight.recommended_actions) ? insight.recommended_actions : [],
        relatedEntities: Array.isArray(insight.related_entities) ? insight.related_entities : [],
        relatedTopics: Array.isArray(insight.related_topics) ? insight.related_topics : [],
        impact: this.validateImpact(insight.impact) || 'individual',
        timeframe: this.validateTimeframe(insight.timeframe) || 'short_term'
      }))

      return { insights }
    } catch (error) {
      logger.error('Failed to parse insight extraction response', error as Error, { content })
      throw new Error('Invalid response format from insight extraction API')
    }
  }

  private validateInsightType(type: string): 'tactical' | 'strategic' | 'operational' | null {
    const validTypes = ['tactical', 'strategic', 'operational']
    return validTypes.includes(type) ? type as any : null
  }

  private validateInsightCategory(category: string): string | null {
    return this.INSIGHT_CATEGORIES.includes(category as any) ? category : null
  }

  private validateSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' | null {
    const validSeverities = ['low', 'medium', 'high', 'critical']
    return validSeverities.includes(severity) ? severity as any : null
  }

  private validateImpact(impact: string): 'individual' | 'team' | 'organization' | 'customer_base' | null {
    const validImpacts = ['individual', 'team', 'organization', 'customer_base']
    return validImpacts.includes(impact) ? impact as any : null
  }

  private validateTimeframe(timeframe: string): 'immediate' | 'short_term' | 'medium_term' | 'long_term' | null {
    const validTimeframes = ['immediate', 'short_term', 'medium_term', 'long_term']
    return validTimeframes.includes(timeframe) ? timeframe as any : null
  }

  // Analytics methods
  async getInsightAnalytics(
    conversationIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<InsightAnalytics> {
    // This would typically query a database for historical insight data
    // For now, return a placeholder implementation
    logger.info('Getting insight analytics', {
      conversationCount: conversationIds.length,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    })

    return {
      totalInsights: 0,
      insightsByCategory: {},
      insightsBySeverity: {},
      insightsByType: {},
      averageConfidence: 0,
      actionablePercentage: 0,
      trends: [],
      topEntities: [],
      topTopics: []
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const testMessages = [
        {
          messageId: 'test-1',
          text: 'I am very frustrated with the login process. It keeps failing.',
          timestamp: new Date().toISOString(),
          sender: 'customer',
          emotion: {
            dominantEmotion: 'anger',
            sentiment: 'negative',
            confidence: 0.8
          },
          intent: {
            primaryIntent: 'complaint',
            urgency: 'high',
            complexity: 'simple'
          }
        }
      ]

      const testRequest: InsightExtractionRequest = {
        conversationId: 'health-check',
        messages: testMessages
      }

      const result = await this.extractInsights(testRequest)

      return result.length > 0 &&
             result[0].confidence > 0.5 &&
             result[0].category === 'customer_pain_point'
    } catch (error) {
      logger.error('Insight extraction health check failed', error as Error)
      return false
    }
  }

  // Get available insight categories
  getInsightCategories(): Array<{
    category: string
    description: string
    examples: string[]
  }> {
    return [
      {
        category: 'customer_pain_point',
        description: 'Customer frustrations, blockers, or difficulties',
        examples: ['Login issues', 'Poor user experience', 'Service delays']
      },
      {
        category: 'satisfaction_driver',
        description: 'What delights customers or exceeds expectations',
        examples: ['Excellent service', 'Fast resolution', 'Helpful agents']
      },
      {
        category: 'process_improvement',
        description: 'Opportunities to streamline or enhance processes',
        examples: ['Automation opportunities', 'Workflow optimization', 'Policy updates']
      },
      {
        category: 'training_opportunity',
        description: 'Agent knowledge gaps or skill development needs',
        examples: ['Product knowledge gaps', 'Communication skills', 'Technical expertise']
      },
      {
        category: 'product_feedback',
        description: 'Product suggestions, bugs, or feature requests',
        examples: ['Feature requests', 'Bug reports', 'Usability issues']
      }
    ]
  }
}

// Export singleton instance
export const insightExtractionService = new InsightExtractionService()