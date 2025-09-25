import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

export interface CountryAdequacyDecision {
  id: string
  countryCode: string
  countryName: string
  adequacyStatus: 'adequate' | 'partially_adequate' | 'inadequate' | 'under_review' | 'revoked'
  decisionDate: Date
  implementingDecisionNumber: string
  decisionSummary: string
  adequacyMechanisms: string[]
  restrictions: string[]
  reviewDueDate?: Date
  isActive: boolean
  sourceUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface AdequacyValidationResult {
  isAdequate: boolean
  status: string
  decisionDate: Date
  restrictions: string[]
  availableMechanisms: string[]
  requiresAdditionalSafeguards: boolean
  recommendations: string[]
}

export class AdequacyDecisionsService {
  private supabase = createClient()

  // Cache for adequacy decisions to improve performance
  private adequacyCache = new Map<string, { decision: CountryAdequacyDecision; expires: number }>()
  private readonly CACHE_TTL = 3600000 // 1 hour in milliseconds

  /**
   * Get adequacy decision for a specific country
   */
  async getCountryAdequacy(countryCode: string): Promise<CountryAdequacyDecision | null> {
    try {
      // Check cache first
      const cached = this.adequacyCache.get(countryCode.toUpperCase())
      if (cached && cached.expires > Date.now()) {
        return cached.decision
      }

      const supabase = await this.supabase
      const { data, error } = await supabase
        .from('country_adequacy_decisions')
        .select('*')
        .eq('country_code', countryCode.toUpperCase())
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        const decision: CountryAdequacyDecision = {
          ...data,
          decisionDate: new Date(data.decision_date),
          reviewDueDate: data.review_due_date ? new Date(data.review_due_date) : undefined,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        }

        // Cache the result
        this.adequacyCache.set(countryCode.toUpperCase(), {
          decision,
          expires: Date.now() + this.CACHE_TTL
        })

        return decision
      }

      return null
    } catch (error) {
      logger.error('Failed to get country adequacy decision', error as Error, { countryCode })
      return null
    }
  }

  /**
   * Validate if a country has adequate protection for data transfers
   */
  async validateAdequacy(countryCode: string): Promise<AdequacyValidationResult> {
    try {
      const decision = await this.getCountryAdequacy(countryCode)

      if (!decision) {
        return {
          isAdequate: false,
          status: 'unknown',
          decisionDate: new Date(),
          restrictions: ['No adequacy decision found'],
          availableMechanisms: ['scc', 'binding_corporate_rules'],
          requiresAdditionalSafeguards: true,
          recommendations: [
            'Use Standard Contractual Clauses (SCCs) for transfers to this country',
            'Consider supplementary measures if SCCs are used',
            'Perform Transfer Impact Assessment (TIA) before transferring data'
          ]
        }
      }

      const isAdequate = decision.adequacyStatus === 'adequate'
      const requiresAdditionalSafeguards = decision.adequacyStatus === 'partially_adequate' ||
                                           decision.restrictions.length > 0

      let recommendations: string[] = []
      if (!isAdequate) {
        recommendations.push('Use Standard Contractual Clauses (SCCs) for transfers to this country')
        recommendations.push('Perform Transfer Impact Assessment (TIA) before transferring data')
      }

      if (decision.restrictions.length > 0) {
        recommendations.push(`Comply with restrictions: ${decision.restrictions.join(', ')}`)
      }

      if (decision.reviewDueDate && decision.reviewDueDate < new Date()) {
        recommendations.push('Adequacy decision is due for review - consider supplementary measures')
      }

      return {
        isAdequate,
        status: decision.adequacyStatus,
        decisionDate: decision.decisionDate,
        restrictions: decision.restrictions,
        availableMechanisms: decision.adequacyMechanisms,
        requiresAdditionalSafeguards,
        recommendations
      }
    } catch (error) {
      logger.error('Failed to validate country adequacy', error as Error, { countryCode })
      return {
        isAdequate: false,
        status: 'error',
        decisionDate: new Date(),
        restrictions: ['Validation failed due to system error'],
        availableMechanisms: ['scc'],
        requiresAdditionalSafeguards: true,
        recommendations: ['Contact system administrator', 'Use SCCs as fallback mechanism']
      }
    }
  }

  /**
   * Get all countries with adequacy decisions
   */
  async getAllAdequacyDecisions(): Promise<CountryAdequacyDecision[]> {
    try {
      const supabase = await this.supabase
      const { data, error } = await supabase
        .from('country_adequacy_decisions')
        .select('*')
        .eq('is_active', true)
        .order('country_name')

      if (error) throw error

      return data.map(item => ({
        ...item,
        decisionDate: new Date(item.decision_date),
        reviewDueDate: item.review_due_date ? new Date(item.review_due_date) : undefined,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }))
    } catch (error) {
      logger.error('Failed to get all adequacy decisions', error as Error)
      return []
    }
  }

  /**
   * Get countries with adequate status
   */
  async getAdequateCountries(): Promise<CountryAdequacyDecision[]> {
    try {
      const allDecisions = await this.getAllAdequacyDecisions()
      return allDecisions.filter(decision => decision.adequacyStatus === 'adequate')
    } catch (error) {
      logger.error('Failed to get adequate countries', error as Error)
      return []
    }
  }

  /**
   * Get countries requiring additional safeguards
   */
  async getCountriesRequiringSafeguards(): Promise<CountryAdequacyDecision[]> {
    try {
      const allDecisions = await this.getAllAdequacyDecisions()
      return allDecisions.filter(decision =>
        decision.adequacyStatus === 'partially_adequate' ||
        decision.adequacyStatus === 'inadequate' ||
        decision.restrictions.length > 0
      )
    } catch (error) {
      logger.error('Failed to get countries requiring safeguards', error as Error)
      return []
    }
  }

