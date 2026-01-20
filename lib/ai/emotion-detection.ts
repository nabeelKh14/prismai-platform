import { geminiClient, ChatCompletionRequest } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'

export interface EmotionScore {
  emotion: string
  confidence: number
  intensity: 'low' | 'medium' | 'high'
}

export interface EmotionAnalysis {
  conversationId: string
  messageId?: string
  emotions: EmotionScore[]
  dominantEmotion: string
  overallSentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  language?: string
  processingTime: number
  timestamp: string
}

export interface EmotionDetectionRequest {
  text: string
  conversationId: string
  messageId?: string
  language?: string
  context?: string[]
  options?: {
    includeIntensity?: boolean
    minConfidence?: number
  }
}

export interface BatchEmotionRequest {
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
    includeIntensity?: boolean
    minConfidence?: number
  }
}

export interface EmotionTrend {
  date: string
  emotions: Record<string, number>
  totalConversations: number
  dominantEmotion: string
}

class EmotionDetectionService {
  private readonly EMOTIONS = [
    'joy', 'sadness', 'anger', 'fear', 'surprise',
    'disgust', 'anticipation', 'trust'
  ] as const

  private readonly EMOTION_PROMPTS = {
    system: `You are an expert emotion detection AI. Analyze the given text and identify emotions with high accuracy.

Rules:
- Detect these 8 core emotions: joy, sadness, anger, fear, surprise, disgust, anticipation, trust
- Provide confidence scores (0-1) for each emotion detected
- Determine intensity: low (0.1-0.3), medium (0.4-0.7), high (0.8-1.0)
- Identify the dominant emotion (highest confidence)
- Classify overall sentiment: positive (joy, trust, anticipation), negative (sadness, anger, fear, disgust), neutral (mixed or weak emotions)
- Consider context, sarcasm, and cultural nuances
- Handle multiple languages appropriately

Return JSON format:
{
  "emotions": [
    {"emotion": "joy", "confidence": 0.85, "intensity": "high"},
    {"emotion": "trust", "confidence": 0.62, "intensity": "medium"}
  ],
  "dominant_emotion": "joy",
  "overall_sentiment": "positive",
  "confidence": 0.78,
  "language": "en"
}`,

    batchSystem: `You are an expert emotion detection AI for batch processing. Analyze multiple conversation messages efficiently.

Process each message individually and return results in the specified format.
Maintain consistency in emotion detection across the batch.
Consider conversation flow and context when available.

Return JSON format:
{
  "results": [
    {
      "conversation_id": "conv_123",
      "message_id": "msg_456",
      "emotions": [...],
      "dominant_emotion": "joy",
      "overall_sentiment": "positive",
      "confidence": 0.78
    }
  ]
}`
  }

