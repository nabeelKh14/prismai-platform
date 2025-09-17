import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError } from "@/lib/errors"
import { geminiClient } from "@/lib/ai/gemini-client"
import { cache } from "@/lib/cache"

// Validation schemas
const sentimentAnalysisSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  context: z.array(z.object({
    sender_type: z.enum(['customer', 'ai', 'agent']),
    content: z.string(),
    created_at: z.string()
  })).optional()
})

const batchSentimentSchema = z.object({
  messages: z.array(z.object({
    id: z.string().uuid(),
    content: z.string(),
    conversation_id: z.string().uuid()
  })).max(50) // Limit batch size
})

// Sentiment Analysis Engine
class SentimentAnalysisEngine {
  static async analyzeMessage(
    message: string,
    context?: any[]
  ): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral'
    score: number // -1.0 to 1.0
    confidence: number // 0.0 to 1.0
    emotions: string[]
    urgency: 'low' | 'medium' | 'high'
    topics: string[]
  }> {
    try {
      // Build context for better analysis
      const conversationContext = context?.slice(-5) // Last 5 messages for context
        .map(msg => `${msg.sender_type}: ${msg.content}`)
        .join('\n') || ''

      const prompt = `
Analyze the sentiment of this customer message in the context of a customer service conversation.

Conversation Context (last 5 messages):
${conversationContext}

Customer Message: "${message}"

Provide analysis in this JSON format:
{
  "sentiment": "positive|negative|neutral",
  "score": float (-1.0 to 1.0),
  "confidence": float (0.0 to 1.0),
  "emotions": ["emotion1", "emotion2"],
  "urgency": "low|medium|high",
  "topics": ["topic1", "topic2"]
}

Guidelines:
- Score: -1.0 (very negative) to 1.0 (very positive)
- Confidence: How certain you are about the analysis
- Emotions: anger, frustration, happiness, satisfaction, confusion, etc.
- Urgency: Based on language indicating time-sensitivity
- Topics: Main subjects discussed (support, billing, product, etc.)
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2, // Low temperature for consistent analysis
        maxTokens: 500
      })

      const analysis = JSON.parse(response.choices[0]?.message?.content || '{}')

      return {
        sentiment: analysis.sentiment || 'neutral',
        score: Math.max(-1.0, Math.min(1.0, analysis.score || 0.0)),
        confidence: Math.max(0.0, Math.min(1.0, analysis.confidence || 0.5)),
        emotions: analysis.emotions || [],
        urgency: analysis.urgency || 'low',
        topics: analysis.topics || []
      }
    } catch (error) {
      console.error('Error in sentiment analysis:', error)

      // Fallback analysis based on keywords
      return this.fallbackSentimentAnalysis(message)
    }
  }

  static fallbackSentimentAnalysis(message: string): any {
    const lowerMessage = message.toLowerCase()

    // Negative keywords
    const negativeKeywords = ['angry', 'frustrated', 'disappointed', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'hate', 'complaint', 'problem', 'issue', 'broken', 'not working']
    const positiveKeywords = ['great', 'excellent', 'amazing', 'wonderful', 'good', 'happy', 'satisfied', 'thank you', 'helpful', 'perfect', 'love', 'awesome']
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'now', 'quickly', 'fast']

    let negativeScore = 0
    let positiveScore = 0
    let urgentScore = 0

    negativeKeywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) negativeScore += 0.2
    })

    positiveKeywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) positiveScore += 0.2
    })

    urgentKeywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) urgentScore += 0.3
    })

    const score = Math.max(-1.0, Math.min(1.0, positiveScore - negativeScore))
    const urgency = urgentScore > 0.5 ? 'high' : urgentScore > 0.2 ? 'medium' : 'low'
    const sentiment = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral'

    return {
      sentiment,
      score,
      confidence: 0.6, // Lower confidence for fallback
      emotions: [],
      urgency,
      topics: []
    }
  }

  static async analyzeBatch(messages: any[]): Promise<Map<string, any>> {
    const results = new Map<string, any>()

    // Process messages in parallel with rate limiting
    const batchSize = 5
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)
      const promises = batch.map(async (msg) => {
        const analysis = await this.analyzeMessage(msg.content)
        results.set(msg.id, analysis)
      })

      await Promise.all(promises)

      // Small delay between batches to avoid rate limits
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }
}

// POST /api/ai/sentiment - Analyze single message
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const body = await request.json()
  const validatedData = sentimentAnalysisSchema.parse(body)

  // Check cache first
  const cacheKey = `sentiment:${validatedData.message.substring(0, 100)}`
  const cachedResult = await cache.get(cacheKey)
  if (cachedResult) {
    return NextResponse.json(cachedResult)
  }

  // Get conversation context if conversationId provided
  let context = undefined
  if (validatedData.conversationId) {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('sender_type, content, created_at')
      .eq('conversation_id', validatedData.conversationId)
      .order('created_at', { ascending: false })
      .limit(10)

    context = messages?.reverse() || []
  }

  // Analyze sentiment
  const analysis = await SentimentAnalysisEngine.analyzeMessage(
    validatedData.message,
    context
  )

  // Cache the result for 1 hour
  await cache.set(cacheKey, analysis, 3600)

  return NextResponse.json({
    success: true,
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    analysis
  })
})

// PUT /api/ai/sentiment/batch - Analyze multiple messages
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const body = await request.json()
  const validatedData = batchSentimentSchema.parse(body)

  const results = await SentimentAnalysisEngine.analyzeBatch(validatedData.messages)

  // Update messages with sentiment analysis in database
  const updates = Array.from(results.entries()).map(([messageId, analysis]) => ({
    id: messageId,
    metadata: {
      sentiment: analysis.sentiment,
      sentiment_score: analysis.score,
      sentiment_confidence: analysis.confidence,
      emotions: analysis.emotions,
      urgency: analysis.urgency,
      topics: analysis.topics,
      analyzed_at: new Date().toISOString()
    }
  }))

  // Batch update messages
  for (const update of updates) {
    await supabase
      .from('chat_messages')
      .update({ metadata: update.metadata })
      .eq('id', update.id)
  }

  return NextResponse.json({
    success: true,
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    results: Object.fromEntries(results)
  })
})

// GET /api/ai/sentiment - Get sentiment statistics
export const GET = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId')
  const userId = searchParams.get('userId')

  if (!conversationId && !userId) {
    throw new ValidationError('Either conversationId or userId is required')
  }

  let query = supabase
    .from('chat_messages')
    .select('metadata')
    .not('metadata', 'is', null)

  if (conversationId) {
    query = query.eq('conversation_id', conversationId)
  } else {
    // Get messages from user's conversations
    const { data: conversations } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('user_id', userId)

    if (conversations?.length) {
      query = query.in('conversation_id', conversations.map(c => c.id))
    }
  }

  const { data: messages } = await query

  // Aggregate sentiment statistics
  const stats = {
    totalMessages: messages?.length || 0,
    sentimentDistribution: {
      positive: 0,
      negative: 0,
      neutral: 0
    },
    averageScore: 0,
    urgencyDistribution: {
      low: 0,
      medium: 0,
      high: 0
    },
    topEmotions: [] as string[],
    topTopics: [] as string[]
  }

  if (messages?.length) {
    let totalScore = 0
    const emotionsCount = new Map<string, number>()
    const topicsCount = new Map<string, number>()

    messages.forEach((msg: any) => {
      const meta = msg.metadata
      if (meta?.sentiment) {
        // Safely increment sentiment distribution
        const sentiment = meta.sentiment as keyof typeof stats.sentimentDistribution
        if (sentiment in stats.sentimentDistribution) {
          stats.sentimentDistribution[sentiment]++
        }
        totalScore += meta.sentiment_score || 0

        if (meta.emotions) {
          meta.emotions.forEach((emotion: string) => {
            emotionsCount.set(emotion, (emotionsCount.get(emotion) || 0) + 1)
          })
        }

        if (meta.topics) {
          meta.topics.forEach((topic: string) => {
            topicsCount.set(topic, (topicsCount.get(topic) || 0) + 1)
          })
        }

        if (meta.urgency) {
          // Safely increment urgency distribution
          const urgency = meta.urgency as keyof typeof stats.urgencyDistribution
          if (urgency in stats.urgencyDistribution) {
            stats.urgencyDistribution[urgency]++
          }
        }
      }
    })

    stats.averageScore = totalScore / messages.length
    stats.topEmotions = Array.from(emotionsCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emotion]) => emotion)

    stats.topTopics = Array.from(topicsCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic)
  }

  return NextResponse.json({
    success: true,
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    stats
  })
})