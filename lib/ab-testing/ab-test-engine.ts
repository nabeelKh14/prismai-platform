/**
 * A/B Testing Engine for Lead Generation
 * Handles multivariate testing for emails, landing pages, and campaigns
 */

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface ABTestVariant {
  id: string
  name: string
  config: any
  weight: number // Percentage of traffic (0-100)
}

export interface ABTest {
  id: string
  name: string
  testType: 'email_subject' | 'email_content' | 'send_time' | 'landing_page' | 'cta_button'
  variants: ABTestVariant[]
  targetAudience: any
  winnerCriteria: any
  status: 'draft' | 'running' | 'completed' | 'paused'
  startDate?: Date
  endDate?: Date
}

export interface TestResult {
  variantId: string
  impressions: number
  conversions: number
  conversionRate: number
  confidence: number
  isWinner: boolean
}

export class ABTestEngine {
  private static instance: ABTestEngine

  static getInstance(): ABTestEngine {
    if (!ABTestEngine.instance) {
      ABTestEngine.instance = new ABTestEngine()
    }
    return ABTestEngine.instance
  }

  /**
   * Assign a lead to a test variant
   */
  async assignVariant(testId: string, leadId: string, userId: string): Promise<ABTestVariant | null> {
    try {
      const supabase = await createClient()

      // Get test details
      const { data: test } = await supabase
        .from('ab_tests')
        .select('*')
        .eq('id', testId)
        .eq('user_id', userId)
        .eq('status', 'running')
        .single()

      if (!test) {
        return null
      }

      // Check if lead matches target audience
      const matchesAudience = await this.matchesTargetAudience(leadId, test.target_audience, userId)
      if (!matchesAudience) {
        return null
      }

      // Check if lead is already assigned to this test
      const { data: existingAssignment } = await supabase
        .from('ab_test_results')
        .select('variant_id')
        .eq('test_id', testId)
        .eq('lead_id', leadId)
        .single()

      if (existingAssignment) {
        // Return existing variant
        const variant = test.variants.find(v => v.id === existingAssignment.variant_id)
        return variant || null
      }

      // Assign new variant based on weights
      const variant = this.selectVariantByWeight(test.variants as ABTestVariant[])

      // Record assignment
      await supabase
        .from('ab_test_results')
        .insert({
          test_id: testId,
          variant_id: variant.id,
          lead_id: leadId,
          impressions: 1,
          conversions: 0
        })

      return variant

    } catch (error) {
      logger.error('Error assigning test variant:', error)
      return null
    }
  }

