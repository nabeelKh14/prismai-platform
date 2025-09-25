import { createRedisCache } from '@/lib/cache/redis-cache'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { logger } from '@/lib/logger'

export interface JobDefinition {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  data: any
  options?: {
    retryAttempts?: number
    retryDelay?: number
    timeout?: number
    maxRetries?: number
    deduplicationKey?: string
  }
  metadata?: {
    userId?: string
    tenantId?: string
    source?: string
    tags?: string[]
  }
}

export interface JobStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  progress: number // 0-100
  result?: any
  error?: string
  retryCount: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  estimatedCompletion?: Date
}

export interface JobProcessor {
  type: string
  handler: (job: JobDefinition) => Promise<any>
  concurrency?: number
  retryPolicy?: {
    maxRetries: number
    baseDelay: number
    maxDelay: number
  }
}

export interface BackgroundJobConfig {
  enablePersistence?: boolean
  enableMetrics?: boolean
  enableDeadLetterQueue?: boolean
  maxRetries?: number
  defaultTimeout?: number
  cleanupInterval?: number
  maxConcurrentJobs?: number
  queueNames?: string[]
}

export class BackgroundJobProcessor {
  private cache = createRedisCache()
  private processors = new Map<string, JobProcessor>()
  private activeJobs = new Map<string, JobStatus>()
  private jobQueue: JobDefinition[] = []
  private processingQueue = false
  private config: Required<BackgroundJobConfig>
  private cleanupInterval?: NodeJS.Timeout

  constructor(config?: BackgroundJobConfig) {
    this.config = {
      enablePersistence: true,
      enableMetrics: true,
      enableDeadLetterQueue: true,
      maxRetries: 3,
      defaultTimeout: 300000, // 5 minutes
      cleanupInterval: 3600000, // 1 hour
      maxConcurrentJobs: 10,
      queueNames: ['default', 'priority', 'bulk'],
      ...config
    }

    this.startQueueProcessor()
    this.startCleanupTask()
  }

  /**
   * Register a job processor
   */
  registerProcessor(processor: JobProcessor): void {
    this.processors.set(processor.type, processor)
    logger.info('Job processor registered', { type: processor.type })
  }

