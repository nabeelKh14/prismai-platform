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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const severityParam = searchParams.get('severity')
    const severity = severityParam as 'low' | 'medium' | 'high' | 'critical' | undefined
    const resolved = searchParams.get('resolved') === 'true' ? true :
                    searchParams.get('resolved') === 'false' ? false : undefined

    // Get security events
    const events = await AuthMonitor.getSecurityEvents(limit, offset, severity, resolved)

    return NextResponse.json({
      success: true,
      data: {
        events,
        pagination: {
          limit,
          offset,
          hasMore: events.length === limit
        }
      }
    })

  } catch (error) {
    logger.error('Failed to get security events', { error })
    return NextResponse.json(
      { error: 'Failed to get security events' },
      { status: 500 }
    )
  }
}

export const PUT = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

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

    // Resolve security event
    const success = await AuthMonitor.resolveSecurityEvent(eventId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to resolve security event' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Security event resolved successfully'
    })

  } catch (error) {
    logger.error('Failed to resolve security event', { error })
    return NextResponse.json(
      { error: 'Failed to resolve security event' },
      { status: 500 }
    )
  }
}