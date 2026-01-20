import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { pipelineOrchestrator } from "@/lib/conversation/pipeline/orchestrator"
import { conversationAnalysisHandler } from "@/lib/websocket/conversation-analysis-handler"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const includeMetrics = searchParams.get('include_metrics') === 'true'
    const tenantId = searchParams.get('tenant_id')

    // Get agents with enhanced data from pipeline
    const agents = await getAgentsWithPipelineData(tenantId || 'default', includeMetrics)

    return NextResponse.json(agents)
  } catch (error) {
    logger.error('Error in live-chat agents API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { type, agent_id, status, conversation_id, message, tenant_id } = body

    switch (type) {
      case 'update_status':
        return await handleAgentStatusUpdate(agent_id, status, tenant_id)

      case 'send_message':
        return await handleAgentMessage(conversation_id, message, agent_id, tenant_id)

      case 'join_conversation':
        return await handleJoinConversation(agent_id, conversation_id, tenant_id)

      case 'leave_conversation':
        return await handleLeaveConversation(agent_id, conversation_id, tenant_id)

      case 'get_conversation_analysis':
        return await handleGetConversationAnalysis(conversation_id, tenant_id)

      default:
        return NextResponse.json({ error: "Invalid action type" }, { status: 400 })
    }
  } catch (error) {
    logger.error('Error in live-chat agents POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function getAgentsWithPipelineData(tenantId: string, includeMetrics: boolean) {
  // In a real implementation, this would come from a users/agents table
  const baseAgents = [
    {
      id: 'agent-1',
      name: 'Alice Johnson',
      status: 'online',
      active_chats: 3,
      max_chats: 5,
      tenant_id: tenantId,
      specializations: ['technical_support', 'billing'],
      languages: ['en', 'es'],
      average_resolution_time: 245
    },
    {
      id: 'agent-2',
      name: 'Bob Smith',
      status: 'online',
      active_chats: 2,
      max_chats: 5,
      tenant_id: tenantId,
      specializations: ['sales', 'product_inquiry'],
      languages: ['en'],
      average_resolution_time: 189
    },
    {
      id: 'agent-3',
      name: 'Carol Davis',
      status: 'busy',
      active_chats: 5,
      max_chats: 5,
      tenant_id: tenantId,
      specializations: ['customer_success', 'retention'],
      languages: ['en', 'fr'],
      average_resolution_time: 312
    },
    {
      id: 'agent-4',
      name: 'David Wilson',
      status: 'offline',
      active_chats: 0,
      max_chats: 5,
      tenant_id: tenantId,
      specializations: ['technical_support', 'escalations'],
      languages: ['en', 'de'],
      average_resolution_time: 198
    }
  ]

  if (!includeMetrics) {
    return baseAgents
  }

  // Enhance with pipeline metrics
  const connectionStats = conversationAnalysisHandler.getConnectionStats()
  const pipelineHealth = await pipelineOrchestrator.getHealth()

  return baseAgents.map(agent => ({
    ...agent,
    pipeline_metrics: {
      is_connected: connectionStats.activeConnections > 0,
      pipeline_status: pipelineHealth.status,
      average_latency: pipelineHealth.metrics.averageLatency,
      error_rate: pipelineHealth.metrics.errorRate
    }
  }))
}

async function handleAgentStatusUpdate(agentId: string, status: string, tenantId?: string) {
  try {
    logger.info('Agent status update requested', { agentId, status, tenantId })

    // In a real implementation, update agent status in database
    // For now, we'll just log and return success

    // If agent is going offline, clean up their connections
    if (status === 'offline') {
      // Clean up any active conversations for this agent
      logger.info('Agent going offline, cleaning up connections', { agentId })
    }

    return NextResponse.json({
      success: true,
      agent_id: agentId,
      status,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to update agent status', error as Error, { agentId, status })
    return NextResponse.json({
      error: "Failed to update agent status",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function handleAgentMessage(
  conversationId: string,
  message: string,
  agentId: string,
  tenantId?: string
) {
  try {
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 })
    }

    logger.info('Agent sending message', {
      conversationId,
      agentId,
      messageLength: message.length,
      tenantId
    })

    // Process message through pipeline
    const result = await pipelineOrchestrator.processConversationMessage(
      conversationId,
      message,
      'chat',
      tenantId,
      agentId,
      {
        sender_type: 'agent',
        channel: 'live_chat'
      }
    )

    if (!result.success) {
      return NextResponse.json({
        error: "Failed to process message",
        details: result.errors
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message_id: result.results?.messageId,
      analysis: result.analysis,
      processing_time: result.results?.processingTime,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to handle agent message', error as Error, {
      conversationId,
      agentId
    })

    return NextResponse.json({
      error: "Failed to send message",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function handleJoinConversation(agentId: string, conversationId: string, tenantId?: string) {
  try {
    logger.info('Agent joining conversation', { agentId, conversationId, tenantId })

    // Subscribe agent to conversation updates
    const subscribed = await conversationAnalysisHandler.subscribeToConversation(
      agentId,
      conversationId
    )

    if (!subscribed) {
      return NextResponse.json({
        error: "Failed to join conversation"
      }, { status: 500 })
    }

    // In a real implementation, update conversation assignment in database

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      agent_id: agentId,
      joined_at: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to handle join conversation', error as Error, {
      agentId,
      conversationId
    })

    return NextResponse.json({
      error: "Failed to join conversation",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function handleLeaveConversation(agentId: string, conversationId: string, tenantId?: string) {
  try {
    logger.info('Agent leaving conversation', { agentId, conversationId, tenantId })

    // Unsubscribe agent from conversation updates
    const unsubscribed = await conversationAnalysisHandler.unsubscribeFromConversation(
      agentId,
      conversationId
    )

    if (!unsubscribed) {
      logger.warn('Failed to unsubscribe agent from conversation', {
        agentId,
        conversationId
      })
    }

    // In a real implementation, update conversation assignment in database

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      agent_id: agentId,
      left_at: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to handle leave conversation', error as Error, {
      agentId,
      conversationId
    })

    return NextResponse.json({
      error: "Failed to leave conversation",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function handleGetConversationAnalysis(conversationId: string, tenantId?: string) {
  try {
    logger.info('Getting conversation analysis', { conversationId, tenantId })

    // Get pipeline health and metrics for context
    const pipelineHealth = await pipelineOrchestrator.getHealth()

    // In a real implementation, this would fetch conversation-specific analysis
    // For now, return pipeline status and general metrics

    return NextResponse.json({
      conversation_id: conversationId,
      pipeline_status: pipelineHealth.status,
      metrics: pipelineHealth.metrics,
      components: pipelineHealth.components,
      recommendations: [
        'Monitor conversation sentiment trends',
        'Watch for urgency indicators',
        'Consider escalation if complexity increases'
      ],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to get conversation analysis', error as Error, {
      conversationId
    })

    return NextResponse.json({
      error: "Failed to get conversation analysis",
      details: (error as Error).message
    }, { status: 500 })
  }
}