  /**
   * Record a conversion for a test
   */
  async recordConversion(testId: string, leadId: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Increment conversion count
      await supabase
        .from('ab_test_results')
        .update({
          conversions: supabase.raw('conversions + 1')
        })
        .eq('test_id', testId)
        .eq('lead_id', leadId)

    } catch (error) {
      logger.error('Error recording conversion:', error)
    }
  }

  /**
   * Record an impression for a test
   */
  async recordImpression(testId: string, leadId: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      // Increment impression count
      await supabase
        .from('ab_test_results')
        .update({
          impressions: supabase.raw('impressions + 1')
        })
        .eq('test_id', testId)
        .eq('lead_id', leadId)

    } catch (error) {
      logger.error('Error recording impression:', error)
    }
  }

  /**
   * Calculate test results and determine winner
   */
  async calculateResults(testId: string, userId: string): Promise<TestResult[]> {
    try {
      const supabase = await createClient()

      // Get test results
      const { data: results } = await supabase
        .from('ab_test_results')
        .select('*')
        .eq('test_id', testId)

      if (!results || results.length === 0) {
        return []
      }

      // Group by variant
      const variantStats = new Map<string, { impressions: number; conversions: number }>()

      results.forEach(result => {
        const existing = variantStats.get(result.variant_id) || { impressions: 0, conversions: 0 }
        variantStats.set(result.variant_id, {
          impressions: existing.impressions + (result.impressions || 0),
          conversions: existing.conversions + (result.conversions || 0)
        })
      })

      // Calculate conversion rates and confidence
      const testResults: TestResult[] = []
      let bestConversionRate = 0
      let bestVariant: TestResult | null = null

      for (const [variantId, stats] of variantStats) {
        const conversionRate = stats.impressions > 0 ? stats.conversions / stats.impressions : 0
        const confidence = this.calculateConfidence(stats.conversions, stats.impressions)

        const result: TestResult = {
          variantId,
          impressions: stats.impressions,
          conversions: stats.conversions,
          conversionRate,
          confidence,
          isWinner: false
        }

        testResults.push(result)

        // Track best performing variant
        if (conversionRate > bestConversionRate) {
          bestConversionRate = conversionRate
          bestVariant = result
        }
      }

      // Mark winner if confidence is high enough
      if (bestVariant && bestVariant.confidence > 95) {
        bestVariant.isWinner = true
      }

      return testResults

    } catch (error) {
      logger.error('Error calculating test results:', error)
      return []
    }
  }

  /**
   * Check if a lead matches the target audience criteria
   */
  private async matchesTargetAudience(leadId: string, criteria: any, userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      // Get lead data
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single()

      if (!lead) {
        return false
      }

      // Check criteria (simplified implementation)
      if (criteria.minScore && lead.lead_score < criteria.minScore) {
        return false
      }

      if (criteria.maxScore && lead.lead_score > criteria.maxScore) {
        return false
      }

      if (criteria.status && lead.status !== criteria.status) {
        return false
      }

      if (criteria.tags && criteria.tags.length > 0) {
        const leadTags = lead.tags || []
        const hasMatchingTag = criteria.tags.some((tag: string) => leadTags.includes(tag))
        if (!hasMatchingTag) {
          return false
        }
      }

      if (criteria.sourceId && lead.source_id !== criteria.sourceId) {
        return false
      }

      return true

    } catch (error) {
      logger.error('Error checking target audience:', error)
      return false
    }
  }

  /**
   * Select variant based on weights
   */
  private selectVariantByWeight(variants: ABTestVariant[]): ABTestVariant {
    const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0)
    let random = Math.random() * totalWeight

    for (const variant of variants) {
      random -= variant.weight
      if (random <= 0) {
        return variant
      }
    }

    // Fallback to first variant
    return variants[0]
  }

  /**
   * Calculate statistical confidence for A/B test results
   */
  private calculateConfidence(conversions: number, impressions: number): number {
    if (impressions === 0) return 0

    const conversionRate = conversions / impressions
    const standardError = Math.sqrt((conversionRate * (1 - conversionRate)) / impressions)

    // Simplified confidence calculation (would use proper statistical methods in production)
    if (impressions < 100) {
      return Math.max(0, 50 - (100 - impressions)) // Low confidence for small samples
    }

    // Higher confidence for larger samples with consistent results
    const zScore = 1.96 // 95% confidence interval
    const marginOfError = zScore * standardError
    const confidence = Math.min(99, (1 - marginOfError / conversionRate) * 100)

    return Math.max(0, confidence)
  }

  /**
   * Get active tests for a user
   */
  async getActiveTests(userId: string): Promise<ABTest[]> {
    try {
      const supabase = await createClient()

      const { data: tests } = await supabase
        .from('ab_tests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'running')

      return tests || []

    } catch (error) {
      logger.error('Error getting active tests:', error)
      return []
    }
  }

  /**
   * Automatically complete tests that have reached their end date
   */
  async processCompletedTests(): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: completedTests } = await supabase
        .from('ab_tests')
        .select('id, user_id')
        .eq('status', 'running')
        .not('end_date', 'is', null)
        .lte('end_date', new Date().toISOString())

      for (const test of completedTests || []) {
        // Calculate final results
        const results = await this.calculateResults(test.id, test.user_id)

        // Update test status
        await supabase
          .from('ab_tests')
          .update({ status: 'completed' })
          .eq('id', test.id)

        logger.info(`Completed A/B test ${test.id} with ${results.length} variants`)
      }

    } catch (error) {
      logger.error('Error processing completed tests:', error)
    }
  }
}

export const abTestEngine = ABTestEngine.getInstance()