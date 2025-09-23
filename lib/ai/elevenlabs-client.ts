// ElevenLabs Agents Client for frontend integration
export interface ElevenLabsConfig {
  apiKey: string
  agentId?: string
  phoneNumber?: string
}

export interface CallStatus {
  id: string
  status: "connecting" | "connected" | "ended" | "error"
  duration?: number
  transcript?: string
}

export class ElevenLabsClient {
  private apiKey: string
  private baseUrl = "https://api.elevenlabs.io/v1"

  constructor(config: ElevenLabsConfig) {
    this.apiKey = config.apiKey
  }

  async createAgent(config: {
    name: string
    systemMessage: string
    voice?: {
      voice_id: string
      stability?: number
      similarity_boost?: number
    }
    model?: string
    firstMessage?: string
    language?: string
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
            first_message: config.firstMessage || "Hello! How can I help you today?",
            language: config.language || "en",
          },
          tts: config.voice ? {
            voice_id: config.voice.voice_id,
            stability: config.voice.stability || 0.5,
            similarity_boost: config.voice.similarity_boost || 0.8,
          } : undefined,
        },
        platform_integration: {
          type: "twilio",
          // Additional Twilio config would go here
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create agent: ${response.statusText}`)
    }

    return response.json()
  }

  async startConversation(phoneNumber: string, agentId: string) {
    const response = await fetch(`${this.baseUrl}/convai/conversations`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        phone_number: phoneNumber,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to start conversation: ${response.statusText}`)
    }

    return response.json()
  }

  async getConversationStatus(conversationId: string): Promise<CallStatus> {
    const response = await fetch(`${this.baseUrl}/convai/conversations/${conversationId}`, {
      headers: {
        "xi-api-key": this.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get conversation status: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      id: data.conversation_id,
      status: this.mapStatus(data.status),
      duration: data.duration_ms ? Math.floor(data.duration_ms / 1000) : undefined,
      transcript: data.transcript,
    }
  }

  // WebSocket connection for real-time conversation updates
  connectToConversationUpdates(conversationId: string, onUpdate: (update: any) => void) {
    const ws = new WebSocket(`wss://api.elevenlabs.io/v1/convai/conversations/${conversationId}/websocket`)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "auth",
        api_key: this.apiKey,
      }))
    }

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      onUpdate(update)
    }

    ws.onerror = (error) => {
      console.error("ElevenLabs WebSocket error:", error)
    }

    return ws
  }

  private mapStatus(status: string): CallStatus["status"] {
    switch (status) {
      case "connecting":
        return "connecting"
      case "connected":
        return "connected"
      case "ended":
        return "ended"
      case "error":
        return "error"
      default:
        return "connecting"
    }
  }
}