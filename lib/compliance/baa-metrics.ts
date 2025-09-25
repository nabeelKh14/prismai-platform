/**
 * BAA Management Metrics
 * Tracks agreement status, vendor compliance, and expiration timelines for HIPAA compliance
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface BAAMetrics {
  agreementStatus: AgreementStatusMetrics;
  vendorCompliance: VendorComplianceMetrics;
  expirationTracking: ExpirationTrackingMetrics;
  incidentManagement: IncidentManagementMetrics;
  baaScore: number;
  lastUpdated: Date;
}

export interface AgreementStatusMetrics {
  totalAgreements: number;
  executedAgreements: number;
  draftAgreements: number;
  expiredAgreements: number;
  executionRate: number;
  issues: string[];
}

export interface VendorComplianceMetrics {
  totalVendors: number;
  assessedVendors: number;
  highRiskVendors: number;
  averageComplianceScore: number;
  assessmentCoverage: number;
  issues: string[];
}

export interface ExpirationTrackingMetrics {
  expiringSoon: number; // Within 90 days
  expiredAgreements: number;
  renewalRate: number;
  averageAge: number; // Days since execution
  issues: string[];
}

export interface IncidentManagementMetrics {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  averageResolutionTime: number;
  issues: string[];
}

export interface BAAAlert {
  id: string;
  type: 'expiration' | 'assessment' | 'incident' | 'execution';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  vendorName?: string;
  agreementId?: string;
  recommendation: string;
  createdAt: Date;
}

export class BAAMetricsService {
  private static instance: BAAMetricsService;

  public static getInstance(): BAAMetricsService {
    if (!BAAMetricsService.instance) {
      BAAMetricsService.instance = new BAAMetricsService();
    }
    return BAAMetricsService.instance;
  }

  /**
   * Get comprehensive BAA metrics
   */
  async getBAAMetrics(tenantId?: string): Promise<BAAMetrics> {
    try {
      const [agreementStatus, vendorCompliance, expirationTracking, incidentManagement] = await Promise.all([
        this.assessAgreementStatus(tenantId),
        this.evaluateVendorCompliance(tenantId),
        this.trackExpirations(tenantId),
        this.monitorIncidents(tenantId)
      ]);

      const baaScore = this.calculateBAAScore(
        agreementStatus,
        vendorCompliance,
        expirationTracking,
        incidentManagement
      );

      return {
        agreementStatus,
        vendorCompliance,
        expirationTracking,
        incidentManagement,
        baaScore,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error fetching BAA metrics:', error);
      throw new Error('Failed to fetch BAA metrics');
    }
  }

  /**
   * Assess agreement status metrics
   */
  private async assessAgreementStatus(tenantId?: string): Promise<AgreementStatusMetrics> {
    try {
      const supabase = await createClient();

      const { data: agreements, error } = await supabase
        .from('baa_agreements')
        .select('id, status, executed_at, expiration_date')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalAgreements = agreements?.length || 0;
      const executedAgreements = agreements?.filter((a: any) => a.status === 'executed').length || 0;
      const draftAgreements = agreements?.filter((a: any) => a.status === 'draft').length || 0;
      const expiredAgreements = agreements?.filter((a: any) => {
        if (!a.expiration_date) return false;
        return new Date(a.expiration_date) < new Date();
      }).length || 0;

      const executionRate = totalAgreements > 0 ? (executedAgreements / totalAgreements) * 100 : 0;

      const issues: string[] = [];
      if (executionRate < 80) {
        issues.push('BAA execution rate below target (80%)');
      }
      if (expiredAgreements > 0) {
        issues.push(`${expiredAgreements} BAA agreements have expired`);
      }
      if (draftAgreements > executedAgreements) {
        issues.push('More draft agreements than executed agreements');
      }

      return {
        totalAgreements,
        executedAgreements,
        draftAgreements,
        expiredAgreements,
        executionRate,
        issues
      };
    } catch (error) {
      logger.error('Error assessing agreement status:', error);
      return {
        totalAgreements: 0,
        executedAgreements: 0,
        draftAgreements: 0,
        expiredAgreements: 0,
        executionRate: 0,
        issues: ['Unable to assess agreement status']
      };
    }
  }

  /**
   * Evaluate vendor compliance metrics
   */
  private async evaluateVendorCompliance(tenantId?: string): Promise<VendorComplianceMetrics> {
    try {
      const supabase = await createClient();

      const { data: vendors, error } = await supabase
        .from('baa_vendors')
        .select(`
          id,
          risk_level,
          vendor_compliance_assessments (
            overall_compliance_score,
            assessment_date
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalVendors = vendors?.length || 0;
      const highRiskVendors = vendors?.filter((v: any) => v.risk_level === 'high' || v.risk_level === 'critical').length || 0;

      const assessedVendors = vendors?.filter((v: any) =>
        v.vendor_compliance_assessments && v.vendor_compliance_assessments.length > 0
      ).length || 0;

      const assessmentCoverage = totalVendors > 0 ? (assessedVendors / totalVendors) * 100 : 0;

      const averageComplianceScore = vendors?.reduce((sum: number, vendor: any) => {
        if (vendor.vendor_compliance_assessments && vendor.vendor_compliance_assessments.length > 0) {
          const scores = vendor.vendor_compliance_assessments.map((a: any) => a.overall_compliance_score);
          const maxScore = Math.max(...scores);
          return sum + maxScore;
        }
        return sum;
      }, 0) / assessedVendors || 0;

      const issues: string[] = [];
      if (assessmentCoverage < 90) {
        issues.push('Vendor assessment coverage below target (90%)');
      }
      if (averageComplianceScore < 80) {
        issues.push(`Average vendor compliance score is ${averageComplianceScore.toFixed(1)} (target: 80+)`)
      }
      if (highRiskVendors > totalVendors * 0.2) {
        issues.push('High percentage of high-risk vendors');
      }

      return {
        totalVendors,
        assessedVendors,
        highRiskVendors,
        averageComplianceScore,
        assessmentCoverage,
        issues
      };
    } catch (error) {
      logger.error('Error evaluating vendor compliance:', error);
      return {
        totalVendors: 0,
        assessedVendors: 0,
        highRiskVendors: 0,
        averageComplianceScore: 0,
        assessmentCoverage: 0,
        issues: ['Unable to evaluate vendor compliance']
      };
    }
  }

  /**
   * Track expiration and renewal metrics
   */
  private async trackExpirations(tenantId?: string): Promise<ExpirationTrackingMetrics> {
    try {
      const supabase = await createClient();

      const { data: agreements, error } = await supabase
        .from('baa_agreements')
        .select('id, executed_at, expiration_date, status')
        .eq('status', 'executed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const now = new Date();
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const expiringSoon = agreements?.filter((a: any) => {
        if (!a.expiration_date) return false;
        const expiryDate = new Date(a.expiration_date);
        return expiryDate <= ninetyDaysFromNow && expiryDate > now;
      }).length || 0;

      const expiredAgreements = agreements?.filter((a: any) => {
        if (!a.expiration_date) return false;
        return new Date(a.expiration_date) < now;
      }).length || 0;

      const totalExecuted = agreements?.length || 0;
      const renewedAgreements = agreements?.filter((a: any) => {
        // This would need additional logic to determine renewals
        // For now, assume agreements older than 1 year are renewals
        if (!a.executed_at) return false;
        const executedDate = new Date(a.executed_at);
        const daysSinceExecution = (now.getTime() - executedDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceExecution > 365;
      }).length || 0;

      const renewalRate = totalExecuted > 0 ? (renewedAgreements / totalExecuted) * 100 : 0;

      const averageAge = agreements?.reduce((sum: number, agreement: any) => {
        if (!agreement.executed_at) return sum;
        const executedDate = new Date(agreement.executed_at);
        const age = (now.getTime() - executedDate.getTime()) / (1000 * 60 * 60 * 24);
        return sum + age;
      }, 0) / totalExecuted || 0;

      const issues: string[] = [];
      if (expiringSoon > 0) {
        issues.push(`${expiringSoon} BAA agreements expiring within 90 days`);
      }
      if (expiredAgreements > 0) {
        issues.push(`${expiredAgreements} BAA agreements have expired`);
      }
      if (renewalRate < 70) {
        issues.push('BAA renewal rate below target (70%)');
      }

      return {
        expiringSoon,
        expiredAgreements,
        renewalRate,
        averageAge,
        issues
      };
    } catch (error) {
      logger.error('Error tracking expirations:', error);
      return {
        expiringSoon: 0,
        expiredAgreements: 0,
        renewalRate: 0,
        averageAge: 0,
        issues: ['Unable to track expirations']
      };
    }
  }

  /**
   * Monitor incident management metrics
   */
  private async monitorIncidents(tenantId?: string): Promise<IncidentManagementMetrics> {
    try {
      const supabase = await createClient();

      const { data: incidents, error } = await supabase
        .from('baa_compliance_incidents')
        .select('id, status, discovered_date, resolved_date')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalIncidents = incidents?.length || 0;
      const openIncidents = incidents?.filter((i: any) => i.status === 'open' || i.status === 'investigating').length || 0;
      const resolvedIncidents = incidents?.filter((i: any) => i.status === 'resolved' || i.status === 'closed').length || 0;

      const averageResolutionTime = incidents?.reduce((sum: number, incident: any) => {
        if (!incident.discovered_date || !incident.resolved_date) return sum;
        const discovered = new Date(incident.discovered_date);
        const resolved = new Date(incident.resolved_date);
        const resolutionTime = (resolved.getTime() - discovered.getTime()) / (1000 * 60 * 60 * 24);
        return sum + resolutionTime;
      }, 0) / resolvedIncidents || 0;

      const issues: string[] = [];
      if (openIncidents > totalIncidents * 0.3) {
        issues.push('High percentage of open BAA incidents');
      }
      if (averageResolutionTime > 30) {
        issues.push(`Average incident resolution time is ${averageResolutionTime.toFixed(1)} days (target: 30)`);
      }
      if (totalIncidents === 0) {
        issues.push('No BAA compliance incidents recorded - consider if monitoring is adequate');
      }

      return {
        totalIncidents,
        openIncidents,
        resolvedIncidents,
        averageResolutionTime,
        issues
      };
    } catch (error) {
      logger.error('Error monitoring incidents:', error);
      return {
        totalIncidents: 0,
        openIncidents: 0,
        resolvedIncidents: 0,
        averageResolutionTime: 0,
        issues: ['Unable to monitor incidents']
      };
    }
  }

  /**
   * Calculate overall BAA score
   */
  private calculateBAAScore(
    agreements: AgreementStatusMetrics,
    vendors: VendorComplianceMetrics,
    expirations: ExpirationTrackingMetrics,
    incidents: IncidentManagementMetrics
  ): number {
    const agreementWeight = 0.25;
    const vendorWeight = 0.25;
    const expirationWeight = 0.25;
    const incidentWeight = 0.25;

    const agreementScore = agreements.executionRate;
    const vendorScore = vendors.assessmentCoverage;
    const expirationScore = this.calculateExpirationScore(expirations);
    const incidentScore = this.calculateIncidentScore(incidents);

    return Math.round(
      agreementScore * agreementWeight +
      vendorScore * vendorWeight +
      expirationScore * expirationWeight +
      incidentScore * incidentWeight
    );
  }

  /**
   * Calculate expiration score based on expiring and expired agreements
   */
  private calculateExpirationScore(expirations: ExpirationTrackingMetrics): number {
    let score = 100;

    if (expirations.expiringSoon > 0) {
      score -= Math.min(30, expirations.expiringSoon * 5);
    }

    if (expirations.expiredAgreements > 0) {
      score -= Math.min(40, expirations.expiredAgreements * 10);
    }

    if (expirations.renewalRate < 70) {
      score -= 20;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate incident score based on resolution metrics
   */
  private calculateIncidentScore(incidents: IncidentManagementMetrics): number {
    let score = 100;

    if (incidents.openIncidents > incidents.totalIncidents * 0.3) {
      score -= 30;
    }

    if (incidents.averageResolutionTime > 30) {
      score -= 25;
    } else if (incidents.averageResolutionTime > 15) {
      score -= 15;
    }

    return Math.max(0, score);
  }

  /**
   * Get BAA compliance alerts
   */
  async getBAAAlerts(tenantId?: string): Promise<BAAAlert[]> {
    const alerts: BAAAlert[] = [];

    try {
      const supabase = await createClient();

      // Expiring agreements
      const { data: expiringAgreements, error: expiryError } = await supabase
        .from('baa_agreements')
        .select('id, vendor_name, expiration_date')
        .eq('status', 'executed')
        .lte('expiration_date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())
        .gte('expiration_date', new Date().toISOString())
        .order('expiration_date', { ascending: true })
        .limit(20);

      if (!expiryError && expiringAgreements) {
        expiringAgreements.forEach((agreement: any) => {
          const daysUntilExpiry = Math.ceil(
            (new Date(agreement.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          alerts.push({
            id: `expiry-${agreement.id}`,
            type: 'expiration',
            severity: daysUntilExpiry <= 30 ? 'critical' : daysUntilExpiry <= 60 ? 'high' : 'medium',
            title: 'BAA Agreement Expiring',
            description: `BAA agreement with ${agreement.vendor_name} expires in ${daysUntilExpiry} days`,
            vendorName: agreement.vendor_name,
            agreementId: agreement.id,
            recommendation: 'Review agreement and initiate renewal process',
            createdAt: new Date()
          });
        });
      }

      // Vendors needing assessment
      const { data: unassessedVendors, error: vendorError } = await supabase
        .from('baa_vendors')
        .select('id, vendor_name, last_assessment_date')
        .is('last_assessment_date', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!vendorError && unassessedVendors) {
        unassessedVendors.forEach((vendor: any) => {
          alerts.push({
            id: `assessment-${vendor.id}`,
            type: 'assessment',
            severity: 'medium',
            title: 'Vendor Assessment Required',
            description: `Vendor ${vendor.vendor_name} has not been assessed for compliance`,
            vendorName: vendor.vendor_name,
            recommendation: 'Schedule compliance assessment for this vendor',
            createdAt: new Date()
          });
        });
      }

      // Open incidents
      const { data: openIncidents, error: incidentError } = await supabase
        .from('baa_compliance_incidents')
        .select('id, title, vendor_id, severity, discovered_date')
        .in('status', ['open', 'investigating'])
        .order('discovered_date', { ascending: false })
        .limit(10);

      if (!incidentError && openIncidents) {
        openIncidents.forEach((incident: any) => {
          const daysSinceDiscovery = Math.ceil(
            (new Date().getTime() - new Date(incident.discovered_date).getTime()) / (1000 * 60 * 60 * 24)
          );

          alerts.push({
            id: `incident-${incident.id}`,
            type: 'incident',
            severity: incident.severity === 'critical' ? 'critical' : incident.severity === 'high' ? 'high' : 'medium',
            title: 'Open BAA Compliance Incident',
            description: `${incident.title} - ${daysSinceDiscovery} days since discovery`,
            recommendation: 'Investigate and resolve the compliance incident',
            createdAt: new Date()
          });
        });
      }

      // Draft agreements
      const { data: draftAgreements, error: draftError } = await supabase
        .from('baa_agreements')
        .select('id, vendor_name, created_at')
        .eq('status', 'draft')
        .lte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })
        .limit(10);

      if (!draftError && draftAgreements) {
        draftAgreements.forEach((agreement: any) => {
          const daysSinceCreation = Math.ceil(
            (new Date().getTime() - new Date(agreement.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          alerts.push({
            id: `draft-${agreement.id}`,
            type: 'execution',
            severity: 'low',
            title: 'Draft BAA Agreement Pending',
            description: `BAA agreement with ${agreement.vendor_name} has been in draft for ${daysSinceCreation} days`,
            vendorName: agreement.vendor_name,
            agreementId: agreement.id,
            recommendation: 'Review and execute the BAA agreement',
            createdAt: new Date()
          });
        });
      }

    } catch (error) {
      logger.error('Error fetching BAA alerts:', error);
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }
}

// Export singleton instance
export const baaMetricsService = BAAMetricsService.getInstance();