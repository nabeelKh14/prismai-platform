import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // For now, return mock agent data
    // In a real implementation, this would come from a users/agents table
    const mockAgents = [
      {
        id: 'agent-1',
        name: 'Alice Johnson',
        status: 'online',
        active_chats: 3,
        max_chats: 5
      },
      {
        id: 'agent-2',
        name: 'Bob Smith',
        status: 'online',
        active_chats: 2,
        max_chats: 5
      },
      {
        id: 'agent-3',
        name: 'Carol Davis',
        status: 'busy',
        active_chats: 5,
        max_chats: 5
      },
      {
        id: 'agent-4',
        name: 'David Wilson',
        status: 'offline',
        active_chats: 0,
        max_chats: 5
      }
    ]

    return NextResponse.json(mockAgents)
  } catch (error) {
    console.error('Error in live-chat agents API:', error)
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
    const { type, agent_id, status } = body

    if (type === 'update_status') {
      // In a real implementation, update agent status in database
      console.log(`Updating agent ${agent_id} status to ${status}`)

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action type" }, { status: 400 })
  } catch (error) {
    console.error('Error in live-chat agents POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}