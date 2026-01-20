import { logger } from '@/lib/logger'

export interface ConversationIntelligenceMetrics {
  totalAnalyses: number
  successfulAnalyses: number
  failedAnalyses: number
  averageProcessingTime: number
  emotionDetectionAccuracy: number
  intentClassificationAccuracy: number
  apiCallCount: number
  apiErrorCount: number
  cacheHitRate: number
  tenantUsage: Record<string, number>
}

export interface ConversationIntelligenceError {
  id: string
  type: 'emotion_detection' | 'intent_classification' | 'api_error' | 'validation_error' | 'timeout'
  conversationId: string
  tenantId?: string
  userId?: string
  error: Error
  context: Record<string, any>
  timestamp: string
  resolved: boolean
}

export interface PerformanceAlert {
  id: string
  type: 'high_latency' | 'high_error_rate' | 'api_limit' | 'system_overload'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  metrics: Record<string, number>
  timestamp: string
  acknowledged: boolean
}

export class ConversationIntelligenceMonitor {
  private metrics: ConversationIntelligenceMetrics = {
    totalAnalyses: 0,
    successfulAnalyses: 0,
    failedAnalyses: 0,
    averageProcessingTime: 0,
    emotionDetectionAccuracy: 0,
    intentClassificationAccuracy: 0,
    apiCallCount: 0,
    apiErrorCount: 0,
    cacheHitRate: 0,
    tenantUsage: {}
  }

  private errors: ConversationIntelligenceError[] = []
  private alerts: PerformanceAlert[] = []
  private processingTimes: number[] = []
  private readonly maxErrors = 1000
  private readonly maxAlerts = 100

  // Record successful analysis
  recordSuccess(
    conversationId: string,
    tenantId: string,
    processingTime: number,
    emotionConfidence?: number,
    intentConfidence?: number
  ): void {
    this.metrics.totalAnalyses++
    this.metrics.successfulAnalyses++

    // Update tenant usage
    this.metrics.tenantUsage[tenantId] = (this.metrics.tenantUsage[tenantId] || 0) + 1

    // Track processing time
    this.processingTimes.push(processingTime)
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift() // Keep only last 1000 measurements
    }

    // Update average processing time
    this.metrics.averageProcessingTime =
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length

    // Update accuracy metrics
    if (emotionConfidence !== undefined) {
      this.updateAccuracyMetric('emotion', emotionConfidence)
    }

    if (intentConfidence !== undefined) {
      this.updateAccuracyMetric('intent', intentConfidence)
    }

