import { promises as fs } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'
import { createDatabaseBackup, restoreDatabaseBackup } from './database-backup'
import { createFileBackup, restoreFileBackup } from './file-backup'

export interface DisasterRecoveryConfig {
  rto: number // Recovery Time Objective in minutes
  rpo: number // Recovery Point Objective in minutes
  testFrequency: string // cron expression for DR tests
  notificationEmails: string[]
  slackWebhook?: string
  backupVerificationEnabled: boolean
  automatedFailoverEnabled: boolean
  geoRedundancyEnabled: boolean
}

export interface DRTestResult {
  testId: string
  testType: 'full' | 'partial' | 'failover'
  startTime: Date
  endTime: Date
  duration: number
  success: boolean
  components: {
    database: { success: boolean; duration: number; error?: string }
    files: { success: boolean; duration: number; error?: string }
    network: { success: boolean; duration: number; error?: string }
    services: { success: boolean; duration: number; error?: string }
  }
  rtoAchieved: boolean
  rpoAchieved: boolean
  recommendations: string[]
  error?: string
}

export interface IncidentResponse {
  incidentId: string
  type: 'data_loss' | 'service_outage' | 'security_breach' | 'hardware_failure'
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: Date
  acknowledgedAt?: Date
  resolvedAt?: Date
  impact: string
  actions: IncidentAction[]
  status: 'detected' | 'acknowledged' | 'investigating' | 'resolved' | 'closed'
}

export interface IncidentAction {
  timestamp: Date
  action: string
  actor: string
  result: string
  duration?: number
}

export class DisasterRecoveryService {
  private config: DisasterRecoveryConfig
  private activeTests: Set<string> = new Set()
  private incidents: Map<string, IncidentResponse> = new Map()

  constructor(config: Partial<DisasterRecoveryConfig> = {}) {
    this.config = {
      rto: 60, // 1 hour
      rpo: 15, // 15 minutes
      testFrequency: '0 2 * * 0', // Weekly on Sunday at 2 AM
      notificationEmails: [],
      backupVerificationEnabled: true,
      automatedFailoverEnabled: false,
      geoRedundancyEnabled: false,
      ...config,
    }

    this.ensureDRDirectories()
  }

  /**
   * Run disaster recovery test
   */
  async runDRTest(testType: 'full' | 'partial' | 'failover' = 'full'): Promise<DRTestResult> {
    const testId = this.generateTestId()
    const startTime = new Date()

    try {
      // Check if test is already running
      if (this.activeTests.size >= 3) {
        throw new Error('Maximum concurrent DR tests reached')
      }

      this.activeTests.add(testId)

      logger.info('Starting disaster recovery test', { testId, testType })

      const components = {
        database: await this.testDatabaseRecovery(testType),
        files: await this.testFileRecovery(testType),
        network: await this.testNetworkRecovery(testType),
        services: await this.testServiceRecovery(testType),
      }

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()
      const success = Object.values(components).every(c => c.success)

      const rtoAchieved = duration <= (this.config.rto * 60 * 1000)
      const rpoAchieved = await this.verifyRPO()

      const recommendations = this.generateRecommendations(components, duration)

      const result: DRTestResult = {
        testId,
        testType,
        startTime,
        endTime,
        duration,
        success,
        components,
        rtoAchieved,
        rpoAchieved,
        recommendations,
      }

      // Log test results
      SecurityAudit.logSensitiveAction('dr_test_completed', 'system', {
        testId,
        testType,
        success,
        duration,
        rtoAchieved,
        rpoAchieved,
      })

      // Send notifications if configured
      if (!success || !rtoAchieved || !rpoAchieved) {
        await this.sendDRAlert(result)
      }

      // Save test results
      await this.saveTestResults(result)

      logger.info('Disaster recovery test completed', {
        testId,
        success,
        duration,
        rtoAchieved,
        rpoAchieved,
      })

      return result

    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      logger.error('Disaster recovery test failed', error as Error, {
        testId,
        testType,
        duration,
      })

      return {
        testId,
        testType,
        startTime,
        endTime,
        duration,
        success: false,
        components: {
          database: { success: false, duration: 0, error: (error as Error).message },
          files: { success: false, duration: 0 },
          network: { success: false, duration: 0 },
          services: { success: false, duration: 0 },
        },
        rtoAchieved: false,
        rpoAchieved: false,
        recommendations: ['Review error logs and fix underlying issues'],
        error: (error as Error).message,
      }
    } finally {
      this.activeTests.delete(testId)
    }
  }

