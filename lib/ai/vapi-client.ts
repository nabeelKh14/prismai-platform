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
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: config.name,
        model: config.model || {
          provider: "openai",
          model: "gpt-4",
          temperature: 0.7,
        },
        voice: config.voice || {
          provider: "11labs",
          voiceId: "21m00Tcm4TlvDq8ikWAM",
        },
        systemMessage: config.systemMessage,
        firstMessage: "Hello! Thank you for calling. How can I assist you today?",
        endCallMessage: "Thank you for calling. Have a great day!",
        recordingEnabled: true,
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 600,
        backgroundSound: "office",
        backchannelingEnabled: true,
        backgroundDenoisingEnabled: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create assistant: ${response.statusText}`)
    }

    return response.json()
  }

  async makeCall(phoneNumber: string, assistantId: string) {
    const response = await fetch(`${this.baseUrl}/call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId,
        customer: {
          number: phoneNumber,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to make call: ${response.statusText}`)
    }

    return response.json()
  }

  async getCallStatus(callId: string): Promise<CallStatus> {
    const response = await fetch(`${this.baseUrl}/call/${callId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get call status: ${response.statusText}`)
    }

    return response.json()
  }

  // WebSocket connection for real-time call updates
  connectToCallUpdates(callId: string, onUpdate: (update: any) => void) {
    const ws = new WebSocket(`wss://api.vapi.ai/call/${callId}/updates`)

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      onUpdate(update)
    }

    ws.onerror = (error) => {
      console.error("VAPI WebSocket error:", error)
    }

    return ws
  }
}
