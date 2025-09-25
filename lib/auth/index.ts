import { NextRequest, NextResponse } from 'next/server'
import { EnterpriseSecurity } from './enterprise-security'
import { RBACService } from './rbac-service'
import { SessionService } from './session-service'
import { logger } from '@/lib/logger'
import { RequestValidator, sanitizeString, sanitizeStringAdvanced } from '@/lib/security'
import { withRateLimit, rateLimiters } from '@/lib/rate-limit'

export interface AuthResult {
  success: boolean
  user?: any
  session?: any
  requiresMFA?: boolean
  mfaMethods?: string[]
  error?: string
}

export interface AuthOptions {
  requireAuth?: boolean
  requireMFA?: boolean
  requiredRoles?: string[]
  requiredPermissions?: Array<{ resource: string; action: string }>
  requireAdmin?: boolean
  allowPublicAccess?: boolean
  rateLimit?: boolean
  validateInput?: boolean
  logAccess?: boolean
}

/**
 * Enhanced authentication middleware with comprehensive security features
 */
export function withAuth(
  handler: (request: NextRequest, context?: AuthResult) => Promise<NextResponse | Response | void>,
  options: AuthOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse | Response | void> => {
    try {
      // Apply rate limiting if enabled
      if (options.rateLimit !== false) {
        const rateLimitedResponse = await withRateLimit(rateLimiters.api, {
          enableAbuseDetection: true
        })(async () => NextResponse.next())(request)

        if (rateLimitedResponse instanceof NextResponse && rateLimitedResponse.status === 429) {
          logger.logSecurity('API rate limit exceeded', undefined, {
            ip: request.headers.get('x-forwarded-for'),
            path: request.nextUrl.pathname
          })
          return rateLimitedResponse
        }
      }

      // Basic security validation
      RequestValidator.validateHeaders(request)
      RequestValidator.validateRequestSize(request, 1024 * 1024) // 1MB limit
      RequestValidator.detectSuspiciousPatterns(request)

      // Input validation if enabled
      if (options.validateInput !== false) {
        await validateRequestInput(request)
      }

      // Authentication check
      const authResult = await EnterpriseSecurity.authenticateRequest(request, {
        requireAuth: options.requireAuth,
        requireMFA: options.requireMFA,
        requireAdmin: options.requireAdmin
      })

      if (!authResult.success) {
        if (authResult.requiresMFA) {
          return NextResponse.json({
            error: authResult.error,
            requiresMFA: true,
            mfaMethods: authResult.mfaMethods
          }, { status: 401 })
        }

        return NextResponse.json({
          error: authResult.error
        }, { status: 401 })
      }

      // Role-based access control
      if (options.requiredRoles && options.requiredRoles.length > 0) {
        const userRoles = await RBACService.getUserRoles(authResult.user!.id)
        const userRoleNames = userRoles.map(role => role.role_name)
        const hasRequiredRole = options.requiredRoles.some(role =>
          userRoleNames.includes(role)
        )

        if (!hasRequiredRole) {
          logger.logSecurity('Insufficient role access', undefined, {
            userId: authResult.user!.id,
            requiredRoles: options.requiredRoles,
            userRoleNames,
            path: request.nextUrl.pathname
          })

          return NextResponse.json({
            error: 'Insufficient permissions'
          }, { status: 403 })
        }
      }

      // Permission-based access control
      if (options.requiredPermissions && options.requiredPermissions.length > 0) {
        for (const permission of options.requiredPermissions) {
          const hasPermission = await RBACService.hasPermission(
            authResult.user!.id,
            permission.resource,
            permission.action
          )

          if (!hasPermission) {
            logger.logSecurity('Insufficient permission access', undefined, {
              userId: authResult.user!.id,
              requiredPermission: permission,
              path: request.nextUrl.pathname
            })

            return NextResponse.json({
              error: `Insufficient permissions: ${permission.action} on ${permission.resource}`
            }, { status: 403 })
          }
        }
      }

      // Log access if enabled
      if (options.logAccess !== false) {
        await logApiAccess(request, authResult.user!)
      }

      // Execute the handler with authentication context
      return await handler(request, authResult)

    } catch (error) {
      logger.error('Authentication middleware error', { error })

      return NextResponse.json({
        error: 'Authentication failed'
      }, { status: 500 })
    }
  }
}

