import { updateSession } from "@/lib/supabase/middleware"
import { developerPortalMiddleware } from "./middleware.developer-portal"
import { monitoringSecurityMiddleware, MonitoringRateLimiter } from "./middleware/monitoring-security"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { withSecurityHeaders, RequestValidator, CSRFProtection } from "@/lib/security"
import { withRateLimit, rateLimiters, createRateLimiter } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { isDevelopment } from "@/lib/env"

// Simplified middleware for development
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

    // Add basic security headers (relaxed for development)
    const securityHeaders: Record<string, string> = isDevelopment ? {
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' http: https: ws: wss: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; style-src 'self' 'unsafe-inline' http: https:; img-src 'self' data: https: http: blob:; font-src 'self' data: https: http:; connect-src 'self' https: http: ws: wss:; media-src 'self' https: http:; object-src 'none'; base-uri 'self'; form-action 'self' http: https:; frame-ancestors 'self' http: https:; upgrade-insecure-requests",
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Server': 'Next.js Development Server'
    } : {
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

    // Basic security validation for all requests (relaxed for development)
    if (!isDevelopment) {
      RequestValidator.validateHeaders(request)
      RequestValidator.validateRequestSize(request, 1024 * 1024) // 1MB limit
    } else {
      // In development, only do basic validation
      RequestValidator.validateRequestSize(request, 10 * 1024 * 1024) // 10MB limit for development
    }

    // Apply rate limiting based on endpoint (relaxed for development)
    if (isDevelopment) {
      // In development, use very relaxed rate limiting
      const devRateLimiter = createRateLimiter({
        maxRequests: 10000,
        windowMs: 60 * 60 * 1000, // 1 hour
      })

      const rateLimitedResponse = await withRateLimit(devRateLimiter, {
        skipIf: () => true // Skip rate limiting in development
      })(async () => NextResponse.next())(request)

      if (rateLimitedResponse instanceof NextResponse && rateLimitedResponse.status === 429) {
        logger.logSecurity('Rate limit exceeded', undefined, {
          ip: request.headers.get('x-forwarded-for'),
          path: pathname
        })
        return rateLimitedResponse
      }
    } else {
      // Production rate limiting
      if (pathname.startsWith('/api/auth/')) {
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
    }

    // CSRF protection for state-changing operations (relaxed for development)
    if (!isDevelopment && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
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

    // Bot detection for suspicious patterns (skip in development)
    if (!isDevelopment) {
      RequestValidator.detectBotActivity(request)
    }

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

// System metrics collection has been removed

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


export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
