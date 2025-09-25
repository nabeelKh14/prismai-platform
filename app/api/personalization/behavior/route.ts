/**
 * Personalization Behavior API
 * API endpoint for processing lead behavior and triggering actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { personalizationOrchestrator } from '@/lib/personalization/orchestrator'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, userId, behaviorType, behaviorData } = body

    // Validate required fields
    if (!leadId || !userId || !behaviorType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: leadId, userId, behaviorType'
        },
        { status: 400 }
      )
    }

    // Initialize orchestrator if needed
    await personalizationOrchestrator.initialize(userId)

    // Process behavior
    const result = await personalizationOrchestrator.processLeadBehavior(
      leadId,
      behaviorType,
      behaviorData || {},
      userId
    )

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error in personalization behavior API', error as Error, {
      leadId: request.nextUrl.searchParams.get('leadId'),
      userId: request.nextUrl.searchParams.get('userId'),
      behaviorType: request.nextUrl.searchParams.get('behaviorType')
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