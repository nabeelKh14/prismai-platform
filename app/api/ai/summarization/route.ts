import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError } from "@/lib/errors"
import { geminiClient } from "@/lib/ai/gemini-client"
import { cache } from "@/lib/cache"

// Validation schemas
const summarizeConversationSchema = z.object({
  conversationId: z.string().uuid(),
  generateType: z.enum(['auto', 'manual']).default('manual'),
  includeKeyPoints: z.boolean().default(true),
  includeSentiment: z.boolean().default(true),
  maxLength: z.number().min(50).max(2000).default(500)
})

const batchSummarizeSchema = z.object({
  conversationIds: z.array(z.string().uuid()).max(10),
  generateType: z.enum(['auto', 'manual']).default('auto')
})

// Conversation Summarization Engine
class SummarizationEngine {
  static async generateSummary(
    conversationId: string,
    options: {
      generateType: 'auto' | 'manual'
      includeKeyPoints: boolean
      includeSentiment: boolean
      maxLength: number
    }
  ): Promise<{
    summary: string
    keyPoints: string[]
    sentimentSummary: string
    topics: string[]
    resolutionStatus: string
  }> {
    const supabase = await createClient()

    // Get conversation details
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    // Get all messages in the conversation
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (!messages?.length) {
      throw new Error('No messages found in conversation')
    }

    // Build conversation transcript
    const transcript = messages
      .map(msg => `${msg.sender_type.toUpperCase()}: ${msg.content}`)
      .join('\n')

    // Get sentiment analysis if available
    const sentimentData = messages
      .filter(msg => msg.metadata?.sentiment_score !== undefined)
      .map(msg => ({
        sender: msg.sender_type,
        sentiment: msg.metadata.sentiment_score,
        urgency: msg.metadata.urgency,
        topics: msg.metadata.topics || []
      }))

    const avgSentiment = sentimentData.length > 0
      ? sentimentData.reduce((sum, msg) => sum + msg.sentiment, 0) / sentimentData.length
      : 0

    // Build prompt for summarization
    let prompt = `
Analyze this customer service conversation and generate a comprehensive summary.

CONVERSATION DETAILS:
- Channel: ${conversation.channel}
- Status: ${conversation.status}
- Created: ${conversation.created_at}
- Total Messages: ${messages.length}

CONVERSATION TRANSCRIPT:
${transcript}

`

    if (sentimentData.length > 0) {
      prompt += `
SENTIMENT ANALYSIS:
- Average Sentiment Score: ${avgSentiment.toFixed(2)}
- Sentiment Trend: ${avgSentiment > 0.1 ? 'Positive' : avgSentiment < -0.1 ? 'Negative' : 'Neutral'}
- Messages with sentiment analysis: ${sentimentData.length}
`
    }

    prompt += `
Please provide a summary in this JSON format:
{
  "summary": "concise summary of the conversation (max ${options.maxLength} characters)",
  "key_points": ["key point 1", "key point 2", "key point 3"],
  "sentiment_summary": "brief assessment of customer satisfaction and sentiment",
  "topics": ["main topic 1", "main topic 2"],
  "resolution_status": "${conversation.status === 'resolved' ? 'resolved' : conversation.status === 'escalated' ? 'escalated' : 'ongoing'}"
}

Guidelines:
- Summary should be concise but comprehensive
- Key points should highlight important information, requests, or resolutions
- Sentiment summary should assess overall customer satisfaction
- Topics should identify main subjects discussed
- Keep summary under ${options.maxLength} characters
- Focus on customer needs, issues raised, and how they were addressed
`

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000
    })

    const summaryData = JSON.parse(response.choices[0]?.message?.content || '{}')

    return {
      summary: summaryData.summary || 'Summary could not be generated',
      keyPoints: options.includeKeyPoints ? (summaryData.key_points || []) : [],
      sentimentSummary: options.includeSentiment ? (summaryData.sentiment_summary || 'Sentiment analysis not available') : '',
      topics: summaryData.topics || [],
      resolutionStatus: summaryData.resolution_status || conversation.status
    }
  }

  static async updateKnowledgeBase(
    conversationId: string,
    summary: any
  ): Promise<void> {
    const supabase = await createClient()

    // Check if this conversation contains valuable information for KB
    if (summary.topics.length > 0 && summary.keyPoints.length > 0) {
      // Create a knowledge base entry from the conversation
      const kbEntry = {
        title: `Conversation Summary: ${summary.topics.slice(0, 2).join(', ')}`,
        content: `
Summary: ${summary.summary}

Key Points:
${summary.keyPoints.map((point: string) => `- ${point}`).join('\n')}

Topics: ${summary.topics.join(', ')}
Sentiment: ${summary.sentimentSummary}

Resolution: ${summary.resolutionStatus}
        `,
        category: 'conversation_insights',
        tags: ['conversation', 'summary', ...summary.topics],
        is_published: false // Manual review needed before publishing
      }

      await supabase
        .from('knowledge_base')
        .insert(kbEntry)
    }
  }
}

