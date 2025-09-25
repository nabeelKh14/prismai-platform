import { renderHook, act, waitFor } from '@testing-library/react'
import { useConversation, Message, ConversationMetrics } from '@/hooks/use-conversation'
import { TestDataFactory } from '../utils/test-utils'

// Mock EventSource globally
const mockEventSource = {
  onmessage: jest.fn(),
  onerror: jest.fn(),
  close: jest.fn(),
}

const originalEventSource = global.EventSource
global.EventSource = jest.fn(() => mockEventSource) as any

// Mock fetch globally
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('useConversation', () => {
  const mockConversationId = 'test-conversation-123'

  beforeEach(() => {
    mockFetch.mockClear()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useConversation(mockConversationId))

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.metrics).toEqual({
      totalMessages: 0,
      averageResponseTime: 0,
      voiceMessages: 0,
      textMessages: 0,
      lastActivity: expect.any(String)
    })
  })

  it('should fetch messages successfully', async () => {
    const mockMessages: Message[] = [
      {
        id: 'msg-1',
        conversationId: mockConversationId,
        modality: 'text',
        senderType: 'customer',
        content: 'Hello, I need help',
        timestamp: '2024-01-01T10:00:00Z',
        processingTime: 150
      },
      {
        id: 'msg-2',
        conversationId: mockConversationId,
        modality: 'voice',
        senderType: 'ai',
        content: 'I understand. How can I assist you today?',
        timestamp: '2024-01-01T10:00:30Z',
        processingTime: 200,
        confidence: 0.95
      }
    ]

    const mockResponse = {
      messages: mockMessages
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const { result } = renderHook(() => useConversation(mockConversationId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.messages).toEqual(mockMessages)
    expect(result.current.metrics).toEqual({
      totalMessages: 2,
      averageResponseTime: 175, // (150 + 200) / 2
      voiceMessages: 1,
      textMessages: 1,
      lastActivity: '2024-01-01T10:00:30Z'
    })
    expect(mockFetch).toHaveBeenCalledWith(`/api/unified/conversations/${mockConversationId}/messages`)
  })

  it('should handle fetch messages error', async () => {
    const errorMessage = 'Failed to fetch messages'
    mockFetch.mockRejectedValueOnce(new Error(errorMessage))

    const { result } = renderHook(() => useConversation(mockConversationId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe(errorMessage)
    expect(result.current.messages).toEqual([])
  })

  it('should handle API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Conversation not found' }),
    } as Response)

    const { result } = renderHook(() => useConversation(mockConversationId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to fetch messages')
    expect(result.current.messages).toEqual([])
  })

  it('should send message successfully', async () => {
    const mockResponse = { success: true, messageId: 'msg-123' }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const { result } = renderHook(() => useConversation(mockConversationId))

    let sendResult: any
    await act(async () => {
      sendResult = await result.current.sendMessage('Hello, I need help', 'text')
    })

    expect(sendResult).toEqual(mockResponse)
    expect(mockFetch).toHaveBeenCalledWith('/api/websocket/live-chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        type: 'user_input',
        userId: 'demo-user',
        conversationId: mockConversationId,
        modality: 'text',
        content: 'Hello, I need help',
        metadata: undefined
      }),
    }))
  })

  it('should send message with metadata', async () => {
    const mockResponse = { success: true, messageId: 'msg-123' }
    const metadata = { priority: 'high', category: 'support' }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const { result } = renderHook(() => useConversation(mockConversationId))

    let sendResult: any
    await act(async () => {
      sendResult = await result.current.sendMessage('Urgent help needed', 'voice', metadata)
    })

    expect(sendResult).toEqual(mockResponse)
    expect(mockFetch).toHaveBeenCalledWith('/api/websocket/live-chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        type: 'user_input',
        userId: 'demo-user',
        conversationId: mockConversationId,
        modality: 'voice',
        content: 'Urgent help needed',
        metadata
      }),
    }))
  })

  it('should handle send message error', async () => {
    const errorMessage = 'Failed to send message'
    mockFetch.mockRejectedValueOnce(new Error(errorMessage))

    const { result } = renderHook(() => useConversation(mockConversationId))

    await expect(result.current.sendMessage('Test message')).rejects.toThrow(errorMessage)
    expect(result.current.error).toBe(errorMessage)
  })

  it('should handle real-time AI responses via EventSource', async () => {
    const { result } = renderHook(() => useConversation(mockConversationId))

    // Simulate AI response event
    const aiResponseEvent = {
      data: JSON.stringify({
        type: 'ai_response',
        conversationId: mockConversationId,
        modality: 'text',
        content: 'I can help you with that',
        timestamp: '2024-01-01T10:01:00Z',
        processingTime: 180,
        confidence: 0.92
      })
    }

    await act(async () => {
      mockEventSource.onmessage(aiResponseEvent)
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toEqual({
      id: expect.any(String),
      conversationId: mockConversationId,
      modality: 'text',
      senderType: 'ai',
      content: 'I can help you with that',
      timestamp: '2024-01-01T10:01:00Z',
      processingTime: 180,
      confidence: 0.92
    })

    expect(result.current.metrics).toEqual({
      totalMessages: 1,
      averageResponseTime: 180,
      voiceMessages: 0,
      textMessages: 1,
      lastActivity: '2024-01-01T10:01:00Z'
    })
  })

  it('should handle real-time voice responses', async () => {
    // Mock EventSource
    const mockEventSource = {
      onmessage: jest.fn(),
      onerror: jest.fn(),
      close: jest.fn(),
    }

    const originalEventSource = global.EventSource
    global.EventSource = jest.fn(() => mockEventSource) as any

    const { result } = renderHook(() => useConversation(mockConversationId))

    // Simulate voice AI response event
    const voiceResponseEvent = {
      data: JSON.stringify({
        type: 'ai_response',
        conversationId: mockConversationId,
        modality: 'voice',
        content: 'Let me assist you with that request',
        audioUrl: 'https://example.com/audio.mp3',
        timestamp: '2024-01-01T10:02:00Z',
        processingTime: 250,
        confidence: 0.88
      })
    }

    await act(async () => {
      mockEventSource.onmessage(voiceResponseEvent)
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].modality).toBe('voice')
    expect(result.current.messages[0].audioUrl).toBe('https://example.com/audio.mp3')
    expect(result.current.metrics.voiceMessages).toBe(1)
    expect(result.current.metrics.textMessages).toBe(0)

    // Restore original EventSource
    global.EventSource = originalEventSource
  })

  it('should ignore messages for different conversations', async () => {
    // Mock EventSource
    const mockEventSource = {
      onmessage: jest.fn(),
      onerror: jest.fn(),
      close: jest.fn(),
    }

    const originalEventSource = global.EventSource
    global.EventSource = jest.fn(() => mockEventSource) as any

    const { result } = renderHook(() => useConversation(mockConversationId))

    // Simulate AI response for different conversation
    const differentConversationEvent = {
      data: JSON.stringify({
        type: 'ai_response',
        conversationId: 'different-conversation-id',
        modality: 'text',
        content: 'This should be ignored',
        timestamp: '2024-01-01T10:03:00Z',
        processingTime: 100,
        confidence: 0.95
      })
    }

    await act(async () => {
      mockEventSource.onmessage(differentConversationEvent)
    })

    expect(result.current.messages).toHaveLength(0) // Should not add message

    // Restore original EventSource
    global.EventSource = originalEventSource
  })

  it('should handle EventSource errors', async () => {
    // Mock EventSource
    const mockEventSource = {
      onmessage: jest.fn(),
      onerror: jest.fn(),
      close: jest.fn(),
    }

    const originalEventSource = global.EventSource
    global.EventSource = jest.fn(() => mockEventSource) as any

    const { result } = renderHook(() => useConversation(mockConversationId))

    // Simulate connection error
    const errorEvent = new Event('error')

    await act(async () => {
      mockEventSource.onerror(errorEvent)
    })

    expect(result.current.error).toBe('Real-time connection lost')

    // Restore original EventSource
    global.EventSource = originalEventSource
  })

  it('should handle malformed JSON in EventSource messages', async () => {
    // Mock EventSource
    const mockEventSource = {
      onmessage: jest.fn(),
      onerror: jest.fn(),
      close: jest.fn(),
    }

    const originalEventSource = global.EventSource
    global.EventSource = jest.fn(() => mockEventSource) as any

    const { result } = renderHook(() => useConversation(mockConversationId))

    // Simulate malformed JSON
    const malformedEvent = {
      data: 'invalid json {'
    }

    // Should not throw error
    expect(() => {
      act(() => {
        mockEventSource.onmessage(malformedEvent)
      })
    }).not.toThrow()

    expect(result.current.messages).toHaveLength(0)

    // Restore original EventSource
    global.EventSource = originalEventSource
  })

  it('should update metrics correctly with multiple messages', async () => {
    // Mock EventSource
    const mockEventSource = {
      onmessage: jest.fn(),
      onerror: jest.fn(),
      close: jest.fn(),
    }

    const originalEventSource = global.EventSource
    global.EventSource = jest.fn(() => mockEventSource) as any

    const { result } = renderHook(() => useConversation(mockConversationId))

    // Add first message
    const firstMessageEvent = {
      data: JSON.stringify({
        type: 'ai_response',
        conversationId: mockConversationId,
        modality: 'text',
        content: 'First message',
        timestamp: '2024-01-01T10:00:00Z',
        processingTime: 100,
        confidence: 0.9
      })
    }

    await act(async () => {
      mockEventSource.onmessage(firstMessageEvent)
    })

    expect(result.current.metrics.totalMessages).toBe(1)
    expect(result.current.metrics.averageResponseTime).toBe(100)

    // Add second message
    const secondMessageEvent = {
      data: JSON.stringify({
        type: 'ai_response',
        conversationId: mockConversationId,
        modality: 'voice',
        content: 'Second message',
        timestamp: '2024-01-01T10:01:00Z',
        processingTime: 200,
        confidence: 0.95
      })
    }

    await act(async () => {
      mockEventSource.onmessage(secondMessageEvent)
    })

    expect(result.current.metrics.totalMessages).toBe(2)
    expect(result.current.metrics.averageResponseTime).toBe(150) // (100 + 200) / 2
    expect(result.current.metrics.voiceMessages).toBe(1)
    expect(result.current.metrics.textMessages).toBe(1)

    // Restore original EventSource
    global.EventSource = originalEventSource
  })

  it('should refetch messages when refetch is called', async () => {
    const mockMessages: Message[] = [
      {
        id: 'msg-1',
        conversationId: mockConversationId,
        modality: 'text',
        senderType: 'customer',
        content: 'Initial message',
        timestamp: '2024-01-01T10:00:00Z',
        processingTime: 100
      }
    ]

    const updatedMessages: Message[] = [
      ...mockMessages,
      {
        id: 'msg-2',
        conversationId: mockConversationId,
        modality: 'text',
        senderType: 'ai',
        content: 'AI response',
        timestamp: '2024-01-01T10:00:30Z',
        processingTime: 150
      }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: mockMessages }),
    } as Response)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: updatedMessages }),
    } as Response)

    const { result } = renderHook(() => useConversation(mockConversationId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.messages).toEqual(mockMessages)
    })

    // Call refetch
    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.messages).toEqual(updatedMessages)
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should handle empty messages array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [] }),
    } as Response)

    const { result } = renderHook(() => useConversation(mockConversationId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.metrics).toEqual({
      totalMessages: 0,
      averageResponseTime: 0,
      voiceMessages: 0,
      textMessages: 0,
      lastActivity: expect.any(String)
    })
  })

  it('should handle network errors gracefully', async () => {
    // Mock network error
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useConversation(mockConversationId))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to fetch')
    expect(result.current.messages).toEqual([])
  })
})