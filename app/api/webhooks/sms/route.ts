import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { SMSClient } from "@/lib/twilio/sms-client"
import { LanguageClient } from "@/lib/translate/language-client"
import { withErrorHandling } from "@/lib/errors"

// Initialize clients
const getSMSClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_SMS_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio SMS configuration missing')
  }

  return new SMSClient(accountSid, authToken, fromNumber)
}

const getLanguageClient = () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (!projectId) {
    throw new Error('Google Cloud Translate configuration missing')
  }

  return new LanguageClient(projectId, keyFilename)
}

// Webhook handler for incoming SMS messages
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()

  // Validate webhook signature
  const signature = request.headers.get('x-twilio-signature')
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/sms`

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const body = await request.text()
  const smsClient = getSMSClient()

  if (!smsClient.validateWebhookSignature(body, signature, url)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  // Parse the form data
  const formData = new URLSearchParams(body)
  const req = Object.fromEntries(formData)

  const incomingMessage = smsClient.parseIncomingMessage(req)
  if (!incomingMessage) {
    return NextResponse.json({ error: 'Invalid message format' }, { status: 400 })
  }

  // Get user from request (assuming user context from auth or config)
  const userId = process.env.DEFAULT_USER_ID // TODO: Implement proper user resolution

  if (!userId) {
    return NextResponse.json({ error: 'User context not available' }, { status: 400 })
  }

  // Detect language
  let detectedLanguage = 'en'
  let languageConfidence = 1.0

  try {
    const languageClient = getLanguageClient()
    const detection = await languageClient.detectLanguage(incomingMessage.body)
    if (detection) {
      detectedLanguage = detection.language
      languageConfidence = detection.confidence
    }
  } catch (error) {
    console.warn('Language detection failed, using default:', error)
  }

  // Check for existing language preference
  let { data: langPref } = await supabase
    .from('customer_language_preferences')
    .select('preferred_language')
    .eq('user_id', userId)
    .eq('customer_identifier', incomingMessage.from)
    .single()

  const preferredLanguage = langPref?.preferred_language || detectedLanguage

  // Translate message to English if needed for processing
  let processedMessage = incomingMessage.body
  let translatedFrom: string | undefined

  if (detectedLanguage !== 'en') {
    try {
      const languageClient = getLanguageClient()
      const translation = await languageClient.translateText(incomingMessage.body, 'en', detectedLanguage)
      if (translation) {
        processedMessage = translation.translatedText
        translatedFrom = detectedLanguage
      }
    } catch (error) {
      console.warn('Translation failed, using original message:', error)
    }
  }

  // Process through chatbot
  const chatbotResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/chatbot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: processedMessage,
      channel: 'sms',
      customerIdentifier: incomingMessage.from,
      metadata: {
        twilioMessageId: incomingMessage.messageId,
        detectedLanguage,
        languageConfidence,
        translatedFrom,
        originalMessage: incomingMessage.body
      }
    })
  })

  if (!chatbotResponse.ok) {
    console.error('Chatbot processing failed:', await chatbotResponse.text())
    return NextResponse.json({ error: 'Chatbot processing failed' }, { status: 500 })
  }

  const chatbotData = await chatbotResponse.json()

  // Add service identification to response
  chatbotData.service = 'PrismAI'
  chatbotData.platform = 'Intelligent Business Automation Platform'

  // Translate response back to customer's language if needed
  let responseMessage = chatbotData.response
  if (preferredLanguage !== 'en') {
    try {
      const languageClient = getLanguageClient()
      const translation = await languageClient.translateText(chatbotData.response, preferredLanguage, 'en')
      if (translation) {
        responseMessage = translation.translatedText
      }
    } catch (error) {
      console.warn('Response translation failed, using English:', error)
    }
  }

  // Send response via SMS
  const sendResult = await smsClient.sendMessage(incomingMessage.from, responseMessage)

  if (!sendResult.success) {
    console.error('Failed to send SMS response:', sendResult.error)
    return NextResponse.json({ error: 'Failed to send response' }, { status: 500 })
  }

  // Update conversation with Twilio SID
  if (chatbotData.conversationId && sendResult.messageId) {
    await supabase
      .from('chat_conversations')
      .update({
        twilio_sid: sendResult.messageId,
        preferred_language: preferredLanguage,
        language_confidence: languageConfidence
      })
      .eq('id', chatbotData.conversationId)
  }

  // Update or create language preference
  await supabase
    .from('customer_language_preferences')
    .upsert({
      user_id: userId,
      customer_identifier: incomingMessage.from,
      preferred_language: preferredLanguage,
      confidence_score: languageConfidence
    })

  return NextResponse.json({ success: true })
})