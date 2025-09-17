import { NextRequest, NextResponse } from 'next/server'
import { tenantService } from '@/lib/tenant/tenant-service'
import { withTenant, getTenantContext } from '@/lib/tenant/tenant-middleware'
import { logger } from '@/lib/logger'
import { CreateTenantRequestSchema } from '@/lib/types/tenant'

// GET /api/tenants - Get user's tenants
export const GET = withTenant(async (request: NextRequest) => {
  try {
    const userId = (request as any).user?.id

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const tenants = await tenantService.getUserTenants(userId)

    return NextResponse.json({ tenants })
  } catch (error) {
    logger.error('Failed to get user tenants', { error })
    return NextResponse.json(
      { error: 'Failed to get tenants' },
      { status: 500 }
    )
  }
})

// POST /api/tenants - Create new tenant
export const POST = async (request: NextRequest) => {
  try {
    const userId = (request as any).user?.id

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = CreateTenantRequestSchema.parse(body)

    const tenant = await tenantService.createTenant(validatedData, userId)

    return NextResponse.json({ tenant }, { status: 201 })
  } catch (error) {
    logger.error('Failed to create tenant', { error })

    if (error instanceof Error && 'issues' in error) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create tenant' },
      { status: 500 }
    )
  }
}