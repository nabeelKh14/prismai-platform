import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'
import { createDatabaseBackup, listDatabaseBackups } from './database-backup'
import { createFileBackup, listFileBackups } from './file-backup'
import { runDisasterRecoveryTest } from './disaster-recovery'
import { evaluateMonitoringMetric } from './incident-response'

export interface BackupMetrics {
  database: {
    lastBackup: Date | null
    backupCount: number
    successRate: number
    averageDuration: number
    totalSize: number
  }
  files: {
    lastBackup: Date | null
    backupCount: number
    successRate: number
    averageDuration: number
    totalSize: number
  }
  overall: {
    healthScore: number
    rtoCompliance: boolean
    rpoCompliance: boolean
    lastTest: Date | null
    testSuccessRate: number
  }
}

export interface BackupAlert {
  id: string
  type: 'warning' | 'error' | 'critical'
  message: string
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
}

export class BackupMonitoringService {
  private metrics: BackupMetrics
  private alerts: BackupAlert[] = []
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor() {
    this.metrics = {
      database: {
        lastBackup: null,
        backupCount: 0,
        successRate: 0,
        averageDuration: 0,
        totalSize: 0
      },
      files: {
        lastBackup: null,
        backupCount: 0,
        successRate: 0,
        averageDuration: 0,
        totalSize: 0
      },
      overall: {
        healthScore: 0,
        rtoCompliance: false,
        rpoCompliance: false,
        lastTest: null,
        testSuccessRate: 0
      }
    }

    this.startMonitoring()
  }

