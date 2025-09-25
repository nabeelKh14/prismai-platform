/**
 * International Transfer Analytics
 * Monitors transfer volumes, risk assessments, and compliance status for GDPR international transfers
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface TransferMetrics {
  transferVolumes: TransferVolumeMetrics;
  riskAssessments: RiskAssessmentMetrics;
  complianceStatus: TransferComplianceMetrics;
  adequacyDecisions: AdequacyDecisionMetrics;
  transferScore: number;
  lastUpdated: Date;
}

export interface TransferVolumeMetrics {
  totalTransfers: number;
  transfersByMechanism: Record<string, number>;
  transfersByDestination: Record<string, number>;
  highRiskTransfers: number;
  transferTrends: TransferTrend[];
  issues: string[];
}

export interface RiskAssessmentMetrics {
  completedTIAs: number;
  pendingTIAs: number;
  averageRiskScore: number;
  highRiskTransfers: number;
  tiaCoverage: number;
  issues: string[];
}

export interface TransferComplianceMetrics {
  sccCompliance: number;
  adequacyCompliance: number;
  overallCompliance: number;
  nonCompliantTransfers: number;
  issues: string[];
}

export interface AdequacyDecisionMetrics {
  adequateCountries: string[];
  partiallyAdequateCountries: string[];
  inadequateCountries: string[];
  upcomingReviews: number;
  issues: string[];
}

export interface TransferTrend {
  date: Date;
  totalTransfers: number;
  highRiskTransfers: number;
  compliantTransfers: number;
}

export interface TransferAlert {
  id: string;
  type: 'high_risk' | 'non_compliant' | 'missing_tia' | 'adequacy_review';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  destination: string;
  recommendation: string;
  createdAt: Date;
}

export class TransferMetricsService {
  private static instance: TransferMetricsService;

  public static getInstance(): TransferMetricsService {
    if (!TransferMetricsService.instance) {
      TransferMetricsService.instance = new TransferMetricsService();
    }
    return TransferMetricsService.instance;
  }

  /**
   * Get comprehensive transfer metrics
   */
  async getTransferMetrics(tenantId?: string): Promise<TransferMetrics> {
    try {
      const [transferVolumes, riskAssessments, complianceStatus, adequacyDecisions] = await Promise.all([
        this.calculateTransferVolumes(tenantId),
        this.assessRiskAssessments(tenantId),
        this.evaluateTransferCompliance(tenantId),
        this.monitorAdequacyDecisions(tenantId)
      ]);

      const transferScore = this.calculateTransferScore(
        transferVolumes,
        riskAssessments,
        complianceStatus,
        adequacyDecisions
      );

      return {
        transferVolumes,
        riskAssessments,
        complianceStatus,
        adequacyDecisions,
        transferScore,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error fetching transfer metrics:', error);
      throw new Error('Failed to fetch transfer metrics');
    }
  }

  /**
   * Calculate transfer volumes and trends
   */
  private async calculateTransferVolumes(tenantId?: string): Promise<TransferVolumeMetrics> {
    try {
      const supabase = await createClient();

      const { data: transferData, error } = await supabase
        .from('international_transfer_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const totalTransfers = transferData?.length || 0;
      const highRiskTransfers = transferData?.filter((t: any) =>
        ['RU', 'CN', 'IR', 'BY', 'KP'].includes(t.destination_location)
      ).length || 0;

      // Group by transfer mechanism
      const transfersByMechanism: Record<string, number> = {};
      transferData?.forEach((transfer: any) => {
        const mechanism = transfer.transfer_mechanism || 'unknown';
        transfersByMechanism[mechanism] = (transfersByMechanism[mechanism] || 0) + 1;
      });

      // Group by destination
      const transfersByDestination: Record<string, number> = {};
      transferData?.forEach((transfer: any) => {
        const destination = transfer.destination_location || 'unknown';
        transfersByDestination[destination] = (transfersByDestination[destination] || 0) + 1;
      });

      // Generate trends (sample data for now)
      const transferTrends: TransferTrend[] = [];
      const now = new Date();

      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        transferTrends.push({
          date,
          totalTransfers: Math.floor(Math.random() * 50) + 10,
          highRiskTransfers: Math.floor(Math.random() * 5),
          compliantTransfers: Math.floor(Math.random() * 45) + 8
        });
      }

      const issues: string[] = [];
      if (highRiskTransfers > totalTransfers * 0.1) {
        issues.push('High percentage of transfers to high-risk jurisdictions');
      }
      if (transfersByMechanism['none'] > 0) {
        issues.push('Transfers without legal mechanisms detected');
      }

      return {
        totalTransfers,
        transfersByMechanism,
        transfersByDestination,
        highRiskTransfers,
        transferTrends,
        issues
      };
    } catch (error) {
      logger.error('Error calculating transfer volumes:', error);
      return {
        totalTransfers: 0,
        transfersByMechanism: {},
        transfersByDestination: {},
        highRiskTransfers: 0,
        transferTrends: [],
        issues: ['Unable to calculate transfer volumes']
      };
    }
  }

  /**
   * Assess risk assessments (TIAs)
   */
  private async assessRiskAssessments(tenantId?: string): Promise<RiskAssessmentMetrics> {
    try {
      const supabase = await createClient();

      const { data: tiaData, error } = await supabase
        .from('transfer_impact_assessments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const completedTIAs = tiaData?.filter((tia: any) => tia.status === 'approved').length || 0;
      const pendingTIAs = tiaData?.filter((tia: any) => tia.status === 'draft' || tia.status === 'in_progress').length || 0;
      const totalTIAs = tiaData?.length || 0;

      const averageRiskScore = tiaData?.reduce((sum: number, tia: any) => {
        return sum + (tia.overall_risk_score || 0);
      }, 0) / totalTIAs || 0;

      const highRiskTransfers = tiaData?.filter((tia: any) => tia.risk_level === 'high' || tia.risk_level === 'critical').length || 0;
      const tiaCoverage = totalTIAs > 0 ? (completedTIAs / totalTIAs) * 100 : 0;

      const issues: string[] = [];
      if (tiaCoverage < 80) {
        issues.push('TIA coverage below target (80%)');
      }
      if (averageRiskScore > 3.5) {
        issues.push('High average risk score across transfers');
      }
      if (pendingTIAs > completedTIAs) {
        issues.push('More pending TIAs than completed assessments');
      }

      return {
        completedTIAs,
        pendingTIAs,
        averageRiskScore,
        highRiskTransfers,
        tiaCoverage,
        issues
      };
    } catch (error) {
      logger.error('Error assessing risk assessments:', error);
      return {
        completedTIAs: 0,
        pendingTIAs: 0,
        averageRiskScore: 0,
        highRiskTransfers: 0,
        tiaCoverage: 0,
        issues: ['Unable to assess risk assessments']
      };
    }
  }

  /**
   * Evaluate transfer compliance
   */
  private async evaluateTransferCompliance(tenantId?: string): Promise<TransferComplianceMetrics> {
    try {
      const supabase = await createClient();

      const { data: transferData, error } = await supabase
        .from('international_transfer_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const totalTransfers = transferData?.length || 0;
      const sccTransfers = transferData?.filter((t: any) => t.transfer_mechanism === 'scc').length || 0;
      const adequacyTransfers = transferData?.filter((t: any) => t.transfer_mechanism === 'adequacy').length || 0;
      const nonCompliantTransfers = transferData?.filter((t: any) =>
        !t.transfer_mechanism || t.transfer_mechanism === 'none'
      ).length || 0;

      const sccCompliance = totalTransfers > 0 ? ((sccTransfers + adequacyTransfers) / totalTransfers) * 100 : 100;
      const adequacyCompliance = totalTransfers > 0 ? (adequacyTransfers / totalTransfers) * 100 : 100;
      const overallCompliance = totalTransfers > 0 ? ((totalTransfers - nonCompliantTransfers) / totalTransfers) * 100 : 100;

      const issues: string[] = [];
      if (sccCompliance < 90) {
        issues.push('SCC compliance below target (90%)');
      }
      if (nonCompliantTransfers > 0) {
        issues.push(`${nonCompliantTransfers} transfers lack legal mechanisms`);
      }

      return {
        sccCompliance,
        adequacyCompliance,
        overallCompliance,
        nonCompliantTransfers,
        issues
      };
    } catch (error) {
      logger.error('Error evaluating transfer compliance:', error);
      return {
        sccCompliance: 0,
        adequacyCompliance: 0,
        overallCompliance: 0,
        nonCompliantTransfers: 0,
        issues: ['Unable to evaluate transfer compliance']
      };
    }
  }

  /**
   * Monitor adequacy decisions
   */
  private async monitorAdequacyDecisions(tenantId?: string): Promise<AdequacyDecisionMetrics> {
    try {
      const supabase = await createClient();

      const { data: adequacyData, error } = await supabase
        .from('country_adequacy_decisions')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      const adequateCountries = adequacyData?.filter((c: any) => c.adequacy_status === 'adequate').map((c: any) => c.country_name) || [];
      const partiallyAdequateCountries = adequacyData?.filter((c: any) => c.adequacy_status === 'partially_adequate').map((c: any) => c.country_name) || [];
      const inadequateCountries = adequacyData?.filter((c: any) => c.adequacy_status === 'inadequate').map((c: any) => c.country_name) || [];

      const upcomingReviews = adequacyData?.filter((c: any) => {
        if (!c.review_due_date) return false;
        const reviewDate = new Date(c.review_due_date);
        const now = new Date();
        const daysUntilReview = (reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilReview <= 90 && daysUntilReview > 0;
      }).length || 0;

      const issues: string[] = [];
      if (upcomingReviews > 0) {
        issues.push(`${upcomingReviews} adequacy decisions due for review within 90 days`);
      }
      if (inadequateCountries.length > 0) {
        issues.push(`Transfers to ${inadequateCountries.length} inadequate countries may require additional safeguards`);
      }

      return {
        adequateCountries,
        partiallyAdequateCountries,
        inadequateCountries,
        upcomingReviews,
        issues
      };
    } catch (error) {
      logger.error('Error monitoring adequacy decisions:', error);
      return {
        adequateCountries: [],
        partiallyAdequateCountries: [],
        inadequateCountries: [],
        upcomingReviews: 0,
        issues: ['Unable to monitor adequacy decisions']
      };
    }
  }

  /**
   * Calculate overall transfer score
   */
  private calculateTransferScore(
    volumes: TransferVolumeMetrics,
    risks: RiskAssessmentMetrics,
    compliance: TransferComplianceMetrics,
    adequacy: AdequacyDecisionMetrics
  ): number {
    const volumeWeight = 0.25;
    const riskWeight = 0.25;
    const complianceWeight = 0.30;
    const adequacyWeight = 0.20;

    const volumeScore = this.calculateVolumeScore(volumes);
    const riskScore = this.calculateRiskScore(risks);
    const complianceScore = compliance.overallCompliance;
    const adequacyScore = this.calculateAdequacyScore(adequacy);

    return Math.round(
      volumeScore * volumeWeight +
      riskScore * riskWeight +
      complianceScore * complianceWeight +
      adequacyScore * adequacyWeight
    );
  }

  /**
   * Calculate volume score based on high-risk transfers
   */
  private calculateVolumeScore(volumes: TransferVolumeMetrics): number {
    if (volumes.totalTransfers === 0) return 100;

    const highRiskPercentage = (volumes.highRiskTransfers / volumes.totalTransfers) * 100;
    let score = 100;

    if (highRiskPercentage > 20) score -= 40;
    else if (highRiskPercentage > 10) score -= 25;
    else if (highRiskPercentage > 5) score -= 15;

    return Math.max(0, score);
  }

  /**
   * Calculate risk score based on TIA coverage and risk levels
   */
  private calculateRiskScore(risks: RiskAssessmentMetrics): number {
    let score = 100;

    if (risks.tiaCoverage < 80) score -= 30;
    else if (risks.tiaCoverage < 90) score -= 15;

    if (risks.averageRiskScore > 3.5) score -= 25;
    else if (risks.averageRiskScore > 2.5) score -= 15;

    if (risks.pendingTIAs > risks.completedTIAs) score -= 20;

    return Math.max(0, score);
  }

  /**
   * Calculate adequacy score based on upcoming reviews and inadequate countries
   */
  private calculateAdequacyScore(adequacy: AdequacyDecisionMetrics): number {
    let score = 100;

    if (adequacy.upcomingReviews > 5) score -= 30;
    else if (adequacy.upcomingReviews > 2) score -= 15;

    if (adequacy.inadequateCountries.length > 0) score -= 20;

    return Math.max(0, score);
  }

  /**
   * Get transfer compliance alerts
   */
  async getTransferAlerts(tenantId?: string): Promise<TransferAlert[]> {
    const alerts: TransferAlert[] = [];

    try {
      const supabase = await createClient();

      // High-risk transfers without TIAs
      const { data: highRiskTransfers, error } = await supabase
        .from('international_transfer_records')
        .select('*')
        .in('destination_location', ['RU', 'CN', 'IR', 'BY', 'KP'])
        .is('tia_assessment_id', null)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && highRiskTransfers) {
        highRiskTransfers.forEach((transfer: any) => {
          alerts.push({
            id: `high-risk-no-tia-${transfer.id}`,
            type: 'high_risk',
            severity: 'critical',
            title: 'High-Risk Transfer Without TIA',
            description: `Transfer to ${transfer.destination_location} lacks required Transfer Impact Assessment`,
            destination: transfer.destination_location,
            recommendation: 'Complete Transfer Impact Assessment immediately',
            createdAt: new Date()
          });
        });
      }

      // Non-compliant transfers
      const { data: nonCompliantTransfers, error: complianceError } = await supabase
        .from('international_transfer_records')
        .select('*')
        .or('transfer_mechanism.is.null,transfer_mechanism.eq.none')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!complianceError && nonCompliantTransfers) {
        nonCompliantTransfers.forEach((transfer: any) => {
          alerts.push({
            id: `non-compliant-${transfer.id}`,
            type: 'non_compliant',
            severity: 'high',
            title: 'Non-Compliant International Transfer',
            description: `Transfer to ${transfer.destination_location} lacks legal transfer mechanism`,
            destination: transfer.destination_location,
            recommendation: 'Implement appropriate transfer mechanism (SCC, adequacy, etc.)',
            createdAt: new Date()
          });
        });
      }

      // Missing TIAs for high-volume transfers
      const { data: highVolumeTransfers, error: volumeError } = await supabase
        .from('international_transfer_records')
        .select('*')
        .gt('record_count', 10000)
        .is('tia_assessment_id', null)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!volumeError && highVolumeTransfers) {
        highVolumeTransfers.forEach((transfer: any) => {
          alerts.push({
            id: `missing-tia-volume-${transfer.id}`,
            type: 'missing_tia',
            severity: 'medium',
            title: 'High-Volume Transfer Missing TIA',
            description: `Transfer of ${transfer.record_count.toLocaleString()} records to ${transfer.destination_location} lacks TIA`,
            destination: transfer.destination_location,
            recommendation: 'Conduct Transfer Impact Assessment for high-volume transfers',
            createdAt: new Date()
          });
        });
      }

    } catch (error) {
      logger.error('Error fetching transfer alerts:', error);
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }
}

// Export singleton instance
export const transferMetricsService = TransferMetricsService.getInstance();