    logger.info('Conversation intelligence analysis recorded as success', {
      conversationId,
      tenantId,
      processingTime,
      emotionConfidence,
      intentConfidence
    })
  }

  // Record failed analysis
  recordFailure(
    conversationId: string,
    tenantId: string,
    error: Error,
    context: Record<string, any> = {}
  ): void {
    this.metrics.totalAnalyses++
    this.metrics.failedAnalyses++

    // Record error details
    const errorRecord: ConversationIntelligenceError = {
      id: this.generateId(),
      type: this.categorizeError(error),
      conversationId,
      tenantId,
      error,
      context,
      timestamp: new Date().toISOString(),
      resolved: false
    }

    this.errors.push(errorRecord)

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift()
    }

    // Check for performance alerts
    this.checkPerformanceAlerts()

    logger.error('Conversation intelligence analysis recorded as failure', error, {
      conversationId,
      tenantId,
      context
    })
  }

  // Record API call
  recordApiCall(success: boolean = true): void {
    this.metrics.apiCallCount++

    if (!success) {
      this.metrics.apiErrorCount++
    }

    // Check for API-related alerts
    this.checkApiAlerts()
  }

  // Get current metrics
  getMetrics(): ConversationIntelligenceMetrics {
    return { ...this.metrics }
  }

  // Get recent errors
  getRecentErrors(limit: number = 50): ConversationIntelligenceError[] {
    return this.errors
      .slice(-limit)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  // Get active alerts
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged)
  }

  // Acknowledge alert
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      logger.info('Performance alert acknowledged', { alertId })
      return true
    }
    return false
  }

  // Generate performance report
  generateReport(timeRange: 'hour' | 'day' | 'week' = 'day'): {
    metrics: ConversationIntelligenceMetrics
    errors: ConversationIntelligenceError[]
    alerts: PerformanceAlert[]
    recommendations: string[]
  } {
    const cutoffTime = this.getCutoffTime(timeRange)
    const recentErrors = this.errors.filter(error =>
      new Date(error.timestamp) > cutoffTime
    )

    const recentAlerts = this.alerts.filter(alert =>
      new Date(alert.timestamp) > cutoffTime
    )

    const recommendations = this.generateRecommendations()

    return {
      metrics: this.metrics,
      errors: recentErrors,
      alerts: recentAlerts,
      recommendations
    }
  }

  private updateAccuracyMetric(type: 'emotion' | 'intent', confidence: number): void {
    const currentAccuracy = type === 'emotion'
      ? this.metrics.emotionDetectionAccuracy
      : this.metrics.intentClassificationAccuracy

    // Update using exponential moving average
    const alpha = 0.1 // Smoothing factor
    const newAccuracy = (1 - alpha) * currentAccuracy + alpha * confidence

    if (type === 'emotion') {
      this.metrics.emotionDetectionAccuracy = newAccuracy
    } else {
      this.metrics.intentClassificationAccuracy = newAccuracy
    }
  }

  private categorizeError(error: Error): ConversationIntelligenceError['type'] {
    const message = error.message.toLowerCase()

    if (message.includes('emotion') || message.includes('sentiment')) {
      return 'emotion_detection'
    }

    if (message.includes('intent') || message.includes('classification')) {
      return 'intent_classification'
    }

    if (message.includes('api') || message.includes('network')) {
      return 'api_error'
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation_error'
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout'
    }

    return 'api_error' // Default category
  }

  private checkPerformanceAlerts(): void {
    const errorRate = this.metrics.failedAnalyses / Math.max(this.metrics.totalAnalyses, 1)
    const avgProcessingTime = this.metrics.averageProcessingTime

    // High error rate alert
    if (errorRate > 0.1 && this.metrics.totalAnalyses > 10) {
      this.createAlert(
        'high_error_rate',
        'high',
        `Error rate is ${(errorRate * 100).toFixed(1)}% (${this.metrics.failedAnalyses}/${this.metrics.totalAnalyses} failures)`,
        { errorRate, totalAnalyses: this.metrics.totalAnalyses, failedAnalyses: this.metrics.failedAnalyses }
      )
    }

    // High latency alert
    if (avgProcessingTime > 5000) { // 5 seconds
      this.createAlert(
        'high_latency',
        'medium',
        `Average processing time is ${avgProcessingTime.toFixed(0)}ms`,
        { averageProcessingTime: avgProcessingTime }
      )
    }

    // System overload alert
    if (this.processingTimes.length > 100 && avgProcessingTime > 3000) {
      this.createAlert(
        'system_overload',
        'high',
        'System may be overloaded - high processing times detected',
        { averageProcessingTime: avgProcessingTime, queueSize: this.processingTimes.length }
      )
    }
  }

  private checkApiAlerts(): void {
    const apiErrorRate = this.metrics.apiErrorCount / Math.max(this.metrics.apiCallCount, 1)

    if (apiErrorRate > 0.05 && this.metrics.apiCallCount > 20) { // 5% error rate
      this.createAlert(
        'api_limit',
        'critical',
        `API error rate is ${(apiErrorRate * 100).toFixed(1)}%`,
        { apiErrorRate, apiCallCount: this.metrics.apiCallCount, apiErrorCount: this.metrics.apiErrorCount }
      )
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    metrics: Record<string, number>
  ): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(alert =>
      alert.type === type &&
      !alert.acknowledged &&
      new Date(alert.timestamp).getTime() > Date.now() - 5 * 60 * 1000 // Within last 5 minutes
    )

    if (existingAlert) {
      return // Don't create duplicate alerts
    }

    const alert: PerformanceAlert = {
      id: this.generateId(),
      type,
      severity,
      message,
      metrics,
      timestamp: new Date().toISOString(),
      acknowledged: false
    }

    this.alerts.push(alert)

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift()
    }

    logger.warn('Performance alert created', {
      alertId: alert.id,
      type,
      severity,
      message
    })
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    const errorRate = this.metrics.failedAnalyses / Math.max(this.metrics.totalAnalyses, 1)
    const avgProcessingTime = this.metrics.averageProcessingTime

    if (errorRate > 0.1) {
      recommendations.push('High error rate detected. Consider reviewing recent changes and checking API connectivity.')
    }

    if (avgProcessingTime > 3000) {
      recommendations.push('Processing times are elevated. Consider optimizing API calls or reducing batch sizes.')
    }

    if (this.metrics.apiErrorCount > this.metrics.apiCallCount * 0.05) {
      recommendations.push('API error rate is high. Check API keys, rate limits, and network connectivity.')
    }

    if (Object.keys(this.metrics.tenantUsage).length > 50) {
      recommendations.push('High tenant activity detected. Monitor resource usage and consider scaling.')
    }

    return recommendations
  }

  private getCutoffTime(timeRange: 'hour' | 'day' | 'week'): Date {
    const now = new Date()
    switch (timeRange) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000)
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
  }

  private generateId(): string {
    return `ci_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Health check method
  async healthCheck(): Promise<{
    healthy: boolean
    metrics: ConversationIntelligenceMetrics
    alerts: PerformanceAlert[]
    status: string
  }> {
    const errorRate = this.metrics.failedAnalyses / Math.max(this.metrics.totalAnalyses, 1)
    const hasCriticalAlerts = this.alerts.some(alert => alert.severity === 'critical' && !alert.acknowledged)

    const healthy = !hasCriticalAlerts && errorRate < 0.2 && this.metrics.averageProcessingTime < 10000

    return {
      healthy,
      metrics: this.metrics,
      alerts: this.getActiveAlerts(),
      status: healthy ? 'healthy' : hasCriticalAlerts ? 'critical' : 'degraded'
    }
  }

  // Reset metrics (for testing or maintenance)
  resetMetrics(): void {
    this.metrics = {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      averageProcessingTime: 0,
      emotionDetectionAccuracy: 0,
      intentClassificationAccuracy: 0,
      apiCallCount: 0,
      apiErrorCount: 0,
      cacheHitRate: 0,
      tenantUsage: {}
    }

    this.processingTimes = []
    logger.info('Conversation intelligence metrics reset')
  }
}

// Export singleton instance
export const conversationIntelligenceMonitor = new ConversationIntelligenceMonitor()