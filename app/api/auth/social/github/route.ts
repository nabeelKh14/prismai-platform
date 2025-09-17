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
      provider: 'github',
      options: {
        redirectTo: `${request.nextUrl.origin}/auth/callback`,
        scopes: 'read:user user:email',
      },
    })

    if (error) {
      logger.error('GitHub OAuth initiation failed', { error })
      return NextResponse.redirect(
        new URL('/auth/login?error=github_oauth_failed', request.url)
      )
    }

    logger.info('GitHub OAuth initiated successfully')
    return NextResponse.redirect(data.url)

  } catch (error) {
    logger.error('GitHub OAuth error', { error })
    return NextResponse.redirect(
      new URL('/auth/login?error=github_oauth_error', request.url)
    )
  }
}