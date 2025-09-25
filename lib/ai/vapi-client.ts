// VAPI Client for frontend integration
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
  private baseUrl = "https://api.vapi.ai"

  constructor(config: VAPIConfig) {
    this.apiKey = config.apiKey
  }

  async createAssistant(config: {
    name: string
    systemMessage: string
    firstMessage?: string
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
    const response = await fetch(`${this.baseUrl}/assistant`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: config.name,
        model: {
          provider: config.model?.provider || "openai",
          model: config.model?.model || "gpt-3.5-turbo",
          temperature: config.model?.temperature || 0.7,
          messages: [
            {
              role: "system",
              content: config.systemMessage,
            },
          ],
        },
        voice: {
          provider: config.voice?.provider || "11labs",
          voiceId: config.voice?.voiceId || "21m00Tcm4TlvDq8ikWAM",
        },
        firstMessage: config.firstMessage || "Hello! Thank you for calling. How can I assist you today?",
        transcriber: {
          provider: "deepgram",
          model: "nova-2",
          language: "en",
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create assistant: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      id: data.id,
      name: data.name,
      ...data,
    }
  }

  async makeCall(phoneNumber: string, assistantId: string) {
    const response = await fetch(`${this.baseUrl}/call`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: assistantId,
        customer: {
          number: phoneNumber,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to make call: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      id: data.id,
      status: "ringing",
      ...data,
    }
  }

  async getCallStatus(callId: string): Promise<CallStatus> {
    const response = await fetch(`${this.baseUrl}/call/${callId}`, {
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get call status: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      id: data.id,
      status: this.mapStatus(data.status),
      duration: data.duration || (data.startedAt && data.endedAt ? Math.floor((new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()) / 1000) : undefined),
      transcript: data.transcript || data.summary,
    }
  }

  // WebSocket connection for real-time call updates
  connectToCallUpdates(callId: string, onUpdate: (update: any) => void) {
    const ws = new WebSocket(`wss://api.vapi.ai/call/${callId}`)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "auth",
        token: this.apiKey,
      }))
    }

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      // Map VAPI events to compatible format
      const vapiUpdate = this.mapUpdate(update)
      onUpdate(vapiUpdate)
    }

    ws.onerror = (error) => {
      console.error("VAPI WebSocket error:", error)
    }

    return ws
  }

  private mapStatus(status: string): CallStatus["status"] {
    switch (status) {
      case "queued":
      case "ringing":
        return "ringing"
      case "in-progress":
        return "in-progress"
      case "ended":
        return "ended"
      case "error":
      case "failed":
        return "failed"
      default:
        return "ringing"
    }
  }

  private mapUpdate(update: any) {
    // Map VAPI update format
    if (update.type === "transcript") {
      return {
        type: "transcript",
        role: update.role,
        text: update.transcript,
      }
    } else if (update.type === "call.ended") {
      return {
        type: "status-update",
        status: "ended",
      }
    } else if (update.type === "call.started") {
      return {
        type: "status-update",
        status: "in-progress",
      }
    }
    return update
  }
}
