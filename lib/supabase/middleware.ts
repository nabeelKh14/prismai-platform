import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { requireEnv } from "@/lib/env"

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // List of routes that should be accessible without authentication
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/sign-up',
    '/auth/sign-up-success',
    '/auth/error',
    '/demo'
  ]
  
  // Check if current path is public
  const isPublicRoute = publicRoutes.includes(pathname)
  
  // If it's a public route, allow access without authentication check
  if (isPublicRoute) {
    console.log('Allowing access to public route:', pathname)
    return NextResponse.next()
  }
  
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL') as unknown as string,
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') as unknown as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  // If user is not authenticated and trying to access protected route
  if (!user) {
    console.log('No user found, redirecting to login from:', pathname)
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
