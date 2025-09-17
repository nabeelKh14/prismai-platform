import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversation_id = searchParams.get('conversation_id')
    const message_id = searchParams.get('message_id')

    let query = supabase
      .from('file_attachments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (conversation_id) {
      query = query.eq('conversation_id', conversation_id)
    }

    if (message_id) {
      query = query.eq('message_id', message_id)
    }

    const { data: files, error } = await query

    if (error) {
      console.error('Error fetching files:', error)
      return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 })
    }

    return NextResponse.json(files)
  } catch (error) {
    console.error('Error in files API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const file_id = searchParams.get('file_id')

    if (!file_id) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 })
    }

    // Get file details
    const { data: file, error: fetchError } = await supabase
      .from('file_attachments')
      .select('file_path')
      .eq('id', file_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('file_attachments')
      .delete()
      .eq('id', file_id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting file record:', deleteError)
      return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
    }

    // Delete from storage
    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js")
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: storageError } = await supabaseAdmin.storage
      .from('files')
      .remove([file.file_path])

    if (storageError) {
      console.error('Error deleting file from storage:', storageError)
      // Don't return error here as database record is already deleted
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in files DELETE:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}