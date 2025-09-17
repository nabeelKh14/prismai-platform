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
    const status = searchParams.get('status')
    const template_id = searchParams.get('template_id')

    let query = supabase
      .from('customer_surveys')
      .select(`
        *,
        survey_templates (
          name,
          description
        ),
        survey_responses (
          question_id,
          response_value,
          response_type
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (template_id) {
      query = query.eq('template_id', template_id)
    }

    const { data: surveys, error } = await query

    if (error) {
      console.error('Error fetching customer surveys:', error)
      return NextResponse.json({ error: "Failed to fetch surveys" }, { status: 500 })
    }

    return NextResponse.json(surveys)
  } catch (error) {
    console.error('Error in surveys API:', error)
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
    const { template_id, conversation_id, customer_identifier, delivery_channel } = body

    if (!template_id || !customer_identifier || !delivery_channel) {
      return NextResponse.json({
        error: "Template ID, customer identifier, and delivery channel are required"
      }, { status: 400 })
    }

    // Verify template exists and belongs to user
    const { data: template, error: templateError } = await supabase
      .from('survey_templates')
      .select('id')
      .eq('id', template_id)
      .eq('user_id', user.id)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: "Survey template not found" }, { status: 404 })
    }

    const { data: survey, error } = await supabase
      .from('customer_surveys')
      .insert({
        user_id: user.id,
        conversation_id,
        template_id,
        customer_identifier,
        delivery_channel,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating customer survey:', error)
      return NextResponse.json({ error: "Failed to create survey" }, { status: 500 })
    }

    // TODO: Trigger survey delivery based on channel
    // For now, just mark as sent
    await supabase
      .from('customer_surveys')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', survey.id)

    return NextResponse.json(survey, { status: 201 })
  } catch (error) {
    console.error('Error in surveys POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}