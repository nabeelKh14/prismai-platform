import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Mock agent performance data
    // In a real implementation, this would be calculated from actual conversation and performance data
    const agentPerformance = [
      {
        id: 'agent-1',
        name: 'Alice Johnson',
        status: 'online',
        activeChats: 3,
        resolvedToday: 24,
        averageResponseTime: 45,
        satisfactionScore: 94.2,
        efficiency: 87.5
      },
      {
        id: 'agent-2',
        name: 'Bob Smith',
        status: 'online',
        activeChats: 2,
        resolvedToday: 18,
        averageResponseTime: 52,
        satisfactionScore: 91.8,
        efficiency: 82.3
      },
      {
        id: 'agent-3',
        name: 'Carol Davis',
        status: 'busy',
        activeChats: 5,
        resolvedToday: 31,
        averageResponseTime: 38,
        satisfactionScore: 96.1,
        efficiency: 94.7
      },
      {
        id: 'agent-4',
        name: 'David Wilson',
        status: 'offline',
        activeChats: 0,
        resolvedToday: 0,
        averageResponseTime: 0,
        satisfactionScore: 0,
        efficiency: 0
      }
    ]

    return NextResponse.json(agentPerformance)
  } catch (error) {
    console.error('Error in monitoring agents API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}