/**
 * Intelligent Routing Engine
 * Makes smart routing decisions based on agent availability, skills, and lead priority
 */

import { priorityRoutingService, AgentAvailability, RoutingDecision, LeadPriority } from './priority-routing-service'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface RoutingConfig {
  maxWaitTime: number // Maximum wait time in minutes for critical leads
  skillMatching: boolean // Whether to match leads to agents with specific skills
  loadBalancing: boolean // Whether to distribute load evenly
  priorityEscalation: boolean // Whether to escalate waiting leads
  autoAssignment: boolean // Whether to automatically assign leads
}

export interface AgentSkill {
  agentId: string
  skills: string[]
  proficiency: Record<string, number> // Skill name -> proficiency level (1-10)
  specializations: string[]
}

export class IntelligentRoutingEngine {
  private static instance: IntelligentRoutingEngine
  private config: RoutingConfig
  private agentCache: Map<string, AgentAvailability> = new Map()
  private skillCache: Map<string, AgentSkill> = new Map()

  constructor() {
    this.config = {
      maxWaitTime: 5, // 5 minutes for critical leads
      skillMatching: true,
      loadBalancing: true,
      priorityEscalation: true,
      autoAssignment: true
    }
    this.initializeCaches()
  }

  static getInstance(): IntelligentRoutingEngine {
    if (!IntelligentRoutingEngine.instance) {
      IntelligentRoutingEngine.instance = new IntelligentRoutingEngine()
    }
    return IntelligentRoutingEngine.instance
  }

  /**
   * Make intelligent routing decision for a lead
   */
  async makeRoutingDecision(leadId: string, userId: string): Promise<RoutingDecision> {
    try {
      // Get lead priority information
      const leadPriority = await this.getLeadPriority(leadId, userId)
      if (!leadPriority) {
        throw new Error('Lead priority not found')
      }

      // Get available agents
      const availableAgents = await this.getAvailableAgents(userId)

      // Find best agent match
      const bestAgent = await this.findBestAgent(leadPriority, availableAgents)

      // Calculate estimated wait time
      const estimatedWaitTime = await this.calculateWaitTime(leadPriority.routingQueue, bestAgent.agentId)

      // Generate routing reasoning
      const reasoning = this.generateRoutingReasoning(leadPriority, bestAgent, availableAgents)

      const decision: RoutingDecision = {
        leadId,
        assignedAgent: bestAgent.agentId,
        queue: leadPriority.routingQueue,
        priority: leadPriority.priorityLevel,
        reasoning,
        confidence: this.calculateConfidence(leadPriority, bestAgent, availableAgents),
        estimatedWaitTime
      }

      // Log routing decision
      logger.info('Routing decision made', {
        leadId,
        assignedAgent: bestAgent.agentId,
        priority: leadPriority.priorityLevel,
        confidence: decision.confidence,
        estimatedWaitTime
      })

      return decision

    } catch (error) {
      logger.error('Error making routing decision:', error)
      throw error
    }
  }

  /**
   * Route lead to agent with real-time handoff
   */
  async routeLeadToAgent(leadId: string, userId: string): Promise<void> {
    try {
      const decision = await this.makeRoutingDecision(leadId, userId)

      const supabase = await createClient()

      // Update lead assignment
      await supabase
        .from('leads')
        .update({
          assigned_agent_id: decision.assignedAgent,
          status: 'assigned',
          assigned_at: new Date().toISOString()
        })
        .eq('id', leadId)

      // Create routing record
      await supabase
        .from('lead_routing_decisions')
        .insert({
          lead_id: leadId,
          assigned_agent_id: decision.assignedAgent,
          routing_queue: decision.queue,
          priority_level: decision.priority,
          reasoning: decision.reasoning,
          confidence_score: decision.confidence,
          estimated_wait_time: decision.estimatedWaitTime,
          created_at: new Date().toISOString()
        })

      // Remove from priority queue (now assigned)
      await priorityRoutingService.removeFromQueue(leadId, decision.queue)

      // Notify agent of new assignment
      await this.notifyAgent(decision.assignedAgent, leadId, decision.priority)

      logger.info('Lead routed to agent', {
        leadId,
        agentId: decision.assignedAgent,
        priority: decision.priority
      })

    } catch (error) {
      logger.error('Error routing lead to agent:', error)
      throw error
    }
  }

