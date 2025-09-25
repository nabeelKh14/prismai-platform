/**
 * Personalization Orchestrator API
 * Main API endpoint for the personalization engine
 */

import { NextRequest, NextResponse } from 'next/server'
import { personalizationOrchestrator } from '@/lib/personalization/orchestrator'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, userId, action, data, context } = body

    // Validate required fields
    if (!leadId || !userId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: leadId, userId, action'
        },
        { status: 400 }
      )
    }

    // Initialize orchestrator if needed
    await personalizationOrchestrator.initialize(userId)

    // Process request
    const result = await personalizationOrchestrator.processRequest({
      leadId,
      userId,
      action,
      data,
      context
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error in personalization orchestrator API', error as Error, {
      leadId: request.nextUrl.searchParams.get('leadId'),
      userId: request.nextUrl.searchParams.get('userId')
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: userId'
        },
        { status: 400 }
      )
    }

    // Initialize orchestrator if needed
    await personalizationOrchestrator.initialize(userId)

    switch (action) {
      case 'status':
        const status = await personalizationOrchestrator.getStatus(userId)
        return NextResponse.json(status)

      case 'optimize':
        const optimization = await personalizationOrchestrator.optimizeAll(userId)
        return NextResponse.json(optimization)

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
    logger.error('Error in personalization orchestrator GET API', error as Error, {
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