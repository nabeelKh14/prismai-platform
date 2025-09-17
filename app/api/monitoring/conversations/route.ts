import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get active conversations for monitoring
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select(`
        id,
        customer_identifier,
        channel,
        status,
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
      .limit(20)

    if (error) {
      console.error('Error fetching conversations for monitoring:', error)
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
    }

    // Transform data with mock sentiment analysis and tags
    const transformedConversations = conversations?.map((conv, index) => {
      const messages = conv.chat_messages || []
      const duration = Math.floor((new Date().getTime() - new Date(conv.created_at).getTime()) / 1000)

      // Mock sentiment and tags based on message content
      const lastMessage = messages[messages.length - 1]?.content || ''
      const sentiment = lastMessage.toLowerCase().includes('problem') || lastMessage.toLowerCase().includes('issue')
        ? 'negative'
        : lastMessage.toLowerCase().includes('thank') || lastMessage.toLowerCase().includes('great')
        ? 'positive'
        : 'neutral'

      const tags = []
      if (lastMessage.toLowerCase().includes('refund')) tags.push('refund')
      if (lastMessage.toLowerCase().includes('billing')) tags.push('billing')
      if (lastMessage.toLowerCase().includes('support')) tags.push('support')
      if (sentiment === 'negative') tags.push('urgent')

      return {
        id: conv.id,
        customer_identifier: conv.customer_identifier,
        channel: conv.channel,
        status: conv.status,
        sentiment,
        tags,
        duration,
        messages: messages.length,
        lastActivity: conv.updated_at
      }
    }) || []

    return NextResponse.json(transformedConversations)
  } catch (error) {
    console.error('Error in monitoring conversations API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}