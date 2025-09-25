/**
 * Comprehensive Lead Generation Service
 * Integrates all advanced lead generation features with MCP and AI systems
 */

import { createClient } from '@/lib/supabase/server'
import { EnhancedLeadScoringEngine } from '@/lib/mcp/enhanced-lead-scoring'
import { mcpLeadEnhancer } from '@/lib/mcp/lead-enhancer'
import { workflowEngine } from '@/lib/workflows/workflow-engine'
import { abTestEngine } from '@/lib/ab-testing/ab-test-engine'
import { predictiveScoringEngine } from '@/lib/predictive-scoring/predictive-scoring-engine'
import { engagementTracker } from '@/lib/engagement-tracking/engagement-tracker'
import { geminiClient } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'

export interface LeadGenerationConfig {
  autoScoring: boolean
  predictiveModeling: boolean
  workflowAutomation: boolean
  abTesting: boolean
  engagementTracking: boolean
  mcpIntegration: boolean
}

export interface LeadCreationRequest {
  email: string
  firstName?: string
  lastName?: string
  company?: string
  jobTitle?: string
  phone?: string
  sourceId?: string
  tags?: string[]
  customFields?: Record<string, any>
  campaignId?: string
  referrer?: string
}

export interface LeadProcessingResult {
  lead: any
  score: number
  quality: 'high' | 'medium' | 'low'
  insights: string[]
  recommendations: string[]
  predictions?: any
  triggeredWorkflows: string[]
  assignedTests: string[]
}

export class LeadGenerationService {
  private static instance: LeadGenerationService
  private config: LeadGenerationConfig

  constructor() {
    this.config = {
      autoScoring: true,
      predictiveModeling: true,
      workflowAutomation: true,
      abTesting: true,
      engagementTracking: true,
      mcpIntegration: true
    }
  }

  static getInstance(): LeadGenerationService {
    if (!LeadGenerationService.instance) {
      LeadGenerationService.instance = new LeadGenerationService()
    }
    return LeadGenerationService.instance
  }

  /**
   * Process a new lead through the complete lead generation pipeline
   */
  async processNewLead(request: LeadCreationRequest, userId: string): Promise<LeadProcessingResult> {
    try {
      const supabase = await createClient()

      // 1. Create the lead record
      const leadData = {
        email: request.email,
        firstName: request.firstName,
        lastName: request.lastName,
        company: request.company,
        jobTitle: request.jobTitle,
        phone: request.phone,
        sourceId: request.sourceId,
        tags: request.tags || [],
        customFields: request.customFields || {}
      }

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_id: userId,
          email: request.email,
          first_name: request.firstName,
          last_name: request.lastName,
          company: request.company,
          job_title: request.jobTitle,
          phone: request.phone,
          source_id: request.sourceId,
          tags: request.tags || [],
          custom_fields: request.customFields || {}
        })
        .select()
        .single()

      if (leadError) {
        throw new Error(`Failed to create lead: ${leadError.message}`)
      }

      let score = 0
      let quality: 'high' | 'medium' | 'low' = 'low'
      let insights: string[] = []
      let recommendations: string[] = []
      let predictions: any = null
      const triggeredWorkflows: string[] = []
      const assignedTests: string[] = []

      // 2. Enhanced scoring with MCP integration
      if (this.config.autoScoring) {
        const scoring = await EnhancedLeadScoringEngine.calculateLeadScore(leadData)

        score = scoring.score
        const qualityAnalysis = await EnhancedLeadScoringEngine.analyzeLeadQuality(leadData)
        quality = qualityAnalysis.quality
        insights = qualityAnalysis.insights
        recommendations = qualityAnalysis.recommendations

        // Update lead with score
        await supabase
          .from('leads')
          .update({
            lead_score: score,
            predictive_score: score
          })
          .eq('id', lead.id)
      }

      // 3. Predictive modeling
      if (this.config.predictiveModeling) {
        predictions = await predictiveScoringEngine.predictLeadConversion(lead.id, userId)
        if (predictions) {
          await supabase
            .from('leads')
            .update({
              conversion_probability: predictions.conversionProbability,
              estimated_value: predictions.estimatedValue
            })
            .eq('id', lead.id)
        }
      }

      // 4. Trigger workflows
      if (this.config.workflowAutomation) {
        const workflows = await this.triggerMatchingWorkflows(lead, userId)
        triggeredWorkflows.push(...workflows)
      }

      // 5. Assign to A/B tests
      if (this.config.abTesting) {
        const tests = await this.assignToActiveTests(lead.id, userId)
        assignedTests.push(...tests)
      }

      // 6. Track attribution
      if (request.campaignId || request.referrer) {
        await this.trackAttribution(lead.id, request, userId)
      }

