/**
 * Cache Invalidation Strategies for External Data Sources
 * Provides intelligent cache invalidation based on data freshness requirements
 */

import { intelligentCache } from './cache'
import { logger } from '@/lib/logger'

export interface InvalidationRule {
  name: string
  source: string
  condition: (entry: any, metadata?: any) => boolean
  ttl: number
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface InvalidationStrategy {
  name: string
  description: string
  rules: InvalidationRule[]
  schedule?: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'custom'
  enabled: boolean
}

export class CacheInvalidationManager {
  private strategies: Map<string, InvalidationStrategy> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.initializeDefaultStrategies()
    this.startScheduledInvalidation()
  }

  /**
   * Initialize default invalidation strategies
   */
  private initializeDefaultStrategies(): void {
    // GitHub profiles - invalidate after 2 hours or if account seems inactive
    const githubStrategy: InvalidationStrategy = {
      name: 'github-profiles',
      description: 'Invalidate GitHub profiles based on activity and age',
      enabled: true,
      rules: [
        {
          name: 'recent-activity',
          source: 'github',
          condition: (entry: any) => {
            const lastActivity = new Date(entry.updated_at || entry.created_at)
            const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
            return hoursSinceActivity > 24 // Invalidate if no activity in 24 hours
          },
          ttl: 7200000, // 2 hours
          priority: 'medium'
        },
        {
          name: 'low-activity',
          source: 'github',
          condition: (entry: any) => {
            const followers = entry.followers || 0
            const repos = entry.public_repos || 0
            return followers < 10 && repos < 5 // Low activity profiles
          },
          ttl: 14400000, // 4 hours
          priority: 'low'
        }
      ]
    }

    // Company data - invalidate based on company size and industry
    const companyStrategy: InvalidationStrategy = {
      name: 'company-data',
      description: 'Invalidate company data based on size and industry volatility',
      enabled: true,
      rules: [
        {
          name: 'startup-companies',
          source: 'clearbit',
          condition: (entry: any) => {
            const employees = entry.employees || 0
            return employees < 50 // Startups change more frequently
          },
          ttl: 3600000, // 1 hour
          priority: 'high'
        },
        {
          name: 'enterprise-companies',
          source: 'clearbit',
          condition: (entry: any) => {
            const employees = entry.employees || 0
            return employees >= 1000 // Large companies change less frequently
          },
          ttl: 86400000, // 24 hours
          priority: 'low'
        }
      ]
    }

    // Technical data - invalidate based on technology trends
    const technicalStrategy: InvalidationStrategy = {
      name: 'technical-data',
      description: 'Invalidate technical data based on technology lifecycle',
      enabled: true,
      rules: [
        {
          name: 'trending-topics',
          source: 'stackoverflow',
          condition: (entry: any) => {
            // If questions have high recent activity, invalidate more frequently
            const hasRecentAnswers = entry.some((q: any) => {
              const lastActivity = new Date(q.last_activity_date * 1000)
              const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
              return hoursSinceActivity < 24
            })
            return hasRecentAnswers
          },
          ttl: 1800000, // 30 minutes
          priority: 'high'
        },
        {
          name: 'stable-topics',
          source: 'stackoverflow',
          condition: (entry: any) => {
            // Older questions with stable answers
            const hasOldAnswers = entry.some((q: any) => {
              const lastActivity = new Date(q.last_activity_date * 1000)
              const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
              return daysSinceActivity > 30
            })
            return hasOldAnswers
          },
          ttl: 21600000, // 6 hours
          priority: 'medium'
        }
      ]
    }

    this.strategies.set('github', githubStrategy)
    this.strategies.set('clearbit', companyStrategy)
    this.strategies.set('stackoverflow', technicalStrategy)
  }

  /**
   * Apply invalidation strategy for a specific source
   */
  async applyStrategy(source: string, data?: any): Promise<void> {
    const strategy = this.strategies.get(source)
    if (!strategy || !strategy.enabled) {
      return
    }

    logger.info(`Applying invalidation strategy for ${source}`)

    const cacheEntries = intelligentCache.getCacheEntries()
    const entriesToInvalidate: string[] = []

    for (const entry of cacheEntries) {
      if (entry.source !== source) continue

      for (const rule of strategy.rules) {
        try {
          if (rule.condition(entry.data, entry.metadata)) {
            entriesToInvalidate.push(entry.key)
            logger.debug(`Invalidating ${entry.key} due to rule: ${rule.name}`)
            break // Only need to match one rule
          }
        } catch (error) {
          logger.warn(`Error applying invalidation rule ${rule.name}:`, {
            error: error instanceof Error ? error.message : String(error),
            entry: entry.key
          })
        }
      }
    }

    // Invalidate matching entries
    for (const key of entriesToInvalidate) {
      intelligentCache.clear() // Simple approach - clear entire cache for now
      // TODO: Implement selective cache entry deletion
    }

    if (entriesToInvalidate.length > 0) {
      logger.info(`Invalidated ${entriesToInvalidate.length} entries for ${source}`)
    }
  }

