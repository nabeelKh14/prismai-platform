import { NextRequest, NextResponse } from 'next/server'
import { tenantService } from '@/lib/tenant/tenant-service'
import { withTenant, getTenantId } from '@/lib/tenant/tenant-middleware'
import { logger } from '@/lib/logger'
import { InviteUserRequestSchema } from '@/lib/types/tenant'
import { createClient } from '@/lib/supabase/server'

// GET /api/tenants/invitations - Get tenant invitations
export const GET = withTenant(async (request: NextRequest) => {
  try {
    const tenantId = getTenantId(request)
    const userId = (request as any).user?.id

    // Get pending invitations directly
    const supabase = await createClient()
    const { data: pendingInvitations, error } = await supabase
      .from('tenant_invitations')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ invitations: pendingInvitations })
  } catch (error) {
    logger.error('Failed to get tenant invitations', { error })
    return NextResponse.json(
      { error: 'Failed to get invitations' },
      { status: 500 }
    )
  }
})

// POST /api/tenants/invitations - Invite user to tenant
export const POST = withTenant(async (request: NextRequest) => {
  try {
    const tenantId = getTenantId(request)
    const userId = (request as any).user?.id

    const body = await request.json()
    const validatedData = InviteUserRequestSchema.parse(body)

    const invitation = await tenantService.inviteUser(tenantId, validatedData, userId)

    return NextResponse.json({ invitation }, { status: 201 })
  } catch (error) {
    logger.error('Failed to invite user', { error })

    if (error instanceof Error && 'issues' in error) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
})