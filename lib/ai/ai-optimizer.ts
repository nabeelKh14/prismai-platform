import { createRedisCache } from '@/lib/cache/redis-cache'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { logger } from '@/lib/logger'
import { geminiClient, ChatCompletionRequest, EmbeddingRequest } from './gemini-client'

export interface AIOptimizationConfig {
  enableRequestBatching?: boolean
  enableDeduplication?: boolean
  enableFallback?: boolean
  cacheTTL?: number
  batchTimeout?: number
  maxBatchSize?: number
  rateLimitPerMinute?: number
  costOptimization?: boolean
}

export interface CachedAIResponse {
  response: any
  tokens: number
  cost: number
  cached: boolean
  responseTime: number
}

export interface BatchRequest {
  id: string
  request: ChatCompletionRequest | EmbeddingRequest
  resolve: (value: any) => void
  reject: (error: any) => void
  timestamp: number
  priority: number
}

export class AIOptimizer {
  private cache = createRedisCache({ ttl: 3600000 }) // 1 hour default
  private requestQueue: BatchRequest[] = []
  private processingBatch = false
  private rateLimitTokens = new Map<string, number>()
  private rateLimitWindow = 60000 // 1 minute
  private config: Required<AIOptimizationConfig>

  constructor(config?: AIOptimizationConfig) {
    this.config = {
      enableRequestBatching: true,
      enableDeduplication: true,
      enableFallback: true,
      cacheTTL: 3600000, // 1 hour
      batchTimeout: 100, // 100ms
      maxBatchSize: 10,
      rateLimitPerMinute: 60,
      costOptimization: true,
      ...config
    }

    if (this.config.enableRequestBatching) {
      this.startBatchProcessor()
    }
  }

  /**
   * Generate cache key for AI requests
   */
  private generateCacheKey(request: ChatCompletionRequest | EmbeddingRequest): string {
    const baseRequest = {
      ...request,
      model: request.model || 'gemini-1.5-flash'
    }

    // Add type-specific fields for chat completions
    if ('messages' in request) {
      ;(baseRequest as any).temperature = request.temperature || 0.7
      ;(baseRequest as any).maxTokens = request.maxTokens || 1000
    }

    const requestStr = JSON.stringify(baseRequest)

    // Create hash for consistent caching
    let hash = 0
    for (let i = 0; i < requestStr.length; i++) {
      const char = requestStr.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return `ai:${Math.abs(hash)}`
  }

  /**
   * Check if request should be rate limited
   */
  private checkRateLimit(identifier: string): boolean {
    const now = Date.now()
    const windowStart = now - this.rateLimitWindow

    // Clean old entries
    for (const [key, timestamp] of this.rateLimitTokens.entries()) {
      if (timestamp < windowStart) {
        this.rateLimitTokens.delete(key)
      }
    }

    const currentCount = Array.from(this.rateLimitTokens.values())
      .filter(timestamp => timestamp >= windowStart).length

    return currentCount >= this.config.rateLimitPerMinute
  }

  /**
   * Record rate limit usage
   */
  private recordRateLimitUsage(identifier: string): void {
    this.rateLimitTokens.set(identifier, Date.now())
  }

  /**
   * Calculate AI API cost
   */
  private calculateCost(tokens: number, model: string): number {
    // Gemini pricing (approximate)
    const pricing: Record<string, number> = {
      'gemini-1.5-flash': 0.000075 / 1000, // $0.075 per 1M input tokens
      'gemini-1.5-pro': 0.00125 / 1000,    // $1.25 per 1M input tokens
      'text-embedding-004': 0.000025 / 1000 // $0.025 per 1M tokens
    }

    return (tokens * (pricing[model] || 0.0001)) * 100 // Convert to cents
  }

  /**
   * Optimized chat completion with caching and batching
   */
  async createChatCompletion(
    request: ChatCompletionRequest,
    options?: {
      useCache?: boolean
      priority?: number
      skipBatching?: boolean
      userId?: string
    }
  ): Promise<CachedAIResponse> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(request)
    const model = request.model || 'gemini-1.5-flash'
    const identifier = options?.userId || 'anonymous'

    // Check rate limit
    if (this.checkRateLimit(identifier)) {
      throw new Error('Rate limit exceeded. Please try again later.')
    }

    // Check cache first
    if (options?.useCache !== false) {
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        const responseTime = Date.now() - startTime
        await performanceMonitor.recordAPIMetric({
          endpoint: '/ai/chat',
          method: 'POST',
          response_time_ms: responseTime,
          status_code: 200,
          timestamp: new Date().toISOString()
        })

        return {
          ...cached,
          cached: true,
          responseTime
        }
      }
    }

