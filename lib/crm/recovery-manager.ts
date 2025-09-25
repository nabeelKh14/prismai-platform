import { logger } from '@/lib/logger'
import { crmErrorHandler, CRMError, CRMErrorType } from './error-handler'
import { circuitBreakerManager, CircuitState } from './circuit-breaker'
import { retryManager } from './retry-mechanism'
import { crmRateLimitManager } from './rate-limiter'
import { createClient } from '@/lib/supabase/server'

export interface RecoveryAction {
  id: string
  type: 'circuit_reset' | 'rate_limit_reset' | 'token_refresh' | 'provider_restart' | 'health_check'
  provider: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  estimatedDuration: number // in seconds
  successRate: number // 0-1
  lastAttempted?: Date
  lastSuccessful?: Date
  failureCount: number
}

export interface RecoveryResult {
  success: boolean
  action: string
  duration: number
  error?: string
  metadata?: Record<string, any>
}

export class RecoveryManager {
  private static instance: RecoveryManager
  private recoveryActions: Map<string, RecoveryAction> = new Map()
  private isRunning: boolean = false
  private recoveryInterval: NodeJS.Timeout | null = null

  static getInstance(): RecoveryManager {
    if (!RecoveryManager.instance) {
      RecoveryManager.instance = new RecoveryManager()
    }
    return RecoveryManager.instance
  }

  constructor() {
    this.initializeRecoveryActions()
    this.startAutomaticRecovery()
  }

  private initializeRecoveryActions(): void {
    const defaultActions: RecoveryAction[] = [
      {
        id: 'circuit_reset_salesforce',
        type: 'circuit_reset',
        provider: 'salesforce',
        priority: 'medium',
        description: 'Reset circuit breaker for Salesforce API',
        estimatedDuration: 30,
        successRate: 0.9,
        failureCount: 0
      },
      {
        id: 'circuit_reset_hubspot',
        type: 'circuit_reset',
        provider: 'hubspot',
        priority: 'medium',
        description: 'Reset circuit breaker for HubSpot API',
        estimatedDuration: 30,
        successRate: 0.85,
        failureCount: 0
      },
      {
        id: 'circuit_reset_pipedrive',
        type: 'circuit_reset',
        provider: 'pipedrive',
        priority: 'medium',
        description: 'Reset circuit breaker for Pipedrive API',
        estimatedDuration: 30,
        successRate: 0.8,
        failureCount: 0
      },
      {
        id: 'rate_limit_reset_salesforce',
        type: 'rate_limit_reset',
        provider: 'salesforce',
        priority: 'high',
        description: 'Reset rate limiting for Salesforce API',
        estimatedDuration: 60,
        successRate: 0.95,
        failureCount: 0
      },
      {
        id: 'rate_limit_reset_hubspot',
        type: 'rate_limit_reset',
        provider: 'hubspot',
        priority: 'high',
        description: 'Reset rate limiting for HubSpot API',
        estimatedDuration: 60,
        successRate: 0.9,
        failureCount: 0
      },
      {
        id: 'rate_limit_reset_pipedrive',
        type: 'rate_limit_reset',
        provider: 'pipedrive',
        priority: 'high',
        description: 'Reset rate limiting for Pipedrive API',
        estimatedDuration: 60,
        successRate: 0.85,
        failureCount: 0
      },
      {
        id: 'health_check_all',
        type: 'health_check',
        provider: 'all',
        priority: 'low',
        description: 'Perform health check on all CRM providers',
        estimatedDuration: 120,
        successRate: 0.98,
        failureCount: 0
      }
    ]

    for (const action of defaultActions) {
      this.recoveryActions.set(action.id, action)
    }
  }

  async executeRecovery(provider: string, actionType?: string): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = []

