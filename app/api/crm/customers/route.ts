import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crmService } from '@/lib/crm/service'
import { withSecurity } from '@/lib/security'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const searchSchema = z.object({
  query: z.string().min(1).max(100),
  provider: z.enum(['salesforce', 'hubspot', 'pipedrive']).optional()
})

async function searchCustomers(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const provider = searchParams.get('provider') as 'salesforce' | 'hubspot' | 'pipedrive' | undefined

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    const customers = await crmService.searchCustomers(user.id, query, provider)

    return NextResponse.json({ customers })
  } catch (error) {
    logger.error('Failed to search customers', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getCustomers(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all customers for the user
    const { data, error } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ customers: data || [] })
  } catch (error) {
    logger.error('Failed to get customers', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withSecurity({ requireAuth: true })(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (query) {
    return searchCustomers(request)
  } else {
    return getCustomers(request)
  }
})