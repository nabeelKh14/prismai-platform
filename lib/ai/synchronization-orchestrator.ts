import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface QueuedResponse {
  id: string
  conversationId: string
  modality: 'voice' | 'text'
  priority: number
  payload: {
    content: string
    audioUrl?: string
    confidence: number
    processingTime: number
  }
  createdAt: string
}

export class SynchronizationOrchestrator {
  private activeOutputs = new Map<string, { modality: 'voice' | 'text', timestamp: number }>()
  private webSocketConnections = new Map<string, any>()
  private isRunning = false

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.processQueue()
  }

  stop() {
    this.isRunning = false
  }

  registerWebSocket(conversationId: string, ws: WebSocket) {
    this.webSocketConnections.set(conversationId, ws)

    ws.addEventListener('close', () => {
      this.webSocketConnections.delete(conversationId)
    })
  }

  private async processQueue() {
    while (this.isRunning) {
      try {
        await this.processNextBatch()
        await this.sleep(1000) // Process every second
      } catch (error) {
        logger.error('Queue processing error', error as Error)
        await this.sleep(5000) // Wait longer on error
      }
    }
  }

  private async processNextBatch() {
    const supabase = await createClient()

    // Get pending responses, ordered by priority and creation time
    const { data: queuedResponses, error } = await supabase
      .from('response_queue')
      .select('*')
      .eq('status', 'queued')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5) // Process up to 5 at a time

    if (error) {
      logger.error('Failed to fetch queued responses', error)
      return
    }

    if (!queuedResponses || queuedResponses.length === 0) return

    for (const response of queuedResponses) {
      await this.processResponse(response as QueuedResponse)
    }
  }

  private async processResponse(response: QueuedResponse) {
    const { conversationId, modality } = response

    // Check if there's an active output for this conversation
    const activeOutput = this.activeOutputs.get(conversationId)
    if (activeOutput) {
      // If same modality, wait; if different, allow concurrent but with delay
      if (activeOutput.modality === modality) {
        const timeSinceActive = Date.now() - activeOutput.timestamp
        if (timeSinceActive < 2000) { // 2 second minimum gap
          return // Skip for now
        }
      }
    }

    // Mark as processing
    const supabase = await createClient()
    await supabase
      .from('response_queue')
      .update({
        status: 'processing',
        processed_at: new Date().toISOString()
      })
      .eq('id', response.id)

    try {
      // Send the response
      await this.sendResponse(response)

      // Mark as completed
      await supabase
        .from('response_queue')
        .update({ status: 'completed' })
        .eq('id', response.id)

      // Update active output
      this.activeOutputs.set(conversationId, {
        modality,
        timestamp: Date.now()
      })

      // Clean up old active outputs (older than 10 seconds)
      for (const [convId, output] of this.activeOutputs.entries()) {
        if (Date.now() - output.timestamp > 10000) {
          this.activeOutputs.delete(convId)
        }
      }

    } catch (error) {
      logger.error('Response processing failed', error as Error, { responseId: response.id })

      // Mark as failed
      await supabase
        .from('response_queue')
        .update({ status: 'failed' })
        .eq('id', response.id)
    }
  }

  private async sendResponse(response: QueuedResponse) {
    const ws = this.webSocketConnections.get(response.conversationId)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'ai_response',
        modality: response.modality,
        content: response.payload.content,
        audioUrl: response.payload.audioUrl,
        confidence: response.payload.confidence,
        processingTime: response.payload.processingTime,
        timestamp: new Date().toISOString()
      }))
    }

    // Also broadcast to any other listeners (e.g., demo interface)
    // In a real implementation, this could use Redis pub/sub or similar
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Method to manually trigger response processing (for testing)
  async triggerProcessing() {
    await this.processNextBatch()
  }

  // Get queue status for monitoring
  async getQueueStatus(): Promise<{
    queued: number
    processing: number
    completed: number
    failed: number
  }> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('response_queue')
      .select('status')
      .in('status', ['queued', 'processing', 'completed', 'failed'])

    if (error) throw error

    const status = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0
    }

    data?.forEach(item => {
      status[item.status as keyof typeof status]++
    })

    return status
  }
}

// Export singleton
export const syncOrchestrator = new SynchronizationOrchestrator()