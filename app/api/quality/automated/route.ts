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
    const conversation_id = searchParams.get('conversation_id')
    const flagged_only = searchParams.get('flagged_only') === 'true'

    let query = supabase
      .from('automated_quality_scores')
      .select(`
        *,
        quality_criteria (
          name,
          max_score
        ),
        chat_conversations (
          customer_identifier,
          channel,
          assigned_agent_id
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (conversation_id) {
      query = query.eq('conversation_id', conversation_id)
    }

    if (flagged_only) {
      query = query.eq('flagged_for_review', true)
    }

    const { data: scores, error } = await query

    if (error) {
      console.error('Error fetching automated quality scores:', error)
      return NextResponse.json({ error: "Failed to fetch quality scores" }, { status: 500 })
    }

    return NextResponse.json(scores)
  } catch (error) {
    console.error('Error in automated quality scores API:', error)
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
    const { conversation_id, criteria_id, overall_score, criteria_scores, confidence_score, reasoning, flagged_for_review } = body

    if (!conversation_id || overall_score === undefined) {
      return NextResponse.json({
        error: "Conversation ID and overall score are required"
      }, { status: 400 })
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const { data: score, error } = await supabase
      .from('automated_quality_scores')
      .upsert({
        conversation_id,
        criteria_id,
        overall_score,
        criteria_scores: criteria_scores || {},
        confidence_score: confidence_score || 0.8,
        reasoning,
        flagged_for_review: flagged_for_review || false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating automated quality score:', error)
      return NextResponse.json({ error: "Failed to create quality score" }, { status: 500 })
    }

    // If flagged for review, create a quality recommendation
    if (flagged_for_review && overall_score < 70) {
      await supabase
        .from('quality_recommendations')
        .insert({
          conversation_id,
          recommendation_type: 'quality_score',
          severity: overall_score < 50 ? 'high' : 'medium',
          description: `Automated quality score of ${overall_score}% flagged for review`,
          suggested_action: 'Review conversation and provide manual quality assessment'
        })
    }

    return NextResponse.json(score)
  } catch (error) {
    console.error('Error in automated quality scores POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}