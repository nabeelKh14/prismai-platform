/**
 * Breach Risk Assessment System
 * Implements automated and manual assessment of breach severity and impact
 * Supports GDPR, HIPAA, and SOC2 compliance requirements with specific scoring methodologies
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Types for breach assessment
export interface BreachIncident {
  id: string;
  incident_id: string;
  title: string;
  description: string;
  incident_type: string;
  severity_score: number;
  status: string;
  affected_systems: string[];
  affected_data_types: string[];
  estimated_records_affected?: number;
  gdpr_applicable: boolean;
  hipaa_applicable: boolean;
  soc2_applicable: boolean;
  detected_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface RiskAssessment {
  id: string;
  breach_incident_id: string;
  assessment_type: 'initial' | 'detailed' | 'final';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  impact_score: number; // 1-10 scale
  likelihood_score: number; // 1-10 scale
  overall_risk_score: number; // impact * likelihood
  affected_individuals_count?: number;
  data_sensitivity_level: 'public' | 'internal' | 'confidential' | 'restricted' | 'phi' | 'pii' | 'financial';
  business_impact: string;
  regulatory_impact: string;
  mitigation_measures: string[];
  assessment_notes: string;
  assessed_by: string;
  assessed_at: Date;
  created_at: Date;
}

export interface AssessmentCriteria {
  category: string;
  weight: number;
  factors: AssessmentFactor[];
}

export interface AssessmentFactor {
  name: string;
  description: string;
  score_range: [number, number];
  weight: number;
  questions: string[];
  scoring_guidance: string;
}

// Assessment scoring schemas
const GDPRImpactSchema = z.object({
  data_subject_rights: z.number().min(1).max(10),
  data_minimization: z.number().min(1).max(10),
  purpose_limitation: z.number().min(1).max(10),
  storage_limitation: z.number().min(1).max(10),
  integrity_confidentiality: z.number().min(1).max(10),
  accountability: z.number().min(1).max(10)
});

const HIPAAImpactSchema = z.object({
  phi_involved: z.boolean(),
  unsecured_phi: z.boolean(),
  number_affected: z.number().min(0),
  breach_type: z.enum(['theft', 'loss', 'unauthorized_access', 'hacking', 'improper_disposal', 'unknown']),
  harm_potential: z.number().min(1).max(10),
  mitigation_delay: z.number().min(0) // days
});

const SOC2ImpactSchema = z.object({
  security_principle: z.number().min(1).max(10),
  availability_principle: z.number().min(1).max(10),
  confidentiality_principle: z.number().min(1).max(10),
  processing_integrity: z.number().min(1).max(10),
  privacy_principle: z.number().min(1).max(10),
  business_impact: z.number().min(1).max(10)
});

// Main breach assessment engine
export class BreachAssessmentEngine {
  private supabase: any;
  private assessmentCriteria: Map<string, AssessmentCriteria> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeAssessmentCriteria();
  }

  /**
   * Initialize assessment criteria from database
   */
  private async initializeAssessmentCriteria(): Promise<void> {
    // Load predefined assessment criteria
    const criteria = this.getDefaultAssessmentCriteria();
    for (const criterion of criteria) {
      this.assessmentCriteria.set(criterion.category, criterion);
    }
  }

  /**
   * Perform automated initial assessment of a breach incident
   */
  async performInitialAssessment(incident: BreachIncident): Promise<RiskAssessment> {
    console.log(`Performing initial assessment for incident ${incident.incident_id}`);

    // Calculate automated scores
    const impactScore = await this.calculateAutomatedImpactScore(incident);
    const likelihoodScore = await this.calculateAutomatedLikelihoodScore(incident);
    const overallRiskScore = impactScore * likelihoodScore;

    // Determine risk level
    const riskLevel = this.determineRiskLevel(overallRiskScore);

    // Determine data sensitivity level
    const dataSensitivityLevel = this.determineDataSensitivityLevel(incident);

    // Generate assessment
    const assessment: Omit<RiskAssessment, 'id'> = {
      breach_incident_id: incident.id,
      assessment_type: 'initial',
      risk_level: riskLevel,
      impact_score: impactScore,
      likelihood_score: likelihoodScore,
      overall_risk_score: overallRiskScore,
      affected_individuals_count: incident.estimated_records_affected,
      data_sensitivity_level: dataSensitivityLevel,
      business_impact: this.generateBusinessImpactAnalysis(incident, impactScore),
      regulatory_impact: this.generateRegulatoryImpactAnalysis(incident, riskLevel),
      mitigation_measures: this.generateInitialMitigationMeasures(incident),
      assessment_notes: `Automated initial assessment completed. Overall risk score: ${overallRiskScore}/100. ${this.getRiskLevelDescription(riskLevel)}`,
      assessed_by: 'automated-assessment-engine',
      assessed_at: new Date(),
      created_at: new Date()
    };

    // Store assessment in database
    const { data, error } = await this.supabase
      .from('breach_risk_assessments')
      .insert([assessment])
      .select()
      .single();

    if (error) {
      console.error('Failed to create risk assessment:', error);
      throw error;
    }

    // Log the assessment
    await this.logAssessmentEvent(assessment as RiskAssessment);

    return { ...assessment, id: data.id };
  }

  /**
   * Perform detailed manual assessment with user input
   */
  async performDetailedAssessment(
    incident: BreachIncident,
    assessmentData: {
      gdprImpact?: z.infer<typeof GDPRImpactSchema>;
      hipaaImpact?: z.infer<typeof HIPAAImpactSchema>;
      soc2Impact?: z.infer<typeof SOC2ImpactSchema>;
      customFactors?: Record<string, number>;
      notes?: string;
      assessedBy: string;
    }
  ): Promise<RiskAssessment> {
    console.log(`Performing detailed assessment for incident ${incident.incident_id}`);

    // Calculate detailed scores based on regulatory requirements
    const impactScore = await this.calculateDetailedImpactScore(incident, assessmentData);
    const likelihoodScore = await this.calculateDetailedLikelihoodScore(incident, assessmentData);
    const overallRiskScore = impactScore * likelihoodScore;

    // Determine risk level
    const riskLevel = this.determineRiskLevel(overallRiskScore);

    // Generate detailed assessment
    const assessment: Omit<RiskAssessment, 'id'> = {
      breach_incident_id: incident.id,
      assessment_type: 'detailed',
      risk_level: riskLevel,
      impact_score: impactScore,
      likelihood_score: likelihoodScore,
      overall_risk_score: overallRiskScore,
      affected_individuals_count: incident.estimated_records_affected,
      data_sensitivity_level: this.determineDataSensitivityLevel(incident),
      business_impact: this.generateDetailedBusinessImpactAnalysis(incident, assessmentData),
      regulatory_impact: this.generateDetailedRegulatoryImpactAnalysis(incident, assessmentData),
      mitigation_measures: this.generateDetailedMitigationMeasures(incident, assessmentData),
      assessment_notes: assessmentData.notes || `Detailed assessment completed by ${assessmentData.assessedBy}. Overall risk score: ${overallRiskScore}/100.`,
      assessed_by: assessmentData.assessedBy,
      assessed_at: new Date(),
      created_at: new Date()
    };

    // Store assessment in database
    const { data, error } = await this.supabase
      .from('breach_risk_assessments')
      .insert([assessment])
      .select()
      .single();

    if (error) {
      console.error('Failed to create detailed risk assessment:', error);
      throw error;
    }

    // Log the assessment
    await this.logAssessmentEvent(assessment as RiskAssessment);

    return { ...assessment, id: data.id };
  }

  /**
   * Calculate automated impact score (1-10 scale)
   */
  private async calculateAutomatedImpactScore(incident: BreachIncident): Promise<number> {
    let score = 5; // Base score

    // Factor in incident type severity
    const typeSeverity = this.getIncidentTypeSeverity(incident.incident_type);
    score += typeSeverity;

    // Factor in affected data types
    const dataSensitivityScore = this.getDataSensitivityScore(incident.affected_data_types);
    score += dataSensitivityScore;

    // Factor in number of affected records
    if (incident.estimated_records_affected) {
      const recordScore = Math.min(incident.estimated_records_affected / 1000, 3); // Max +3 for large datasets
      score += recordScore;
    }

    // Factor in affected systems criticality
    const systemCriticalityScore = this.getSystemCriticalityScore(incident.affected_systems);
    score += systemCriticalityScore;

    // Apply regulatory multipliers
    if (incident.gdpr_applicable) score *= 1.2;
    if (incident.hipaa_applicable) score *= 1.3;
    if (incident.soc2_applicable) score *= 1.1;

    return Math.min(Math.max(Math.round(score), 1), 10);
  }

  /**
   * Calculate automated likelihood score (1-10 scale)
   */
  private async calculateAutomatedLikelihoodScore(incident: BreachIncident): Promise<number> {
    let score = 5; // Base score

    // Factor in detection method (automated detection = higher likelihood of ongoing issues)
    if (incident.status === 'detected') {
      score += 2; // Fresh detection suggests higher likelihood of active threat
    }

    // Factor in incident type likelihood
    const typeLikelihood = this.getIncidentTypeLikelihood(incident.incident_type);
    score += typeLikelihood;

    // Factor in time since detection
    const hoursSinceDetection = (Date.now() - incident.detected_at.getTime()) / (1000 * 60 * 60);
    if (hoursSinceDetection < 24) {
      score += 1; // Very recent = higher likelihood of ongoing activity
    } else if (hoursSinceDetection > 168) { // 7 days
      score -= 1; // Older incidents = lower likelihood of ongoing activity
    }

    return Math.min(Math.max(Math.round(score), 1), 10);
  }

  /**
   * Calculate detailed impact score with regulatory-specific analysis
   */
  private async calculateDetailedImpactScore(
    incident: BreachIncident,
    assessmentData: any
  ): Promise<number> {
    let baseScore = await this.calculateAutomatedImpactScore(incident);

    // Apply GDPR-specific scoring if applicable
    if (incident.gdpr_applicable && assessmentData.gdprImpact) {
      const gdprData = GDPRImpactSchema.parse(assessmentData.gdprImpact);
      const gdprScore = Object.values(gdprData).reduce((sum, score) => sum + score, 0) / 6;
      baseScore = (baseScore + gdprScore) / 2;
    }

    // Apply HIPAA-specific scoring if applicable
    if (incident.hipaa_applicable && assessmentData.hipaaImpact) {
      const hipaaData = HIPAAImpactSchema.parse(assessmentData.hipaaImpact);
      let hipaaScore = 5;

      if (hipaaData.phi_involved) hipaaScore += 2;
      if (hipaaData.unsecured_phi) hipaaScore += 3;
      if (hipaaData.harm_potential >= 7) hipaaScore += 2;
      if (hipaaData.mitigation_delay > 30) hipaaScore += 1;

      baseScore = (baseScore + hipaaScore) / 2;
    }

    // Apply SOC2-specific scoring if applicable
    if (incident.soc2_applicable && assessmentData.soc2Impact) {
      const soc2Data = SOC2ImpactSchema.parse(assessmentData.soc2Impact);
      const soc2Score = Object.values(soc2Data).reduce((sum, score) => sum + score, 0) / 6;
      baseScore = (baseScore + soc2Score) / 2;
    }

    return Math.min(Math.max(Math.round(baseScore), 1), 10);
  }

  /**
   * Calculate detailed likelihood score with additional factors
   */
  private async calculateDetailedLikelihoodScore(
    incident: BreachIncident,
    assessmentData: any
  ): Promise<number> {
    let baseScore = await this.calculateAutomatedLikelihoodScore(incident);

    // Add custom factors if provided
    if (assessmentData.customFactors) {
      const customScore = Object.values(assessmentData.customFactors)
        .reduce((sum: number, score: any) => sum + score, 0) / Object.keys(assessmentData.customFactors).length;
      baseScore = (baseScore + customScore) / 2;
    }

    return Math.min(Math.max(Math.round(baseScore), 1), 10);
  }

  /**
   * Determine risk level based on overall risk score
   */
  private determineRiskLevel(overallRiskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (overallRiskScore >= 70) return 'critical';
    if (overallRiskScore >= 40) return 'high';
    if (overallRiskScore >= 20) return 'medium';
    return 'low';
  }

  /**
   * Determine data sensitivity level
   */
  private determineDataSensitivityLevel(incident: BreachIncident): RiskAssessment['data_sensitivity_level'] {
    if (incident.affected_data_types.includes('phi')) return 'phi';
    if (incident.affected_data_types.includes('pii')) return 'pii';
    if (incident.affected_data_types.includes('financial')) return 'financial';
    if (incident.affected_data_types.includes('restricted')) return 'restricted';
    if (incident.affected_data_types.includes('confidential')) return 'confidential';
    if (incident.affected_data_types.includes('internal')) return 'internal';
    return 'public';
  }

  /**
   * Generate business impact analysis
   */
  private generateBusinessImpactAnalysis(incident: BreachIncident, impactScore: number): string {
    const impacts = [];

    if (impactScore >= 7) {
      impacts.push('Potential significant financial loss');
      impacts.push('Reputational damage to organization');
      impacts.push('Loss of customer trust');
    } else if (impactScore >= 4) {
      impacts.push('Moderate operational disruption');
      impacts.push('Limited financial impact');
      impacts.push('Some customer concern');
    } else {
      impacts.push('Minimal business disruption');
      impacts.push('Low financial impact');
    }

    if (incident.estimated_records_affected && incident.estimated_records_affected > 1000) {
      impacts.push('Large-scale data exposure');
    }

    if (incident.affected_systems.includes('production') || incident.affected_systems.includes('customer_facing')) {
      impacts.push('Customer-facing systems affected');
    }

    return impacts.join('; ');
  }

  /**
   * Generate regulatory impact analysis
   */
  private generateRegulatoryImpactAnalysis(incident: BreachIncident, riskLevel: string): string {
    const impacts = [];

    if (incident.gdpr_applicable) {
      impacts.push('GDPR Article 33: 72-hour supervisory authority notification required');
      if (riskLevel === 'high' || riskLevel === 'critical') {
        impacts.push('GDPR Article 34: Individual notification likely required');
      }
    }

    if (incident.hipaa_applicable) {
      impacts.push('HIPAA Breach Notification Rule: Individual notification within 60 days');
      impacts.push('HHS OCR notification required for breaches affecting 500+ individuals');
    }

    if (incident.soc2_applicable) {
      impacts.push('SOC2 Common Criteria: Security incident response and reporting');
      impacts.push('Annual audit implications for incident handling');
    }

    return impacts.join('; ');
  }

  /**
   * Generate initial mitigation measures
   */
  private generateInitialMitigationMeasures(incident: BreachIncident): string[] {
    const measures = [
      'Isolate affected systems',
      'Change compromised credentials',
      'Monitor for lateral movement',
      'Preserve evidence for investigation'
    ];

    if (incident.incident_type === 'malware') {
      measures.push('Deploy antivirus signatures');
      measures.push('Scan for additional malware');
    }

    if (incident.incident_type === 'unauthorized_access') {
      measures.push('Review access logs');
      measures.push('Implement additional access controls');
    }

    if (incident.incident_type === 'data_breach') {
      measures.push('Notify affected data subjects if required');
      measures.push('Implement data monitoring');
    }

    return measures;
  }

  /**
   * Generate detailed business impact analysis
   */
  private generateDetailedBusinessImpactAnalysis(incident: BreachIncident, assessmentData: any): string {
    // Enhanced analysis based on detailed assessment data
    const baseAnalysis = this.generateBusinessImpactAnalysis(incident, 0);

    if (assessmentData.customFactors) {
      return `${baseAnalysis}. Additional factors considered: ${Object.keys(assessmentData.customFactors).join(', ')}.`;
    }

    return baseAnalysis;
  }

  /**
   * Generate detailed regulatory impact analysis
   */
  private generateDetailedRegulatoryImpactAnalysis(incident: BreachIncident, assessmentData: any): string {
    const baseAnalysis = this.generateRegulatoryImpactAnalysis(incident, 'medium');

    if (incident.hipaa_applicable && assessmentData.hipaaImpact) {
      const hipaaData = assessmentData.hipaaImpact;
      if (hipaaData.number_affected >= 500) {
        return `${baseAnalysis}. HIPAA: Large breach requiring media notification.`;
      }
    }

    return baseAnalysis;
  }

  /**
   * Generate detailed mitigation measures
   */
  private generateDetailedMitigationMeasures(incident: BreachIncident, assessmentData: any): string[] {
    const baseMeasures = this.generateInitialMitigationMeasures(incident);

    // Add regulatory-specific measures
    if (incident.gdpr_applicable) {
      baseMeasures.push('Prepare GDPR Article 33 notification');
      baseMeasures.push('Document breach timeline for supervisory authority');
    }

    if (incident.hipaa_applicable) {
      baseMeasures.push('Prepare HIPAA breach risk assessment');
      baseMeasures.push('Document decision rationale for notification');
    }

    if (incident.soc2_applicable) {
      baseMeasures.push('Update incident response documentation');
      baseMeasures.push('Review security controls effectiveness');
    }

    return baseMeasures;
  }

  /**
   * Helper methods for scoring calculations
   */
  private getIncidentTypeSeverity(incidentType: string): number {
    const severityMap: Record<string, number> = {
      'data_breach': 3,
      'unauthorized_access': 2,
      'malware': 2,
      'ddos': 1,
      'phishing': 1,
      'insider_threat': 3,
      'third_party': 2,
      'other': 1
    };
    return severityMap[incidentType] || 1;
  }

  private getDataSensitivityScore(dataTypes: string[]): number {
    let maxScore = 0;
    for (const dataType of dataTypes) {
      const score = this.getSingleDataTypeScore(dataType);
      maxScore = Math.max(maxScore, score);
    }
    return maxScore;
  }

  private getSingleDataTypeScore(dataType: string): number {
    const scoreMap: Record<string, number> = {
      'phi': 3,
      'pii': 2,
      'financial': 2,
      'restricted': 2,
      'confidential': 1,
      'internal': 1,
      'public': 0
    };
    return scoreMap[dataType.toLowerCase()] || 0;
  }

  private getSystemCriticalityScore(systems: string[]): number {
    let maxScore = 0;
    for (const system of systems) {
      const score = this.getSingleSystemScore(system);
      maxScore = Math.max(maxScore, score);
    }
    return maxScore;
  }

  private getSingleSystemScore(system: string): number {
    const scoreMap: Record<string, number> = {
      'production': 2,
      'customer_facing': 2,
      'payment': 3,
      'healthcare': 3,
      'database': 2,
      'backup': 1,
      'development': 0,
      'staging': 0
    };
    return scoreMap[system.toLowerCase()] || 1;
  }

  private getIncidentTypeLikelihood(incidentType: string): number {
    const likelihoodMap: Record<string, number> = {
      'malware': 2,
      'phishing': 1,
      'ddos': 1,
      'unauthorized_access': 2,
      'data_breach': 2,
      'insider_threat': 1,
      'third_party': 1,
      'other': 1
    };
    return likelihoodMap[incidentType] || 1;
  }

  private getRiskLevelDescription(riskLevel: string): string {
    const descriptions: Record<string, string> = {
      'critical': 'Requires immediate attention and notification to all stakeholders',
      'high': 'Requires prompt attention and likely regulatory notification',
      'medium': 'Requires monitoring and assessment for notification requirements',
      'low': 'Can be handled through normal incident response procedures'
    };
    return descriptions[riskLevel] || '';
  }

  private async logAssessmentEvent(assessment: RiskAssessment): Promise<void> {
    await this.supabase
      .from('breach_audit_logs')
      .insert([{
        breach_incident_id: assessment.breach_incident_id,
        action: 'create',
        user_identifier: assessment.assessed_by,
        changes: { created_assessment: assessment }
      }]);
  }

  /**
   * Get default assessment criteria
   */
  private getDefaultAssessmentCriteria(): AssessmentCriteria[] {
    return [
      {
        category: 'data_sensitivity',
        weight: 0.3,
        factors: [
          {
            name: 'PHI/PII Involved',
            description: 'Protected Health Information or Personally Identifiable Information',
            score_range: [1, 10],
            weight: 1.0,
            questions: [
              'Does the breach involve protected health information?',
              'Does the breach involve personally identifiable information?',
              'Is the data subject to specific regulatory protection?'
            ],
            scoring_guidance: 'Score 8-10 if PHI is involved, 5-7 if PII is involved, 1-4 if general business data'
          }
        ]
      },
      {
        category: 'business_impact',
        weight: 0.25,
        factors: [
          {
            name: 'Operational Impact',
            description: 'Impact on business operations and services',
            score_range: [1, 10],
            weight: 0.6,
            questions: [
              'Are customer-facing services affected?',
              'Is internal business operations disrupted?',
              'Are critical systems unavailable?'
            ],
            scoring_guidance: 'Score based on scope and duration of operational impact'
          },
          {
            name: 'Financial Impact',
            description: 'Direct and indirect financial consequences',
            score_range: [1, 10],
            weight: 0.4,
            questions: [
              'What is the estimated financial loss?',
              'Are there regulatory fines possible?',
              'Is there potential for legal action?'
            ],
            scoring_guidance: 'Score based on estimated financial impact magnitude'
          }
        ]
      },
      {
        category: 'regulatory_compliance',
        weight: 0.25,
        factors: [
          {
            name: 'Notification Requirements',
            description: 'Regulatory notification obligations',
            score_range: [1, 10],
            weight: 0.7,
            questions: [
              'Is notification to supervisory authorities required?',
              'Are individual notifications required?',
              'Are there specific timeframes for notification?'
            ],
            scoring_guidance: 'Score higher if multiple regulatory notifications are required'
          },
          {
            name: 'Reporting Obligations',
            description: 'Documentation and reporting requirements',
            score_range: [1, 10],
            weight: 0.3,
            questions: [
              'What documentation is required?',
              'Are there audit implications?',
              'Are there ongoing reporting requirements?'
            ],
            scoring_guidance: 'Score based on complexity of reporting requirements'
          }
        ]
      },
      {
        category: 'technical_complexity',
        weight: 0.2,
        factors: [
          {
            name: 'Investigation Complexity',
            description: 'Complexity of breach investigation and remediation',
            score_range: [1, 10],
            weight: 1.0,
            questions: [
              'How complex is the technical investigation?',
              'Are specialized skills required?',
              'How long is remediation expected to take?'
            ],
            scoring_guidance: 'Score based on technical complexity and resource requirements'
          }
        ]
      }
    ];
  }
}

// Export singleton instance
export const breachAssessmentEngine = new BreachAssessmentEngine(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);