import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    // Get user roles
    const roles = await RBACService.getUserRoles(user.id)

    return NextResponse.json({
      success: true,
      data: {
        roles
      }
    })

  } catch (error) {
    logger.error('Failed to get user roles', { error })
    return NextResponse.json(
      { error: 'Failed to get roles' },
      { status: 500 }
    )
  }
}

export const POST = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { userId, roleName, expiresAt } = await request.json()

    if (!userId || !roleName) {
      return NextResponse.json(
        { error: 'User ID and role name are required' },
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

    // Check if current user is admin
    const isAdmin = await RBACService.isAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Assign role
    const success = await RBACService.assignRole(userId, roleName, user.id, expiresAt)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to assign role' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Role assigned successfully'
    })

  } catch (error) {
    logger.error('Role assignment failed', { error })
    return NextResponse.json(
      { error: 'Failed to assign role' },
      { status: 500 }
    )
  }
}

export const DELETE = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { userId, roleName } = await request.json()

    if (!userId || !roleName) {
      return NextResponse.json(
        { error: 'User ID and role name are required' },
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

    // Check if current user is admin
    const isAdmin = await RBACService.isAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Remove role
    const success = await RBACService.removeRole(userId, roleName)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove role' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Role removed successfully'
    })

  } catch (error) {
    logger.error('Role removal failed', { error })
    return NextResponse.json(
      { error: 'Failed to remove role' },
      { status: 500 }
    )
  }
}