  async detectEmotions(request: EmotionDetectionRequest): Promise<EmotionAnalysis> {
    const startTime = Date.now()

    try {
      // Input validation
      if (!request.text?.trim()) {
        throw new ValidationError('Text content is required for emotion detection')
      }

      if (!request.conversationId) {
        throw new ValidationError('Conversation ID is required')
      }

      // Prepare the prompt
      const userPrompt = this.buildEmotionPrompt(request)

      const chatRequest: ChatCompletionRequest = {
        messages: [
          { role: 'system', content: this.EMOTION_PROMPTS.system },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for consistent emotion detection
        maxTokens: 1000
      }

      // Call Gemini API
      const response = await geminiClient.createChatCompletion(chatRequest)

      // Parse and validate response
      const result = this.parseEmotionResponse(response.choices[0].message.content)

      // Apply minimum confidence filter if specified
      const minConfidence = request.options?.minConfidence || 0.1
      result.emotions = result.emotions.filter(e => e.confidence >= minConfidence)

      // Recalculate dominant emotion if needed
      if (result.emotions.length > 0) {
        result.dominantEmotion = result.emotions.reduce((prev, current) =>
          prev.confidence > current.confidence ? prev : current
        ).emotion
      } else {
        result.dominantEmotion = 'neutral'
        result.overallSentiment = 'neutral'
      }

      const processingTime = Date.now() - startTime

      const analysis: EmotionAnalysis = {
        conversationId: request.conversationId,
        messageId: request.messageId,
        emotions: result.emotions,
        dominantEmotion: result.dominantEmotion,
        overallSentiment: result.overallSentiment,
        confidence: result.confidence,
        language: result.language || request.language || 'en',
        processingTime,
        timestamp: new Date().toISOString()
      }

      logger.info('Emotion detection completed', {
        conversationId: request.conversationId,
        dominantEmotion: analysis.dominantEmotion,
        confidence: analysis.confidence,
        processingTime
      })

      return analysis

    } catch (error) {
      logger.error('Emotion detection failed', error as Error, {
        conversationId: request.conversationId,
        textLength: request.text?.length
      })

      // Return neutral analysis on error to prevent system failure
      return {
        conversationId: request.conversationId,
        messageId: request.messageId,
        emotions: [],
        dominantEmotion: 'neutral',
        overallSentiment: 'neutral',
        confidence: 0.0,
        language: request.language || 'en',
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    }
  }

  async detectEmotionsBatch(request: BatchEmotionRequest): Promise<EmotionAnalysis[]> {
    const startTime = Date.now()
    const results: EmotionAnalysis[] = []

    try {
      logger.info('Starting batch emotion detection', {
        conversationCount: request.conversations.length
      })

      // Process conversations in parallel for better performance
      const batchPromises = request.conversations.map(async (conversation) => {
        const conversationResults: EmotionAnalysis[] = []

        for (const message of conversation.messages) {
          const emotionRequest: EmotionDetectionRequest = {
            text: message.text,
            conversationId: conversation.conversationId,
            messageId: message.messageId,
            language: conversation.language,
            context: conversation.messages
              .filter(m => m.messageId !== message.messageId)
              .map(m => m.text),
            options: request.options
          }

          const analysis = await this.detectEmotions(emotionRequest)
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
      logger.info('Batch emotion detection completed', {
        totalConversations: request.conversations.length,
        totalMessages: results.length,
        processingTime: totalProcessingTime
      })

      return results

    } catch (error) {
      logger.error('Batch emotion detection failed', error as Error, {
        conversationCount: request.conversations.length
      })

      throw error
    }
  }

  private buildEmotionPrompt(request: EmotionDetectionRequest): string {
    let prompt = `Analyze the emotion in this text: "${request.text}"\n\n`

    if (request.context && request.context.length > 0) {
      prompt += `Previous context:\n${request.context.join('\n')}\n\n`
    }

    if (request.language && request.language !== 'en') {
      prompt += `Note: This text is in ${request.language}. Consider cultural context.\n\n`
    }

    prompt += `Return the analysis in the exact JSON format specified.`

    return prompt
  }

  private parseEmotionResponse(content: string): {
    emotions: EmotionScore[]
    dominantEmotion: string
    overallSentiment: 'positive' | 'negative' | 'neutral'
    confidence: number
    language?: string
  } {
    try {
      const parsed = JSON.parse(content)

      // Validate and normalize emotions
      const emotions: EmotionScore[] = (parsed.emotions || []).map((emotion: any) => ({
        emotion: emotion.emotion?.toLowerCase() || 'neutral',
        confidence: Math.max(0, Math.min(1, emotion.confidence || 0)),
        intensity: emotion.intensity || 'medium'
      })).filter((emotion: EmotionScore) =>
        this.EMOTIONS.includes(emotion.emotion as any) || emotion.emotion === 'neutral'
      )

      return {
        emotions,
        dominantEmotion: parsed.dominant_emotion || 'neutral',
        overallSentiment: parsed.overall_sentiment || 'neutral',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        language: parsed.language
      }
    } catch (error) {
      logger.error('Failed to parse emotion detection response', error as Error, { content })
      throw new Error('Invalid response format from emotion detection API')
    }
  }

  // Utility method to get emotion trends
  async getEmotionTrends(
    conversationIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<EmotionTrend[]> {
    // This would typically query a database for historical emotion data
    // For now, return a placeholder implementation
    logger.info('Getting emotion trends', {
      conversationCount: conversationIds.length,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    })

    return []
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const testRequest: EmotionDetectionRequest = {
        text: 'I am very happy today!',
        conversationId: 'health-check',
        language: 'en'
      }

      const result = await this.detectEmotions(testRequest)

      return result.dominantEmotion === 'joy' &&
             result.overallSentiment === 'positive' &&
             result.confidence > 0.5
    } catch (error) {
      logger.error('Emotion detection health check failed', error as Error)
      return false
    }
  }
}

// Export singleton instance
export const emotionDetectionService = new EmotionDetectionService()