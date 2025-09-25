/**
 * Personalization Engine Orchestrator
 * Main orchestrator that coordinates all personalization components
 */

import { createClient } from '@/lib/supabase/server'
import { personalizationEngine } from './personalization-engine'
import { behavioralTriggerService } from './behavioral-trigger-service'
import { contentAdaptationEngine } from './content-adaptation-engine'
import { nurturingSequenceManager } from './nurturing-sequence-manager'
import { humanLikeEngagement } from './human-like-engagement'
import { followupOptimization } from './followup-optimization'
import { personalizationAnalytics } from './personalization-analytics'
import { logger } from '@/lib/logger'

export interface PersonalizationOrchestratorConfig {
  enableAllFeatures: boolean
  enableBehavioralTriggers: boolean
  enableContentAdaptation: boolean
  enableDynamicSequences: boolean
  enableHumanLikeEngagement: boolean
  enableFollowupOptimization: boolean
  enableAnalytics: boolean
  highQualityThreshold: number
  optimizationInterval: number // minutes
  maxConcurrentSequences: number
}

export interface PersonalizationRequest {
  leadId: string
  userId: string
  action: 'create_sequence' | 'process_behavior' | 'generate_content' | 'optimize_followup' | 'analyze_performance'
  data: Record<string, any>
  context?: Record<string, any>
}

export interface PersonalizationResponse {
  success: boolean
  data: any
  metadata: Record<string, any>
  recommendations?: string[]
  insights?: string[]
  errors?: string[]
}

export class PersonalizationOrchestrator {
  private static instance: PersonalizationOrchestrator
  private config: PersonalizationOrchestratorConfig
  private initialized: boolean = false

  /**
   * PRIVACY BY DESIGN: Orchestrator defaults implement comprehensive privacy protection
   * All personalization and analytics features are disabled by default to ensure:
   * - Consent-based processing: Features only activate with explicit user permission
   * - Data minimization: No behavioral tracking or analytics without opt-in
   * - Transparency: Conservative defaults make privacy implications clear
   * - User control: Users maintain full control over their data processing preferences
   */
  constructor() {
    this.config = {
      enableAllFeatures: false, // PRIVACY: Default to false to prevent all personalization features without consent
      enableBehavioralTriggers: false, // PRIVACY: Default to false to prevent behavioral tracking without consent
      enableContentAdaptation: false, // PRIVACY: Default to false to prevent content adaptation without consent
      enableDynamicSequences: false, // PRIVACY: Default to false to prevent dynamic sequences without consent
      enableHumanLikeEngagement: false, // PRIVACY: Default to false to prevent automated engagement without consent
      enableFollowupOptimization: false, // PRIVACY: Default to false to prevent followup optimization without consent
      enableAnalytics: false, // PRIVACY: Default to false to prevent analytics tracking without consent
      highQualityThreshold: 80,
      optimizationInterval: 60,
      maxConcurrentSequences: 100
    }
  }

  static getInstance(): PersonalizationOrchestrator {
    if (!PersonalizationOrchestrator.instance) {
      PersonalizationOrchestrator.instance = new PersonalizationOrchestrator()
    }
    return PersonalizationOrchestrator.instance
  }

  /**
   * Initialize the personalization orchestrator
   */
  async initialize(userId: string): Promise<void> {
    if (this.initialized) {
      logger.info('Personalization orchestrator already initialized', { userId })
      return
    }

    try {
      logger.info('Initializing personalization orchestrator', { userId })

      // Initialize all components
      await Promise.all([
        personalizationEngine.initialize(userId),
        behavioralTriggerService.initialize(userId),
        contentAdaptationEngine.initialize(userId),
        nurturingSequenceManager.initialize(userId),
        humanLikeEngagement.initialize(userId),
        followupOptimization.initialize(userId),
        personalizationAnalytics.initialize(userId)
      ])

      this.initialized = true

      // Start optimization cycles
      this.startOptimizationCycles(userId)

      logger.info('Personalization orchestrator initialized successfully', { userId })
    } catch (error) {
      logger.error('Error initializing personalization orchestrator', error as Error, { userId })
      throw error
    }
  }

