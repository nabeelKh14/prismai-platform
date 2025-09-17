import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: templates, error } = await supabase
      .from('survey_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching survey templates:', error)
      return NextResponse.json({ error: "Failed to fetch survey templates" }, { status: 500 })
    }

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error in survey templates API:', error)
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
    const { name, description, trigger_event, delivery_channels, questions } = body

    if (!name || !questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: "Name and questions are required" }, { status: 400 })
    }

    const { data: template, error } = await supabase
      .from('survey_templates')
      .insert({
        user_id: user.id,
        name,
        description,
        trigger_event: trigger_event || 'manual',
        delivery_channels: delivery_channels || ['email'],
        questions
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating survey template:', error)
      return NextResponse.json({ error: "Failed to create survey template" }, { status: 500 })
    }

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error in survey templates POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}