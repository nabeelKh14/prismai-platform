/**
 * Priority-Based Lead Routing System
 * Routes leads based on priority scores, business value, urgency, and time sensitivity
 */

import { createClient } from '@/lib/supabase/server'
import { EnhancedLeadScoringEngine } from '@/lib/mcp/enhanced-lead-scoring'
import { logger } from '@/lib/logger'
import { Redis } from '@upstash/redis'

export interface PriorityScore {
  overall: number
  businessValue: number
  urgency: number
  timeSensitivity: number
  breakdown: {
    businessValue: {
      companySize: number
      industry: number
      jobTitle: number
      budget: number
    }
    urgency: {
      responseTime: number
      competition: number
      buyingStage: number
    }
    timeSensitivity: {
      deadline: number
      seasonality: number
      marketTiming: number
    }
  }
}

export interface LeadPriority {
  leadId: string
  priorityScore: PriorityScore
  priorityLevel: 'critical' | 'high' | 'medium' | 'low'
  routingQueue: string
  assignedAgent?: string
  estimatedValue: number
  responseDeadline: Date
  createdAt: Date
}

export interface RoutingDecision {
  leadId: string
  assignedAgent: string
  queue: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  reasoning: string[]
  confidence: number
  estimatedWaitTime: number
}

export interface AgentAvailability {
  agentId: string
  currentLoad: number
  maxCapacity: number
  skills: string[]
  averageResponseTime: number
  isAvailable: boolean
  lastActivity: Date
}

