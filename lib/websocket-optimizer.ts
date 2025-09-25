import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { logger } from '@/lib/logger'

export interface WebSocketConnection {
  id: string
  userId?: string
  tenantId?: string
  subscriptions: Set<string>
  lastActivity: number
  createdAt: number
  isAlive: boolean
  metadata?: Record<string, any>
}

export interface WebSocketMessage {
  id: string
  type: string
  payload: any
  timestamp: number
  compressed?: boolean
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

export interface WebSocketConfig {
  maxConnections?: number
  maxSubscriptionsPerConnection?: number
  heartbeatInterval?: number
  messageBatchTimeout?: number
  enableCompression?: boolean
  enableMetrics?: boolean
  connectionTimeout?: number
  maxMessageSize?: number
  enableBatching?: boolean
  batchSize?: number
}

export interface ConnectionPoolStats {
  totalConnections: number
  activeConnections: number
  subscriptions: number
  messagesPerSecond: number
  averageLatency: number
  memoryUsage: number
}

export class WebSocketOptimizer {
  private connections = new Map<string, WebSocketConnection>()
  private subscriptions = new Map<string, Set<string>>()
  private messageQueue: WebSocketMessage[] = []
  private connectionPool: Map<string, any> = new Map() // Would be actual WebSocket connections
  private config: Required<WebSocketConfig>
  private heartbeatInterval?: NodeJS.Timeout
  private batchTimeout?: NodeJS.Timeout
  private messageStats = {
    sent: 0,
    received: 0,
    lastReset: Date.now()
  }

  constructor(config?: WebSocketConfig) {
    this.config = {
      maxConnections: 10000,
      maxSubscriptionsPerConnection: 50,
      heartbeatInterval: 30000, // 30 seconds
      messageBatchTimeout: 50, // 50ms
      enableCompression: true,
      enableMetrics: true,
      connectionTimeout: 300000, // 5 minutes
      maxMessageSize: 1024 * 1024, // 1MB
      enableBatching: true,
      batchSize: 10,
      ...config
    }

    this.startHeartbeat()
    this.startBatchProcessor()
    this.startCleanupTask()
  }

  /**
   * Add WebSocket connection to pool
   */
  addConnection(
    connectionId: string,
    userId?: string,
    tenantId?: string,
    metadata?: Record<string, any>
  ): boolean {
    if (this.connections.size >= this.config.maxConnections) {
      logger.warn('Maximum connections reached', {
        maxConnections: this.config.maxConnections,
        currentConnections: this.connections.size
      })
      return false
    }

    const connection: WebSocketConnection = {
      id: connectionId,
      userId,
      tenantId,
      subscriptions: new Set(),
      lastActivity: Date.now(),
      createdAt: Date.now(),
      isAlive: true,
      metadata
    }

    this.connections.set(connectionId, connection)

    logger.info('WebSocket connection added', {
      connectionId,
      userId,
      tenantId,
      totalConnections: this.connections.size
    })

    return true
  }

  /**
   * Remove WebSocket connection from pool
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return
    }

    // Remove all subscriptions
    for (const subscription of connection.subscriptions) {
      const subscribers = this.subscriptions.get(subscription)
      if (subscribers) {
        subscribers.delete(connectionId)
        if (subscribers.size === 0) {
          this.subscriptions.delete(subscription)
        }
      }
    }

    this.connections.delete(connectionId)
    this.connectionPool.delete(connectionId)

    logger.info('WebSocket connection removed', {
      connectionId,
      totalConnections: this.connections.size
    })
  }

  /**
   * Subscribe connection to a channel/topic
   */
  subscribe(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      logger.warn('Connection not found for subscription', { connectionId, channel })
      return false
    }

    if (connection.subscriptions.size >= this.config.maxSubscriptionsPerConnection) {
      logger.warn('Maximum subscriptions per connection reached', {
        connectionId,
        currentSubscriptions: connection.subscriptions.size,
        maxSubscriptions: this.config.maxSubscriptionsPerConnection
      })
      return false
    }

    connection.subscriptions.add(channel)
    connection.lastActivity = Date.now()

