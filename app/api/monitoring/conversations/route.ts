import { NextRequest } from "next/server"
import { withApiHandler, apiResponse, dateUtils } from "@/lib/api/api-utils"

export async function GET(request: NextRequest) {
  return withApiHandler(async (request, { user, supabase, query }) => {
    // Get active conversations for monitoring
    const conversations = await query(() =>
      supabase
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
    )

    // Transform data with sentiment analysis and tags
    const transformedConversations = (conversations as any[])?.map((conv: any) => {
      const messages = conv.chat_messages || []
      const duration = Math.floor((new Date().getTime() - new Date(conv.created_at).getTime()) / 1000)

      // Analyze sentiment and generate tags based on message content
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

    return apiResponse.success(transformedConversations)
  })(request)
}