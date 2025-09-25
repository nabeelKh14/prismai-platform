import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError } from "@/lib/errors"

// Validation schemas
const escalationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  conditions: z.object({
    sentiment_score: z.object({
      operator: z.enum(['<', '>', '<=', '>=', '=']),
      value: z.number().min(-1).max(1)
    }).optional(),
    keywords: z.array(z.string()).optional(),
    message_count: z.object({
      operator: z.enum(['<', '>', '<=', '>=', '=']),
      value: z.number().min(1)
    }).optional(),
    time_elapsed: z.object({
      operator: z.enum(['<', '>', '<=', '>=', '=']),
      value: z.number().min(1), // minutes
      unit: z.enum(['minutes', 'hours']).default('minutes')
    }).optional(),
    urgency: z.enum(['low', 'medium', 'high']).optional(),
    channel: z.enum(['website', 'whatsapp', 'sms', 'messenger', 'slack']).optional()
  }),
  actions: z.array(z.object({
    type: z.enum(['escalate', 'notify_agent', 'notify_supervisor', 'assign_agent', 'update_priority', 'add_tags']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    message: z.string().optional(),
    agent_id: z.string().uuid().optional(),
    tags: z.array(z.string()).optional()
  })),
  priority: z.number().min(1).max(100).default(1),
  is_active: z.boolean().default(true)
})

const checkEscalationSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().optional(),
  sentiment: z.object({
    score: z.number().min(-1).max(1),
    urgency: z.enum(['low', 'medium', 'high'])
  }).optional()
})

// Escalation Rules Engine
class EscalationEngine {
  static async evaluateRules(
    conversationId: string,
    context: {
      message?: string
      sentiment?: { score: number; urgency: string }
      messageCount?: number
      timeElapsed?: number
      channel?: string
    }
  ): Promise<{
    shouldEscalate: boolean
    rule?: any
    actions: any[]
    reason: string
  }> {
    const supabase = await createClient()

    // Get active escalation rules
    const { data: rules } = await supabase
      .from('escalation_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (!rules?.length) {
      return { shouldEscalate: false, actions: [], reason: 'No active rules' }
    }

    // Get conversation details
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    if (!conversation) {
      return { shouldEscalate: false, actions: [], reason: 'Conversation not found' }
    }

    // Get message count
    const { count: messageCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)

    // Calculate time elapsed since conversation started
    const timeElapsed = conversation.created_at
      ? (Date.now() - new Date(conversation.created_at).getTime()) / (1000 * 60) // minutes
      : 0

    // Evaluate each rule
    for (const rule of rules) {
      const conditions = rule.conditions || {}
      let ruleMatches = true
      const reasons: string[] = []

      // Check sentiment condition
      if (conditions.sentiment_score && context.sentiment) {
        const { operator, value } = conditions.sentiment_score
        const matches = this.evaluateCondition(context.sentiment.score, operator, value)
        if (!matches) {
          ruleMatches = false
        } else {
          reasons.push(`Sentiment ${operator} ${value}`)
        }
      }

      // Check keywords condition
      if (conditions.keywords && context.message) {
        const hasKeyword = conditions.keywords.some((keyword: string) =>
          context.message!.toLowerCase().includes(keyword.toLowerCase())
        )
        if (!hasKeyword) {
          ruleMatches = false
        } else {
          reasons.push(`Contains keywords: ${conditions.keywords.join(', ')}`)
        }
      }

      // Check message count condition
      if (conditions.message_count) {
        const { operator, value } = conditions.message_count
        const matches = this.evaluateCondition(messageCount || 0, operator, value)
        if (!matches) {
          ruleMatches = false
        } else {
          reasons.push(`Message count ${operator} ${value}`)
        }
      }

      // Check time elapsed condition
      if (conditions.time_elapsed) {
        const { operator, value, unit } = conditions.time_elapsed
        const timeValue = unit === 'hours' ? timeElapsed / 60 : timeElapsed
        const matches = this.evaluateCondition(timeValue, operator, value)
        if (!matches) {
          ruleMatches = false
        } else {
          reasons.push(`Time elapsed ${operator} ${value} ${unit}`)
        }
      }

      // Check urgency condition
      if (conditions.urgency && context.sentiment) {
        if (context.sentiment.urgency !== conditions.urgency) {
          ruleMatches = false
        } else {
          reasons.push(`Urgency level: ${conditions.urgency}`)
        }
      }

      // Check channel condition
      if (conditions.channel) {
        if (conversation.channel !== conditions.channel) {
          ruleMatches = false
        } else {
          reasons.push(`Channel: ${conditions.channel}`)
        }
      }

      // If rule matches, return escalation
      if (ruleMatches && reasons.length > 0) {
        return {
          shouldEscalate: true,
          rule,
          actions: rule.actions || [],
          reason: reasons.join(', ')
        }
      }
    }

    return { shouldEscalate: false, actions: [], reason: 'No rules matched' }
  }

