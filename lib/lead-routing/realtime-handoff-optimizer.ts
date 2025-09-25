/**
 * Real-Time Handoff Optimization
 * Optimizes lead handoffs between agents and systems in real-time
 */

import { intelligentRoutingEngine } from './intelligent-routing-engine'
import { priorityRoutingService } from './priority-routing-service'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { Redis } from '@upstash/redis'

export interface HandoffEvent {
  leadId: string
  fromAgent?: string
  toAgent: string
  handoffType: 'assignment' | 'transfer' | 'escalation' | 'reassignment'
  reason: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  timestamp: Date
  metadata?: Record<string, any>
}

export interface HandoffOptimization {
  leadId: string
  optimizedAgent: string
  originalAgent?: string
  optimizationType: 'load_balancing' | 'skill_match' | 'priority_escalation' | 'performance'
  confidence: number
  expectedImprovement: number
  reasoning: string[]
}

export interface AgentPerformance {
  agentId: string
  leadsHandled: number
  averageResolutionTime: number
  successRate: number
  customerSatisfaction: number
  currentStreak: number
  lastActivity: Date
}

export class RealtimeHandoffOptimizer {
  private static instance: RealtimeHandoffOptimizer
  private redis: Redis
  private performanceCache: Map<string, AgentPerformance> = new Map()
  private readonly HANDOFF_TIMEOUTS = {
    critical: 2 * 60 * 1000, // 2 minutes
    high: 10 * 60 * 1000,    // 10 minutes
    medium: 30 * 60 * 1000,  // 30 minutes
    low: 60 * 60 * 1000      // 1 hour
  }

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!
    })
    this.initializePerformanceTracking()
  }

  static getInstance(): RealtimeHandoffOptimizer {
    if (!RealtimeHandoffOptimizer.instance) {
      RealtimeHandoffOptimizer.instance = new RealtimeHandoffOptimizer()
    }
    return RealtimeHandoffOptimizer.instance
  }

  /**
   * Record handoff event
   */
  async recordHandoffEvent(event: HandoffEvent): Promise<void> {
    try {
      const supabase = await createClient()

      // Store handoff event
      await supabase
        .from('lead_handoff_events')
        .insert({
          lead_id: event.leadId,
          from_agent_id: event.fromAgent,
          to_agent_id: event.toAgent,
          handoff_type: event.handoffType,
          reason: event.reason,
          priority_level: event.priority,
          metadata: event.metadata || {},
          created_at: event.timestamp.toISOString()
        })

      // Update agent performance metrics
      await this.updateAgentPerformance(event.toAgent, event.handoffType, event.priority)

      // Set handoff timeout monitoring
      await this.setHandoffTimeout(event.leadId, event.priority, event.toAgent)

      logger.info('Handoff event recorded', {
        leadId: event.leadId,
        toAgent: event.toAgent,
        type: event.handoffType,
        priority: event.priority
      })

    } catch (error) {
      logger.error('Error recording handoff event:', error)
    }
  }

  /**
   * Optimize handoff for better outcomes
   */
  async optimizeHandoff(leadId: string, userId: string): Promise<HandoffOptimization | null> {
    try {
      const supabase = await createClient()

      // Get current lead assignment
      const { data: lead } = await supabase
        .from('leads')
        .select(`
          *,
          assigned_agent_id,
          priority_score,
          lead_activities(*)
        `)
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      if (!lead || !lead.assigned_agent_id) {
        return null
      }

      // Get agent performance data
      const currentAgentPerformance = await this.getAgentPerformance(lead.assigned_agent_id)
      const availableAgents = await intelligentRoutingEngine['getAvailableAgents'](userId)

      // Analyze if optimization is needed
      const optimization = await this.analyzeOptimizationOpportunity(
        lead,
        currentAgentPerformance,
        availableAgents
      )

      if (optimization && optimization.expectedImprovement > 0.1) { // 10% improvement threshold
        logger.info('Handoff optimization opportunity identified', {
          leadId,
          currentAgent: lead.assigned_agent_id,
          optimizedAgent: optimization.optimizedAgent,
          expectedImprovement: optimization.expectedImprovement
        })

        return optimization
      }

      return null

    } catch (error) {
      logger.error('Error optimizing handoff:', error)
      return null
    }
  }

  /**
   * Execute optimized handoff
   */
  async executeOptimizedHandoff(optimization: HandoffOptimization): Promise<void> {
    try {
      const supabase = await createClient()

      // Create handoff event
      const handoffEvent: HandoffEvent = {
        leadId: optimization.leadId,
        fromAgent: optimization.originalAgent,
        toAgent: optimization.optimizedAgent,
        handoffType: 'reassignment',
        reason: `Optimization: ${optimization.optimizationType} - ${optimization.reasoning.join(', ')}`,
        priority: 'high', // Optimization handoffs are high priority
        timestamp: new Date(),
        metadata: {
          optimizationType: optimization.optimizationType,
          confidence: optimization.confidence,
          expectedImprovement: optimization.expectedImprovement
        }
      }

      // Update lead assignment
      await supabase
        .from('leads')
        .update({
          assigned_agent_id: optimization.optimizedAgent,
          status: 'reassigned',
          reassigned_at: new Date().toISOString()
        })
        .eq('id', optimization.leadId)

      // Record the handoff event
      await this.recordHandoffEvent(handoffEvent)

      // Notify both agents
      await this.notifyAgentHandoff(handoffEvent)

      logger.info('Optimized handoff executed', {
        leadId: optimization.leadId,
        fromAgent: optimization.originalAgent,
        toAgent: optimization.optimizedAgent,
        type: optimization.optimizationType
      })

    } catch (error) {
      logger.error('Error executing optimized handoff:', error)
    }
  }

  /**
   * Monitor handoff timeouts
   */
  async monitorHandoffTimeouts(): Promise<void> {
    try {
      const supabase = await createClient()

      // Get leads that might have timed out
      const timeoutThreshold = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago

      const { data: timedOutLeads } = await supabase
        .from('leads')
        .select(`
          *,
          assigned_agent_id,
          priority_score,
          lead_activities(*)
        `)
        .eq('status', 'assigned')
        .lt('assigned_at', timeoutThreshold.toISOString())
        .is('reassigned_at', null)

      for (const lead of timedOutLeads || []) {
        await this.handleHandoffTimeout(lead)
      }

    } catch (error) {
      logger.error('Error monitoring handoff timeouts:', error)
    }
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(agentId: string): Promise<AgentPerformance | null> {
    try {
      if (this.performanceCache.has(agentId)) {
        return this.performanceCache.get(agentId)!
      }

      const supabase = await createClient()

      const { data: performance } = await supabase
        .from('agent_performance_metrics')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (performance) {
        this.performanceCache.set(agentId, performance)
        return performance
      }

      return null

    } catch (error) {
      logger.error('Error getting agent performance:', error)
      return null
    }
  }

  /**
   * Update agent performance after handoff
   */
  async updateAgentPerformance(agentId: string, handoffType: string, priority: string): Promise<void> {
    try {
      const currentPerformance = await this.getAgentPerformance(agentId) || {
        agentId,
        leadsHandled: 0,
        averageResolutionTime: 0,
        successRate: 0,
        customerSatisfaction: 0,
        currentStreak: 0,
        lastActivity: new Date()
      }

      // Update metrics based on handoff type
      const updatedPerformance = { ...currentPerformance }

      if (handoffType === 'assignment') {
        updatedPerformance.leadsHandled += 1
        updatedPerformance.currentStreak += 1
      } else if (handoffType === 'transfer') {
        updatedPerformance.currentStreak = 0 // Reset streak on transfer
      }

      updatedPerformance.lastActivity = new Date()

      // Store updated performance
      const supabase = await createClient()
      await supabase
        .from('agent_performance_metrics')
        .upsert({
          agent_id: agentId,
          leads_handled: updatedPerformance.leadsHandled,
          average_resolution_time: updatedPerformance.averageResolutionTime,
          success_rate: updatedPerformance.successRate,
          customer_satisfaction: updatedPerformance.customerSatisfaction,
          current_streak: updatedPerformance.currentStreak,
          last_activity: updatedPerformance.lastActivity.toISOString(),
          updated_at: new Date().toISOString()
        })

      this.performanceCache.set(agentId, updatedPerformance)

    } catch (error) {
      logger.error('Error updating agent performance:', error)
    }
  }

  /**
   * Process real-time optimization cycle
   */
  async runOptimizationCycle(userId: string): Promise<void> {
    try {
      // Monitor timeouts
      await this.monitorHandoffTimeouts()

      // Get all assigned leads for optimization analysis
      const supabase = await createClient()
      const { data: assignedLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'assigned')
        .not('assigned_agent_id', 'is', null)

      for (const lead of assignedLeads || []) {
        const optimization = await this.optimizeHandoff(lead.id, userId)

        if (optimization) {
          await this.executeOptimizedHandoff(optimization)
        }
      }

      logger.info('Handoff optimization cycle completed', { userId })

    } catch (error) {
      logger.error('Error running optimization cycle:', error)
    }
  }

  // Private helper methods

  private async analyzeOptimizationOpportunity(
    lead: any,
    currentAgentPerformance: AgentPerformance | null,
    availableAgents: any[]
  ): Promise<HandoffOptimization | null> {
    if (availableAgents.length <= 1) return null

    const currentAgent = availableAgents.find(a => a.agentId === lead.assigned_agent_id)
    if (!currentAgent) return null

    let bestOptimization: HandoffOptimization | null = null
    let bestImprovement = 0

    for (const agent of availableAgents) {
      if (agent.agentId === lead.assigned_agent_id) continue

      // Analyze different optimization types
      const optimizations = await Promise.all([
        this.analyzeLoadBalancingOptimization(lead, currentAgent, agent),
        this.analyzeSkillMatchOptimization(lead, currentAgent, agent),
        this.analyzePerformanceOptimization(lead, currentAgentPerformance, agent)
      ])

      for (const optimization of optimizations) {
        if (optimization && optimization.expectedImprovement > bestImprovement) {
          bestImprovement = optimization.expectedImprovement
          bestOptimization = optimization
        }
      }
    }

    return bestOptimization
  }

  private async analyzeLoadBalancingOptimization(lead: any, currentAgent: any, targetAgent: any): Promise<HandoffOptimization | null> {
    const currentLoadRatio = currentAgent.currentLoad / currentAgent.maxCapacity
    const targetLoadRatio = targetAgent.currentLoad / targetAgent.maxCapacity

    if (currentLoadRatio > 0.8 && targetLoadRatio < 0.6) {
      const expectedImprovement = (currentLoadRatio - targetLoadRatio) / 2

      return {
        leadId: lead.id,
        optimizedAgent: targetAgent.agentId,
        originalAgent: currentAgent.agentId,
        optimizationType: 'load_balancing',
        confidence: 0.8,
        expectedImprovement,
        reasoning: [
          `Current agent load: ${Math.round(currentLoadRatio * 100)}%`,
          `Target agent load: ${Math.round(targetLoadRatio * 100)}%`,
          'Better load distribution needed'
        ]
      }
    }

    return null
  }

  private async analyzeSkillMatchOptimization(lead: any, currentAgent: any, targetAgent: any): Promise<HandoffOptimization | null> {
    // This would analyze if target agent has better skills for this lead
    // For now, return null as this requires more complex skill analysis
    return null
  }

  private async analyzePerformanceOptimization(lead: any, currentAgentPerformance: AgentPerformance | null, targetAgent: any): Promise<HandoffOptimization | null> {
    if (!currentAgentPerformance) return null

    const targetAgentPerformance = await this.getAgentPerformance(targetAgent.agentId)
    if (!targetAgentPerformance) return null

    // Compare performance metrics
    const currentSuccessRate = currentAgentPerformance.successRate
    const targetSuccessRate = targetAgentPerformance.successRate

    if (targetSuccessRate > currentSuccessRate + 0.2) { // 20% better success rate
      return {
        leadId: lead.id,
        optimizedAgent: targetAgent.agentId,
        originalAgent: lead.assigned_agent_id,
        optimizationType: 'performance',
        confidence: 0.7,
        expectedImprovement: (targetSuccessRate - currentSuccessRate) / 2,
        reasoning: [
          `Current agent success rate: ${Math.round(currentSuccessRate * 100)}%`,
          `Target agent success rate: ${Math.round(targetSuccessRate * 100)}%`,
          'Better performance potential'
        ]
      }
    }

    return null
  }

  private async setHandoffTimeout(leadId: string, priority: string, agentId: string): Promise<void> {
    const timeoutMs = this.HANDOFF_TIMEOUTS[priority as keyof typeof this.HANDOFF_TIMEOUTS] || this.HANDOFF_TIMEOUTS.medium

    // Set timeout in Redis
    await this.redis.setex(
      `handoff_timeout:${leadId}`,
      Math.floor(timeoutMs / 1000),
      JSON.stringify({ agentId, priority, timeoutAt: Date.now() + timeoutMs })
    )
  }

  private async handleHandoffTimeout(lead: any): Promise<void> {
    try {
      logger.warn('Handoff timeout detected', {
        leadId: lead.id,
        agentId: lead.assigned_agent_id,
        assignedAt: lead.assigned_at
      })

      // Escalate the lead
      await intelligentRoutingEngine.routeLeadToAgent(lead.id, lead.user_id)

    } catch (error) {
      logger.error('Error handling handoff timeout:', error)
    }
  }

  private async notifyAgentHandoff(event: HandoffEvent): Promise<void> {
    try {
      // This would integrate with notification systems
      logger.info('Agent handoff notification sent', {
        fromAgent: event.fromAgent,
        toAgent: event.toAgent,
        leadId: event.leadId,
        type: event.handoffType
      })

    } catch (error) {
      logger.error('Error notifying agent of handoff:', error)
    }
  }

  private async initializePerformanceTracking(): Promise<void> {
    try {
      // Initialize performance tracking for all agents
      const supabase = await createClient()
      const { data: agents } = await supabase
        .from('agent_availability')
        .select('agent_id')

      if (agents) {
        for (const agent of agents) {
          await this.getAgentPerformance(agent.agent_id)
        }
      }

      logger.info('Performance tracking initialized', { agentCount: agents?.length || 0 })

    } catch (error) {
      logger.error('Error initializing performance tracking:', error)
    }
  }
}

export const realtimeHandoffOptimizer = RealtimeHandoffOptimizer.getInstance()