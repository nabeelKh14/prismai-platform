/**
 * Lead Engagement Tracking System
 * Tracks and analyzes lead engagement across multiple channels
 */

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface EngagementEvent {
  leadId: string
  channel: 'email' | 'website' | 'social' | 'ads' | 'direct' | 'referral'
  type: 'view' | 'click' | 'download' | 'share' | 'comment' | 'like' | 'follow' | 'unsubscribe' | 'bounce'
  contentId?: string
  metadata: Record<string, any>
  timestamp: Date
  sessionId?: string
  userAgent?: string
  ipAddress?: string
}

export interface EngagementScore {
  overall: number
  recency: number
  frequency: number
  depth: number
  channels: Record<string, number>
  trends: {
    direction: 'increasing' | 'decreasing' | 'stable'
    changePercent: number
  }
}

export class EngagementTracker {
  private static instance: EngagementTracker

  static getInstance(): EngagementTracker {
    if (!EngagementTracker.instance) {
      EngagementTracker.instance = new EngagementTracker()
    }
    return EngagementTracker.instance
  }

  /**
   * Track an engagement event
   */
  async trackEvent(event: EngagementEvent): Promise<void> {
    try {
      const supabase = await createClient()

      // Calculate engagement score for this event
      const eventScore = this.calculateEventScore(event)

      // Insert engagement record
      const { error } = await supabase
        .from('lead_engagement')
        .insert({
          lead_id: event.leadId,
          channel: event.channel,
          engagement_type: event.type,
          content_id: event.contentId,
          metadata: {
            ...event.metadata,
            sessionId: event.sessionId,
            userAgent: event.userAgent,
            ipAddress: event.ipAddress
          },
          engagement_score: eventScore
        })

      if (error) {
        throw error
      }

      // Update lead's last engagement timestamp
      await supabase
        .from('leads')
        .update({ last_engagement_at: new Date().toISOString() })
        .eq('id', event.leadId)

      // Trigger engagement-based workflows
      await this.triggerEngagementWorkflows(event)

      // Update lead's overall engagement score
      await this.updateLeadEngagementScore(event.leadId)

    } catch (error) {
      logger.error('Error tracking engagement event:', error)
    }
  }

  /**
   * Calculate comprehensive engagement score for a lead
   */
  async calculateEngagementScore(leadId: string): Promise<EngagementScore> {
    try {
      const supabase = await createClient()

      // Get all engagement events for the lead
      const { data: events } = await supabase
        .from('lead_engagement')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (!events || events.length === 0) {
        return this.getEmptyEngagementScore()
      }

      // Calculate recency score (days since last engagement)
      const lastEngagement = new Date(events[0].created_at)
      const daysSinceLastEngagement = Math.floor((Date.now() - lastEngagement.getTime()) / (1000 * 60 * 60 * 24))
      const recencyScore = Math.max(0, 100 - daysSinceLastEngagement * 2)

      // Calculate frequency score (engagements per week over last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const recentEvents = events.filter(e => new Date(e.created_at) > thirtyDaysAgo)
      const frequencyScore = Math.min(100, recentEvents.length * 10)

      // Calculate depth score (variety and quality of engagement)
      const channelScores = this.calculateChannelScores(events)
      const typeScores = this.calculateTypeScores(events)
      const depthScore = (channelScores.average + typeScores.average) / 2

      // Calculate channel-specific scores
      const channelBreakdown = this.calculateChannelBreakdown(events)

      // Calculate trend
      const trend = this.calculateEngagementTrend(events)

      return {
        overall: Math.round((recencyScore * 0.3 + frequencyScore * 0.3 + depthScore * 0.4)),
        recency: Math.round(recencyScore),
        frequency: Math.round(frequencyScore),
        depth: Math.round(depthScore),
        channels: channelBreakdown,
        trends: trend
      }

    } catch (error) {
      logger.error('Error calculating engagement score:', error)
      return this.getEmptyEngagementScore()
    }
  }

