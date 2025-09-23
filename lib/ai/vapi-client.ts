// ElevenLabs Agents Client (formerly VAPI) for frontend integration
export interface VAPIConfig {
  apiKey: string
  assistantId?: string
  phoneNumber?: string
}

export interface CallStatus {
  id: string
  status: "ringing" | "in-progress" | "ended" | "failed"
  duration?: number
  transcript?: string
}

export class VAPIClient {
  private apiKey: string
  private baseUrl = "https://api.elevenlabs.io/v1"

  constructor(config: VAPIConfig) {
    this.apiKey = config.apiKey
  }

  async createAssistant(config: {
    name: string
    systemMessage: string
    voice?: {
      provider: string
      voiceId: string
    }
    model?: {
      provider: string
      model: string
      temperature: number
    }
  }) {
    const response = await fetch(`${this.baseUrl}/convai/agents/create`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: config.name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: config.systemMessage,
            },
            first_message: "Hello! Thank you for calling. How can I assist you today?",
            language: "en",
          },
          tts: {
            voice_id: config.voice?.voiceId || "21m00Tcm4TlvDq8ikWAM",
            stability: 0.5,
            similarity_boost: 0.8,
          },
        },
        platform_integration: {
          type: "twilio",
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create assistant: ${response.statusText}`)
    }

    const data = await response.json()
    // Return in VAPI-compatible format
    return {
      id: data.agent_id,
      name: config.name,
      ...data,
    }
  }

  async makeCall(phoneNumber: string, assistantId: string) {
    const response = await fetch(`${this.baseUrl}/convai/conversations`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: assistantId,
        phone_number: phoneNumber,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to make call: ${response.statusText}`)
    }

    const data = await response.json()
    // Return in VAPI-compatible format
    return {
      id: data.conversation_id,
      status: "ringing",
      ...data,
    }
  }

  async getCallStatus(callId: string): Promise<CallStatus> {
    const response = await fetch(`${this.baseUrl}/convai/conversations/${callId}`, {
      headers: {
        "xi-api-key": this.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get call status: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      id: data.conversation_id,
      status: this.mapStatus(data.status),
      duration: data.duration_ms ? Math.floor(data.duration_ms / 1000) : undefined,
      transcript: data.transcript,
    }
  }

  // WebSocket connection for real-time call updates
  connectToCallUpdates(callId: string, onUpdate: (update: any) => void) {
    const ws = new WebSocket(`wss://api.elevenlabs.io/v1/convai/conversations/${callId}/websocket`)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "auth",
        api_key: this.apiKey,
      }))
    }

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      // Map ElevenLabs events to VAPI-compatible format
      const vapiUpdate = this.mapUpdate(update)
      onUpdate(vapiUpdate)
    }

    ws.onerror = (error) => {
      console.error("ElevenLabs WebSocket error:", error)
    }

    return ws
  }

  private mapStatus(status: string): CallStatus["status"] {
    switch (status) {
      case "connecting":
        return "ringing"
      case "connected":
        return "in-progress"
      case "ended":
        return "ended"
      case "error":
        return "failed"
      default:
        return "ringing"
    }
  }

  private mapUpdate(update: any) {
    // Map ElevenLabs update format to VAPI format
    if (update.type === "transcript") {
      return {
        type: "transcript",
        role: update.role,
        text: update.text,
      }
    } else if (update.type === "status") {
      return {
        type: "status-update",
        status: this.mapStatus(update.status),
      }
    }
    return update
  }
}
