/**
 * Automated Follow-up Optimization
 * Optimizes timing, frequency, and content of automated follow-ups based on lead behavior
 */

import { createClient } from '@/lib/supabase/server'
import { geminiClient } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'

export interface FollowupOptimizationConfig {
  enableSmartTiming: boolean
  enableFrequencyOptimization: boolean
  enableContentOptimization: boolean
  enableChannelOptimization: boolean
  enablePredictiveScheduling: boolean
  defaultFollowupIntervals: number[] // days
  maxFollowupsPerDay: number
  optimalResponseWindows: TimeWindow[]
  leadScoreThresholds: Record<string, number>
}

export interface TimeWindow {
  dayOfWeek: number // 0-6, Sunday = 0
  startHour: number // 0-23
  endHour: number // 0-23
  timezone: string
  effectiveness: number // 0-1
}

export interface LeadEngagementPattern {
  leadId: string
  userId: string
  optimalTimes: TimeWindow[]
  preferredChannels: ChannelPreference[]
  responsePatterns: ResponsePattern[]
  engagementScore: number
  lastActivity: Date
  nextOptimalContact: Date
  recommendedFrequency: number // days between contacts
}

export interface ChannelPreference {
  channel: 'email' | 'sms' | 'whatsapp' | 'chat' | 'phone'
  preference: number // 0-1
  effectiveness: number // 0-1
  lastUsed: Date
  avgResponseTime: number // minutes
}

export interface ResponsePattern {
  patternType: 'immediate' | 'delayed' | 'batch' | 'sporadic'
  avgResponseTime: number // minutes
  responseProbability: number // 0-1
  peakHours: number[]
  preferredDays: number[]
}

export interface FollowupSequence {
  leadId: string
  userId: string
  scheduledFollowups: ScheduledFollowup[]
  completedFollowups: CompletedFollowup[]
  paused: boolean
  optimizationHistory: OptimizationEvent[]
  nextOptimization: Date
}

export interface ScheduledFollowup {
  id: string
  type: 'email' | 'sms' | 'whatsapp' | 'chat' | 'phone'
  content: string
  scheduledTime: Date
  priority: 'low' | 'medium' | 'high' | 'urgent'
  expectedResponseTime: number // minutes
  optimizationScore: number // 0-1
  metadata: Record<string, any>
}

export interface CompletedFollowup {
  id: string
  type: string
  content: string
  sentTime: Date
  responseTime?: Date
  responseReceived: boolean
  engagementScore: number
  effectiveness: number
  metadata: Record<string, any>
}

export interface OptimizationEvent {
  id: string
  timestamp: Date
  eventType: 'timing_optimized' | 'frequency_adjusted' | 'channel_switched' | 'content_improved'
  leadId: string
  previousValue: any
  newValue: any
  expectedImprovement: number
  reasoning: string
}

export interface OptimizationRecommendation {
  leadId: string
  userId: string
  recommendations: {
    timing?: TimeOptimization
    frequency?: FrequencyOptimization
    channel?: ChannelOptimization
    content?: ContentOptimization
  }
  confidence: number
  expectedImpact: number
  reasoning: string
}

export interface TimeOptimization {
  optimalTime: Date
  alternativeTimes: Date[]
  reasoning: string
  confidence: number
}

export interface FrequencyOptimization {
  currentFrequency: number
  recommendedFrequency: number
  reasoning: string
  confidence: number
}

export interface ChannelOptimization {
  currentChannel: string
  recommendedChannel: string
  alternativeChannels: string[]
  reasoning: string
  confidence: number
}

export interface ContentOptimization {
  currentContent: string
  recommendedContent: string
  improvements: string[]
  reasoning: string
  confidence: number
}

export class FollowupOptimization {
  private static instance: FollowupOptimization
  private config: FollowupOptimizationConfig
  private engagementPatterns: Map<string, LeadEngagementPattern> = new Map()
  private activeSequences: Map<string, FollowupSequence> = new Map()

