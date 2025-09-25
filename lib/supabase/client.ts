import { createBrowserClient } from '@supabase/ssr'
import { requireEnv } from '@/lib/env'

export function createClient() {
  return createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL') as unknown as string,
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') as unknown as string
  )
}
