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
    const timeRange = searchParams.get('timeRange') || '1h'

    // Calculate time range
    const now = new Date()
    let startTime: Date

    switch (timeRange) {
      case '15m':
        startTime = new Date(now.getTime() - 15 * 60 * 1000)
        break
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '4h':
        startTime = new Date(now.getTime() - 4 * 60 * 60 * 1000)
        break
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
    }

    // Get real-time metrics
    const { data: conversations, error: convError } = await supabase
      .from('chat_conversations')
      .select('status, created_at, updated_at')
      .eq('user_id', user.id)
      .gte('updated_at', startTime.toISOString())

    if (convError) {
      console.error('Error fetching conversations for metrics:', convError)
    }

    // Calculate metrics
    const activeChats = conversations?.filter(c => c.status === 'active' || c.status === 'assigned').length || 0
    const waitingChats = conversations?.filter(c => c.status === 'waiting').length || 0

    // Mock additional metrics (in real implementation, these would be calculated from actual data)
    const metrics = {
      activeChats,
      queueLength: waitingChats,
      averageResponseTime: 45, // seconds
      totalAgents: 4,
      onlineAgents: 3,
      resolvedToday: 127,
      abandonedToday: 8,
      satisfactionScore: 92.5
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error in monitoring metrics API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}