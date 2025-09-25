import { updateSession } from "@/lib/supabase/middleware"
import { developerPortalMiddleware } from "./middleware.developer-portal"
import { startSystemMetricsCollection } from "./middleware/performance-monitoring"
import { monitoringSecurityMiddleware, MonitoringRateLimiter } from "./middleware/monitoring-security"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { withSecurityHeaders, RequestValidator, CSRFProtection } from "@/lib/security"
import { withRateLimit, rateLimiters } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

// Start system metrics collection
if (typeof window === 'undefined') {
  startSystemMetricsCollection(5) // Collect every 5 minutes
}

// Security middleware configuration
const securityConfig = {
  enableCSP: true,
  enableHSTS: true,
  enablePermissionsPolicy: true,
  customHeaders: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
}

// Enhanced middleware with comprehensive security
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  try {
    // Skip middleware for static assets and API health checks
    if (
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/api/health') ||
      pathname.includes('.') ||
      pathname.startsWith('/favicon')
    ) {
      return NextResponse.next()
    }

    // Apply security headers to all responses
    const response = NextResponse.next()

    // Add comprehensive security headers
    const securityHeaders: Record<string, string> = {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=(), speaker=(), fullscreen=(self), ambient-light-sensor=(), autoplay=(self), encrypted-media=(self), picture-in-picture=()',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com https://api.vapi.ai wss://api.vapi.ai; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; block-all-mixed-content; require-sri-for script style",
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Server': 'Web Server'
    }

    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    // Remove server information
    response.headers.delete('X-Powered-By')

    // Basic security validation for all requests
    RequestValidator.validateHeaders(request)
    RequestValidator.validateRequestSize(request, 1024 * 1024) // 1MB limit

    // Apply rate limiting based on endpoint
    if (pathname.startsWith('/api/auth/')) {
      // Stricter rate limiting for auth endpoints
      const rateLimitedResponse = await withRateLimit(rateLimiters.auth, {
        enableAbuseDetection: true,
        enableCaptcha: true
      })(async () => NextResponse.next())(request)

      if (rateLimitedResponse instanceof NextResponse && rateLimitedResponse.status === 429) {
        logger.logSecurity('Authentication rate limit exceeded', undefined, {
          ip: request.headers.get('x-forwarded-for'),
          path: pathname
        })
        return rateLimitedResponse
      }
    } else if (pathname.startsWith('/api/ai/')) {
      // Rate limiting for AI endpoints
      const rateLimitedResponse = await withRateLimit(rateLimiters.aiCalls, {
        enableAbuseDetection: true
      })(async () => NextResponse.next())(request)

      if (rateLimitedResponse instanceof NextResponse && rateLimitedResponse.status === 429) {
        logger.logSecurity('AI endpoint rate limit exceeded', undefined, {
          ip: request.headers.get('x-forwarded-for'),
          path: pathname
        })
        return rateLimitedResponse
      }
    } else {
      // General API rate limiting
      const rateLimitedResponse = await withRateLimit(rateLimiters.api, {
        enableAbuseDetection: true
      })(async () => NextResponse.next())(request)

      if (rateLimitedResponse instanceof NextResponse && rateLimitedResponse.status === 429) {
        logger.logSecurity('API rate limit exceeded', undefined, {
          ip: request.headers.get('x-forwarded-for'),
          path: pathname
        })
        return rateLimitedResponse
      }
    }

    // CSRF protection for state-changing operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const csrfToken = request.headers.get('x-csrf-token')
      const sessionId = request.cookies.get('session_token')?.value

      if (csrfToken && sessionId) {
        const isValidCSRF = CSRFProtection.validateToken(csrfToken, sessionId)
        if (!isValidCSRF) {
          logger.logSecurity('CSRF validation failed', undefined, {
            path: pathname,
            method: request.method
          })
          return NextResponse.json(
            { error: 'CSRF validation failed' },
            { status: 403 }
          )
        }
      }
    }

    // Bot detection for suspicious patterns
    RequestValidator.detectBotActivity(request)

    // Session management
    const sessionToken = request.cookies.get('session_token')?.value
    if (sessionToken) {
      await updateSession(request)
    }

    // Developer portal middleware
    if (pathname.startsWith('/api/developer/')) {
      return developerPortalMiddleware(request)
    }

    // Monitoring security middleware
    if (pathname.startsWith('/api/monitoring/')) {
      return monitoringSecurityMiddleware(request)
    }

    return response

  } catch (error) {
    logger.error('Middleware error', { error, pathname })

    // Return error response with security headers
    const errorResponse = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )

    // Apply security headers even to error responses
    const errorSecurityHeaders: Record<string, string> = {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=(), speaker=(), fullscreen=(self), ambient-light-sensor=(), autoplay=(self), encrypted-media=(self), picture-in-picture=()',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com https://api.vapi.ai wss://api.vapi.ai; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; block-all-mixed-content; require-sri-for script style",
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Server': 'Web Server'
    }

    Object.entries(errorSecurityHeaders).forEach(([key, value]) => {
      errorResponse.headers.set(key, value)
    })

    return errorResponse
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
