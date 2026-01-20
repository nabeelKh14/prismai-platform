import { z } from 'zod'

/**
 * Email service configuration schema
 * Contains settings for email providers (Resend, SMTP)
 */
export const emailSchema = z.object({
  // Optional Email Service
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
})