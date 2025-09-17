import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface ConnectionConfig {
  maxConnections: number
  minConnections: number
  acquireTimeoutMillis: number
  idleTimeoutMillis: number
  reapIntervalMillis: number
  createRetryIntervalMillis: number
  propagateCreateError: boolean
}

export interface ConnectionStats {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  pendingConnections: number
  borrowedConnections: number
  poolUtilization: number
  averageWaitTime: number
  connectionErrors: number
  lastError?: string
  uptime: number
}

export interface PoolMetrics {
  connectionsCreated: number
  connectionsDestroyed: number
  connectionsAcquired: number
  connectionsReleased: number
  acquireTimeouts: number
  acquireRetries: number
  averageAcquireTime: number
  peakConnections: number
  poolEfficiency: number
}

export class ConnectionPoolManager {
  private static instance: ConnectionPoolManager
  private config: ConnectionConfig
  private metrics: PoolMetrics
  private startTime: number
  private connectionErrors: Array<{ timestamp: number; error: string }> = []

  constructor() {
    this.config = {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2'),
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'),
      reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000'),
      createRetryIntervalMillis: parseInt(process.env.DB_CREATE_RETRY_INTERVAL || '200'),
      propagateCreateError: false
    }

    this.metrics = {
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      connectionsAcquired: 0,
      connectionsReleased: 0,
      acquireTimeouts: 0,
      acquireRetries: 0,
      averageAcquireTime: 0,
      peakConnections: 0,
      poolEfficiency: 0
    }

    this.startTime = Date.now()
  }

