import { NextRequest, NextResponse } from 'next/server'
import { loadBalancer } from '@/lib/monitoring/load-balancer'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { logger } from '@/lib/logger'

export interface APILoadBalancerConfig {
  enableHealthChecks?: boolean
  healthCheckInterval?: number
  enableMetrics?: boolean
  fallbackStrategy?: 'queue' | 'error' | 'degraded'
  retryAttempts?: number
  timeout?: number
}

export class APILoadBalancerMiddleware {
  private config: APILoadBalancerConfig
  private requestQueue: Map<string, { resolve: Function, reject: Function, timestamp: number }[]> = new Map()
  private processingQueue = false

  constructor(config: APILoadBalancerConfig = {}) {
    this.config = {
      enableHealthChecks: true,
      healthCheckInterval: 30000,
      enableMetrics: true,
      fallbackStrategy: 'queue',
      retryAttempts: 3,
      timeout: 30000,
      ...config
    }

    if (this.config.enableHealthChecks) {
      this.startHealthChecks()
    }
  }

  /**
   * Main middleware function
   */
  async handleRequest(
    request: NextRequest,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const startTime = Date.now()
    const endpoint = this.getEndpointFromPath(request.nextUrl.pathname)
    const method = request.method
    const clientIP = this.getClientIP(request)

    try {
      // Check if load balancer has healthy servers
      const servers = loadBalancer.getServers()
      const healthyServers = servers.filter(s => s.healthy)

      if (healthyServers.length === 0) {
        return this.handleNoHealthyServers(request, endpoint, method)
      }

      // Select server using load balancing strategy
      const selectedServer = loadBalancer.selectServer(clientIP)

      if (!selectedServer) {
        return this.handleNoServerSelected(request, endpoint, method)
      }

      // Record metrics
      if (this.config.enableMetrics) {
        await performanceMonitor.recordAPIMetric({
          endpoint,
          method,
          response_time_ms: 0, // Will be updated after response
          status_code: 200,
          user_agent: request.headers.get('user-agent') || undefined,
          ip_address: clientIP,
          timestamp: new Date().toISOString()
        })
      }

      // Forward request to selected server
      const response = await this.forwardRequest(request, selectedServer, startTime)

      // Update server load metrics
      const responseTime = Date.now() - startTime
      loadBalancer.updateServerLoad(selectedServer.id, Math.min(100, selectedServer.load + 1))

      // Record final metrics
      if (this.config.enableMetrics) {
        await performanceMonitor.recordAPIMetric({
          endpoint,
          method,
          response_time_ms: responseTime,
          status_code: response.status,
          user_agent: request.headers.get('user-agent') || undefined,
          ip_address: clientIP,
          timestamp: new Date().toISOString()
        })
      }

      return response

    } catch (error) {
      const responseTime = Date.now() - startTime

      logger.error('Load balancer error', {
        error: error instanceof Error ? error.message : String(error),
        endpoint,
        method,
        clientIP,
        responseTime
      })

      // Record error metrics
      if (this.config.enableMetrics) {
        await performanceMonitor.recordAPIMetric({
          endpoint,
          method,
          response_time_ms: responseTime,
          status_code: 500,
          user_agent: request.headers.get('user-agent') || undefined,
          ip_address: clientIP,
          timestamp: new Date().toISOString()
        })
      }

      return this.handleLoadBalancerError(request, error as Error)
    }
  }

