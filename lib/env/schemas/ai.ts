import { z } from 'zod'

/**
 * AI services configuration schema
 * Contains API keys for external AI services
 */
export const aiSchema = z.object({
  // AI Services (Required)
  GEMINI_API_KEY: z.string().min(1),
  VAPI_API_KEY: z.string().min(1),
})