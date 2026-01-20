import { logger } from '@/lib/logger'
import { TenantConfig } from './orchestrator'

export interface TenantConfiguration {
  tenantId: string
  enabled: boolean
  settings: {
    rateLimiting: {
      requestsPerMinute: number
      burstLimit: number
    }
    processing: {
      maxConcurrentAnalyses: number
      timeoutMs: number
      retryAttempts: number
      enableBatching: boolean
      batchSize: number
    }
    caching: {
      enabled: boolean
      ttlSeconds: number
      maxSize: number
    }
    features: {
      emotionDetection: boolean
      intentClassification: boolean
      realTimeProcessing: boolean
      batchProcessing: boolean
      webhookNotifications: boolean
    }
    quality: {
      minConfidenceThreshold: number
      enableQualityScoring: boolean
      qualityMetrics: string[]
    }
    security: {
      enableEncryption: boolean
      dataRetentionDays: number
      allowedChannels: string[]
    }
  }
  metadata: {
    createdAt: string
    updatedAt: string
    createdBy: string
    version: number
    environment: 'development' | 'staging' | 'production'
  }
}

export interface ConfigurationValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class TenantConfigurationManager {
  private configurations: Map<string, TenantConfiguration> = new Map()
  private configHistory: Map<string, TenantConfiguration[]> = new Map()
  private readonly maxHistorySize = 10

  constructor() {
    this.initializeDefaultConfigurations()
  }

  /**
   * Create or update tenant configuration
   */
  async setConfiguration(
    tenantId: string,
    config: Partial<TenantConfiguration['settings']>,
    updatedBy: string
  ): Promise<{ success: boolean; config?: TenantConfiguration; errors?: string[] }> {
    try {
      // Validate configuration
      const validation = this.validateConfiguration(config)
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        }
      }

      // Get existing configuration or create new one
      const existingConfig = this.configurations.get(tenantId)
      const now = new Date().toISOString()

      const newConfig: TenantConfiguration = {
        tenantId,
        enabled: existingConfig?.enabled ?? true,
        settings: existingConfig ? { ...existingConfig.settings, ...config } : this.getDefaultSettings(),
        metadata: {
          createdAt: existingConfig?.metadata.createdAt ?? now,
          updatedAt: now,
          createdBy: existingConfig?.metadata.createdBy ?? updatedBy,
          version: existingConfig ? existingConfig.metadata.version + 1 : 1,
          environment: existingConfig?.metadata.environment ?? 'production'
        }
      }

      // Store configuration
      this.configurations.set(tenantId, newConfig)

      // Update history
      this.addToHistory(tenantId, newConfig)

      // Apply configuration to pipeline components
      await this.applyConfiguration(tenantId, newConfig)

      logger.info('Tenant configuration updated', {
        tenantId,
        version: newConfig.metadata.version,
        updatedBy,
        changes: Object.keys(config)
      })

