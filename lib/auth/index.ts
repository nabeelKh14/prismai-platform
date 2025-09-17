import { NextRequest } from 'next/server'
import { EnterpriseSecurity, AuthResult } from './enterprise-security'

export interface AuthResult {
  success: boolean
  user?: any
  session?: any
  requiresMFA?: boolean
  mfaMethods?: string[]
  error?: string
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

// Re-export EnterpriseSecurity for direct access
export { EnterpriseSecurity }