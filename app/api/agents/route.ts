import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: agents, error } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching agent profiles:', error)
      return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 })
    }

    return NextResponse.json(agents)
  } catch (error) {
    console.error('Error in agents API:', error)
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
    const { name, email, role, max_concurrent_chats, skills } = body

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 })
    }

    // Check if agent with this email already exists for this user
    const { data: existingAgent } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', email)
      .single()

    if (existingAgent) {
      return NextResponse.json({ error: "Agent with this email already exists" }, { status: 400 })
    }

    const { data: agent, error } = await supabase
      .from('agent_profiles')
      .insert({
        user_id: user.id,
        name,
        email,
        role: role || 'agent',
        max_concurrent_chats: max_concurrent_chats || 5,
        skills: skills || []
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating agent profile:', error)
      return NextResponse.json({ error: "Failed to create agent" }, { status: 500 })
    }

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    console.error('Error in agents POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}