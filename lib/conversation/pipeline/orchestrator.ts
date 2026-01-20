import { logger } from '@/lib/logger'
import { messageIngestionService, IngestedMessage } from './message-ingestion'
import { realTimeProcessor, ProcessingResult, ConversationAnalysis } from './real-time-processor'
import { conversationAnalysisHandler } from '@/lib/websocket/conversation-analysis-handler'
import { conversationIntelligenceMonitor } from '@/lib/monitoring/conversation-intelligence-monitor'

export interface TenantConfig {
  tenantId: string
  enabled: boolean
  rateLimit: number
  maxConcurrentAnalyses: number
  enableCaching: boolean
  cacheTtl: number
  priority: 'low' | 'normal' | 'high'
  features: {
    emotionDetection: boolean
    intentClassification: boolean
    realTimeProcessing: boolean
    batchProcessing: boolean
  }
  webhook?: {
    url: string
    events: string[]
    secret?: string
  }
}

export interface PipelineHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  components: {
    ingestion: 'healthy' | 'degraded' | 'unhealthy'
    processing: 'healthy' | 'degraded' | 'unhealthy'
    websocket: 'healthy' | 'degraded' | 'unhealthy'
    monitoring: 'healthy' | 'degraded' | 'unhealthy'
  }
  metrics: {
    totalProcessed: number
    averageLatency: number
    errorRate: number
    activeConnections: number
  }
  issues: string[]
  lastChecked: string
}

export interface PipelineOrchestratorConfig {
  enableAutoRecovery: boolean
  healthCheckInterval: number
  maxRecoveryAttempts: number
  enableLoadBalancing: boolean
  enableCircuitBreaker: boolean
  circuitBreakerThreshold: number
  fallbackMode: 'cache' | 'degraded' | 'offline'
  enableMetrics: boolean
  metricsInterval: number
}

export class PipelineOrchestrator {
  private tenantConfigs: Map<string, TenantConfig> = new Map()
  private healthStatus: PipelineHealth
  private recoveryAttempts: Map<string, number> = new Map()
  private circuitBreakerState: Map<string, 'closed' | 'open' | 'half-open'> = new Map()
  private processingQueue: Array<{
    message: IngestedMessage
    priority: number
    tenantId: string
  }> = []

  private healthCheckTimer?: NodeJS.Timeout
  private metricsTimer?: NodeJS.Timeout
  private processingTimer?: NodeJS.Timeout

  private config: Required<PipelineOrchestratorConfig>

  constructor(config?: Partial<PipelineOrchestratorConfig>) {
    this.config = {
      enableAutoRecovery: true,
      healthCheckInterval: 30000, // 30 seconds
      maxRecoveryAttempts: 3,
      enableLoadBalancing: true,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 0.1, // 10% error rate
      fallbackMode: 'cache',
      enableMetrics: true,
      metricsInterval: 60000, // 1 minute
      ...config
    }

    this.healthStatus = this.getInitialHealthStatus()

    this.startHealthMonitoring()
    this.startMetricsCollection()
    this.startMessageProcessing()
  }

  /**
   * Configure tenant settings
   */
  configureTenant(config: TenantConfig): void {
    this.tenantConfigs.set(config.tenantId, config)

    logger.info('Tenant configuration updated', {
      tenantId: config.tenantId,
      enabled: config.enabled,
      rateLimit: config.rateLimit
    })
  }