      return {
        success: true,
        config: newConfig
      }

    } catch (error) {
      logger.error('Failed to set tenant configuration', error as Error, {
        tenantId,
        updatedBy
      })

      return {
        success: false,
        errors: [(error as Error).message]
      }
    }
  }

  /**
   * Get tenant configuration
   */
  getConfiguration(tenantId: string): TenantConfiguration | null {
    return this.configurations.get(tenantId) || null
  }

  /**
   * Get all tenant configurations
   */
  getAllConfigurations(): TenantConfiguration[] {
    return Array.from(this.configurations.values())
  }

  /**
   * Enable or disable tenant
   */
  async setTenantEnabled(
    tenantId: string,
    enabled: boolean,
    updatedBy: string
  ): Promise<boolean> {
    try {
      const config = this.configurations.get(tenantId)
      if (!config) {
        return false
      }

      config.enabled = enabled
      config.metadata.updatedAt = new Date().toISOString()
      config.metadata.version++

      // Add to history
      this.addToHistory(tenantId, config)

      logger.info('Tenant enabled/disabled', {
        tenantId,
        enabled,
        updatedBy
      })

      return true

    } catch (error) {
      logger.error('Failed to set tenant enabled status', error as Error, {
        tenantId,
        enabled,
        updatedBy
      })
      return false
    }
  }

  /**
   * Get configuration history for tenant
   */
  getConfigurationHistory(tenantId: string, limit?: number): TenantConfiguration[] {
    const history = this.configHistory.get(tenantId) || []
    return limit ? history.slice(0, limit) : history
  }

  /**
   * Rollback configuration to specific version
   */
  async rollbackConfiguration(
    tenantId: string,
    version: number,
    updatedBy: string
  ): Promise<{ success: boolean; config?: TenantConfiguration; errors?: string[] }> {
    try {
      const history = this.configHistory.get(tenantId) || []
      const targetConfig = history.find(config => config.metadata.version === version)

      if (!targetConfig) {
        return {
          success: false,
          errors: [`Configuration version ${version} not found for tenant ${tenantId}`]
        }
      }

      // Create new version based on rollback
      const rolledBackConfig: TenantConfiguration = {
        ...targetConfig,
        metadata: {
          ...targetConfig.metadata,
          updatedAt: new Date().toISOString(),
          version: targetConfig.metadata.version + 1
        }
      }

      this.configurations.set(tenantId, rolledBackConfig)
      this.addToHistory(tenantId, rolledBackConfig)

      // Apply rolled back configuration
      await this.applyConfiguration(tenantId, rolledBackConfig)

      logger.info('Configuration rolled back', {
        tenantId,
        fromVersion: targetConfig.metadata.version + 1,
        toVersion: version,
        updatedBy
      })

      return {
        success: true,
        config: rolledBackConfig
      }

    } catch (error) {
      logger.error('Failed to rollback configuration', error as Error, {
        tenantId,
        version,
        updatedBy
      })

      return {
        success: false,
        errors: [(error as Error).message]
      }
    }
  }

  /**
   * Validate configuration settings
   */
  validateConfiguration(settings: Partial<TenantConfiguration['settings']>): ConfigurationValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Rate limiting validation
    if (settings.rateLimiting) {
      const { requestsPerMinute, burstLimit } = settings.rateLimiting

      if (requestsPerMinute && (requestsPerMinute < 1 || requestsPerMinute > 10000)) {
        errors.push('Requests per minute must be between 1 and 10000')
      }

      if (burstLimit && (burstLimit < 1 || burstLimit > 1000)) {
        errors.push('Burst limit must be between 1 and 1000')
      }

      if (burstLimit && requestsPerMinute && burstLimit < requestsPerMinute) {
        warnings.push('Burst limit is lower than requests per minute')
      }
    }

    // Processing validation
    if (settings.processing) {
      const { maxConcurrentAnalyses, timeoutMs, batchSize } = settings.processing

      if (maxConcurrentAnalyses && (maxConcurrentAnalyses < 1 || maxConcurrentAnalyses > 1000)) {
        errors.push('Max concurrent analyses must be between 1 and 1000')
      }

      if (timeoutMs && (timeoutMs < 100 || timeoutMs > 30000)) {
        errors.push('Timeout must be between 100ms and 30000ms')
      }

      if (batchSize && (batchSize < 1 || batchSize > 1000)) {
        errors.push('Batch size must be between 1 and 1000')
      }
    }

    // Caching validation
    if (settings.caching) {
      const { ttlSeconds, maxSize } = settings.caching

      if (ttlSeconds && (ttlSeconds < 30 || ttlSeconds > 3600)) {
        errors.push('Cache TTL must be between 30 and 3600 seconds')
      }

      if (maxSize && (maxSize < 100 || maxSize > 100000)) {
        errors.push('Cache max size must be between 100 and 100000 entries')
      }
    }

    // Quality validation
    if (settings.quality) {
      const { minConfidenceThreshold } = settings.quality

      if (minConfidenceThreshold && (minConfidenceThreshold < 0.1 || minConfidenceThreshold > 1.0)) {
        errors.push('Minimum confidence threshold must be between 0.1 and 1.0')
      }
    }

    // Security validation
    if (settings.security) {
      const { dataRetentionDays } = settings.security

      if (dataRetentionDays && (dataRetentionDays < 1 || dataRetentionDays > 365)) {
        errors.push('Data retention days must be between 1 and 365')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Export configuration for backup
   */
  exportConfiguration(tenantId?: string): string {
    const configsToExport = tenantId
      ? (this.configurations.get(tenantId) ? [this.configurations.get(tenantId)!] : [])
      : Array.from(this.configurations.values())

    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: '1.0',
      configurations: configsToExport
    }, null, 2)
  }

  /**
   * Import configuration from backup
   */
  async importConfiguration(
    configJson: string,
    updatedBy: string,
    overwriteExisting: boolean = false
  ): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      const data = JSON.parse(configJson)
      const importedConfigs = data.configurations || []

      let importedCount = 0
      const errors: string[] = []

      for (const config of importedConfigs) {
        try {
          if (!overwriteExisting && this.configurations.has(config.tenantId)) {
            errors.push(`Configuration for tenant ${config.tenantId} already exists`)
            continue
          }

          await this.setConfiguration(config.tenantId, config.settings, updatedBy)
          importedCount++

        } catch (error) {
          errors.push(`Failed to import config for tenant ${config.tenantId}: ${(error as Error).message}`)
        }
      }

      logger.info('Configuration import completed', {
        importedCount,
        errorCount: errors.length,
        updatedBy
      })

      return {
        success: errors.length === 0,
        imported: importedCount,
        errors
      }

    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [`Import failed: ${(error as Error).message}`]
      }
    }
  }

  /**
   * Get configuration statistics
   */
  getConfigurationStats(): {
    totalTenants: number
    enabledTenants: number
    disabledTenants: number
    byEnvironment: Record<string, number>
    averageVersion: number
  } {
    const configs = Array.from(this.configurations.values())
    const enabledTenants = configs.filter(c => c.enabled).length
    const disabledTenants = configs.length - enabledTenants

    const byEnvironment: Record<string, number> = {}
    let totalVersions = 0

    for (const config of configs) {
      byEnvironment[config.metadata.environment] =
        (byEnvironment[config.metadata.environment] || 0) + 1
      totalVersions += config.metadata.version
    }

    return {
      totalTenants: configs.length,
      enabledTenants,
      disabledTenants,
      byEnvironment,
      averageVersion: configs.length > 0 ? totalVersions / configs.length : 0
    }
  }

  private initializeDefaultConfigurations(): void {
    // Create default configuration for 'default' tenant
    const defaultConfig: TenantConfiguration = {
      tenantId: 'default',
      enabled: true,
      settings: this.getDefaultSettings(),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        version: 1,
        environment: 'production'
      }
    }

    this.configurations.set('default', defaultConfig)
    this.addToHistory('default', defaultConfig)

    logger.info('Default tenant configuration initialized')
  }

  private getDefaultSettings(): TenantConfiguration['settings'] {
    return {
      rateLimiting: {
        requestsPerMinute: 1000,
        burstLimit: 100
      },
      processing: {
        maxConcurrentAnalyses: 50,
        timeoutMs: 5000,
        retryAttempts: 3,
        enableBatching: true,
        batchSize: 50
      },
      caching: {
        enabled: true,
        ttlSeconds: 300,
        maxSize: 10000
      },
      features: {
        emotionDetection: true,
        intentClassification: true,
        realTimeProcessing: true,
        batchProcessing: false,
        webhookNotifications: false
      },
      quality: {
        minConfidenceThreshold: 0.3,
        enableQualityScoring: true,
        qualityMetrics: ['accuracy', 'latency', 'throughput']
      },
      security: {
        enableEncryption: true,
        dataRetentionDays: 90,
        allowedChannels: ['chat', 'voice', 'email', 'social']
      }
    }
  }

  private addToHistory(tenantId: string, config: TenantConfiguration): void {
    if (!this.configHistory.has(tenantId)) {
      this.configHistory.set(tenantId, [])
    }

    const history = this.configHistory.get(tenantId)!
    history.unshift(config) // Add to beginning

    // Keep only recent history
    if (history.length > this.maxHistorySize) {
      history.splice(this.maxHistorySize)
    }
  }

  private async applyConfiguration(
    tenantId: string,
    config: TenantConfiguration
  ): Promise<void> {
    try {
      // Apply rate limiting settings
      if (config.settings.rateLimiting) {
        // Update rate limiter with new settings
        logger.debug('Applied rate limiting configuration', {
          tenantId,
          settings: config.settings.rateLimiting
        })
      }

      // Apply processing settings
      if (config.settings.processing) {
        // Update processing pipeline with new settings
        logger.debug('Applied processing configuration', {
          tenantId,
          settings: config.settings.processing
        })
      }

      // Apply caching settings
      if (config.settings.caching) {
        // Update cache configuration
        logger.debug('Applied caching configuration', {
          tenantId,
          settings: config.settings.caching
        })
      }

      // Apply feature flags
      if (config.settings.features) {
        // Update feature flags across pipeline
        logger.debug('Applied feature configuration', {
          tenantId,
          settings: config.settings.features
        })
      }

    } catch (error) {
      logger.error('Failed to apply configuration', error as Error, {
        tenantId,
        version: config.metadata.version
      })
      throw error
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const stats = this.getConfigurationStats()

      // Check if we have at least the default configuration
      const healthy = stats.totalTenants > 0 && stats.enabledTenants > 0

      if (!healthy) {
        logger.warn('Configuration manager health check failed', { stats })
      }

      return healthy
    } catch (error) {
      logger.error('Configuration manager health check error', error as Error)
      return false
    }
  }
}

// Export singleton instance
export const tenantConfigurationManager = new TenantConfigurationManager()