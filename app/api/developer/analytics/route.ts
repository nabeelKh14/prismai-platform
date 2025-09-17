import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UsageAnalyticsService } from '@/lib/rate-limit/analytics'
import { withErrorHandling } from '@/lib/errors'

/**
 * @swagger
 * /api/developer/analytics:
 *   get:
 *     summary: Get usage analytics for the authenticated user
 *     description: Retrieve API usage statistics, request counts, and performance metrics
 *     tags:
 *       - Developer Portal
 *       - Analytics
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Time period for analytics
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalRequests:
 *                       type: integer
 *                       description: Total API requests in the period
 *                     totalErrors:
 *                       type: integer
 *                       description: Total error responses
 *                     averageResponseTime:
 *                       type: number
 *                       description: Average response time in milliseconds
 *                     quotaUsed:
 *                       type: integer
 *                       description: Current quota usage
 *                     quotaLimit:
 *                       type: integer
 *                       description: Quota limit for the user's tier
 *                     tier:
 *                       type: string
 *                       description: User's API tier
 *                 usageData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                         description: Date of the data point
 *                       requests:
 *                         type: integer
 *                         description: Number of requests on this date
 *                       errors:
 *                         type: integer
 *                         description: Number of errors on this date
 *                       responseTime:
 *                         type: number
 *                         description: Average response time on this date
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '30d'

  // Calculate date range
  const now = new Date()
  const startDate = new Date()

  switch (period) {
    case '7d':
      startDate.setDate(now.getDate() - 7)
      break
    case '30d':
      startDate.setDate(now.getDate() - 30)
      break
    case '90d':
      startDate.setDate(now.getDate() - 90)
      break
    default:
      startDate.setDate(now.getDate() - 30)
  }

  // Get user's API keys to determine tier
  const { data: apiKeys } = await supabase
    .from('api_keys')
    .select('tier')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)

  const userTier = apiKeys?.[0]?.tier || 'free'

  // Get usage analytics using the static method
  const usageRecords = await UsageAnalyticsService.getUsageStats(user.id, {
    start: startDate,
    end: now,
  })

  // Get quota information
  const quotaInfo = await UsageAnalyticsService.getQuotaUsage(user.id)

  // Calculate stats from usage records
  const totalRequests = usageRecords.reduce((sum, record) => sum + record.requestCount, 0)
  const totalErrors = usageRecords.reduce((sum, record) => sum + record.blockedRequests, 0)
  const averageResponseTime = 0 // Would need monitoring data for this

  // Generate daily usage data (simplified)
  const dailyUsage = []
  const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  for (let i = 0; i < daysDiff; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)

    const dayRecords = usageRecords.filter(record => {
      const recordDate = new Date(record.timeWindow.start)
      return recordDate.toDateString() === date.toDateString()
    })

    const dayRequests = dayRecords.reduce((sum, record) => sum + record.requestCount, 0)
    const dayErrors = dayRecords.reduce((sum, record) => sum + record.blockedRequests, 0)

    dailyUsage.push({
      date,
      requests: dayRequests,
      errors: dayErrors,
      averageResponseTime: 0, // Would need monitoring data
    })
  }

  // Format response
  const stats = {
    totalRequests,
    totalErrors,
    averageResponseTime,
    quotaUsed: quotaInfo.used,
    quotaLimit: quotaInfo.limit,
    tier: userTier,
  }

  const usageData = dailyUsage.map(day => ({
    date: day.date.toISOString().split('T')[0],
    requests: day.requests,
    errors: day.errors,
    responseTime: day.averageResponseTime,
  }))

  return NextResponse.json({
    success: true,
    stats,
    usageData,
  })
})