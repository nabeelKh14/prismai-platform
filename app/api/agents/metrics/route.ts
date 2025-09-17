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
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    let query = supabase
      .from('agent_performance_metrics')
      .select(`
        *,
        agent_profiles (
          name,
          email,
          role
        )
      `)
      .eq('user_id', user.id)
      .order('metric_date', { ascending: false })

    if (agent_id) {
      query = query.eq('agent_id', agent_id)
    }

    if (start_date) {
      query = query.gte('metric_date', start_date)
    }

    if (end_date) {
      query = query.lte('metric_date', end_date)
    }

    const { data: metrics, error } = await query

    if (error) {
      console.error('Error fetching agent metrics:', error)
      return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error in agent metrics API:', error)
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
    const { agent_id, metric_date, metrics } = body

    if (!agent_id || !metric_date || !metrics) {
      return NextResponse.json({
        error: "Agent ID, metric date, and metrics are required"
      }, { status: 400 })
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('id', agent_id)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    const { data: performanceMetric, error } = await supabase
      .from('agent_performance_metrics')
      .upsert({
        agent_id,
        user_id: user.id,
        metric_date,
        ...metrics
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating/updating agent metrics:', error)
      return NextResponse.json({ error: "Failed to save metrics" }, { status: 500 })
    }

    return NextResponse.json(performanceMetric)
  } catch (error) {
    console.error('Error in agent metrics POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}