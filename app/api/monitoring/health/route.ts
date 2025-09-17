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

    // Get system health
    const health = await AuthMonitor.getSystemHealth()

    // Determine overall health status
    const services = [health.database, health.authentication, health.mfa, health.sessions]
    const hasUnhealthy = services.includes('unhealthy')
    const hasDegraded = services.includes('degraded')

    const overallHealth = hasUnhealthy ? 'unhealthy' :
                         hasDegraded ? 'degraded' : 'healthy'

    return NextResponse.json({
      success: true,
      data: {
        overallHealth,
        services: health,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    logger.error('Failed to get system health', { error })
    return NextResponse.json(
      { error: 'Failed to get system health' },
      { status: 500 }
    )
  }
}