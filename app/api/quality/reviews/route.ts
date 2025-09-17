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
    const reviewer_id = searchParams.get('reviewer_id')

    let query = supabase
      .from('quality_reviews')
      .select(`
        *,
        quality_criteria (
          name,
          max_score
        ),
        agent_profiles (
          name,
          email
        ),
        chat_conversations (
          customer_identifier,
          channel
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (conversation_id) {
      query = query.eq('conversation_id', conversation_id)
    }

    if (reviewer_id) {
      query = query.eq('reviewer_id', reviewer_id)
    }

    const { data: reviews, error } = await query

    if (error) {
      console.error('Error fetching quality reviews:', error)
      return NextResponse.json({ error: "Failed to fetch quality reviews" }, { status: 500 })
    }

    return NextResponse.json(reviews)
  } catch (error) {
    console.error('Error in quality reviews API:', error)
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
    const { conversation_id, reviewer_id, criteria_id, overall_score, criteria_scores, feedback, review_type } = body

    if (!conversation_id || !reviewer_id || !criteria_id || overall_score === undefined) {
      return NextResponse.json({
        error: "Conversation ID, reviewer ID, criteria ID, and overall score are required"
      }, { status: 400 })
    }

    // Verify reviewer is an agent profile for this user
    const { data: reviewer, error: reviewerError } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('id', reviewer_id)
      .eq('user_id', user.id)
      .single()

    if (reviewerError || !reviewer) {
      return NextResponse.json({ error: "Reviewer not found" }, { status: 404 })
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

    const { data: review, error } = await supabase
      .from('quality_reviews')
      .insert({
        conversation_id,
        reviewer_id,
        criteria_id,
        overall_score,
        criteria_scores: criteria_scores || {},
        feedback,
        review_type: review_type || 'random'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating quality review:', error)
      return NextResponse.json({ error: "Failed to create quality review" }, { status: 500 })
    }

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    console.error('Error in quality reviews POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}