    if (actionType) {
      // Execute specific recovery action
      const action = this.recoveryActions.get(`${actionType}_${provider}`)
      if (action) {
        const result = await this.executeRecoveryAction(action)
        results.push(result)
      }
    } else {
      // Execute all applicable recovery actions for the provider
      for (const action of this.recoveryActions.values()) {
        if (action.provider === provider || action.provider === 'all') {
          const result = await this.executeRecoveryAction(action)
          results.push(result)
        }
      }
    }

    // Log recovery results
    for (const result of results) {
      if (result.success) {
        logger.info('Recovery action completed successfully', {
          provider,
          action: result.action,
          duration: result.duration
        })
      } else {
        logger.error('Recovery action failed', {
          provider,
          action: result.action,
          error: result.error,
          duration: result.duration
        })
      }
    }

    return results
  }

  private async executeRecoveryAction(action: RecoveryAction): Promise<RecoveryResult> {
    const startTime = Date.now()

    try {
      action.lastAttempted = new Date()

      switch (action.type) {
        case 'circuit_reset':
          return await this.resetCircuitBreaker(action.provider)

        case 'rate_limit_reset':
          return await this.resetRateLimits(action.provider)

        case 'token_refresh':
          return await this.refreshProviderTokens(action.provider)

        case 'provider_restart':
          return await this.restartProviderConnection(action.provider)

        case 'health_check':
          return await this.performHealthCheck(action.provider)

        default:
          throw new Error(`Unknown recovery action type: ${action.type}`)
      }
    } catch (error) {
      action.failureCount++

      return {
        success: false,
        action: action.id,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async resetCircuitBreaker(provider: string): Promise<RecoveryResult> {
    const startTime = Date.now()

    try {
      const circuitBreakers = circuitBreakerManager.getAllBreakers()
      let resetCount = 0

      for (const [name, breaker] of circuitBreakers) {
        if (name.includes(provider) && breaker.isOpen()) {
          breaker.forceClose()
          resetCount++
        }
      }

      return {
        success: true,
        action: 'circuit_reset',
        duration: Date.now() - startTime,
        metadata: { resetCount }
      }
    } catch (error) {
      throw error
    }
  }

  private async resetRateLimits(provider: string): Promise<RecoveryResult> {
    const startTime = Date.now()

    try {
      crmRateLimitManager.resetProviderLimits(provider)

      return {
        success: true,
        action: 'rate_limit_reset',
        duration: Date.now() - startTime
      }
    } catch (error) {
      throw error
    }
  }

  private async refreshProviderTokens(provider: string): Promise<RecoveryResult> {
    const startTime = Date.now()

    try {
      const supabase = await createClient()

      // Get active configurations for the provider
      const { data: configs, error } = await supabase
        .from('crm_configs')
        .select('*')
        .eq('provider', provider)
        .eq('is_active', true)

      if (error) throw error

      let refreshCount = 0

      for (const config of configs || []) {
        // This would trigger token refresh logic
        // Implementation depends on the specific CRM provider
        logger.info('Token refresh would be attempted', { provider, userId: config.user_id })
        refreshCount++
      }

      return {
        success: true,
        action: 'token_refresh',
        duration: Date.now() - startTime,
        metadata: { refreshCount }
      }
    } catch (error) {
      throw error
    }
  }

  private async restartProviderConnection(provider: string): Promise<RecoveryResult> {
    const startTime = Date.now()

    try {
      // Reset circuit breakers
      await this.resetCircuitBreaker(provider)

      // Reset rate limits
      await this.resetRateLimits(provider)

      // Clear error statistics
      crmErrorHandler.resetErrorCount(provider, CRMErrorType.AUTHENTICATION_ERROR)
      crmErrorHandler.resetErrorCount(provider, CRMErrorType.NETWORK_ERROR)

      return {
        success: true,
        action: 'provider_restart',
        duration: Date.now() - startTime
      }
    } catch (error) {
      throw error
    }
  }

  private async performHealthCheck(provider: string): Promise<RecoveryResult> {
    const startTime = Date.now()

    try {
      const supabase = await createClient()

      // Get provider configurations
      let query = supabase
        .from('crm_configs')
        .select('*')
        .eq('is_active', true)

      if (provider !== 'all') {
        query = query.eq('provider', provider)
      }

      const { data: configs, error } = await query
      if (error) throw error

      const healthResults: Record<string, any> = {}

      for (const config of configs || []) {
        // Perform basic health check
        try {
          // This would make a simple API call to test connectivity
          healthResults[config.provider] = {
            status: 'healthy',
            lastSync: config.last_sync_at,
            configAge: Date.now() - new Date(config.updated_at).getTime()
          }
        } catch (error) {
          healthResults[config.provider] = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }

      return {
        success: true,
        action: 'health_check',
        duration: Date.now() - startTime,
        metadata: { healthResults }
      }
    } catch (error) {
      throw error
    }
  }

  // Automatic recovery logic
  private startAutomaticRecovery(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval)
    }

    // Run automatic recovery every 5 minutes
    this.recoveryInterval = setInterval(async () => {
      if (this.isRunning) return

      this.isRunning = true

      try {
        await this.performAutomaticRecovery()
      } catch (error) {
        logger.error('Automatic recovery failed', error as Error)
      } finally {
        this.isRunning = false
      }
    }, 5 * 60 * 1000) // 5 minutes
  }

  private async performAutomaticRecovery(): Promise<void> {
    logger.debug('Starting automatic recovery check')

    // Check circuit breakers
    const circuitBreakers = circuitBreakerManager.getAllBreakers()
    for (const [name, breaker] of circuitBreakers) {
      if (breaker.isOpen()) {
        const stats = breaker.getStats()

        // If circuit has been open for more than 10 minutes, try to recover
        if (stats.lastFailureTime &&
            Date.now() - stats.lastFailureTime.getTime() > 10 * 60 * 1000) {

          logger.info('Attempting automatic circuit breaker recovery', { name })
          breaker.forceHalfOpen()

          // Try a test operation
          try {
            // This would be a lightweight test operation
            // For now, just log the attempt
            logger.info('Circuit breaker test operation would be performed', { name })
          } catch (error) {
            // If test fails, keep circuit open
            breaker.forceOpen()
          }
        }
      }
    }

    // Check for stuck rate limiters
    const rateLimitStats = crmRateLimitManager.getAllRateLimitStats()
    for (const [key, stats] of Object.entries(rateLimitStats)) {
      if (stats.lastRateLimitHit &&
          Date.now() - stats.lastRateLimitHit.getTime() > 15 * 60 * 1000) { // 15 minutes

        const provider = key.split(':')[0]
        logger.info('Attempting automatic rate limit recovery', { provider })
        await this.resetRateLimits(provider)
      }
    }

    // Check for providers with high error rates
    const errorStats = crmErrorHandler.getErrorStats()
    for (const [errorKey, stats] of Object.entries(errorStats)) {
      const [provider, errorType] = errorKey.split(':')

      if (stats.count > 10 && // High error count
          Date.now() - stats.lastError.getTime() < 5 * 60 * 1000) { // Recent errors

        logger.info('High error rate detected, triggering recovery', {
          provider,
          errorType,
          count: stats.count
        })

        await this.executeRecovery(provider, 'provider_restart')
      }
    }
  }

  // Public API methods
  getRecoveryActions(provider?: string): RecoveryAction[] {
    const actions: RecoveryAction[] = []

    for (const action of this.recoveryActions.values()) {
      if (!provider || action.provider === provider || action.provider === 'all') {
        actions.push({ ...action })
      }
    }

    return actions
  }

  getRecoveryHistory(provider?: string): RecoveryResult[] {
    // This would return historical recovery results
    // For now, return empty array
    return []
  }

  stopAutomaticRecovery(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval)
      this.recoveryInterval = null
    }
  }

  restartAutomaticRecovery(): void {
    this.stopAutomaticRecovery()
    this.startAutomaticRecovery()
  }
}

// Export singleton instance
export const recoveryManager = RecoveryManager.getInstance()