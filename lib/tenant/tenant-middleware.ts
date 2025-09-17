import { NextRequest, NextResponse } from 'next/server'
import { tenantService } from '@/lib/tenant/tenant-service'
import { logger } from '@/lib/logger'
import { AuthenticationError, AuthorizationError } from '@/lib/errors'

export interface TenantRequest extends NextRequest {
  tenantId?: string
  tenantContext?: Awaited<ReturnType<typeof tenantService.getTenantContext>>
}

/**
 * Middleware to handle tenant context and isolation
 */
export async function withTenantIsolation(
  request: NextRequest,
  handler: (req: TenantRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Extract tenant ID from various sources
    const tenantId = await extractTenantId(request)

    if (!tenantId) {
      // If no tenant context, this might be a public route or user needs to select/create tenant
      return handler(request)
    }

    // Get user ID from auth (assuming it's set by auth middleware)
    const userId = (request as any).user?.id

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user has access to this tenant
    try {
      await tenantService.checkTenantAccess(userId, tenantId)
    } catch (error) {
      logger.warn('Tenant access denied', {
        userId,
        tenantId,
        path: request.nextUrl.pathname,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return NextResponse.json(
        { error: 'Access denied to tenant' },
        { status: 403 }
      )
    }

    // Get full tenant context
    const tenantContext = await tenantService.getTenantContext(userId, tenantId)

    // Add tenant context to request
    const tenantRequest: TenantRequest = Object.assign(request, {
      tenantId,
      tenantContext,
    })

    // Add tenant context to response headers for client-side access
    const response = await handler(tenantRequest)

    if (response instanceof NextResponse) {
      response.headers.set('X-Tenant-ID', tenantId)
      response.headers.set('X-Tenant-Role', tenantContext.userRole)
      response.headers.set('X-Tenant-Name', tenantContext.tenant.name)
    }

    return response

  } catch (error) {
    logger.error('Tenant middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: request.nextUrl.pathname,
      userId: (request as any).user?.id
    })

    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Extract tenant ID from request
 * Priority order:
 * 1. X-Tenant-ID header
 * 2. tenantId query parameter
 * 3. Subdomain (for custom domains)
 * 4. User's default tenant
 */
async function extractTenantId(request: NextRequest): Promise<string | null> {
  // Check header
  const headerTenantId = request.headers.get('X-Tenant-ID')
  if (headerTenantId) {
    return headerTenantId
  }

  // Check query parameter
  const queryTenantId = request.nextUrl.searchParams.get('tenantId')
  if (queryTenantId) {
    return queryTenantId
  }

  // Check subdomain
  const hostname = request.headers.get('host') || ''
  const subdomain = extractSubdomain(hostname)
  if (subdomain) {
    // Look up tenant by subdomain
    try {
      const tenantId = await getTenantIdBySubdomain(subdomain)
      if (tenantId) {
        return tenantId
      }
    } catch (error) {
      logger.warn('Failed to lookup tenant by subdomain', { subdomain, error })
    }
  }

  // For authenticated requests, try to get user's default tenant
  const userId = (request as any).user?.id
  if (userId) {
    try {
      const userTenants = await tenantService.getUserTenants(userId)
      if (userTenants.length === 1) {
        // If user has only one tenant, use it
        return userTenants[0].id
      }
      // If user has multiple tenants, they need to specify which one
      return null
    } catch (error) {
      logger.warn('Failed to get user tenants', { userId, error })
    }
  }

  return null
}

/**
 * Extract subdomain from hostname
 */
function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0]

  // Handle localhost and IP addresses
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null
  }

  // Split by dots
  const parts = host.split('.')

  // If we have more than 2 parts, the first part is likely a subdomain
  if (parts.length > 2) {
    return parts[0]
  }

  return null
}

/**
 * Get tenant ID by subdomain
 * This would typically query the database
 */
async function getTenantIdBySubdomain(subdomain: string): Promise<string | null> {
  // This is a placeholder - in a real implementation, you'd query the tenants table
  // For now, return null as we don't have the database query implemented yet
  return null
}

/**
 * Higher-order function to wrap API routes with tenant isolation
 */
export function withTenant<T extends any[]>(
  handler: (request: TenantRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    return withTenantIsolation(request, (tenantRequest) => handler(tenantRequest, ...args))
  }
}

/**
 * Check if current user has permission in their tenant context
 */
export async function checkTenantPermission(
  request: TenantRequest,
  permission: string
): Promise<void> {
  if (!request.tenantContext) {
    throw new AuthorizationError('No tenant context available')
  }

  if (!request.tenantContext.permissions.includes(permission)) {
    throw new AuthorizationError(`Insufficient permissions: ${permission}`)
  }
}

/**
 * Get current tenant context from request
 */
export function getTenantContext(request: TenantRequest) {
  if (!request.tenantContext) {
    throw new AuthorizationError('No tenant context available')
  }
  return request.tenantContext
}

/**
 * Get current tenant ID from request
 */
export function getTenantId(request: TenantRequest): string {
  if (!request.tenantId) {
    throw new AuthorizationError('No tenant ID available')
  }
  return request.tenantId
}