import { createClient } from '@/lib/supabase/server'
import { tenantService } from '@/lib/tenant/tenant-service'
import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'

// Configuration schemas
export const CONFIG_SCHEMAS = {
  ai_receptionist: {
    greeting_message: 'string',
    business_hours: 'object',
    services: 'array',
    language: 'string',
    voice_settings: 'object',
    fallback_responses: 'object',
  },
  chatbot: {
    welcome_message: 'string',
    fallback_message: 'string',
    max_conversation_length: 'number',
    auto_resolve_timeout: 'number',
    escalation_rules: 'object',
  },
  lead_generation: {
    auto_qualification: 'boolean',
    scoring_weights: 'object',
    follow_up_delays: 'object',
    notification_settings: 'object',
  },
  email_campaigns: {
    from_name: 'string',
    from_email: 'string',
    reply_to_email: 'string',
    tracking_enabled: 'boolean',
    unsubscribe_footer: 'boolean',
  },
  analytics: {
    retention_period: 'number',
    real_time_updates: 'boolean',
    custom_dashboards: 'array',
    export_formats: 'array',
  },
  integrations: {
    webhook_timeout: 'number',
    retry_attempts: 'number',
    rate_limits: 'object',
    error_handling: 'object',
  },
} as const

// Default configurations
export const DEFAULT_CONFIGS = {
  ai_receptionist: {
    greeting_message: 'Hello! Thank you for calling. How can I assist you today?',
    business_hours: {
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { open: '09:00', close: '17:00' },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '17:00' },
      saturday: { open: '10:00', close: '14:00' },
      sunday: { closed: true },
    },
    services: ['General Consultation', 'Appointment Booking', 'Information Request'],
    language: 'en-US',
    voice_settings: {
      voice: 'female',
      speed: 1.0,
      pitch: 1.0,
    },
    fallback_responses: {
      no_understanding: "I'm sorry, I didn't understand that. Could you please rephrase?",
      transfer_to_human: 'Let me transfer you to a human representative.',
      outside_hours: 'Thank you for calling. We are currently outside business hours.',
    },
  },
  chatbot: {
    welcome_message: 'Hi there! How can I help you today?',
    fallback_message: "I'm sorry, I didn't understand that. Could you try rephrasing your question?",
    max_conversation_length: 50,
    auto_resolve_timeout: 30, // minutes
    escalation_rules: {
      keywords: ['speak to human', 'talk to person', 'representative'],
      sentiment_threshold: -0.3,
      unresolved_turns: 5,
    },
  },
  lead_generation: {
    auto_qualification: true,
    scoring_weights: {
      email_domain: 20,
      job_title: 15,
      company_size: 10,
      engagement_score: 25,
      source_quality: 30,
    },
    follow_up_delays: {
      hot: 5, // minutes
      warm: 60, // minutes
      cold: 1440, // minutes (24 hours)
    },
    notification_settings: {
      email: true,
      slack: false,
      sms: false,
    },
  },
  email_campaigns: {
    from_name: '{{business_name}}',
    from_email: 'noreply@{{domain}}',
    reply_to_email: 'support@{{domain}}',
    tracking_enabled: true,
    unsubscribe_footer: true,
  },
  analytics: {
    retention_period: 365, // days
    real_time_updates: true,
    custom_dashboards: [],
    export_formats: ['csv', 'pdf', 'xlsx'],
  },
  integrations: {
    webhook_timeout: 30, // seconds
    retry_attempts: 3,
    rate_limits: {
      requests_per_minute: 60,
      burst_limit: 10,
    },
    error_handling: {
      retry_on_failure: true,
      alert_on_errors: true,
      log_all_requests: false,
    },
  },
} as const

export class TenantConfigService {
  private async getSupabase() {
    return await createClient()
  }

  /**
   * Get tenant configuration with defaults
   */
  async getTenantConfig(
    tenantId: string,
    configKey: keyof typeof CONFIG_SCHEMAS,
    userId: string
  ): Promise<any> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    // Try to get tenant-specific config
    const { data: tenantConfig, error } = await supabase
      .from('tenant_configs')
      .select('config_value')
      .eq('tenant_id', tenantId)
      .eq('config_key', configKey)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    // Merge with defaults
    const defaultConfig = DEFAULT_CONFIGS[configKey]
    const tenantSpecific = tenantConfig?.config_value || {}

