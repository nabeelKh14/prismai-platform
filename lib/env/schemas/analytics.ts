import { z } from 'zod'

/**
 * Analytics and monitoring configuration schema
 * Contains optional analytics and error tracking settings
 */
export const analyticsSchema = z.object({
  // Optional Analytics
  VERCEL_ANALYTICS_ID: z.string().optional(),

  // Optional Error Tracking - allows empty string or valid URL
  SENTRY_DSN: z.string().refine(
    (val) => val === '' || z.string().url().safeParse(val).success,
    { message: 'SENTRY_DSN must be a valid URL or empty string' }
  ),
})