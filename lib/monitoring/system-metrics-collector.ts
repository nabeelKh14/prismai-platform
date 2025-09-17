import { performanceMonitor } from './performance-monitor'
import { logger } from '@/lib/logger'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

export interface SystemMetrics {
  cpuUsage: number
  memoryUsage: number
  memoryTotal: number
  diskUsage: number
  diskTotal: number
  networkRx: number
  networkTx: number
  loadAverage: [number, number, number]
  uptime: number
  activeConnections: number
}

export class SystemMetricsCollector {
  private static instance: SystemMetricsCollector
  private collectionInterval: NodeJS.Timeout | null = null
  private previousNetworkStats: { rx: number; tx: number } | null = null
  private readonly collectionIntervalMs = 30000 // 30 seconds

  static getInstance(): SystemMetricsCollector {
    if (!SystemMetricsCollector.instance) {
      SystemMetricsCollector.instance = new SystemMetricsCollector()
    }
    return SystemMetricsCollector.instance
  }

  constructor() {
    this.startCollection()
  }

  /**
   * Start periodic metrics collection
   */
  startCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
    }

    this.collectionInterval = setInterval(async () => {
      await this.collectAndRecordMetrics()
    }, this.collectionIntervalMs)

    logger.info('System metrics collection started', { interval_ms: this.collectionIntervalMs })
  }

  /**
   * Stop periodic metrics collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
      this.collectionInterval = null
      logger.info('System metrics collection stopped')
    }
  }

  /**
   * Collect and record all system metrics
   */
  private async collectAndRecordMetrics(): Promise<void> {
    try {
      const timestamp = new Date().toISOString()
      const metrics = await this.collectSystemMetrics()

      // Record CPU usage
      await performanceMonitor.recordSystemMetric({
        memory_usage_mb: metrics.memoryUsage / (1024 * 1024),
        memory_total_mb: metrics.memoryTotal / (1024 * 1024),
        cpu_usage_percent: metrics.cpuUsage * 100,
        active_connections: metrics.activeConnections,
        timestamp
      })

      // Record load average
      await performanceMonitor.recordLoadAverageMetric(
        metrics.loadAverage[0],
        metrics.loadAverage[1],
        metrics.loadAverage[2],
        timestamp
      )

      // Record uptime
      await performanceMonitor.recordUptimeMetric(metrics.uptime, timestamp)

      // Record disk I/O (simplified - in production would use system calls)
      if (metrics.diskUsage > 0) {
        await performanceMonitor.recordDiskIOMetric(
          metrics.diskUsage,
          0, // Write bytes - would need system monitoring
          timestamp
        )
      }

      // Record network metrics
      if (this.previousNetworkStats) {
        const rxDiff = metrics.networkRx - this.previousNetworkStats.rx
        const txDiff = metrics.networkTx - this.previousNetworkStats.tx

        if (rxDiff > 0) {
          await performanceMonitor.recordNetworkLatency(rxDiff, 'network_rx', timestamp)
        }
        if (txDiff > 0) {
          await performanceMonitor.recordNetworkLatency(txDiff, 'network_tx', timestamp)
        }
      }

      this.previousNetworkStats = {
        rx: metrics.networkRx,
        tx: metrics.networkTx
      }

    } catch (error) {
      logger.error('Failed to collect and record system metrics', { error })
    }
  }

  /**
   * Collect raw system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    try {
      // CPU usage
      const cpuUsage = process.cpuUsage()
      const totalCpuTime = cpuUsage.user + cpuUsage.system
      const cpuPercent = totalCpuTime / 1000000 // Convert to percentage

      // Memory usage
      const memUsage = process.memoryUsage()
      const totalMem = os.totalmem()

      // Disk usage (simplified - check current directory)
      const diskStats = await this.getDiskUsage(process.cwd())

      // Network stats (simplified - would need system monitoring in production)
      const networkStats = this.getNetworkStats()

      // Load average
      const loadAvg = os.loadavg()

      // Uptime
      const uptime = os.uptime()

      // Active connections (simplified - would need actual connection tracking)
      const activeConnections = 0 // Placeholder

      return {
        cpuUsage: Math.min(cpuPercent, 100), // Cap at 100%
        memoryUsage: memUsage.heapUsed,
        memoryTotal: totalMem,
        diskUsage: diskStats.used,
        diskTotal: diskStats.total,
        networkRx: networkStats.rx,
        networkTx: networkStats.tx,
        loadAverage: loadAvg as [number, number, number],
        uptime,
        activeConnections
      }

    } catch (error) {
      logger.error('Failed to collect system metrics', { error })
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        memoryTotal: 0,
        diskUsage: 0,
        diskTotal: 0,
        networkRx: 0,
        networkTx: 0,
        loadAverage: [0, 0, 0],
        uptime: 0,
        activeConnections: 0
      }
    }
  }

  /**
   * Get disk usage for a path
   */
  private async getDiskUsage(dirPath: string): Promise<{ used: number; total: number }> {
    try {
      // This is a simplified implementation
      // In production, you would use system calls or libraries like 'diskusage'
      const stats = fs.statSync(dirPath)
      const total = 1024 * 1024 * 1024 * 100 // 100GB placeholder
      const used = stats.size || 0

      return { used, total }
    } catch (error) {
      logger.warn('Failed to get disk usage', { error, path: dirPath })
      return { used: 0, total: 0 }
    }
  }

  /**
   * Get network statistics
   */
  private getNetworkStats(): { rx: number; tx: number } {
    try {
      // This is a simplified implementation
      // In production, you would use system monitoring libraries
      const networkInterfaces = os.networkInterfaces()

      let rx = 0
      let tx = 0

      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (interfaces) {
          for (const iface of interfaces) {
            if (!iface.internal && iface.family === 'IPv4') {
              // Placeholder values - in production would track actual bytes
              rx += Math.random() * 1000000
              tx += Math.random() * 500000
            }
          }
        }
      }

      return { rx, tx }
    } catch (error) {
      logger.warn('Failed to get network stats', { error })
      return { rx: 0, tx: 0 }
    }
  }

  /**
   * Manually trigger metrics collection
   */
  async collectNow(): Promise<SystemMetrics> {
    return await this.collectSystemMetrics()
  }

  /**
   * Get current system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    metrics: SystemMetrics
    issues: string[]
  }> {
    const metrics = await this.collectSystemMetrics()
    const issues: string[] = []

    // Check CPU usage
    if (metrics.cpuUsage > 80) {
      issues.push(`High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`)
    }

    // Check memory usage
    const memoryPercent = (metrics.memoryUsage / metrics.memoryTotal) * 100
    if (memoryPercent > 85) {
      issues.push(`High memory usage: ${memoryPercent.toFixed(1)}%`)
    }

    // Check load average
    if (metrics.loadAverage[0] > os.cpus().length) {
      issues.push(`High load average: ${metrics.loadAverage[0].toFixed(2)}`)
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (issues.length > 2) {
      status = 'critical'
    } else if (issues.length > 0) {
      status = 'warning'
    }

    return {
      status,
      metrics,
      issues
    }
  }
}

// Export singleton instance
export const systemMetricsCollector = SystemMetricsCollector.getInstance()