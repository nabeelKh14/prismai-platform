import { NextRequest, NextResponse } from 'next/server'
import { tenantConfigService } from '@/lib/tenant/tenant-config-service'
import { withTenant, getTenantId } from '@/lib/tenant/tenant-middleware'
import { logger } from '@/lib/logger'

// GET /api/tenants/config - Get all tenant configurations
export const GET = withTenant(async (request: NextRequest) => {
  try {
    const tenantId = getTenantId(request)
    const userId = (request as any).user?.id

    const configs = await tenantConfigService.getAllTenantConfigs(tenantId, userId)

    return NextResponse.json({ configs })
  } catch (error) {
    logger.error('Failed to get tenant configs', { error })
    return NextResponse.json(
      { error: 'Failed to get configurations' },
      { status: 500 }
    )
  }
})

// POST /api/tenants/config - Set tenant configuration
export const POST = withTenant(async (request: NextRequest) => {
  try {
    const tenantId = getTenantId(request)
    const userId = (request as any).user?.id

    const { configKey, configValue } = await request.json()

    if (!configKey || configValue === undefined) {
      return NextResponse.json(
        { error: 'configKey and configValue are required' },
        { status: 400 }
      )
    }

    await tenantConfigService.setTenantConfig(tenantId, configKey, configValue, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to set tenant config', { error })

    if (error instanceof Error && error.message.includes('Validation failed')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    )
  }
})