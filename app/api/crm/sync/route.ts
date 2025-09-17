import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crmService } from '@/lib/crm/service'
import { withSecurity } from '@/lib/security'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const syncSchema = z.object({
  provider: z.enum(['salesforce', 'hubspot', 'pipedrive']),
  fullSync: z.boolean().default(false),
  since: z.string().datetime().optional(),
  batchSize: z.number().min(1).max(1000).default(100)
})

async function syncCRMData(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, fullSync, since, batchSize } = syncSchema.parse(body)

    const result = await crmService.syncCustomers(user.id, provider, {
      fullSync,
      since: since ? new Date(since) : undefined,
      batchSize
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }

    logger.error('Failed to sync CRM data', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const POST = withSecurity({ requireAuth: true })(syncCRMData)