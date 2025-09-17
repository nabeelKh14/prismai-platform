import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { ApiKeyManager } from '@/lib/rate-limit/api-keys'

export class DeveloperPortalSecurity {
  /**
   * Middleware for developer portal routes
   * Ensures user is authenticated and has appropriate permissions
   */
  static async authenticateDeveloper(request: NextRequest): Promise<NextResponse | null> {
    try {
      const supabase = await createClient()

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        logger.warn('Unauthorized access to developer portal', {
          path: request.nextUrl.pathname,
          ip: this.getClientIP(request),
          userAgent: request.headers.get('user-agent')
        })

        return NextResponse.redirect(new URL('/auth/login', request.url))
      }

      // Check if user has developer access (you could add a role check here)
      // For now, any authenticated user can access

      // Log successful access
      logger.info('Developer portal access granted', {
        userId: user.id,
        path: request.nextUrl.pathname,
        ip: this.getClientIP(request)
      })

      return null // Continue with request
    } catch (error) {
      logger.error('Error in developer portal authentication', error as Error)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      )
    }
  }

  /**
   * Validate API key for testing endpoints
   */
  static async validateApiKeyForTesting(apiKey: string, userId: string): Promise<boolean> {
    try {
      const keyInfo = await ApiKeyManager.validateApiKey(apiKey)

      if (!keyInfo) {
        return false
      }

      // Check if the API key belongs to the user
      return keyInfo.userId === userId
    } catch (error) {
      logger.error('Error validating API key for testing', error as Error)
      return false
    }
  }

  /**
   * Rate limiting for developer portal actions
   */
  static async checkDeveloperRateLimit(request: NextRequest, userId: string): Promise<boolean> {
    // Implement rate limiting for developer portal actions
    // For now, allow all requests
    return true
  }

  /**
   * Log developer portal activities for audit
   */
  static async logDeveloperActivity(
    userId: string,
    action: string,
    details: Record<string, any>,
    request: NextRequest
  ): Promise<void> {
    try {
      logger.info('Developer portal activity', {
        userId,
        action,
        details,
        ip: this.getClientIP(request),
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      })

      // In production, you might want to store this in a database
      // for compliance and audit purposes
    } catch (error) {
      logger.error('Failed to log developer activity', error as Error)
    }
  }

  /**
   * Security headers for developer portal
   */
  static addSecurityHeaders(response: NextResponse): NextResponse {
    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

    // CSP for developer portal
    response.headers.set('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self'; " +
      "connect-src 'self' https://api.aibusinesssuite.com; " +
      "frame-ancestors 'none';"
    )

    return response
  }

  /**
   * Sanitize user inputs for developer portal
   */
  static sanitizeInput(input: string): string {
    // Basic sanitization - in production, use a proper sanitization library
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()
  }

  /**
   * Get client IP address
   */
  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfIP = request.headers.get('cf-connecting-ip')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    return realIP || cfIP || 'unknown'
  }
}