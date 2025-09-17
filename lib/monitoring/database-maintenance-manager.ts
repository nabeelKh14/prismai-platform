import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface MaintenanceTask {
  id: string
  name: string
  description: string
  type: 'vacuum' | 'reindex' | 'cleanup' | 'analyze' | 'health_check'
  schedule: 'daily' | 'weekly' | 'monthly' | 'manual'
  lastRun?: string
  nextRun?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration?: number
  errorMessage?: string
  affectedRows?: number
}

export interface MaintenanceResult {
  taskId: string
  success: boolean
  duration: number
  affectedRows?: number
  details: Record<string, any>
  errorMessage?: string
}

export interface DatabaseHealthReport {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical'
    category: string
    description: string
    recommendation: string
  }>
  metrics: {
    tableCount: number
    totalSize: string
    lastVacuum: string
    lastAnalyze: string
    bloatPercentage: number
    unusedIndexes: number
  }
  recommendations: string[]
}

export class DatabaseMaintenanceManager {
  private static instance: DatabaseMaintenanceManager
  private maintenanceTasks: MaintenanceTask[] = []
  private isRunningMaintenance = false

  static getInstance(): DatabaseMaintenanceManager {
    if (!DatabaseMaintenanceManager.instance) {
      DatabaseMaintenanceManager.instance = new DatabaseMaintenanceManager()
    }
    return DatabaseMaintenanceManager.instance
  }

  /**
   * Initialize maintenance tasks
   */
  async initializeMaintenanceTasks(): Promise<void> {
    this.maintenanceTasks = [
      {
        id: 'daily_vacuum',
        name: 'Daily Vacuum',
        description: 'Remove dead tuples and reclaim space',
        type: 'vacuum',
        schedule: 'daily',
        status: 'pending'
      },
      {
        id: 'daily_analyze',
        name: 'Daily Analyze',
        description: 'Update table statistics for query optimization',
        type: 'analyze',
        schedule: 'daily',
        status: 'pending'
      },
      {
        id: 'weekly_reindex',
        name: 'Weekly Reindex',
        description: 'Rebuild indexes to optimize performance',
        type: 'reindex',
        schedule: 'weekly',
        status: 'pending'
      },
      {
        id: 'monthly_cleanup',
        name: 'Monthly Cleanup',
        description: 'Clean up old data and temporary files',
        type: 'cleanup',
        schedule: 'monthly',
        status: 'pending'
      },
      {
        id: 'daily_health_check',
        name: 'Daily Health Check',
        description: 'Comprehensive database health assessment',
        type: 'health_check',
        schedule: 'daily',
        status: 'pending'
      }
    ]

    // Calculate next run times
    this.updateNextRunTimes()
    logger.info('Database maintenance tasks initialized')
  }

  /**
   * Run all scheduled maintenance tasks
   */
  async runScheduledMaintenance(): Promise<MaintenanceResult[]> {
    if (this.isRunningMaintenance) {
      logger.warn('Maintenance already running, skipping scheduled run')
      return []
    }

    this.isRunningMaintenance = true
    const results: MaintenanceResult[] = []

    try {
      const now = new Date()

      for (const task of this.maintenanceTasks) {
        if (this.shouldRunTask(task, now)) {
          logger.info(`Running maintenance task: ${task.name}`)
          const result = await this.runMaintenanceTask(task.id)
          results.push(result)

          // Update task status
          task.lastRun = now.toISOString()
          task.status = result.success ? 'completed' : 'failed'
          task.duration = result.duration
          task.errorMessage = result.errorMessage
        }
      }

      // Update next run times
      this.updateNextRunTimes()

    } catch (error) {
      logger.error('Error running scheduled maintenance', { error })
    } finally {
      this.isRunningMaintenance = false
    }

    return results
  }

