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
    const agent_id = searchParams.get('agent_id')

    let query = supabase
      .from('agent_goals')
      .select(`
        *,
        agent_profiles (
          name,
          email
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (agent_id) {
      query = query.eq('agent_id', agent_id)
    }

    const { data: goals, error } = await query

    if (error) {
      console.error('Error fetching agent goals:', error)
      return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 })
    }

    return NextResponse.json(goals)
  } catch (error) {
    console.error('Error in agent goals API:', error)
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
    const { agent_id, goal_type, target_value, period, is_active } = body

    if (!goal_type || !target_value || !period) {
      return NextResponse.json({
        error: "Goal type, target value, and period are required"
      }, { status: 400 })
    }

    // If agent_id is provided, verify agent belongs to user
    if (agent_id) {
      const { data: agent, error: agentError } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('id', agent_id)
        .eq('user_id', user.id)
        .single()

      if (agentError || !agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 })
      }
    }

    const { data: goal, error } = await supabase
      .from('agent_goals')
      .insert({
        user_id: user.id,
        agent_id,
        goal_type,
        target_value,
        period,
        is_active: is_active ?? true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating agent goal:', error)
      return NextResponse.json({ error: "Failed to create goal" }, { status: 500 })
    }

    return NextResponse.json(goal, { status: 201 })
  } catch (error) {
    console.error('Error in agent goals POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}