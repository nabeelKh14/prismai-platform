import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'
import { accessControlService } from '@/lib/security/access-control'
import { adequacyDecisionsService } from './adequacy-decisions'

export interface TIATemplate {
  id: string
  templateName: string
  templateVersion: string
  description: string
  questions: TIATemplateQuestion[]
  riskCategories: Record<string, any>
  isActive: boolean
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface TIATemplateQuestion {
  question: string
  category: string
  riskWeight: number
  required: boolean
  answerType: 'text' | 'select' | 'multiselect' | 'boolean' | 'scale'
  options?: string[]
  guidance?: string
}

export interface TransferImpactAssessment {
  id: string
  tenantId: string
  templateId: string
  sccApplicationId?: string
  assessmentName: string
  transferDescription: string
  destinationCountries: string[]
  dataCategories: string[]
  riskAssessment: RiskAssessmentData
  overallRiskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  mitigatingMeasures: string[]
  supplementaryMeasures: string[]
  status: 'draft' | 'in_progress' | 'pending_review' | 'approved' | 'rejected' | 'expired'
  assessmentDate?: Date
  reviewDueDate?: Date
  approvedBy?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface RiskAssessmentData {
  dataSensitivity: 'low' | 'medium' | 'high' | 'critical'
  transferVolume: 'low' | 'medium' | 'high'
  recipientCountryRisk: 'low' | 'medium' | 'high' | 'critical'
  lackOfSupplementaryMeasures: boolean
  dataSubjectRights: 'adequate' | 'limited' | 'inadequate'
  enforcementMechanisms: 'strong' | 'moderate' | 'weak'
  governmentAccess: 'low' | 'medium' | 'high'
  additionalFactors: Record<string, any>
}

export interface TIAWorkflowStep {
  step: string
  description: string
  required: boolean
  completed: boolean
  completedAt?: Date
  completedBy?: string
  notes?: string
}

export class TransferImpactAssessmentService {
  private supabase = createClient()

  // Risk scoring weights
  private riskWeights = {
    dataSensitivity: { low: 1, medium: 2, high: 3, critical: 4 },
    transferVolume: { low: 1, medium: 2, high: 3 },
    recipientCountryRisk: { low: 1, medium: 2, high: 3, critical: 4 },
    lackOfSupplementaryMeasures: { true: 2, false: 0 },
    dataSubjectRights: { adequate: 1, limited: 2, inadequate: 3 },
    enforcementMechanisms: { strong: 1, moderate: 2, weak: 3 },
    governmentAccess: { low: 1, medium: 2, high: 3 }
  }