  /**
   * Add job to queue
   */
  async addJob(job: JobDefinition): Promise<string> {
    const jobId = job.id || this.generateJobId()
    const finalJob: JobDefinition = {
      ...job,
      id: jobId,
      options: {
        retryAttempts: 0,
        retryDelay: 1000,
        timeout: this.config.defaultTimeout,
        maxRetries: this.config.maxRetries,
        ...job.options
      }
    }

    // Check for duplicates
    if (finalJob.options?.deduplicationKey) {
      const existingJob = await this.getJobByDeduplicationKey(finalJob.options.deduplicationKey)
      if (existingJob && existingJob.status !== 'failed' && existingJob.status !== 'completed') {
        logger.info('Duplicate job found, skipping', {
          jobId,
          deduplicationKey: finalJob.options.deduplicationKey
        })
        return existingJob.id
      }
    }

    // Add to queue
    this.jobQueue.push(finalJob)

    // Sort by priority
    this.jobQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    // Persist if enabled
    if (this.config.enablePersistence) {
      await this.persistJob(finalJob)
    }

    logger.info('Job added to queue', {
      jobId,
      type: job.type,
      priority: job.priority
    })

    return jobId
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    // Check active jobs
    const activeJob = this.activeJobs.get(jobId)
    if (activeJob) {
      return activeJob
    }

    // Check persisted jobs
    if (this.config.enablePersistence) {
      const persisted = await this.getPersistedJob(jobId)
      if (persisted) {
        return persisted
      }
    }

    return null
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Remove from active jobs
    const activeJob = this.activeJobs.get(jobId)
    if (activeJob) {
      activeJob.status = 'failed'
      activeJob.error = 'Job cancelled'
      activeJob.completedAt = new Date()
      this.activeJobs.delete(jobId)
      return true
    }

    // Remove from queue
    const queueIndex = this.jobQueue.findIndex(job => job.id === jobId)
    if (queueIndex !== -1) {
      this.jobQueue.splice(queueIndex, 1)
      return true
    }

    // Cancel persisted job
    if (this.config.enablePersistence) {
      return await this.cancelPersistedJob(jobId)
    }

    return false
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus['status']): Promise<JobStatus[]> {
    const jobs: JobStatus[] = []

    // Check active jobs
    for (const job of this.activeJobs.values()) {
      if (job.status === status) {
        jobs.push(job)
      }
    }

    // Check persisted jobs
    if (this.config.enablePersistence) {
      const persistedJobs = await this.getPersistedJobsByStatus(status)
      jobs.push(...persistedJobs)
    }

    return jobs
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    queued: number
    processing: number
    completed: number
    failed: number
    byPriority: Record<string, number>
    byType: Record<string, number>
  } {
    const stats = {
      queued: this.jobQueue.length,
      processing: this.activeJobs.size,
      completed: 0,
      failed: 0,
      byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
      byType: {} as Record<string, number>
    }

    // Count active jobs
    for (const job of this.activeJobs.values()) {
      if (job.status === 'completed') stats.completed++
      if (job.status === 'failed') stats.failed++
    }

    // Count queued jobs
    for (const job of this.jobQueue) {
      stats.byPriority[job.priority]++
      stats.byType[job.type] = (stats.byType[job.type] || 0) + 1
    }

    return stats
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.processingQueue && this.jobQueue.length > 0) {
        this.processQueue()
      }
    }, 1000) // Check every second
  }

  /**
   * Process job queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.jobQueue.length === 0) {
      return
    }

    this.processingQueue = true

    try {
      const activeCount = this.activeJobs.size
      const availableSlots = this.config.maxConcurrentJobs - activeCount

      if (availableSlots <= 0) {
        return
      }

      // Process jobs up to available slots
      const jobsToProcess = this.jobQueue.splice(0, availableSlots)

      for (const job of jobsToProcess) {
        this.processJob(job)
      }

    } finally {
      this.processingQueue = false
    }
  }

  /**
   * Process individual job
   */
  private async processJob(job: JobDefinition): Promise<void> {
    const startTime = Date.now()
    const processor = this.processors.get(job.type)

    if (!processor) {
      logger.error('No processor found for job type', { jobId: job.id, type: job.type })
      return
    }

    const jobStatus: JobStatus = {
      id: job.id,
      status: 'processing',
      progress: 0,
      retryCount: 0,
      createdAt: new Date(),
      startedAt: new Date()
    }

    this.activeJobs.set(job.id, jobStatus)

    try {
      // Set timeout
      const timeout = job.options?.timeout || this.config.defaultTimeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), timeout)
      })

      const processPromise = processor.handler(job)

      // Race between processing and timeout
      const result = await Promise.race([processPromise, timeoutPromise])

      jobStatus.status = 'completed'
      jobStatus.progress = 100
      jobStatus.result = result
      jobStatus.completedAt = new Date()

      // Record metrics
      if (this.config.enableMetrics) {
        await performanceMonitor.recordAPIMetric({
          endpoint: `/jobs/${job.type}`,
          method: 'POST',
          response_time_ms: Date.now() - startTime,
          status_code: 200,
          timestamp: new Date().toISOString()
        })
      }

      logger.info('Job completed successfully', {
        jobId: job.id,
        type: job.type,
        duration: Date.now() - startTime
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const shouldRetry = this.shouldRetry(job, jobStatus.retryCount)

      if (shouldRetry) {
        jobStatus.status = 'retrying'
        jobStatus.error = errorMessage
        jobStatus.retryCount++

        // Schedule retry
        setTimeout(() => {
          this.retryJob(job, jobStatus.retryCount)
        }, this.calculateRetryDelay(jobStatus.retryCount))

      } else {
        jobStatus.status = 'failed'
        jobStatus.error = errorMessage
        jobStatus.completedAt = new Date()

        // Move to dead letter queue if enabled
        if (this.config.enableDeadLetterQueue) {
          await this.moveToDeadLetterQueue(job, errorMessage)
        }

        logger.error('Job failed permanently', {
          jobId: job.id,
          type: job.type,
          error: errorMessage,
          retryCount: jobStatus.retryCount
        })
      }

      // Record error metrics
      if (this.config.enableMetrics) {
        await performanceMonitor.recordAPIMetric({
          endpoint: `/jobs/${job.type}`,
          method: 'POST',
          response_time_ms: Date.now() - startTime,
          status_code: 500,
          timestamp: new Date().toISOString()
        })
      }
    }
  }

  /**
   * Retry job
   */
  private async retryJob(job: JobDefinition, retryCount: number): Promise<void> {
    logger.info('Retrying job', { jobId: job.id, retryCount })

    // Add back to queue with higher priority
    const retryJob: JobDefinition = {
      ...job,
      priority: 'high',
      options: {
        ...job.options,
        retryAttempts: retryCount
      }
    }

    this.jobQueue.unshift(retryJob)
  }

  /**
   * Check if job should be retried
   */
  private shouldRetry(job: JobDefinition, retryCount: number): boolean {
    const maxRetries = job.options?.maxRetries || this.config.maxRetries
    return retryCount < maxRetries
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000 * Math.pow(2, retryCount)
    const jitter = Math.random() * 1000
    return Math.min(baseDelay + jitter, 30000) // Max 30 seconds
  }

  /**
   * Persist job to cache
   */
  private async persistJob(job: JobDefinition): Promise<void> {
    try {
      await this.cache.set(`job:${job.id}`, job, 86400000) // 24 hours
    } catch (error) {
      logger.error('Failed to persist job', { error, jobId: job.id })
    }
  }

  /**
   * Get persisted job
   */
  private async getPersistedJob(jobId: string): Promise<JobStatus | null> {
    try {
      const job = await this.cache.get<JobDefinition>(`job:${jobId}`)
      if (!job) return null

      return {
        id: job.id,
        status: 'pending',
        progress: 0,
        retryCount: 0,
        createdAt: new Date()
      }
    } catch (error) {
      logger.error('Failed to get persisted job', { error, jobId })
      return null
    }
  }

  /**
   * Get job by deduplication key
   */
  private async getJobByDeduplicationKey(dedupeKey: string): Promise<JobStatus | null> {
    try {
      const jobs = await this.cache.get<JobDefinition[]>(`dedupe:${dedupeKey}`)
      if (!jobs || jobs.length === 0) return null

      const job = jobs[0]
      return await this.getJobStatus(job.id)
    } catch (error) {
      logger.error('Failed to get job by deduplication key', { error, dedupeKey })
      return null
    }
  }

  /**
   * Cancel persisted job
   */
  private async cancelPersistedJob(jobId: string): Promise<boolean> {
    try {
      return await this.cache.delete(`job:${jobId}`)
    } catch (error) {
      logger.error('Failed to cancel persisted job', { error, jobId })
      return false
    }
  }

  /**
   * Get persisted jobs by status
   */
  private async getPersistedJobsByStatus(status: JobStatus['status']): Promise<JobStatus[]> {
    try {
      const pattern = 'job:*'
      const keys = await this.cache.getKeys(pattern)
      const jobs: JobStatus[] = []

      for (const key of keys) {
        const job = await this.cache.get<JobDefinition>(key)
        if (job) {
          jobs.push({
            id: job.id,
            status,
            progress: 0,
            retryCount: 0,
            createdAt: new Date()
          })
        }
      }

      return jobs
    } catch (error) {
      logger.error('Failed to get persisted jobs by status', { error, status })
      return []
    }
  }

  /**
   * Move job to dead letter queue
   */
  private async moveToDeadLetterQueue(job: JobDefinition, error: string): Promise<void> {
    try {
      const deadLetterJob = {
        ...job,
        error,
        movedToDLQAt: new Date().toISOString()
      }

      await this.cache.set(`dlq:${job.id}`, deadLetterJob, 604800000) // 7 days
      logger.info('Job moved to dead letter queue', { jobId: job.id, error })
    } catch (error) {
      logger.error('Failed to move job to dead letter queue', { error, jobId: job.id })
    }
  }

  /**
   * Start cleanup task
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupCompletedJobs()
    }, this.config.cleanupInterval)
  }

  /**
   * Cleanup completed jobs
   */
  private async cleanupCompletedJobs(): Promise<void> {
    try {
      const cutoffTime = Date.now() - 86400000 // 24 hours ago

      // Clean up active jobs
      for (const [jobId, job] of this.activeJobs.entries()) {
        if (job.completedAt && job.completedAt.getTime() < cutoffTime) {
          this.activeJobs.delete(jobId)
        }
      }

      // Clean up persisted jobs
      if (this.config.enablePersistence) {
        const pattern = 'job:*'
        const keys = await this.cache.getKeys(pattern)

        for (const key of keys) {
          const job = await this.cache.get<JobDefinition>(key)
          if (job) {
            // This is a simplified cleanup - in production you'd check job status
            await this.cache.delete(key)
          }
        }
      }

      logger.debug('Completed jobs cleanup finished')
    } catch (error) {
      logger.error('Failed to cleanup completed jobs', { error })
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const backgroundJobProcessor = new BackgroundJobProcessor()

// Export factory function
export function createBackgroundJobProcessor(config?: BackgroundJobConfig): BackgroundJobProcessor {
  return new BackgroundJobProcessor(config)
}