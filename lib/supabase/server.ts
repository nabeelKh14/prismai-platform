import { createServerClient } from "@supabase/ssr"
import { requireEnv } from "@/lib/env"

export async function createClient() {
  // Dynamically import cookies only when needed to avoid build-time issues
  let cookieStore: any = null
  try {
    const { cookies } = await import("next/headers")
    cookieStore = await cookies()
  } catch {
    // If cookies can't be imported/accessed, use empty cookie store
    cookieStore = {
      getAll: () => [],
      set: () => {}
    }
  }

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL') as string,
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') as string,
    {
      cookies: {
        getAll() {
          return cookieStore?.getAll?.() || []
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            if (cookieStore?.set && cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            }
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
