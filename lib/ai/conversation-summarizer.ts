import { geminiClient, ChatCompletionRequest } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'

export interface ConversationMessage {
  messageId: string
  text: string
  timestamp: string
  sender?: 'agent' | 'customer' | 'system'
  metadata?: Record<string, any>
}

export interface ConversationSummary {
  conversationId: string
  summary: string
  keyPoints: string[]
  outcomes: string[]
  turningPoints: string[]
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  duration: number // in minutes
  messageCount: number
  format: 'brief' | 'detailed' | 'executive'
  language?: string
  confidence: number
  processingTime: number
  timestamp: string
}

export interface ConversationSummarizationRequest {
  conversationId: string
  messages: ConversationMessage[]
  format?: 'brief' | 'detailed' | 'executive'
  language?: string
  includeKeyPoints?: boolean
  includeOutcomes?: boolean
  includeTurningPoints?: boolean
  customInstructions?: string
  options?: {
    maxLength?: number
    focusAreas?: string[]
    excludeTopics?: string[]
  }
}

export interface BatchSummarizationRequest {
  conversations: Array<{
    conversationId: string
    messages: ConversationMessage[]
    format?: 'brief' | 'detailed' | 'executive'
    language?: string
  }>
  options?: {
    maxLength?: number
    focusAreas?: string[]
    excludeTopics?: string[]
  }
}

export interface SummaryTemplate {
  name: string
  format: 'brief' | 'detailed' | 'executive'
  template: string
  maxLength: number
  focusAreas: string[]
}

class ConversationSummarizationService {
  private readonly DEFAULT_SUMMARY_LENGTHS = {
    brief: 150,
    detailed: 400,
    executive: 250
  }

  private readonly SUMMARY_PROMPTS = {
    system: `You are an expert conversation analyst specializing in creating intelligent, actionable summaries.

Core Capabilities:
- Generate concise, meaningful summaries that capture conversation essence
- Identify key discussion points and decisions made
- Extract outcomes, agreements, and next steps
- Detect conversation flow and critical turning points
- Assess overall sentiment and emotional tone
- Support multiple languages and cultural contexts

Summary Formats:
- Brief: 2-3 sentences capturing core essence (100-200 words)
- Detailed: Comprehensive overview with key points and outcomes (300-500 words)
- Executive: Strategic summary with insights and recommendations (200-300 words)

Guidelines:
- Focus on actionable information and decisions
- Highlight customer pain points and satisfaction indicators
- Identify process improvements and training opportunities
- Maintain professional, clear language
- Consider context and conversation flow
- Extract specific entities, dates, and commitments

Return JSON format:
{
  "summary": "Concise summary text",
  "key_points": ["Key point 1", "Key point 2"],
  "outcomes": ["Outcome 1", "Outcome 2"],
  "turning_points": ["Critical moment 1", "Critical moment 2"],
  "sentiment": "positive|negative|neutral|mixed",
  "confidence": 0.85,
  "language": "en"
}`,

    batchSystem: `You are an expert conversation analyst for batch processing multiple conversations efficiently.

Process each conversation individually while maintaining consistency in analysis approach.
Focus on efficiency while preserving quality and accuracy.
Handle different conversation types and contexts appropriately.

Return JSON format:
{
  "results": [
    {
      "conversation_id": "conv_123",
      "summary": "Summary text",
      "key_points": [...],
      "outcomes": [...],
      "turning_points": [...],
      "sentiment": "positive|negative|neutral|mixed",
      "confidence": 0.85
    }
  ]
}`
  }