/**
 * Validate request input for security threats
 */
async function validateRequestInput(request: NextRequest): Promise<void> {
  const contentType = request.headers.get('content-type')

  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    if (contentType?.includes('application/json')) {
      try {
        const body = await request.json()

        // Sanitize string inputs
        if (body && typeof body === 'object') {
          sanitizeObject(body)
        }
      } catch (error) {
        throw new Error('Invalid JSON payload')
      }
    }
  }

  // Validate URL parameters
  const url = new URL(request.url)
  for (const [key, value] of url.searchParams.entries()) {
    if (typeof value === 'string' && value.length > 0) {
      // Basic sanitization of URL parameters
      if (value.includes('<') || value.includes('>') || value.includes('script')) {
        throw new Error('Invalid characters in URL parameters')
      }
    }
  }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeStringAdvanced(obj[key])
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key])
    }
  }
}

/**
 * Log API access for audit purposes
 */
async function logApiAccess(request: NextRequest, user: any): Promise<void> {
  try {
    const supabase = await import('@/lib/supabase/server').then(m => m.createClient())

    await supabase
      .from('api_access_log')
      .insert({
        user_id: user.id,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
        status_code: 200, // Will be updated if there's an error
        created_at: new Date().toISOString()
      })
  } catch (error) {
    logger.error('Failed to log API access', { error, userId: user.id })
  }
}

/**
 * Simple authentication function that wraps EnterpriseSecurity.authenticateRequest
 * @param request NextRequest object
 * @param requiredRoles Array of required roles (e.g., ['admin'])
 * @returns AuthResult
 */
export async function requireAuth(
  request: NextRequest,
  requiredRoles: string[] = []
): Promise<AuthResult> {
  const options: any = {
    requireAuth: true
  }

  // Check if admin role is required
  if (requiredRoles.includes('admin')) {
    options.requireAdmin = true
  }

  return await EnterpriseSecurity.authenticateRequest(request, options)
}

/**
 * API key authentication for external integrations
 */
export async function withApiKeyAuth(
  handler: (request: NextRequest, apiKey?: string) => Promise<NextResponse>,
  requiredScopes: string[] = []
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const apiKey = request.headers.get('x-api-key') ||
                     request.headers.get('authorization')?.replace('Bearer ', '')

      if (!apiKey) {
        return NextResponse.json({
          error: 'API key required'
        }, { status: 401 })
      }

      // Validate API key (implement your API key validation logic)
      const isValid = await validateApiKey(apiKey, requiredScopes)

      if (!isValid) {
        return NextResponse.json({
          error: 'Invalid or insufficient API key'
        }, { status: 403 })
      }

      return await handler(request, apiKey)

    } catch (error) {
      logger.error('API key authentication error', { error })
      return NextResponse.json({
        error: 'Authentication failed'
      }, { status: 500 })
    }
  }
}

/**
 * Validate API key and scopes
 */
async function validateApiKey(apiKey: string, requiredScopes: string[]): Promise<boolean> {
  try {
    const supabase = await import('@/lib/supabase/server').then(m => m.createClient())

    const { data: keyData } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key', apiKey)
      .eq('is_active', true)
      .single()

    if (!keyData) {
      return false
    }

    // Check if key is expired
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return false
    }

    // Check required scopes
    if (requiredScopes.length > 0) {
      const keyScopes = keyData.scopes || []
      return requiredScopes.every(scope => keyScopes.includes(scope))
    }

    return true
  } catch (error) {
    logger.error('API key validation error', { error })
    return false
  }
}

// Re-export EnterpriseSecurity for direct access
export { EnterpriseSecurity }