  /**
   * Update adequacy decision (admin function)
   */
  async updateAdequacyDecision(
    countryCode: string,
    updates: Partial<Omit<CountryAdequacyDecision, 'id' | 'countryCode' | 'createdAt'>>,
    updatedBy: string
  ): Promise<CountryAdequacyDecision> {
    try {
      const supabase = await this.supabase

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('country_adequacy_decisions')
        .update(updateData)
        .eq('country_code', countryCode.toUpperCase())
        .select()
        .single()

      if (error) throw error

      // Clear cache
      this.adequacyCache.delete(countryCode.toUpperCase())

      const updatedDecision: CountryAdequacyDecision = {
        ...data,
        decisionDate: new Date(data.decision_date),
        reviewDueDate: data.review_due_date ? new Date(data.review_due_date) : undefined,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      }

      SecurityAudit.logSensitiveAction('adequacy_decision_updated', updatedBy, {
        countryCode,
        previousStatus: 'unknown', // Would need to track previous state
        newStatus: updates.adequacyStatus,
        updatedBy
      })

      logger.info('Adequacy decision updated', {
        countryCode,
        updatedBy,
        changes: updates
      })

      return updatedDecision
    } catch (error) {
      logger.error('Failed to update adequacy decision', error as Error, {
        countryCode,
        updates,
        updatedBy
      })
      throw error
    }
  }

  /**
   * Add new adequacy decision (admin function)
   */
  async addAdequacyDecision(
    decision: Omit<CountryAdequacyDecision, 'id' | 'createdAt' | 'updatedAt'>,
    createdBy: string
  ): Promise<CountryAdequacyDecision> {
    try {
      const supabase = await this.supabase

      const decisionData = {
        ...decision,
        country_code: decision.countryCode.toUpperCase(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('country_adequacy_decisions')
        .insert(decisionData)
        .select()
        .single()

      if (error) throw error

      const newDecision: CountryAdequacyDecision = {
        ...data,
        decisionDate: new Date(data.decision_date),
        reviewDueDate: data.review_due_date ? new Date(data.review_due_date) : undefined,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      }

      SecurityAudit.logSensitiveAction('adequacy_decision_added', createdBy, {
        countryCode: decision.countryCode,
        status: decision.adequacyStatus,
        createdBy
      })

      logger.info('New adequacy decision added', {
        countryCode: decision.countryCode,
        createdBy,
        status: decision.adequacyStatus
      })

      return newDecision
    } catch (error) {
      logger.error('Failed to add adequacy decision', error as Error, {
        decision,
        createdBy
      })
      throw error
    }
  }

  /**
   * Get adequacy statistics for compliance reporting
   */
  async getAdequacyStats(): Promise<{
    totalCountries: number
    adequateCountries: number
    partiallyAdequateCountries: number
    inadequateCountries: number
    underReviewCountries: number
    countriesByRegion: Record<string, number>
    upcomingReviews: number
  }> {
    try {
      const allDecisions = await this.getAllAdequacyDecisions()
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      const stats = {
        totalCountries: allDecisions.length,
        adequateCountries: 0,
        partiallyAdequateCountries: 0,
        inadequateCountries: 0,
        underReviewCountries: 0,
        countriesByRegion: {} as Record<string, number>,
        upcomingReviews: 0
      }

      for (const decision of allDecisions) {
        // Count by status
        switch (decision.adequacyStatus) {
          case 'adequate':
            stats.adequateCountries++
            break
          case 'partially_adequate':
            stats.partiallyAdequateCountries++
            break
          case 'inadequate':
            stats.inadequateCountries++
            break
          case 'under_review':
            stats.underReviewCountries++
            break
        }

        // Count by region (simplified - would need actual region mapping)
        const region = this.getCountryRegion(decision.countryCode)
        stats.countriesByRegion[region] = (stats.countriesByRegion[region] || 0) + 1

        // Count upcoming reviews
        if (decision.reviewDueDate && decision.reviewDueDate <= thirtyDaysFromNow) {
          stats.upcomingReviews++
        }
      }

      return stats
    } catch (error) {
      logger.error('Failed to get adequacy statistics', error as Error)
      return {
        totalCountries: 0,
        adequateCountries: 0,
        partiallyAdequateCountries: 0,
        inadequateCountries: 0,
        underReviewCountries: 0,
        countriesByRegion: {},
        upcomingReviews: 0
      }
    }
  }

  /**
   * Get countries with upcoming review dates
   */
  async getUpcomingReviews(daysAhead: number = 30): Promise<CountryAdequacyDecision[]> {
    try {
      const cutoffDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
      const allDecisions = await this.getAllAdequacyDecisions()

      return allDecisions.filter(decision =>
        decision.reviewDueDate && decision.reviewDueDate <= cutoffDate
      )
    } catch (error) {
      logger.error('Failed to get upcoming reviews', error as Error, { daysAhead })
      return []
    }
  }

  /**
   * Private helper methods
   */
  private getCountryRegion(countryCode: string): string {
    // Simplified region mapping - in production would use a comprehensive mapping
    const regionMap: Record<string, string> = {
      'GB': 'Europe',
      'CA': 'North America',
      'US': 'North America',
      'JP': 'Asia Pacific',
      'KR': 'Asia Pacific',
      'CH': 'Europe',
      'NZ': 'Asia Pacific',
      'UY': 'South America',
      'AR': 'South America'
    }

    return regionMap[countryCode] || 'Other'
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.adequacyCache.clear()
  }
}

// Export singleton instance
export const adequacyDecisionsService = new AdequacyDecisionsService()