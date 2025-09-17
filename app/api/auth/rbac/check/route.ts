import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RBACService } from '@/lib/auth/rbac-service'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const POST = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { resource, action } = await request.json()

    if (!resource || !action) {
      return NextResponse.json(
        { error: 'Resource and action are required' },
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

    // Check permission
    const hasPermission = await RBACService.hasPermission(user.id, resource, action)

    return NextResponse.json({
      success: true,
      data: {
        hasPermission,
        resource,
        action
      }
    })

  } catch (error) {
    logger.error('Permission check failed', { error })
    return NextResponse.json(
      { error: 'Permission check failed' },
      { status: 500 }
    )
  }
}