import twilio from 'twilio'

export interface SMSMessage {
  from: string
  to: string
  body: string
  messageId: string
  timestamp: string
}

export interface SMSResponse {
  success: boolean
  messageId?: string
  error?: string
}

export class SMSClient {
  private client: twilio.Twilio
  private fromNumber: string

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.client = twilio(accountSid, authToken)
    this.fromNumber = fromNumber
  }

  async sendMessage(to: string, message: string): Promise<SMSResponse> {
    try {
      // Handle message length limits (160 characters for single SMS)
      const maxLength = 160
      const messages = this.splitMessage(message, maxLength)

      const results: string[] = []

      for (const msg of messages) {
        const twilioMessage = await this.client.messages.create({
          from: this.fromNumber,
          to: to,
          body: msg
        })
        results.push(twilioMessage.sid)
      }

      return {
        success: true,
        messageId: results.join(',') // Return comma-separated SIDs for concatenated messages
      }
    } catch (error) {
      console.error('Error sending SMS message:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private splitMessage(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) {
      return [message]
    }

    const messages: string[] = []
    let remaining = message

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        messages.push(remaining)
        break
      }

      // Find the last space within the limit
      let splitIndex = maxLength
      while (splitIndex > 0 && remaining[splitIndex] !== ' ') {
        splitIndex--
      }

      // If no space found, split at maxLength
      if (splitIndex === 0) {
        splitIndex = maxLength
      }

      messages.push(remaining.substring(0, splitIndex).trim())
      remaining = remaining.substring(splitIndex).trim()
    }

    return messages
  }

  validateWebhookSignature(requestBody: string, signature: string, url: string): boolean {
    try {
      const authToken = process.env.TWILIO_AUTH_TOKEN
      if (!authToken) return false

      // Parse the request body as URL-encoded form data
      const params = new URLSearchParams(requestBody)
      const paramsObj: Record<string, any> = {}
      for (const [key, value] of params.entries()) {
        paramsObj[key] = value
      }

      const expectedSignature = twilio.validateRequest(
        authToken,
        signature,
        url,
        paramsObj
      )

      return expectedSignature
    } catch (error) {
      console.error('Error validating SMS webhook signature:', error)
      return false
    }
  }

  parseIncomingMessage(req: any): SMSMessage | null {
    try {
      const { From, To, Body, MessageSid } = req

      if (!From || !Body) return null

      return {
        from: From,
        to: To,
        body: Body,
        messageId: MessageSid,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error parsing incoming SMS message:', error)
      return null
    }
  }
}