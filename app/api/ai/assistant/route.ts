import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, ValidationError, AuthenticationError, ExternalServiceError } from "@/lib/errors"
import { requireEnv } from "@/lib/env"

// Validation schemas
const createAssistantSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(100),
  services: z.array(z.string()).min(1, "At least one service is required").max(20),
  greetingMessage: z.string().max(500).optional(),
  businessHours: z.record(z.any()).optional(),
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
  const validatedData = createAssistantSchema.parse(body)
  const { businessName, services, greetingMessage, businessHours } = validatedData

    // Get or create AI configuration
    const { data: existingConfig } = await supabase.from("ai_configs").select("*").eq("user_id", user.id).single()

    const systemMessage = `
You are a professional PrismAI assistant for ${businessName}. Your role is to:

1. Greet callers warmly and professionally
2. Answer questions about our services: ${services?.join(", ") || "General services"}
3. Schedule appointments when requested
4. Provide business hours and location information
5. Handle inquiries with empathy and efficiency

Business Hours: ${JSON.stringify(businessHours || {}, null, 2)}

IMPORTANT GUIDELINES:
- Always be polite, professional, and helpful
- Speak naturally and conversationally, like a human receptionist
- If you need to schedule an appointment, collect: name, phone, email, preferred service, and preferred date/time
- If asked about services not in our list, politely explain what we do offer
- For complex issues, offer to have someone call them back
- Keep responses concise but complete
- Use natural speech patterns with appropriate pauses

When scheduling appointments, use this format:
BOOKING_REQUEST: {
  "customer_name": "Name",
  "customer_phone": "Phone", 
  "customer_email": "Email",
  "service_type": "Service",
  "appointment_date": "YYYY-MM-DD HH:MM"
}
    `.trim()

    // Create ElevenLabs agent
    const elevenLabsResponse = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
      method: "POST",
      headers: {
        "xi-api-key": String(requireEnv('VAPI_API_KEY')),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${businessName} PrismAI Assistant`,
        conversation_config: {
          agent: {
            prompt: {
              prompt: systemMessage,
            },
            first_message: greetingMessage || "Hello! Thank you for calling. How can I assist you today?",
            language: "en",
          },
          tts: {
            voice_id: "21m00Tcm4TlvDq8ikWAM",
            stability: 0.5,
            similarity_boost: 0.8,
          },
        },
        platform_integration: {
          type: "twilio",
        },
      }),
    })

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text()
      console.error('ElevenLabs agent creation failed:', errorText)
      throw new ExternalServiceError('ElevenLabs', `Failed to create agent: ${elevenLabsResponse.statusText}`)
    }

    const agent = await elevenLabsResponse.json()

    // Update or create AI configuration
    const configData = {
      user_id: user.id,
      assistant_name: `${businessName} PrismAI Assistant`,
      greeting_message: greetingMessage || "Hello! Thank you for calling. How can I assist you today?",
      business_hours: businessHours || {},
      services: services || ["General Consultation"],
      elevenlabs_agent_id: agent.agent_id,
      updated_at: new Date().toISOString(),
    }

    if (existingConfig) {
      const { error: updateError } = await supabase
        .from("ai_configs")
        .update(configData)
        .eq("user_id", user.id)
      
      if (updateError) {
        console.error('Database update error:', updateError)
        throw new Error('Failed to update AI configuration')
      }
    } else {
      const { error: insertError } = await supabase
        .from("ai_configs")
        .insert(configData)
      
      if (insertError) {
        console.error('Database insert error:', insertError)
        throw new Error('Failed to create AI configuration')
      }
    }

    return NextResponse.json({
      success: true,
      assistantId: agent.agent_id,
      message: "AI assistant configured successfully",
    })
})

export const GET = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const { data: config, error: configError } = await supabase
    .from("ai_configs")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (configError && configError.code !== 'PGRST116') {
    console.error('Database error:', configError)
    throw new Error('Failed to fetch AI configuration')
  }

  return NextResponse.json({ config })
})
