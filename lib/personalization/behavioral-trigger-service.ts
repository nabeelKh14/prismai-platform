/**
 * Behavioral Trigger Service
 * Manages behavioral triggers and executes actions based on lead behavior patterns
 */

import { createClient } from '@/lib/supabase/server'
import { geminiClient } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'

export interface BehavioralTrigger {
  id: string
  userId: string
  name: string
  description: string
  triggerType: 'behavior' | 'score_change' | 'engagement' | 'time_based' | 'custom'
  conditions: TriggerCondition[]
  actions: TriggerAction[]
  priority: number
  cooldownMinutes: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface TriggerCondition {
  type: 'behavior_type' | 'lead_score' | 'engagement_score' | 'time_elapsed' | 'custom'
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains'
  value: any
  field?: string // For custom conditions
}

export interface TriggerAction {
  type: 'send_message' | 'update_sequence' | 'create_task' | 'update_lead' | 'trigger_workflow' | 'send_webhook'
  parameters: Record<string, any>
  delay?: number // minutes
  channel?: string
}

export interface TriggerExecution {
  id: string
  triggerId: string
  leadId: string
  conditionsMet: Record<string, boolean>
  actionsExecuted: TriggerAction[]
  executionTime: number
  success: boolean
  errorMessage?: string
  createdAt: Date
}

export class BehavioralTriggerService {
  private static instance: BehavioralTriggerService
  private activeTriggers: Map<string, BehavioralTrigger[]> = new Map()
  private cooldownCache: Map<string, Date> = new Map() // leadId:triggerId -> last execution time

  constructor() {}

  static getInstance(): BehavioralTriggerService {
    if (!BehavioralTriggerService.instance) {
      BehavioralTriggerService.instance = new BehavioralTriggerService()
    }
    return BehavioralTriggerService.instance
  }

  /**
   * Initialize trigger service for a user
   */
  async initialize(userId: string): Promise<void> {
    try {
      logger.info('Initializing behavioral trigger service', { userId })

      // Load active triggers
      await this.loadActiveTriggers(userId)

      logger.info('Behavioral trigger service initialized', { userId })
    } catch (error) {
      logger.error('Error initializing behavioral trigger service', error as Error, { userId })
      throw error
    }
  }

  /**
   * Process lead behavior and check for trigger matches
   */
  async processLeadBehavior(
    leadId: string,
    behaviorType: string,
    behaviorData: Record<string, any>,
    userId: string
  ): Promise<TriggerExecution[]> {
    try {
      const executions: TriggerExecution[] = []

      // Get user triggers
      const triggers = this.activeTriggers.get(userId) || []

      for (const trigger of triggers) {
        // Check cooldown
        if (this.isInCooldown(leadId, trigger.id)) {
          continue
        }

        // Evaluate trigger conditions
        const conditionsMet = await this.evaluateTriggerConditions(trigger, leadId, behaviorType, behaviorData, userId)

        // Check if all conditions are met
        const allConditionsMet = Object.values(conditionsMet).every(met => met)

        if (allConditionsMet) {
          // Execute trigger actions
          const execution = await this.executeTrigger(trigger, leadId, conditionsMet, userId)
          executions.push(execution)

          // Set cooldown
          this.setCooldown(leadId, trigger.id, trigger.cooldownMinutes)
        }
      }

      return executions
    } catch (error) {
      logger.error('Error processing lead behavior', error as Error, { leadId, behaviorType })
      return []
    }
  }

