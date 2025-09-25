import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { survey_id, responses } = body

    if (!survey_id || !responses || !Array.isArray(responses)) {
      return NextResponse.json({
        error: "Survey ID and responses array are required"
      }, { status: 400 })
    }

    // Verify survey exists and is still active
    const { data: survey, error: surveyError } = await supabase
      .from('customer_surveys')
      .select(`
        id,
        status,
        expires_at,
        survey_templates (
          questions
        )
      `)
      .eq('id', survey_id)
      .single()

    if (surveyError || !survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 })
    }

    if (survey.status === 'completed') {
      return NextResponse.json({ error: "Survey already completed" }, { status: 400 })
    }

    if (survey.status === 'expired' || new Date(survey.expires_at) < new Date()) {
      return NextResponse.json({ error: "Survey has expired" }, { status: 400 })
    }

    // Validate responses against template questions
    const template = survey.survey_templates as any
    const questions = template?.questions || []
    const questionMap = new Map(questions.map((q: any) => [q.id, q]))

    for (const response of responses) {
      const question = questionMap.get(response.question_id)
      if (!question) {
        return NextResponse.json({
          error: `Invalid question ID: ${response.question_id}`
        }, { status: 400 })
      }

      if ((question as any).required && (!response.response_value || response.response_value.trim() === '')) {
        return NextResponse.json({
          error: `Response required for question: ${(question as any).question}`
        }, { status: 400 })
      }
    }

    // Insert responses
    const responseInserts = responses.map((response: any) => ({
      survey_id,
      question_id: response.question_id,
      response_value: response.response_value,
      response_type: response.response_type || 'text'
    }))

    const { error: insertError } = await supabase
      .from('survey_responses')
      .insert(responseInserts)

    if (insertError) {
      console.error('Error inserting survey responses:', insertError)
      return NextResponse.json({ error: "Failed to save responses" }, { status: 500 })
    }

    // Mark survey as completed
    const { error: updateError } = await supabase
      .from('customer_surveys')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', survey_id)

    if (updateError) {
      console.error('Error updating survey status:', updateError)
    }

    return NextResponse.json({ success: true, message: "Survey responses submitted successfully" })
  } catch (error) {
    console.error('Error in survey responses API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const survey_id = searchParams.get('survey_id')

    if (!survey_id) {
      return NextResponse.json({ error: "Survey ID is required" }, { status: 400 })
    }

    // Verify user owns the survey
    const { data: survey, error: surveyError } = await supabase
      .from('customer_surveys')
      .select('user_id')
      .eq('id', survey_id)
      .single()

    if (surveyError || survey?.user_id !== user.id) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 })
    }

    const { data: responses, error } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', survey_id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching survey responses:', error)
      return NextResponse.json({ error: "Failed to fetch responses" }, { status: 500 })
    }

    return NextResponse.json(responses)
  } catch (error) {
    console.error('Error in survey responses GET:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}