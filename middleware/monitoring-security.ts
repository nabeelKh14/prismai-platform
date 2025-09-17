import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Security middleware for monitoring endpoints
 * Ensures proper authentication and authorization for sensitive monitoring data
 */
export async function monitoringSecurityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname

  // Check if this is a monitoring endpoint
  if (!pathname.startsWith('/api/monitoring') && !pathname.startsWith('/api/health')) {
    return null // Not a monitoring endpoint, continue
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      // Log unauthorized access attempt
      logger.warn('Unauthorized access to monitoring endpoint', {
        pathname,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
        method: request.method
      })

      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check user role for sensitive endpoints
    if (pathname.includes('/logs') || pathname.includes('/performance') || pathname.includes('/alerts')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'manager'].includes(profile.role)) {
        logger.warn('Insufficient permissions for monitoring endpoint', {
          userId: user.id,
          role: profile?.role,
          pathname,
          method: request.method
        })

        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    // Log monitoring access for audit purposes
    logger.info('Monitoring endpoint accessed', {
      userId: user.id,
      pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    })

    return null // Continue with the request

  } catch (error) {
    logger.error('Monitoring security middleware error', { error, pathname })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Rate limiting for monitoring endpoints
 */
export class MonitoringRateLimiter {
  private static requests = new Map<string, { count: number; resetTime: number }>()
  private static readonly WINDOW_MS = 15 * 60 * 1000 // 15 minutes
  private static readonly MAX_REQUESTS = 100 // requests per window

  static checkLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const userRequests = this.requests.get(identifier)

    if (!userRequests || now > userRequests.resetTime) {
      // Reset or initialize
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.WINDOW_MS
      })
      return { allowed: true, remaining: this.MAX_REQUESTS - 1, resetTime: now + this.WINDOW_MS }
    }

    if (userRequests.count >= this.MAX_REQUESTS) {
      return { allowed: false, remaining: 0, resetTime: userRequests.resetTime }
    }

    userRequests.count++
    return {
      allowed: true,
      remaining: this.MAX_REQUESTS - userRequests.count,
      resetTime: userRequests.resetTime
    }
  }

  static getRemainingTime(identifier: string): number {
    const userRequests = this.requests.get(identifier)
    if (!userRequests) return 0

    const now = Date.now()
    return Math.max(0, userRequests.resetTime - now)
  }
}

/**
 * Data sanitization for monitoring responses
 * Removes sensitive information from logs and metrics
 */
export function sanitizeMonitoringData(data: any): any {
  if (!data) return data

  const sensitiveFields = [
    'password', 'token', 'key', 'secret', 'authorization',
    'api_key', 'access_token', 'refresh_token', 'session_id'
  ]

  if (typeof data === 'object') {
    const sanitized = Array.isArray(data) ? [...data] : { ...data }

    for (const [key, value] of Object.entries(sanitized)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeMonitoringData(value)
      }
    }

    return sanitized
  }

  return data
}

/**
 * Audit logging for monitoring actions
 */
export async function logMonitoringAction(
  action: string,
  userId: string,
  details: Record<string, any>,
  request: NextRequest
): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: `monitoring:${action}`,
      details: sanitizeMonitoringData(details),
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to log monitoring action', { error, action, userId })
  }
}

/**
 * Compliance utilities for monitoring data
 */
export class MonitoringCompliance {
  /**
   * Check if user can access monitoring data based on compliance rules
   */
  static async checkDataAccess(userId: string, dataType: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      // Check user's compliance clearance
      const { data: profile } = await supabase
        .from('profiles')
        .select('compliance_clearance, role')
        .eq('id', userId)
        .single()

      if (!profile) return false

      // Define access rules based on data sensitivity
      const accessRules: Record<string, string[]> = {
        'logs': ['admin', 'manager', 'analyst'],
        'performance': ['admin', 'manager', 'developer'],
        'alerts': ['admin', 'manager'],
        'health': ['admin', 'manager', 'developer', 'analyst']
      }

      const allowedRoles = accessRules[dataType] || []
      return allowedRoles.includes(profile.role) && profile.compliance_clearance

    } catch (error) {
      logger.error('Failed to check data access compliance', { error, userId, dataType })
      return false
    }
  }

  /**
   * Anonymize user data in monitoring responses
   */
  static anonymizeUserData(data: any): any {
    if (!data) return data

    if (typeof data === 'object') {
      const anonymized = Array.isArray(data) ? [...data] : { ...data }

      // Anonymize user identifiers
      if (anonymized.user_id) {
        anonymized.user_id = this.hashUserId(anonymized.user_id)
      }
      if (anonymized.userId) {
        anonymized.userId = this.hashUserId(anonymized.userId)
      }
      if (anonymized.email) {
        anonymized.email = this.anonymizeEmail(anonymized.email)
      }
      if (anonymized.ip_address) {
        anonymized.ip_address = this.anonymizeIP(anonymized.ip_address)
      }

      // Recursively anonymize nested objects
      for (const [key, value] of Object.entries(anonymized)) {
        if (typeof value === 'object') {
          anonymized[key] = this.anonymizeUserData(value)
        }
      }

      return anonymized
    }

    return data
  }

  private static hashUserId(userId: string): string {
    // Simple hash for anonymization (in production, use proper hashing)
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash).toString(36)}`
  }

  private static anonymizeEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (local.length <= 2) return `${local}***@${domain}`
    return `${local.substring(0, 2)}***@${domain}`
  }

  private static anonymizeIP(ip: string): string {
    // Anonymize last octet of IPv4 or last segment of IPv6
    if (ip.includes('.')) {
      // IPv4
      const parts = ip.split('.')
      return `${parts.slice(0, -1).join('.')}.***`
    } else if (ip.includes(':')) {
      // IPv6
      const parts = ip.split(':')
      return `${parts.slice(0, -1).join(':')}:****`
    }
    return ip
  }
}