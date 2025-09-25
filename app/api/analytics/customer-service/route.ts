import { NextRequest } from "next/server"
import { withApiHandler, apiResponse, dateUtils, analytics } from "@/lib/api/api-utils"

export async function GET(request: NextRequest) {
  return withApiHandler(async (request, { user, supabase, query }) => {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '7d'

    const { startDate } = dateUtils.getDateRange(timeRange)

    // Get conversation data
    const conversations = await query(() =>
      supabase
        .from('chat_conversations')
        .select(`
          id,
          channel,
          status,
          created_at,
          updated_at,
          chat_messages (
            id,
            created_at,
            sender_type
          )
        `)
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
    )

    // Calculate basic metrics
    const baseMetrics = analytics.calculateMetrics(conversations as any[])

    // Generate comprehensive analytics data
    const analyticsData = analytics.generateMockData(baseMetrics, timeRange)

    return apiResponse.success(analyticsData)
  })(request)
}
