import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crmService } from '@/lib/crm/service'
import { withSecurity } from '@/lib/security'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const crmConfigSchema = z.object({
  provider: z.enum(['salesforce', 'hubspot', 'pipedrive']),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  instanceUrl: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
  isActive: z.boolean().default(true)
})

async function getCRMConfigs(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configs = await crmService.getActiveCRMConfigs(user.id)

    return NextResponse.json({ configs })
  } catch (error) {
    logger.error('Failed to get CRM configs', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function createCRMConfig(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = crmConfigSchema.parse(body)

    const config = await crmService.saveCRMConfig({
      ...validatedData,
      userId: user.id
    })

    return NextResponse.json({ config }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }

    logger.error('Failed to create CRM config', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withSecurity({ requireAuth: true })(getCRMConfigs)
export const POST = withSecurity({ requireAuth: true })(createCRMConfig)