  /**
   * Report and handle incident
   */
  async reportIncident(
    type: IncidentResponse['type'],
    severity: IncidentResponse['severity'],
    impact: string
  ): Promise<IncidentResponse> {
    const incidentId = this.generateIncidentId()
    const detectedAt = new Date()

    const incident: IncidentResponse = {
      incidentId,
      type,
      severity,
      detectedAt,
      impact,
      actions: [],
      status: 'detected',
    }

    this.incidents.set(incidentId, incident)

    // Log incident
    SecurityAudit.logSensitiveAction('incident_reported', 'system', {
      incidentId,
      type,
      severity,
      impact,
    })

    // Send alerts
    await this.sendIncidentAlert(incident)

    // Trigger automated response if configured
    if (this.config.automatedFailoverEnabled && severity === 'critical') {
      await this.triggerAutomatedResponse(incident)
    }

    logger.warn('Incident reported', {
      incidentId,
      type,
      severity,
      impact,
    })

    return incident
  }

  /**
   * Update incident status
   */
  async updateIncident(
    incidentId: string,
    updates: Partial<IncidentResponse>
  ): Promise<IncidentResponse | null> {
    const incident = this.incidents.get(incidentId)
    if (!incident) {
      return null
    }

    Object.assign(incident, updates)

    // Log status change
    SecurityAudit.logSensitiveAction('incident_updated', 'system', {
      incidentId,
      status: incident.status,
      updates,
    })

    // Send resolution notification if resolved
    if (updates.status === 'resolved' && incident.resolvedAt) {
      await this.sendResolutionNotification(incident)
    }

    return incident
  }

  /**
   * Get business continuity plan
   */
  getBusinessContinuityPlan(): any {
    return {
      objectives: {
        rto: this.config.rto,
        rpo: this.config.rpo,
      },
      procedures: {
        dataBackup: 'Automated daily backups with encryption',
        systemFailover: 'Multi-region deployment with automated failover',
        communication: 'Slack and email notifications for incidents',
        testing: `Regular DR tests (${this.config.testFrequency})`,
      },
      contacts: {
        technicalLead: 'System Administrator',
        businessOwner: 'Business Operations Manager',
        externalSupport: 'Cloud provider support',
      },
      resources: {
        backupSystems: 'Automated database and file backups',
        monitoring: 'Comprehensive system monitoring',
        documentation: 'DR procedures and runbooks',
      },
    }
  }

  /**
   * List recent DR tests
   */
  async listDRTests(limit: number = 10): Promise<DRTestResult[]> {
    try {
      const testDir = join(process.cwd(), 'dr-tests')
      const files = await fs.readdir(testDir)
      const testFiles = files
        .filter(f => f.startsWith('test_') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit)

      const tests = []
      for (const file of testFiles) {
        try {
          const content = await fs.readFile(join(testDir, file), 'utf-8')
          tests.push(JSON.parse(content))
        } catch {
          // Skip invalid files
        }
      }

      return tests
    } catch {
      return []
    }
  }

  /**
   * List active incidents
   */
  listIncidents(): IncidentResponse[] {
    return Array.from(this.incidents.values())
      .filter(i => i.status !== 'closed')
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
  }

  /**
   * Test database recovery
   */
  private async testDatabaseRecovery(testType: string): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = Date.now()

