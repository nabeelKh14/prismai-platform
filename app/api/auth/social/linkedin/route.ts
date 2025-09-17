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
      provider: 'linkedin_oidc',
      options: {
        redirectTo: `${request.nextUrl.origin}/auth/callback`,
        scopes: 'openid profile email',
      },
    })

    if (error) {
      logger.error('LinkedIn OAuth initiation failed', { error })
      return NextResponse.redirect(
        new URL('/auth/login?error=linkedin_oauth_failed', request.url)
      )
    }

    logger.info('LinkedIn OAuth initiated successfully')
    return NextResponse.redirect(data.url)

  } catch (error) {
    logger.error('LinkedIn OAuth error', { error })
    return NextResponse.redirect(
      new URL('/auth/login?error=linkedin_oauth_error', request.url)
    )
  }
}