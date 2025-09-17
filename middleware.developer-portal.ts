import { NextRequest, NextResponse } from 'next/server'
import { DeveloperPortalSecurity } from '@/lib/developer-portal-security'

export async function developerPortalMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl

  // Only apply to developer portal routes
  if (!pathname.startsWith('/developer-portal')) {
    return null
  }

  // Authenticate user
  const authResult = await DeveloperPortalSecurity.authenticateDeveloper(request)
  if (authResult) {
    return authResult
  }

  // Get user ID for rate limiting and logging
  const supabaseResponse = await fetch(`${request.nextUrl.origin}/api/auth/session`, {
    headers: {
      cookie: request.headers.get('cookie') || ''
    }
  })

  let userId = 'unknown'
  try {
    const session = await supabaseResponse.json()
    userId = session?.user?.id || 'unknown'
  } catch (e) {
    // Ignore session fetch errors
  }

  // Check rate limiting
  const rateLimitOk = await DeveloperPortalSecurity.checkDeveloperRateLimit(request, userId)
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    )
  }

  // Log activity
  await DeveloperPortalSecurity.logDeveloperActivity(
    userId,
    'page_access',
    { pathname, method: request.method },
    request
  )

  return null // Continue with request
}