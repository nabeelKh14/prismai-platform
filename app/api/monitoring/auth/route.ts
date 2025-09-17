import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AuthMonitor } from '@/lib/monitoring/auth-monitor'
import { RBACService } from '@/lib/auth/rbac-service'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const GET = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const isAdmin = await RBACService.isAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const timeRange = (searchParams.get('timeRange') as 'hour' | 'day' | 'week' | 'month') || 'day'

    // Get authentication metrics
    const metrics = await AuthMonitor.getAuthMetrics(timeRange)

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        timeRange,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    logger.error('Failed to get auth metrics', { error })
    return NextResponse.json(
      { error: 'Failed to get auth metrics' },
      { status: 500 }
    )
  }
}