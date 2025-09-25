/**
 * Personalization Analytics API
 * API endpoint for personalization analytics and reporting
 */

import { NextRequest, NextResponse } from 'next/server'
import { personalizationAnalytics } from '@/lib/personalization/personalization-analytics'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const reportType = searchParams.get('reportType') as 'daily' | 'weekly' | 'monthly' | 'custom'
    const metric = searchParams.get('metric')
    const days = parseInt(searchParams.get('days') || '30')

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: userId'
        },
        { status: 400 }
      )
    }

    switch (searchParams.get('action')) {
      case 'report':
        const report = await personalizationAnalytics.generateAnalyticsReport(
          userId,
          reportType || 'daily'
        )
        return NextResponse.json({ success: true, data: report })

      case 'realtime':
        const metrics = await personalizationAnalytics.getRealtimeMetrics(userId)
        return NextResponse.json({ success: true, data: metrics })

      case 'trends':
        if (!metric) {
          return NextResponse.json(
            {
              success: false,
              error: 'Missing required parameter: metric'
            },
            { status: 400 }
          )
        }
        const trends = await personalizationAnalytics.analyzeTrends(userId, metric, days)
        return NextResponse.json({ success: true, data: trends })

      case 'anomalies':
        const anomalies = await personalizationAnalytics.identifyAnomalies(userId)
        return NextResponse.json({ success: true, data: anomalies })

      case 'benchmarks':
        const benchmarks = await personalizationAnalytics.generateBenchmarks(userId)
        return NextResponse.json({ success: true, data: benchmarks })

      case 'effectiveness':
        const effectiveness = await personalizationAnalytics.getEffectivenessScore(userId)
        return NextResponse.json({ success: true, data: effectiveness })

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action parameter'
          },
          { status: 400 }
        )
    }
  } catch (error) {
    logger.error('Error in personalization analytics API', error as Error, {
      userId: request.nextUrl.searchParams.get('userId'),
      action: request.nextUrl.searchParams.get('action')
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        metadata: { processedAt: new Date() }
      },
      { status: 500 }
    )
  }
}