  /**
   * Create a new Transfer Impact Assessment
   */
  async createTIA(
    tenantId: string,
    assessmentData: Omit<TransferImpactAssessment, 'id' | 'tenantId' | 'overallRiskScore' | 'riskLevel' | 'createdAt' | 'updatedAt'>,
    createdBy: string
  ): Promise<TransferImpactAssessment> {
    try {
      // Validate permissions
      const hasPermission = await accessControlService.hasPermission(
        createdBy,
        'transfer_impact_assessment',
        'write'
      )

      if (!hasPermission) {
        throw new Error('Insufficient permissions to create TIA')
      }

      // Calculate risk score
      const riskScore = this.calculateRiskScore(assessmentData.riskAssessment)
      const riskLevel = this.getRiskLevel(riskScore)

      const assessment: Omit<TransferImpactAssessment, 'id'> = {
        ...assessmentData,
        tenantId,
        overallRiskScore: riskScore,
        riskLevel,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const supabase = await this.supabase
      const { data, error } = await supabase
        .from('transfer_impact_assessments')
        .insert(assessment)
        .select()
        .single()

      if (error) throw error

      SecurityAudit.logSensitiveAction('tia_created', createdBy, {
        assessmentId: data.id,
        tenantId,
        destinationCountries: assessmentData.destinationCountries,
        riskLevel,
        riskScore
      })

      logger.info('Transfer Impact Assessment created', {
        assessmentId: data.id,
        createdBy,
        riskLevel,
        riskScore
      })

      return data
    } catch (error) {
      logger.error('Failed to create TIA', error as Error, {
        tenantId,
        assessmentData,
        createdBy
      })
      throw error
    }
  }

  /**
   * Update an existing TIA
   */
  async updateTIA(
    assessmentId: string,
    updates: Partial<Omit<TransferImpactAssessment, 'id' | 'tenantId' | 'createdAt'>>,
    updatedBy: string
  ): Promise<TransferImpactAssessment> {
    try {
      const hasPermission = await accessControlService.hasPermission(
        updatedBy,
        'transfer_impact_assessment',
        'write'
      )

      if (!hasPermission) {
        throw new Error('Insufficient permissions to update TIA')
      }

      const supabase = await this.supabase

      // Get existing assessment
      const { data: existing, error: fetchError } = await supabase
        .from('transfer_impact_assessments')
        .select('*')
        .eq('id', assessmentId)
        .single()

      if (fetchError) throw fetchError

      // Recalculate risk score if risk assessment changed
      let riskScore = existing.overall_risk_score
      let riskLevel = existing.risk_level

      if (updates.riskAssessment) {
        riskScore = this.calculateRiskScore(updates.riskAssessment)
        riskLevel = this.getRiskLevel(riskScore)
      }

      const updateData = {
        ...updates,
        overall_risk_score: riskScore,
        risk_level: riskLevel,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('transfer_impact_assessments')
        .update(updateData)
        .eq('id', assessmentId)
        .select()
        .single()

      if (error) throw error

      SecurityAudit.logSensitiveAction('tia_updated', updatedBy, {
        assessmentId,
        previousRiskLevel: existing.risk_level,
        newRiskLevel: riskLevel,
        changes: Object.keys(updates)
      })

      logger.info('Transfer Impact Assessment updated', {
        assessmentId,
        updatedBy,
        riskLevel,
        riskScore
      })

      return data
    } catch (error) {
      logger.error('Failed to update TIA', error as Error, {
        assessmentId,
        updates,
        updatedBy
      })
      throw error
    }
  }

  /**
   * Submit TIA for review
   */
  async submitForReview(assessmentId: string, submittedBy: string): Promise<TransferImpactAssessment> {
    try {
      const hasPermission = await accessControlService.hasPermission(
        submittedBy,
        'transfer_impact_assessment',
        'write'
      )

      if (!hasPermission) {
        throw new Error('Insufficient permissions to submit TIA for review')
      }

      const supabase = await this.supabase

      const { data, error } = await supabase
        .from('transfer_impact_assessments')
        .update({
          status: 'pending_review',
          updated_at: new Date().toISOString()
        })
        .eq('id', assessmentId)
        .select()
        .single()

      if (error) throw error

      SecurityAudit.logSensitiveAction('tia_submitted_for_review', submittedBy, {
        assessmentId,
        riskLevel: data.risk_level,
        riskScore: data.overall_risk_score
      })

      logger.info('TIA submitted for review', {
        assessmentId,
        submittedBy,
        riskLevel: data.risk_level
      })

      return data
    } catch (error) {
      logger.error('Failed to submit TIA for review', error as Error, {
        assessmentId,
        submittedBy
      })
      throw error
    }
  }

  /**
   * Approve or reject TIA
   */
  async reviewTIA(
    assessmentId: string,
    decision: 'approved' | 'rejected',
    reviewedBy: string,
    notes?: string
  ): Promise<TransferImpactAssessment> {
    try {
      const hasPermission = await accessControlService.hasPermission(
        reviewedBy,
        'transfer_impact_assessment',
        'write'
      )

      if (!hasPermission) {
        throw new Error('Insufficient permissions to review TIA')
      }

      const supabase = await this.supabase

      const updateData: any = {
        status: decision,
        approved_by: reviewedBy,
        updated_at: new Date().toISOString()
      }

      if (notes) {
        updateData.review_notes = notes
      }

      const { data, error } = await supabase
        .from('transfer_impact_assessments')
        .update(updateData)
        .eq('id', assessmentId)
        .select()
        .single()

      if (error) throw error

      SecurityAudit.logSensitiveAction('tia_reviewed', reviewedBy, {
        assessmentId,
        decision,
        riskLevel: data.risk_level,
        riskScore: data.overall_risk_score
      })

      logger.info('TIA reviewed', {
        assessmentId,
        reviewedBy,
        decision,
        riskLevel: data.risk_level
      })

      return data
    } catch (error) {
      logger.error('Failed to review TIA', error as Error, {
        assessmentId,
        decision,
        reviewedBy
      })
      throw error
    }
  }

  /**
   * Get TIA by ID
   */
  async getTIA(assessmentId: string): Promise<TransferImpactAssessment | null> {
    try {
      const supabase = await this.supabase
      const { data, error } = await supabase
        .from('transfer_impact_assessments')
        .select('*')
        .eq('id', assessmentId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data || null
    } catch (error) {
      logger.error('Failed to get TIA', error as Error, { assessmentId })
      return null
    }
  }

  /**
   * Get TIAs for a tenant
   */
  async getTIAsForTenant(tenantId: string): Promise<TransferImpactAssessment[]> {
    try {
      const supabase = await this.supabase
      const { data, error } = await supabase
        .from('transfer_impact_assessments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      logger.error('Failed to get TIAs for tenant', error as Error, { tenantId })
      return []
    }
  }

  /**
   * Get TIA templates
   */
  async getTIATemplates(): Promise<TIATemplate[]> {
    try {
      const supabase = await this.supabase
      const { data, error } = await supabase
        .from('tia_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_name')

      if (error) throw error

      return data.map(template => ({
        ...template,
        createdAt: new Date(template.created_at),
        updatedAt: new Date(template.updated_at)
      }))
    } catch (error) {
      logger.error('Failed to get TIA templates', error as Error)
      return []
    }
  }

  /**
   * Generate automated TIA based on transfer details
   */
  async generateAutomatedTIA(
    tenantId: string,
    transferDetails: {
      destinationCountries: string[]
      dataCategories: string[]
      transferVolume: 'low' | 'medium' | 'high'
      purpose: string
    },
    generatedBy: string
  ): Promise<TransferImpactAssessment> {
    try {
      // Get adequacy information for destination countries
      const adequacyResults = await Promise.all(
        transferDetails.destinationCountries.map(country =>
          adequacyDecisionsService.validateAdequacy(country)
        )
      )

      // Calculate average risk from adequacy results
      const avgAdequacyRisk = adequacyResults.reduce((sum, result) =>
        sum + (result.isAdequate ? 1 : 3), 0) / adequacyResults.length

      // Determine data sensitivity based on categories
      const sensitiveCategories = ['health_data', 'financial_data', 'biometric_data', 'genetic_data']
      const hasSensitiveData = transferDetails.dataCategories.some(cat =>
        sensitiveCategories.includes(cat)
      )

      // Generate risk assessment
      const riskAssessment: RiskAssessmentData = {
        dataSensitivity: hasSensitiveData ? 'high' : 'medium',
        transferVolume: transferDetails.transferVolume,
        recipientCountryRisk: avgAdequacyRisk > 2 ? 'high' : 'medium',
        lackOfSupplementaryMeasures: avgAdequacyRisk > 2,
        dataSubjectRights: avgAdequacyRisk > 2 ? 'limited' : 'adequate',
        enforcementMechanisms: avgAdequacyRisk > 2 ? 'weak' : 'moderate',
        governmentAccess: avgAdequacyRisk > 2 ? 'high' : 'medium',
        additionalFactors: {
          automatedGeneration: true,
          adequacyResults: adequacyResults.map(r => ({
            country: r.status,
            isAdequate: r.isAdequate
          }))
        }
      }

      // Get default template
      const templates = await this.getTIATemplates()
      const defaultTemplate = templates.find(t => t.templateName === 'Standard Transfer Impact Assessment') || templates[0]

      if (!defaultTemplate) {
        throw new Error('No TIA template available')
      }

      // Create the assessment
      const assessmentData = {
        templateId: defaultTemplate.id,
        assessmentName: `Automated TIA - ${transferDetails.destinationCountries.join(', ')}`,
        transferDescription: transferDetails.purpose,
        destinationCountries: transferDetails.destinationCountries,
        dataCategories: transferDetails.dataCategories,
        riskAssessment,
        mitigatingMeasures: this.generateMitigatingMeasures(riskAssessment),
        supplementaryMeasures: this.generateSupplementaryMeasures(riskAssessment),
        status: 'draft' as const,
        createdBy: generatedBy
      }

      return await this.createTIA(tenantId, assessmentData, generatedBy)
    } catch (error) {
      logger.error('Failed to generate automated TIA', error as Error, {
        tenantId,
        transferDetails,
        generatedBy
      })
      throw error
    }
  }

  /**
   * Get TIA statistics for compliance reporting
   */
  async getTIAStats(tenantId: string): Promise<{
    totalAssessments: number
    byStatus: Record<string, number>
    byRiskLevel: Record<string, number>
    averageRiskScore: number
    pendingReviews: number
    approvedThisMonth: number
  }> {
    try {
      const assessments = await this.getTIAsForTenant(tenantId)
      const currentMonth = new Date().toISOString().slice(0, 7)

      const stats = {
        totalAssessments: assessments.length,
        byStatus: {} as Record<string, number>,
        byRiskLevel: {} as Record<string, number>,
        averageRiskScore: 0,
        pendingReviews: 0,
        approvedThisMonth: 0
      }

      let totalRiskScore = 0

      for (const assessment of assessments) {
        // Count by status
        stats.byStatus[assessment.status] = (stats.byStatus[assessment.status] || 0) + 1

        // Count by risk level
        stats.byRiskLevel[assessment.riskLevel] = (stats.byRiskLevel[assessment.riskLevel] || 0) + 1

        // Sum risk scores
        totalRiskScore += assessment.overallRiskScore

        // Count pending reviews
        if (assessment.status === 'pending_review') {
          stats.pendingReviews++
        }

        // Count approved this month
        if (assessment.status === 'approved' && assessment.updatedAt.toISOString().startsWith(currentMonth)) {
          stats.approvedThisMonth++
        }
      }

      stats.averageRiskScore = assessments.length > 0 ? totalRiskScore / assessments.length : 0

      return stats
    } catch (error) {
      logger.error('Failed to get TIA statistics', error as Error, { tenantId })
      return {
        totalAssessments: 0,
        byStatus: {},
        byRiskLevel: {},
        averageRiskScore: 0,
        pendingReviews: 0,
        approvedThisMonth: 0
      }
    }
  }

  /**
   * Private helper methods
   */
  private calculateRiskScore(riskAssessment: RiskAssessmentData): number {
    let score = 0

    score += this.riskWeights.dataSensitivity[riskAssessment.dataSensitivity]
    score += this.riskWeights.transferVolume[riskAssessment.transferVolume]
    score += this.riskWeights.recipientCountryRisk[riskAssessment.recipientCountryRisk]
    score += this.riskWeights.lackOfSupplementaryMeasures[riskAssessment.lackOfSupplementaryMeasures ? 'true' : 'false']
    score += this.riskWeights.dataSubjectRights[riskAssessment.dataSubjectRights]
    score += this.riskWeights.enforcementMechanisms[riskAssessment.enforcementMechanisms]
    score += this.riskWeights.governmentAccess[riskAssessment.governmentAccess]

    return Math.min(5, Math.max(1, Math.round(score)))
  }

  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score <= 2) return 'low'
    if (score <= 3) return 'medium'
    if (score <= 4) return 'high'
    return 'critical'
  }

  private generateMitigatingMeasures(riskAssessment: RiskAssessmentData): string[] {
    const measures: string[] = []

    if (riskAssessment.dataSensitivity === 'high' || riskAssessment.dataSensitivity === 'critical') {
      measures.push('Implement data encryption at rest and in transit')
      measures.push('Apply data minimization principles')
      measures.push('Regular security audits and penetration testing')
    }

    if (riskAssessment.recipientCountryRisk === 'high' || riskAssessment.recipientCountryRisk === 'critical') {
      measures.push('Enhanced due diligence on data recipients')
      measures.push('Contractual obligations for data protection')
      measures.push('Incident response and breach notification procedures')
    }

    if (riskAssessment.lackOfSupplementaryMeasures) {
      measures.push('Implement additional technical safeguards')
      measures.push('Regular compliance monitoring and reporting')
      measures.push('Data protection officer oversight')
    }

    return measures
  }

  private generateSupplementaryMeasures(riskAssessment: RiskAssessmentData): string[] {
    const measures: string[] = []

    if (riskAssessment.dataSubjectRights === 'limited' || riskAssessment.dataSubjectRights === 'inadequate') {
      measures.push('Establish alternative dispute resolution mechanisms')
      measures.push('Provide additional transparency notices to data subjects')
      measures.push('Implement data subject access request procedures')
    }

    if (riskAssessment.enforcementMechanisms === 'weak') {
      measures.push('Contractual enforcement of GDPR obligations')
      measures.push('Third-party beneficiary rights for data subjects')
      measures.push('Independent dispute resolution mechanisms')
    }

    if (riskAssessment.governmentAccess === 'high') {
      measures.push('Data anonymization and pseudonymization techniques')
      measures.push('Split processing arrangements')
      measures.push('Local legal review and impact assessments')
    }

    return measures
  }
}

// Export singleton instance
export const transferImpactAssessmentService = new TransferImpactAssessmentService()