  /**
   * Process lead score changes and check for triggers
   */
  async processLeadScoreChange(
    leadId: string,
    oldScore: number,
    newScore: number,
    userId: string
  ): Promise<TriggerExecution[]> {
    try {
      const executions: TriggerExecution[] = []

      // Get user triggers
      const triggers = this.activeTriggers.get(userId) || []

      for (const trigger of triggers) {
        if (trigger.triggerType !== 'score_change') continue

        // Check cooldown
        if (this.isInCooldown(leadId, trigger.id)) {
          continue
        }

        // Evaluate score change conditions
        const conditionsMet = await this.evaluateScoreChangeConditions(trigger, leadId, oldScore, newScore, userId)

        // Check if all conditions are met
        const allConditionsMet = Object.values(conditionsMet).every(met => met)

        if (allConditionsMet) {
          // Execute trigger actions
          const execution = await this.executeTrigger(trigger, leadId, conditionsMet, userId)
          executions.push(execution)

          // Set cooldown
          this.setCooldown(leadId, trigger.id, trigger.cooldownMinutes)
        }
      }

      return executions
    } catch (error) {
      logger.error('Error processing lead score change', error as Error, { leadId, oldScore, newScore })
      return []
    }
  }

  /**
   * Process time-based triggers
   */
  async processTimeBasedTriggers(userId: string): Promise<TriggerExecution[]> {
    try {
      const executions: TriggerExecution[] = []

      // Get user triggers
      const triggers = this.activeTriggers.get(userId) || []

      for (const trigger of triggers) {
        if (trigger.triggerType !== 'time_based') continue

        // Get leads that match time-based conditions
        const matchingLeads = await this.findMatchingLeadsForTimeTrigger(trigger, userId)

        for (const leadId of matchingLeads) {
          // Check cooldown
          if (this.isInCooldown(leadId, trigger.id)) {
            continue
          }

          // Evaluate time-based conditions
          const conditionsMet = await this.evaluateTimeBasedConditions(trigger, leadId, userId)

          // Check if all conditions are met
          const allConditionsMet = Object.values(conditionsMet).every(met => met)

          if (allConditionsMet) {
            // Execute trigger actions
            const execution = await this.executeTrigger(trigger, leadId, conditionsMet, userId)
            executions.push(execution)

            // Set cooldown
            this.setCooldown(leadId, trigger.id, trigger.cooldownMinutes)
          }
        }
      }

      return executions
    } catch (error) {
      logger.error('Error processing time-based triggers', error as Error, { userId })
      return []
    }
  }

  /**
   * Create a new behavioral trigger
   */
  async createTrigger(
    userId: string,
    triggerData: Omit<BehavioralTrigger, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<BehavioralTrigger> {
    try {
      const supabase = await createClient()

      const trigger: BehavioralTrigger = {
        ...triggerData,
        id: crypto.randomUUID(),
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Store in database
      const { data, error } = await supabase
        .from('behavioral_triggers')
        .insert({
          id: trigger.id,
          user_id: userId,
          name: trigger.name,
          description: trigger.description,
          trigger_type: trigger.triggerType,
          conditions: trigger.conditions,
          actions: trigger.actions,
          priority: trigger.priority,
          cooldown_minutes: trigger.cooldownMinutes,
          is_active: trigger.isActive,
          created_at: trigger.createdAt,
          updated_at: trigger.updatedAt
        })
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to create trigger: ${error.message}`)
      }

      // Update cache
      const userTriggers = this.activeTriggers.get(userId) || []
      userTriggers.push(trigger)
      this.activeTriggers.set(userId, userTriggers)

      logger.info('Created behavioral trigger', { triggerId: trigger.id, userId })

      return trigger
    } catch (error) {
      logger.error('Error creating behavioral trigger', error as Error, { userId })
      throw error
    }
  }

  /**
   * Update an existing trigger
   */
  async updateTrigger(
    triggerId: string,
    userId: string,
    updates: Partial<Omit<BehavioralTrigger, 'id' | 'userId' | 'createdAt'>>
  ): Promise<BehavioralTrigger> {
    try {
      const supabase = await createClient()

      // Update in database
      const { data, error } = await supabase
        .from('behavioral_triggers')
        .update({
          ...updates,
          updated_at: new Date()
        })
        .eq('id', triggerId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to update trigger: ${error.message}`)
      }

      // Update cache
      const userTriggers = this.activeTriggers.get(userId) || []
      const triggerIndex = userTriggers.findIndex(t => t.id === triggerId)

      if (triggerIndex !== -1) {
        userTriggers[triggerIndex] = { ...userTriggers[triggerIndex], ...updates, updatedAt: new Date() }
        this.activeTriggers.set(userId, userTriggers)
      }

      logger.info('Updated behavioral trigger', { triggerId, userId })

      return userTriggers[triggerIndex]
    } catch (error) {
      logger.error('Error updating behavioral trigger', error as Error, { triggerId, userId })
      throw error
    }
  }

