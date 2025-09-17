import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface AnomalyPattern {
  id: string
  name: string
  description: string
  patternType: 'frequency' | 'threshold' | 'correlation' | 'behavioral'
  logType: string
  conditions: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
  alertEnabled: boolean
  alertChannels: string[]
  cooldownMinutes: number
  falsePositiveRate: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AnomalyDetection {
  id: string
  patternId: string
  detectedAt: Date
  logEntries: any[]
  anomalyScore: number
  confidence: number
  description: string
  affectedUsers: string[]
  affectedResources: any[]
  alertSent: boolean
  alertSentAt?: Date
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
  resolutionNotes?: string
  metadata: Record<string, any>
}

export interface DetectionResult {
  patternId: string
  patternName: string
  severity: string
  detections: AnomalyDetection[]
  totalScore: number
}

export class AnomalyDetectionService {
  private static instance: AnomalyDetectionService
  private lastRunTimes = new Map<string, Date>()

  static getInstance(): AnomalyDetectionService {
    if (!AnomalyDetectionService.instance) {
      AnomalyDetectionService.instance = new AnomalyDetectionService()
    }
    return AnomalyDetectionService.instance
  }

  /**
   * Run anomaly detection on all active patterns
   */
  async runDetection(): Promise<DetectionResult[]> {
    const results: DetectionResult[] = []

    try {
      const patterns = await this.getActivePatterns()

      for (const pattern of patterns) {
        try {
          // Check cooldown
          if (this.isInCooldown(pattern)) {
            continue
          }

          const detections = await this.detectAnomalies(pattern)

          if (detections.length > 0) {
            const totalScore = detections.reduce((sum, d) => sum + d.anomalyScore, 0)

            results.push({
              patternId: pattern.id,
              patternName: pattern.name,
              severity: pattern.severity,
              detections,
              totalScore
            })

            // Update last run time
            this.lastRunTimes.set(pattern.id, new Date())

            // Send alerts if enabled
            if (pattern.alertEnabled) {
              await this.sendAnomalyAlerts(pattern, detections)
            }
          }

        } catch (error) {
          logger.error(`Failed to run detection for pattern ${pattern.id}`, { error })
        }
      }

    } catch (error) {
      logger.error('Failed to run anomaly detection', { error })
    }

    return results
  }

  /**
   * Detect anomalies for a specific pattern
   */
  private async detectAnomalies(pattern: AnomalyPattern): Promise<AnomalyDetection[]> {
    const detections: AnomalyDetection[] = []

    try {
      switch (pattern.patternType) {
        case 'frequency':
          detections.push(...await this.detectFrequencyAnomalies(pattern))
          break
        case 'threshold':
          detections.push(...await this.detectThresholdAnomalies(pattern))
          break
        case 'correlation':
          detections.push(...await this.detectCorrelationAnomalies(pattern))
          break
        case 'behavioral':
          detections.push(...await this.detectBehavioralAnomalies(pattern))
          break
      }

    } catch (error) {
      logger.error(`Failed to detect anomalies for pattern ${pattern.id}`, { error })
    }

    return detections
  }

  /**
   * Detect frequency-based anomalies
   */
  private async detectFrequencyAnomalies(pattern: AnomalyPattern): Promise<AnomalyDetection[]> {
    const detections: AnomalyDetection[] = []
    const supabase = await createClient()

    try {
      const conditions = pattern.conditions
      const windowMinutes = conditions.window_minutes || 5
      const threshold = conditions.threshold || 10
      const groupBy = conditions.group_by || 'ip_address'

      const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

      // Query logs based on pattern conditions
      let query = supabase
        .from(pattern.logType)
        .select('*')
        .gte('timestamp', windowStart.toISOString())

      // Apply pattern-specific conditions
      if (conditions.action) {
        query = query.eq('action', conditions.action)
      }
      if (conditions.level) {
        query = query.eq('level', conditions.level)
      }
      if (conditions.source) {
        query = query.eq('source', conditions.source)
      }

      const { data: logs, error } = await query.limit(1000)

      if (error) throw error
      if (!logs || logs.length === 0) return detections

      // Group by specified field and count
      const groups = new Map<string, any[]>()

      for (const log of logs) {
        const key = log[groupBy] || 'unknown'
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push(log)
      }

      // Check for anomalies
      for (const [groupKey, groupLogs] of groups) {
        if (groupLogs.length >= threshold) {
          const anomalyScore = Math.min(groupLogs.length / threshold, 10) // Cap at 10
          const confidence = Math.min(groupLogs.length / (threshold * 2), 1) // Confidence calculation

          const detection: AnomalyDetection = {
            id: `anom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            patternId: pattern.id,
            detectedAt: new Date(),
            logEntries: groupLogs,
            anomalyScore,
            confidence,
            description: `${pattern.name}: ${groupLogs.length} events for ${groupBy}=${groupKey} in ${windowMinutes} minutes (threshold: ${threshold})`,
            affectedUsers: [...new Set(groupLogs.map(log => log.user_id).filter(Boolean))],
            affectedResources: [],
            alertSent: false,
            resolved: false,
            metadata: {
              groupBy,
              groupKey,
              eventCount: groupLogs.length,
              threshold,
              windowMinutes
            }
          }

          detections.push(detection)
          await this.saveDetection(detection)
        }
      }

    } catch (error) {
      logger.error('Failed to detect frequency anomalies', { error, patternId: pattern.id })
    }

    return detections
  }

  /**
   * Detect threshold-based anomalies
   */
  private async detectThresholdAnomalies(pattern: AnomalyPattern): Promise<AnomalyDetection[]> {
    const detections: AnomalyDetection[] = []
    const supabase = await createClient()

    try {
      const conditions = pattern.conditions
      const threshold = conditions.threshold || 100
      const metric = conditions.metric || 'count'

      // This is a simplified implementation
      // In production, you would implement specific threshold checks
      // based on the metric type (CPU usage, error rate, etc.)

      const detection: AnomalyDetection = {
        id: `anom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patternId: pattern.id,
        detectedAt: new Date(),
        logEntries: [],
        anomalyScore: 1,
        confidence: 0.8,
        description: `${pattern.name}: Threshold exceeded (${metric} >= ${threshold})`,
        affectedUsers: [],
        affectedResources: [],
        alertSent: false,
        resolved: false,
        metadata: { threshold, metric }
      }

      detections.push(detection)
      await this.saveDetection(detection)

    } catch (error) {
      logger.error('Failed to detect threshold anomalies', { error, patternId: pattern.id })
    }

    return detections
  }

  /**
   * Detect correlation-based anomalies
   */
  private async detectCorrelationAnomalies(pattern: AnomalyPattern): Promise<AnomalyDetection[]> {
    const detections: AnomalyDetection[] = []

    // This would implement correlation analysis between different log types
    // For example, detecting if failed logins are followed by successful logins from different IPs
    // Simplified implementation for now

    return detections
  }

  /**
   * Detect behavioral anomalies
   */
  private async detectBehavioralAnomalies(pattern: AnomalyPattern): Promise<AnomalyDetection[]> {
    const detections: AnomalyDetection[] = []
    const supabase = await createClient()

    try {
      const conditions = pattern.conditions

      if (conditions.check_location_anomaly) {
        detections.push(...await this.detectLocationAnomalies(pattern))
      }

      if (conditions.check_time_anomaly) {
        detections.push(...await this.detectTimeAnomalies(pattern))
      }

      // Add more behavioral checks as needed

    } catch (error) {
      logger.error('Failed to detect behavioral anomalies', { error, patternId: pattern.id })
    }

    return detections
  }

  /**
   * Detect unusual login locations
   */
  private async detectLocationAnomalies(pattern: AnomalyPattern): Promise<AnomalyDetection[]> {
    const detections: AnomalyDetection[] = []
    const supabase = await createClient()

    try {
      // Get recent login events
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const { data: loginEvents, error } = await supabase
        .from('audit_trails')
        .select('*')
        .eq('action', 'login_success')
        .gte('timestamp', sevenDaysAgo.toISOString())
        .order('timestamp', { ascending: false })
        .limit(100)

      if (error) throw error
      if (!loginEvents || loginEvents.length === 0) return detections

      // Group by user and check for location anomalies
      const userLogins = new Map<string, any[]>()

      for (const event of loginEvents) {
        const userId = event.user_id
        if (!userLogins.has(userId)) {
          userLogins.set(userId, [])
        }
        userLogins.get(userId)!.push(event)
      }

      for (const [userId, events] of userLogins) {
        const locations = new Set(events.map(e => e.ip_address).filter(Boolean))
        const uniqueLocations = locations.size

        // If user has logged in from more than 5 different locations in 7 days
        if (uniqueLocations >= 5) {
          const detection: AnomalyDetection = {
            id: `anom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            patternId: pattern.id,
            detectedAt: new Date(),
            logEntries: events,
            anomalyScore: Math.min(uniqueLocations / 3, 10),
            confidence: 0.9,
            description: `User ${userId} logged in from ${uniqueLocations} different locations in 7 days`,
            affectedUsers: [userId],
            affectedResources: [],
            alertSent: false,
            resolved: false,
            metadata: {
              uniqueLocations,
              timeWindow: '7 days',
              loginCount: events.length
            }
          }

          detections.push(detection)
          await this.saveDetection(detection)
        }
      }

    } catch (error) {
      logger.error('Failed to detect location anomalies', { error })
    }

    return detections
  }

  /**
   * Detect unusual login times
   */
  private async detectTimeAnomalies(pattern: AnomalyPattern): Promise<AnomalyDetection[]> {
    const detections: AnomalyDetection[] = []

    // This would detect logins at unusual hours
    // Simplified implementation

    return detections
  }

  /**
   * Save anomaly detection to database
   */
  private async saveDetection(detection: AnomalyDetection): Promise<void> {
    const supabase = await createClient()

    try {
      await supabase
        .from('anomaly_detections')
        .insert({
          pattern_id: detection.patternId,
          detected_at: detection.detectedAt.toISOString(),
          log_entries: detection.logEntries,
          anomaly_score: detection.anomalyScore,
          confidence: detection.confidence,
          description: detection.description,
          affected_users: detection.affectedUsers,
          affected_resources: detection.affectedResources,
          alert_sent: detection.alertSent,
          resolved: detection.resolved,
          metadata: detection.metadata
        })
    } catch (error) {
      logger.error('Failed to save anomaly detection', { error, detectionId: detection.id })
    }
  }

  /**
   * Send alerts for detected anomalies
   */
  private async sendAnomalyAlerts(pattern: AnomalyPattern, detections: AnomalyDetection[]): Promise<void> {
    try {
      for (const channel of pattern.alertChannels) {
        switch (channel) {
          case 'dashboard':
            await this.sendDashboardAlert(pattern, detections)
            break
          case 'email':
            await this.sendEmailAlert(pattern, detections)
            break
          case 'webhook':
            await this.sendWebhookAlert(pattern, detections)
            break
        }
      }

      // Mark alerts as sent
      const supabase = await createClient()
      for (const detection of detections) {
        await supabase
          .from('anomaly_detections')
          .update({
            alert_sent: true,
            alert_sent_at: new Date().toISOString()
          })
          .eq('id', detection.id)
      }

    } catch (error) {
      logger.error('Failed to send anomaly alerts', { error, patternId: pattern.id })
    }
  }

  /**
   * Send dashboard alert
   */
  private async sendDashboardAlert(pattern: AnomalyPattern, detections: AnomalyDetection[]): Promise<void> {
    await logger.warn(`ANOMALY ALERT: ${pattern.name}`, {
      patternId: pattern.id,
      severity: pattern.severity,
      detectionCount: detections.length,
      totalScore: detections.reduce((sum, d) => sum + d.anomalyScore, 0),
      detections: detections.map(d => ({
        id: d.id,
        description: d.description,
        score: d.anomalyScore,
        confidence: d.confidence
      }))
    })
  }

  /**
   * Send email alert (placeholder)
   */
  private async sendEmailAlert(pattern: AnomalyPattern, detections: AnomalyDetection[]): Promise<void> {
    // In production, integrate with email service
    logger.info('Email alert would be sent', { pattern: pattern.name, detections: detections.length })
  }

  /**
   * Send webhook alert (placeholder)
   */
  private async sendWebhookAlert(pattern: AnomalyPattern, detections: AnomalyDetection[]): Promise<void> {
    // In production, send to configured webhooks
    logger.info('Webhook alert would be sent', { pattern: pattern.name, detections: detections.length })
  }

  /**
   * Get active anomaly patterns
   */
  async getActivePatterns(): Promise<AnomalyPattern[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('anomaly_patterns')
      .select('*')
      .eq('is_active', true)

    if (error) throw error

    return (data || []).map(pattern => ({
      id: pattern.id,
      name: pattern.name,
      description: pattern.description,
      patternType: pattern.pattern_type,
      logType: pattern.log_type,
      conditions: pattern.conditions || {},
      severity: pattern.severity,
      alertEnabled: pattern.alert_enabled,
      alertChannels: pattern.alert_channels || [],
      cooldownMinutes: pattern.cooldown_minutes,
      falsePositiveRate: pattern.false_positive_rate,
      isActive: pattern.is_active,
      createdAt: new Date(pattern.created_at),
      updatedAt: new Date(pattern.updated_at)
    }))
  }

  /**
   * Check if pattern is in cooldown
   */
  private isInCooldown(pattern: AnomalyPattern): boolean {
    const lastRun = this.lastRunTimes.get(pattern.id)
    if (!lastRun) return false

    const cooldownMs = pattern.cooldownMinutes * 60 * 1000
    return Date.now() - lastRun.getTime() < cooldownMs
  }

  /**
   * Get anomaly detection statistics
   */
  async getDetectionStats(timeRange: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalDetections: number
    detectionsBySeverity: Record<string, number>
    detectionsByPattern: Record<string, number>
    unresolvedDetections: number
    recentDetections: AnomalyDetection[]
  }> {
    const supabase = await createClient()

    const timeRangeMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    }[timeRange]

    const startTime = new Date(Date.now() - timeRangeMs)

    const { data: detections, error } = await supabase
      .from('anomaly_detections')
      .select(`
        *,
        anomaly_patterns(name, severity)
      `)
      .gte('detected_at', startTime.toISOString())
      .order('detected_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const stats = {
      totalDetections: detections?.length || 0,
      detectionsBySeverity: {} as Record<string, number>,
      detectionsByPattern: {} as Record<string, number>,
      unresolvedDetections: 0,
      recentDetections: [] as AnomalyDetection[]
    }

    for (const detection of detections || []) {
      const severity = (detection.anomaly_patterns as any)?.severity || 'unknown'
      const patternName = (detection.anomaly_patterns as any)?.name || 'unknown'

      stats.detectionsBySeverity[severity] = (stats.detectionsBySeverity[severity] || 0) + 1
      stats.detectionsByPattern[patternName] = (stats.detectionsByPattern[patternName] || 0) + 1

      if (!detection.resolved) {
        stats.unresolvedDetections++
      }

      if (stats.recentDetections.length < 10) {
        stats.recentDetections.push({
          id: detection.id,
          patternId: detection.pattern_id,
          detectedAt: new Date(detection.detected_at),
          logEntries: detection.log_entries || [],
          anomalyScore: detection.anomaly_score,
          confidence: detection.confidence,
          description: detection.description,
          affectedUsers: detection.affected_users || [],
          affectedResources: detection.affected_resources || [],
          alertSent: detection.alert_sent,
          alertSentAt: detection.alert_sent_at ? new Date(detection.alert_sent_at) : undefined,
          resolved: detection.resolved,
          resolvedAt: detection.resolved_at ? new Date(detection.resolved_at) : undefined,
          resolvedBy: detection.resolved_by,
          resolutionNotes: detection.resolution_notes,
          metadata: detection.metadata || {}
        })
      }
    }

    return stats
  }
}

// Export singleton instance
export const anomalyDetectionService = AnomalyDetectionService.getInstance()

// Scheduled job function
export async function runAnomalyDetection(): Promise<void> {
  try {
    const results = await anomalyDetectionService.runDetection()

    const totalDetections = results.reduce((sum, result) => sum + result.detections.length, 0)

    await logger.info('Anomaly detection completed', {
      patternsChecked: results.length,
      totalDetections,
      results: results.map(r => ({
        pattern: r.patternName,
        severity: r.severity,
        detections: r.detections.length,
        totalScore: r.totalScore
      }))
    })

  } catch (error) {
    await logger.error('Anomaly detection failed', { error })
  }
}