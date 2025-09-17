import { useState, useEffect, useCallback, useRef } from 'react'

export interface Message {
  id: string
  conversationId: string
  modality: 'voice' | 'text'
  senderType: 'customer' | 'ai' | 'agent'
  content: string
  audioUrl?: string
  timestamp: string
  processingTime?: number
  confidence?: number
  metadata?: Record<string, any>
}

export interface ConversationMetrics {
  totalMessages: number
  averageResponseTime: number
  voiceMessages: number
  textMessages: number
  lastActivity: string
}

export const useConversation = (conversationId: string) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [metrics, setMetrics] = useState<ConversationMetrics>({
    totalMessages: 0,
    averageResponseTime: 0,
    voiceMessages: 0,
    textMessages: 0,
    lastActivity: new Date().toISOString()
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Fetch conversation messages
  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/unified/conversations/${conversationId}/messages`)
      if (!response.ok) throw new Error('Failed to fetch messages')

      const data = await response.json()
      setMessages(data.messages || [])

      // Calculate metrics
      const voiceMsgs = data.messages?.filter((m: Message) => m.modality === 'voice').length || 0
      const textMsgs = data.messages?.filter((m: Message) => m.modality === 'text').length || 0
      const avgResponseTime = data.messages?.reduce((sum: number, m: Message) =>
        sum + (m.processingTime || 0), 0) / (data.messages?.length || 1) || 0

      setMetrics({
        totalMessages: data.messages?.length || 0,
        averageResponseTime: Math.round(avgResponseTime),
        voiceMessages: voiceMsgs,
        textMessages: textMsgs,
        lastActivity: data.messages?.[data.messages.length - 1]?.timestamp || new Date().toISOString()
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  // Send message via WebSocket
  const sendMessage = useCallback(async (
    content: string,
    modality: 'voice' | 'text' = 'text',
    metadata?: Record<string, any>
  ) => {
    try {
      const response = await fetch('/api/websocket/live-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user_input',
          userId: 'demo-user',
          conversationId,
          modality,
          content,
          metadata
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const result = await response.json()
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      throw err
    }
  }, [conversationId])

  // Set up real-time updates
  useEffect(() => {
    if (!conversationId) return

    // Use Server-Sent Events for real-time updates
    const eventSource = new EventSource(`/api/websocket/live-chat?userId=demo-user&conversationId=${conversationId}`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'ai_response' && data.conversationId === conversationId) {
          const newMessage: Message = {
            id: Date.now().toString(),
            conversationId,
            modality: data.modality,
            senderType: 'ai',
            content: data.content,
            audioUrl: data.audioUrl,
            timestamp: data.timestamp,
            processingTime: data.processingTime,
            confidence: data.confidence
          }

          setMessages(prev => [...prev, newMessage])

          // Update metrics
          setMetrics(prev => ({
            ...prev,
            totalMessages: prev.totalMessages + 1,
            averageResponseTime: Math.round((prev.averageResponseTime * prev.totalMessages + (data.processingTime || 0)) / (prev.totalMessages + 1)),
            voiceMessages: data.modality === 'voice' ? prev.voiceMessages + 1 : prev.voiceMessages,
            textMessages: data.modality === 'text' ? prev.textMessages + 1 : prev.textMessages,
            lastActivity: data.timestamp
          }))
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err)
      setError('Real-time connection lost')
    }

    return () => {
      eventSource.close()
    }
  }, [conversationId])

  // Initial fetch
  useEffect(() => {
    if (conversationId) {
      fetchMessages()
    }
  }, [conversationId, fetchMessages])

  return {
    messages,
    metrics,
    isLoading,
    error,
    sendMessage,
    refetch: fetchMessages
  }
}