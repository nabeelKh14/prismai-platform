import { logger } from '@/lib/logger'
import { messageIngestionService, IngestedMessage } from '@/lib/conversation/pipeline/message-ingestion'
import { realTimeProcessor, ProcessingResult, ConversationAnalysis } from '@/lib/conversation/pipeline/real-time-processor'
import { conversationIntelligenceMonitor } from '@/lib/monitoring/conversation-intelligence-monitor'

export interface WebSocketClient {
  id: string
  userId?: string
  tenantId?: string
  subscriptions: Set<string> // conversation IDs or patterns
  lastActivity: number
  rateLimit: {
    count: number
    windowStart: number
    maxPerWindow: number
  }
  isAuthenticated: boolean
  metadata?: Record<string, any>
}

export interface ConversationAnalysisMessage {
  type: 'conversation_message' | 'analysis_result' | 'conversation_state' | 'error' | 'heartbeat'
  conversationId: string
  messageId?: string
  clientId?: string
  data?: any
  timestamp: string
}

export interface WebSocketConnection {
  id: string
  client: WebSocketClient
  ws?: WebSocket // In Node.js environment, this would be a WebSocket-like object
  isConnected: boolean
  lastPing: number
  reconnectAttempts: number
  maxReconnectAttempts: number
}

export interface ConversationAnalysisHandlerConfig {
  maxConnections: number
  rateLimitPerMinute: number
  heartbeatInterval: number
  reconnectTimeout: number
  maxReconnectAttempts: number
  enableMessageQueue: boolean
  maxMessageQueueSize: number
  enableCompression: boolean
  authenticationRequired: boolean
}

export class ConversationAnalysisHandler {
  private connections: Map<string, WebSocketConnection> = new Map()
  private conversationSubscriptions: Map<string, Set<string>> = new Map() // conversationId -> clientIds
  private messageQueue: Map<string, ConversationAnalysisMessage[]> = new Map() // clientId -> messages
  private heartbeatTimer?: NodeJS.Timeout
  private cleanupTimer?: NodeJS.Timeout
  private config: Required<ConversationAnalysisHandlerConfig>

