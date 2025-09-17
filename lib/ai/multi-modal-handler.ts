import { geminiClient } from './gemini-client'
import { VAPIClient } from './vapi-client'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface MultiModalInput {
  conversationId: string
  modality: 'voice' | 'text'
  content: string // text or audio data URL
  customerIdentifier: string
  metadata?: Record<string, any>
}

export interface MultiModalOutput {
  modality: 'voice' | 'text'
  content: string
  audioUrl?: string
  confidence: number
  processingTime: number
}

export class MultiModalHandler {
  private vapiClient: VAPIClient

  constructor(vapiConfig: { apiKey: string }) {
    this.vapiClient = new VAPIClient(vapiConfig)
  }

  async processInput(input: MultiModalInput): Promise<MultiModalOutput> {
    const startTime = Date.now()

    try {
      // Get conversation context
      const context = await this.getConversationContext(input.conversationId)

      // Process based on modality
      let processedContent: string
      if (input.modality === 'voice') {
        processedContent = await this.processVoiceInput(input.content)
      } else {
        processedContent = input.content
      }

      // Add message to unified conversation
      await this.addMessageToConversation({
        conversationId: input.conversationId,
        modality: input.modality,
        senderType: 'customer',
        content: processedContent,
        metadata: input.metadata
      })

      // Generate AI response using unified context
      const aiResponse = await this.generateAIResponse(context, processedContent)

      // Determine output modality (can be different from input)
      const outputModality = this.determineOutputModality(input.modality, aiResponse)

      // Generate output
      const output = await this.generateOutput(aiResponse, outputModality)

      const processingTime = Date.now() - startTime

      // Add AI response to conversation
      await this.addMessageToConversation({
        conversationId: input.conversationId,
        modality: outputModality,
        senderType: 'ai',
        content: output.content,
        audioUrl: output.audioUrl,
        processingTime,
        confidence: output.confidence
      })

      return {
        ...output,
        processingTime
      }

    } catch (error) {
      logger.error('Multi-modal input processing failed', error as Error, {
        conversationId: input.conversationId,
        modality: input.modality
      })
      throw error
    }
  }

  private async processVoiceInput(audioData: string): Promise<string> {
    // For demo, assume audioData is base64 or URL
    // In real implementation, use Whisper or similar for STT
    // For now, return placeholder transcript
    return "Transcribed voice input: " + audioData.substring(0, 50) + "..."
  }

  private async getConversationContext(conversationId: string): Promise<string> {
    const supabase = await createClient()
    const { data: messages } = await supabase
      .from('unified_messages')
      .select('content, sender_type, modality')
      .eq('conversation_id', conversationId)
      .order('sequence_number', { ascending: true })
      .limit(20) // Last 20 messages for context

    if (!messages) return ''

    return messages
      .map((msg: any) => `${msg.sender_type} (${msg.modality}): ${msg.content}`)
      .join('\n')
  }

  private async generateAIResponse(context: string, userInput: string): Promise<string> {
    const prompt = `
Conversation context:
${context}

Current user input: ${userInput}

Respond as an AI assistant. Keep responses natural and helpful.
`

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 500
    })

    return response.choices[0].message.content
  }

  private determineOutputModality(inputModality: 'voice' | 'text', aiResponse: string): 'voice' | 'text' {
    // Simple logic: respond in same modality, or text for short responses
    if (aiResponse.length < 100) return 'text'
    return inputModality
  }

  private async generateOutput(content: string, modality: 'voice' | 'text'): Promise<Omit<MultiModalOutput, 'processingTime'>> {
    if (modality === 'voice') {
      // Generate TTS using VAPI
      const audioUrl = await this.generateTTS(content)
      return {
        modality: 'voice',
        content, // transcript
        audioUrl,
        confidence: 0.95
      }
    } else {
      return {
        modality: 'text',
        content,
        confidence: 0.98
      }
    }
  }

  private async generateTTS(text: string): Promise<string> {
    // Placeholder for TTS generation
    // In real implementation, use VAPI or ElevenLabs
    return `tts://generated/${Date.now()}`
  }

  private async addMessageToConversation(message: {
    conversationId: string
    modality: 'voice' | 'text'
    senderType: 'customer' | 'ai' | 'agent'
    content: string
    audioUrl?: string
    processingTime?: number
    confidence?: number
    metadata?: Record<string, any>
  }) {
    const supabase = await createClient()
    const { data: sequenceData } = await supabase
      .rpc('get_next_message_sequence', { conv_id: message.conversationId })

    await supabase
      .from('unified_messages')
      .insert({
        conversation_id: message.conversationId,
        modality: message.modality,
        sender_type: message.senderType,
        content: message.content,
        audio_url: message.audioUrl,
        sequence_number: sequenceData,
        processing_time_ms: message.processingTime,
        confidence_score: message.confidence,
        metadata: message.metadata || {}
      })
  }

  async queueResponse(conversationId: string, output: MultiModalOutput, priority: number = 1) {
    const supabase = await createClient()
    await supabase
      .from('response_queue')
      .insert({
        conversation_id: conversationId,
        modality: output.modality,
        priority,
        payload: {
          content: output.content,
          audioUrl: output.audioUrl,
          confidence: output.confidence,
          processingTime: output.processingTime
        }
      })
  }
}

// Export singleton
export const multiModalHandler = new MultiModalHandler({
  apiKey: process.env.VAPI_API_KEY || ''
})