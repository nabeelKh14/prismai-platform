import { z } from 'zod'

/**
 * Supabase configuration schema
 * Contains database and authentication settings
 */
export const supabaseSchema = z.object({
  // Supabase Configuration (Public)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  // Supabase Configuration (Server)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})