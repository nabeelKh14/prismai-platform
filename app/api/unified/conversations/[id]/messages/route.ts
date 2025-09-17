import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const conversationId = params.id

    // Get user from auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify conversation belongs to user
    const { data: conversation } = await supabase
      .from('unified_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Fetch messages
    const { data: messages, error } = await supabase
      .from('unified_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sequence_number', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      messages: messages || [],
      conversationId
    })
  } catch (error) {
    console.error('Failed to fetch conversation messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}