  async summarizeConversation(request: ConversationSummarizationRequest): Promise<ConversationSummary> {
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
      const conversationText = this.prepareConversationText(request.messages)
      const format = request.format || 'brief'
      const maxLength = request.options?.maxLength || this.DEFAULT_SUMMARY_LENGTHS[format]

      // Build the prompt
      const userPrompt = this.buildSummaryPrompt(request, conversationText, maxLength)

      const chatRequest: ChatCompletionRequest = {
        messages: [
          { role: 'system', content: this.SUMMARY_PROMPTS.system },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for consistent summaries
        maxTokens: 2000
      }

      // Call Gemini API
      const response = await geminiClient.createChatCompletion(chatRequest)

      // Parse and validate response
      const result = this.parseSummaryResponse(response.choices[0].message.content)

      // Calculate conversation metrics
      const duration = this.calculateConversationDuration(request.messages)
      const messageCount = request.messages.length

      const processingTime = Date.now() - startTime

      const summary: ConversationSummary = {
        conversationId: request.conversationId,
        summary: result.summary,
        keyPoints: result.keyPoints || [],
        outcomes: result.outcomes || [],
        turningPoints: result.turningPoints || [],
        sentiment: result.sentiment,
        duration,
        messageCount,
        format,
        language: result.language || request.language || 'en',
        confidence: result.confidence,
        processingTime,
        timestamp: new Date().toISOString()
      }

      logger.info('Conversation summarization completed', {
        conversationId: request.conversationId,
        format,
        confidence: summary.confidence,
        messageCount,
        processingTime
      })

      return summary

    } catch (error) {
      logger.error('Conversation summarization failed', error as Error, {
        conversationId: request.conversationId,
        messageCount: request.messages?.length
      })

      // Return fallback summary on error
      return this.getFallbackSummary(request, Date.now() - startTime)
    }
  }