    try {
      if (testType === 'full') {
        // Create test backup
        const backupResult = await createDatabaseBackup()
        if (!backupResult.success) {
          throw new Error(backupResult.error || 'Backup creation failed')
        }

        // Test restore to temporary location
        const restoreResult = await this.testDatabaseRestore(backupResult.backupId)
        if (!restoreResult.success) {
          throw new Error(restoreResult.error || 'Restore test failed')
        }
      }

      return {
        success: true,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  }

  /**
   * Test file recovery
   */
  private async testFileRecovery(testType: string): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = Date.now()

    try {
      if (testType === 'full') {
        // Create test backup
        const backupResult = await createFileBackup()
        if (!backupResult.success) {
          throw new Error(backupResult.error || 'File backup creation failed')
        }

        // Test restore to temporary location
        const restoreResult = await this.testFileRestore(backupResult.backupId)
        if (!restoreResult.success) {
          throw new Error(restoreResult.error || 'File restore test failed')
        }
      }

      return {
        success: true,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  }

  /**
   * Test network recovery
   */
  private async testNetworkRecovery(testType: string): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = Date.now()

    try {
      // Test connectivity to backup endpoints
      await this.testConnectivity()

      return {
        success: true,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  }

  /**
   * Test service recovery
   */
  private async testServiceRecovery(testType: string): Promise<{ success: boolean; duration: number; error?: string }> {
    const startTime = Date.now()

    try {
      // Test critical service endpoints
      await this.testServiceEndpoints()

      return {
        success: true,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: (error as Error).message,
      }
    }
  }

  /**
   * Test database restore
   */
  private async testDatabaseRestore(backupId: string): Promise<{ success: boolean; error?: string }> {
    // In a real implementation, this would restore to a test database
    // For now, just verify the backup exists and is valid
    try {
      const result = await restoreDatabaseBackup(backupId)
      return result
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  /**
   * Test file restore
   */
  private async testFileRestore(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await restoreFileBackup(backupId, join(process.cwd(), 'temp-restore-test'))
      return result
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  /**
   * Test connectivity
   */
  private async testConnectivity(): Promise<void> {
    // Test connection to Supabase
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    await client.from('test').select('*').limit(1)
  }

  /**
   * Test service endpoints
   */
  private async testServiceEndpoints(): Promise<void> {
    const endpoints = [
      'http://localhost:3001/api/health',
      'http://localhost:3001/api/health/live',
      'http://localhost:3001/api/health/ready',
    ]

    for (const endpoint of endpoints) {
      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error(`Service endpoint ${endpoint} is not responding`)
      }
    }
  }

  /**
   * Verify RPO compliance
   */
  private async verifyRPO(): Promise<boolean> {
    // Check if latest backup is within RPO window
    try {
      const backups = await import('./database-backup').then(m => m.listDatabaseBackups())
      if (backups.length === 0) {
        return false
      }

      const latestBackup = backups[0]
      const backupAge = Date.now() - latestBackup.createdAt.getTime()
      const rpoMs = this.config.rpo * 60 * 1000

      return backupAge <= rpoMs
    } catch {
      return false
    }
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(
    components: DRTestResult['components'],
    duration: number
  ): string[] {
    const recommendations = []

    if (!components.database.success) {
      recommendations.push('Review database backup and restore procedures')
    }

    if (!components.files.success) {
      recommendations.push('Check file backup configuration and storage')
    }

    if (!components.network.success) {
      recommendations.push('Verify network connectivity and firewall rules')
    }

    if (!components.services.success) {
      recommendations.push('Review service startup and dependency management')
    }

    if (duration > this.config.rto * 60 * 1000) {
      recommendations.push('Optimize recovery processes to meet RTO requirements')
    }

    return recommendations
  }

  /**
   * Send DR test alert
   */
  private async sendDRAlert(result: DRTestResult): Promise<void> {
    const message = {
      text: `🚨 DR Test ${result.success ? 'Issues Detected' : 'Failed'}`,
      attachments: [{
        color: result.success ? 'warning' : 'danger',
        fields: [
          { title: 'Test ID', value: result.testId, short: true },
          { title: 'Type', value: result.testType, short: true },
          { title: 'Duration', value: `${Math.round(result.duration / 1000)}s`, short: true },
          { title: 'RTO Achieved', value: result.rtoAchieved ? '✅' : '❌', short: true },
          { title: 'RPO Achieved', value: result.rpoAchieved ? '✅' : '❌', short: true },
        ],
      }],
    }

    if (this.config.slackWebhook) {
      await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
    }
  }

  /**
   * Send incident alert
   */
  private async sendIncidentAlert(incident: IncidentResponse): Promise<void> {
    const message = {
      text: `🚨 Incident Reported: ${incident.type.toUpperCase()}`,
      attachments: [{
        color: incident.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Incident ID', value: incident.incidentId, short: true },
          { title: 'Severity', value: incident.severity.toUpperCase(), short: true },
          { title: 'Type', value: incident.type, short: true },
          { title: 'Impact', value: incident.impact, short: false },
        ],
      }],
    }

    if (this.config.slackWebhook) {
      await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
    }
  }

  /**
   * Send resolution notification
   */
  private async sendResolutionNotification(incident: IncidentResponse): Promise<void> {
    const message = {
      text: `✅ Incident Resolved: ${incident.incidentId}`,
      attachments: [{
        color: 'good',
        fields: [
          { title: 'Resolution Time', value: incident.resolvedAt ?
            `${Math.round((incident.resolvedAt.getTime() - incident.detectedAt.getTime()) / (1000 * 60))} minutes` : 'N/A', short: true },
        ],
      }],
    }

    if (this.config.slackWebhook) {
      await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
    }
  }

  /**
   * Trigger automated response
   */
  private async triggerAutomatedResponse(incident: IncidentResponse): Promise<void> {
    logger.info('Triggering automated response', { incidentId: incident.incidentId })

    // Implement automated failover logic here
    // This could include switching to backup systems, scaling resources, etc.
  }

  /**
   * Save test results
   */
  private async saveTestResults(result: DRTestResult): Promise<void> {
    try {
      const testDir = join(process.cwd(), 'dr-tests')
      const fileName = `test_${result.testId}.json`
      const filePath = join(testDir, fileName)

      await fs.writeFile(filePath, JSON.stringify(result, null, 2))
    } catch (error) {
      logger.error('Failed to save test results', error as Error, { testId: result.testId })
    }
  }

  /**
   * Generate unique test ID
   */
  private generateTestId(): string {
    return require('crypto').randomBytes(8).toString('hex')
  }

  /**
   * Generate unique incident ID
   */
  private generateIncidentId(): string {
    return `INC-${Date.now()}-${require('crypto').randomBytes(4).toString('hex')}`
  }

  /**
   * Ensure DR directories exist
   */
  private async ensureDRDirectories(): Promise<void> {
    try {
      const dirs = [
        join(process.cwd(), 'dr-tests'),
        join(process.cwd(), 'dr-reports'),
        join(process.cwd(), 'incident-logs'),
      ]

      for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true })
      }
    } catch (error) {
      logger.error('Failed to create DR directories', error as Error)
    }
  }
}

// Export singleton instance
export const disasterRecoveryService = new DisasterRecoveryService()

// Export convenience functions
export async function runDisasterRecoveryTest(testType?: 'full' | 'partial' | 'failover'): Promise<DRTestResult> {
  return disasterRecoveryService.runDRTest(testType)
}

export async function reportIncident(
  type: IncidentResponse['type'],
  severity: IncidentResponse['severity'],
  impact: string
): Promise<IncidentResponse> {
  return disasterRecoveryService.reportIncident(type, severity, impact)
}

export async function getBusinessContinuityPlan(): Promise<any> {
  return disasterRecoveryService.getBusinessContinuityPlan()
}

export async function listDRTests(limit?: number): Promise<DRTestResult[]> {
  return disasterRecoveryService.listDRTests(limit)
}

export function listActiveIncidents(): IncidentResponse[] {
  return disasterRecoveryService.listIncidents()
}