  /**
   * Manual invalidation by pattern
   */
  async invalidateByPattern(pattern: string, source?: string): Promise<void> {
    logger.info(`Manual invalidation by pattern: ${pattern}`)

    const cacheEntries = intelligentCache.getCacheEntries()
    const entriesToInvalidate: string[] = []

    for (const entry of cacheEntries) {
      if (source && entry.source !== source) continue

      if (entry.key.includes(pattern)) {
        entriesToInvalidate.push(entry.key)
      }
    }

    // Invalidate matching entries
    for (const key of entriesToInvalidate) {
      intelligentCache.clear() // Simple approach - clear entire cache for now
    }

    if (entriesToInvalidate.length > 0) {
      logger.info(`Invalidated ${entriesToInvalidate.length} entries matching pattern: ${pattern}`)
    }
  }

  /**
   * Invalidate specific cache entry
   */
  async invalidateKey(key: string): Promise<void> {
    logger.info(`Invalidating specific cache key: ${key}`)
    intelligentCache.clear() // Simple approach - clear entire cache for now
  }

  /**
   * Start scheduled invalidation
   */
  private startScheduledInvalidation(): void {
    // Run invalidation every hour
    const hourlyTimer = setInterval(() => {
      this.runScheduledInvalidation()
    }, 3600000) // 1 hour

    this.timers.set('hourly', hourlyTimer)

    // Run daily cleanup at midnight
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const msUntilMidnight = tomorrow.getTime() - now.getTime()

    const dailyTimer = setTimeout(() => {
      this.runDailyInvalidation()
      // Then set up recurring daily timer
      const dailyIntervalTimer = setInterval(() => {
        this.runDailyInvalidation()
      }, 86400000) // 24 hours

      this.timers.set('daily', dailyIntervalTimer)
    }, msUntilMidnight)

    this.timers.set('daily-setup', dailyTimer)
  }

  /**
   * Run scheduled invalidation
   */
  private async runScheduledInvalidation(): Promise<void> {
    logger.debug('Running scheduled cache invalidation')

    for (const [source, strategy] of this.strategies) {
      if (strategy.enabled) {
        await this.applyStrategy(source)
      }
    }
  }

  /**
   * Run daily invalidation (more aggressive cleanup)
   */
  private async runDailyInvalidation(): Promise<void> {
    logger.info('Running daily cache invalidation')

    // Clear old entries that haven't been accessed recently
    const cacheEntries = intelligentCache.getCacheEntries()
    const now = Date.now()
    const entriesToInvalidate: string[] = []

    for (const entry of cacheEntries) {
      const hoursSinceAccess = (now - entry.lastAccessed) / (1000 * 60 * 60)

      // Invalidate entries not accessed in 24 hours
      if (hoursSinceAccess > 24) {
        entriesToInvalidate.push(entry.key)
      }
    }

    // Invalidate old entries
    for (const key of entriesToInvalidate) {
      intelligentCache.clear() // Simple approach - clear entire cache for now
    }

    if (entriesToInvalidate.length > 0) {
      logger.info(`Daily cleanup invalidated ${entriesToInvalidate.length} old entries`)
    }

    // Apply all strategies with fresh data
    await this.runScheduledInvalidation()
  }

  /**
   * Add custom invalidation strategy
   */
  addStrategy(strategy: InvalidationStrategy): void {
    this.strategies.set(strategy.name, strategy)
    logger.info(`Added custom invalidation strategy: ${strategy.name}`)
  }

  /**
   * Remove invalidation strategy
   */
  removeStrategy(strategyName: string): void {
    this.strategies.delete(strategyName)
    logger.info(`Removed invalidation strategy: ${strategyName}`)
  }

  /**
   * Get all strategies
   */
  getStrategies(): InvalidationStrategy[] {
    return Array.from(this.strategies.values())
  }

  /**
   * Enable/disable strategy
   */
  setStrategyEnabled(strategyName: string, enabled: boolean): void {
    const strategy = this.strategies.get(strategyName)
    if (strategy) {
      strategy.enabled = enabled
      logger.info(`${enabled ? 'Enabled' : 'Disabled'} invalidation strategy: ${strategyName}`)
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer)
      clearTimeout(timer)
    }
    this.timers.clear()
    this.strategies.clear()
    logger.info('Cache invalidation manager destroyed')
  }
}

// Export singleton instance
export const cacheInvalidationManager = new CacheInvalidationManager()
export default cacheInvalidationManager