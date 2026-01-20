import { z } from 'zod'

/**
 * Caching configuration schema
 * Contains Redis and Upstash caching settings
 */
export const cachingSchema = z.object({
  // Optional Redis/Caching
  UPSTASH_REDIS_REST_URL: z.string().refine(
    (val) => val === '' || z.string().url().safeParse(val).success,
    { message: 'UPSTASH_REDIS_REST_URL must be a valid URL or empty string' }
  ),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  REDIS_URL: z.string().refine(
    (val) => val === '' || z.string().url().safeParse(val).success,
    { message: 'REDIS_URL must be a valid URL or empty string' }
  ),
})