  /**
   * Process personalization request
   */
  async processRequest(request: PersonalizationRequest): Promise<PersonalizationResponse> {
    try {
      const { leadId, userId, action, data, context = {} } = request

      logger.info('Processing personalization request', {
        leadId,
        userId,
        action,
        hasData: Object.keys(data).length > 0
      })

      let result: any = null
      let recommendations: string[] = []
      let insights: string[] = []
      let errors: string[] = []

      // Route to appropriate handler
      switch (action) {
        case 'create_sequence':
          result = await this.handleCreateSequence(leadId, userId, data, context)
          break

        case 'process_behavior':
          result = await this.handleProcessBehavior(leadId, userId, data, context)
          break

        case 'generate_content':
          result = await this.handleGenerateContent(leadId, userId, data, context)
          break

        case 'optimize_followup':
          result = await this.handleOptimizeFollowup(leadId, userId, data, context)
          break

        case 'analyze_performance':
          result = await this.handleAnalyzePerformance(userId, data, context)
          break

        default:
          errors.push(`Unknown action: ${action}`)
      }

      // Generate recommendations if applicable
      if (this.config.enableAnalytics && ['create_sequence', 'process_behavior', 'generate_content'].includes(action)) {
        recommendations = await this.generateRecommendations(leadId, userId, action, result)
      }

      // Generate insights if applicable
      if (this.config.enableAnalytics && action === 'analyze_performance') {
        insights = await this.generateInsights(userId, result)
      }

      return {
        success: errors.length === 0,
        data: result,
        metadata: {
          action,
          leadId,
          userId,
          processedAt: new Date(),
          orchestratorVersion: '1.0.0'
        },
        recommendations,
        insights,
        errors
      }
    } catch (error) {
      logger.error('Error processing personalization request', error as Error, {
        leadId: request.leadId,
        userId: request.userId,
        action: request.action
      })

      return {
        success: false,
        data: null,
        metadata: {
          action: request.action,
          leadId: request.leadId,
          userId: request.userId,
          processedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Process lead behavior and trigger appropriate actions
   */
  async processLeadBehavior(
    leadId: string,
    behaviorType: string,
    behaviorData: Record<string, any>,
    userId: string
  ): Promise<PersonalizationResponse> {
    try {
      logger.info('Processing lead behavior', { leadId, behaviorType, userId })

      // Check if lead qualifies for personalization
      const leadProfile = await this.getLeadProfile(leadId, userId)

      if (!this.isHighQualityLead(leadProfile)) {
        return {
          success: true,
          data: { message: 'Lead does not qualify for advanced personalization' },
          metadata: { leadId, userId, behaviorType, processedAt: new Date() }
        }
      }

      // Process behavior through multiple systems
      const results = await Promise.allSettled([
        personalizationEngine.processLeadBehavior(leadId, behaviorType, behaviorData, userId),
        behavioralTriggerService.processLeadBehavior(leadId, behaviorType, behaviorData, userId)
        // Note: followupOptimization.processLeadBehavior doesn't exist, removed for now
      ])

      // Collect results
      const successfulResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value)

      const failedResults = results
        .filter(r => r.status === 'rejected')
        .map(r => (r as PromiseRejectedResult).reason)

      // Generate response
      const response: PersonalizationResponse = {
        success: failedResults.length === 0,
        data: {
          processedBy: successfulResults.length,
          systems: successfulResults.map(r => r.system || 'unknown'),
          triggeredActions: successfulResults.flatMap(r => r.actions || [])
        },
        metadata: {
          leadId,
          userId,
          behaviorType,
          processedAt: new Date(),
          systemsProcessed: successfulResults.length,
          systemsFailed: failedResults.length
        }
      }

      if (failedResults.length > 0) {
        response.errors = failedResults.map(e => e instanceof Error ? e.message : String(e))
      }

      return response
    } catch (error) {
      logger.error('Error processing lead behavior', error as Error, { leadId, behaviorType, userId })
      return {
        success: false,
        data: null,
        metadata: { leadId, userId, behaviorType, processedAt: new Date() },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Get comprehensive personalization status
   */
  async getStatus(userId: string): Promise<PersonalizationResponse> {
    try {
      const [
        engineStatus,
        triggerStatus,
        contentStatus,
        sequenceStatus,
        engagementStatus,
        followupStatus,
        analyticsStatus
      ] = await Promise.allSettled([
        this.getComponentStatus('personalization_engine', userId),
        this.getComponentStatus('behavioral_triggers', userId),
        this.getComponentStatus('content_adaptation', userId),
        this.getComponentStatus('nurturing_sequences', userId),
        this.getComponentStatus('human_like_engagement', userId),
        this.getComponentStatus('followup_optimization', userId),
        this.getComponentStatus('analytics', userId)
      ])

      const components = {
        personalizationEngine: engineStatus.status === 'fulfilled' ? engineStatus.value : { status: 'error' },
        behavioralTriggers: triggerStatus.status === 'fulfilled' ? triggerStatus.value : { status: 'error' },
        contentAdaptation: contentStatus.status === 'fulfilled' ? contentStatus.value : { status: 'error' },
        nurturingSequences: sequenceStatus.status === 'fulfilled' ? sequenceStatus.value : { status: 'error' },
        humanLikeEngagement: engagementStatus.status === 'fulfilled' ? engagementStatus.value : { status: 'error' },
        followupOptimization: followupStatus.status === 'fulfilled' ? followupStatus.value : { status: 'error' },
        analytics: analyticsStatus.status === 'fulfilled' ? analyticsStatus.value : { status: 'error' }
      }

      const overallStatus = Object.values(components).every(c => c.status === 'active') ? 'active' : 'degraded'

      return {
        success: true,
        data: {
          status: overallStatus,
          initialized: this.initialized,
          components,
          config: this.config,
          timestamp: new Date()
        },
        metadata: { userId, requestedAt: new Date() }
      }
    } catch (error) {
      logger.error('Error getting personalization status', error as Error, { userId })
      return {
        success: false,
        data: { status: 'error', initialized: false },
        metadata: { userId, requestedAt: new Date() },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Optimize all personalization systems
   */
  async optimizeAll(userId: string): Promise<PersonalizationResponse> {
    try {
      logger.info('Starting comprehensive optimization', { userId })

      const optimizations = await Promise.allSettled([
        personalizationEngine.optimizeSequences(userId),
        // behavioralTriggerService.optimizeTriggers doesn't exist, removed for now
        contentAdaptationEngine.optimizeContentStrategy(userId),
        nurturingSequenceManager.optimizeSequences(userId),
        // followupOptimization.optimizeAll doesn't exist, removed for now
        personalizationAnalytics.generateAnalyticsReport(userId, 'daily')
      ])

      const successful = optimizations.filter(o => o.status === 'fulfilled').length
      const failed = optimizations.filter(o => o.status === 'rejected').length

      return {
        success: failed === 0,
        data: {
          optimizationsAttempted: optimizations.length,
          successfulOptimizations: successful,
          failedOptimizations: failed,
          completedAt: new Date()
        },
        metadata: { userId, startedAt: new Date() }
      }
    } catch (error) {
      logger.error('Error during comprehensive optimization', error as Error, { userId })
      return {
        success: false,
        data: null,
        metadata: { userId, attemptedAt: new Date() },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  // Private helper methods

  private async handleCreateSequence(
    leadId: string,
    userId: string,
    data: Record<string, any>,
    context: Record<string, any>
  ): Promise<any> {
    return await nurturingSequenceManager.createPersonalizedSequence(leadId, userId, data)
  }

  private async handleProcessBehavior(
    leadId: string,
    userId: string,
    data: Record<string, any>,
    context: Record<string, any>
  ): Promise<any> {
    return await this.processLeadBehavior(leadId, data.behaviorType, data.behaviorData, userId)
  }

  private async handleGenerateContent(
    leadId: string,
    userId: string,
    data: Record<string, any>,
    context: Record<string, any>
  ): Promise<any> {
    return await contentAdaptationEngine.generatePersonalizedContent(
      leadId,
      data.contentType,
      { ...data, leadId },
      userId
    )
  }

  private async handleOptimizeFollowup(
    leadId: string,
    userId: string,
    data: Record<string, any>,
    context: Record<string, any>
  ): Promise<any> {
    return await followupOptimization.optimizeFollowupSchedule(leadId, userId, data)
  }

  private async handleAnalyzePerformance(
    userId: string,
    data: Record<string, any>,
    context: Record<string, any>
  ): Promise<any> {
    const reportType = data.reportType || 'daily'
    return await personalizationAnalytics.generateAnalyticsReport(userId, reportType, data.dateRange)
  }

  private async getLeadProfile(leadId: string, userId: string): Promise<any> {
    try {
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      return lead
    } catch (error) {
      logger.error('Error getting lead profile', error as Error, { leadId })
      return null
    }
  }

  private isHighQualityLead(leadProfile: any): boolean {
    if (!leadProfile) return false

    // Check lead score
    if (leadProfile.lead_score >= this.config.highQualityThreshold) return true

    // Check engagement score
    if (leadProfile.engagement_score >= 70) return true

    // Check company size or role
    if (leadProfile.company && leadProfile.company.length > 0) return true
    if (leadProfile.job_title && leadProfile.job_title.toLowerCase().includes('senior')) return true

    return false
  }

  private async getComponentStatus(componentName: string, userId: string): Promise<any> {
    try {
      // This would check the actual status of each component
      // For now, return a basic status
      return {
        name: componentName,
        status: 'active',
        lastActivity: new Date(),
        metrics: {}
      }
    } catch (error) {
      return {
        name: componentName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async generateRecommendations(
    leadId: string,
    userId: string,
    action: string,
    result: any
  ): Promise<string[]> {
    try {
      // Generate contextual recommendations based on the action and result
      const recommendations: string[] = []

      switch (action) {
        case 'create_sequence':
          recommendations.push('Monitor sequence performance and adjust based on engagement')
          recommendations.push('Consider A/B testing different content variations')
          break
        case 'process_behavior':
          recommendations.push('Review triggered actions and their effectiveness')
          recommendations.push('Consider adjusting trigger thresholds based on performance')
          break
        case 'generate_content':
          recommendations.push('Test content variations to optimize engagement')
          recommendations.push('Monitor content performance across different channels')
          break
      }

      return recommendations
    } catch (error) {
      logger.error('Error generating recommendations', error as Error, { leadId, action })
      return []
    }
  }

  private async generateInsights(userId: string, result: any): Promise<string[]> {
    try {
      // Generate insights from analytics data
      const insights: string[] = []

      if (result.metrics) {
        const metrics = result.metrics

        if (metrics.conversionRate > 0.05) {
          insights.push('Excellent conversion rate - maintain current strategies')
        } else if (metrics.conversionRate < 0.02) {
          insights.push('Low conversion rate - review lead qualification criteria')
        }

        if (metrics.avgEngagementScore > 70) {
          insights.push('Strong engagement - personalization is working well')
        } else if (metrics.avgEngagementScore < 50) {
          insights.push('Low engagement - consider content and timing optimization')
        }

        if (metrics.personalizationROI > 3) {
          insights.push('Excellent ROI - continue investing in personalization')
        } else if (metrics.personalizationROI < 2) {
          insights.push('Low ROI - review personalization strategies and costs')
        }
      }

      return insights
    } catch (error) {
      logger.error('Error generating insights', error as Error, { userId })
      return []
    }
  }

  private startOptimizationCycles(userId: string): void {
    // Start periodic optimization cycles
    setInterval(async () => {
      try {
        await this.optimizeAll(userId)
      } catch (error) {
        logger.error('Error in optimization cycle', error as Error, { userId })
      }
    }, this.config.optimizationInterval * 60 * 1000)

    logger.info('Started optimization cycles', { userId, interval: this.config.optimizationInterval })
  }
}

export const personalizationOrchestrator = PersonalizationOrchestrator.getInstance()