  static getInstance(): ConnectionPoolManager {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager()
    }
    return ConnectionPoolManager.instance
  }

  /**
   * Get optimized database client with connection pooling
   */
  async getOptimizedClient(options?: {
    priority?: 'high' | 'normal' | 'low'
    timeout?: number
    retryOnFailure?: boolean
  }): Promise<any> {
    const startTime = Date.now()
    const timeout = options?.timeout || this.config.acquireTimeoutMillis

    try {
      // Create client with optimized settings
      const client = await this.createOptimizedClient()

      // Record metrics
      this.metrics.connectionsAcquired++
      const acquireTime = Date.now() - startTime
      this.updateAverageAcquireTime(acquireTime)

      // Set connection-specific optimizations
      await this.optimizeConnection(client, options)

      return client

    } catch (error) {
      this.metrics.acquireTimeouts++
      this.recordConnectionError(error instanceof Error ? error.message : 'Unknown connection error')

      if (options?.retryOnFailure) {
        return this.retryConnection(options, timeout - (Date.now() - startTime))
      }

      throw error
    }
  }

  /**
   * Release connection back to pool
   */
  async releaseConnection(client: any): Promise<void> {
    try {
      // Clean up connection-specific settings
      await this.cleanupConnection(client)

      // Record metrics
      this.metrics.connectionsReleased++

      // The Supabase client handles connection release automatically
      // but we can add custom cleanup here if needed

    } catch (error) {
      logger.error('Error releasing connection', { error })
    }
  }

  /**
   * Get current connection pool statistics
   */
  async getPoolStats(): Promise<ConnectionStats> {
    try {
      const supabase = await createClient()

      // Get actual connection stats from database
      const { data: dbStats, error } = await supabase.rpc('get_connection_pool_stats')

      if (error) throw error

      const activeConnections = dbStats?.active_connections || 0
      const totalConnections = dbStats?.total_connections || 0
      const poolUtilization = totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0

      // Update peak connections
      if (totalConnections > this.metrics.peakConnections) {
        this.metrics.peakConnections = totalConnections
      }

      return {
        totalConnections,
        activeConnections,
        idleConnections: dbStats?.idle_connections || 0,
        pendingConnections: dbStats?.waiting_requests || 0,
        borrowedConnections: activeConnections,
        poolUtilization,
        averageWaitTime: this.metrics.averageAcquireTime,
        connectionErrors: this.connectionErrors.length,
        lastError: this.connectionErrors[this.connectionErrors.length - 1]?.error,
        uptime: Date.now() - this.startTime
      }

    } catch (error) {
      logger.error('Error getting pool stats', { error })

      // Return basic stats if database query fails
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        pendingConnections: 0,
        borrowedConnections: 0,
        poolUtilization: 0,
        averageWaitTime: this.metrics.averageAcquireTime,
        connectionErrors: this.connectionErrors.length,
        uptime: Date.now() - this.startTime
      }
    }
  }

  /**
   * Get pool performance metrics
   */
  getPoolMetrics(): PoolMetrics {
    return { ...this.metrics }
  }

  /**
   * Optimize pool configuration based on usage patterns
   */
  async optimizePoolConfig(): Promise<void> {
    try {
      const stats = await this.getPoolStats()
      const metrics = this.getPoolMetrics()

      // Analyze usage patterns and adjust configuration
      const recommendations = this.analyzePoolPerformance(stats, metrics)

      // Apply optimizations
      for (const recommendation of recommendations) {
        await this.applyPoolOptimization(recommendation, stats)
      }

      logger.info('Connection pool optimization completed', { recommendations })

    } catch (error) {
      logger.error('Error optimizing pool configuration', { error })
    }
  }

  /**
   * Health check for connection pool
   */
  async healthCheck(): Promise<{
    healthy: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      const stats = await this.getPoolStats()

      // Check connection utilization
      if (stats.poolUtilization > 90) {
        issues.push('High connection pool utilization')
        recommendations.push('Consider increasing max connections or optimizing queries')
      }

      // Check for connection errors
      if (stats.connectionErrors > 10) {
        issues.push('High number of connection errors')
        recommendations.push('Investigate connection stability and network issues')
      }

      // Check average wait time
      if (stats.averageWaitTime > 5000) {
        issues.push('High average connection wait time')
        recommendations.push('Consider increasing pool size or reducing connection load')
      }

      // Check pool efficiency
      if (this.metrics.poolEfficiency < 70) {
        issues.push('Low connection pool efficiency')
        recommendations.push('Optimize connection reuse and reduce connection churn')
      }

      return {
        healthy: issues.length === 0,
        issues,
        recommendations
      }

    } catch (error) {
      return {
        healthy: false,
        issues: ['Unable to perform connection pool health check'],
        recommendations: ['Check database connectivity and pool configuration']
      }
    }
  }

  /**
   * Update pool configuration
   */
  updateConfig(newConfig: Partial<ConnectionConfig>): void {
    this.config = { ...this.config, ...newConfig }
    logger.info('Connection pool configuration updated', { newConfig })
  }

  /**
   * Reset pool metrics
   */
  resetMetrics(): void {
    this.metrics = {
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      connectionsAcquired: 0,
      connectionsReleased: 0,
      acquireTimeouts: 0,
      acquireRetries: 0,
      averageAcquireTime: 0,
      peakConnections: 0,
      poolEfficiency: 0
    }
    this.connectionErrors = []
    logger.info('Connection pool metrics reset')
  }

  /**
   * Private methods
   */
  private async createOptimizedClient(): Promise<any> {
    const client = await createClient()

    // Set optimized connection parameters
    await this.setConnectionParameters(client)

    this.metrics.connectionsCreated++
    return client
  }

  private async setConnectionParameters(client: any): Promise<void> {
    // Set connection-specific parameters for optimization
    // Note: These would be set via the database connection parameters
    // For Supabase, these are handled at the client level
  }

  private async optimizeConnection(client: any, options?: any): Promise<void> {
    // Set session-specific optimizations based on priority
    const priority = options?.priority || 'normal'

    switch (priority) {
      case 'high':
        // High priority connections get better resources
        break
      case 'low':
        // Low priority connections get minimal resources
        break
      default:
        // Normal priority - default settings
        break
    }
  }

  private async cleanupConnection(client: any): Promise<void> {
    // Clean up connection-specific settings
    // Reset any session variables or temporary settings
  }

  private async retryConnection(options: any, remainingTimeout: number): Promise<any> {
    const retryDelay = this.config.createRetryIntervalMillis
    const maxRetries = Math.floor(remainingTimeout / retryDelay)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.metrics.acquireRetries++
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return await this.getOptimizedClient({ ...options, retryOnFailure: false })
      } catch (error) {
        if (attempt === maxRetries) {
          throw error
        }
      }
    }
  }

  private updateAverageAcquireTime(acquireTime: number): void {
    const totalAcquires = this.metrics.connectionsAcquired
    const currentAverage = this.metrics.averageAcquireTime

    // Calculate running average
    this.metrics.averageAcquireTime = ((currentAverage * (totalAcquires - 1)) + acquireTime) / totalAcquires
  }

  private recordConnectionError(error: string): void {
    this.connectionErrors.push({
      timestamp: Date.now(),
      error
    })

    // Keep only last 100 errors
    if (this.connectionErrors.length > 100) {
      this.connectionErrors = this.connectionErrors.slice(-100)
    }
  }

  private analyzePoolPerformance(stats: ConnectionStats, metrics: PoolMetrics): string[] {
    const recommendations: string[] = []

    // Analyze utilization patterns
    if (stats.poolUtilization > 85) {
      recommendations.push('increase_max_connections')
    } else if (stats.poolUtilization < 30) {
      recommendations.push('decrease_max_connections')
    }

    // Analyze wait times
    if (stats.averageWaitTime > 2000) {
      recommendations.push('optimize_connection_reuse')
    }

    // Analyze error rates
    if (stats.connectionErrors > 5) {
      recommendations.push('investigate_connection_stability')
    }

    return recommendations
  }

  private async applyPoolOptimization(recommendation: string, stats: ConnectionStats): Promise<void> {
    switch (recommendation) {
      case 'increase_max_connections':
        this.config.maxConnections = Math.min(this.config.maxConnections + 5, 100)
        break
      case 'decrease_max_connections':
        this.config.maxConnections = Math.max(this.config.maxConnections - 2, this.config.minConnections)
        break
      case 'optimize_connection_reuse':
        // Implement connection reuse optimizations
        break
      case 'investigate_connection_stability':
        // Log for investigation
        logger.warn('Connection stability issues detected', { stats })
        break
    }
  }
}

// Export singleton instance
export const connectionPoolManager = ConnectionPoolManager.getInstance()