  /**
   * Run a specific maintenance task
   */
  async runMaintenanceTask(taskId: string): Promise<MaintenanceResult> {
    const startTime = Date.now()
    const task = this.maintenanceTasks.find(t => t.id === taskId)

    if (!task) {
      throw new Error(`Maintenance task ${taskId} not found`)
    }

    try {
      task.status = 'running'
      let result: MaintenanceResult

      switch (task.type) {
        case 'vacuum':
          result = await this.performVacuum()
          break
        case 'analyze':
          result = await this.performAnalyze()
          break
        case 'reindex':
          result = await this.performReindex()
          break
        case 'cleanup':
          result = await this.performCleanup()
          break
        case 'health_check':
          result = await this.performHealthCheck()
          break
        default:
          throw new Error(`Unknown maintenance task type: ${task.type}`)
      }

      task.status = 'completed'
      return result

    } catch (error) {
      task.status = 'failed'
      task.errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        taskId,
        success: false,
        duration: Date.now() - startTime,
        errorMessage: task.errorMessage,
        details: {}
      }
    }
  }

  /**
   * Get database health report
   */
  async getHealthReport(): Promise<DatabaseHealthReport> {
    try {
      const supabase = await createClient()

      // Get database statistics
      const { data: dbStats, error: dbError } = await supabase.rpc('get_database_health_stats')
      if (dbError) throw dbError

      // Analyze issues
      const issues = await this.analyzeHealthIssues(dbStats)
      const overallHealth = this.calculateOverallHealth(issues)

      return {
        overallHealth,
        issues,
        metrics: {
          tableCount: dbStats?.table_count || 0,
          totalSize: dbStats?.total_size || '0 MB',
          lastVacuum: dbStats?.last_vacuum || 'Unknown',
          lastAnalyze: dbStats?.last_analyze || 'Unknown',
          bloatPercentage: dbStats?.bloat_percentage || 0,
          unusedIndexes: dbStats?.unused_indexes || 0
        },
        recommendations: this.generateHealthRecommendations(issues, dbStats)
      }

    } catch (error) {
      logger.error('Error generating health report', { error })
      return {
        overallHealth: 'critical',
        issues: [{
          severity: 'critical',
          category: 'monitoring',
          description: 'Unable to generate health report',
          recommendation: 'Check database connectivity and permissions'
        }],
        metrics: {
          tableCount: 0,
          totalSize: 'Unknown',
          lastVacuum: 'Unknown',
          lastAnalyze: 'Unknown',
          bloatPercentage: 0,
          unusedIndexes: 0
        },
        recommendations: ['Investigate database connectivity issues']
      }
    }
  }

  /**
   * Get maintenance task status
   */
  getMaintenanceTasks(): MaintenanceTask[] {
    return [...this.maintenanceTasks]
  }

  /**
   * Manually trigger maintenance task
   */
  async triggerMaintenanceTask(taskId: string): Promise<MaintenanceResult> {
    return this.runMaintenanceTask(taskId)
  }

  /**
   * Private maintenance methods
   */
  private async performVacuum(): Promise<MaintenanceResult> {
    const startTime = Date.now()
    const supabase = await createClient()

    try {
      // Perform VACUUM on all tables
      const { data, error } = await supabase.rpc('perform_vacuum_maintenance')
      if (error) throw error

      return {
        taskId: 'vacuum',
        success: true,
        duration: Date.now() - startTime,
        affectedRows: data?.affected_rows || 0,
        details: {
          tablesProcessed: data?.tables_processed || 0,
          spaceReclaimed: data?.space_reclaimed || '0 MB'
        }
      }

    } catch (error) {
      logger.error('Error performing vacuum maintenance', { error })
      throw error
    }
  }

  private async performAnalyze(): Promise<MaintenanceResult> {
    const startTime = Date.now()
    const supabase = await createClient()

    try {
      // Perform ANALYZE on all tables
      const { data, error } = await supabase.rpc('perform_analyze_maintenance')
      if (error) throw error

      return {
        taskId: 'analyze',
        success: true,
        duration: Date.now() - startTime,
        affectedRows: data?.tables_processed || 0,
        details: {
          statisticsUpdated: data?.statistics_updated || true,
          tablesProcessed: data?.tables_processed || 0
        }
      }

    } catch (error) {
      logger.error('Error performing analyze maintenance', { error })
      throw error
    }
  }

  private async performReindex(): Promise<MaintenanceResult> {
    const startTime = Date.now()
    const supabase = await createClient()

    try {
      // Perform REINDEX on bloated indexes
      const { data, error } = await supabase.rpc('perform_reindex_maintenance')
      if (error) throw error

      return {
        taskId: 'reindex',
        success: true,
        duration: Date.now() - startTime,
        affectedRows: data?.indexes_processed || 0,
        details: {
          indexesRebuilt: data?.indexes_processed || 0,
          performanceGain: data?.performance_gain || 0
        }
      }

    } catch (error) {
      logger.error('Error performing reindex maintenance', { error })
      throw error
    }
  }

  private async performCleanup(): Promise<MaintenanceResult> {
    const startTime = Date.now()
    const supabase = await createClient()

    try {
      // Clean up old data
      const { data, error } = await supabase.rpc('perform_cleanup_maintenance')
      if (error) throw error

      return {
        taskId: 'cleanup',
        success: true,
        duration: Date.now() - startTime,
        affectedRows: data?.records_deleted || 0,
        details: {
          tempFilesCleaned: data?.temp_files_cleaned || 0,
          oldLogsDeleted: data?.old_logs_deleted || 0,
          spaceReclaimed: data?.space_reclaimed || '0 MB'
        }
      }

    } catch (error) {
      logger.error('Error performing cleanup maintenance', { error })
      throw error
    }
  }

  private async performHealthCheck(): Promise<MaintenanceResult> {
    const startTime = Date.now()

    try {
      const healthReport = await this.getHealthReport()

      return {
        taskId: 'health_check',
        success: true,
        duration: Date.now() - startTime,
        details: {
          overallHealth: healthReport.overallHealth,
          issuesFound: healthReport.issues.length,
          recommendationsCount: healthReport.recommendations.length
        }
      }

    } catch (error) {
      logger.error('Error performing health check', { error })
      throw error
    }
  }

  private shouldRunTask(task: MaintenanceTask, now: Date): boolean {
    if (!task.nextRun) return false

    const nextRun = new Date(task.nextRun)
    return now >= nextRun
  }

  private updateNextRunTimes(): void {
    const now = new Date()

    this.maintenanceTasks.forEach(task => {
      const nextRun = new Date(now)

      switch (task.schedule) {
        case 'daily':
          nextRun.setDate(now.getDate() + 1)
          nextRun.setHours(2, 0, 0, 0) // 2 AM tomorrow
          break
        case 'weekly':
          nextRun.setDate(now.getDate() + 7)
          nextRun.setHours(3, 0, 0, 0) // 3 AM next week
          break
        case 'monthly':
          nextRun.setMonth(now.getMonth() + 1)
          nextRun.setHours(4, 0, 0, 0) // 4 AM next month
          break
      }

      task.nextRun = nextRun.toISOString()
    })
  }

  private async analyzeHealthIssues(dbStats: any): Promise<DatabaseHealthReport['issues']> {
    const issues: DatabaseHealthReport['issues'] = []

    // Check bloat
    if (dbStats?.bloat_percentage > 30) {
      issues.push({
        severity: 'high',
        category: 'performance',
        description: `High table bloat detected: ${dbStats.bloat_percentage}%`,
        recommendation: 'Run VACUUM FULL on bloated tables or consider table reorganization'
      })
    }

    // Check unused indexes
    if (dbStats?.unused_indexes > 5) {
      issues.push({
        severity: 'medium',
        category: 'performance',
        description: `${dbStats.unused_indexes} unused indexes found`,
        recommendation: 'Consider dropping unused indexes to improve write performance'
      })
    }

    // Check last vacuum
    if (dbStats?.last_vacuum) {
      const daysSinceVacuum = Math.floor((Date.now() - new Date(dbStats.last_vacuum).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceVacuum > 7) {
        issues.push({
          severity: 'medium',
          category: 'maintenance',
          description: `Last VACUUM was ${daysSinceVacuum} days ago`,
          recommendation: 'Schedule regular VACUUM operations'
        })
      }
    }

    // Check last analyze
    if (dbStats?.last_analyze) {
      const daysSinceAnalyze = Math.floor((Date.now() - new Date(dbStats.last_analyze).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSinceAnalyze > 7) {
        issues.push({
          severity: 'medium',
          category: 'maintenance',
          description: `Last ANALYZE was ${daysSinceAnalyze} days ago`,
          recommendation: 'Update table statistics regularly'
        })
      }
    }

    return issues
  }

  private calculateOverallHealth(issues: DatabaseHealthReport['issues']): DatabaseHealthReport['overallHealth'] {
    const criticalCount = issues.filter(i => i.severity === 'critical').length
    const highCount = issues.filter(i => i.severity === 'high').length
    const mediumCount = issues.filter(i => i.severity === 'medium').length

    if (criticalCount > 0) return 'critical'
    if (highCount > 2) return 'poor'
    if (highCount > 0 || mediumCount > 3) return 'fair'
    if (mediumCount > 0) return 'good'
    return 'excellent'
  }

  private generateHealthRecommendations(
    issues: DatabaseHealthReport['issues'],
    dbStats: any
  ): string[] {
    const recommendations: string[] = []

    if (issues.some(i => i.category === 'performance')) {
      recommendations.push('Consider running database performance optimization')
    }

    if (issues.some(i => i.category === 'maintenance')) {
      recommendations.push('Schedule regular maintenance tasks (VACUUM, ANALYZE)')
    }

    if (dbStats?.unused_indexes > 0) {
      recommendations.push('Review and remove unused indexes')
    }

    if (dbStats?.bloat_percentage > 20) {
      recommendations.push('Consider table reorganization to reduce bloat')
    }

    return recommendations
  }
}

// Export singleton instance
export const databaseMaintenanceManager = DatabaseMaintenanceManager.getInstance()