  /**
   * Forward request to selected server
   */
  private async forwardRequest(
    request: NextRequest,
    server: any,
    startTime: number
  ): Promise<NextResponse> {
    const timeout = this.config.timeout || 30000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // Create target URL
      const targetUrl = new URL(request.nextUrl.pathname, `http://${server.host}:${server.port}`)

      // Copy query parameters
      if (request.nextUrl.search) {
        targetUrl.search = request.nextUrl.search
      }

      // Forward headers
      const headers = new Headers()
      request.headers.forEach((value, key) => {
        // Skip hop-by-hop headers
        if (!['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'].includes(key.toLowerCase())) {
          headers.set(key, value)
        }
      })

      // Add load balancer headers
      headers.set('X-Load-Balancer-Server', server.id)
      headers.set('X-Load-Balancer-Start', startTime.toString())

      // Make request to target server
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Create new response with forwarded headers
      const newResponse = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })

      // Add load balancer response headers
      newResponse.headers.set('X-Load-Balancer-Processed', 'true')
      newResponse.headers.set('X-Load-Balancer-Server', server.id)

      return newResponse

    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }

      throw error
    }
  }

  /**
   * Handle case when no healthy servers are available
   */
  private handleNoHealthyServers(
    request: NextRequest,
    endpoint: string,
    method: string
  ): NextResponse {
    logger.warn('No healthy servers available', { endpoint, method })

    switch (this.config.fallbackStrategy) {
      case 'queue':
        return this.queueRequest(request, endpoint, method)
      case 'degraded':
        return this.handleDegradedResponse(request)
      case 'error':
      default:
        return new NextResponse(
          JSON.stringify({
            error: 'Service temporarily unavailable',
            code: 'NO_HEALTHY_SERVERS'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        )
    }
  }

  /**
   * Handle case when no server was selected
   */
  private handleNoServerSelected(
    request: NextRequest,
    endpoint: string,
    method: string
  ): NextResponse {
    logger.warn('No server selected by load balancer', { endpoint, method })

    return new NextResponse(
      JSON.stringify({
        error: 'Service temporarily unavailable',
        code: 'NO_SERVER_SELECTED'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  /**
   * Queue request for later processing
   */
  private queueRequest(
    request: NextRequest,
    endpoint: string,
    method: string
  ): NextResponse {
    return new Promise((resolve, reject) => {
      const queueKey = `${method}:${endpoint}`
      const queue = this.requestQueue.get(queueKey) || []

      queue.push({ resolve, reject, timestamp: Date.now() })
      this.requestQueue.set(queueKey, queue)

      // Process queue if not already processing
      if (!this.processingQueue) {
        this.processQueue()
      }

      // Set timeout for queue
      setTimeout(() => {
        const queueIndex = queue.findIndex(item => item.resolve === resolve)
        if (queueIndex !== -1) {
          queue.splice(queueIndex, 1)
          reject(new Error('Request timeout in queue'))
        }
      }, 30000) // 30 second timeout
    }) as any
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue) return

    this.processingQueue = true

    try {
      while (this.requestQueue.size > 0) {
        const servers = loadBalancer.getServers()
        const healthyServers = servers.filter(s => s.healthy)

        if (healthyServers.length === 0) {
          // Wait for healthy servers
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }

        // Process all queued requests
        for (const [queueKey, queue] of this.requestQueue.entries()) {
          if (queue.length === 0) continue

          const requestData = queue.shift()!
          if (!requestData) continue

          try {
            // This would need to reconstruct the original request
            // For now, we'll just resolve with a degraded response
            requestData.resolve(this.handleDegradedResponse(requestData as any))
          } catch (error) {
            requestData.reject(error)
          }
        }

        this.requestQueue.clear()
      }
    } finally {
      this.processingQueue = false
    }
  }

  /**
   * Handle degraded response
   */
  private handleDegradedResponse(request: NextRequest): NextResponse {
    return new NextResponse(
      JSON.stringify({
        error: 'Service degraded',
        message: 'Request processed with reduced functionality',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Degraded': 'true'
        }
      }
    )
  }

  /**
   * Handle load balancer errors
   */
  private handleLoadBalancerError(
    request: NextRequest,
    error: Error
  ): NextResponse {
    switch (this.config.fallbackStrategy) {
      case 'queue':
        return this.queueRequest(request, this.getEndpointFromPath(request.nextUrl.pathname), request.method)
      case 'degraded':
        return this.handleDegradedResponse(request)
      case 'error':
      default:
        return new NextResponse(
          JSON.stringify({
            error: 'Internal server error',
            message: error.message,
            code: 'LOAD_BALANCER_ERROR'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
    }
  }

  /**
   * Extract endpoint from path
   */
  private getEndpointFromPath(pathname: string): string {
    // Remove API prefix and extract endpoint
    const cleanPath = pathname.replace(/^\/api/, '').replace(/\/$/, '')
    return cleanPath || '/'
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    // Check various headers for real IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const clientIP = request.headers.get('x-client-ip')

    return forwardedFor?.split(',')[0]?.trim() ||
           realIP ||
           clientIP ||
           'unknown'
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    setInterval(async () => {
      const servers = loadBalancer.getServers()

      for (const server of servers) {
        try {
          const isHealthy = await this.checkServerHealth(server)
          server.healthy = isHealthy

          if (!isHealthy) {
            logger.warn('Server health check failed', {
              serverId: server.id,
              host: server.host,
              port: server.port
            })
          }
        } catch (error) {
          logger.error('Health check error', {
            error,
            serverId: server.id,
            host: server.host,
            port: server.port
          })
        }
      }
    }, this.config.healthCheckInterval)
  }

  /**
   * Check server health
   */
  private async checkServerHealth(server: any): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`http://${server.host}:${server.port}/health`, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Get load balancer statistics
   */
  getStatistics() {
    return loadBalancer.getStatistics()
  }

  /**
   * Add server to load balancer
   */
  addServer(server: { id: string, host: string, port: number, region?: string, zone?: string }) {
    loadBalancer.addServer(server)
  }

  /**
   * Remove server from load balancer
   */
  removeServer(serverId: string) {
    loadBalancer.removeServer(serverId)
  }

  /**
   * Set load balancing strategy
   */
  setStrategy(strategy: 'round-robin' | 'least-connections' | 'weighted' | 'ip-hash' | 'least-response-time') {
    loadBalancer.setStrategy(strategy)
  }
}

// Export singleton instance
export const apiLoadBalancer = new APILoadBalancerMiddleware()

// Export factory function
export function createAPILoadBalancer(config?: APILoadBalancerConfig) {
  return new APILoadBalancerMiddleware(config)
}