  /**
   * Get engagement analytics for reporting
   */
  async getEngagementAnalytics(userId: string, dateRange?: { start: Date; end: Date }) {
    try {
      const supabase = await createClient()

      let query = supabase
        .from('lead_engagement')
        .select(`
          *,
          leads(email, first_name, last_name, lead_score)
        `)
        .eq('leads.user_id', userId)

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
      }

      const { data: events } = await query

      if (!events || events.length === 0) {
        return {
          totalEvents: 0,
          uniqueLeads: 0,
          avgEngagementScore: 0,
          channelBreakdown: {},
          typeBreakdown: {},
          topEngagedLeads: []
        }
      }

      // Calculate analytics
      const uniqueLeads = new Set(events.map(e => e.lead_id)).size
      const avgEngagementScore = events.reduce((sum, e) => sum + (e.engagement_score || 0), 0) / events.length

      const channelBreakdown = events.reduce((acc, event) => {
        acc[event.channel] = (acc[event.channel] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const typeBreakdown = events.reduce((acc, event) => {
        acc[event.engagement_type] = (acc[event.engagement_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Top engaged leads
      const leadEngagement = events.reduce((acc, event) => {
        if (!acc[event.lead_id]) {
          acc[event.lead_id] = {
            lead: event.leads,
            eventCount: 0,
            totalScore: 0
          }
        }
        acc[event.lead_id].eventCount++
        acc[event.lead_id].totalScore += event.engagement_score || 0
        return acc
      }, {} as Record<string, any>)

      const topEngagedLeads = Object.values(leadEngagement)
        .sort((a: any, b: any) => b.totalScore - a.totalScore)
        .slice(0, 10)

      return {
        totalEvents: events.length,
        uniqueLeads,
        avgEngagementScore: Math.round(avgEngagementScore * 100) / 100,
        channelBreakdown,
        typeBreakdown,
        topEngagedLeads
      }

    } catch (error) {
      logger.error('Error getting engagement analytics:', error)
      return {
        totalEvents: 0,
        uniqueLeads: 0,
        avgEngagementScore: 0,
        channelBreakdown: {},
        typeBreakdown: {},
        topEngagedLeads: []
      }
    }
  }

  /**
   * Track email engagement events
   */
  async trackEmailEngagement(
    leadId: string,
    emailId: string,
    eventType: 'open' | 'click' | 'bounce' | 'unsubscribe',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.trackEvent({
      leadId,
      channel: 'email',
      type: eventType,
      contentId: emailId,
      metadata: {
        ...metadata,
        emailId
      },
      timestamp: new Date()
    })
  }

  /**
   * Track website engagement events
   */
  async trackWebsiteEngagement(
    leadId: string,
    pageUrl: string,
    eventType: 'view' | 'click' | 'download' | 'form_submit',
    sessionId: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.trackEvent({
      leadId,
      channel: 'website',
      type: eventType,
      contentId: pageUrl,
      sessionId,
      metadata: {
        ...metadata,
        pageUrl,
        timeOnPage: metadata.timeOnPage,
        scrollDepth: metadata.scrollDepth
      },
      timestamp: new Date()
    })
  }

  /**
   * Track social media engagement
   */
  async trackSocialEngagement(
    leadId: string,
    platform: string,
    contentId: string,
    eventType: 'like' | 'share' | 'comment' | 'follow',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.trackEvent({
      leadId,
      channel: 'social',
      type: eventType,
      contentId: contentId,
      metadata: {
        ...metadata,
        platform,
        contentId
      },
      timestamp: new Date()
    })
  }

  /**
   * Private helper methods
   */
  private calculateEventScore(event: EngagementEvent): number {
    const baseScores = {
      email: {
        open: 5,
        click: 15,
        bounce: -10,
        unsubscribe: -20
      },
      website: {
        view: 3,
        click: 8,
        download: 20,
        form_submit: 25
      },
      social: {
        like: 5,
        share: 15,
        comment: 10,
        follow: 12
      },
      ads: {
        view: 2,
        click: 10
      }
    }

    const channelScores = baseScores[event.channel as keyof typeof baseScores] || {}
    const baseScore = channelScores[event.type as keyof typeof channelScores] || 1

    // Apply multipliers based on metadata
    let multiplier = 1

    if (event.metadata.timeOnPage && event.metadata.timeOnPage > 60) {
      multiplier *= 1.5 // Longer engagement
    }

    if (event.metadata.scrollDepth && event.metadata.scrollDepth > 75) {
      multiplier *= 1.3 // Deep engagement
    }

    if (event.metadata.isFirstTime) {
      multiplier *= 1.2 // First-time engagement
    }

    return Math.round(baseScore * multiplier)
  }

  private async updateLeadEngagementScore(leadId: string): Promise<void> {
    try {
      const engagementScore = await this.calculateEngagementScore(leadId)

      const supabase = await createClient()
      await supabase
        .from('leads')
        .update({
          engagement_score: engagementScore.overall,
          last_engagement_at: new Date().toISOString()
        })
        .eq('id', leadId)

    } catch (error) {
      logger.error('Error updating lead engagement score:', error)
    }
  }

  private async triggerEngagementWorkflows(event: EngagementEvent): Promise<void> {
    try {
      const supabase = await createClient()

      // Find workflows triggered by engagement events
      const { data: workflows } = await supabase
        .from('lead_workflows')
        .select('*')
        .eq('trigger_type', 'behavior')
        .eq('status', 'active')

      for (const workflow of workflows || []) {
        const conditions = workflow.trigger_conditions

        // Check if this engagement event matches trigger conditions
        if (this.matchesEngagementTrigger(conditions, event)) {
          // Get user ID from lead
          const { data: lead } = await supabase
            .from('leads')
            .select('user_id')
            .eq('id', event.leadId)
            .single()

          if (lead) {
            // Start workflow execution
            const { workflowEngine } = await import('@/lib/workflows/workflow-engine')
            await workflowEngine.startWorkflow(workflow.id, event.leadId, lead.user_id)
          }
        }
      }

    } catch (error) {
      logger.error('Error triggering engagement workflows:', error)
    }
  }

  private matchesEngagementTrigger(conditions: any, event: EngagementEvent): boolean {
    if (!conditions) return false

    if (conditions.channel && conditions.channel !== event.channel) {
      return false
    }

    if (conditions.type && conditions.type !== event.type) {
      return false
    }

    if (conditions.minScore && event.metadata.engagementScore < conditions.minScore) {
      return false
    }

    return true
  }

  private getEmptyEngagementScore(): EngagementScore {
    return {
      overall: 0,
      recency: 0,
      frequency: 0,
      depth: 0,
      channels: {},
      trends: {
        direction: 'stable',
        changePercent: 0
      }
    }
  }

  private calculateChannelScores(events: any[]): { average: number; breakdown: Record<string, number> } {
    const channelCounts = events.reduce((acc, event) => {
      acc[event.channel] = (acc[event.channel] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalEvents = events.length
    const channelDiversity = Object.keys(channelCounts).length
    const average = Math.min(100, channelDiversity * 20) // Max 100 for 5+ channels

    return { average, breakdown: channelCounts }
  }

  private calculateTypeScores(events: any[]): { average: number; breakdown: Record<string, number> } {
    const typeCounts = events.reduce((acc, event) => {
      acc[event.engagement_type] = (acc[event.engagement_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalEvents = events.length
    const typeDiversity = Object.keys(typeCounts).length
    const average = Math.min(100, typeDiversity * 25) // Max 100 for 4+ types

    return { average, breakdown: typeCounts }
  }

  private calculateChannelBreakdown(events: any[]): Record<string, number> {
    return events.reduce((acc, event) => {
      acc[event.channel] = (acc[event.channel] || 0) + (event.engagement_score || 0)
      return acc
    }, {} as Record<string, number>)
  }

  private calculateEngagementTrend(events: any[]): { direction: 'increasing' | 'decreasing' | 'stable'; changePercent: number } {
    if (events.length < 7) {
      return { direction: 'stable', changePercent: 0 }
    }

    // Split events into two periods
    const midpoint = Math.floor(events.length / 2)
    const recentEvents = events.slice(0, midpoint)
    const olderEvents = events.slice(midpoint)

    const recentAvg = recentEvents.reduce((sum, e) => sum + (e.engagement_score || 0), 0) / recentEvents.length
    const olderAvg = olderEvents.reduce((sum, e) => sum + (e.engagement_score || 0), 0) / olderEvents.length

    const changePercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (changePercent > 10) direction = 'increasing'
    else if (changePercent < -10) direction = 'decreasing'

    return { direction, changePercent: Math.round(changePercent * 100) / 100 }
  }
}

export const engagementTracker = EngagementTracker.getInstance()