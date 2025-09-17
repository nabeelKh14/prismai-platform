import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-rar-compressed'
]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const conversation_id = formData.get('conversation_id') as string
    const message_id = formData.get('message_id') as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
    }

    // Verify conversation belongs to user if provided
    if (conversation_id) {
      const { data: conversation, error: convError } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('id', conversation_id)
        .eq('user_id', user.id)
        .single()

      if (convError || !conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
      }
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `user-uploads/${user.id}/${fileName}`

    // Upload to Supabase Storage
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('files')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('File upload error:', uploadError)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('files')
      .getPublicUrl(filePath)

    // Save file metadata to database
    const { data: fileRecord, error: dbError } = await supabase
      .from('file_attachments')
      .insert({
        user_id: user.id,
        conversation_id: conversation_id || null,
        message_id: message_id || null,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file_path: filePath,
        file_url: publicUrl,
        uploaded_by: user.id
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Try to clean up uploaded file
      await supabaseAdmin.storage.from('files').remove([filePath])
      return NextResponse.json({ error: "Failed to save file metadata" }, { status: 500 })
    }

    return NextResponse.json({
      id: fileRecord.id,
      file_name: fileRecord.file_name,
      file_size: fileRecord.file_size,
      file_type: fileRecord.file_type,
      file_url: fileRecord.file_url,
      uploaded_at: fileRecord.created_at
    })
  } catch (error) {
    console.error('Error in file upload:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}