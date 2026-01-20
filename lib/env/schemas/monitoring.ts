import { z } from 'zod'

/**
 * Monitoring and performance configuration schema
 * Contains logging, database, and health check settings
 */
export const monitoringSchema = z.object({
  // Performance & Monitoring (Public)
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(false),

  // Performance & Monitoring (Server)
  DATABASE_CONNECTION_LIMIT: z.coerce.number().default(20),
  HEALTH_CHECK_TOKEN: z.string().optional(),
})