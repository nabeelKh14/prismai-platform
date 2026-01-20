import { z } from 'zod'

/**
 * Application configuration schema
 * Contains basic app settings available in both client and server environments
 */
export const appSchema = z.object({
  // Node.js Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Application URLs
  NEXT_PUBLIC_APP_URL: z.string().url(),
})