import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { RequestValidator } from '@/lib/security'

export const GET = async (request: NextRequest) => {
  try {
    // Basic security validation
    RequestValidator.validateHeaders(request)
    RequestValidator.detectSuspiciousPatterns(request)

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${request.nextUrl.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      logger.error('Google OAuth initiation failed', { error })
      return NextResponse.redirect(
        new URL('/auth/login?error=google_oauth_failed', request.url)
      )
    }

    logger.info('Google OAuth initiated successfully')
    return NextResponse.redirect(data.url)

  } catch (error) {
    logger.error('Google OAuth error', { error })
    return NextResponse.redirect(
      new URL('/auth/login?error=google_oauth_error', request.url)
    )
  }
}