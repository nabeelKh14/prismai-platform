import twilio from 'twilio'

export interface WhatsAppMessage {
  from: string
  to: string
  body: string
  messageId: string
  timestamp: string
  mediaUrl?: string
  mediaType?: string
}

export interface WhatsAppResponse {
  success: boolean
  messageId?: string
  error?: string
}

export class WhatsAppClient {
  private client: twilio.Twilio
  private fromNumber: string

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.client = twilio(accountSid, authToken)
    this.fromNumber = fromNumber
  }

  async sendMessage(to: string, message: string, mediaUrl?: string): Promise<WhatsAppResponse> {
    try {
      const messageData: any = {
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${to}`,
        body: message
      }

      if (mediaUrl) {
        messageData.mediaUrl = mediaUrl
      }

      const twilioMessage = await this.client.messages.create(messageData)

      return {
        success: true,
        messageId: twilioMessage.sid
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async sendTemplateMessage(to: string, templateName: string, variables: string[]): Promise<WhatsAppResponse> {
    try {
      // For template messages, use contentSid or predefined templates
      const messageData = {
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${to}`,
        contentSid: templateName, // Assuming templateName is contentSid
        contentVariables: JSON.stringify(variables)
      }

      const twilioMessage = await this.client.messages.create(messageData)

      return {
        success: true,
        messageId: twilioMessage.sid
      }
    } catch (error) {
      console.error('Error sending WhatsApp template message:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  validateWebhookSignature(requestBody: string, signature: string, url: string): boolean {
    try {
      const authToken = process.env.TWILIO_AUTH_TOKEN
      if (!authToken) return false

      const expectedSignature = twilio.validateRequest(
        authToken,
        signature,
        url,
        requestBody
      )

      return expectedSignature === signature
    } catch (error) {
      console.error('Error validating webhook signature:', error)
      return false
    }
  }

  parseIncomingMessage(req: any): WhatsAppMessage | null {
    try {
      const { From, To, Body, MessageSid, NumMedia, MediaUrl0, MediaContentType0 } = req

      if (!From || !Body) return null

      const message: WhatsAppMessage = {
        from: From.replace('whatsapp:', ''),
        to: To.replace('whatsapp:', ''),
        body: Body,
        messageId: MessageSid,
        timestamp: new Date().toISOString()
      }

      if (NumMedia > 0 && MediaUrl0) {
        message.mediaUrl = MediaUrl0
        message.mediaType = MediaContentType0
      }

      return message
    } catch (error) {
      console.error('Error parsing incoming WhatsApp message:', error)
      return null
    }
  }
}