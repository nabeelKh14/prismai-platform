import { requireEnv } from '@/lib/env'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/errors'

export interface GeminiMessage {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[]
      role: string
    }
    finishReason: string
    index: number
  }[]
  usageMetadata: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export interface ChatCompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface EmbeddingRequest {
  input: string
  model?: string
}

export interface EmbeddingResponse {
  embedding: number[]
}

class GeminiClient {
  private apiKey: string
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  constructor() {
    console.log('GeminiClient constructor called')
    try {
      this.apiKey = requireEnv('GEMINI_API_KEY') as string
      console.log('GeminiClient initialized with API key:', !!this.apiKey)
    } catch (error) {
      console.warn('GeminiClient: API key not available, client will not function:', (error as Error).message)
      this.apiKey = ''
    }
  }

  private convertToGeminiMessages(messages: ChatCompletionRequest['messages']): {
    systemInstruction?: { parts: { text: string }[] }
    contents: GeminiMessage[]
  } {
    const systemMessage = messages.find(m => m.role === 'system')
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const contents: GeminiMessage[] = conversationMessages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))

    return {
      systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
      contents
    }
  }

  async createChatCompletion(request: ChatCompletionRequest): Promise<{
    choices: Array<{
      message: {
        role: 'assistant'
        content: string
      }
      finishReason: string
    }>
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }> {
    console.log('createChatCompletion called with request:', { messages: request.messages.length, model: request.model })

    const { systemInstruction, contents } = this.convertToGeminiMessages(request.messages)

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 1000,
      }
    }

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction
    }

    const model = request.model || 'gemini-1.5-flash'
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`

    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!res.ok) {
        const errorText = await res.text()
        logger.error('Gemini API error', new Error(errorText), {
          status: res.status,
          statusText: res.statusText,
          url
        })
        throw new Error(`Gemini API error: ${res.status} ${res.statusText}`)
      }

      return res.json() as Promise<GeminiResponse>
    }, {
      maxRetries: 3,
      baseDelay: 1000,
      shouldRetry: (error) => {
        return error.message.includes('429') || // Rate limit
               error.message.includes('500') || // Server error
               error.message.includes('502') || // Bad gateway
               error.message.includes('503')    // Service unavailable
      }
    })

    // Convert Gemini response to OpenAI-compatible format
    const candidate = response.candidates?.[0]
    if (!candidate) {
      throw new Error('No response from Gemini API')
    }

    return {
      choices: [{
        message: {
          role: 'assistant',
          content: candidate.content.parts[0]?.text || ''
        },
        finishReason: candidate.finishReason.toLowerCase()
      }],
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      }
    }
  }

  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    console.log('createEmbedding called with request:', { inputLength: request.input.length, model: request.model })

    const model = request.model || 'text-embedding-004'
    const url = `${this.baseUrl}/models/${model}:embedContent?key=${this.apiKey}`

    const requestBody = {
      content: {
        parts: [{ text: request.input }]
      }
    }

    const response = await withRetry(async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!res.ok) {
        const errorText = await res.text()
        logger.error('Gemini Embedding API error', new Error(errorText), {
          status: res.status,
          statusText: res.statusText,
          url
        })
        throw new Error(`Gemini Embedding API error: ${res.status} ${res.statusText}`)
      }

      return res.json()
    }, {
      maxRetries: 3,
      baseDelay: 1000,
      shouldRetry: (error) => {
        return error.message.includes('429') || // Rate limit
               error.message.includes('500') || // Server error
               error.message.includes('502') || // Bad gateway
               error.message.includes('503')    // Service unavailable
      }
    })

    if (!response.embedding?.values) {
      throw new Error('No embedding returned from Gemini API')
    }

    return {
      embedding: response.embedding.values
    }
  }

  // Legacy method for backward compatibility
  async chat(messages: ChatCompletionRequest['messages'], options: {
    temperature?: number
    maxTokens?: number
    model?: string
  } = {}) {
    console.log('chat method called (legacy)')
    return this.createChatCompletion({
      messages,
      ...options
    })
  }

  // Method for analyzing call transcripts
  async analyzeTranscript(transcript: string): Promise<{
    sentimentScore: number
    bookingRequest: any
    topics: string[]
    satisfaction: string
  }> {
    console.log('analyzeTranscript called with transcript length:', transcript.length)

    const response = await this.createChatCompletion({
      messages: [
        {
          role: 'system',
          content: `
            Analyze this call transcript and extract:
            1. Sentiment score (-1.0 to 1.0)
            2. Any booking requests with details
            3. Customer satisfaction indicators
            4. Key topics discussed

            Return JSON format:
            {
              \"sentiment_score\": float,
              \"booking_request\": {
                \"customer_name\": str,
                \"customer_phone\": str,
                \"service_type\": str,
                \"appointment_date\": str
              } or null,
              \"topics\": [str],
              \"satisfaction\": str
            }
          `
        },
        { role: 'user', content: transcript }
      ],
      temperature: 0.3
    })

    try {
      const analysis = JSON.parse(response.choices[0].message.content)
      return {
        sentimentScore: analysis.sentiment_score || 0.0,
        bookingRequest: analysis.booking_request || null,
        topics: analysis.topics || [],
        satisfaction: analysis.satisfaction || 'unknown'
      }
    } catch (error) {
      logger.error('Failed to parse Gemini transcript analysis', error as Error)
      return {
        sentimentScore: 0.0,
        bookingRequest: null,
        topics: [],
        satisfaction: 'unknown'
      }
    }
  }
}
// Export singleton instance
// export const geminiClient = new GeminiClient()

// Export for compatibility with existing OpenAI usage
// export const openai = {
//   chat: {
//     completions: {
//       create: (request: ChatCompletionRequest) => geminiClient.createChatCompletion(request)
//     }
//   }
// }

// Legacy export for existing code
// export default geminiClient

// Export singleton instance
export const geminiClient = new GeminiClient()

// Export for compatibility with existing OpenAI usage
export const openai = {
  chat: {
    completions: {
      create: (request: ChatCompletionRequest) => geminiClient.createChatCompletion(request)
    }
  }
}

// Legacy export for existing code
export default geminiClient