// POST /api/ai/summarization - Generate conversation summary
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new ValidationError('Unauthorized')
  }

  const body = await request.json()
  const validatedData = summarizeConversationSchema.parse(body)

  // Check if conversation belongs to user
  const { data: conversation } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('id', validatedData.conversationId)
    .eq('user_id', user.id)
    .single()

  if (!conversation) {
    throw new ValidationError('Conversation not found or access denied')
  }

  // Check cache first
  const cacheKey = `summary:${validatedData.conversationId}:${validatedData.generateType}`
  const cachedResult = await cache.get(cacheKey)
  if (cachedResult && validatedData.generateType === 'auto') {
    return NextResponse.json(cachedResult)
  }

  // Generate summary
  const summary = await SummarizationEngine.generateSummary(
    validatedData.conversationId,
    validatedData
  )

  // Save summary to database
  const { data: savedSummary, error: saveError } = await supabase
    .from('conversation_summaries')
    .upsert({
      conversation_id: validatedData.conversationId,
      summary: summary.summary,
      key_points: summary.keyPoints,
      resolution_status: summary.resolutionStatus,
      generated_by: validatedData.generateType
    })
    .select()
    .single()

  if (saveError) {
    console.error('Error saving summary:', saveError)
  }

  // Update conversation with summary
  await supabase
    .from('chat_conversations')
    .update({
      summary: summary.summary,
      summary_generated_at: new Date().toISOString()
    })
    .eq('id', validatedData.conversationId)

  // Cache the result for 1 hour
  await cache.set(cacheKey, { success: true, summary }, 3600)

  // If manual generation and has valuable content, consider adding to KB
  if (validatedData.generateType === 'manual' && summary.topics.length > 0) {
    try {
      await SummarizationEngine.updateKnowledgeBase(validatedData.conversationId, summary)
    } catch (error) {
      console.error('Error updating knowledge base:', error)
    }
  }

  return NextResponse.json({
    success: true,
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    summary
  })
})

// PUT /api/ai/summarization/batch - Generate summaries for multiple conversations
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new ValidationError('Unauthorized')
  }

  const body = await request.json()
  const validatedData = batchSummarizeSchema.parse(body)

  const results = []

  for (const conversationId of validatedData.conversationIds) {
    try {
      // Check if conversation belongs to user
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single()

      if (!conversation) {
        results.push({
          conversationId,
          success: false,
          error: 'Conversation not found or access denied'
        })
        continue
      }

      const summary = await SummarizationEngine.generateSummary(conversationId, {
        generateType: validatedData.generateType,
        includeKeyPoints: true,
        includeSentiment: true,
        maxLength: 500
      })

      // Save summary
      await supabase
        .from('conversation_summaries')
        .upsert({
          conversation_id: conversationId,
          summary: summary.summary,
          key_points: summary.keyPoints,
          resolution_status: summary.resolutionStatus,
          generated_by: validatedData.generateType
        })

      results.push({
        conversationId,
        success: true,
        summary
      })
    } catch (error) {
      console.error(`Error summarizing conversation ${conversationId}:`, error)
      results.push({
        conversationId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return NextResponse.json({
    success: true,
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    results
  })
})

// GET /api/ai/summarization - Get conversation summary
export const GET = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new ValidationError('Unauthorized')
  }

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    throw new ValidationError('conversationId is required')
  }

  // Check if conversation belongs to user
  const { data: conversation } = await supabase
    .from('chat_conversations')
    .select('id, summary, summary_generated_at')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!conversation) {
    throw new ValidationError('Conversation not found or access denied')
  }

  // Get detailed summary from conversation_summaries table
  const { data: detailedSummary } = await supabase
    .from('conversation_summaries')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    success: true,
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    summary: detailedSummary || {
      summary: conversation.summary,
      generated_at: conversation.summary_generated_at,
      generated_by: 'auto'
    }
  })
})