  /**
   * Process conversation message through the entire pipeline
   */
  async processConversationMessage(
    conversationId: string,
    content: string,
    channel: string = 'chat',
    tenantId?: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<{
    success: boolean
    results?: ProcessingResult
    analysis?: ConversationAnalysis
    errors?: string[]
  }> {
    const startTime = Date.now()

    try {
      // Get tenant configuration
      const tenantConfig = this.tenantConfigs.get(tenantId || 'default')
      if (!tenantConfig?.enabled) {
        return {
          success: false,
          errors: ['Tenant not enabled or not found']
        }
      }

      // Check circuit breaker
      if (this.config.enableCircuitBreaker && this.isCircuitBreakerOpen(tenantId || 'default')) {
        return await this.handleCircuitBreakerFallback(conversationId, content, tenantConfig)
      }

      // Ingest message
      const ingestionResult = await messageIngestionService.ingestMessage(
        conversationId,
        channel as any,
        { text: content },
        {
          tenantId,
          userId,
          priority: tenantConfig.priority,
          ...metadata
        }
      )

      if (!ingestionResult.success || !ingestionResult.messageId) {
        throw new Error(`Message ingestion failed: ${ingestionResult.errors?.join(', ')}`)
      }

      // Get message for processing
      const messages = messageIngestionService.getMessagesForProcessing(1)
      const message = messages.find(m => m.id === ingestionResult.messageId)

      if (!message) {
        throw new Error('Message not found after ingestion')
      }

      // Process message
      const processingResult = await realTimeProcessor.processMessage(message)

      // Generate conversation analysis if enabled
      let analysis: ConversationAnalysis | undefined
      if (tenantConfig.features.realTimeProcessing) {
        try {
          // In a real implementation, this would fetch conversation context
          // For now, we'll create a basic context
          const context = {
            conversationId,
            messages: [{
              id: message.id,
              text: content,
              timestamp: message.metadata.timestamp,
              channel: message.channel
            }],
            participants: [
              {
                id: userId || 'unknown',
                role: 'customer' as const
              }
            ],
            metadata: {
              tenantId,
              language: message.metadata.language,
              startedAt: message.metadata.timestamp,
              lastActivity: message.metadata.timestamp,
              messageCount: 1
            }
          }

          analysis = await realTimeProcessor.processConversation(conversationId, context)
        } catch (error) {
          logger.error('Conversation analysis failed', error as Error, {
            conversationId,
            tenantId
          })
        }
      }

      // Send results via WebSocket if clients are subscribed
      await conversationAnalysisHandler.subscribeToConversation(
        userId || 'system',
        conversationId
      )

      // Trigger webhook if configured
      if (tenantConfig.webhook) {
        await this.triggerWebhook(tenantConfig, {
          type: 'conversation_analysis',
          conversationId,
          messageId: message.id,
          results: processingResult,
          analysis,
          timestamp: new Date().toISOString()
        })
      }

      const totalTime = Date.now() - startTime

      logger.info('Conversation message processed successfully', {
        conversationId,
        tenantId,
        processingTime: totalTime,
        hasAnalysis: !!analysis
      })

      return {
        success: true,
        results: processingResult,
        analysis
      }

    } catch (error) {
      const totalTime = Date.now() - startTime

      logger.error('Pipeline processing failed', error as Error, {
        conversationId,
        tenantId,
        processingTime: totalTime
      })

      // Record failure
      conversationIntelligenceMonitor.recordFailure(
        conversationId,
        tenantId || 'default',
        error as Error,
        { processingTime: totalTime }
      )

      // Check circuit breaker
      if (this.config.enableCircuitBreaker) {
        this.updateCircuitBreaker(tenantId || 'default', false)
      }

      return {
        success: false,
        errors: [(error as Error).message]
      }
    }
  }

  /**
   * Process multiple messages in batch
   */
  async processBatch(
    messages: Array<{
      conversationId: string
      content: string
      channel?: string
      tenantId?: string
      userId?: string
      metadata?: Record<string, any>
    }>
  ): Promise<Array<{
    success: boolean
    conversationId: string
    results?: ProcessingResult
    errors?: string[]
  }>> {
    const results = []

    // Process with load balancing
    if (this.config.enableLoadBalancing) {
      const batches = this.distributeLoad(messages)
      const batchPromises = batches.map(batch => this.processBatchInternal(batch))
      const batchResults = await Promise.all(batchPromises)

      for (const batchResult of batchResults) {
        results.push(...batchResult)
      }
    } else {
      results.push(...await this.processBatchInternal(messages))
    }

    return results
  }

  /**
   * Get pipeline health status
   */
  async getHealth(): Promise<PipelineHealth> {
    const now = new Date().toISOString()

    try {
      // Check component health
      const ingestionHealth = await messageIngestionService.healthCheck() ? 'healthy' : 'unhealthy'
      const processingHealth = await realTimeProcessor.healthCheck() ? 'healthy' : 'unhealthy'
      const websocketHealth = await conversationAnalysisHandler.healthCheck() ? 'healthy' : 'unhealthy'
      const monitoringHealth = await conversationIntelligenceMonitor.healthCheck().then(h => h.healthy ? 'healthy' : 'unhealthy')

      // Determine overall status
      const componentStatuses = [ingestionHealth, processingHealth, websocketHealth, monitoringHealth]
      const unhealthyCount = componentStatuses.filter(s => s === 'unhealthy').length
      const degradedCount = componentStatuses.filter(s => s === 'degraded').length

      let overallStatus: PipelineHealth['status'] = 'healthy'
      if (unhealthyCount > 0) {
        overallStatus = 'unhealthy'
      } else if (degradedCount > 0) {
        overallStatus = 'degraded'
      }

      // Get metrics
      const processingStats = realTimeProcessor.getProcessingStats()
      const connectionStats = conversationAnalysisHandler.getConnectionStats()
      const monitorMetrics = conversationIntelligenceMonitor.getMetrics()

      const issues: string[] = []
      if (processingStats.errorRate > 0.1) {
        issues.push(`High error rate: ${(processingStats.errorRate * 100).toFixed(1)}%`)
      }
      if (processingStats.averageProcessingTime > 200) {
        issues.push(`High latency: ${processingStats.averageProcessingTime.toFixed(0)}ms`)
      }
      if (connectionStats.queuedMessages > 100) {
        issues.push(`Large message queue: ${connectionStats.queuedMessages} messages`)
      }

      this.healthStatus = {
        status: overallStatus,
        components: {
          ingestion: ingestionHealth,
          processing: processingHealth,
          websocket: websocketHealth,
          monitoring: monitoringHealth
        },
        metrics: {
          totalProcessed: processingStats.totalProcessed,
          averageLatency: processingStats.averageProcessingTime,
          errorRate: processingStats.errorRate,
          activeConnections: connectionStats.activeConnections
        },
        issues,
        lastChecked: now
      }

      return this.healthStatus

    } catch (error) {
      logger.error('Health check failed', error as Error)

      this.healthStatus = {
        ...this.healthStatus,
        status: 'unhealthy',
        issues: [...this.healthStatus.issues, 'Health check failed'],
        lastChecked: now
      }

      return this.healthStatus
    }
  }

  /**
   * Trigger auto-recovery for failed components
   */
  private async triggerAutoRecovery(component: string): Promise<boolean> {
    const attempts = this.recoveryAttempts.get(component) || 0

    if (attempts >= this.config.maxRecoveryAttempts) {
      logger.error('Max recovery attempts reached', { component, attempts })
      return false
    }

    this.recoveryAttempts.set(component, attempts + 1)

    try {
      logger.info('Starting auto-recovery', { component, attempt: attempts + 1 })

      switch (component) {
        case 'ingestion':
          // Reset ingestion service state
          break
        case 'processing':
          // Reset processing state and clear cache
          realTimeProcessor.cleanupCache()
          break
        case 'websocket':
          // Clean up inactive connections
          conversationAnalysisHandler.cleanupInactiveConnections()
          break
        case 'monitoring':
          // Reset monitoring metrics
          conversationIntelligenceMonitor.resetMetrics()
          break
      }

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Check if recovery was successful
      const health = await this.getHealth()
      const componentHealth = health.components[component as keyof typeof health.components]

      if (componentHealth === 'healthy') {
        this.recoveryAttempts.delete(component)
        logger.info('Auto-recovery successful', { component })
        return true
      }

      return false

    } catch (error) {
      logger.error('Auto-recovery failed', error as Error, { component })
      return false
    }
  }

  private async handleCircuitBreakerFallback(
    conversationId: string,
    content: string,
    tenantConfig: TenantConfig
  ): Promise<{ success: boolean; results?: ProcessingResult; errors?: string[] }> {
    logger.warn('Circuit breaker open, using fallback mode', {
      conversationId,
      tenantId: tenantConfig.tenantId,
      fallbackMode: this.config.fallbackMode
    })

    switch (this.config.fallbackMode) {
      case 'cache':
        // Try to return cached results
        return {
          success: true,
          results: {
            conversationId,
            messageId: 'fallback',
            processingTime: 0,
            timestamp: new Date().toISOString(),
            cached: true
          }
        }

      case 'degraded':
        // Process with reduced functionality
        return {
          success: true,
          results: {
            conversationId,
            messageId: 'fallback',
            processingTime: 0,
            timestamp: new Date().toISOString(),
            cached: false
          }
        }

      case 'offline':
      default:
        return {
          success: false,
          errors: ['Service temporarily unavailable']
        }
    }
  }

  private async processBatchInternal(
    messages: Array<{
      conversationId: string
      content: string
      channel?: string
      tenantId?: string
      userId?: string
      metadata?: Record<string, any>
    }>
  ): Promise<Array<{
    success: boolean
    conversationId: string
    results?: ProcessingResult
    errors?: string[]
  }>> {
    const results = []

    for (const msg of messages) {
      const result = await this.processConversationMessage(
        msg.conversationId,
        msg.content,
        msg.channel,
        msg.tenantId,
        msg.userId,
        msg.metadata
      )
      results.push({
        success: result.success,
        conversationId: msg.conversationId,
        results: result.results,
        errors: result.errors
      })
    }

    return results
  }

  private distributeLoad(messages: any[]): any[][] {
    // Simple round-robin distribution
    // In a real implementation, this would consider tenant priorities and resource usage
    const batches: any[][] = []
    const batchSize = Math.ceil(messages.length / 3) // Distribute across 3 workers

    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize))
    }

    return batches
  }

  private isCircuitBreakerOpen(tenantId: string): boolean {
    return this.circuitBreakerState.get(tenantId) === 'open'
  }

  private updateCircuitBreaker(tenantId: string, success: boolean): void {
    const currentState = this.circuitBreakerState.get(tenantId) || 'closed'

    if (success) {
      if (currentState === 'half-open') {
        this.circuitBreakerState.set(tenantId, 'closed')
        logger.info('Circuit breaker closed', { tenantId })
      }
    } else {
      if (currentState === 'closed') {
        this.circuitBreakerState.set(tenantId, 'open')
        logger.warn('Circuit breaker opened', { tenantId })
      }
    }
  }

  private async triggerWebhook(
    tenantConfig: TenantConfig,
    payload: any
  ): Promise<void> {
    if (!tenantConfig.webhook) return

    try {
      // In a real implementation, this would make an HTTP request to the webhook URL
      logger.info('Webhook triggered', {
        tenantId: tenantConfig.tenantId,
        url: tenantConfig.webhook.url,
        event: payload.type
      })

      // Simulate webhook call
      // await fetch(tenantConfig.webhook.url, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-Webhook-Secret': tenantConfig.webhook.secret || ''
      //   },
      //   body: JSON.stringify(payload)
      // })

    } catch (error) {
      logger.error('Webhook delivery failed', error as Error, {
        tenantId: tenantConfig.tenantId,
        url: tenantConfig.webhook.url
      })
    }
  }

  private getInitialHealthStatus(): PipelineHealth {
    return {
      status: 'healthy',
      components: {
        ingestion: 'healthy',
        processing: 'healthy',
        websocket: 'healthy',
        monitoring: 'healthy'
      },
      metrics: {
        totalProcessed: 0,
        averageLatency: 0,
        errorRate: 0,
        activeConnections: 0
      },
      issues: [],
      lastChecked: new Date().toISOString()
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      const health = await this.getHealth()

      if (health.status === 'unhealthy' && this.config.enableAutoRecovery) {
        // Trigger recovery for unhealthy components
        for (const [component, status] of Object.entries(health.components)) {
          if (status === 'unhealthy') {
            await this.triggerAutoRecovery(component)
          }
        }
      }

      logger.debug('Health check completed', {
        status: health.status,
        components: health.components
      })
    }, this.config.healthCheckInterval)
  }

  private startMetricsCollection(): void {
    if (!this.config.enableMetrics) return

    this.metricsTimer = setInterval(() => {
      const processingStats = realTimeProcessor.getProcessingStats()
      const connectionStats = conversationAnalysisHandler.getConnectionStats()
      const monitorMetrics = conversationIntelligenceMonitor.getMetrics()

      logger.info('Pipeline metrics collected', {
        processing: processingStats,
        connections: connectionStats,
        monitoring: monitorMetrics
      })
    }, this.config.metricsInterval)
  }

  private startMessageProcessing(): void {
    this.processingTimer = setInterval(async () => {
      try {
        // Process queued messages
        const messages = messageIngestionService.getMessagesForProcessing(10)

        for (const message of messages) {
          await realTimeProcessor.processMessage(message)
          messageIngestionService.markAsProcessed(message.id)
        }
      } catch (error) {
        logger.error('Background message processing failed', error as Error)
      }
    }, 1000) // Process every second
  }

  // Cleanup method
  cleanup(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
    }

    if (this.processingTimer) {
      clearInterval(this.processingTimer)
    }

    this.tenantConfigs.clear()
    this.recoveryAttempts.clear()
    this.circuitBreakerState.clear()
    this.processingQueue.length = 0

    logger.info('Pipeline orchestrator cleaned up')
  }
}

// Export singleton instance
export const pipelineOrchestrator = new PipelineOrchestrator()