    // Use batching if enabled and not skipped
    if (this.config.enableRequestBatching && !options?.skipBatching) {
      return this.processBatchRequest({
        id: cacheKey,
        request,
        resolve: () => {},
        reject: () => {},
        timestamp: startTime,
        priority: options?.priority || 1
      })
    }

    // Direct API call
    try {
      const response = await geminiClient.createChatCompletion(request)
      const responseTime = Date.now() - startTime
      const totalTokens = response.usage.totalTokens
      const cost = this.calculateCost(totalTokens, model)

      // Cache the response
      await this.cache.set(cacheKey, {
        response,
        tokens: totalTokens,
        cost,
        cached: false,
        responseTime
      }, this.config.cacheTTL)

      // Record metrics
      await performanceMonitor.recordAPIMetric({
        endpoint: '/ai/chat',
        method: 'POST',
        response_time_ms: responseTime,
        status_code: 200,
        timestamp: new Date().toISOString()
      })

      this.recordRateLimitUsage(identifier)

      return {
        response,
        tokens: totalTokens,
        cost,
        cached: false,
        responseTime
      }

    } catch (error) {
      const responseTime = Date.now() - startTime

      await performanceMonitor.recordAPIMetric({
        endpoint: '/ai/chat',
        method: 'POST',
        response_time_ms: responseTime,
        status_code: 500,
        timestamp: new Date().toISOString()
      })

      throw error
    }
  }

  /**
   * Optimized embedding generation with caching
   */
  async createEmbedding(
    request: EmbeddingRequest,
    options?: {
      useCache?: boolean
      priority?: number
      userId?: string
    }
  ): Promise<CachedAIResponse> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(request)
    const model = request.model || 'text-embedding-004'
    const identifier = options?.userId || 'anonymous'

    // Check rate limit
    if (this.checkRateLimit(identifier)) {
      throw new Error('Rate limit exceeded. Please try again later.')
    }

    // Check cache first
    if (options?.useCache !== false) {
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        const responseTime = Date.now() - startTime
        await performanceMonitor.recordAPIMetric({
          endpoint: '/ai/embedding',
          method: 'POST',
          response_time_ms: responseTime,
          status_code: 200,
          timestamp: new Date().toISOString()
        })

        return {
          ...cached,
          cached: true,
          responseTime
        }
      }
    }

    try {
      const response = await geminiClient.createEmbedding(request)
      const responseTime = Date.now() - startTime
      const tokens = Math.ceil(request.input.length / 4) // Approximate token count
      const cost = this.calculateCost(tokens, model)

      // Cache the response
      await this.cache.set(cacheKey, {
        response,
        tokens,
        cost,
        cached: false,
        responseTime
      }, this.config.cacheTTL)

      // Record metrics
      await performanceMonitor.recordAPIMetric({
        endpoint: '/ai/embedding',
        method: 'POST',
        response_time_ms: responseTime,
        status_code: 200,
        timestamp: new Date().toISOString()
      })

      this.recordRateLimitUsage(identifier)

      return {
        response,
        tokens,
        cost,
        cached: false,
        responseTime
      }

    } catch (error) {
      const responseTime = Date.now() - startTime

      await performanceMonitor.recordAPIMetric({
        endpoint: '/ai/embedding',
        method: 'POST',
        response_time_ms: responseTime,
        status_code: 500,
        timestamp: new Date().toISOString()
      })

      throw error
    }
  }

  /**
   * Process batch requests
   */
  private async processBatchRequest(batchRequest: BatchRequest): Promise<CachedAIResponse> {
    return new Promise((resolve, reject) => {
      batchRequest.resolve = resolve
      batchRequest.reject = reject
      this.requestQueue.push(batchRequest)

      // Sort by priority (higher priority first)
      this.requestQueue.sort((a, b) => b.priority - a.priority)

      // Trigger batch processing if not already running
      if (!this.processingBatch) {
        this.processBatch()
      }
    })
  }

  /**
   * Process batched requests
   */
  private async processBatch(): Promise<void> {
    if (this.processingBatch || this.requestQueue.length === 0) {
      return
    }

    this.processingBatch = true

    try {
      // Group similar requests
      const batches = this.groupSimilarRequests()

      for (const batch of batches) {
        await this.processBatchGroup(batch)
      }

    } catch (error) {
      logger.error('Batch processing error', { error })
    } finally {
      this.processingBatch = false

      // Process remaining requests if any
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.processBatch(), 10)
      }
    }
  }

  /**
   * Group similar requests for batching
   */
  private groupSimilarRequests(): BatchRequest[][] {
    const groups: BatchRequest[][] = []
    const processed = new Set<string>()

    for (const request of this.requestQueue) {
      if (processed.has(request.id)) continue

      const group = [request]
      processed.add(request.id)

      // Find similar requests (same model, temperature, etc.)
      for (const otherRequest of this.requestQueue) {
        if (processed.has(otherRequest.id)) continue

        const similar = this.areRequestsSimilar(request.request, otherRequest.request)
        if (similar) {
          group.push(otherRequest)
          processed.add(otherRequest.id)
        }
      }

      groups.push(group)
    }

    return groups
  }

  /**
   * Check if two requests are similar enough for batching
   */
  private areRequestsSimilar(req1: any, req2: any): boolean {
    if (req1.model !== req2.model) return false
    if (req1.temperature !== req2.temperature) return false
    if (req1.maxTokens !== req2.maxTokens) return false

    // For chat completions, check if messages are similar
    if (req1.messages && req2.messages) {
      if (req1.messages.length !== req2.messages.length) return false
      return req1.messages.every((msg: any, i: number) =>
        msg.role === req2.messages[i].role &&
        msg.content === req2.messages[i].content
      )
    }

    // For embeddings, check if input is the same
    if (req1.input && req2.input) {
      return req1.input === req2.input
    }

    return false
  }

  /**
   * Process a group of similar requests
   */
  private async processBatchGroup(batch: BatchRequest[]): Promise<void> {
    if (batch.length === 0) return

    const startTime = Date.now()
    const primaryRequest = batch[0].request
    const cacheKey = this.generateCacheKey(primaryRequest)

    try {
      // Check cache for the primary request
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        // Return cached result to all requests in batch
        const responseTime = Date.now() - startTime
        const result = { ...cached, cached: true, responseTime }

        batch.forEach(req => req.resolve(result))
        return
      }

      // Process the actual request
      let response: any
      let tokens: number
      let cost: number

      if ('messages' in primaryRequest) {
        response = await geminiClient.createChatCompletion(primaryRequest)
        tokens = response.usage.totalTokens
        cost = this.calculateCost(tokens, primaryRequest.model || 'gemini-1.5-flash')
      } else {
        response = await geminiClient.createEmbedding(primaryRequest)
        tokens = Math.ceil(primaryRequest.input.length / 4)
        cost = this.calculateCost(tokens, primaryRequest.model || 'text-embedding-004')
      }

      const responseTime = Date.now() - startTime

      // Cache the result
      await this.cache.set(cacheKey, {
        response,
        tokens,
        cost,
        cached: false,
        responseTime
      }, this.config.cacheTTL)

      // Record metrics
      await performanceMonitor.recordAPIMetric({
        endpoint: '/ai/batch',
        method: 'POST',
        response_time_ms: responseTime,
        status_code: 200,
        timestamp: new Date().toISOString()
      })

      // Record rate limit usage for each request
      batch.forEach(req => {
        const identifier = (req.request as any).userId || 'anonymous'
        this.recordRateLimitUsage(identifier)
      })

      // Return result to all requests
      const result = {
        response,
        tokens,
        cost,
        cached: false,
        responseTime
      }

      batch.forEach(req => req.resolve(result))

    } catch (error) {
      const responseTime = Date.now() - startTime

      await performanceMonitor.recordAPIMetric({
        endpoint: '/ai/batch',
        method: 'POST',
        response_time_ms: responseTime,
        status_code: 500,
        timestamp: new Date().toISOString()
      })

      // Reject all requests in batch
      batch.forEach(req => req.reject(error))
    }
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    setInterval(() => {
      if (this.requestQueue.length > 0 && !this.processingBatch) {
        this.processBatch()
      }
    }, this.config.batchTimeout)
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalRequests: number
    cacheHits: number
    cacheMisses: number
    hitRate: number
    totalCost: number
    savedCost: number
  }> {
    // This would require additional tracking in production
    // For now, return basic stats
    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      totalCost: 0,
      savedCost: 0
    }
  }

  /**
   * Clear cache for specific patterns
   */
  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      await this.cache.deletePattern(pattern)
    } else {
      // Clear all AI cache
      await this.cache.deletePattern('ai:*')
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(identifier: string): {
    remaining: number
    resetTime: number
    limited: boolean
  } {
    const now = Date.now()
    const windowStart = now - this.rateLimitWindow

    // Clean old entries
    for (const [key, timestamp] of this.rateLimitTokens.entries()) {
      if (timestamp < windowStart) {
        this.rateLimitTokens.delete(key)
      }
    }

    const currentCount = Array.from(this.rateLimitTokens.values())
      .filter(timestamp => timestamp >= windowStart).length

    return {
      remaining: Math.max(0, this.config.rateLimitPerMinute - currentCount),
      resetTime: windowStart + this.rateLimitWindow,
      limited: currentCount >= this.config.rateLimitPerMinute
    }
  }
}

// Export singleton instance
export const aiOptimizer = new AIOptimizer()

// Export factory function for custom configurations
export function createAIOptimizer(config?: AIOptimizationConfig): AIOptimizer {
  return new AIOptimizer(config)
}