  constructor(config?: Partial<ConversationAnalysisHandlerConfig>) {
    this.config = {
      maxConnections: 1000,
      rateLimitPerMinute: 100,
      heartbeatInterval: 30000, // 30 seconds
      reconnectTimeout: 5000, // 5 seconds
      maxReconnectAttempts: 5,
      enableMessageQueue: true,
      maxMessageQueueSize: 100,
      enableCompression: true,
      authenticationRequired: true,
      ...config
    }

    this.startHeartbeat()
    this.startCleanup()
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(
    clientId: string,
    userId?: string,
    tenantId?: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Check connection limit
      if (this.connections.size >= this.config.maxConnections) {
        logger.warn('Connection rejected - max connections reached', {
          clientId,
          currentConnections: this.connections.size
        })
        return false
      }

      // Create client
      const client: WebSocketClient = {
        id: clientId,
        userId,
        tenantId,
        subscriptions: new Set(),
        lastActivity: Date.now(),
        rateLimit: {
          count: 0,
          windowStart: Date.now(),
          maxPerWindow: this.config.rateLimitPerMinute
        },
        isAuthenticated: !this.config.authenticationRequired || !!userId,
        metadata
      }

      // Create connection
      const connection: WebSocketConnection = {
        id: clientId,
        client,
        isConnected: true,
        lastPing: Date.now(),
        reconnectAttempts: 0,
        maxReconnectAttempts: this.config.maxReconnectAttempts
      }

      this.connections.set(clientId, connection)

      // Send welcome message
      await this.sendToClient(clientId, {
        type: 'conversation_state',
        conversationId: 'system',
        data: {
          status: 'connected',
          clientId,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      })

      logger.info('WebSocket connection established', {
        clientId,
        userId,
        tenantId,
        totalConnections: this.connections.size
      })

      return true

    } catch (error) {
      logger.error('Failed to handle WebSocket connection', error as Error, {
        clientId,
        userId,
        tenantId
      })
      return false
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(clientId: string): void {
    const connection = this.connections.get(clientId)
    if (connection) {
      connection.isConnected = false

      // Remove from conversation subscriptions
      for (const [conversationId, subscribers] of this.conversationSubscriptions.entries()) {
        subscribers.delete(clientId)
        if (subscribers.size === 0) {
          this.conversationSubscriptions.delete(conversationId)
        }
      }

      // Clear message queue if enabled
      if (this.config.enableMessageQueue) {
        this.messageQueue.delete(clientId)
      }

      logger.info('WebSocket connection closed', {
        clientId,
        wasConnected: connection.isConnected
      })
    }
  }

  /**
   * Subscribe client to conversation updates
   */
  async subscribeToConversation(
    clientId: string,
    conversationId: string
  ): Promise<boolean> {
    try {
      const connection = this.connections.get(clientId)
      if (!connection || !connection.isConnected) {
        return false
      }

      // Check rate limit
      if (!this.checkRateLimit(clientId)) {
        await this.sendToClient(clientId, {
          type: 'error',
          conversationId: conversationId,
          data: { error: 'Rate limit exceeded' },
          timestamp: new Date().toISOString()
        })
        return false
      }

      // Add subscription
      connection.client.subscriptions.add(conversationId)

      if (!this.conversationSubscriptions.has(conversationId)) {
        this.conversationSubscriptions.set(conversationId, new Set())
      }
      this.conversationSubscriptions.get(conversationId)!.add(clientId)

      // Update activity
      connection.client.lastActivity = Date.now()

      // Send subscription confirmation
      await this.sendToClient(clientId, {
        type: 'conversation_state',
        conversationId,
        data: {
          status: 'subscribed',
          conversationId,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      })

      logger.info('Client subscribed to conversation', {
        clientId,
        conversationId
      })

      return true

    } catch (error) {
      logger.error('Failed to subscribe to conversation', error as Error, {
        clientId,
        conversationId
      })
      return false
    }
  }

  /**
   * Unsubscribe client from conversation
   */
  async unsubscribeFromConversation(
    clientId: string,
    conversationId: string
  ): Promise<boolean> {
    try {
      const connection = this.connections.get(clientId)
      if (!connection) {
        return false
      }

      // Remove subscription
      connection.client.subscriptions.delete(conversationId)
      const subscribers = this.conversationSubscriptions.get(conversationId)
      if (subscribers) {
        subscribers.delete(clientId)
        if (subscribers.size === 0) {
          this.conversationSubscriptions.delete(conversationId)
        }
      }

      // Update activity
      connection.client.lastActivity = Date.now()

      logger.info('Client unsubscribed from conversation', {
        clientId,
        conversationId
      })

      return true

    } catch (error) {
      logger.error('Failed to unsubscribe from conversation', error as Error, {
        clientId,
        conversationId
      })
      return false
    }
  }

  /**
   * Process incoming message and trigger analysis
   */
  async processMessage(
    clientId: string,
    message: {
      conversationId: string
      content: string
      channel?: string
      metadata?: Record<string, any>
    }
  ): Promise<boolean> {
    try {
      const connection = this.connections.get(clientId)
      if (!connection || !connection.isConnected) {
        return false
      }

      // Check rate limit
      if (!this.checkRateLimit(clientId)) {
        await this.sendToClient(clientId, {
          type: 'error',
          conversationId: 'system',
          data: { error: 'Rate limit exceeded' },
          timestamp: new Date().toISOString()
        })
        return false
      }

      // Ingest message
      const ingestionResult = await messageIngestionService.ingestMessage(
        message.conversationId,
        (message.channel as any) || 'chat',
        { text: message.content },
        {
          senderId: clientId,
          tenantId: connection.client.tenantId,
          userId: connection.client.userId,
          ...message.metadata
        }
      )

      if (!ingestionResult.success || !ingestionResult.messageId) {
        await this.sendToClient(clientId, {
          type: 'error',
          conversationId: message.conversationId,
          data: {
            error: 'Message ingestion failed',
            details: ingestionResult.errors
          },
          timestamp: new Date().toISOString()
        })
        return false
      }

      // Get message for processing
      const messages = messageIngestionService.getMessagesForProcessing(1)
      const targetMessage = messages.find(m => m.id === ingestionResult.messageId)

      if (!targetMessage) {
        throw new Error('Message not found after ingestion')
      }

      // Process message in real-time
      const processingResult = await realTimeProcessor.processMessage(targetMessage)

      // Broadcast results to subscribers
      await this.broadcastAnalysisResult(message.conversationId, {
        type: 'analysis_result',
        conversationId: message.conversationId,
        messageId: targetMessage.id,
        data: processingResult,
        timestamp: new Date().toISOString()
      })

      // Send confirmation to sender
      await this.sendToClient(clientId, {
        type: 'conversation_message',
        conversationId: message.conversationId,
        messageId: targetMessage.id,
        data: {
          status: 'processed',
          processingTime: processingResult.processingTime
        },
        timestamp: new Date().toISOString()
      })

      // Update activity
      connection.client.lastActivity = Date.now()

      logger.info('Message processed and broadcasted', {
        clientId,
        messageId: targetMessage.id,
        processingTime: processingResult.processingTime
      })

      return true

    } catch (error) {
      logger.error('Failed to process message', error as Error, {
        clientId,
        conversationId: message.conversationId
      })

      await this.sendToClient(clientId, {
        type: 'error',
        conversationId: message.conversationId,
        data: { error: (error as Error).message },
        timestamp: new Date().toISOString()
      })

      return false
    }
  }

  /**
   * Broadcast analysis result to conversation subscribers
   */
  private async broadcastAnalysisResult(
    conversationId: string,
    message: ConversationAnalysisMessage
  ): Promise<void> {
    const subscribers = this.conversationSubscriptions.get(conversationId)
    if (!subscribers || subscribers.size === 0) {
      return
    }

    const messageStr = JSON.stringify(message)

    for (const clientId of subscribers) {
      const connection = this.connections.get(clientId)
      if (connection && connection.isConnected) {
        try {
          await this.sendToClient(clientId, message)
        } catch (error) {
          logger.error('Failed to send to subscriber', error as Error, {
            clientId,
            conversationId
          })
        }
      }
    }
  }

  /**
   * Send message to specific client
   */
  private async sendToClient(
    clientId: string,
    message: ConversationAnalysisMessage
  ): Promise<void> {
    const connection = this.connections.get(clientId)
    if (!connection || !connection.isConnected) {
      // Queue message if connection is down and queuing is enabled
      if (this.config.enableMessageQueue) {
        if (!this.messageQueue.has(clientId)) {
          this.messageQueue.set(clientId, [])
        }

        const queue = this.messageQueue.get(clientId)!
        if (queue.length < this.config.maxMessageQueueSize) {
          queue.push(message)
        } else {
          logger.warn('Message queue full, dropping message', {
            clientId,
            queueSize: queue.length
          })
        }
      }
      return
    }

    try {
      // In a real WebSocket implementation, this would send via WebSocket
      // For now, we'll simulate the send
      logger.debug('Sending message to client', {
        clientId,
        messageType: message.type,
        conversationId: message.conversationId
      })

      // Simulate WebSocket send (replace with actual WebSocket send)
      // connection.ws?.send(JSON.stringify(message))

    } catch (error) {
      logger.error('Failed to send message to client', error as Error, {
        clientId,
        messageType: message.type
      })

      // Add to queue for retry
      if (this.config.enableMessageQueue) {
        if (!this.messageQueue.has(clientId)) {
          this.messageQueue.set(clientId, [])
        }
        this.messageQueue.get(clientId)!.push(message)
      }
    }
  }

  /**
   * Handle heartbeat/ping
   */
  async handleHeartbeat(clientId: string): Promise<boolean> {
    const connection = this.connections.get(clientId)
    if (!connection) {
      return false
    }

    connection.lastPing = Date.now()
    connection.client.lastActivity = Date.now()

    // Send pong response
    await this.sendToClient(clientId, {
      type: 'heartbeat',
      conversationId: 'system',
      data: { status: 'pong' },
      timestamp: new Date().toISOString()
    })

    return true
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number
    activeConnections: number
    subscriptions: number
    queuedMessages: number
    rateLimitedClients: number
  } {
    let activeConnections = 0
    let queuedMessages = 0
    let rateLimitedClients = 0

    for (const connection of this.connections.values()) {
      if (connection.isConnected) {
        activeConnections++

        // Check rate limiting
        if (!this.checkRateLimit(connection.id)) {
          rateLimitedClients++
        }
      }
    }

    for (const queue of this.messageQueue.values()) {
      queuedMessages += queue.length
    }

    return {
      totalConnections: this.connections.size,
      activeConnections,
      subscriptions: this.conversationSubscriptions.size,
      queuedMessages,
      rateLimitedClients
    }
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections(timeoutMs: number = 5 * 60 * 1000): number { // 5 minutes default
    const cutoffTime = Date.now() - timeoutMs
    let cleanedCount = 0

    for (const [clientId, connection] of this.connections.entries()) {
      if (connection.client.lastActivity < cutoffTime && !connection.isConnected) {
        this.connections.delete(clientId)
        this.messageQueue.delete(clientId)
        cleanedCount++

        logger.info('Cleaned up inactive connection', { clientId })
      }
    }

    return cleanedCount
  }

  private checkRateLimit(clientId: string): boolean {
    const connection = this.connections.get(clientId)
    if (!connection) {
      return false
    }

    const now = Date.now()
    const client = connection.client

    // Reset window if needed
    if (now - client.rateLimit.windowStart > 60000) { // 1 minute window
      client.rateLimit.count = 0
      client.rateLimit.windowStart = now
    }

    // Check limit
    if (client.rateLimit.count >= client.rateLimit.maxPerWindow) {
      return false
    }

    client.rateLimit.count++
    return true
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      const now = Date.now()

      for (const [clientId, connection] of this.connections.entries()) {
        // Check if client is unresponsive
        if (now - connection.lastPing > this.config.heartbeatInterval * 2) {
          logger.warn('Client unresponsive, closing connection', {
            clientId,
            lastPing: connection.lastPing
          })

          this.handleDisconnection(clientId)
        }
      }
    }, this.config.heartbeatInterval)
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const cleanedConnections = this.cleanupInactiveConnections()
      const cleanedCache = realTimeProcessor.cleanupCache()

      if (cleanedConnections > 0 || cleanedCache > 0) {
        logger.info('Cleanup completed', {
          cleanedConnections,
          cleanedCache
        })
      }
    }, 60000) // Run every minute
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const stats = this.getConnectionStats()

      // Check if we're within healthy limits
      const healthy = stats.totalConnections < this.config.maxConnections * 0.9 &&
                     stats.queuedMessages < this.config.maxMessageQueueSize * 0.8

      return healthy
    } catch (error) {
      logger.error('WebSocket handler health check failed', error as Error)
      return false
    }
  }

  // Cleanup method
  cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.connections.clear()
    this.conversationSubscriptions.clear()
    this.messageQueue.clear()

    logger.info('WebSocket handler cleaned up')
  }
}

// Export singleton instance
export const conversationAnalysisHandler = new ConversationAnalysisHandler()