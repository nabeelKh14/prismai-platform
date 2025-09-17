import { createClient } from '@/lib/supabase/server'
import { multiModalHandler } from './multi-modal-handler'
import { syncOrchestrator } from './synchronization-orchestrator'
import { logger } from '@/lib/logger'

export interface DemoScenario {
  name: string
  description: string
  inputs: Array<{
    delay: number // seconds after start
    modality: 'voice' | 'text'
    content: string
    metadata?: Record<string, any>
  }>
}

export class DemoController {
  private activeSessions = new Map<string, NodeJS.Timeout>()
  private scenarios: Record<string, DemoScenario> = {
    'basic_inquiry': {
      name: 'Basic Customer Inquiry',
      description: 'Customer asks about business hours and services',
      inputs: [
        { delay: 2, modality: 'text', content: 'Hi, what are your business hours?' },
        { delay: 8, modality: 'voice', content: 'voice: Can you tell me about your services?' },
        { delay: 15, modality: 'text', content: 'Thanks, that helps!' }
      ]
    },
    'mixed_interaction': {
      name: 'Mixed Voice and Text',
      description: 'Alternating between voice and text inputs',
      inputs: [
        { delay: 1, modality: 'voice', content: 'voice: Hello, I need help with my account' },
        { delay: 6, modality: 'text', content: 'Actually, let me type this' },
        { delay: 10, modality: 'voice', content: 'voice: What are the charges?' },
        { delay: 16, modality: 'text', content: 'Thank you for the information' }
      ]
    }
  }

  async startDemoSession(userId: string, scenarioName: string, conversationId: string): Promise<string> {
    const scenario = this.scenarios[scenarioName]
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioName}`)

    const supabase = await createClient()
    const sessionId = crypto.randomUUID()

    // Create demo session record
    await supabase
      .from('demo_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        session_name: scenario.name,
        scenario: scenarioName,
        conversation_id: conversationId,
        metrics: {
          startTime: new Date().toISOString(),
          inputsProcessed: 0,
          responsesGenerated: 0,
          averageResponseTime: 0
        }
      })

    // Schedule simulated inputs
    const timeouts: NodeJS.Timeout[] = []
    scenario.inputs.forEach((input, index) => {
      const timeout = setTimeout(async () => {
        try {
          await this.simulateUserInput(conversationId, input, sessionId)
        } catch (error) {
          logger.error('Demo input simulation failed', error as Error, { sessionId, inputIndex: index })
        }
      }, input.delay * 1000)

      timeouts.push(timeout)
    })

    this.activeSessions.set(sessionId, timeouts[0]) // Store reference to cancel

    // Auto-end session after last input + buffer
    const endTimeout = setTimeout(async () => {
      await this.endDemoSession(sessionId)
    }, (scenario.inputs[scenario.inputs.length - 1].delay + 10) * 1000)

    timeouts.push(endTimeout)

    return sessionId
  }

  private async simulateUserInput(conversationId: string, input: DemoScenario['inputs'][0], sessionId: string) {
    // Process the input through the multi-modal handler
    const output = await multiModalHandler.processInput({
      conversationId,
      modality: input.modality,
      content: input.content,
      customerIdentifier: `demo-${sessionId}`,
      metadata: { ...input.metadata, demoSessionId: sessionId }
    })

    // Queue the response
    await multiModalHandler.queueResponse(conversationId, output)

    // Record the demo interaction
    await this.recordDemoInteraction(sessionId, conversationId, input, output)
  }

  private async recordDemoInteraction(
    sessionId: string,
    conversationId: string,
    input: DemoScenario['inputs'][0],
    output: any
  ) {
    const supabase = await createClient()

    // Get the latest message for recording
    const { data: messages } = await supabase
      .from('unified_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .order('sequence_number', { ascending: false })
      .limit(1)

    if (messages && messages[0]) {
      await supabase
        .from('demo_recordings')
        .insert({
          demo_session_id: sessionId,
          message_id: messages[0].id,
          modality: input.modality,
          recording_url: output.audioUrl || null, // For voice inputs
          transcript: input.modality === 'voice' ? input.content : null
        })
    }

    // Update session metrics
    await this.updateDemoMetrics(sessionId)
  }

  private async updateDemoMetrics(sessionId: string) {
    const supabase = await createClient()

    const { data: recordings } = await supabase
      .from('demo_recordings')
      .select('id')
      .eq('demo_session_id', sessionId)

    const inputsProcessed = recordings?.length || 0

    // Calculate responses (AI messages)
    const { data: messages } = await supabase
      .from('unified_messages')
      .select('processing_time_ms')
      .eq('sender_type', 'ai')
      .in('id', recordings?.map(r => r.id) || [])

    const responsesGenerated = messages?.length || 0
    const avgResponseTime = messages ? messages.reduce((sum, msg) => sum + (msg.processing_time_ms || 0), 0) / responsesGenerated : 0

    await supabase
      .from('demo_sessions')
      .update({
        metrics: {
          inputsProcessed,
          responsesGenerated,
          averageResponseTime: Math.round(avgResponseTime),
          lastUpdate: new Date().toISOString()
        }
      })
      .eq('id', sessionId)
  }

  async endDemoSession(sessionId: string) {
    const timeouts = this.activeSessions.get(sessionId)
    if (timeouts) {
      clearTimeout(timeouts)
      this.activeSessions.delete(sessionId)
    }

    const supabase = await createClient()
    await supabase
      .from('demo_sessions')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    logger.info('Demo session ended', { sessionId })
  }

  async pauseDemoSession(sessionId: string) {
    const timeouts = this.activeSessions.get(sessionId)
    if (timeouts) {
      clearTimeout(timeouts)
    }

    const supabase = await createClient()
    await supabase
      .from('demo_sessions')
      .update({ status: 'paused' })
      .eq('id', sessionId)
  }

  async resumeDemoSession(sessionId: string) {
    // In a real implementation, this would reschedule remaining inputs
    const supabase = await createClient()
    await supabase
      .from('demo_sessions')
      .update({ status: 'active' })
      .eq('id', sessionId)
  }

  async getDemoMetrics(sessionId: string): Promise<any> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('demo_sessions')
      .select('metrics')
      .eq('id', sessionId)
      .single()

    return data?.metrics || {}
  }

  getAvailableScenarios(): Record<string, DemoScenario> {
    return this.scenarios
  }

  async getSessionRecordings(sessionId: string): Promise<any[]> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('demo_recordings')
      .select(`
        *,
        unified_messages (
          content,
          modality,
          sender_type,
          timestamp
        )
      `)
      .eq('demo_session_id', sessionId)
      .order('timestamp', { ascending: true })

    return data || []
  }
}

// Export singleton
export const demoController = new DemoController()