  static evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '<': return value < threshold
      case '>': return value > threshold
      case '<=': return value <= threshold
      case '>=': return value >= threshold
      case '=': return value === threshold
      default: return false
    }
  }

  static async executeActions(
    conversationId: string,
    actions: any[],
    reason: string
  ): Promise<void> {
    const supabase = await createClient()

    for (const action of actions) {
      switch (action.type) {
        case 'escalate':
          await supabase
            .from('chat_conversations')
            .update({
              status: 'escalated',
              priority: action.priority || 'high',
              escalation_reason: reason,
              escalated_at: new Date().toISOString()
            })
            .eq('id', conversationId)
          break

        case 'notify_agent':
          // This would integrate with your notification system
          console.log(`Notify agent: ${action.message}`)
          break

        case 'notify_supervisor':
          // This would integrate with supervisor notification system
          console.log(`Notify supervisor: ${action.message}`)
          break

        case 'assign_agent':
          if (action.agent_id) {
            await supabase
              .from('chat_conversations')
              .update({
                assigned_agent: action.agent_id,
                status: 'assigned'
              })
              .eq('id', conversationId)
          }
          break

        case 'update_priority':
          await supabase
            .from('chat_conversations')
            .update({ priority: action.priority || 'medium' })
            .eq('id', conversationId)
          break

        case 'add_tags':
          if (action.tags?.length) {
            // Get current tags and merge
            const { data: conversation } = await supabase
              .from('chat_conversations')
              .select('tags')
              .eq('id', conversationId)
              .single()

            const currentTags = conversation?.tags || []
            const newTags = [...new Set([...currentTags, ...action.tags])]

            await supabase
              .from('chat_conversations')
              .update({ tags: newTags })
              .eq('id', conversationId)
          }
          break
      }
    }

    // Log the escalation
    await supabase
      .from('escalation_logs')
      .insert({
        conversation_id: conversationId,
        reason,
        triggered_by: 'auto',
        old_status: 'active',
        new_status: 'escalated'
      })
  }
}

// POST /api/ai/escalation/rules - Create escalation rule
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new ValidationError('Unauthorized')
  }

  const body = await request.json()
  const validatedData = escalationRuleSchema.parse(body)

  const { data: rule, error } = await supabase
    .from('escalation_rules')
    .insert({
      user_id: user.id,
      ...validatedData
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create escalation rule: ${error.message}`)
  }

  return NextResponse.json({
    success: true,
    rule
  })
})

// GET /api/ai/escalation/rules - Get escalation rules
export const GET = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new ValidationError('Unauthorized')
  }

  const { searchParams } = new URL(request.url)
  const ruleId = searchParams.get('ruleId')

  if (ruleId) {
    const { data: rule } = await supabase
      .from('escalation_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({ rule })
  }

  const { data: rules } = await supabase
    .from('escalation_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('priority', { ascending: false })

  return NextResponse.json({
    success: true,
    rules: rules || []
  })
})

// PUT /api/ai/escalation/check - Check if conversation should be escalated
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const validatedData = checkEscalationSchema.parse(body)

  const result = await EscalationEngine.evaluateRules(
    validatedData.conversationId,
    {
      message: validatedData.message,
      sentiment: validatedData.sentiment
    }
  )

  // If escalation is needed, execute actions
  if (result.shouldEscalate) {
    await EscalationEngine.executeActions(
      validatedData.conversationId,
      result.actions,
      result.reason
    )
  }

  return NextResponse.json({
    success: true,
    escalation: result
  })
})

// DELETE /api/ai/escalation/rules/[id] - Delete escalation rule
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('ruleId')

    if (!ruleId) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 })
    }

    const { error } = await supabase
      .from('escalation_rules')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting escalation rule:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}