  /**
   * Delete a trigger
   */
  async deleteTrigger(triggerId: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Delete from database
      const { error } = await supabase
        .from('behavioral_triggers')
        .delete()
        .eq('id', triggerId)
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to delete trigger: ${error.message}`)
      }

      // Update cache
      const userTriggers = this.activeTriggers.get(userId) || []
      const filteredTriggers = userTriggers.filter(t => t.id !== triggerId)
      this.activeTriggers.set(userId, filteredTriggers)

      logger.info('Deleted behavioral trigger', { triggerId, userId })
    } catch (error) {
      logger.error('Error deleting behavioral trigger', error as Error, { triggerId, userId })
      throw error
    }
  }

  /**
   * Get all triggers for a user
   */
  async getUserTriggers(userId: string): Promise<BehavioralTrigger[]> {
    return this.activeTriggers.get(userId) || []
  }

  // Private helper methods

  private async loadActiveTriggers(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: triggers } = await supabase
        .from('behavioral_triggers')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('priority', { ascending: false })

      const formattedTriggers: BehavioralTrigger[] = (triggers || []).map(trigger => ({
        id: trigger.id,
        userId: trigger.user_id,
        name: trigger.name,
        description: trigger.description,
        triggerType: trigger.trigger_type,
        conditions: trigger.conditions,
        actions: trigger.actions,
        priority: trigger.priority,
        cooldownMinutes: trigger.cooldown_minutes,
        isActive: trigger.is_active,
        createdAt: new Date(trigger.created_at),
        updatedAt: new Date(trigger.updated_at)
      }))

      this.activeTriggers.set(userId, formattedTriggers)

      logger.info('Loaded active triggers', { count: formattedTriggers.length, userId })
    } catch (error) {
      logger.error('Error loading active triggers', error as Error, { userId })
    }
  }

  private isInCooldown(leadId: string, triggerId: string): boolean {
    const cooldownKey = `${leadId}:${triggerId}`
    const lastExecution = this.cooldownCache.get(cooldownKey)

    if (!lastExecution) return false

    const cooldownEnd = new Date(lastExecution.getTime() + 60 * 1000) // Convert minutes to milliseconds
    return new Date() < cooldownEnd
  }

  private setCooldown(leadId: string, triggerId: string, cooldownMinutes: number): void {
    const cooldownKey = `${leadId}:${triggerId}`
    const cooldownEnd = new Date(Date.now() + cooldownMinutes * 60 * 1000)
    this.cooldownCache.set(cooldownKey, cooldownEnd)
  }

  private async evaluateTriggerConditions(
    trigger: BehavioralTrigger,
    leadId: string,
    behaviorType: string,
    behaviorData: Record<string, any>,
    userId: string
  ): Promise<Record<string, boolean>> {
    const conditionsMet: Record<string, boolean> = {}

    for (const condition of trigger.conditions) {
      const met = await this.evaluateCondition(condition, leadId, behaviorType, behaviorData, userId)
      conditionsMet[condition.type] = met
    }

    return conditionsMet
  }

  private async evaluateCondition(
    condition: TriggerCondition,
    leadId: string,
    behaviorType: string,
    behaviorData: Record<string, any>,
    userId: string
  ): Promise<boolean> {
    try {
      const supabase = await createClient()

      switch (condition.type) {
        case 'behavior_type':
          return this.evaluateConditionValue(behaviorType, condition.operator, condition.value)

        case 'lead_score':
          const { data: lead } = await supabase
            .from('leads')
            .select('lead_score')
            .eq('id', leadId)
            .single()

          if (!lead) return false

          return this.evaluateConditionValue(lead.lead_score || 0, condition.operator, condition.value)

        case 'engagement_score':
          const { data: engagement } = await supabase
            .from('lead_engagement')
            .select('engagement_score')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          const engagementScore = engagement?.engagement_score || 0
          return this.evaluateConditionValue(engagementScore, condition.operator, condition.value)

        case 'time_elapsed':
          // Check time since last interaction
          const { data: lastActivity } = await supabase
            .from('lead_activities')
            .select('created_at')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (!lastActivity) return false

          const lastActivityTime = new Date(lastActivity.created_at)
          const elapsedMinutes = (Date.now() - lastActivityTime.getTime()) / (1000 * 60)

          return this.evaluateConditionValue(elapsedMinutes, condition.operator, condition.value)

        case 'custom':
          // Evaluate custom field condition
          if (condition.field) {
            const { data: lead } = await supabase
              .from('leads')
              .select(condition.field)
              .eq('id', leadId)
              .single()

            if (!lead) return false

            const fieldValue = lead[condition.field as keyof typeof lead]
            return this.evaluateConditionValue(fieldValue, condition.operator, condition.value)
          }

          return false

        default:
          return false
      }
    } catch (error) {
      logger.error('Error evaluating trigger condition', error as Error, {
        leadId,
        conditionType: condition.type
      })
      return false
    }
  }

  private evaluateConditionValue(value: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return value === expected
      case 'greater_than':
        return Number(value) > Number(expected)
      case 'less_than':
        return Number(value) < Number(expected)
      case 'contains':
        return String(value).toLowerCase().includes(String(expected).toLowerCase())
      case 'not_contains':
        return !String(value).toLowerCase().includes(String(expected).toLowerCase())
      default:
        return false
    }
  }

  private async evaluateScoreChangeConditions(
    trigger: BehavioralTrigger,
    leadId: string,
    oldScore: number,
    newScore: number,
    userId: string
  ): Promise<Record<string, boolean>> {
    const conditionsMet: Record<string, boolean> = {}

    for (const condition of trigger.conditions) {
      let met = false

      switch (condition.type) {
        case 'lead_score':
          if (condition.operator === 'greater_than') {
            met = newScore > condition.value && oldScore <= condition.value
          } else if (condition.operator === 'less_than') {
            met = newScore < condition.value && oldScore >= condition.value
          } else {
            met = this.evaluateConditionValue(newScore, condition.operator, condition.value)
          }
          break

        default:
          met = await this.evaluateCondition(condition, leadId, '', {}, userId)
      }

      conditionsMet[condition.type] = met
    }

    return conditionsMet
  }

  private async evaluateTimeBasedConditions(
    trigger: BehavioralTrigger,
    leadId: string,
    userId: string
  ): Promise<Record<string, boolean>> {
    const conditionsMet: Record<string, boolean> = {}

    for (const condition of trigger.conditions) {
      const met = await this.evaluateCondition(condition, leadId, '', {}, userId)
      conditionsMet[condition.type] = met
    }

    return conditionsMet
  }

  private async findMatchingLeadsForTimeTrigger(trigger: BehavioralTrigger, userId: string): Promise<string[]> {
    try {
      const supabase = await createClient()

      // This would be a complex query based on trigger conditions
      // For now, return leads that haven't been active recently
      const { data: leads } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        // Add more filtering based on trigger conditions

      return leads?.map(l => l.id) || []
    } catch (error) {
      logger.error('Error finding matching leads for time trigger', error as Error, { triggerId: trigger.id })
      return []
    }
  }

  private async executeTrigger(
    trigger: BehavioralTrigger,
    leadId: string,
    conditionsMet: Record<string, boolean>,
    userId: string
  ): Promise<TriggerExecution> {
    const startTime = Date.now()
    const execution: TriggerExecution = {
      id: crypto.randomUUID(),
      triggerId: trigger.id,
      leadId,
      conditionsMet,
      actionsExecuted: [],
      executionTime: 0,
      success: true,
      createdAt: new Date()
    }

    try {
      // Execute each action
      for (const action of trigger.actions) {
        try {
          await this.executeAction(action, leadId, userId)
          execution.actionsExecuted.push(action)
        } catch (error) {
          logger.error('Error executing trigger action', error as Error, {
            triggerId: trigger.id,
            leadId,
            actionType: action.type
          })
          execution.success = false
          execution.errorMessage = `Failed to execute action: ${action.type}`
        }
      }

      execution.executionTime = Date.now() - startTime

      // Log execution
      await this.logTriggerExecution(execution, userId)

      logger.info('Executed behavioral trigger', {
        triggerId: trigger.id,
        leadId,
        actionsExecuted: execution.actionsExecuted.length,
        success: execution.success
      })

    } catch (error) {
      execution.executionTime = Date.now() - startTime
      execution.success = false
      execution.errorMessage = error instanceof Error ? error.message : 'Unknown error'

      logger.error('Error executing trigger', error as Error, { triggerId: trigger.id, leadId })
    }

    return execution
  }

  private async executeAction(action: TriggerAction, leadId: string, userId: string): Promise<void> {
    // Add delay if specified
    if (action.delay && action.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, action.delay! * 60 * 1000))
    }

    switch (action.type) {
      case 'send_message':
        await this.sendTriggeredMessage(leadId, action, userId)
        break
      case 'update_sequence':
        await this.updateSequenceFromTrigger(leadId, action, userId)
        break
      case 'create_task':
        await this.createTriggeredTask(leadId, action, userId)
        break
      case 'update_lead':
        await this.updateLeadFromTrigger(leadId, action, userId)
        break
      case 'trigger_workflow':
        await this.triggerWorkflowFromAction(leadId, action, userId)
        break
      case 'send_webhook':
        await this.sendWebhookFromAction(leadId, action, userId)
        break
      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  }

  private async sendTriggeredMessage(leadId: string, action: TriggerAction, userId: string): Promise<void> {
    // Implementation for sending triggered message
    logger.info('Sending triggered message', { leadId, channel: action.channel, parameters: action.parameters })
    // Would integrate with messaging service
  }

  private async updateSequenceFromTrigger(leadId: string, action: TriggerAction, userId: string): Promise<void> {
    // Implementation for updating sequence from trigger
    logger.info('Updating sequence from trigger', { leadId, parameters: action.parameters })
    // Would update nurturing sequence
  }

  private async createTriggeredTask(leadId: string, action: TriggerAction, userId: string): Promise<void> {
    // Implementation for creating triggered task
    logger.info('Creating triggered task', { leadId, parameters: action.parameters })
    // Would create task in task management system
  }

  private async updateLeadFromTrigger(leadId: string, action: TriggerAction, userId: string): Promise<void> {
    // Implementation for updating lead from trigger
    logger.info('Updating lead from trigger', { leadId, parameters: action.parameters })
    // Would update lead properties
  }

  private async triggerWorkflowFromAction(leadId: string, action: TriggerAction, userId: string): Promise<void> {
    // Implementation for triggering workflow from action
    logger.info('Triggering workflow from action', { leadId, parameters: action.parameters })
    // Would trigger workflow engine
  }

  private async sendWebhookFromAction(leadId: string, action: TriggerAction, userId: string): Promise<void> {
    // Implementation for sending webhook from action
    logger.info('Sending webhook from action', { leadId, parameters: action.parameters })
    // Would send HTTP webhook
  }

  private async logTriggerExecution(execution: TriggerExecution, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('trigger_executions')
        .insert({
          id: execution.id,
          trigger_id: execution.triggerId,
          lead_id: execution.leadId,
          conditions_met: execution.conditionsMet,
          actions_executed: execution.actionsExecuted,
          execution_time_ms: execution.executionTime,
          success: execution.success,
          error_message: execution.errorMessage,
          created_at: execution.createdAt
        })
    } catch (error) {
      logger.error('Error logging trigger execution', error as Error, { executionId: execution.id })
    }
  }
}

export const behavioralTriggerService = BehavioralTriggerService.getInstance()