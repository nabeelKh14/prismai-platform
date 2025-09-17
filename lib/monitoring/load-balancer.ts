import { logger } from '@/lib/logger'
import { performanceMonitor } from './performance-monitor'

export interface ServerInstance {
  id: string
  host: string
  port: number
  healthy: boolean
  load: number // 0-100
  connections: number
  lastHealthCheck: Date
  region?: string
  zone?: string
}

export interface LoadBalancingStrategy {
  name: 'round-robin' | 'least-connections' | 'weighted' | 'ip-hash' | 'least-response-time'
  selectServer: (servers: ServerInstance[], clientIP?: string) => ServerInstance | null
}

export interface AutoScalingConfig {
  minInstances: number
  maxInstances: number
  scaleUpThreshold: number // CPU/memory usage threshold
  scaleDownThreshold: number
  cooldownPeriod: number // seconds
  instanceType: string
}

export interface ScalingMetrics {
  currentInstances: number
  targetInstances: number
  averageLoad: number
  averageResponseTime: number
  totalRequests: number
  lastScalingEvent: Date | null
}

export class LoadBalancer {
  private static instance: LoadBalancer
  private servers: Map<string, ServerInstance> = new Map()
  private strategy: LoadBalancingStrategy
  private autoScalingConfig: AutoScalingConfig | null = null
  private scalingMetrics: ScalingMetrics = {
    currentInstances: 0,
    targetInstances: 0,
    averageLoad: 0,
    averageResponseTime: 0,
    totalRequests: 0,
    lastScalingEvent: null
  }
  private healthCheckInterval: NodeJS.Timeout | null = null
  private scalingInterval: NodeJS.Timeout | null = null

  static getInstance(): LoadBalancer {
    if (!LoadBalancer.instance) {
      LoadBalancer.instance = new LoadBalancer()
    }
    return LoadBalancer.instance
  }

  constructor() {
    this.strategy = this.getRoundRobinStrategy()
    this.startHealthChecks()
  }

  /**
   * Add a server instance to the load balancer
   */
  addServer(server: Omit<ServerInstance, 'healthy' | 'load' | 'connections' | 'lastHealthCheck'>): void {
    const instance: ServerInstance = {
      ...server,
      healthy: true,
      load: 0,
      connections: 0,
      lastHealthCheck: new Date()
    }

    this.servers.set(server.id, instance)
    this.scalingMetrics.currentInstances = this.servers.size

    logger.info('Server added to load balancer', {
      serverId: server.id,
      host: server.host,
      port: server.port
    })
  }

  /**
   * Remove a server instance
   */
  removeServer(serverId: string): void {
    if (this.servers.delete(serverId)) {
      this.scalingMetrics.currentInstances = this.servers.size
      logger.info('Server removed from load balancer', { serverId })
    }
  }

  /**
   * Select server using current load balancing strategy
   */
  selectServer(clientIP?: string): ServerInstance | null {
    const healthyServers = Array.from(this.servers.values()).filter(s => s.healthy)

    if (healthyServers.length === 0) {
      logger.warn('No healthy servers available')
      return null
    }

    const selectedServer = this.strategy.selectServer(healthyServers, clientIP)

    if (selectedServer) {
      selectedServer.connections++
      this.scalingMetrics.totalRequests++
    }

    return selectedServer
  }

  /**
   * Set load balancing strategy
   */
  setStrategy(strategyName: LoadBalancingStrategy['name']): void {
    switch (strategyName) {
      case 'round-robin':
        this.strategy = this.getRoundRobinStrategy()
        break
      case 'least-connections':
        this.strategy = this.getLeastConnectionsStrategy()
        break
      case 'weighted':
        this.strategy = this.getWeightedStrategy()
        break
      case 'ip-hash':
        this.strategy = this.getIPHashStrategy()
        break
      case 'least-response-time':
        this.strategy = this.getLeastResponseTimeStrategy()
        break
    }

    logger.info('Load balancing strategy changed', { strategy: strategyName })
  }

  /**
   * Configure auto-scaling
   */
  configureAutoScaling(config: AutoScalingConfig): void {
    this.autoScalingConfig = config
    this.startAutoScaling()
    logger.info('Auto-scaling configured', config)
  }

  /**
   * Get current scaling metrics
   */
  getScalingMetrics(): ScalingMetrics {
    return { ...this.scalingMetrics }
  }

  /**
   * Get all server instances
   */
  getServers(): ServerInstance[] {
    return Array.from(this.servers.values())
  }

  /**
   * Manually trigger scaling
   */
  async triggerScaling(): Promise<void> {
    if (!this.autoScalingConfig) {
      logger.warn('Auto-scaling not configured')
      return
    }

    await this.evaluateScaling()
  }

  // Private methods

  private getRoundRobinStrategy(): LoadBalancingStrategy {
    let currentIndex = 0

    return {
      name: 'round-robin',
      selectServer: (servers: ServerInstance[]) => {
        if (servers.length === 0) return null

        const server = servers[currentIndex % servers.length]
        currentIndex++
        return server
      }
    }
  }

  private getLeastConnectionsStrategy(): LoadBalancingStrategy {
    return {
      name: 'least-connections',
      selectServer: (servers: ServerInstance[]) => {
        return servers.reduce((min, server) =>
          server.connections < min.connections ? server : min
        )
      }
    }
  }

  private getWeightedStrategy(): LoadBalancingStrategy {
    return {
      name: 'weighted',
      selectServer: (servers: ServerInstance[]) => {
        // Weight based on inverse of load (lower load = higher weight)
        const totalWeight = servers.reduce((sum, server) => sum + (100 - server.load), 0)

        let random = Math.random() * totalWeight
        for (const server of servers) {
          random -= (100 - server.load)
          if (random <= 0) return server
        }

        return servers[0]
      }
    }
  }