    // Add to subscriptions map
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set())
    }
    this.subscriptions.get(channel)!.add(connectionId)

    logger.debug('Connection subscribed to channel', {
      connectionId,
      channel,
      totalSubscriptions: connection.subscriptions.size
    })

    return true
  }

  /**
   * Unsubscribe connection from a channel/topic
   */
  unsubscribe(connectionId: string, channel: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return
    }

    connection.subscriptions.delete(channel)
    connection.lastActivity = Date.now()

    // Remove from subscriptions map
    const subscribers = this.subscriptions.get(channel)
    if (subscribers) {
      subscribers.delete(connectionId)
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel)
      }
    }

    logger.debug('Connection unsubscribed from channel', {
      connectionId,
      channel,
      remainingSubscriptions: connection.subscriptions.size
    })
  }

  /**
   * Send message to specific connection
   */
  sendToConnection(connectionId: string, message: WebSocketMessage): boolean {
    const connection = this.connections.get(connectionId)
    if (!connection || !connection.isAlive) {
      logger.warn('Connection not found or not alive', { connectionId })
      return false
    }

    // Add to message queue for batching
    if (this.config.enableBatching) {
      this.queueMessage(message)
      return true
    }

    // Send immediately
    return this.sendMessageImmediately(connectionId, message)
  }

  /**
   * Send message to all subscribers of a channel
   */
  sendToChannel(channel: string, message: WebSocketMessage): number {
    const subscribers = this.subscriptions.get(channel)
    if (!subscribers || subscribers.size === 0) {
      return 0
    }

    let sentCount = 0

    // Add to message queue for batching
    if (this.config.enableBatching) {
      this.queueMessage(message)
      sentCount = subscribers.size
    } else {
      // Send to each subscriber
      for (const connectionId of subscribers) {
        if (this.sendMessageImmediately(connectionId, message)) {
          sentCount++
        }
      }
    }

    logger.debug('Message sent to channel subscribers', {
      channel,
      subscribers: subscribers.size,
      sentCount,
      messageType: message.type
    })

    return sentCount
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message: WebSocketMessage): number {
    if (this.connections.size === 0) {
      return 0
    }

    let sentCount = 0

    // Add to message queue for batching
    if (this.config.enableBatching) {
      this.queueMessage(message)
      sentCount = this.connections.size
    } else {
      // Send to each connection
      for (const [connectionId] of this.connections) {
        if (this.sendMessageImmediately(connectionId, message)) {
          sentCount++
        }
      }
    }

    logger.debug('Message broadcast to all connections', {
      totalConnections: this.connections.size,
      sentCount,
      messageType: message.type
    })

    return sentCount
  }

  /**
   * Queue message for batching
   */
  private queueMessage(message: WebSocketMessage): void {
    this.messageQueue.push(message)

    // Sort by priority
    this.messageQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      const aPriority = priorityOrder[a.priority || 'medium']
      const bPriority = priorityOrder[b.priority || 'medium']
      return aPriority - bPriority
    })

    // Process batch if queue is full or timeout reached
    if (this.messageQueue.length >= this.config.batchSize) {
      this.processBatch()
    }
  }

  /**
   * Process batched messages
   */
  private processBatch(): void {
    if (this.messageQueue.length === 0) {
      return
    }

    const batch = this.messageQueue.splice(0)

    // Group messages by channel for efficient delivery
    const messagesByChannel = new Map<string, WebSocketMessage[]>()

    for (const message of batch) {
      if (!messagesByChannel.has(message.type)) {
        messagesByChannel.set(message.type, [])
      }
      messagesByChannel.get(message.type)!.push(message)
    }

    // Send batched messages
    for (const [channel, messages] of messagesByChannel) {
      const subscribers = this.subscriptions.get(channel)
      if (!subscribers) continue

      // Create batch message
      const batchMessage: WebSocketMessage = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: channel,
        payload: messages,
        timestamp: Date.now(),
        compressed: this.config.enableCompression
      }

      for (const connectionId of subscribers) {
        this.sendMessageImmediately(connectionId, batchMessage)
      }
    }

    this.messageStats.sent += batch.length

    logger.debug('Message batch processed', {
      batchSize: batch.length,
      channels: messagesByChannel.size
    })
  }

  /**
   * Send message immediately (without batching)
   */
  private sendMessageImmediately(connectionId: string, message: WebSocketMessage): boolean {
    try {
      const connection = this.connectionPool.get(connectionId)
      if (!connection) {
        logger.warn('Connection not found in pool', { connectionId })
        return false
      }

      // Compress message if enabled
      let processedMessage = message
      if (this.config.enableCompression && message.payload) {
        processedMessage = {
          ...message,
          compressed: true,
          payload: this.compressMessage(message.payload)
        }
      }

      // Check message size
      const messageSize = JSON.stringify(processedMessage).length
      if (messageSize > this.config.maxMessageSize) {
        logger.warn('Message size exceeds limit', {
          connectionId,
          messageSize,
          maxSize: this.config.maxMessageSize
        })
        return false
      }

      // Send message (this would be actual WebSocket send)
      // connection.send(JSON.stringify(processedMessage))

      // Update connection activity
      const wsConnection = this.connections.get(connectionId)
      if (wsConnection) {
        wsConnection.lastActivity = Date.now()
      }

      this.messageStats.sent++

      return true

    } catch (error) {
      logger.error('Failed to send message', {
        error,
        connectionId,
        messageId: message.id
      })
      return false
    }
  }

  /**
   * Compress message payload
   */
  private compressMessage(payload: any): string {
    // Simple compression - in production, use a proper compression library
    const jsonString = JSON.stringify(payload)
    return Buffer.from(jsonString).toString('base64')
  }

  /**
   * Decompress message payload
   */
  private decompressMessage(compressedPayload: string): any {
    try {
      const jsonString = Buffer.from(compressedPayload, 'base64').toString()
      return JSON.parse(jsonString)
    } catch (error) {
      logger.error('Failed to decompress message', { error })
      return compressedPayload
    }
  }

  /**
   * Handle heartbeat/ping
   */
  handleHeartbeat(connectionId: string): boolean {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return false
    }

    connection.lastActivity = Date.now()
    connection.isAlive = true

    // Send pong response
    const pongMessage: WebSocketMessage = {
      id: `pong_${Date.now()}`,
      type: 'pong',
      payload: { timestamp: Date.now() },
      timestamp: Date.now()
    }

    return this.sendToConnection(connectionId, pongMessage)
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number
    activeConnections: number
    subscriptions: number
    messagesPerSecond: number
    averageConnectionAge: number
  } {
    const now = Date.now()
    let activeConnections = 0
    let totalAge = 0

    for (const connection of this.connections.values()) {
      if (connection.isAlive) {
        activeConnections++
        totalAge += (now - connection.createdAt)
      }
    }

    const averageAge = this.connections.size > 0 ? totalAge / this.connections.size : 0
    const messagesPerSecond = (now - this.messageStats.lastReset) > 0 ?
      this.messageStats.sent / ((now - this.messageStats.lastReset) / 1000) : 0

    return {
      totalConnections: this.connections.size,
      activeConnections,
      subscriptions: Array.from(this.subscriptions.values()).reduce((sum, subs) => sum + subs.size, 0),
      messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
      averageConnectionAge: Math.round(averageAge / 1000) // Convert to seconds
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): ConnectionPoolStats {
    const stats = this.getConnectionStats()
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024 // MB

    return {
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      subscriptions: stats.subscriptions,
      messagesPerSecond: stats.messagesPerSecond,
      averageLatency: 0, // Would need actual latency tracking
      memoryUsage: Math.round(memoryUsage * 100) / 100
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat()
    }, this.config.heartbeatInterval)
  }

  /**
   * Perform heartbeat check
   */
  private performHeartbeat(): void {
    const now = Date.now()
    const timeout = this.config.connectionTimeout

    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastActivity > timeout) {
        logger.warn('Connection timeout, terminating', {
          connectionId,
          lastActivity: connection.lastActivity,
          timeout
        })

        connection.isAlive = false
        this.removeConnection(connectionId)
      } else if (connection.isAlive) {
        // Send ping
        const pingMessage: WebSocketMessage = {
          id: `ping_${Date.now()}`,
          type: 'ping',
          payload: { timestamp: now },
          timestamp: now
        }

        this.sendToConnection(connectionId, pingMessage)
      }
    }
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    if (!this.config.enableBatching) {
      return
    }

    this.batchTimeout = setInterval(() => {
      if (this.messageQueue.length > 0) {
        this.processBatch()
      }
    }, this.config.messageBatchTimeout)
  }

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    setInterval(() => {
      this.performCleanup()
    }, 60000) // Every minute
  }

  /**
   * Perform cleanup operations
   */
  private performCleanup(): void {
    const now = Date.now()
    const timeout = this.config.connectionTimeout

    // Clean up dead connections
    for (const [connectionId, connection] of this.connections) {
      if (!connection.isAlive && (now - connection.lastActivity > timeout)) {
        this.removeConnection(connectionId)
      }
    }

    // Clean up empty subscriptions
    for (const [channel, subscribers] of this.subscriptions) {
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel)
      }
    }

    // Reset message stats
    if (now - this.messageStats.lastReset > 60000) { // Every minute
      this.messageStats.sent = 0
      this.messageStats.received = 0
      this.messageStats.lastReset = now
    }

    logger.debug('WebSocket cleanup completed', {
      connections: this.connections.size,
      subscriptions: this.subscriptions.size
    })
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    connections: number
    subscriptions: number
    messageRate: number
    memoryUsage: number
  }> {
    const stats = this.getConnectionStats()
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (stats.totalConnections > this.config.maxConnections * 0.9) {
      status = 'degraded'
    }

    if (stats.totalConnections >= this.config.maxConnections || memoryUsage > 500) {
      status = 'unhealthy'
    }

    return {
      status,
      connections: stats.totalConnections,
      subscriptions: stats.subscriptions,
      messageRate: stats.messagesPerSecond,
      memoryUsage: Math.round(memoryUsage * 100) / 100
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    if (this.batchTimeout) {
      clearInterval(this.batchTimeout)
    }

    this.connections.clear()
    this.subscriptions.clear()
    this.messageQueue.length = 0
    this.connectionPool.clear()

    logger.info('WebSocket optimizer cleaned up')
  }
}

// Export singleton instance
export const websocketOptimizer = new WebSocketOptimizer()

// Export factory function
export function createWebSocketOptimizer(config?: WebSocketConfig): WebSocketOptimizer {
  return new WebSocketOptimizer(config)
}