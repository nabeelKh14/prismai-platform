import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { multiModalHandler } from '@/lib/ai/multi-modal-handler'
import { syncOrchestrator } from '@/lib/ai/synchronization-orchestrator'

export async function POST(request: NextRequest) {
  try {
    const { customerIdentifier, channel = 'demo', modality = 'text' } = await request.json()
    const supabase = await createClient()

    // Get user from auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create unified conversation
    const { data: conversation, error } = await supabase
      .from('unified_conversations')
      .insert({
        user_id: user.id,
        customer_identifier: customerIdentifier,
        channel,
        modality
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversations } = await supabase
      .from('unified_conversations')
      .select(`
        *,
        unified_messages (
          id,
          modality,
          sender_type,
          content,
          audio_url,
          sequence_number,
          timestamp,
          processing_time_ms,
          confidence_score
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}