  constructor() {
    this.config = {
      enableSmartTiming: true,
      enableFrequencyOptimization: true,
      enableContentOptimization: true,
      enableChannelOptimization: true,
      enablePredictiveScheduling: true,
      defaultFollowupIntervals: [1, 3, 7, 14, 30],
      maxFollowupsPerDay: 3,
      optimalResponseWindows: this.getDefaultResponseWindows(),
      leadScoreThresholds: {
        high: 80,
        medium: 60,
        low: 40
      }
    }
  }

  static getInstance(): FollowupOptimization {
    if (!FollowupOptimization.instance) {
      FollowupOptimization.instance = new FollowupOptimization()
    }
    return FollowupOptimization.instance
  }

  /**
   * Initialize followup optimization for a user
   */
  async initialize(userId: string): Promise<void> {
    try {
      logger.info('Initializing followup optimization', { userId })

      // Load engagement patterns
      await this.loadEngagementPatterns(userId)

      // Load active sequences
      await this.loadActiveSequences(userId)

      logger.info('Followup optimization initialized', { userId })
    } catch (error) {
      logger.error('Error initializing followup optimization', error as Error, { userId })
      throw error
    }
  }

  /**
   * Optimize followup schedule for a lead
   */
  async optimizeFollowupSchedule(
    leadId: string,
    userId: string,
    context: Record<string, any> = {}
  ): Promise<OptimizationRecommendation> {
    try {
      // Get lead engagement pattern
      const engagementPattern = await this.getLeadEngagementPattern(leadId, userId)

      // Analyze current followup performance
      const currentPerformance = await this.analyzeCurrentPerformance(leadId, userId)

      // Generate optimization recommendations
      const recommendations = await this.generateOptimizationRecommendations(
        leadId,
        engagementPattern,
        currentPerformance,
        context,
        userId
      )

      // Apply optimizations if confidence is high enough
      if (recommendations.confidence > 0.7) {
        await this.applyOptimizations(leadId, recommendations, userId)
      }

      logger.info('Generated followup optimization recommendations', {
        leadId,
        confidence: recommendations.confidence,
        hasTiming: !!recommendations.recommendations.timing,
        hasFrequency: !!recommendations.recommendations.frequency,
        hasChannel: !!recommendations.recommendations.channel,
        hasContent: !!recommendations.recommendations.content
      })

      return recommendations
    } catch (error) {
      logger.error('Error optimizing followup schedule', error as Error, { leadId, userId })
      return this.generateDefaultRecommendation(leadId, userId)
    }
  }