export class PriorityRoutingService {
  private static instance: PriorityRoutingService
  private redis: Redis
  private readonly PRIORITY_THRESHOLDS = {
    critical: 90,
    high: 75,
    medium: 50,
    low: 0
  }

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!
    })
  }

  static getInstance(): PriorityRoutingService {
    if (!PriorityRoutingService.instance) {
      PriorityRoutingService.instance = new PriorityRoutingService()
    }
    return PriorityRoutingService.instance
  }

  /**
   * Calculate comprehensive priority score for a lead
   */
  async calculatePriorityScore(leadId: string, userId: string): Promise<PriorityScore> {
    try {
      const supabase = await createClient()

      // Get lead data with full context
      const { data: lead } = await supabase
        .from('leads')
        .select(`
          *,
          lead_sources(name, type),
          lead_activities(*),
          lead_engagement(*)
        `)
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      if (!lead) {
        throw new Error('Lead not found')
      }

      // Calculate business value score
      const businessValue = await this.calculateBusinessValue(lead)

      // Calculate urgency score
      const urgency = await this.calculateUrgency(lead)

      // Calculate time sensitivity score
      const timeSensitivity = await this.calculateTimeSensitivity(lead)

      // Calculate overall priority score
      const overall = Math.round(
        (businessValue * 0.4) + // 40% weight for business value
        (urgency * 0.35) +      // 35% weight for urgency
        (timeSensitivity * 0.25) // 25% weight for time sensitivity
      )

      const priorityScore: PriorityScore = {
        overall: Math.max(0, Math.min(100, overall)),
        businessValue,
        urgency,
        timeSensitivity,
        breakdown: {
          businessValue: {
            companySize: businessValue * 0.3,
            industry: businessValue * 0.25,
            jobTitle: businessValue * 0.25,
            budget: businessValue * 0.2
          },
          urgency: {
            responseTime: urgency * 0.4,
            competition: urgency * 0.3,
            buyingStage: urgency * 0.3
          },
          timeSensitivity: {
            deadline: timeSensitivity * 0.4,
            seasonality: timeSensitivity * 0.3,
            marketTiming: timeSensitivity * 0.3
          }
        }
      }

      // Store priority score in database
      await supabase
        .from('leads')
        .update({
          priority_score: priorityScore.overall,
          business_value_score: priorityScore.businessValue,
          urgency_score: priorityScore.urgency,
          time_sensitivity_score: priorityScore.timeSensitivity,
          priority_metadata: priorityScore.breakdown
        })
        .eq('id', leadId)

      logger.info('Priority score calculated', {
        leadId,
        overall: priorityScore.overall,
        businessValue: priorityScore.businessValue,
        urgency: priorityScore.urgency,
        timeSensitivity: priorityScore.timeSensitivity
      })

      return priorityScore

    } catch (error) {
      logger.error('Error calculating priority score:', error)
      throw error
    }
  }

  /**
   * Calculate business value score
   */
  private async calculateBusinessValue(lead: any): Promise<number> {
    let score = 0

    // Company size scoring
    const companySizeScore = await this.scoreCompanySize(lead.company)
    score += companySizeScore

    // Industry scoring
    const industryScore = await this.scoreIndustry(lead.company)
    score += industryScore

    // Job title scoring
    const jobTitleScore = await this.scoreJobTitle(lead.job_title)
    score += jobTitleScore

    // Budget indicators
    const budgetScore = this.scoreBudgetIndicators(lead)
    score += budgetScore

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Calculate urgency score
   */
  private async calculateUrgency(lead: any): Promise<number> {
    let score = 0

    // Response time expectations
    const responseTimeScore = this.scoreResponseTime(lead)
    score += responseTimeScore

    // Competition indicators
    const competitionScore = this.scoreCompetition(lead)
    score += competitionScore

    // Buying stage indicators
    const buyingStageScore = this.scoreBuyingStage(lead)
    score += buyingStageScore

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Calculate time sensitivity score
   */
  private async calculateTimeSensitivity(lead: any): Promise<number> {
    let score = 0

    // Deadline proximity
    const deadlineScore = this.scoreDeadline(lead)
    score += deadlineScore

    // Seasonality factors
    const seasonalityScore = this.scoreSeasonality(lead)
    score += seasonalityScore

    // Market timing
    const marketTimingScore = this.scoreMarketTiming(lead)
    score += marketTimingScore

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Determine priority level based on score
   */
  getPriorityLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= this.PRIORITY_THRESHOLDS.critical) return 'critical'
    if (score >= this.PRIORITY_THRESHOLDS.high) return 'high'
    if (score >= this.PRIORITY_THRESHOLDS.medium) return 'medium'
    return 'low'
  }

  /**
   * Get appropriate routing queue for priority level
   */
  getRoutingQueue(priorityLevel: string): string {
    const queueMap = {
      critical: 'priority_critical',
      high: 'priority_high',
      medium: 'priority_medium',
      low: 'priority_low'
    }
    return queueMap[priorityLevel as keyof typeof queueMap] || 'priority_low'
  }

  /**
   * Add lead to priority queue
   */
  async addToPriorityQueue(leadPriority: LeadPriority): Promise<void> {
    try {
      const queueKey = `lead_queue:${leadPriority.routingQueue}`

      // Store lead priority data
      await this.redis.zadd(queueKey, {
        score: leadPriority.priorityScore.overall,
        member: leadPriority.leadId
      })

      // Store lead priority metadata
      await this.redis.hset(`lead_priority:${leadPriority.leadId}`, {
        priorityScore: JSON.stringify(leadPriority.priorityScore),
        priorityLevel: leadPriority.priorityLevel,
        routingQueue: leadPriority.routingQueue,
        assignedAgent: leadPriority.assignedAgent || '',
        estimatedValue: leadPriority.estimatedValue,
        responseDeadline: leadPriority.responseDeadline.toISOString(),
        createdAt: leadPriority.createdAt.toISOString()
      })

      // Set expiration for cleanup (7 days)
      await this.redis.expire(`lead_priority:${leadPriority.leadId}`, 7 * 24 * 60 * 60)

      logger.info('Lead added to priority queue', {
        leadId: leadPriority.leadId,
        queue: leadPriority.routingQueue,
        priority: leadPriority.priorityLevel,
        score: leadPriority.priorityScore.overall
      })

    } catch (error) {
      logger.error('Error adding lead to priority queue:', error)
      throw error
    }
  }

  /**
   * Get next lead from priority queue
   */
  async getNextFromQueue(queueName: string): Promise<string | null> {
    try {
      const queueKey = `lead_queue:${queueName}`
      const leadIds = await this.redis.zrange(queueKey, 0, 0, { rev: true })

      return leadIds.length > 0 ? leadIds[0] as string : null

    } catch (error) {
      logger.error('Error getting next lead from queue:', error)
      return null
    }
  }

  /**
   * Remove lead from priority queue
   */
  async removeFromQueue(leadId: string, queueName: string): Promise<void> {
    try {
      const queueKey = `lead_queue:${queueName}`

      await this.redis.zrem(queueKey, leadId)
      await this.redis.del(`lead_priority:${leadId}`)

      logger.info('Lead removed from priority queue', { leadId, queueName })

    } catch (error) {
      logger.error('Error removing lead from queue:', error)
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<Record<string, any>> {
    try {
      const queues = ['priority_critical', 'priority_high', 'priority_medium', 'priority_low']
      const stats: Record<string, any> = {}

      for (const queue of queues) {
        const queueKey = `lead_queue:${queue}`
        const count = await this.redis.zcard(queueKey)
        const oldestLead = await this.redis.zrange(queueKey, 0, 0, { rev: false })

        stats[queue] = {
          count,
          oldestLead: oldestLead.length > 0 ? oldestLead[0] : null
        }
      }

      return stats

    } catch (error) {
      logger.error('Error getting queue stats:', error)
      return {}
    }
  }

  // Private scoring methods

  private async scoreCompanySize(company: string): Promise<number> {
    if (!company) return 10

    try {
      // Use AI to estimate company size
      const prompt = `Based on the company name "${company}", estimate the company size category:
      - enterprise (1000+ employees) = 30 points
      - mid_market (100-999 employees) = 20 points
      - small_business (10-99 employees) = 10 points
      - startup (fewer than 10 employees) = 5 points

      Respond with just the number of points.`

      // This would use the gemini client in a real implementation
      // For now, return a default score
      return 15

    } catch (error) {
      return 10
    }
  }

  private async scoreIndustry(company: string): Promise<number> {
    // Industry scoring based on business value
    const highValueIndustries = ['technology', 'finance', 'healthcare', 'consulting']
    const mediumValueIndustries = ['manufacturing', 'retail', 'education']

    // This would use AI to categorize the industry
    return 15 // Default medium score
  }

  private async scoreJobTitle(jobTitle: string): Promise<number> {
    if (!jobTitle) return 5

    const decisionMakers = ['ceo', 'cto', 'cfo', 'president', 'director', 'vp', 'vice president']
    const influencers = ['senior', 'lead', 'manager', 'supervisor']

    const title = jobTitle.toLowerCase()

    if (decisionMakers.some(role => title.includes(role))) return 25
    if (influencers.some(role => title.includes(role))) return 15

    return 5
  }

  private scoreBudgetIndicators(lead: any): number {
    // Analyze custom fields and other indicators for budget signals
    return 10
  }

  private scoreResponseTime(lead: any): number {
    // Score based on lead source and activity recency
    const sourceType = lead.lead_sources?.type || 'unknown'
    const lastActivity = lead.lead_activities?.[0]?.created_at

    let score = 10

    // High urgency sources
    if (['website', 'live_chat', 'phone'].includes(sourceType)) score += 20

    // Recent activity bonus
    if (lastActivity) {
      const hoursSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60)
      if (hoursSinceActivity < 1) score += 30
      else if (hoursSinceActivity < 24) score += 15
    }

    return Math.min(50, score)
  }

  private scoreCompetition(lead: any): number {
    // Score based on competitive signals
    return 15 // Default score
  }

  private scoreBuyingStage(lead: any): number {
    // Score based on engagement level and activity patterns
    const activityCount = lead.lead_activities?.length || 0

    if (activityCount > 10) return 25
    if (activityCount > 5) return 15
    if (activityCount > 2) return 10

    return 5
  }

  private scoreDeadline(lead: any): number {
    // Score based on explicit deadlines or time-sensitive indicators
    return 10 // Default score
  }

  private scoreSeasonality(lead: any): number {
    // Score based on seasonal factors
    const currentMonth = new Date().getMonth() + 1

    // Q4 is typically high urgency for B2B sales
    if (currentMonth >= 10) return 20
    if (currentMonth >= 7) return 10

    return 5
  }

  private scoreMarketTiming(lead: any): number {
    // Score based on market conditions and timing
    return 10 // Default score
  }
}

export const priorityRoutingService = PriorityRoutingService.getInstance()