      // 7. Log lead creation activity
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: lead.id,
          type: 'lead_created',
          description: 'Lead created via advanced lead generation pipeline',
          metadata: {
            source: 'api',
            score,
            quality,
            triggeredWorkflows,
            assignedTests,
            predictions
          }
        })

      // 8. Initial engagement tracking
      if (this.config.engagementTracking) {
        await engagementTracker.trackEvent({
          leadId: lead.id,
          channel: 'direct',
          type: 'view',
          metadata: {
            source: request.sourceId ? 'campaign' : 'direct',
            campaignId: request.campaignId,
            referrer: request.referrer
          },
          timestamp: new Date()
        })
      }

      return {
        lead: { ...lead, lead_score: score },
        score,
        quality,
        insights,
        recommendations,
        predictions,
        triggeredWorkflows,
        assignedTests
      }

    } catch (error: any) {
      logger.error('Error processing new lead:', error)
      throw error
    }
  }

  /**
   * Process lead engagement events
   */
  async processEngagementEvent(
    leadId: string,
    eventType: string,
    channel: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const supabase = await createClient()

      // Get lead's user ID
      const { data: lead } = await supabase
        .from('leads')
        .select('user_id')
        .eq('id', leadId)
        .single()

      if (!lead) {
        throw new Error('Lead not found')
      }

      // Track engagement
      await engagementTracker.trackEvent({
        leadId,
        channel: channel as any,
        type: eventType as any,
        metadata,
        timestamp: new Date()
      })

      // Update lead score based on engagement
      if (eventType === 'click' || eventType === 'open' || eventType === 'download') {
        const currentScore = await this.recalculateLeadScore(leadId, lead.user_id)
        if (currentScore !== null) {
          await supabase
            .from('leads')
            .update({ lead_score: currentScore })
            .eq('id', leadId)
        }
      }

      // Check for workflow triggers based on engagement
      if (this.config.workflowAutomation) {
        await this.checkEngagementTriggers(leadId, eventType, channel, lead.user_id)
      }

    } catch (error: any) {
      logger.error('Error processing engagement event:', error)
    }
  }

  /**
   * Generate comprehensive lead insights and recommendations
   */
  async generateLeadInsights(leadId: string, userId: string): Promise<any> {
    try {
      const supabase = await createClient()

      // Get lead data with full context
      const { data: lead } = await supabase
        .from('leads')
        .select(`
          *,
          lead_sources(name, type),
          lead_activities(*),
          lead_engagement(*),
          workflow_executions(
            *,
            lead_workflows(name)
          ),
          ab_test_results(
            *,
            ab_tests(name, test_type)
          )
        `)
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      if (!lead) {
        throw new Error('Lead not found')
      }

      // Generate AI-powered insights
      const insights = await this.generateAIInsights(lead)

      // Calculate engagement metrics
      const engagementScore = await engagementTracker.calculateEngagementScore(leadId)

      // Get predictive analytics
      const predictions = await predictiveScoringEngine.predictLeadConversion(leadId, userId)

      return {
        lead,
        insights,
        engagement: engagementScore,
        predictions,
        recommendations: await this.generateRecommendations(lead, insights, engagementScore)
      }

    } catch (error: any) {
      logger.error('Error generating lead insights:', error)
      throw error
    }
  }

  /**
   * Run automated optimization processes
   */
  async runOptimizationCycle(userId: string): Promise<void> {
    try {
      // Complete A/B tests that have reached significance
      await abTestEngine.processCompletedTests()

      // Retrain predictive models with new data
      await this.retrainPredictiveModels(userId)

      // Optimize workflow performance
      await this.optimizeWorkflows(userId)

      // Update lead segments
      await this.refreshDynamicSegments(userId)

      logger.info('Lead generation optimization cycle completed')

    } catch (error: any) {
      logger.error('Error running optimization cycle:', error)
    }
  }

  // Private helper methods

  private async triggerMatchingWorkflows(lead: any, userId: string): Promise<string[]> {
    try {
      const supabase = await createClient()
      const triggered: string[] = []

      const { data: workflows } = await supabase
        .from('lead_workflows')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('trigger_type', 'lead_created')

      for (const workflow of workflows || []) {
        const conditions = workflow.trigger_conditions

        // Check trigger conditions
        let shouldTrigger = true

        if (conditions.minScore && lead.lead_score < conditions.minScore) {
          shouldTrigger = false
        }

        if (conditions.sourceId && lead.source_id !== conditions.sourceId) {
          shouldTrigger = false
        }

        if (shouldTrigger) {
          await workflowEngine.startWorkflow(workflow.id, lead.id, userId)
          triggered.push(workflow.name)
        }
      }

      return triggered

    } catch (error: any) {
      logger.error('Error triggering workflows:', error)
      return []
    }
  }

  private async assignToActiveTests(leadId: string, userId: string): Promise<string[]> {
    try {
      const activeTests = await abTestEngine.getActiveTests(userId)
      const assigned: string[] = []

      for (const test of activeTests) {
        const variant = await abTestEngine.assignVariant(test.id, leadId, userId)
        if (variant) {
          assigned.push(test.name)
        }
      }

      return assigned

    } catch (error: any) {
      logger.error('Error assigning to tests:', error)
      return []
    }
  }

  private async trackAttribution(leadId: string, request: LeadCreationRequest, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('attribution_touchpoints')
        .insert({
          lead_id: leadId,
          source_id: request.sourceId,
          touchpoint_type: 'lead_creation',
          channel: 'campaign',
          campaign_id: request.campaignId,
          referrer_url: request.referrer,
          metadata: {
            campaignId: request.campaignId,
            referrer: request.referrer
          }
        })

    } catch (error: any) {
      logger.error('Error tracking attribution:', error)
    }
  }

  private async recalculateLeadScore(leadId: string, userId: string): Promise<number | null> {
    try {
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single()

      if (!lead) return null

      const leadData = {
        email: lead.email,
        firstName: lead.first_name,
        lastName: lead.last_name,
        company: lead.company,
        jobTitle: lead.job_title
      }

      const scoring = await EnhancedLeadScoringEngine.calculateLeadScore(leadData)
      return scoring.score

    } catch (error: any) {
      logger.error('Error recalculating lead score:', error)
      return null
    }
  }

  private async checkEngagementTriggers(leadId: string, eventType: string, channel: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: workflows } = await supabase
        .from('lead_workflows')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('trigger_type', 'behavior')

      for (const workflow of workflows || []) {
        const conditions = workflow.trigger_conditions

        if (conditions.eventType === eventType && conditions.channel === channel) {
          await workflowEngine.startWorkflow(workflow.id, leadId, userId)
        }
      }

    } catch (error: any) {
      logger.error('Error checking engagement triggers:', error)
    }
  }

  private async generateAIInsights(lead: any): Promise<any> {
    try {
      const prompt = `Analyze this lead data and provide strategic insights:

Lead Profile:
- Email: ${lead.email}
- Name: ${lead.first_name} ${lead.last_name}
- Company: ${lead.company}
- Job Title: ${lead.job_title}
- Lead Score: ${lead.lead_score}
- Status: ${lead.status}
- Activities: ${lead.lead_activities?.length || 0} interactions
- Engagement Score: ${lead.engagement_score}

Provide insights on:
1. Lead quality assessment
2. Buying stage indicators
3. Recommended next actions
4. Potential objections or concerns
5. Communication strategy suggestions

Respond in JSON format.`

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      })

      return JSON.parse(response.choices[0]?.message?.content || '{}')

    } catch (error: any) {
      logger.error('Error generating AI insights:', error)
      return {}
    }
  }

  private async generateRecommendations(lead: any, insights: any, engagement: any): Promise<string[]> {
    const recommendations: string[] = []

    // Score-based recommendations
    if (lead.lead_score >= 80) {
      recommendations.push('🔥 High-priority lead - schedule immediate follow-up call')
      recommendations.push('📧 Send personalized proposal or demo invitation')
    } else if (lead.lead_score >= 60) {
      recommendations.push('📧 Add to nurture sequence with educational content')
      recommendations.push('📊 Monitor engagement for score improvement')
    } else {
      recommendations.push('📚 Send basic educational content')
      recommendations.push('⏰ Long-term nurture approach')
    }

    // Engagement-based recommendations
    if (engagement.overall < 30) {
      recommendations.push('⚡ Low engagement - consider re-engagement campaign')
    } else if (engagement.frequency < 40) {
      recommendations.push('📈 Increase touch frequency to boost engagement')
    }

    // Status-based recommendations
    if (lead.status === 'new') {
      recommendations.push('👋 Send welcome email within 5 minutes')
    } else if (lead.status === 'contacted') {
      recommendations.push('📞 Follow up with phone call or additional content')
    }

    return recommendations
  }

  private async retrainPredictiveModels(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Check if models need retraining (e.g., new data available)
      const { data: recentLeads } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      if (recentLeads && recentLeads.length > 10) {
        // Trigger model retraining for active models
        const { data: models } = await supabase
          .from('predictive_models')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)

        for (const model of models || []) {
          // Simplified - in production, this would queue a background job
          logger.info(`Retraining model ${model.name} for user ${userId}`)
        }
      }

    } catch (error: any) {
      logger.error('Error retraining models:', error)
    }
  }

  private async optimizeWorkflows(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Analyze workflow performance and suggest optimizations
      const { data: workflows } = await supabase
        .from('lead_workflows')
        .select(`
          *,
          workflow_executions(status, completed_at)
        `)
        .eq('user_id', userId)

      for (const workflow of workflows || []) {
        const executions = workflow.workflow_executions || []
        const completionRate = executions.length > 0
          ? executions.filter((e: any) => e.status === 'completed').length / executions.length
          : 0

        if (completionRate < 0.5) {
          logger.warn(`Workflow ${workflow.name} has low completion rate: ${(completionRate * 100).toFixed(1)}%`)
        }
      }

    } catch (error: any) {
      logger.error('Error optimizing workflows:', error)
    }
  }

  private async refreshDynamicSegments(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: segments } = await supabase
        .from('lead_segments')
        .select('*')
        .eq('user_id', userId)
        .eq('segment_type', 'dynamic')

      for (const segment of segments || []) {
        // Simplified - in production, this would be done in batches
        logger.info(`Refreshing dynamic segment ${segment.name}`)
      }

    } catch (error: any) {
      logger.error('Error refreshing segments:', error)
    }
  }
}

export const leadGenerationService = LeadGenerationService.getInstance()