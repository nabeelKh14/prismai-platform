import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get conversations with basic info for live chat dashboard
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select(`
        id,
        customer_identifier,
        channel,
        status,
        priority,
        assigned_agent,
        created_at,
        updated_at,
        chat_messages (
          id,
          content,
          created_at,
          sender_type
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'waiting', 'assigned'])
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
    }

    // Transform data for the dashboard
    const transformedConversations = conversations?.map(conv => {
      const messages = conv.chat_messages || []
      const lastMessage = messages[messages.length - 1]

      return {
        id: conv.id,
        customer_identifier: conv.customer_identifier,
        channel: conv.channel,
        status: conv.status,
        priority: conv.priority || 'medium',
        assigned_agent: conv.assigned_agent,
        last_message: lastMessage?.content || '',
        last_message_time: lastMessage?.created_at || conv.updated_at,
        message_count: messages.length,
        tags: [] // Will be populated from message analysis
      }
    }) || []

    return NextResponse.json(transformedConversations)
  } catch (error) {
    console.error('Error in live-chat conversations API:', error)
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
    const { type, conversation_id, agent_id } = body

    if (type === 'assign_conversation') {
      // Update conversation assignment
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          assigned_agent: agent_id,
          status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation_id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error assigning conversation:', error)
        return NextResponse.json({ error: "Failed to assign conversation" }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (type === 'transfer_conversation') {
      // Transfer conversation to another agent
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          assigned_agent: agent_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation_id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error transferring conversation:', error)
        return NextResponse.json({ error: "Failed to transfer conversation" }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (type === 'resolve_conversation') {
      // Mark conversation as resolved
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation_id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error resolving conversation:', error)
        return NextResponse.json({ error: "Failed to resolve conversation" }, { status: 500 })
      }

      // Trigger automatic summarization
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/summarization`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: conversation_id,
            generateType: 'auto',
            includeKeyPoints: true,
            includeSentiment: true,
            maxLength: 500
          })
        })
      } catch (error) {
        console.error('Error triggering automatic summarization:', error)
        // Don't fail the resolution if summarization fails
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action type" }, { status: 400 })
  } catch (error) {
    console.error('Error in live-chat conversations POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}