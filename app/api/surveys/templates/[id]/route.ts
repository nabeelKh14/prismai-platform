import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: template, error } = await supabase
      .from('survey_templates')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error fetching survey template:', error)
      return NextResponse.json({ error: "Survey template not found" }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error in survey template GET:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, trigger_event, delivery_channels, questions, is_active } = body

    const { data: template, error } = await supabase
      .from('survey_templates')
      .update({
        name,
        description,
        trigger_event,
        delivery_channels,
        questions,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating survey template:', error)
      return NextResponse.json({ error: "Failed to update survey template" }, { status: 500 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error in survey template PUT:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase
      .from('survey_templates')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting survey template:', error)
      return NextResponse.json({ error: "Failed to delete survey template" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in survey template DELETE:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}