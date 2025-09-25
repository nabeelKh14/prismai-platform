import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

export interface BAAVendor {
  id: string
  userId: string
  vendorName: string
  vendorType: 'cloud_service' | 'software_vendor' | 'consultant' | 'data_processor' | 'other'
  primaryContactName?: string
  primaryContactEmail?: string
  primaryContactPhone?: string
  complianceContactName?: string
  complianceContactEmail?: string
  complianceContactPhone?: string
  businessAddress?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  taxId?: string
  dunsNumber?: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  lastAssessmentDate?: Date
  nextAssessmentDate?: Date
  assessmentFrequencyMonths: number
  status: 'active' | 'inactive' | 'under_review' | 'suspended'
  notes?: string
  tags: string[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface VendorComplianceAssessment {
  id: string
  vendorId: string
  userId: string
  assessmentType: 'initial' | 'annual' | 'incident_response' | 'renewal'
  assessmentDate: Date
  assessorName?: string
  assessorContact?: string
  overallComplianceScore?: number
  securityScore?: number
  privacyScore?: number
  operationalScore?: number
  assessmentAreas: Record<string, {
    score: number
    findings: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical'
      title: string
      description: string
      recommendation?: string
    }>
    recommendations: string[]
  }>
  findings: Array<{
    area: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    title: string
    description: string
    recommendation?: string
    remediationStatus?: 'open' | 'in_progress' | 'resolved' | 'accepted_risk'
  }>
  recommendations: Array<{
    area: string
    priority: 'low' | 'medium' | 'high' | 'critical'
    title: string
    description: string
    estimatedEffort: string
    dueDate?: Date
  }>
  remediationPlan?: {
    items: Array<{
      findingId: string
      action: string
      owner: string
      dueDate: Date
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    }>
    overallDueDate?: Date
  }
  status: 'draft' | 'in_review' | 'approved' | 'requires_action' | 'rejected'
  dueDate?: Date
  completedDate?: Date
  assessmentDocumentUrl?: string
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface ComplianceIncident {
  id: string
  agreementId: string
  vendorId: string
  userId: string
  incidentType: 'breach' | 'non_compliance' | 'audit_finding' | 'contract_violation' | 'security_incident'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'investigating' | 'remediation' | 'resolved' | 'closed'
  title: string
  description: string
  impactAssessment?: string
  affectedPhiTypes: string[]
  affectedIndividualsCount?: number
  discoveredDate: Date
  reportedDate?: Date
  resolvedDate?: Date
  resolutionSummary?: string
  preventiveMeasures?: string
  lessonsLearned?: string
  hipaaBreachNotificationRequired: boolean
  notificationDeadline?: Date
  notificationSentDate?: Date
  tags: string[]
  notes?: string
  attachments: Array<{
    name: string
    url: string
    type: string
    uploadedAt: Date
  }>
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export class VendorComplianceService {
  private supabase = createClient()

  /**
   * Create a new vendor profile
   * HIPAA Compliance: Establishes vendor baseline for compliance tracking
   */
  async createVendor(
    userId: string,
    vendorData: Omit<BAAVendor, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<BAAVendor> {
    try {
      const supabase = await this.supabase

      const { data: vendor, error } = await supabase
        .from('baa_vendors')
        .insert({
          user_id: userId,
          vendor_name: vendorData.vendorName,
          vendor_type: vendorData.vendorType,
          primary_contact_name: vendorData.primaryContactName,
          primary_contact_email: vendorData.primaryContactEmail,
          primary_contact_phone: vendorData.primaryContactPhone,
          compliance_contact_name: vendorData.complianceContactName,
          compliance_contact_email: vendorData.complianceContactEmail,
          compliance_contact_phone: vendorData.complianceContactPhone,
          business_address: vendorData.businessAddress,
          tax_id: vendorData.taxId,
          duns_number: vendorData.dunsNumber,
          risk_level: vendorData.riskLevel,
          last_assessment_date: vendorData.lastAssessmentDate?.toISOString().split('T')[0],
          next_assessment_date: vendorData.nextAssessmentDate?.toISOString().split('T')[0],
          assessment_frequency_months: vendorData.assessmentFrequencyMonths,
          status: vendorData.status,
          notes: vendorData.notes,
          tags: vendorData.tags,
          created_by: userId
        })
        .select()
        .single()

      if (error) throw error

      // Log audit trail
      await this.logAuditEvent(userId, 'vendor_created', 'vendor', vendor.id, {
        vendorName: vendorData.vendorName,
        vendorType: vendorData.vendorType,
        riskLevel: vendorData.riskLevel
      })

      SecurityAudit.logSensitiveAction('baa_vendor_created', userId, {
        vendorId: vendor.id,
        vendorName: vendorData.vendorName,
        riskLevel: vendorData.riskLevel
      })

      return this.mapVendorFromDB(vendor)
    } catch (error) {
      logger.error('Failed to create vendor', error as Error, {
        userId,
        vendorName: vendorData.vendorName
      })
      throw error
    }
  }

  /**
   * Create a comprehensive compliance assessment
   * HIPAA Compliance: Thorough evaluation of vendor compliance posture
   */
  async createComplianceAssessment(
    userId: string,
    assessmentData: Omit<VendorComplianceAssessment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VendorComplianceAssessment> {
    try {
      const supabase = await this.supabase

      // Calculate overall scores
      const overallScore = this.calculateOverallScore(assessmentData.assessmentAreas)
      const securityScore = assessmentData.assessmentAreas.security?.score
      const privacyScore = assessmentData.assessmentAreas.privacy?.score
      const operationalScore = assessmentData.assessmentAreas.operations?.score

      const { data: assessment, error } = await supabase
        .from('vendor_compliance_assessments')
        .insert({
          vendor_id: assessmentData.vendorId,
          user_id: userId,
          assessment_type: assessmentData.assessmentType,
          assessment_date: assessmentData.assessmentDate.toISOString().split('T')[0],
          assessor_name: assessmentData.assessorName,
          assessor_contact: assessmentData.assessorContact,
          overall_compliance_score: overallScore,
          security_score: securityScore,
          privacy_score: privacyScore,
          operational_score: operationalScore,
          assessment_areas: assessmentData.assessmentAreas,
          findings: assessmentData.findings,
          recommendations: assessmentData.recommendations,
          remediation_plan: assessmentData.remediationPlan,
          status: assessmentData.status,
          due_date: assessmentData.dueDate?.toISOString().split('T')[0],
          completed_date: assessmentData.completedDate?.toISOString().split('T')[0],
          assessment_document_url: assessmentData.assessmentDocumentUrl,
          notes: assessmentData.notes,
          created_by: userId
        })
        .select()
        .single()

      if (error) throw error

      // Update vendor's last assessment date and risk level
      await this.updateVendorAfterAssessment(assessmentData.vendorId, assessmentData.assessmentDate, overallScore)

      // Log audit trail
      await this.logAuditEvent(userId, 'vendor_assessed', 'assessment', assessment.id, {
        vendorId: assessmentData.vendorId,
        assessmentType: assessmentData.assessmentType,
        overallScore
      })

      SecurityAudit.logSensitiveAction('vendor_compliance_assessment_created', userId, {
        assessmentId: assessment.id,
        vendorId: assessmentData.vendorId,
        assessmentType: assessmentData.assessmentType,
        overallScore
      })

      return this.mapAssessmentFromDB(assessment)
    } catch (error) {
      logger.error('Failed to create compliance assessment', error as Error, {
        userId,
        vendorId: assessmentData.vendorId
      })
      throw error
    }
  }

  /**
   * Report a compliance incident
   * HIPAA Compliance: Proper incident tracking and reporting
   */
  async reportComplianceIncident(
    userId: string,
    incidentData: Omit<ComplianceIncident, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ComplianceIncident> {
    try {
      const supabase = await this.supabase

      const { data: incident, error } = await supabase
        .from('baa_compliance_incidents')
        .insert({
          agreement_id: incidentData.agreementId,
          vendor_id: incidentData.vendorId,
          user_id: userId,
          incident_type: incidentData.incidentType,
          severity: incidentData.severity,
          status: incidentData.status,
          title: incidentData.title,
          description: incidentData.description,
          impact_assessment: incidentData.impactAssessment,
          affected_phi_types: incidentData.affectedPhiTypes,
          affected_individuals_count: incidentData.affectedIndividualsCount,
          discovered_date: incidentData.discoveredDate.toISOString().split('T')[0],
          reported_date: incidentData.reportedDate?.toISOString().split('T')[0],
          resolved_date: incidentData.resolvedDate?.toISOString().split('T')[0],
          resolution_summary: incidentData.resolutionSummary,
          preventive_measures: incidentData.preventiveMeasures,
          lessons_learned: incidentData.lessonsLearned,
          hipaa_breach_notification_required: incidentData.hipaaBreachNotificationRequired,
          notification_deadline: incidentData.notificationDeadline?.toISOString().split('T')[0],
          notification_sent_date: incidentData.notificationSentDate?.toISOString().split('T')[0],
          tags: incidentData.tags,
          notes: incidentData.notes,
          attachments: incidentData.attachments,
          created_by: userId
        })
        .select()
        .single()

      if (error) throw error

      // Update vendor risk level if incident is severe
      if (incidentData.severity === 'high' || incidentData.severity === 'critical') {
        await this.updateVendorRiskLevel(incidentData.vendorId, 'high')
      }

      // Log audit trail
      await this.logAuditEvent(userId, 'compliance_incident_created', 'incident', incident.id, {
        vendorId: incidentData.vendorId,
        incidentType: incidentData.incidentType,
        severity: incidentData.severity,
        hipaaBreachNotificationRequired: incidentData.hipaaBreachNotificationRequired
      })

      SecurityAudit.logSensitiveAction('compliance_incident_reported', userId, {
        incidentId: incident.id,
        vendorId: incidentData.vendorId,
        incidentType: incidentData.incidentType,
        severity: incidentData.severity
      })

      return this.mapIncidentFromDB(incident)
    } catch (error) {
      logger.error('Failed to report compliance incident', error as Error, {
        userId,
        vendorId: incidentData.vendorId,
        incidentType: incidentData.incidentType
      })
      throw error
    }
  }

  /**
   * Get vendors requiring assessment
   * HIPAA Compliance: Proactive compliance monitoring
   */
  async getVendorsRequiringAssessment(
    userId: string,
    daysAhead: number = 30
  ): Promise<Array<BAAVendor & { daysOverdue: number }>> {
    try {
      const supabase = await this.supabase

      const { data: vendors, error } = await supabase
        .from('baa_vendors')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .lt('next_assessment_date', new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

      if (error) throw error

      const now = new Date()
      return vendors.map(vendor => ({
        ...this.mapVendorFromDB(vendor),
        daysOverdue: Math.floor((now.getTime() - new Date(vendor.next_assessment_date).getTime()) / (1000 * 60 * 60 * 24))
      }))
    } catch (error) {
      logger.error('Failed to get vendors requiring assessment', error as Error, {
        userId,
        daysAhead
      })
      throw error
    }
  }

  /**
   * Get vendor compliance score
   * HIPAA Compliance: Quantitative compliance measurement
   */
  async getVendorComplianceScore(vendorId: string): Promise<{
    vendor: BAAVendor
    currentScore: number
    lastAssessment: VendorComplianceAssessment | null
    incidents: ComplianceIncident[]
    riskLevel: string
    recommendations: string[]
  }> {
    try {
      const supabase = await this.supabase

      // Get vendor
      const { data: vendor, error: vendorError } = await supabase
        .from('baa_vendors')
        .select('*')
        .eq('id', vendorId)
        .single()

      if (vendorError) throw vendorError

      // Get latest assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from('vendor_compliance_assessments')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (assessmentError) throw assessmentError

      // Get recent incidents
      const { data: incidents, error: incidentsError } = await supabase
        .from('baa_compliance_incidents')
        .select('*')
        .eq('vendor_id', vendorId)
        .in('status', ['open', 'investigating', 'remediation'])
        .order('created_at', { ascending: false })

      if (incidentsError) throw incidentsError

      // Calculate current score
      const currentScore = assessment?.overall_compliance_score || 0
      const mappedAssessment = assessment ? this.mapAssessmentFromDB(assessment) : null
      const mappedIncidents = incidents.map(i => this.mapIncidentFromDB(i))

      // Generate recommendations
      const recommendations = this.generateComplianceRecommendations(
        mappedAssessment,
        mappedIncidents,
        vendor.risk_level
      )

      return {
        vendor: this.mapVendorFromDB(vendor),
        currentScore,
        lastAssessment: mappedAssessment,
        incidents: mappedIncidents,
        riskLevel: vendor.risk_level,
        recommendations
      }
    } catch (error) {
      logger.error('Failed to get vendor compliance score', error as Error, {
        vendorId
      })
      throw error
    }
  }

  /**
   * Get compliance dashboard data
   * HIPAA Compliance: Executive-level compliance visibility
   */
  async getComplianceDashboard(userId: string): Promise<{
    vendorCount: number
    averageComplianceScore: number
    highRiskVendors: number
    pendingAssessments: number
    openIncidents: number
    recentActivity: Array<{
      type: string
      description: string
      date: Date
      severity?: string
    }>
  }> {
    try {
      const supabase = await this.supabase

      // Get vendor statistics
      const { data: vendors, error: vendorError } = await supabase
        .from('baa_vendors')
        .select('risk_level')
        .eq('user_id', userId)
        .eq('status', 'active')

      if (vendorError) throw vendorError

      // Get assessment statistics
      const { data: assessments, error: assessmentError } = await supabase
        .from('vendor_compliance_assessments')
        .select('overall_compliance_score, status, created_at')
        .eq('user_id', userId)
        .in('status', ['approved', 'requires_action'])

      if (assessmentError) throw assessmentError

      // Get incident statistics
      const { data: incidents, error: incidentError } = await supabase
        .from('baa_compliance_incidents')
        .select('status, severity, title, created_at')
        .eq('user_id', userId)
        .in('status', ['open', 'investigating', 'remediation'])

      if (incidentError) throw incidentError

      // Calculate metrics
      const vendorCount = vendors.length
      const highRiskVendors = vendors.filter(v => v.risk_level === 'high' || v.risk_level === 'critical').length
      const averageComplianceScore = assessments.length > 0
        ? assessments.reduce((sum, a) => sum + (a.overall_compliance_score || 0), 0) / assessments.length
        : 0
      const pendingAssessments = assessments.filter(a => a.status === 'requires_action').length
      const openIncidents = incidents.length

      // Get recent activity (simplified)
      const recentActivity = [
        ...assessments.slice(0, 3).map(a => ({
          type: 'assessment',
          description: `Compliance assessment completed`,
          date: new Date(a.created_at || ''),
          severity: a.overall_compliance_score && a.overall_compliance_score < 70 ? 'high' : 'low'
        })),
        ...incidents.slice(0, 2).map(i => ({
          type: 'incident',
          description: `Compliance incident reported: ${i.title}`,
          date: new Date(i.created_at || ''),
          severity: i.severity
        }))
      ].sort((a, b) => b.date.getTime() - a.date.getTime())

      return {
        vendorCount,
        averageComplianceScore: Math.round(averageComplianceScore * 100) / 100,
        highRiskVendors,
        pendingAssessments,
        openIncidents,
        recentActivity
      }
    } catch (error) {
      logger.error('Failed to get compliance dashboard', error as Error, { userId })
      throw error
    }
  }

  // Private helper methods

  private calculateOverallScore(assessmentAreas: Record<string, any>): number {
    const areas = Object.values(assessmentAreas)
    if (areas.length === 0) return 0

    const totalScore = areas.reduce((sum: number, area: any) => sum + (area.score || 0), 0)
    return Math.round((totalScore / areas.length) * 100) / 100
  }

  private async updateVendorAfterAssessment(vendorId: string, assessmentDate: Date, score: number): Promise<void> {
    try {
      const supabase = await this.supabase

      // Determine new risk level based on score
      let riskLevel: BAAVendor['riskLevel'] = 'low'
      if (score < 50) riskLevel = 'critical'
      else if (score < 70) riskLevel = 'high'
      else if (score < 85) riskLevel = 'medium'

      // Calculate next assessment date (12 months from now)
      const nextAssessmentDate = new Date(assessmentDate)
      nextAssessmentDate.setMonth(nextAssessmentDate.getMonth() + 12)

      await supabase
        .from('baa_vendors')
        .update({
          last_assessment_date: assessmentDate.toISOString().split('T')[0],
          next_assessment_date: nextAssessmentDate.toISOString().split('T')[0],
          risk_level: riskLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendorId)
    } catch (error) {
      logger.error('Failed to update vendor after assessment', error as Error, {
        vendorId,
        assessmentDate,
        score
      })
    }
  }

  private async updateVendorRiskLevel(vendorId: string, riskLevel: BAAVendor['riskLevel']): Promise<void> {
    try {
      const supabase = await this.supabase

      await supabase
        .from('baa_vendors')
        .update({
          risk_level: riskLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendorId)
    } catch (error) {
      logger.error('Failed to update vendor risk level', error as Error, {
        vendorId,
        riskLevel
      })
    }
  }

  private generateComplianceRecommendations(
    assessment: VendorComplianceAssessment | null,
    incidents: ComplianceIncident[],
    riskLevel: string
  ): string[] {
    const recommendations: string[] = []

    if (assessment && assessment.overallComplianceScore && assessment.overallComplianceScore < 80) {
      recommendations.push('Schedule immediate compliance assessment review')
    }

    if (incidents.length > 0) {
      recommendations.push('Address open compliance incidents as priority')
    }

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Implement enhanced monitoring for high-risk vendor')
      recommendations.push('Consider alternative vendors for critical functions')
    }

    if (assessment?.recommendations && assessment.recommendations.length > 0) {
      recommendations.push(...assessment.recommendations.slice(0, 3).map(r => r.title))
    }

    return recommendations
  }

  private async logAuditEvent(
    userId: string,
    activityType: string,
    entityType: string,
    entityId: string,
    metadata: any
  ): Promise<void> {
    try {
      const supabase = await this.supabase

      await supabase
        .from('baa_audit_logs')
        .insert({
          user_id: userId,
          activity_type: activityType,
          entity_type: entityType,
          entity_id: entityId,
          description: `${activityType} performed on ${entityType}`,
          metadata: metadata,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      logger.error('Failed to log audit event', error as Error, {
        userId,
        activityType,
        entityType,
        entityId
      })
    }
  }

  private mapVendorFromDB(data: any): BAAVendor {
    return {
      id: data.id,
      userId: data.user_id,
      vendorName: data.vendor_name,
      vendorType: data.vendor_type,
      primaryContactName: data.primary_contact_name,
      primaryContactEmail: data.primary_contact_email,
      primaryContactPhone: data.primary_contact_phone,
      complianceContactName: data.compliance_contact_name,
      complianceContactEmail: data.compliance_contact_email,
      complianceContactPhone: data.compliance_contact_phone,
      businessAddress: data.business_address,
      taxId: data.tax_id,
      dunsNumber: data.duns_number,
      riskLevel: data.risk_level,
      lastAssessmentDate: data.last_assessment_date ? new Date(data.last_assessment_date) : undefined,
      nextAssessmentDate: data.next_assessment_date ? new Date(data.next_assessment_date) : undefined,
      assessmentFrequencyMonths: data.assessment_frequency_months,
      status: data.status,
      notes: data.notes,
      tags: data.tags || [],
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  private mapAssessmentFromDB(data: any): VendorComplianceAssessment {
    return {
      id: data.id,
      vendorId: data.vendor_id,
      userId: data.user_id,
      assessmentType: data.assessment_type,
      assessmentDate: new Date(data.assessment_date),
      assessorName: data.assessor_name,
      assessorContact: data.assessor_contact,
      overallComplianceScore: data.overall_compliance_score,
      securityScore: data.security_score,
      privacyScore: data.privacy_score,
      operationalScore: data.operational_score,
      assessmentAreas: data.assessment_areas,
      findings: data.findings || [],
      recommendations: data.recommendations || [],
      remediationPlan: data.remediation_plan,
      status: data.status,
      dueDate: data.due_date ? new Date(data.due_date) : undefined,
      completedDate: data.completed_date ? new Date(data.completed_date) : undefined,
      assessmentDocumentUrl: data.assessment_document_url,
      notes: data.notes,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  private mapIncidentFromDB(data: any): ComplianceIncident {
    return {
      id: data.id,
      agreementId: data.agreement_id,
      vendorId: data.vendor_id,
      userId: data.user_id,
      incidentType: data.incident_type,
      severity: data.severity,
      status: data.status,
      title: data.title,
      description: data.description,
      impactAssessment: data.impact_assessment,
      affectedPhiTypes: data.affected_phi_types || [],
      affectedIndividualsCount: data.affected_individuals_count,
      discoveredDate: new Date(data.discovered_date),
      reportedDate: data.reported_date ? new Date(data.reported_date) : undefined,
      resolvedDate: data.resolved_date ? new Date(data.resolved_date) : undefined,
      resolutionSummary: data.resolution_summary,
      preventiveMeasures: data.preventive_measures,
      lessonsLearned: data.lessons_learned,
      hipaaBreachNotificationRequired: data.hipaa_breach_notification_required,
      notificationDeadline: data.notification_deadline ? new Date(data.notification_deadline) : undefined,
      notificationSentDate: data.notification_sent_date ? new Date(data.notification_sent_date) : undefined,
      tags: data.tags || [],
      notes: data.notes,
      attachments: data.attachments || [],
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
}

// Export singleton instance
export const vendorComplianceService = new VendorComplianceService()