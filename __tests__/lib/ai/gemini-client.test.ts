import { describe, it, expect, beforeEach } from '@jest/globals'
import { geminiClient } from '@/lib/ai/gemini-client'

// Mock environment variable for testing
process.env.GEMINI_API_KEY = 'test-gemini-key'

describe('Gemini Client', () => {
  describe('createChatCompletion', () => {
    it('should have the correct interface', () => {
      expect(typeof geminiClient.createChatCompletion).toBe('function')
    })

    it('should export openai compatibility layer', async () => {
      const { openai } = await import('@/lib/ai/gemini-client')
      expect(typeof openai.chat.completions.create).toBe('function')
    })
  })

  describe('message conversion', () => {
    it('should convert OpenAI messages to Gemini format', () => {
      // This tests the internal convertToGeminiMessages method indirectly
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ]

      // Test that the client can handle the message format
      expect(() => {
        geminiClient.createChatCompletion({ messages })
      }).not.toThrow()
    })
  })

  describe('analyzeTranscript', () => {
    it('should have the correct interface for transcript analysis', () => {
      expect(typeof geminiClient.analyzeTranscript).toBe('function')
    })
  })
})