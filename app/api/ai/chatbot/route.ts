import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError, AuthenticationError } from "@/lib/errors"
import { geminiClient } from "@/lib/ai/gemini-client"
import { withAuth } from "@/lib/auth"
import { logger } from "@/lib/logger"

// Validation schemas
const chatMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  channel: z.enum(['website', 'whatsapp', 'sms', 'messenger', 'slack']),
  customerIdentifier: z.string().min(1), // email, phone, or session ID
  metadata: z.record(z.any()).optional(),
})

// Knowledge base schema (for future use)

// Advanced AI Chatbot Engine
class ChatbotEngine {
  static async generateResponse(
    userMessage: string,
    conversationHistory: any[],
    knowledgeBase: any[],
    businessContext: any
  ): Promise<{
    response: string
    intent: string
    confidence: number
    suggestedActions: string[]
    needsHumanHandoff: boolean
    extractedInfo: any
  }> {
    try {
      // Prepare context from knowledge base
      const relevantKnowledge = await this.searchKnowledgeBase(userMessage, knowledgeBase)
      
      // Build conversation context
      const conversationContext = conversationHistory
        .slice(-10) // Last 10 messages for context
        .map(msg => `${msg.sender_type}: ${msg.content}`)
        .join('\n')

      const prompt = `
You are an intelligent AI customer service agent for ${businessContext.businessName || 'the business'}. 

Business Context:
- Services: ${businessContext.services?.join(', ') || 'General services'}
- Business Hours: ${JSON.stringify(businessContext.businessHours || {})}
- Contact Info: ${businessContext.contactInfo || 'Contact through this chat'}

Relevant Knowledge:
${relevantKnowledge.map(kb => `${kb.title}: ${kb.content}`).join('\n')}

Conversation History:
${conversationContext}

Customer Message: "${userMessage}"

Provide a response in this JSON format:
{
  "response": "your helpful, natural response",
  "intent": "greeting|question|complaint|booking|support|other",
  "confidence": 0.95,
  "suggestedActions": ["action1", "action2"],
  "needsHumanHandoff": false,
  "extractedInfo": {
    "customerName": "if mentioned",
    "email": "if provided",
    "phone": "if provided",
    "appointmentRequest": "if booking requested",
    "urgency": "high|medium|low"
  }
}

Guidelines:
- Be helpful, professional, and empathetic
- Answer questions directly using the knowledge base
- If you can't help, offer to connect them with a human
- For bookings, collect: name, phone, email, service type, preferred date/time
- If urgent issues (angry customer, technical problems), suggest human handoff
- Keep responses concise but complete
- Use natural, conversational language
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 1000,
      })

      const aiResponse = JSON.parse(response.choices[0]?.message?.content || '{}')

      return {
        response: aiResponse.response || "I'm here to help! Could you please provide more details?",
        intent: aiResponse.intent || 'other',
        confidence: aiResponse.confidence || 0.5,
        suggestedActions: aiResponse.suggestedActions || [],
        needsHumanHandoff: aiResponse.needsHumanHandoff || false,
        extractedInfo: aiResponse.extractedInfo || {}
      }
    } catch (error) {
      console.error('Error generating chatbot response:', error)
      
      // Fallback response
      return {
        response: "I apologize, but I'm experiencing some technical difficulties right now. Let me connect you with a human agent who can assist you better.",
        intent: 'support',
        confidence: 0.3,
        suggestedActions: ['escalate_to_human'],
        needsHumanHandoff: true,
        extractedInfo: {}
      }
    }
  }

  static async searchKnowledgeBase(query: string, knowledgeBase: any[]): Promise<any[]> {
    try {
      // Try vector search first
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/embeddings?query=${encodeURIComponent(query)}&limit=3`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.results.length > 0) {
          return data.results.map((result: any) => ({
            id: result.id,
            title: result.title,
            content: result.content,
            category: result.category,
            tags: result.tags,
            relevanceScore: result.similarity
          }))
        }
      }

      // Fallback to keyword search if vector search fails
      console.warn('Vector search failed, falling back to keyword search')

