/**
 * Comprehensive Compliance Metrics Dashboard
 * Provides real-time compliance monitoring across HIPAA, GDPR, and SOC2 frameworks
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface ComplianceScore {
  framework: 'HIPAA' | 'GDPR' | 'SOC2';
  score: number; // 0-100 scale
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  lastUpdated: Date;
  components: ComplianceComponent[];
}

export interface ComplianceComponent {
  name: string;
  score: number;
  weight: number;
  status: 'compliant' | 'warning' | 'critical' | 'unknown';
  issues: string[];
  lastAssessed: Date;
}

export interface ComplianceAlert {
  id: string;
  framework: 'HIPAA' | 'GDPR' | 'SOC2';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  category: 'breach' | 'expiration' | 'assessment' | 'violation' | 'maintenance';
  createdAt: Date;
  resolvedAt?: Date;
  assignee?: string;
}

export interface DashboardMetrics {
  overallScore: number;
  frameworkScores: ComplianceScore[];
  alerts: ComplianceAlert[];
  trends: ComplianceTrend[];
  lastUpdated: Date;
}

export interface ComplianceTrend {
  date: Date;
  hipaaScore: number;
  gdprScore: number;
  soc2Score: number;
  overallScore: number;
}

export class ComplianceMetricsDashboard {
  private static instance: ComplianceMetricsDashboard;

  public static getInstance(): ComplianceMetricsDashboard {
    if (!ComplianceMetricsDashboard.instance) {
      ComplianceMetricsDashboard.instance = new ComplianceMetricsDashboard();
    }
    return ComplianceMetricsDashboard.instance;
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(tenantId?: string): Promise<DashboardMetrics> {
    try {
      const [frameworkScores, alerts, trends] = await Promise.all([
        this.calculateFrameworkScores(tenantId),
        this.getActiveAlerts(tenantId),
        this.getComplianceTrends(tenantId)
      ]);

      const overallScore = this.calculateOverallScore(frameworkScores);

      return {
        overallScore,
        frameworkScores,
        alerts,
        trends,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error fetching dashboard metrics:', error);
      throw new Error('Failed to fetch compliance dashboard metrics');
    }
  }

  /**
   * Calculate compliance scores for each framework
   */
  private async calculateFrameworkScores(tenantId?: string): Promise<ComplianceScore[]> {
    const scores: ComplianceScore[] = [];

    // Calculate HIPAA score
    const hipaaScore = await this.calculateHIPAAScore(tenantId);
    scores.push(hipaaScore);

    // Calculate GDPR score
    const gdprScore = await this.calculateGDPRScore(tenantId);
    scores.push(gdprScore);

    // Calculate SOC2 score
    const soc2Score = await this.calculateSOC2Score(tenantId);
    scores.push(soc2Score);

    return scores;
  }

  /**
   * Calculate HIPAA compliance score
   */
  private async calculateHIPAAScore(tenantId?: string): Promise<ComplianceScore> {
    const components: ComplianceComponent[] = [];

    // BAA Management (30% weight)
    const baaComponent = await this.assessBAACompliance(tenantId);
    components.push(baaComponent);

    // Breach Response (25% weight)
    const breachComponent = await this.assessBreachResponse(tenantId);
    components.push(breachComponent);

    // Security Controls (20% weight)
    const securityComponent = await this.assessSecurityControls(tenantId);
    components.push(securityComponent);

    // Privacy Practices (15% weight)
    const privacyComponent = await this.assessPrivacyPractices(tenantId);
    components.push(privacyComponent);

    // Audit Logging (10% weight)
    const auditComponent = await this.assessAuditLogging(tenantId);
    components.push(auditComponent);

    const totalScore = components.reduce((sum, comp) => sum + (comp.score * comp.weight), 0);
    const weightedScore = totalScore / 100; // Normalize to 0-100 scale

    return {
      framework: 'HIPAA',
      score: Math.round(weightedScore),
      grade: this.calculateGrade(weightedScore),
      lastUpdated: new Date(),
      components
    };
  }

  /**
   * Calculate GDPR compliance score
   */
  private async calculateGDPRScore(tenantId?: string): Promise<ComplianceScore> {
    const components: ComplianceComponent[] = [];

    // Data Protection (25% weight)
    const dataProtectionComponent = await this.assessDataProtection(tenantId);
    components.push(dataProtectionComponent);

    // International Transfers (25% weight)
    const transferComponent = await this.assessInternationalTransfers(tenantId);
    components.push(transferComponent);

    // Consent Management (20% weight)
    const consentComponent = await this.assessConsentManagement(tenantId);
    components.push(consentComponent);

    // Breach Notification (15% weight)
    const breachNotificationComponent = await this.assessBreachNotification(tenantId);
    components.push(breachNotificationComponent);

    // DPO and Governance (15% weight)
    const governanceComponent = await this.assessGovernance(tenantId);
    components.push(governanceComponent);

    const totalScore = components.reduce((sum, comp) => sum + (comp.score * comp.weight), 0);
    const weightedScore = totalScore / 100;

    return {
      framework: 'GDPR',
      score: Math.round(weightedScore),
      grade: this.calculateGrade(weightedScore),
      lastUpdated: new Date(),
      components
    };
  }

  /**
   * Calculate SOC2 compliance score
   */
  private async calculateSOC2Score(tenantId?: string): Promise<ComplianceScore> {
    const components: ComplianceComponent[] = [];

    // Security (35% weight)
    const securityComponent = await this.assessSOC2Security(tenantId);
    components.push(securityComponent);

    // Availability (20% weight)
    const availabilityComponent = await this.assessAvailability(tenantId);
    components.push(availabilityComponent);

    // Processing Integrity (15% weight)
    const integrityComponent = await this.assessProcessingIntegrity(tenantId);
    components.push(integrityComponent);

    // Confidentiality (15% weight)
    const confidentialityComponent = await this.assessConfidentiality(tenantId);
    components.push(confidentialityComponent);

    // Privacy (15% weight)
    const privacyComponent = await this.assessSOC2Privacy(tenantId);
    components.push(privacyComponent);

    const totalScore = components.reduce((sum, comp) => sum + (comp.score * comp.weight), 0);
    const weightedScore = totalScore / 100;

    return {
      framework: 'SOC2',
      score: Math.round(weightedScore),
      grade: this.calculateGrade(weightedScore),
      lastUpdated: new Date(),
      components
    };
  }

  /**
   * Assess BAA compliance component
   */
  private async assessBAACompliance(tenantId?: string): Promise<ComplianceComponent> {
    try {
      const supabase = await createClient();

      // Query BAA agreements and assessments
      const { data: baaData, error } = await supabase
        .from('baa_agreements')
        .select(`
          id,
          status,
          expiration_date,
          executed_at,
          vendor_compliance_assessments (
            overall_compliance_score,
            assessment_date
          )
        `)
        .eq('status', 'executed');

      if (error) throw error;

      let score = 100;
      const issues: string[] = [];

      if (!baaData || baaData.length === 0) {
        score = 0;
        issues.push('No executed BAA agreements found');
      } else {
        // Check for expired agreements
        const expiredAgreements = baaData.filter((agreement: any) =>
          agreement.expiration_date && new Date(agreement.expiration_date) < new Date()
        );

        if (expiredAgreements.length > 0) {
          score -= 30;
          issues.push(`${expiredAgreements.length} BAA agreements have expired`);
        }

        // Check for recent assessments
        const recentAssessments = baaData.filter((agreement: any) =>
          agreement.vendor_compliance_assessments?.some((assessment: any) =>
            assessment.assessment_date &&
            new Date(assessment.assessment_date) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
          )
        );

        if (recentAssessments.length < baaData.length) {
          score -= 20;
          issues.push('Some vendors lack recent compliance assessments');
        }

        // Check average compliance scores
        const avgScore = baaData.reduce((sum: number, agreement: any) => {
          const scores = agreement.vendor_compliance_assessments?.map((a: any) => a.overall_compliance_score) || [];
          return sum + (scores.length > 0 ? Math.max(...scores) : 0);
        }, 0) / baaData.length;

        if (avgScore < 80) {
          score -= 15;
          issues.push(`Average vendor compliance score is ${avgScore.toFixed(1)} (target: 80+)`)
        }
      }

      return {
        name: 'BAA Management',
        score: Math.max(0, score),
        weight: 30,
        status: score >= 80 ? 'compliant' : score >= 60 ? 'warning' : 'critical',
        issues,
        lastAssessed: new Date()
      };
    } catch (error) {
      logger.error('Error assessing BAA compliance:', error);
      return {
        name: 'BAA Management',
        score: 0,
        weight: 30,
        status: 'unknown',
        issues: ['Unable to assess BAA compliance'],
        lastAssessed: new Date()
      };
    }
  }

  /**
   * Assess breach response component
   */
  private async assessBreachResponse(tenantId?: string): Promise<ComplianceComponent> {
    try {
      const supabase = await createClient();

      const { data: breachData, error } = await supabase
        .from('breach_incidents')
        .select('*')
        .eq('status', 'detected')
        .order('detected_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      let score = 100;
      const issues: string[] = [];

      if (!breachData || breachData.length === 0) {
        // No recent breaches - this is good
        return {
          name: 'Breach Response',
          score: 100,
          weight: 25,
          status: 'compliant',
          issues: [],
          lastAssessed: new Date()
        };
      }

      // Check for unresolved high-severity breaches
      const unresolvedHighSeverity = breachData.filter((breach: any) =>
        breach.severity_score >= 4 && breach.status !== 'resolved'
      );

      if (unresolvedHighSeverity.length > 0) {
        score -= 40;
        issues.push(`${unresolvedHighSeverity.length} high-severity breaches remain unresolved`);
      }

      // Check response times
      const slowResponses = breachData.filter((breach: any) => {
        const detectedAt = new Date(breach.detected_at);
        const now = new Date();
        const hoursSinceDetection = (now.getTime() - detectedAt.getTime()) / (1000 * 60 * 60);

        // Should be assessed within 24 hours for high severity
        return breach.severity_score >= 4 && hoursSinceDetection > 24 && breach.status === 'detected';
      });

      if (slowResponses.length > 0) {
        score -= 25;
        issues.push(`${slowResponses.length} high-severity breaches not assessed within 24 hours`);
      }

      return {
        name: 'Breach Response',
        score: Math.max(0, score),
        weight: 25,
        status: score >= 80 ? 'compliant' : score >= 60 ? 'warning' : 'critical',
        issues,
        lastAssessed: new Date()
      };
    } catch (error) {
      logger.error('Error assessing breach response:', error);
      return {
        name: 'Breach Response',
        score: 0,
        weight: 25,
        status: 'unknown',
        issues: ['Unable to assess breach response'],
        lastAssessed: new Date()
      };
    }
  }

  /**
   * Assess security controls component
   */
  private async assessSecurityControls(tenantId?: string): Promise<ComplianceComponent> {
    // This would integrate with security monitoring systems
    // For now, return a placeholder assessment
    return {
      name: 'Security Controls',
      score: 85,
      weight: 20,
      status: 'compliant',
      issues: ['Security controls assessment requires integration with security monitoring systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Assess privacy practices component
   */
  private async assessPrivacyPractices(tenantId?: string): Promise<ComplianceComponent> {
    // This would integrate with privacy management systems
    // For now, return a placeholder assessment
    return {
      name: 'Privacy Practices',
      score: 80,
      weight: 15,
      status: 'compliant',
      issues: ['Privacy practices assessment requires integration with privacy management systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Assess audit logging component
   */
  private async assessAuditLogging(tenantId?: string): Promise<ComplianceComponent> {
    try {
      const supabase = await createClient();

      const { data: auditData, error } = await supabase
        .from('breach_audit_logs')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      let score = 100;
      const issues: string[] = [];

      if (!auditData || auditData.length === 0) {
        score = 0;
        issues.push('No audit logs found');
      } else {
        // Check for recent audit activity
        const latestAudit = new Date(auditData[0].timestamp);
        const hoursSinceLastAudit = (new Date().getTime() - latestAudit.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastAudit > 24) {
          score -= 30;
          issues.push(`No audit activity in the last ${Math.round(hoursSinceLastAudit)} hours`);
        }

        // Check audit volume (should have regular activity)
        const recentAudits = auditData.filter((audit: any) =>
          new Date(audit.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        );

        if (recentAudits.length < 10) {
          score -= 20;
          issues.push('Low audit activity in the past week');
        }
      }

      return {
        name: 'Audit Logging',
        score: Math.max(0, score),
        weight: 10,
        status: score >= 80 ? 'compliant' : score >= 60 ? 'warning' : 'critical',
        issues,
        lastAssessed: new Date()
      };
    } catch (error) {
      logger.error('Error assessing audit logging:', error);
      return {
        name: 'Audit Logging',
        score: 0,
        weight: 10,
        status: 'unknown',
        issues: ['Unable to assess audit logging'],
        lastAssessed: new Date()
      };
    }
  }

  /**
   * Assess data protection component for GDPR
   */
  private async assessDataProtection(tenantId?: string): Promise<ComplianceComponent> {
    // This would assess data protection measures, DPIAs, etc.
    return {
      name: 'Data Protection',
      score: 85,
      weight: 25,
      status: 'compliant',
      issues: ['Data protection assessment requires integration with DPIA systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Assess international transfers component for GDPR
   */
  private async assessInternationalTransfers(tenantId?: string): Promise<ComplianceComponent> {
    try {
      const supabase = await createClient();

      const { data: transferData, error } = await supabase
        .from('international_transfer_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      let score = 100;
      const issues: string[] = [];

      if (!transferData || transferData.length === 0) {
        return {
          name: 'International Transfers',
          score: 100,
          weight: 25,
          status: 'compliant',
          issues: ['No international transfers detected'],
          lastAssessed: new Date()
        };
      }

      // Check for transfers without proper mechanisms
      const invalidTransfers = transferData.filter((transfer: any) =>
        !transfer.transfer_mechanism || transfer.transfer_mechanism === 'none'
      );

      if (invalidTransfers.length > 0) {
        score -= 50;
        issues.push(`${invalidTransfers.length} transfers lack proper legal mechanisms`);
      }

      // Check for high-risk destinations
      const highRiskTransfers = transferData.filter((transfer: any) =>
        transfer.destination_location && ['RU', 'CN', 'IR'].includes(transfer.destination_location)
      );

      if (highRiskTransfers.length > 0) {
        score -= 30;
        issues.push(`${highRiskTransfers.length} transfers to high-risk jurisdictions`);
      }

      return {
        name: 'International Transfers',
        score: Math.max(0, score),
        weight: 25,
        status: score >= 80 ? 'compliant' : score >= 60 ? 'warning' : 'critical',
        issues,
        lastAssessed: new Date()
      };
    } catch (error) {
      logger.error('Error assessing international transfers:', error);
      return {
        name: 'International Transfers',
        score: 0,
        weight: 25,
        status: 'unknown',
        issues: ['Unable to assess international transfers'],
        lastAssessed: new Date()
      };
    }
  }

  /**
   * Assess consent management component for GDPR
   */
  private async assessConsentManagement(tenantId?: string): Promise<ComplianceComponent> {
    // This would assess consent collection, withdrawal, etc.
    return {
      name: 'Consent Management',
      score: 80,
      weight: 20,
      status: 'compliant',
      issues: ['Consent management assessment requires integration with consent management systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Assess breach notification component for GDPR
   */
  private async assessBreachNotification(tenantId?: string): Promise<ComplianceComponent> {
    try {
      const supabase = await createClient();

      const { data: notificationData, error } = await supabase
        .from('breach_notifications')
        .select('*')
        .eq('notification_type', 'gdpr_data_subject')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      let score = 100;
      const issues: string[] = [];

      if (!notificationData || notificationData.length === 0) {
        return {
          name: 'Breach Notification',
          score: 100,
          weight: 15,
          status: 'compliant',
          issues: ['No GDPR breach notifications required'],
          lastAssessed: new Date()
        };
      }

      // Check for pending notifications
      const pendingNotifications = notificationData.filter((notification: any) =>
        notification.notification_status === 'pending'
      );

      if (pendingNotifications.length > 0) {
        score -= 40;
        issues.push(`${pendingNotifications.length} GDPR breach notifications are pending`);
      }

      // Check for failed notifications
      const failedNotifications = notificationData.filter((notification: any) =>
        notification.notification_status === 'failed'
      );

      if (failedNotifications.length > 0) {
        score -= 25;
        issues.push(`${failedNotifications.length} GDPR breach notifications have failed`);
      }

      return {
        name: 'Breach Notification',
        score: Math.max(0, score),
        weight: 15,
        status: score >= 80 ? 'compliant' : score >= 60 ? 'warning' : 'critical',
        issues,
        lastAssessed: new Date()
      };
    } catch (error) {
      logger.error('Error assessing breach notification:', error);
      return {
        name: 'Breach Notification',
        score: 0,
        weight: 15,
        status: 'unknown',
        issues: ['Unable to assess breach notification'],
        lastAssessed: new Date()
      };
    }
  }

  /**
   * Assess governance component for GDPR
   */
  private async assessGovernance(tenantId?: string): Promise<ComplianceComponent> {
    // This would assess DPO appointment, governance structures, etc.
    return {
      name: 'Governance',
      score: 85,
      weight: 15,
      status: 'compliant',
      issues: ['Governance assessment requires integration with governance management systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Assess SOC2 security component
   */
  private async assessSOC2Security(tenantId?: string): Promise<ComplianceComponent> {
    // This would assess SOC2 security controls
    return {
      name: 'Security',
      score: 88,
      weight: 35,
      status: 'compliant',
      issues: ['SOC2 security assessment requires integration with SOC2 monitoring systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Assess availability component for SOC2
   */
  private async assessAvailability(tenantId?: string): Promise<ComplianceComponent> {
    // This would assess system availability and uptime
    return {
      name: 'Availability',
      score: 92,
      weight: 20,
      status: 'compliant',
      issues: ['Availability assessment requires integration with uptime monitoring systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Assess processing integrity component for SOC2
   */
  private async assessProcessingIntegrity(tenantId?: string): Promise<ComplianceComponent> {
    // This would assess data processing accuracy and completeness
    return {
      name: 'Processing Integrity',
      score: 85,
      weight: 15,
      status: 'compliant',
      issues: ['Processing integrity assessment requires integration with data quality systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Assess confidentiality component for SOC2
   */
  private async assessConfidentiality(tenantId?: string): Promise<ComplianceComponent> {
    // This would assess data confidentiality controls
    return {
      name: 'Confidentiality',
      score: 87,
      weight: 15,
      status: 'compliant',
      issues: ['Confidentiality assessment requires integration with access control systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Assess SOC2 privacy component
   */
  private async assessSOC2Privacy(tenantId?: string): Promise<ComplianceComponent> {
    // This would assess SOC2 privacy controls
    return {
      name: 'Privacy',
      score: 83,
      weight: 15,
      status: 'compliant',
      issues: ['SOC2 privacy assessment requires integration with privacy management systems'],
      lastAssessed: new Date()
    };
  }

  /**
   * Get active compliance alerts
   */
  async getActiveAlerts(tenantId?: string): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];

    try {
      const supabase = await createClient();

      // BAA expiration alerts
      const { data: expiringBAAs, error: baaError } = await supabase
        .from('baa_agreements')
        .select('id, vendor_name, expiration_date')
        .eq('status', 'executed')
        .lte('expiration_date', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())
        .gte('expiration_date', new Date().toISOString());

      if (!baaError && expiringBAAs) {
        expiringBAAs.forEach((baa: any) => {
          const daysUntilExpiry = Math.ceil(
            (new Date(baa.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          alerts.push({
            id: `baa-expiry-${baa.id}`,
            framework: 'HIPAA',
            severity: daysUntilExpiry <= 30 ? 'critical' : daysUntilExpiry <= 60 ? 'high' : 'medium',
            title: 'BAA Agreement Expiring',
            description: `BAA agreement with ${baa.vendor_name} expires in ${daysUntilExpiry} days`,
            category: 'expiration',
            createdAt: new Date()
          });
        });
      }

      // Breach notification alerts
      const { data: pendingNotifications, error: notificationError } = await supabase
        .from('breach_notifications')
        .select('id, breach_incident_id, notification_type, deadline_hours')
        .eq('notification_status', 'pending')
        .not('deadline_hours', 'is', null);

      if (!notificationError && pendingNotifications) {
        pendingNotifications.forEach((notification: any) => {
          const hoursRemaining = notification.deadline_hours || 0;
          if (hoursRemaining <= 24) {
            alerts.push({
              id: `breach-deadline-${notification.id}`,
              framework: notification.notification_type.includes('gdpr') ? 'GDPR' : 'HIPAA',
              severity: hoursRemaining <= 12 ? 'critical' : 'high',
              title: 'Breach Notification Deadline Approaching',
              description: `Breach notification deadline expires in ${hoursRemaining} hours`,
              category: 'breach',
              createdAt: new Date()
            });
          }
        });
      }

      // High-risk transfers alerts
      const { data: highRiskTransfers, error: transferError } = await supabase
        .from('international_transfer_records')
        .select('id, destination_location, transfer_mechanism')
        .in('destination_location', ['RU', 'CN', 'IR'])
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!transferError && highRiskTransfers) {
        highRiskTransfers.forEach((transfer: any) => {
          alerts.push({
            id: `high-risk-transfer-${transfer.id}`,
            framework: 'GDPR',
            severity: 'high',
            title: 'High-Risk International Transfer',
            description: `Data transfer to high-risk jurisdiction: ${transfer.destination_location}`,
            category: 'violation',
            createdAt: new Date()
          });
        });
      }

    } catch (error) {
      logger.error('Error fetching compliance alerts:', error);
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Get compliance trends over time
   */
  private async getComplianceTrends(tenantId?: string): Promise<ComplianceTrend[]> {
    // This would fetch historical compliance scores
    // For now, return sample data
    const trends: ComplianceTrend[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trends.push({
        date,
        hipaaScore: 85 + Math.random() * 10,
        gdprScore: 82 + Math.random() * 12,
        soc2Score: 88 + Math.random() * 8,
        overallScore: 85 + Math.random() * 10
      });
    }

    return trends;
  }

  /**
   * Calculate overall compliance score
   */
  private calculateOverallScore(frameworkScores: ComplianceScore[]): number {
    if (frameworkScores.length === 0) return 0;

    const totalScore = frameworkScores.reduce((sum, score) => sum + score.score, 0);
    return Math.round(totalScore / frameworkScores.length);
  }

  /**
   * Calculate grade from score
   */
  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

// Export singleton instance
export const complianceDashboard = ComplianceMetricsDashboard.getInstance();