    return this.mergeConfigs(defaultConfig, tenantSpecific)
  }

  /**
   * Set tenant configuration
   */
  async setTenantConfig(
    tenantId: string,
    configKey: keyof typeof CONFIG_SCHEMAS,
    configValue: any,
    userId: string
  ): Promise<void> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    // Validate configuration
    this.validateConfig(configKey, configValue)

    const supabase = await this.getSupabase()

    const { error } = await supabase
      .from('tenant_configs')
      .upsert({
        tenant_id: tenantId,
        config_key: configKey,
        config_value: configValue,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,config_key'
      })

    if (error) throw error

    logger.info('Tenant config updated', { tenantId, configKey, userId })
  }

  /**
   * Get all tenant configurations
   */
  async getAllTenantConfigs(tenantId: string, userId: string): Promise<Record<string, any>> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const configs: Record<string, any> = {}

    for (const configKey of Object.keys(CONFIG_SCHEMAS) as Array<keyof typeof CONFIG_SCHEMAS>) {
      configs[configKey] = await this.getTenantConfig(tenantId, configKey, userId)
    }

    return configs
  }

  /**
   * Reset configuration to defaults
   */
  async resetTenantConfig(
    tenantId: string,
    configKey: keyof typeof CONFIG_SCHEMAS,
    userId: string
  ): Promise<void> {
    await tenantService.checkPermission(userId, tenantId, 'tenant:update')

    const supabase = await this.getSupabase()

    const { error } = await supabase
      .from('tenant_configs')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('config_key', configKey)

    if (error) throw error

    logger.info('Tenant config reset to defaults', { tenantId, configKey, userId })
  }

  /**
   * Get configuration template
   */
  getConfigTemplate(configKey: keyof typeof CONFIG_SCHEMAS): any {
    return DEFAULT_CONFIGS[configKey]
  }

  /**
   * Get all configuration templates
   */
  getAllConfigTemplates(): Record<string, any> {
    return DEFAULT_CONFIGS
  }

  /**
   * Validate configuration against schema
   */
  private validateConfig(configKey: keyof typeof CONFIG_SCHEMAS, configValue: any): void {
    const schema = CONFIG_SCHEMAS[configKey]
    const defaultConfig = DEFAULT_CONFIGS[configKey]

    // Basic validation - check if all required fields are present and correct type
    this.validateObject(configValue, schema, defaultConfig, `config.${configKey}`)
  }

  /**
   * Recursively validate object against schema
   */
  private validateObject(
    obj: any,
    schema: Record<string, string>,
    defaults: any,
    path: string
  ): void {
    if (typeof obj !== 'object' || obj === null) {
      throw new ValidationError(`Configuration at ${path} must be an object`)
    }

    for (const [key, expectedType] of Object.entries(schema)) {
      const value = obj[key]
      const defaultValue = defaults[key]

      if (value === undefined) {
        // Use default if not provided
        continue
      }

      const actualType = Array.isArray(value) ? 'array' : typeof value

      if (actualType !== expectedType) {
        throw new ValidationError(
          `Configuration ${path}.${key} must be of type ${expectedType}, got ${actualType}`
        )
      }

      // Recursively validate nested objects
      if (expectedType === 'object' && defaultValue && typeof defaultValue === 'object') {
        this.validateObject(value, this.inferSchema(defaultValue), defaultValue, `${path}.${key}`)
      }
    }
  }

  /**
   * Infer schema from default configuration
   */
  private inferSchema(defaultConfig: any): Record<string, string> {
    const schema: Record<string, string> = {}

    for (const [key, value] of Object.entries(defaultConfig)) {
      if (Array.isArray(value)) {
        schema[key] = 'array'
      } else {
        schema[key] = typeof value
      }
    }

    return schema
  }

  /**
   * Merge tenant config with defaults
   */
  private mergeConfigs(defaultConfig: any, tenantConfig: any): any {
    if (!tenantConfig || typeof tenantConfig !== 'object') {
      return defaultConfig
    }

    const merged = { ...defaultConfig }

    for (const [key, value] of Object.entries(tenantConfig)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value) && defaultConfig[key] && typeof defaultConfig[key] === 'object') {
          merged[key] = this.mergeConfigs(defaultConfig[key], value)
        } else {
          merged[key] = value
        }
      }
    }

    return merged
  }

  /**
   * Get configuration diff (what's changed from defaults)
   */
  async getConfigDiff(
    tenantId: string,
    configKey: keyof typeof CONFIG_SCHEMAS,
    userId: string
  ): Promise<{ added: any, modified: any, removed: any }> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    const { data: tenantConfig } = await supabase
      .from('tenant_configs')
      .select('config_value')
      .eq('tenant_id', tenantId)
      .eq('config_key', configKey)
      .single()

    const defaultConfig = DEFAULT_CONFIGS[configKey]
    const currentConfig = tenantConfig?.config_value || {}

    return this.calculateDiff(defaultConfig, currentConfig)
  }

  /**
   * Calculate diff between two configurations
   */
  private calculateDiff(defaultConfig: any, currentConfig: any): { added: any, modified: any, removed: any } {
    const added: any = {}
    const modified: any = {}
    const removed: any = {}

    // Find added and modified
    for (const [key, value] of Object.entries(currentConfig)) {
      if (!(key in defaultConfig)) {
        added[key] = value
      } else if (JSON.stringify(defaultConfig[key]) !== JSON.stringify(value)) {
        modified[key] = value
      }
    }

    // Find removed (keys in default but not in current)
    for (const key of Object.keys(defaultConfig)) {
      if (!(key in currentConfig)) {
        removed[key] = defaultConfig[key]
      }
    }

    return { added, modified, removed }
  }
}

// Export singleton instance
export const tenantConfigService = new TenantConfigService()