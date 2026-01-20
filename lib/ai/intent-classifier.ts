import { geminiClient, ChatCompletionRequest } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'

export interface IntentScore {
  intent: string
  confidence: number
  entities: Record<string, string[]>
}

export interface IntentAnalysis {
  conversationId: string
  messageId?: string
  intents: IntentScore[]
  primaryIntent: string
  secondaryIntent?: string
  entities: Record<string, string[]>
  contextKeywords: string[]
  urgency: 'low' | 'medium' | 'high'
  complexity: 'simple' | 'moderate' | 'complex'
  confidence: number
  language?: string
  processingTime: number
  timestamp: string
}

export interface IntentClassificationRequest {
  text: string
  conversationId: string
  messageId?: string
  language?: string
  context?: string[]
  previousIntents?: string[]
  options?: {
    includeEntities?: boolean
    includeContextKeywords?: boolean
    minConfidence?: number
    maxIntents?: number
  }
}

export interface BatchIntentRequest {
  conversations: Array<{
    conversationId: string
    messages: Array<{
      messageId: string
      text: string
      timestamp: string
    }>
    language?: string
  }>
  options?: {
    includeEntities?: boolean
    includeContextKeywords?: boolean
    minConfidence?: number
    maxIntents?: number
  }
}

export interface IntentAnalytics {
  intent: string
  count: number
  averageConfidence: number
  trends: Array<{
    date: string
    count: number
    confidence: number
  }>
}

class IntentClassificationService {
  private readonly INTENT_TYPES = [
    'inquiry', 'complaint', 'purchase_intent', 'support_request',
    'feedback', 'booking_request', 'cancellation', 'escalation',
    'information_request', 'problem_solving', 'appreciation',
    'confusion', 'urgency', 'follow_up', 'off_topic'
  ] as const

  private readonly ENTITY_TYPES = [
    'product', 'service', 'person', 'organization', 'location',
    'date', 'time', 'price', 'quantity', 'contact'
  ] as const

  private readonly INTENT_PROMPTS = {
    system: `You are an expert intent classification AI. Analyze conversations to understand customer intentions and extract key information.

Intent Types (choose from):
- inquiry: General questions or information seeking
- complaint: Expressing dissatisfaction or problems
- purchase_intent: Interest in buying or pricing questions
- support_request: Technical or account support needs
- feedback: Opinions, reviews, or suggestions
- booking_request: Appointment or reservation requests
- cancellation: Canceling services or appointments
- escalation: Requesting supervisor or higher-level help
- information_request: Specific information needs
- problem_solving: Working through issues or solutions
- appreciation: Positive feedback or thanks
- confusion: Uncertainty or need for clarification
- urgency: Time-sensitive or emergency situations
- follow_up: Continuing previous conversations
- off_topic: Unrelated to business or service

Analysis Requirements:
- Identify primary intent (highest confidence)
- Include secondary intent if confidence > 0.6
- Extract entities (product, service, person, etc.)
- Identify context keywords for better understanding
- Assess urgency and complexity levels
- Provide confidence scores (0-1) for each intent
- Consider conversation context and flow

Return JSON format:
{
  "intents": [
    {"intent": "support_request", "confidence": 0.85, "entities": {"service": ["technical_support"]}},
    {"intent": "urgency", "confidence": 0.72, "entities": {}}
  ],
  "primary_intent": "support_request",
  "secondary_intent": "urgency",
  "entities": {"service": ["technical_support"], "urgency_indicator": ["asap"]},
  "context_keywords": ["login", "not working", "urgent"],
  "urgency": "high",
  "complexity": "moderate",
  "confidence": 0.78,
  "language": "en"
}`,

    batchSystem: `You are an expert intent classification AI for batch processing. Analyze multiple conversation messages efficiently.

Process each message individually while maintaining context awareness.
Return results in the specified format for each conversation.

Return JSON format:
{
  "results": [
    {
      "conversation_id": "conv_123",
      "message_id": "msg_456",
      "intents": [...],
      "primary_intent": "support_request",
      "entities": {...},
      "context_keywords": [...],
      "urgency": "high",
      "complexity": "moderate",
      "confidence": 0.78
    }
  ]
}`
  }

