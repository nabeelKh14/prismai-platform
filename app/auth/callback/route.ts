import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const GET = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        const forwardedHost = request.headers.get('x-forwarded-host')
        const isLocalEnv = process.env.NODE_ENV === 'development'

        if (isLocalEnv) {
          // We can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
          return NextResponse.redirect(`${origin}${next}`)
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`)
        } else {
          return NextResponse.redirect(`${origin}${next}`)
        }
      }

      logger.error('OAuth callback failed', { error })
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/login?error=oauth_callback_failed`)

  } catch (error) {
    logger.error('OAuth callback error', { error })
    return NextResponse.redirect(
      new URL('/auth/login?error=oauth_callback_error', request.url)
    )
  }
}