  /**
   * Start monitoring backup systems
   */
  private startMonitoring() {
    // Update metrics every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      await this.updateMetrics()
      await this.checkHealth()
      await this.evaluateAlerts()
    }, 5 * 60 * 1000)

    // Initial update
    this.updateMetrics()
  }

  /**
   * Update backup metrics
   */
  private async updateMetrics() {
    try {
      // Update database backup metrics
      const dbBackups = await listDatabaseBackups()
      this.updateDatabaseMetrics(dbBackups)

      // Update file backup metrics
      const fileBackups = await listFileBackups()
      this.updateFileMetrics(fileBackups)

      // Update overall metrics
      this.updateOverallMetrics()

      // Send metrics to monitoring system
      await this.reportMetrics()

    } catch (error) {
      logger.error('Failed to update backup metrics', error as Error)
    }
  }

  /**
   * Update database backup metrics
   */
  private updateDatabaseMetrics(backups: any[]) {
    if (backups.length === 0) return

    const recentBackups = backups.slice(0, 10) // Last 10 backups
    const successfulBackups = recentBackups.filter(b => b.success !== false)

    this.metrics.database = {
      lastBackup: recentBackups[0]?.createdAt || null,
      backupCount: backups.length,
      successRate: successfulBackups.length / recentBackups.length,
      averageDuration: this.calculateAverageDuration(recentBackups),
      totalSize: recentBackups.reduce((sum, b) => sum + (b.fileSize || 0), 0)
    }
  }

  /**
   * Update file backup metrics
   */
  private updateFileMetrics(backups: any[]) {
    if (backups.length === 0) return

    const recentBackups = backups.slice(0, 10) // Last 10 backups
    const successfulBackups = recentBackups.filter(b => b.success !== false)

    this.metrics.files = {
      lastBackup: recentBackups[0]?.createdAt || null,
      backupCount: backups.length,
      successRate: successfulBackups.length / recentBackups.length,
      averageDuration: this.calculateAverageDuration(recentBackups),
      totalSize: recentBackups.reduce((sum, b) => sum + (b.totalSize || 0), 0)
    }
  }

  /**
   * Update overall metrics
   */
  private updateOverallMetrics() {
    const dbHealth = this.calculateHealthScore(this.metrics.database)
    const fileHealth = this.calculateHealthScore(this.metrics.files)

    this.metrics.overall.healthScore = (dbHealth + fileHealth) / 2
    this.metrics.overall.rtoCompliance = this.checkRTOCompliance()
    this.metrics.overall.rpoCompliance = this.checkRPOCompliance()
  }

  /**
   * Calculate health score for a backup type
   */
  private calculateHealthScore(metrics: any): number {
    let score = 0

    // Success rate (40% weight)
    score += metrics.successRate * 40

    // Recency (30% weight) - backups within last 24 hours = 30 points
    if (metrics.lastBackup) {
      const hoursSinceBackup = (Date.now() - metrics.lastBackup.getTime()) / (1000 * 60 * 60)
      const recencyScore = Math.max(0, 30 - (hoursSinceBackup / 24) * 30)
      score += recencyScore
    }

    // Duration (20% weight) - reasonable duration = 20 points
    const durationScore = metrics.averageDuration < 1800000 ? 20 : 10 // Less than 30 minutes
    score += durationScore

    // Size growth (10% weight) - reasonable size = 10 points
    const sizeScore = metrics.totalSize < 10000000000 ? 10 : 5 // Less than 10GB
    score += sizeScore

    return Math.min(100, Math.max(0, score))
  }

  /**
   * Check RTO compliance
   */
  private checkRTOCompliance(): boolean {
    // RTO: 1 hour for critical systems
    const rtoThreshold = 60 * 60 * 1000 // 1 hour in milliseconds

    const dbRTO = this.metrics.database.lastBackup ?
      (Date.now() - this.metrics.database.lastBackup.getTime()) < rtoThreshold : false

    const fileRTO = this.metrics.files.lastBackup ?
      (Date.now() - this.metrics.files.lastBackup.getTime()) < rtoThreshold : false

    return dbRTO && fileRTO
  }

  /**
   * Check RPO compliance
   */
  private checkRPOCompliance(): boolean {
    // RPO: 15 minutes for critical data
    const rpoThreshold = 15 * 60 * 1000 // 15 minutes in milliseconds

    const dbRPO = this.metrics.database.lastBackup ?
      (Date.now() - this.metrics.database.lastBackup.getTime()) < rpoThreshold : false

    const fileRPO = this.metrics.files.lastBackup ?
      (Date.now() - this.metrics.files.lastBackup.getTime()) < rpoThreshold : false

    return dbRPO && fileRPO
  }

  /**
   * Calculate average duration
   */
  private calculateAverageDuration(backups: any[]): number {
    const validBackups = backups.filter(b => b.duration)
    if (validBackups.length === 0) return 0

    const totalDuration = validBackups.reduce((sum, b) => sum + b.duration, 0)
    return totalDuration / validBackups.length
  }

  /**
   * Check system health and create alerts
   */
  private async checkHealth() {
    // Check for backup failures
    if (this.metrics.database.successRate < 0.8) {
      await this.createAlert('warning', 'Database backup success rate below 80%')
    }

    if (this.metrics.files.successRate < 0.8) {
      await this.createAlert('warning', 'File backup success rate below 80%')
    }

    // Check for old backups
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    if (this.metrics.database.lastBackup && this.metrics.database.lastBackup < oneDayAgo) {
      await this.createAlert('error', 'Database backup is older than 24 hours')
    }

    if (this.metrics.files.lastBackup && this.metrics.files.lastBackup < oneDayAgo) {
      await this.createAlert('error', 'File backup is older than 24 hours')
    }

    // Check RTO/RPO compliance
    if (!this.metrics.overall.rtoCompliance) {
      await this.createAlert('critical', 'RTO compliance violated')
    }

    if (!this.metrics.overall.rpoCompliance) {
      await this.createAlert('critical', 'RPO compliance violated')
    }

    // Check overall health
    if (this.metrics.overall.healthScore < 70) {
      await this.createAlert('warning', `Backup system health score: ${this.metrics.overall.healthScore.toFixed(1)}%`)
    }
  }

  /**
   * Evaluate alerts and trigger incident response
   */
  private async evaluateAlerts() {
    // Send critical metrics to incident response system
    await evaluateMonitoringMetric('metric', this.metrics.overall.healthScore, {
      type: 'backup_health',
      databaseHealth: this.metrics.database.successRate * 100,
      fileHealth: this.metrics.files.successRate * 100
    })

    // Check for backup failures
    if (this.metrics.database.successRate < 0.5) {
      await evaluateMonitoringMetric('error', 1, {
        type: 'backup_failure',
        component: 'database',
        successRate: this.metrics.database.successRate
      })
    }

    if (this.metrics.files.successRate < 0.5) {
      await evaluateMonitoringMetric('error', 1, {
        type: 'backup_failure',
        component: 'files',
        successRate: this.metrics.files.successRate
      })
    }
  }

  /**
   * Create alert
   */
  private async createAlert(type: 'warning' | 'error' | 'critical', message: string) {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.alerts.find(a =>
      a.message === message &&
      !a.resolved &&
      a.type === type
    )

    if (existingAlert) {
      // Update timestamp
      existingAlert.timestamp = new Date()
      return
    }

    const alert: BackupAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      resolved: false
    }

    this.alerts.push(alert)

    logger.warn(`Backup alert created: ${message}`, {
      alertId: alert.id,
      type,
      message
    })

    SecurityAudit.logSensitiveAction('backup_alert_created', 'system', {
      alertId: alert.id,
      type,
      message
    })

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert && !alert.resolved) {
      alert.resolved = true
      alert.resolvedAt = new Date()

      logger.info(`Backup alert resolved: ${alert.message}`, {
        alertId,
        resolutionTime: alert.resolvedAt.getTime() - alert.timestamp.getTime()
      })

      SecurityAudit.logSensitiveAction('backup_alert_resolved', 'system', {
        alertId,
        resolutionTime: alert.resolvedAt.getTime() - alert.timestamp.getTime()
      })
    }
  }

  /**
   * Report metrics to monitoring system
   */
  private async reportMetrics() {
    try {
      // This would integrate with your existing monitoring system
      // For example, sending to Prometheus, DataDog, or internal metrics API

      const metricsData = {
        timestamp: new Date().toISOString(),
        backup: {
          database: this.metrics.database,
          files: this.metrics.files,
          overall: this.metrics.overall
        }
      }

      // Placeholder for actual metrics reporting
      logger.debug('Backup metrics reported', metricsData)

    } catch (error) {
      logger.error('Failed to report backup metrics', error as Error)
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): BackupMetrics {
    return { ...this.metrics }
  }

  /**
   * Get active alerts
   */
  getAlerts(): BackupAlert[] {
    return this.alerts.filter(a => !a.resolved)
  }

  /**
   * Get resolved alerts
   */
  getResolvedAlerts(limit: number = 50): BackupAlert[] {
    return this.alerts
      .filter(a => a.resolved)
      .sort((a, b) => (b.resolvedAt?.getTime() || 0) - (a.resolvedAt?.getTime() || 0))
      .slice(0, limit)
  }

  /**
   * Force backup health check
   */
  async forceHealthCheck() {
    await this.updateMetrics()
    await this.checkHealth()
    await this.evaluateAlerts()
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }
}

// Export singleton instance
export const backupMonitoringService = new BackupMonitoringService()

// Export convenience functions
export function getBackupMetrics(): BackupMetrics {
  return backupMonitoringService.getMetrics()
}

export function getBackupAlerts(): BackupAlert[] {
  return backupMonitoringService.getAlerts()
}

export function getResolvedBackupAlerts(limit?: number): BackupAlert[] {
  return backupMonitoringService.getResolvedAlerts(limit)
}

export async function resolveBackupAlert(alertId: string) {
  return backupMonitoringService.resolveAlert(alertId)
}

export async function checkBackupHealth() {
  return backupMonitoringService.forceHealthCheck()
}