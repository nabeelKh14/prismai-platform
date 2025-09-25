/**
 * Priority Lead Routing API
 * Handles priority-based lead routing operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { priorityRoutingService } from '@/lib/lead-routing/priority-routing-service'
import { intelligentRoutingEngine } from '@/lib/lead-routing/intelligent-routing-engine'
import { realtimeHandoffOptimizer } from '@/lib/lead-routing/realtime-handoff-optimizer'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      action,
      leadId,
      userId,
      priorityScore,
      routingOptions = {}
    } = body

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to the lead
    if (userId && user.id !== userId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('user_id')
        .eq('id', leadId)
        .single()

      if (!lead || lead.user_id !== userId) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    switch (action) {
      case 'calculate_priority':
        return await handleCalculatePriority(leadId, userId)

      case 'route_lead':
        return await handleRouteLead(leadId, userId, routingOptions)

      case 'get_queue_stats':
        return await handleGetQueueStats(userId)

      case 'process_queues':
        return await handleProcessQueues(userId)

      case 'optimize_handoff':
        return await handleOptimizeHandoff(leadId, userId)

      case 'run_optimization_cycle':
        return await handleRunOptimizationCycle(userId)

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    logger.error('Priority routing API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const action = searchParams.get('action')
    const leadId = searchParams.get('leadId')
    const userId = searchParams.get('userId')

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    switch (action) {
      case 'queue_stats':
        return await handleGetQueueStats(userId || user.id)

      case 'lead_priority':
        return await handleGetLeadPriority(leadId!, userId || user.id)

      case 'routing_decisions':
        return await handleGetRoutingDecisions(userId || user.id)

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    logger.error('Priority routing GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Action handlers

async function handleCalculatePriority(leadId: string, userId: string) {
  try {
    const priorityScore = await priorityRoutingService.calculatePriorityScore(leadId, userId)

    return NextResponse.json({
      success: true,
      priorityScore,
      priorityLevel: priorityRoutingService.getPriorityLevel(priorityScore.overall),
      routingQueue: priorityRoutingService.getRoutingQueue(priorityRoutingService.getPriorityLevel(priorityScore.overall))
    })

  } catch (error) {
    logger.error('Error calculating priority:', error)
    return NextResponse.json(
      { error: 'Failed to calculate priority score' },
      { status: 500 }
    )
  }
}

async function handleRouteLead(leadId: string, userId: string, routingOptions: any) {
  try {
    // Calculate priority score first if not provided
    if (!routingOptions.skipPriorityCalculation) {
      await priorityRoutingService.calculatePriorityScore(leadId, userId)
    }

    // Route the lead using intelligent routing
    await intelligentRoutingEngine.routeLeadToAgent(leadId, userId)

    // Get routing decision for response
    const decision = await intelligentRoutingEngine.makeRoutingDecision(leadId, userId)

    return NextResponse.json({
      success: true,
      message: 'Lead routed successfully',
      routingDecision: decision
    })

  } catch (error) {
    logger.error('Error routing lead:', error)
    return NextResponse.json(
      { error: 'Failed to route lead' },
      { status: 500 }
    )
  }
}

async function handleGetQueueStats(userId: string) {
  try {
    const queueStats = await priorityRoutingService.getQueueStats()

    return NextResponse.json({
      success: true,
      queueStats
    })

  } catch (error) {
    logger.error('Error getting queue stats:', error)
    return NextResponse.json(
      { error: 'Failed to get queue statistics' },
      { status: 500 }
    )
  }
}

async function handleProcessQueues(userId: string) {
  try {
    await intelligentRoutingEngine.processPriorityQueues(userId)

    return NextResponse.json({
      success: true,
      message: 'Priority queues processed successfully'
    })

  } catch (error) {
    logger.error('Error processing queues:', error)
    return NextResponse.json(
      { error: 'Failed to process priority queues' },
      { status: 500 }
    )
  }
}

async function handleOptimizeHandoff(leadId: string, userId: string) {
  try {
    const optimization = await realtimeHandoffOptimizer.optimizeHandoff(leadId, userId)

    if (optimization) {
      return NextResponse.json({
        success: true,
        optimization,
        message: 'Handoff optimization opportunity identified'
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'No optimization opportunities found'
      })
    }

  } catch (error) {
    logger.error('Error optimizing handoff:', error)
    return NextResponse.json(
      { error: 'Failed to optimize handoff' },
      { status: 500 }
    )
  }
}

async function handleRunOptimizationCycle(userId: string) {
  try {
    await realtimeHandoffOptimizer.runOptimizationCycle(userId)

    return NextResponse.json({
      success: true,
      message: 'Optimization cycle completed successfully'
    })

  } catch (error) {
    logger.error('Error running optimization cycle:', error)
    return NextResponse.json(
      { error: 'Failed to run optimization cycle' },
      { status: 500 }
    )
  }
}

async function handleGetLeadPriority(leadId: string, userId: string) {
  try {
    const supabase = await createClient()

    const { data: lead } = await supabase
      .from('leads')
      .select(`
        id,
        priority_score,
        business_value_score,
        urgency_score,
        time_sensitivity_score,
        priority_metadata,
        created_at
      `)
      .eq('id', leadId)
      .eq('user_id', userId)
      .single()

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    const priorityLevel = priorityRoutingService.getPriorityLevel(lead.priority_score || 0)
    const routingQueue = priorityRoutingService.getRoutingQueue(priorityLevel)

    return NextResponse.json({
      success: true,
      leadPriority: {
        leadId,
        priorityScore: {
          overall: lead.priority_score || 0,
          businessValue: lead.business_value_score || 0,
          urgency: lead.urgency_score || 0,
          timeSensitivity: lead.time_sensitivity_score || 0,
          breakdown: lead.priority_metadata || {}
        },
        priorityLevel,
        routingQueue,
        createdAt: lead.created_at
      }
    })

  } catch (error) {
    logger.error('Error getting lead priority:', error)
    return NextResponse.json(
      { error: 'Failed to get lead priority' },
      { status: 500 }
    )
  }
}

async function handleGetRoutingDecisions(userId: string) {
  try {
    const supabase = await createClient()

    const { data: decisions } = await supabase
      .from('lead_routing_decisions')
      .select(`
        *,
        leads(email, first_name, last_name, company)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      success: true,
      routingDecisions: decisions || []
    })

  } catch (error) {
    logger.error('Error getting routing decisions:', error)
    return NextResponse.json(
      { error: 'Failed to get routing decisions' },
      { status: 500 }
    )
  }
}