import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError, AuthenticationError, ExternalServiceError } from "@/lib/errors"
import { requireEnv } from "@/lib/env"
import { VAPIClient } from "@/lib/ai/vapi-client"

// Validation schema
const initiateCallSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  assistantId: z.string().min(1, "Assistant ID is required"),
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const body = await request.json()
  const { phoneNumber, assistantId } = initiateCallSchema.parse(body)

    // Make call using VAPI
    const vapiClient = new VAPIClient({ apiKey: String(requireEnv('VAPI_API_KEY')) })

    let callResult
    try {
      callResult = await vapiClient.makeCall(phoneNumber, assistantId)
    } catch (error) {
      console.error('VAPI call initiation failed:', error)
      throw new ExternalServiceError('VAPI', `Failed to initiate call: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Log the call in database
    const { error: logError } = await supabase.from("call_logs").insert({
      user_id: user.id,
      caller_phone: phoneNumber,
      call_status: "initiated",
      created_at: new Date().toISOString(),
    })

    if (logError) {
      console.error('Failed to log call:', logError)
      // Don't throw here as the call was successful, just log the error
    }

    return NextResponse.json({
      success: true,
      callId: callResult.id,
      status: "ringing",
    })
})
