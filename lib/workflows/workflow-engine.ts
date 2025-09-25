/**
 * Advanced Workflow Engine
 * Handles execution of nurturing workflows with conditional branching and time-based triggers
 */

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { EnhancedLeadScoringEngine } from '@/lib/mcp/enhanced-lead-scoring'

export interface WorkflowStep {
  id: string
  type: 'email' | 'wait' | 'condition' | 'action' | 'webhook'
  name: string
  config: any
  nextSteps: string[] // IDs of next steps
  conditions?: WorkflowCondition[]
}

export interface WorkflowCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains'
  value: any
  logic?: 'and' | 'or'
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  leadId: string
  currentStep: number
  status: 'running' | 'completed' | 'failed' | 'paused'
  executionData: any
  startedAt: Date
  completedAt?: Date
  nextExecutionAt?: Date
}

export class WorkflowEngine {
  private static instance: WorkflowEngine

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine()
    }
    return WorkflowEngine.instance
  }

  /**
   * Start workflow execution for a lead
   */
  async startWorkflow(workflowId: string, leadId: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Get workflow details
      const { data: workflow } = await supabase
        .from('lead_workflows')
        .select('*')
        .eq('id', workflowId)
        .eq('user_id', userId)
        .single()

      if (!workflow) {
        throw new Error('Workflow not found')
      }

      // Create execution record
      const { data: execution, error } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_id: workflowId,
          lead_id: leadId,
          execution_data: {
            started_at: new Date().toISOString(),
            current_step_id: null,
            step_history: []
          }
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      // Start executing the first step
      await this.executeNextStep(execution.id, userId)

    } catch (error) {
      logger.error('Error starting workflow:', error)
    }
  }

  /**
   * Execute the next step in a workflow
   */
  async executeNextStep(executionId: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Get execution details
      const { data: execution } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          lead_workflows(*),
          leads(*)
        `)
        .eq('id', executionId)
        .single()

      if (!execution) {
        throw new Error('Execution not found')
      }

      const workflow = execution.lead_workflows
      const lead = execution.leads
      const steps = workflow.workflow_steps as WorkflowStep[]
      const executionData = execution.execution_data || {}

      // Determine next step
      let nextStepId = executionData.current_step_id

      if (!nextStepId) {
        // Start with first step
        nextStepId = steps[0]?.id
      } else {
        // Find current step and get next steps
        const currentStep = steps.find(s => s.id === nextStepId)
        if (currentStep) {
          nextStepId = await this.evaluateStepConditions(currentStep, lead, userId)
        }
      }

      if (!nextStepId) {
        // Workflow completed
        await supabase
          .from('workflow_executions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            execution_data: {
              ...executionData,
              completed_at: new Date().toISOString()
            }
          })
          .eq('id', executionId)

        return
      }

      // Execute the step
      const step = steps.find(s => s.id === nextStepId)
      if (step) {
        await this.executeStep(step, lead, workflow, userId)

        // Update execution data
        const updatedExecutionData = {
          ...executionData,
          current_step_id: nextStepId,
          step_history: [
            ...(executionData.step_history || []),
            {
              step_id: nextStepId,
              executed_at: new Date().toISOString(),
              step_type: step.type
            }
          ]
        }

        // Calculate next execution time
        let nextExecutionAt = null
        if (step.type === 'wait') {
          const waitDays = step.config.days || 0
          const waitHours = step.config.hours || 0
          nextExecutionAt = new Date(Date.now() + (waitDays * 24 + waitHours) * 60 * 60 * 1000).toISOString()
        }

        await supabase
          .from('workflow_executions')
          .update({
            current_step: steps.findIndex(s => s.id === nextStepId),
            execution_data: updatedExecutionData,
            next_execution_at: nextExecutionAt
          })
          .eq('id', executionId)

        // Schedule next execution if wait step
        if (nextExecutionAt) {
          // In production, this would use a job queue
          setTimeout(() => {
            this.executeNextStep(executionId, userId)
          }, (new Date(nextExecutionAt).getTime() - Date.now()))
        } else {
          // Execute next step immediately
          await this.executeNextStep(executionId, userId)
        }
      }

    } catch (error) {
      logger.error('Error executing workflow step:', error)

      // Mark execution as failed
      const supabase = await createClient()
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          execution_data: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
        .eq('id', executionId)
    }
  }

  /**
   * Evaluate conditions for a step and determine next step
   */
  private async evaluateStepConditions(step: WorkflowStep, lead: any, userId: string): Promise<string | null> {
    if (!step.conditions || step.conditions.length === 0) {
      // No conditions, use first next step
      return step.nextSteps[0] || null
    }

    // Evaluate all conditions
    let conditionMet = false

    for (const condition of step.conditions) {
      const fieldValue = await this.getFieldValue(condition.field, lead, userId)
      const conditionResult = this.evaluateCondition(fieldValue, condition.operator, condition.value)

      if (condition.logic === 'or') {
        if (conditionResult) {
          conditionMet = true
          break
        }
      } else {
        // AND logic (default)
        if (!conditionResult) {
          conditionMet = false
          break
        }
        conditionMet = true
      }
    }

    // Return appropriate next step based on condition result
    if (conditionMet) {
      return step.nextSteps[0] || null // True path
    } else {
      return step.nextSteps[1] || null // False path
    }
  }

  /**
   * Get field value from lead data
   */
  private async getFieldValue(field: string, lead: any, userId: string): Promise<any> {
    switch (field) {
      case 'lead_score':
        return lead.lead_score
      case 'engagement_score':
        return lead.engagement_score
      case 'status':
        return lead.status
      case 'company':
        return lead.company
      case 'job_title':
        return lead.job_title
      case 'tags':
        return lead.tags
      case 'days_since_created':
        return Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
      case 'last_engagement_days':
        if (!lead.last_engagement_at) return null
        return Math.floor((Date.now() - new Date(lead.last_engagement_at).getTime()) / (1000 * 60 * 60 * 24))
      default:
        // Check custom fields
        return lead.custom_fields?.[field] || null
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue
      case 'not_equals':
        return fieldValue !== expectedValue
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue)
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue)
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase())
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase())
      default:
        return false
    }
  }

  /**
   * Execute a workflow step
   */
  private async executeStep(step: WorkflowStep, lead: any, workflow: any, userId: string): Promise<void> {
    const supabase = await createClient()

    try {
      switch (step.type) {
        case 'email':
          await this.executeEmailStep(step, lead, userId)
          break
        case 'action':
          await this.executeActionStep(step, lead, userId)
          break
        case 'webhook':
          await this.executeWebhookStep(step, lead, userId)
          break
        case 'wait':
          // Wait step - just log it
          await supabase
            .from('lead_activities')
            .insert({
              lead_id: lead.id,
              type: 'workflow_wait',
              description: `Workflow "${workflow.name}": Waiting ${step.config.days || 0} days, ${step.config.hours || 0} hours`,
              metadata: { workflowId: workflow.id, stepId: step.id, stepConfig: step.config }
            })
          break
        default:
          logger.warn(`Unknown step type: ${step.type}`)
      }
    } catch (error) {
      logger.error(`Error executing step ${step.id}:`, error)
      throw error
    }
  }

  /**
   * Execute email step
   */
  private async executeEmailStep(step: WorkflowStep, lead: any, userId: string): Promise<void> {
    const supabase = await createClient()

    // In production, this would integrate with an email service
    // For now, just log the email action
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: lead.id,
        type: 'email_sent',
        description: `Workflow email: ${step.config.subject || 'No subject'}`,
        metadata: {
          stepId: step.id,
          emailConfig: step.config,
          recipient: lead.email
        }
      })

    // Log engagement
    await supabase
      .from('lead_engagement')
      .insert({
        lead_id: lead.id,
        channel: 'email',
        engagement_type: 'send',
        content_id: step.id,
        metadata: { workflowStep: true, stepConfig: step.config }
      })
  }

  /**
   * Execute action step
   */
  private async executeActionStep(step: WorkflowStep, lead: any, userId: string): Promise<void> {
    const supabase = await createClient()

    switch (step.config.action) {
      case 'update_score':
        // Update lead score
        const newScore = Math.max(0, Math.min(100, lead.lead_score + (step.config.scoreChange || 0)))
        await supabase
          .from('leads')
          .update({
            lead_score: newScore,
            predictive_score: newScore
          })
          .eq('user_id', userId)
          .eq('id', lead.id)
        break

      case 'change_status':
        // Update lead status
        await supabase
          .from('leads')
          .update({ status: step.config.newStatus })
          .eq('user_id', userId)
          .eq('id', lead.id)
        break

      case 'add_tag':
        // Add tag to lead
        const currentTags = lead.tags || []
        if (!currentTags.includes(step.config.tag)) {
          await supabase
            .from('leads')
            .update({ tags: [...currentTags, step.config.tag] })
            .eq('user_id', userId)
            .eq('id', lead.id)
        }
        break

      default:
        logger.warn(`Unknown action: ${step.config.action}`)
    }

    // Log the action
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: lead.id,
        type: 'workflow_action',
        description: `Workflow action: ${step.config.action}`,
        metadata: { stepId: step.id, actionConfig: step.config }
      })
  }

  /**
   * Execute webhook step
   */
  private async executeWebhookStep(step: WorkflowStep, lead: any, userId: string): Promise<void> {
    try {
      const response = await fetch(step.config.url, {
        method: step.config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...step.config.headers
        },
        body: JSON.stringify({
          lead,
          workflow: { id: step.config.workflowId },
          step: { id: step.id },
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`)
      }

      // Log successful webhook
      const supabase = await createClient()
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: lead.id,
          type: 'webhook_sent',
          description: `Workflow webhook: ${step.config.url}`,
          metadata: { stepId: step.id, webhookConfig: step.config, responseStatus: response.status }
        })

    } catch (error) {
      logger.error('Webhook execution failed:', error)
      throw error
    }
  }

  /**
   * Process time-based triggers
   */
  async processTimeBasedTriggers(): Promise<void> {
    try {
      const supabase = await createClient()

      // Find executions that are due for next step
      const { data: dueExecutions } = await supabase
        .from('workflow_executions')
        .select('id, lead_workflows(user_id)')
        .eq('status', 'running')
        .not('next_execution_at', 'is', null)
        .lte('next_execution_at', new Date().toISOString())

      for (const execution of dueExecutions || []) {
        await this.executeNextStep(execution.id, (execution.lead_workflows as any)?.[0]?.user_id)
      }

    } catch (error) {
      logger.error('Error processing time-based triggers:', error)
    }
  }
}

export const workflowEngine = WorkflowEngine.getInstance()