      return knowledgeBase
        .map(kb => ({
          ...kb,
          relevanceScore: this.calculateRelevance(query, kb)
        }))
        .filter(kb => kb.relevanceScore > 0.3)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3) // Top 3 most relevant articles
    } catch (error) {
      console.error('Error in knowledge base search:', error)
      // Final fallback to keyword search

      return knowledgeBase
        .map(kb => ({
          ...kb,
          relevanceScore: this.calculateRelevance(query, kb)
        }))
        .filter(kb => kb.relevanceScore > 0.3)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3)
    }
  }

  static calculateRelevance(query: string, knowledgeItem: any): number {
    const queryWords = query.toLowerCase().split(' ')
    const content = `${knowledgeItem.title} ${knowledgeItem.content}`.toLowerCase()
    
    let score = 0
    const totalWords = queryWords.length
    
    queryWords.forEach(word => {
      if (content.includes(word)) {
        score += 1
      }
    })
    
    return totalWords > 0 ? score / totalWords : 0
  }

  static async detectBookingIntent(extractedInfo: any, message: string): Promise<any> {
    if (extractedInfo.appointmentRequest || 
        message.toLowerCase().includes('book') ||
        message.toLowerCase().includes('appointment') ||
        message.toLowerCase().includes('schedule')) {
      
      return {
        isBookingRequest: true,
        extractedData: {
          name: extractedInfo.customerName,
          email: extractedInfo.email,
          phone: extractedInfo.phone,
          requestedService: null, // Would be enhanced with NLP
          preferredDate: null,    // Would be enhanced with date parsing
          preferredTime: null
        }
      }
    }
    
    return { isBookingRequest: false }
  }
}

