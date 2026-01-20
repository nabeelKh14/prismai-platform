import { performanceMonitor } from './performance-monitor'
import { logger } from '@/lib/logger'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'

export interface ResourceUsage {
  timestamp: string
  cpu: {
    usage: number // percentage
    loadAverage: [number, number, number]
    cores: number
  }
  memory: {
    used: number // bytes
    total: number // bytes
    usage: number // percentage
    heapUsed: number
    heapTotal: number
    external: number
  }
  disk: {
    used: number // bytes
    total: number // bytes
    usage: number // percentage
    readBytesPerSecond: number
    writeBytesPerSecond: number
  }
  network: {
    rxBytesPerSecond: number
    txBytesPerSecond: number
    activeConnections: number
    totalConnections: number
  }
  process: {
    pid: number
    uptime: number
    threads: number
    handles: number
  }
}

export interface ResourceThresholds {
  cpuUsage: number // percentage
  memoryUsage: number // percentage
  diskUsage: number // percentage
  heapUsage: number // percentage
}

export interface ResourceAlert {
  type: 'cpu' | 'memory' | 'disk' | 'heap' | 'network'
  severity: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: string
}

export class ResourceMonitor extends EventEmitter {
  private static instance: ResourceMonitor
  private monitoringInterval: NodeJS.Timeout | null = null
  private collectionIntervalMs = 10000 // 10 seconds
  private thresholds: ResourceThresholds
  private previousDiskStats: { read: number; write: number } | null = null
  private previousNetworkStats: { rx: number; tx: number } | null = null
  private resourceHistory: ResourceUsage[] = []
  private maxHistorySize = 1000

  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor()
    }
    return ResourceMonitor.instance
  }

  constructor() {
    super()
    this.thresholds = {
      cpuUsage: 80,
      memoryUsage: 85,
      diskUsage: 90,
      heapUsage: 80
    }
    this.startMonitoring()
  }

  /**
   * Start resource monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.monitoringInterval = setInterval(async () => {
      await this.collectAndMonitorResources()
    }, this.collectionIntervalMs)

    logger.info('Resource monitoring started', { interval_ms: this.collectionIntervalMs })
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      logger.info('Resource monitoring stopped')
    }
  }

  /**
   * Set monitoring thresholds
   */
  setThresholds(thresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
    logger.info('Resource monitoring thresholds updated', this.thresholds)
  }

  /**
   * Get current resource usage
   */
  async getCurrentUsage(): Promise<ResourceUsage> {
    return await this.collectResourceUsage()
  }

  /**
   * Get resource usage history
   */
  getUsageHistory(limit?: number): ResourceUsage[] {
    const history = [...this.resourceHistory]
    if (limit) {
      return history.slice(-limit)
    }
    return history
  }

  /**
   * Get resource usage statistics
   */
  getUsageStatistics(timeRange: '1h' | '24h' | '7d' = '1h'): {
    average: ResourceUsage
    peak: ResourceUsage
    trends: {
      cpu: 'increasing' | 'decreasing' | 'stable'
      memory: 'increasing' | 'decreasing' | 'stable'
      disk: 'increasing' | 'decreasing' | 'stable'
    }
  } {
    const now = Date.now()
    const rangeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    }[timeRange]

    const relevantHistory = this.resourceHistory.filter(
      usage => now - new Date(usage.timestamp).getTime() <= rangeMs
    )

    if (relevantHistory.length === 0) {
      throw new Error('No resource usage data available for the specified time range')
    }

    // Calculate averages
    const average: ResourceUsage = {
      timestamp: new Date().toISOString(),
      cpu: {
        usage: relevantHistory.reduce((sum, h) => sum + h.cpu.usage, 0) / relevantHistory.length,
        loadAverage: [0, 0, 0],
        cores: relevantHistory[0].cpu.cores
      },
      memory: {
        used: relevantHistory.reduce((sum, h) => sum + h.memory.used, 0) / relevantHistory.length,
        total: relevantHistory[0].memory.total,
        usage: relevantHistory.reduce((sum, h) => sum + h.memory.usage, 0) / relevantHistory.length,
        heapUsed: relevantHistory.reduce((sum, h) => sum + h.memory.heapUsed, 0) / relevantHistory.length,
        heapTotal: relevantHistory.reduce((sum, h) => sum + h.memory.heapTotal, 0) / relevantHistory.length,
        external: relevantHistory.reduce((sum, h) => sum + h.memory.external, 0) / relevantHistory.length
      },
      disk: {
        used: relevantHistory.reduce((sum, h) => sum + h.disk.used, 0) / relevantHistory.length,
        total: relevantHistory[0].disk.total,
        usage: relevantHistory.reduce((sum, h) => sum + h.disk.usage, 0) / relevantHistory.length,
        readBytesPerSecond: relevantHistory.reduce((sum, h) => sum + h.disk.readBytesPerSecond, 0) / relevantHistory.length,
        writeBytesPerSecond: relevantHistory.reduce((sum, h) => sum + h.disk.writeBytesPerSecond, 0) / relevantHistory.length
      },
      network: {
        rxBytesPerSecond: relevantHistory.reduce((sum, h) => sum + h.network.rxBytesPerSecond, 0) / relevantHistory.length,
        txBytesPerSecond: relevantHistory.reduce((sum, h) => sum + h.network.txBytesPerSecond, 0) / relevantHistory.length,
        activeConnections: Math.round(relevantHistory.reduce((sum, h) => sum + h.network.activeConnections, 0) / relevantHistory.length),
        totalConnections: Math.round(relevantHistory.reduce((sum, h) => sum + h.network.totalConnections, 0) / relevantHistory.length)
      },
      process: {
        pid: relevantHistory[0].process.pid,
        uptime: relevantHistory.reduce((sum, h) => sum + h.process.uptime, 0) / relevantHistory.length,
        threads: Math.round(relevantHistory.reduce((sum, h) => sum + h.process.threads, 0) / relevantHistory.length),
        handles: Math.round(relevantHistory.reduce((sum, h) => sum + h.process.handles, 0) / relevantHistory.length)
      }
    }

    // Find peaks
    const peak = relevantHistory.reduce((max, current) => {
      return current.cpu.usage > max.cpu.usage ? current : max
    })

    // Calculate trends (simplified)
    const recent = relevantHistory.slice(-10)
    const older = relevantHistory.slice(-20, -10)

    const trends = {
      cpu: this.calculateTrend(recent.map(h => h.cpu.usage), older.map(h => h.cpu.usage)),
      memory: this.calculateTrend(recent.map(h => h.memory.usage), older.map(h => h.memory.usage)),
      disk: this.calculateTrend(recent.map(h => h.disk.usage), older.map(h => h.disk.usage))
    }

    return { average, peak, trends }
  }

  // Private methods

  private async collectAndMonitorResources(): Promise<void> {
    try {
      const usage = await this.collectResourceUsage()

      // Store in history
      this.resourceHistory.push(usage)
      if (this.resourceHistory.length > this.maxHistorySize) {
        this.resourceHistory = this.resourceHistory.slice(-this.maxHistorySize)
      }

      // Check thresholds and emit alerts
      await this.checkThresholds(usage)

    } catch (error) {
      logger.error('Failed to collect resource usage', { error })
    }
  }

  private async collectResourceUsage(): Promise<ResourceUsage> {
    const timestamp = new Date().toISOString()

    // CPU information
    const cpuUsage = this.getCpuUsage()
    const loadAverage = os.loadavg() as [number, number, number]
    const cores = os.cpus().length

    // Memory information
    const memUsage = process.memoryUsage()
    const totalMemory = os.totalmem()

    // Disk information
    const diskStats = await this.getDiskStats()

    // Network information
    const networkStats = this.getNetworkStats()

    // Process information
    const processInfo = {
      pid: process.pid,
      uptime: process.uptime(),
      threads: 0, // Would need additional libraries for accurate thread count
      handles: 0  // Would need additional libraries for accurate handle count
    }

    return {
      timestamp,
      cpu: {
        usage: cpuUsage,
        loadAverage,
        cores
      },
      memory: {
        used: memUsage.heapUsed,
        total: totalMemory,
        usage: (memUsage.heapUsed / totalMemory) * 100,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      disk: diskStats,
      network: networkStats,
      process: processInfo
    }
  }

  private getCpuUsage(): number {
    // Simplified CPU usage calculation
    // In production, you might want to use a more accurate method
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type]
      }
      totalIdle += cpu.times.idle
    })

    const idle = totalIdle / cpus.length
    const total = totalTick / cpus.length

    return 100 - ~~(100 * idle / total)
  }

  private async getDiskStats(): Promise<ResourceUsage['disk']> {
    try {
      // This is a simplified implementation
      // In production, you would use system monitoring libraries
      const cwd = process.cwd()
      const stats = fs.statSync(cwd)
      const total = 1024 * 1024 * 1024 * 100 // 100GB placeholder
      const used = stats.size || 0

      // Calculate I/O rates (simplified)
      let readBytesPerSecond = 0
      let writeBytesPerSecond = 0

      if (this.previousDiskStats) {
        readBytesPerSecond = Math.max(0, used - this.previousDiskStats.read) / (this.collectionIntervalMs / 1000)
        writeBytesPerSecond = Math.max(0, used - this.previousDiskStats.write) / (this.collectionIntervalMs / 1000)
      }

      this.previousDiskStats = { read: used, write: used }

      return {
        used,
        total,
        usage: (used / total) * 100,
        readBytesPerSecond,
        writeBytesPerSecond
      }
    } catch (error) {
      logger.warn('Failed to get disk stats', { error })
      return {
        used: 0,
        total: 0,
        usage: 0,
        readBytesPerSecond: 0,
        writeBytesPerSecond: 0
      }
    }
  }

  private getNetworkStats(): ResourceUsage['network'] {
    try {
      // This is a simplified implementation
      // In production, you would use system monitoring libraries
      const networkInterfaces = os.networkInterfaces()

      let rxBytesPerSecond = 0
      let txBytesPerSecond = 0

      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (interfaces) {
          for (const iface of interfaces) {
            if (!iface.internal && iface.family === 'IPv4') {
              // Placeholder values - in production would track actual bytes
              rxBytesPerSecond += Math.random() * 100000
              txBytesPerSecond += Math.random() * 50000
            }
          }
        }
      }

      if (this.previousNetworkStats) {
        rxBytesPerSecond = Math.max(0, rxBytesPerSecond - this.previousNetworkStats.rx)
        txBytesPerSecond = Math.max(0, txBytesPerSecond - this.previousNetworkStats.tx)
      }

      this.previousNetworkStats = { rx: rxBytesPerSecond, tx: txBytesPerSecond }

      return {
        rxBytesPerSecond,
        txBytesPerSecond,
        activeConnections: 0, // Would need actual connection tracking
        totalConnections: 0
      }
    } catch (error) {
      logger.warn('Failed to get network stats', { error })
      return {
        rxBytesPerSecond: 0,
        txBytesPerSecond: 0,
        activeConnections: 0,
        totalConnections: 0
      }
    }
  }

  private async checkThresholds(usage: ResourceUsage): Promise<void> {
    const alerts: ResourceAlert[] = []

    // CPU threshold
    if (usage.cpu.usage > this.thresholds.cpuUsage) {
      alerts.push({
        type: 'cpu',
        severity: usage.cpu.usage > 95 ? 'critical' : 'warning',
        message: `CPU usage is at ${usage.cpu.usage.toFixed(1)}%`,
        value: usage.cpu.usage,
        threshold: this.thresholds.cpuUsage,
        timestamp: usage.timestamp
      })
    }

    // Memory threshold
    if (usage.memory.usage > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'memory',
        severity: usage.memory.usage > 95 ? 'critical' : 'warning',
        message: `Memory usage is at ${usage.memory.usage.toFixed(1)}%`,
        value: usage.memory.usage,
        threshold: this.thresholds.memoryUsage,
        timestamp: usage.timestamp
      })
    }

    // Heap memory threshold
    const heapUsage = (usage.memory.heapUsed / usage.memory.heapTotal) * 100
    if (heapUsage > this.thresholds.heapUsage) {
      alerts.push({
        type: 'heap',
        severity: heapUsage > 95 ? 'critical' : 'warning',
        message: `Heap usage is at ${heapUsage.toFixed(1)}%`,
        value: heapUsage,
        threshold: this.thresholds.heapUsage,
        timestamp: usage.timestamp
      })
    }

    // Disk threshold
    if (usage.disk.usage > this.thresholds.diskUsage) {
      alerts.push({
        type: 'disk',
        severity: usage.disk.usage > 95 ? 'critical' : 'warning',
        message: `Disk usage is at ${usage.disk.usage.toFixed(1)}%`,
        value: usage.disk.usage,
        threshold: this.thresholds.diskUsage,
        timestamp: usage.timestamp
      })
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.emit('alert', alert)
      logger.warn('Resource alert triggered', alert)
    })
  }


  private calculateTrend(recent: number[], older: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (recent.length === 0 || older.length === 0) return 'stable'

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length

    const difference = recentAvg - olderAvg
    const threshold = Math.abs(olderAvg * 0.05) // 5% change threshold

    if (difference > threshold) return 'increasing'
    if (difference < -threshold) return 'decreasing'
    return 'stable'
  }

  /**
   * Export resource usage data
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'timestamp',
        'cpu_usage',
        'memory_usage',
        'disk_usage',
        'network_rx',
        'network_tx',
        'heap_used',
        'load_avg_1',
        'load_avg_5',
        'load_avg_15'
      ]

      const rows = this.resourceHistory.map(usage => [
        usage.timestamp,
        usage.cpu.usage.toFixed(2),
        usage.memory.usage.toFixed(2),
        usage.disk.usage.toFixed(2),
        usage.network.rxBytesPerSecond.toFixed(2),
        usage.network.txBytesPerSecond.toFixed(2),
        (usage.memory.heapUsed / 1024 / 1024).toFixed(2), // MB
        usage.cpu.loadAverage[0].toFixed(2),
        usage.cpu.loadAverage[1].toFixed(2),
        usage.cpu.loadAverage[2].toFixed(2)
      ])

      return [headers, ...rows].map(row => row.join(',')).join('\n')
    }

    return JSON.stringify(this.resourceHistory, null, 2)
  }
}

// Export singleton instance
export const resourceMonitor = ResourceMonitor.getInstance()