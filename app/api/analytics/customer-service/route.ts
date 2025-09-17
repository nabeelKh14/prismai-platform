import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '7d'

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // Get conversation data
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select(`
        id,
        channel,
        status,
        created_at,
        updated_at,
        chat_messages (
          id,
          created_at,
          sender_type
        )
      `)
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())

    if (error) {
      console.error('Error fetching analytics data:', error)
      return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 })
    }

    // Calculate analytics
    const totalConversations = conversations?.length || 0
    const resolvedConversations = conversations?.filter(c => c.status === 'resolved').length || 0
    const activeConversations = conversations?.filter(c => c.status === 'active' || c.status === 'assigned').length || 0

    // Mock additional analytics data
    const analytics = {
      totalConversations,
      resolvedConversations,
      activeConversations,
      averageResolutionTime: 1800, // 30 minutes in seconds
      customerSatisfaction: 92.5,
      channelBreakdown: {
        whatsapp: Math.floor(totalConversations * 0.45),
        sms: Math.floor(totalConversations * 0.25),
        website: Math.floor(totalConversations * 0.30)
      },
      dailyVolume: Array.from({ length: timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90 }, (_, i) => {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        return {
          date: date.toISOString().split('T')[0],
          conversations: Math.floor(Math.random() * 50) + 20,
          resolved: Math.floor(Math.random() * 40) + 15,
          satisfaction: Math.floor(Math.random() * 10) + 85
        }
      }).reverse(),
      agentPerformance: [
        {
          id: 'agent-1',
          name: 'Alice Johnson',
          conversations: 45,
          resolutionRate: 94.2,
          avgResponseTime: 45,
          satisfactionScore: 94.2,
          efficiency: 87.5
        },
        {
          id: 'agent-2',
          name: 'Bob Smith',
          conversations: 38,
          resolutionRate: 91.8,
          avgResponseTime: 52,
          satisfactionScore: 91.8,
          efficiency: 82.3
        },
        {
          id: 'agent-3',
          name: 'Carol Davis',
          conversations: 52,
          resolutionRate: 96.1,
          avgResponseTime: 38,
          satisfactionScore: 96.1,
          efficiency: 94.7
        }
      ],
      conversationOutcomes: {
        resolved: resolvedConversations,
        escalated: Math.floor(totalConversations * 0.05),
        abandoned: Math.floor(totalConversations * 0.08),
        transferred: Math.floor(totalConversations * 0.12)
      },
      satisfactionTrends: Array.from({ length: timeRange === '1d' ? 24 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90 }, (_, i) => {
        const date = new Date(now.getTime() - i * (timeRange === '1d' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000))
        return {
          date: date.toISOString(),
          score: Math.floor(Math.random() * 10) + 88
        }
      }).reverse()
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error in customer service analytics API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