// Handle chat messages with authentication
export const POST = withAuth(
  withErrorHandling(async (request: NextRequest, authContext) => {
    // Log authenticated access
    logger.info('Chatbot API accessed', {
      userId: authContext?.user?.id,
      path: request.nextUrl.pathname
    })

    const supabase = await createClient()
    const body = await request.json()
    const validatedData = chatMessageSchema.parse(body)

  // Get or create conversation
  let conversationId = validatedData.conversationId
  let conversation = null

  if (conversationId) {
    const { data: existingConversation } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    conversation = existingConversation
  }

  if (!conversation) {
    // Create new conversation
    const conversationData: any = {
      channel: validatedData.channel,
      customer_identifier: validatedData.customerIdentifier,
      status: 'active'
    }

    // Add language preference if provided in metadata
    if (validatedData.metadata?.detectedLanguage) {
      conversationData.preferred_language = validatedData.metadata.detectedLanguage
      conversationData.language_confidence = validatedData.metadata.languageConfidence || 1.0
    }

    const { data: newConversation, error: createError } = await supabase
      .from('chat_conversations')
      .insert(conversationData)
      .select()
      .single()

    if (createError) {
      throw new Error(`Failed to create conversation: ${createError.message}`)
    }

    conversation = newConversation
    conversationId = newConversation.id
  }

  // Save customer message
  const customerMessageData: any = {
    conversation_id: conversationId,
    sender_type: 'customer',
    content: validatedData.message,
    metadata: validatedData.metadata || {}
  }

  // Perform sentiment analysis on customer messages
  // Get conversation history before any downstream analysis that may reference it
  const { data: conversationHistory } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (validatedData.message && validatedData.message.trim().length > 0) {
    try {
      const sentimentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/sentiment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: validatedData.message,
          conversationId: conversationId,
          context: (conversationHistory || []).slice(-5).map((msg: any) => ({
            sender_type: msg.sender_type,
            content: msg.content,
            created_at: msg.created_at
          })) || []
        })
      })

      if (sentimentResponse.ok) {
        const sentimentData = await sentimentResponse.json()
        if (sentimentData.success && sentimentData.analysis) {
          customerMessageData.metadata = {
            ...customerMessageData.metadata,
            sentiment: sentimentData.analysis.sentiment,
            sentiment_score: sentimentData.analysis.score,
            sentiment_confidence: sentimentData.analysis.confidence,
            emotions: sentimentData.analysis.emotions,
            urgency: sentimentData.analysis.urgency,
            topics: sentimentData.analysis.topics,
            analyzed_at: new Date().toISOString()
          }
        }
      }
    } catch (error) {
      console.error('Error performing sentiment analysis:', error)
      // Continue without sentiment analysis if it fails
    }
  }

  // Add language metadata if provided
  if (validatedData.metadata?.detectedLanguage) {
    customerMessageData.detected_language = validatedData.metadata.detectedLanguage
  }
  if (validatedData.metadata?.translatedFrom) {
    customerMessageData.translated_from = validatedData.metadata.translatedFrom
    customerMessageData.original_content = validatedData.metadata.originalMessage
  }

  const { error: saveMessageError } = await supabase
    .from('chat_messages')
    .insert(customerMessageData)

  if (saveMessageError) {
    throw new Error(`Failed to save message: ${saveMessageError.message}`)
  }

  // conversationHistory already fetched above

  // Get business context (from user_id if available, or default)
  const businessContext = {
    businessName: 'Your Business',
    services: ['General Consultation', 'Support', 'Appointment Booking'],
    businessHours: {
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { open: '09:00', close: '17:00' },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '17:00' },
      saturday: { open: '10:00', close: '14:00' },
      sunday: { closed: true }
    }
  }

  // Get relevant knowledge base articles
  const { data: knowledgeBase } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('is_published', true)
    .limit(20)

  // Generate AI response
  const aiResponse = await ChatbotEngine.generateResponse(
    validatedData.message,
    conversationHistory || [],
    knowledgeBase || [],
    businessContext
  )

  // Check for booking intent
  const bookingCheck = await ChatbotEngine.detectBookingIntent(
    aiResponse.extractedInfo,
    validatedData.message
  )

  // Save AI response
  const aiMessageData: any = {
    conversation_id: conversationId,
    sender_type: 'ai',
    content: aiResponse.response,
    metadata: {
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      extractedInfo: aiResponse.extractedInfo,
      bookingDetected: bookingCheck.isBookingRequest
    }
  }

  // Add translation metadata if response was translated
  if (validatedData.metadata?.translatedTo && validatedData.metadata.translatedTo !== 'en') {
    aiMessageData.translated_to = validatedData.metadata.translatedTo
    aiMessageData.translated_from = 'en'
    aiMessageData.original_content = aiResponse.response
  }

  const { error: saveAiMessageError } = await supabase
    .from('chat_messages')
    .insert(aiMessageData)

  if (saveAiMessageError) {
    throw new Error(`Failed to save AI response: ${saveAiMessageError.message}`)
  }

  // Check for escalation based on sentiment and other factors
  let escalationTriggered = false
  if (customerMessageData.metadata?.sentiment_score !== undefined) {
    try {
      const escalationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/escalation/check`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: conversationId,
          message: validatedData.message,
          sentiment: {
            score: customerMessageData.metadata.sentiment_score,
            urgency: customerMessageData.metadata.urgency || 'low'
          }
        })
      })

      if (escalationResponse.ok) {
        const escalationData = await escalationResponse.json()
        if (escalationData.success && escalationData.escalation.shouldEscalate) {
          escalationTriggered = true
          console.log(`Escalation triggered for conversation ${conversationId}: ${escalationData.escalation.reason}`)
        }
      }
    } catch (error) {
      console.error('Error checking escalation:', error)
    }
  }

  // If human handoff needed or escalation triggered, update conversation status
  if (aiResponse.needsHumanHandoff || escalationTriggered) {
    await supabase
      .from('chat_conversations')
      .update({
        status: 'escalated',
        escalation_reason: escalationTriggered ? 'AI escalation rules triggered' : 'Human handoff requested'
      })
      .eq('id', conversationId)
  }

  // If booking detected, create lead or update existing
  if (bookingCheck.isBookingRequest && aiResponse.extractedInfo.customerName) {
    try {
      await supabase.from('leads').upsert({
        email: aiResponse.extractedInfo.email,
        phone: aiResponse.extractedInfo.phone,
        first_name: aiResponse.extractedInfo.customerName.split(' ')[0],
        last_name: aiResponse.extractedInfo.customerName.split(' ').slice(1).join(' '),
        lead_score: 85, // High score for booking requests
        status: 'opportunity',
        tags: ['chatbot_booking', validatedData.channel],
        custom_fields: {
          source: 'chatbot',
          conversation_id: conversationId,
          booking_request: bookingCheck.extractedData
        }
      })
    } catch (error) {
      console.error('Error creating lead from booking:', error)
    }
  }

  return NextResponse.json({
    success: true,
    conversationId,
    response: aiResponse.response,
    intent: aiResponse.intent,
    confidence: aiResponse.confidence,
    needsHumanHandoff: aiResponse.needsHumanHandoff,
    suggestedActions: aiResponse.suggestedActions,
    bookingDetected: bookingCheck.isBookingRequest
  })
  }),
  {
    requireAuth: true,
    rateLimit: true,
    validateInput: true,
    logAccess: true
  }
)

// Get conversation history with authentication
export const GET = withAuth(
  withErrorHandling(async (request: NextRequest, authContext) => {
    // Log authenticated access
    logger.info('Chatbot history API accessed', {
      userId: authContext?.user?.id,
      path: request.nextUrl.pathname
    })

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const customerIdentifier = searchParams.get('customerIdentifier')

    if (!conversationId && !customerIdentifier) {
      throw new ValidationError('Either conversationId or customerIdentifier is required')
    }

    const supabase = await createClient()

    let query = supabase
      .from('chat_conversations')
      .select(`
        *,
        chat_messages (
          id,
          sender_type,
          content,
          message_type,
          metadata,
          created_at
        )
      `)

    if (conversationId) {
      query = query.eq('id', conversationId)
    } else {
      query = query.eq('customer_identifier', customerIdentifier)
    }

    const { data: conversations, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch conversation: ${error.message}`)
    }

    return NextResponse.json({
      conversations: conversations || []
    })
  }),
  {
    requireAuth: true,
    rateLimit: true,
    validateInput: true,
    logAccess: true
  }
)