  async summarizeConversationsBatch(request: BatchSummarizationRequest): Promise<ConversationSummary[]> {
    const startTime = Date.now()
    const results: ConversationSummary[] = []

    try {
      logger.info('Starting batch conversation summarization', {
        conversationCount: request.conversations.length
      })

      // Process conversations in parallel for better performance
      const batchPromises = request.conversations.map(async (conversation) => {
        const summaryRequest: ConversationSummarizationRequest = {
          conversationId: conversation.conversationId,
          messages: conversation.messages,
          format: conversation.format,
          language: conversation.language,
          options: request.options
        }

        return await this.summarizeConversation(summaryRequest)
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      const totalProcessingTime = Date.now() - startTime
      logger.info('Batch conversation summarization completed', {
        totalConversations: request.conversations.length,
        totalSummaries: results.length,
        processingTime: totalProcessingTime
      })

      return results

    } catch (error) {
      logger.error('Batch conversation summarization failed', error as Error, {
        conversationCount: request.conversations.length
      })

      throw error
    }
  }

  private prepareConversationText(messages: ConversationMessage[]): string {
    return messages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(msg => `[${msg.timestamp}] ${msg.sender || 'unknown'}: ${msg.text}`)
      .join('\n')
  }

  private buildSummaryPrompt(request: ConversationSummarizationRequest, conversationText: string, maxLength: number): string {
    const format = request.format || 'brief'
    const formatInstructions = this.getFormatInstructions(format, maxLength)

    let prompt = `Please analyze this conversation and provide a ${format} summary.\n\n`
    prompt += `Conversation:\n${conversationText}\n\n`
    prompt += formatInstructions

    if (request.options?.focusAreas && request.options.focusAreas.length > 0) {
      prompt += `\nFocus Areas: ${request.options.focusAreas.join(', ')}`
    }

    if (request.options?.excludeTopics && request.options.excludeTopics.length > 0) {
      prompt += `\nExclude Topics: ${request.options.excludeTopics.join(', ')}`
    }

    if (request.customInstructions) {
      prompt += `\nAdditional Instructions: ${request.customInstructions}`
    }

    if (request.language && request.language !== 'en') {
      prompt += `\nNote: This conversation is in ${request.language}.`
    }

    prompt += `\n\nReturn the analysis in the exact JSON format specified.`

    return prompt
  }

  private getFormatInstructions(format: string, maxLength: number): string {
    switch (format) {
      case 'brief':
        return `Provide a brief summary (2-3 sentences, ${maxLength} words max) that captures the core essence, main topic, and key outcome of the conversation.`

      case 'detailed':
        return `Provide a detailed summary (${maxLength} words max) that includes:
        - Main topic and context
        - Key discussion points
        - Specific outcomes and decisions
        - Important details and commitments
        - Overall sentiment and tone`

      case 'executive':
        return `Provide an executive summary (${maxLength} words max) that includes:
        - Strategic overview
        - Key decisions and outcomes
        - Business impact and implications
        - Recommended actions
        - Success indicators`

      default:
        return `Provide a concise summary (${maxLength} words max) capturing the main points and outcome.`
    }
  }

  private parseSummaryResponse(content: string): {
    summary: string
    keyPoints?: string[]
    outcomes?: string[]
    turningPoints?: string[]
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
    confidence: number
    language?: string
  } {
    try {
      const parsed = JSON.parse(content)

      return {
        summary: parsed.summary || 'Summary could not be generated',
        keyPoints: Array.isArray(parsed.key_points) ? parsed.key_points : [],
        outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes : [],
        turningPoints: Array.isArray(parsed.turning_points) ? parsed.turning_points : [],
        sentiment: this.validateSentiment(parsed.sentiment) || 'neutral',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        language: parsed.language
      }
    } catch (error) {
      logger.error('Failed to parse summary response', error as Error, { content })
      throw new Error('Invalid response format from summarization API')
    }
  }

  private validateSentiment(sentiment: string): 'positive' | 'negative' | 'neutral' | 'mixed' | null {
    const validSentiments = ['positive', 'negative', 'neutral', 'mixed']
    return validSentiments.includes(sentiment) ? sentiment as any : null
  }

  private calculateConversationDuration(messages: ConversationMessage[]): number {
    if (messages.length < 2) return 0

    const timestamps = messages.map(msg => new Date(msg.timestamp).getTime())
    const startTime = Math.min(...timestamps)
    const endTime = Math.max(...timestamps)

    return Math.round((endTime - startTime) / (1000 * 60)) // Convert to minutes
  }

  private getFallbackSummary(request: ConversationSummarizationRequest, processingTime: number): ConversationSummary {
    const messageCount = request.messages.length
    const format = request.format || 'brief'

    return {
      conversationId: request.conversationId,
      summary: `This conversation contains ${messageCount} messages. A summary could not be generated due to an error.`,
      keyPoints: [],
      outcomes: [],
      turningPoints: [],
      sentiment: 'neutral',
      duration: this.calculateConversationDuration(request.messages),
      messageCount,
      format,
      language: request.language || 'en',
      confidence: 0.0,
      processingTime,
      timestamp: new Date().toISOString()
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const testMessages: ConversationMessage[] = [
        {
          messageId: 'test-1',
          text: 'Hello, I need help with my account.',
          timestamp: new Date().toISOString(),
          sender: 'customer'
        },
        {
          messageId: 'test-2',
          text: 'I understand. Let me help you with that.',
          timestamp: new Date().toISOString(),
          sender: 'agent'
        }
      ]

      const testRequest: ConversationSummarizationRequest = {
        conversationId: 'health-check',
        messages: testMessages,
        format: 'brief'
      }

      const result = await this.summarizeConversation(testRequest)

      return result.confidence > 0.5 && result.summary.length > 0
    } catch (error) {
      logger.error('Conversation summarization health check failed', error as Error)
      return false
    }
  }

  // Get available summary templates
  getSummaryTemplates(): SummaryTemplate[] {
    return [
      {
        name: 'Brief Overview',
        format: 'brief',
        template: 'Provide a concise 2-3 sentence summary capturing the main topic and outcome.',
        maxLength: 150,
        focusAreas: ['main_topic', 'key_outcome']
      },
      {
        name: 'Detailed Analysis',
        format: 'detailed',
        template: 'Provide a comprehensive summary including context, key points, outcomes, and sentiment.',
        maxLength: 400,
        focusAreas: ['context', 'key_points', 'outcomes', 'sentiment']
      },
      {
        name: 'Executive Summary',
        format: 'executive',
        template: 'Provide a strategic overview with business implications and recommended actions.',
        maxLength: 250,
        focusAreas: ['business_impact', 'decisions', 'recommendations']
      }
    ]
  }
}

// Export singleton instance
export const conversationSummarizationService = new ConversationSummarizationService()