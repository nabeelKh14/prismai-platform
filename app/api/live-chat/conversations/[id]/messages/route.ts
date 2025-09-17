import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await params

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const conversationId = id

    // Get messages for the conversation
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        conversation_id,
        sender_type,
        content,
        message_type,
        metadata,
        created_at,
        detected_language,
        translated_from,
        translated_to
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    // Transform messages for the chat interface
    const transformedMessages = messages?.map(msg => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_type: msg.sender_type,
      content: msg.content,
      timestamp: msg.created_at,
      sender_name: msg.sender_type === 'agent' ? 'Agent' : 'Customer'
    })) || []

    return NextResponse.json(transformedMessages)
  } catch (error) {
    console.error('Error in conversation messages API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await params

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const conversationId = id
    const body = await request.json()
    const { content, sender_type, sender_name } = body

    // Insert new message
    const { data: newMessage, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_type,
        content,
        message_type: 'text',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting message:', error)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    // Update conversation's updated_at timestamp
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    // Transform for response
    const transformedMessage = {
      id: newMessage.id,
      conversation_id: newMessage.conversation_id,
      sender_type: newMessage.sender_type,
      content: newMessage.content,
      timestamp: newMessage.created_at,
      sender_name: sender_name || (sender_type === 'agent' ? 'Agent' : 'Customer')
    }

    return NextResponse.json(transformedMessage)
  } catch (error) {
    console.error('Error in send message API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}