  async classifyIntent(request: IntentClassificationRequest): Promise<IntentAnalysis> {
    const startTime = Date.now()

    try {
      // Input validation
      if (!request.text?.trim()) {
        throw new ValidationError('Text content is required for intent classification')
      }

      if (!request.conversationId) {
        throw new ValidationError('Conversation ID is required')
      }

      // Prepare the prompt
      const userPrompt = this.buildIntentPrompt(request)

      const chatRequest: ChatCompletionRequest = {
        messages: [
          { role: 'system', content: this.INTENT_PROMPTS.system },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2, // Lower temperature for consistent classification
        maxTokens: 1500
      }

      // Call Gemini API
      const response = await geminiClient.createChatCompletion(chatRequest)

      // Parse and validate response
      const result = this.parseIntentResponse(response.choices[0].message.content)

      // Apply filters if specified
      const minConfidence = request.options?.minConfidence || 0.3
      result.intents = result.intents.filter(i => i.confidence >= minConfidence)

      const maxIntents = request.options?.maxIntents || 5
      if (result.intents.length > maxIntents) {
        result.intents = result.intents
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, maxIntents)
      }

      // Recalculate primary intent if needed
      if (result.intents.length > 0) {
        result.primaryIntent = result.intents[0].intent
        result.secondaryIntent = result.intents.length > 1 ? result.intents[1].intent : undefined
      } else {
        result.primaryIntent = 'off_topic'
      }

      const processingTime = Date.now() - startTime

      const analysis: IntentAnalysis = {
        conversationId: request.conversationId,
        messageId: request.messageId,
        intents: result.intents,
        primaryIntent: result.primaryIntent,
        secondaryIntent: result.secondaryIntent,
        entities: result.entities,
        contextKeywords: result.contextKeywords,
        urgency: result.urgency,
        complexity: result.complexity,
        confidence: result.confidence,
        language: result.language || request.language || 'en',
        processingTime,
        timestamp: new Date().toISOString()
      }

      logger.info('Intent classification completed', {
        conversationId: request.conversationId,
        primaryIntent: analysis.primaryIntent,
        confidence: analysis.confidence,
        processingTime
      })

      return analysis

    } catch (error) {
      logger.error('Intent classification failed', error as Error, {
        conversationId: request.conversationId,
        textLength: request.text?.length
      })

      // Return neutral analysis on error to prevent system failure
      return {
        conversationId: request.conversationId,
        messageId: request.messageId,
        intents: [],
        primaryIntent: 'off_topic',
        entities: {},
        contextKeywords: [],
        urgency: 'low',
        complexity: 'simple',
        confidence: 0.0,
        language: request.language || 'en',
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    }
  }

  async classifyIntentBatch(request: BatchIntentRequest): Promise<IntentAnalysis[]> {
    const startTime = Date.now()
    const results: IntentAnalysis[] = []

    try {
      logger.info('Starting batch intent classification', {
        conversationCount: request.conversations.length
      })

      // Process conversations in parallel for better performance
      const batchPromises = request.conversations.map(async (conversation) => {
        const conversationResults: IntentAnalysis[] = []

        for (const message of conversation.messages) {
          const intentRequest: IntentClassificationRequest = {
            text: message.text,
            conversationId: conversation.conversationId,
            messageId: message.messageId,
            language: conversation.language,
            context: conversation.messages
              .filter(m => m.messageId !== message.messageId)
              .map(m => m.text),
            previousIntents: [], // Could be enhanced to track conversation-level intents
            options: request.options
          }

          const analysis = await this.classifyIntent(intentRequest)
          conversationResults.push(analysis)
        }

        return conversationResults
      })

      const batchResults = await Promise.all(batchPromises)

      // Flatten results
      for (const conversationResults of batchResults) {
        results.push(...conversationResults)
      }

      const totalProcessingTime = Date.now() - startTime
      logger.info('Batch intent classification completed', {
        totalConversations: request.conversations.length,
        totalMessages: results.length,
        processingTime: totalProcessingTime
      })

      return results

    } catch (error) {
      logger.error('Batch intent classification failed', error as Error, {
        conversationCount: request.conversations.length
      })

      throw error
    }
  }

  private buildIntentPrompt(request: IntentClassificationRequest): string {
    let prompt = `Analyze the intent in this customer message: "${request.text}"\n\n`

    if (request.context && request.context.length > 0) {
      prompt += `Conversation context:\n${request.context.join('\n')}\n\n`
    }

    if (request.previousIntents && request.previousIntents.length > 0) {
      prompt += `Previous intents in conversation: ${request.previousIntents.join(', ')}\n\n`
    }

    if (request.language && request.language !== 'en') {
      prompt += `Note: This message is in ${request.language}.\n\n`
    }

    prompt += `Return the analysis in the exact JSON format specified.`

    return prompt
  }

  private parseIntentResponse(content: string): {
    intents: IntentScore[]
    primaryIntent: string
    secondaryIntent?: string
    entities: Record<string, string[]>
    contextKeywords: string[]
    urgency: 'low' | 'medium' | 'high'
    complexity: 'simple' | 'moderate' | 'complex'
    confidence: number
    language?: string
  } {
    try {
      const parsed = JSON.parse(content)

      // Validate and normalize intents
      const intents: IntentScore[] = (parsed.intents || []).map((intent: any) => ({
        intent: intent.intent?.toLowerCase() || 'off_topic',
        confidence: Math.max(0, Math.min(1, intent.confidence || 0)),
        entities: intent.entities || {}
      })).filter((intent: IntentScore) =>
        this.INTENT_TYPES.includes(intent.intent as any) || intent.intent === 'off_topic'
      )

      // Validate entities
      const entities: Record<string, string[]> = {}
      if (parsed.entities) {
        for (const [key, value] of Object.entries(parsed.entities)) {
          if (this.ENTITY_TYPES.includes(key as any) && Array.isArray(value)) {
            entities[key] = value.filter(v => typeof v === 'string')
          }
        }
      }

      return {
        intents,
        primaryIntent: parsed.primary_intent || 'off_topic',
        secondaryIntent: parsed.secondary_intent,
        entities,
        contextKeywords: Array.isArray(parsed.context_keywords) ? parsed.context_keywords : [],
        urgency: parsed.urgency || 'low',
        complexity: parsed.complexity || 'simple',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        language: parsed.language
      }
    } catch (error) {
      logger.error('Failed to parse intent classification response', error as Error, { content })
      throw new Error('Invalid response format from intent classification API')
    }
  }

  // Analytics methods
  async getIntentAnalytics(
    conversationIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<IntentAnalytics[]> {
    // This would typically query a database for historical intent data
    // For now, return a placeholder implementation
    logger.info('Getting intent analytics', {
      conversationCount: conversationIds.length,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    })

    return []
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const testRequest: IntentClassificationRequest = {
        text: 'I need help with my account login issue',
        conversationId: 'health-check',
        language: 'en'
      }

      const result = await this.classifyIntent(testRequest)

      return result.primaryIntent === 'support_request' &&
             result.urgency !== 'low' &&
             result.confidence > 0.5
    } catch (error) {
      logger.error('Intent classification health check failed', error as Error)
      return false
    }
  }
}

// Export singleton instance
export const intentClassificationService = new IntentClassificationService()