  /**
   * Schedule optimal followup for a lead
   */
  async scheduleOptimalFollowup(
    leadId: string,
    followupType: 'email' | 'sms' | 'whatsapp' | 'chat' | 'phone',
    content: string,
    userId: string,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'urgent'
      maxDelay?: number // hours
      forceNow?: boolean
    } = {}
  ): Promise<ScheduledFollowup> {
    try {
      // Get lead engagement pattern
      const engagementPattern = await this.getLeadEngagementPattern(leadId, userId)

      // Calculate optimal timing
      const optimalTime = await this.calculateOptimalTiming(
        leadId,
        followupType,
        engagementPattern,
        options,
        userId
      )

      // Create scheduled followup
      const scheduledFollowup: ScheduledFollowup = {
        id: crypto.randomUUID(),
        type: followupType,
        content,
        scheduledTime: optimalTime,
        priority: options.priority || 'medium',
        expectedResponseTime: engagementPattern.responsePatterns[0]?.avgResponseTime || 60,
        optimizationScore: 0.8, // Would be calculated based on optimization confidence
        metadata: {
          leadId,
          userId,
          scheduledBy: 'optimization_engine',
          optimizationFactors: ['timing', 'channel_preference']
        }
      }

      // Store scheduled followup
      await this.storeScheduledFollowup(scheduledFollowup, userId)

      logger.info('Scheduled optimal followup', {
        leadId,
        followupId: scheduledFollowup.id,
        type: followupType,
        scheduledTime: optimalTime,
        priority: scheduledFollowup.priority
      })

      return scheduledFollowup
    } catch (error) {
      logger.error('Error scheduling optimal followup', error as Error, { leadId, followupType })
      throw error
    }
  }

  /**
   * Process followup response and update patterns
   */
  async processFollowupResponse(
    leadId: string,
    followupId: string,
    responseTime: Date,
    engagementScore: number,
    userId: string
  ): Promise<void> {
    try {
      // Get engagement pattern
      const engagementPattern = await this.getLeadEngagementPattern(leadId, userId)

      // Update response patterns
      await this.updateResponsePatterns(engagementPattern, followupId, responseTime, engagementScore)

      // Recalculate optimal timing
      await this.recalculateOptimalTiming(engagementPattern, userId)

      // Update engagement pattern
      await this.updateEngagementPattern(engagementPattern, userId)

      logger.info('Processed followup response', {
        leadId,
        followupId,
        responseTime: responseTime.toISOString(),
        engagementScore
      })
    } catch (error) {
      logger.error('Error processing followup response', error as Error, { leadId, followupId })
    }
  }

  /**
   * Optimize followup frequency based on engagement
   */
  async optimizeFollowupFrequency(
    leadId: string,
    currentFrequency: number,
    userId: string
  ): Promise<FrequencyOptimization> {
    try {
      const engagementPattern = await this.getLeadEngagementPattern(leadId, userId)
      const performance = await this.analyzeCurrentPerformance(leadId, userId)

      // Analyze optimal frequency
      const analysis = await this.analyzeOptimalFrequency(
        engagementPattern,
        performance,
        currentFrequency
      )

      return {
        currentFrequency,
        recommendedFrequency: analysis.optimalFrequency,
        reasoning: analysis.reasoning,
        confidence: analysis.confidence
      }
    } catch (error) {
      logger.error('Error optimizing followup frequency', error as Error, { leadId })
      return {
        currentFrequency,
        recommendedFrequency: currentFrequency,
        reasoning: 'Unable to optimize frequency due to insufficient data',
        confidence: 0.5
      }
    }
  }

  /**
   * Get optimal channel for followup
   */
  async getOptimalChannel(
    leadId: string,
    userId: string,
    context: Record<string, any> = {}
  ): Promise<ChannelOptimization> {
    try {
      const engagementPattern = await this.getLeadEngagementPattern(leadId, userId)

      // Analyze channel performance
      const channelAnalysis = await this.analyzeChannelPerformance(engagementPattern, context)

      return {
        currentChannel: engagementPattern.preferredChannels[0]?.channel || 'email',
        recommendedChannel: channelAnalysis.optimalChannel,
        alternativeChannels: channelAnalysis.alternativeChannels,
        reasoning: channelAnalysis.reasoning,
        confidence: channelAnalysis.confidence
      }
    } catch (error) {
      logger.error('Error getting optimal channel', error as Error, { leadId })
      return {
        currentChannel: 'email',
        recommendedChannel: 'email',
        alternativeChannels: ['email', 'sms'],
        reasoning: 'Default channel selection',
        confidence: 0.5
      }
    }
  }

  // Private helper methods

  private async loadEngagementPatterns(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: patterns } = await supabase
        .from('lead_engagement_patterns')
        .select('*')
        .eq('user_id', userId)

      for (const pattern of patterns || []) {
        this.engagementPatterns.set(pattern.lead_id, pattern as LeadEngagementPattern)
      }

      logger.info('Loaded engagement patterns', { count: patterns?.length || 0, userId })
    } catch (error) {
      logger.error('Error loading engagement patterns', error as Error, { userId })
    }
  }

  private async loadActiveSequences(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: sequences } = await supabase
        .from('followup_sequences')
        .select('*')
        .eq('user_id', userId)
        .eq('paused', false)

      for (const sequence of sequences || []) {
        this.activeSequences.set(sequence.lead_id, sequence as FollowupSequence)
      }

      logger.info('Loaded active sequences', { count: sequences?.length || 0, userId })
    } catch (error) {
      logger.error('Error loading active sequences', error as Error, { userId })
    }
  }

  private async getLeadEngagementPattern(leadId: string, userId: string): Promise<LeadEngagementPattern> {
    try {
      // Get from cache
      let pattern = this.engagementPatterns.get(leadId)

      if (!pattern) {
        // Load from database
        const supabase = await createClient()

        const { data: patternData } = await supabase
          .from('lead_engagement_patterns')
          .select('*')
          .eq('lead_id', leadId)
          .eq('user_id', userId)
          .single()

        if (patternData) {
          pattern = patternData as LeadEngagementPattern
          this.engagementPatterns.set(leadId, pattern)
        } else {
          // Create new pattern
          pattern = await this.createNewEngagementPattern(leadId, userId)
          this.engagementPatterns.set(leadId, pattern)
        }
      }

      return pattern
    } catch (error) {
      logger.error('Error getting lead engagement pattern', error as Error, { leadId })
      return this.createDefaultEngagementPattern(leadId, userId)
    }
  }

  private async createNewEngagementPattern(leadId: string, userId: string): Promise<LeadEngagementPattern> {
    try {
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      if (!lead) {
        throw new Error('Lead not found')
      }

      const pattern: LeadEngagementPattern = {
        leadId,
        userId,
        optimalTimes: this.getDefaultResponseWindows(),
        preferredChannels: [
          {
            channel: 'email',
            preference: 1.0,
            effectiveness: 0.5,
            lastUsed: new Date(),
            avgResponseTime: 60
          }
        ],
        responsePatterns: [
          {
            patternType: 'delayed',
            avgResponseTime: 60,
            responseProbability: 0.5,
            peakHours: [9, 10, 11, 14, 15, 16],
            preferredDays: [1, 2, 3, 4, 5] // Monday to Friday
          }
        ],
        engagementScore: lead.engagement_score || 0,
        lastActivity: new Date(lead.updated_at),
        nextOptimalContact: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        recommendedFrequency: 3 // 3 days
      }

      // Store in database
      await supabase
        .from('lead_engagement_patterns')
        .insert({
          lead_id: leadId,
          user_id: userId,
          optimal_times: pattern.optimalTimes,
          preferred_channels: pattern.preferredChannels,
          response_patterns: pattern.responsePatterns,
          engagement_score: pattern.engagementScore,
          last_activity: pattern.lastActivity,
          next_optimal_contact: pattern.nextOptimalContact,
          recommended_frequency: pattern.recommendedFrequency
        })

      return pattern
    } catch (error) {
      logger.error('Error creating new engagement pattern', error as Error, { leadId })
      return this.createDefaultEngagementPattern(leadId, userId)
    }
  }

  private createDefaultEngagementPattern(leadId: string, userId: string): LeadEngagementPattern {
    return {
      leadId,
      userId,
      optimalTimes: this.getDefaultResponseWindows(),
      preferredChannels: [
        {
          channel: 'email',
          preference: 1.0,
          effectiveness: 0.5,
          lastUsed: new Date(),
          avgResponseTime: 60
        }
      ],
      responsePatterns: [
        {
          patternType: 'delayed',
          avgResponseTime: 60,
          responseProbability: 0.5,
          peakHours: [9, 10, 11, 14, 15, 16],
          preferredDays: [1, 2, 3, 4, 5]
        }
      ],
      engagementScore: 0,
      lastActivity: new Date(),
      nextOptimalContact: new Date(Date.now() + 24 * 60 * 60 * 1000),
      recommendedFrequency: 3
    }
  }

  private async calculateOptimalTiming(
    leadId: string,
    followupType: string,
    engagementPattern: LeadEngagementPattern,
    options: any,
    userId: string
  ): Promise<Date> {
    try {
      // Get lead's timezone
      const timezone = await this.getLeadTimezone(leadId, userId)

      // Find next optimal time window
      const now = new Date()
      const currentDay = now.getDay()
      const currentHour = now.getHours()

      // Look for next optimal time slot
      let optimalTime = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Default to tomorrow

      for (const timeWindow of engagementPattern.optimalTimes) {
        if (timeWindow.effectiveness < 0.3) continue // Skip low-effectiveness windows

        const windowDay = (currentDay + Math.floor((timeWindow.startHour - currentHour) / 24)) % 7
        const windowDate = new Date(now)
        windowDate.setDate(now.getDate() + (windowDay - currentDay + 7) % 7)
        windowDate.setHours(timeWindow.startHour, 0, 0, 0)

        if (windowDate > now) {
          optimalTime = windowDate
          break
        }
      }

      // Apply max delay constraint
      if (options.maxDelay) {
        const maxDelayTime = new Date(now.getTime() + options.maxDelay * 60 * 60 * 1000)
        if (optimalTime > maxDelayTime) {
          optimalTime = maxDelayTime
        }
      }

      // Force immediate if requested
      if (options.forceNow) {
        optimalTime = new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes from now
      }

      return optimalTime
    } catch (error) {
      logger.error('Error calculating optimal timing', error as Error, { leadId, followupType })
      return new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now as fallback
    }
  }

  private async getLeadTimezone(leadId: string, userId: string): Promise<string> {
    try {
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('timezone')
        .eq('id', leadId)
        .single()

      return lead?.timezone || 'UTC'
    } catch (error) {
      logger.error('Error getting lead timezone', error as Error, { leadId })
      return 'UTC'
    }
  }

  private async generateOptimizationRecommendations(
    leadId: string,
    engagementPattern: LeadEngagementPattern,
    currentPerformance: any,
    context: Record<string, any>,
    userId: string
  ): Promise<OptimizationRecommendation> {
    // Use AI to generate optimization recommendations
    const prompt = `
      Generate followup optimization recommendations:

      Lead ID: ${leadId}
      Engagement Pattern: ${JSON.stringify(engagementPattern)}
      Current Performance: ${JSON.stringify(currentPerformance)}
      Context: ${JSON.stringify(context)}

      Analyze and recommend:
      1. Optimal timing adjustments
      2. Frequency optimizations
      3. Channel preferences
      4. Content improvements

      Return JSON with recommendations and confidence scores.
    `

    const response = await geminiClient.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })

    const recommendations = JSON.parse(response.choices[0].message.content)

    return {
      leadId,
      userId,
      recommendations: {
        timing: recommendations.timing,
        frequency: recommendations.frequency,
        channel: recommendations.channel,
        content: recommendations.content
      },
      confidence: recommendations.confidence || 0.7,
      expectedImpact: recommendations.expectedImpact || 0.2,
      reasoning: recommendations.reasoning || 'AI-generated optimization recommendations'
    }
  }

  private async applyOptimizations(
    leadId: string,
    recommendations: OptimizationRecommendation,
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      // Apply timing optimization
      if (recommendations.recommendations.timing) {
        await this.applyTimingOptimization(leadId, recommendations.recommendations.timing, userId)
      }

      // Apply frequency optimization
      if (recommendations.recommendations.frequency) {
        await this.applyFrequencyOptimization(leadId, recommendations.recommendations.frequency, userId)
      }

      // Apply channel optimization
      if (recommendations.recommendations.channel) {
        await this.applyChannelOptimization(leadId, recommendations.recommendations.channel, userId)
      }

      // Apply content optimization
      if (recommendations.recommendations.content) {
        await this.applyContentOptimization(leadId, recommendations.recommendations.content, userId)
      }

      // Log optimization event
      await this.logOptimizationEvent(leadId, 'comprehensive_optimization', recommendations, userId)
    } catch (error) {
      logger.error('Error applying optimizations', error as Error, { leadId })
    }
  }

  private async applyTimingOptimization(
    leadId: string,
    timingOptimization: TimeOptimization,
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('lead_engagement_patterns')
        .update({
          optimal_times: timingOptimization.alternativeTimes.map(time => ({
            dayOfWeek: time.getDay(),
            startHour: time.getHours(),
            endHour: time.getHours() + 1,
            timezone: 'UTC',
            effectiveness: timingOptimization.confidence
          })),
          updated_at: new Date()
        })
        .eq('lead_id', leadId)
        .eq('user_id', userId)
    } catch (error) {
      logger.error('Error applying timing optimization', error as Error, { leadId })
    }
  }

  private async applyFrequencyOptimization(
    leadId: string,
    frequencyOptimization: FrequencyOptimization,
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('lead_engagement_patterns')
        .update({
          recommended_frequency: frequencyOptimization.recommendedFrequency,
          updated_at: new Date()
        })
        .eq('lead_id', leadId)
        .eq('user_id', userId)
    } catch (error) {
      logger.error('Error applying frequency optimization', error as Error, { leadId })
    }
  }

  private async applyChannelOptimization(
    leadId: string,
    channelOptimization: ChannelOptimization,
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('lead_engagement_patterns')
        .update({
          preferred_channels: [
            {
              channel: channelOptimization.recommendedChannel,
              preference: 1.0,
              effectiveness: channelOptimization.confidence,
              lastUsed: new Date(),
              avgResponseTime: 60
            }
          ],
          updated_at: new Date()
        })
        .eq('lead_id', leadId)
        .eq('user_id', userId)
    } catch (error) {
      logger.error('Error applying channel optimization', error as Error, { leadId })
    }
  }

  private async applyContentOptimization(
    leadId: string,
    contentOptimization: ContentOptimization,
    userId: string
  ): Promise<void> {
    // Store content optimization for future use
    try {
      const supabase = await createClient()

      await supabase
        .from('content_optimizations')
        .insert({
          lead_id: leadId,
          user_id: userId,
          original_content: contentOptimization.currentContent,
          optimized_content: contentOptimization.recommendedContent,
          improvements: contentOptimization.improvements,
          confidence_score: contentOptimization.confidence,
          applied_at: new Date()
        })
    } catch (error) {
      logger.error('Error applying content optimization', error as Error, { leadId })
    }
  }

  private async logOptimizationEvent(
    leadId: string,
    eventType: string,
    optimization: OptimizationRecommendation,
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('optimization_events')
        .insert({
          lead_id: leadId,
          user_id: userId,
          event_type: eventType,
          previous_value: optimization.recommendations,
          new_value: optimization.recommendations,
          expected_improvement: optimization.expectedImpact,
          reasoning: optimization.reasoning,
          created_at: new Date()
        })
    } catch (error) {
      logger.error('Error logging optimization event', error as Error, { leadId, eventType })
    }
  }

  private async updateResponsePatterns(
    engagementPattern: LeadEngagementPattern,
    followupId: string,
    responseTime: Date,
    engagementScore: number
  ): Promise<void> {
    // Update response patterns based on new data
    // This would involve complex pattern analysis and machine learning
    // For now, we'll do a simple update
    engagementPattern.engagementScore = (engagementPattern.engagementScore + engagementScore) / 2
    engagementPattern.lastActivity = new Date()
  }

  private async recalculateOptimalTiming(
    engagementPattern: LeadEngagementPattern,
    userId: string
  ): Promise<void> {
    // Recalculate optimal contact timing based on updated patterns
    // This would involve analyzing historical response data
    engagementPattern.nextOptimalContact = new Date(Date.now() + engagementPattern.recommendedFrequency * 24 * 60 * 60 * 1000)
  }

  private async updateEngagementPattern(
    engagementPattern: LeadEngagementPattern,
    userId: string
  ): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('lead_engagement_patterns')
        .update({
          engagement_score: engagementPattern.engagementScore,
          last_activity: engagementPattern.lastActivity,
          next_optimal_contact: engagementPattern.nextOptimalContact,
          updated_at: new Date()
        })
        .eq('lead_id', engagementPattern.leadId)
        .eq('user_id', userId)
    } catch (error) {
      logger.error('Error updating engagement pattern', error as Error, { leadId: engagementPattern.leadId })
    }
  }

  private async analyzeCurrentPerformance(leadId: string, userId: string): Promise<any> {
    try {
      const supabase = await createClient()

      const { data: followups } = await supabase
        .from('completed_followups')
        .select('*')
        .eq('lead_id', leadId)
        .eq('user_id', userId)
        .order('sent_time', { ascending: false })
        .limit(20)

      // Analyze performance metrics
      const totalFollowups = followups?.length || 0
      const respondedFollowups = followups?.filter(f => f.response_received).length || 0
      const avgResponseTime = followups?.reduce((sum, f) => {
        if (f.response_time) {
          return sum + (new Date(f.response_time).getTime() - new Date(f.sent_time).getTime())
        }
        return sum
      }, 0) || 0

      return {
        totalFollowups,
        responseRate: totalFollowups > 0 ? respondedFollowups / totalFollowups : 0,
        avgResponseTime: totalFollowups > 0 ? avgResponseTime / (1000 * 60) : 0, // minutes
        recentPerformance: followups?.slice(0, 5) || []
      }
    } catch (error) {
      logger.error('Error analyzing current performance', error as Error, { leadId })
      return { totalFollowups: 0, responseRate: 0, avgResponseTime: 0, recentPerformance: [] }
    }
  }

  private async analyzeOptimalFrequency(
    engagementPattern: LeadEngagementPattern,
    performance: any,
    currentFrequency: number
  ): Promise<any> {
    // Simple frequency analysis - in production would use more sophisticated algorithms
    const responseRate = performance.responseRate
    const avgResponseTime = performance.avgResponseTime

    let optimalFrequency = currentFrequency

    if (responseRate > 0.7) {
      // High response rate - can increase frequency
      optimalFrequency = Math.max(1, currentFrequency - 1)
    } else if (responseRate < 0.3) {
      // Low response rate - decrease frequency
      optimalFrequency = currentFrequency + 2
    }

    return {
      optimalFrequency,
      reasoning: `Based on ${responseRate.toFixed(2)} response rate, recommended frequency is ${optimalFrequency} days`,
      confidence: 0.7
    }
  }

  private async analyzeChannelPerformance(
    engagementPattern: LeadEngagementPattern,
    context: Record<string, any>
  ): Promise<any> {
    // Analyze which channel performs best
    const channels = engagementPattern.preferredChannels
      .sort((a, b) => b.effectiveness - a.effectiveness)

    return {
      optimalChannel: channels[0]?.channel || 'email',
      alternativeChannels: channels.slice(1).map(c => c.channel),
      reasoning: `Based on effectiveness scores, ${channels[0]?.channel} is the optimal channel`,
      confidence: 0.8
    }
  }

  private async storeScheduledFollowup(scheduledFollowup: ScheduledFollowup, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('scheduled_followups')
        .insert({
          id: scheduledFollowup.id,
          lead_id: scheduledFollowup.metadata.leadId,
          user_id: userId,
          type: scheduledFollowup.type,
          content: scheduledFollowup.content,
          scheduled_time: scheduledFollowup.scheduledTime,
          priority: scheduledFollowup.priority,
          expected_response_time: scheduledFollowup.expectedResponseTime,
          optimization_score: scheduledFollowup.optimizationScore,
          metadata: scheduledFollowup.metadata
        })
    } catch (error) {
      logger.error('Error storing scheduled followup', error as Error, { followupId: scheduledFollowup.id })
    }
  }

  private generateDefaultRecommendation(leadId: string, userId: string): OptimizationRecommendation {
    return {
      leadId,
      userId,
      recommendations: {},
      confidence: 0.5,
      expectedImpact: 0.1,
      reasoning: 'Default optimization recommendations'
    }
  }

  private getDefaultResponseWindows(): TimeWindow[] {
    return [
      {
        dayOfWeek: 1, // Monday
        startHour: 9,
        endHour: 11,
        timezone: 'UTC',
        effectiveness: 0.8
      },
      {
        dayOfWeek: 1, // Monday
        startHour: 14,
        endHour: 16,
        timezone: 'UTC',
        effectiveness: 0.7
      },
      {
        dayOfWeek: 2, // Tuesday
        startHour: 9,
        endHour: 11,
        timezone: 'UTC',
        effectiveness: 0.75
      },
      {
        dayOfWeek: 3, // Wednesday
        startHour: 9,
        endHour: 11,
        timezone: 'UTC',
        effectiveness: 0.7
      },
      {
        dayOfWeek: 4, // Thursday
        startHour: 9,
        endHour: 11,
        timezone: 'UTC',
        effectiveness: 0.75
      },
      {
        dayOfWeek: 5, // Friday
        startHour: 9,
        endHour: 11,
        timezone: 'UTC',
        effectiveness: 0.6
      }
    ]
  }
}

export const followupOptimization = FollowupOptimization.getInstance()