  /**
   * Process priority queue and route leads
   */
  async processPriorityQueues(userId: string): Promise<void> {
    try {
      const queueStats = await priorityRoutingService.getQueueStats()

      for (const [queueName, stats] of Object.entries(queueStats)) {
        if (stats.count > 0) {
          // Process leads in this queue
          await this.processQueue(queueName, userId)
        }
      }

    } catch (error) {
      logger.error('Error processing priority queues:', error)
    }
  }

  /**
   * Update agent availability
   */
  async updateAgentAvailability(agentId: string, availability: Partial<AgentAvailability>): Promise<void> {
    try {
      const current = this.agentCache.get(agentId) || {
        agentId,
        currentLoad: 0,
        maxCapacity: 10,
        skills: [],
        averageResponseTime: 30,
        isAvailable: true,
        lastActivity: new Date()
      }

      const updated = { ...current, ...availability }
      this.agentCache.set(agentId, updated)

      // Persist to database
      const supabase = await createClient()
      await supabase
        .from('agent_availability')
        .upsert({
          agent_id: agentId,
          current_load: updated.currentLoad,
          max_capacity: updated.maxCapacity,
          skills: updated.skills,
          average_response_time: updated.averageResponseTime,
          is_available: updated.isAvailable,
          last_activity: updated.lastActivity.toISOString(),
          updated_at: new Date().toISOString()
        })

      logger.info('Agent availability updated', { agentId, isAvailable: updated.isAvailable })

    } catch (error) {
      logger.error('Error updating agent availability:', error)
    }
  }

  /**
   * Get agent skills and specializations
   */
  async getAgentSkills(agentId: string): Promise<AgentSkill | null> {
    try {
      if (this.skillCache.has(agentId)) {
        return this.skillCache.get(agentId)!
      }

      const supabase = await createClient()
      const { data: skills } = await supabase
        .from('agent_skills')
        .select('*')
        .eq('agent_id', agentId)
        .single()

      if (skills) {
        this.skillCache.set(agentId, skills)
        return skills
      }

      return null

    } catch (error) {
      logger.error('Error getting agent skills:', error)
      return null
    }
  }

  /**
   * Escalate lead priority if waiting too long
   */
  async escalateLeadPriority(leadId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('priority_score, created_at')
        .eq('id', leadId)
        .single()

      if (!lead) return

      const waitTime = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60) // minutes

