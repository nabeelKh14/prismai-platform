import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { contextEnrichmentService } from '@/lib/crm/enrichment'
import { withSecurity } from '@/lib/security'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const enrichSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID')
})

async function enrichConversation(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { conversationId } = enrichSchema.parse(body)

    // Verify the conversation belongs to the user
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .single()

    if (error || conversation.user_id !== user.id) {
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 })
    }

    const context = await contextEnrichmentService.enrichConversation(conversationId)

    return NextResponse.json({
      success: true,
      enriched: context !== null,
      context
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }

    logger.error('Failed to enrich conversation', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function batchEnrichConversations(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    const enrichedCount = await contextEnrichmentService.batchEnrichConversations(user.id, limit)

    return NextResponse.json({
      success: true,
      enrichedCount,
      message: `Enriched ${enrichedCount} conversations`
    })
  } catch (error) {
    logger.error('Failed to batch enrich conversations', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const POST = withSecurity({ requireAuth: true })(enrichConversation)
export const PUT = withSecurity({ requireAuth: true })(batchEnrichConversations)