import { NextRequest } from "next/server"
import { withApiHandler, apiResponse } from "@/lib/api/api-utils"

export async function GET(request: NextRequest) {
  return withApiHandler(async (request, { user, supabase, query }) => {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const template_id = searchParams.get('template_id')

    let dbQuery = supabase
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
      dbQuery = dbQuery.eq('status', status)
    }

    if (template_id) {
      dbQuery = dbQuery.eq('template_id', template_id)
    }

    const surveys = await query(() => dbQuery)
    return apiResponse.success(surveys)
  })(request)
}

export async function POST(request: NextRequest) {
  return withApiHandler(async (request, { user, supabase, query, validate }) => {
    const body = await request.json()
    const { template_id, conversation_id, customer_identifier, delivery_channel } = body

    // Validate required fields
    const validationError = validate.required(body, ['template_id', 'customer_identifier', 'delivery_channel'])
    if (validationError) {
      return apiResponse.badRequest(validationError)
    }

    // Verify template exists and belongs to user
    const template = await query(() =>
      supabase
        .from('survey_templates')
        .select('id')
        .eq('id', template_id)
        .eq('user_id', user.id)
        .single()
    )

    if (!template) {
      return apiResponse.notFound('Survey template')
    }

    // Create survey
    const survey = await query(() =>
      supabase
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
    )

    // Mark as sent (TODO: Trigger survey delivery based on channel)
    const surveyData = survey as any
    await query(() =>
      supabase
        .from('customer_surveys')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', surveyData.id)
    )

    return apiResponse.success(survey, 201)
  })(request)
}