      // Escalate if waiting too long
      if (waitTime > 30) { // 30 minutes
        const newScore = Math.min(100, lead.priority_score + 10)
        await supabase
          .from('leads')
          .update({ priority_score: newScore })
          .eq('id', leadId)

        logger.info('Lead priority escalated', { leadId, oldScore: lead.priority_score, newScore })
      }

    } catch (error) {
      logger.error('Error escalating lead priority:', error)
    }
  }

  // Private helper methods

  private async getLeadPriority(leadId: string, userId: string): Promise<LeadPriority | null> {
    try {
      const supabase = await createClient()

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      if (!lead) return null

      // Calculate priority score if not already calculated
      if (!lead.priority_score) {
        await priorityRoutingService.calculatePriorityScore(leadId, userId)
      }

      const priorityScore = await priorityRoutingService.calculatePriorityScore(leadId, userId)
      const priorityLevel = priorityRoutingService.getPriorityLevel(priorityScore.overall)
      const routingQueue = priorityRoutingService.getRoutingQueue(priorityLevel)

      return {
        leadId,
        priorityScore,
        priorityLevel,
        routingQueue,
        estimatedValue: lead.estimated_value || 0,
        responseDeadline: new Date(Date.now() + (priorityLevel === 'critical' ? 5 * 60 * 1000 : 60 * 60 * 1000)), // 5 min for critical, 1 hour for others
        createdAt: new Date(lead.created_at)
      }

    } catch (error) {
      logger.error('Error getting lead priority:', error)
      return null
    }
  }

  private async getAvailableAgents(userId: string): Promise<AgentAvailability[]> {
    try {
      const supabase = await createClient()

      const { data: agents } = await supabase
        .from('agent_availability')
        .select('*')
        .eq('user_id', userId)
        .eq('is_available', true)
        .order('current_load', { ascending: true })

      return agents || []

    } catch (error) {
      logger.error('Error getting available agents:', error)
      return []
    }
  }

  private async findBestAgent(leadPriority: LeadPriority, availableAgents: AgentAvailability[]): Promise<AgentAvailability> {
    if (availableAgents.length === 0) {
      throw new Error('No agents available')
    }

    let bestAgent = availableAgents[0]
    let bestScore = 0

    for (const agent of availableAgents) {
      let score = 0

      // Load balancing - prefer agents with lower load
      if (this.config.loadBalancing) {
        const loadScore = (agent.maxCapacity - agent.currentLoad) / agent.maxCapacity
        score += loadScore * 40 // 40% weight for load balancing
      }

      // Skill matching
      if (this.config.skillMatching) {
        const skillScore = await this.calculateSkillMatch(leadPriority, agent)
        score += skillScore * 35 // 35% weight for skill matching
      }

      // Response time
      const responseTimeScore = (60 - agent.averageResponseTime) / 60
      score += responseTimeScore * 25 // 25% weight for response time

      if (score > bestScore) {
        bestScore = score
        bestAgent = agent
      }
    }

    return bestAgent
  }

  private async calculateSkillMatch(leadPriority: LeadPriority, agent: AgentAvailability): Promise<number> {
    const agentSkills = await this.getAgentSkills(agent.agentId)
    if (!agentSkills) return 0.5 // Default match score

    // This would analyze lead requirements vs agent skills
    // For now, return a default score
    return 0.7
  }

  private async calculateWaitTime(queueName: string, agentId: string): Promise<number> {
    // Calculate estimated wait time based on queue length and agent capacity
    const queueStats = await priorityRoutingService.getQueueStats()
    const queueInfo = queueStats[queueName as keyof typeof queueStats]

    if (!queueInfo || queueInfo.count === 0) return 0

    const agent = this.agentCache.get(agentId)
    if (!agent) return 5 // Default 5 minutes

    return Math.ceil(queueInfo.count / (agent.maxCapacity - agent.currentLoad))
  }

  private generateRoutingReasoning(leadPriority: LeadPriority, bestAgent: AgentAvailability, availableAgents: AgentAvailability[]): string[] {
    const reasoning: string[] = []

    reasoning.push(`Priority level: ${leadPriority.priorityLevel} (${leadPriority.priorityScore.overall}/100)`)
    reasoning.push(`Business value score: ${leadPriority.priorityScore.businessValue}/100`)
    reasoning.push(`Urgency score: ${leadPriority.priorityScore.urgency}/100`)
    reasoning.push(`Time sensitivity score: ${leadPriority.priorityScore.timeSensitivity}/100`)

    if (availableAgents.length > 1) {
      reasoning.push(`Selected from ${availableAgents.length} available agents`)
    }

    reasoning.push(`Agent current load: ${bestAgent.currentLoad}/${bestAgent.maxCapacity}`)
    reasoning.push(`Agent average response time: ${bestAgent.averageResponseTime} minutes`)

    return reasoning
  }

  private calculateConfidence(leadPriority: LeadPriority, bestAgent: AgentAvailability, availableAgents: AgentAvailability[]): number {
    let confidence = 0.5 // Base confidence

    // High confidence if priority is clear
    if (leadPriority.priorityScore.overall >= 90) confidence += 0.2
    else if (leadPriority.priorityScore.overall >= 75) confidence += 0.1

    // High confidence if agent has low load
    if (bestAgent.currentLoad / bestAgent.maxCapacity < 0.5) confidence += 0.2

    // High confidence if many agents available
    if (availableAgents.length > 3) confidence += 0.1

    return Math.min(1, confidence)
  }

  private async processQueue(queueName: string, userId: string): Promise<void> {
    const leadId = await priorityRoutingService.getNextFromQueue(queueName)

    if (leadId) {
      try {
        await this.routeLeadToAgent(leadId, userId)
      } catch (error) {
        logger.error('Error processing lead from queue:', { leadId, queueName, error })
      }
    }
  }

  private async notifyAgent(agentId: string, leadId: string, priority: string): Promise<void> {
    try {
      // This would integrate with notification systems (email, SMS, in-app notifications)
      logger.info('Agent notification sent', { agentId, leadId, priority })

    } catch (error) {
      logger.error('Error notifying agent:', error)
    }
  }

  private async initializeCaches(): Promise<void> {
    try {
      // Initialize agent cache
      const supabase = await createClient()
      const { data: agents } = await supabase
        .from('agent_availability')
        .select('*')

      if (agents) {
        for (const agent of agents) {
          this.agentCache.set(agent.agent_id, agent)
        }
      }

      logger.info('Agent caches initialized', { count: this.agentCache.size })

    } catch (error) {
      logger.error('Error initializing caches:', error)
    }
  }
}

export const intelligentRoutingEngine = IntelligentRoutingEngine.getInstance()