  private getIPHashStrategy(): LoadBalancingStrategy {
    return {
      name: 'ip-hash',
      selectServer: (servers: ServerInstance[], clientIP?: string) => {
        if (!clientIP) return servers[0]

        const hash = this.hashString(clientIP)
        return servers[hash % servers.length]
      }
    }
  }

  private getLeastResponseTimeStrategy(): LoadBalancingStrategy {
    return {
      name: 'least-response-time',
      selectServer: (servers: ServerInstance[]) => {
        // This would require tracking response times per server
        // For now, fall back to least connections
        return this.getLeastConnectionsStrategy().selectServer(servers)
      }
    }
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks()
    }, 30000) // Every 30 seconds
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.servers.entries()).map(async ([id, server]) => {
      try {
        const healthy = await this.checkServerHealth(server)

        server.healthy = healthy
        server.lastHealthCheck = new Date()

        if (!healthy) {
          logger.warn('Server health check failed', {
            serverId: id,
            host: server.host,
            port: server.port
          })
        }

      } catch (error) {
        server.healthy = false
        server.lastHealthCheck = new Date()

        logger.error('Health check error', {
          error,
          serverId: id,
          host: server.host,
          port: server.port
        })
      }
    })

    await Promise.all(healthCheckPromises)
  }

  private async checkServerHealth(server: ServerInstance): Promise<boolean> {
    try {
      // Simple health check - in production, this would be more sophisticated
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

  private startAutoScaling(): void {
    if (this.scalingInterval) {
      clearInterval(this.scalingInterval)
    }

    this.scalingInterval = setInterval(async () => {
      await this.evaluateScaling()
    }, 60000) // Every minute
  }

  private async evaluateScaling(): Promise<void> {
    if (!this.autoScalingConfig) return

    const now = new Date()

    // Check cooldown period
    if (this.scalingMetrics.lastScalingEvent) {
      const timeSinceLastScaling = (now.getTime() - this.scalingMetrics.lastScalingEvent.getTime()) / 1000
      if (timeSinceLastScaling < this.autoScalingConfig.cooldownPeriod) {
        return
      }
    }

    // Calculate average load across all servers
    const healthyServers = Array.from(this.servers.values()).filter(s => s.healthy)
    if (healthyServers.length === 0) return

    const averageLoad = healthyServers.reduce((sum, server) => sum + server.load, 0) / healthyServers.length
    this.scalingMetrics.averageLoad = averageLoad

    // Determine if scaling is needed
    let targetInstances = this.scalingMetrics.currentInstances

    if (averageLoad > this.autoScalingConfig.scaleUpThreshold) {
      targetInstances = Math.min(
        this.scalingMetrics.currentInstances + 1,
        this.autoScalingConfig.maxInstances
      )
    } else if (averageLoad < this.autoScalingConfig.scaleDownThreshold) {
      targetInstances = Math.max(
        this.scalingMetrics.currentInstances - 1,
        this.autoScalingConfig.minInstances
      )
    }

    if (targetInstances !== this.scalingMetrics.currentInstances) {
      await this.performScaling(targetInstances)
      this.scalingMetrics.lastScalingEvent = now
    }
  }

  private async performScaling(targetInstances: number): Promise<void> {
    const currentInstances = this.scalingMetrics.currentInstances

    if (targetInstances > currentInstances) {
      // Scale up
      await this.scaleUp(targetInstances - currentInstances)
    } else {
      // Scale down
      await this.scaleDown(currentInstances - targetInstances)
    }

    this.scalingMetrics.targetInstances = targetInstances

    logger.info('Auto-scaling performed', {
      from: currentInstances,
      to: targetInstances,
      averageLoad: this.scalingMetrics.averageLoad
    })
  }

  private async scaleUp(instances: number): Promise<void> {
    // In production, this would integrate with cloud provider APIs
    // For now, just log the scaling action
    logger.info('Scaling up instances', { instances })

    // Record scaling metrics
    const timestamp = new Date().toISOString()
    await performanceMonitor.recordConcurrencyMetric(
      this.scalingMetrics.currentInstances + instances,
      timestamp,
      'auto-scaling'
    )
  }

  private async scaleDown(instances: number): Promise<void> {
    // In production, this would gracefully shutdown instances
    logger.info('Scaling down instances', { instances })

    // Record scaling metrics
    const timestamp = new Date().toISOString()
    await performanceMonitor.recordConcurrencyMetric(
      Math.max(1, this.scalingMetrics.currentInstances - instances),
      timestamp,
      'auto-scaling'
    )
  }

  /**
   * Update server load metrics
   */
  updateServerLoad(serverId: string, load: number): void {
    const server = this.servers.get(serverId)
    if (server) {
      server.load = Math.max(0, Math.min(100, load))
    }
  }

  /**
   * Get load balancer statistics
   */
  getStatistics(): {
    totalServers: number
    healthyServers: number
    totalConnections: number
    averageLoad: number
  } {
    const servers = Array.from(this.servers.values())
    const healthyServers = servers.filter(s => s.healthy)
    const totalConnections = servers.reduce((sum, server) => sum + server.connections, 0)
    const averageLoad = healthyServers.length > 0
      ? healthyServers.reduce((sum, server) => sum + server.load, 0) / healthyServers.length
      : 0

    return {
      totalServers: servers.length,
      healthyServers: healthyServers.length,
      totalConnections,
      averageLoad
    }
  }
}

// Export singleton instance
export const loadBalancer = LoadBalancer.getInstance()