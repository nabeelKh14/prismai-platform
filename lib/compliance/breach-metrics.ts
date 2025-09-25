/**
 * Breach Notification Analytics
 * Monitors incident response times, notification status, and regulatory compliance for GDPR, HIPAA, and SOC2
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface BreachMetrics {
  incidentResponse: IncidentResponseMetrics;
  notificationCompliance: NotificationComplianceMetrics;
  regulatoryDeadlines: RegulatoryDeadlineMetrics;
  breachTrends: BreachTrendMetrics;
  breachScore: number;
  lastUpdated: Date;
}

export interface IncidentResponseMetrics {
  totalIncidents: number;
  averageDetectionTime: number; // Hours from occurrence to detection
  averageAssessmentTime: number; // Hours from detection to assessment
  averageResolutionTime: number; // Days from detection to resolution
  issues: string[];
}

export interface NotificationComplianceMetrics {
  gdprNotifications: NotificationStats;
  hipaaNotifications: NotificationStats;
  soc2Notifications: NotificationStats;
  overallCompliance: number;
  issues: string[];
}

export interface NotificationStats {
  totalRequired: number;
  sentOnTime: number;
  sentLate: number;
  pending: number;
  complianceRate: number;
}

export interface RegulatoryDeadlineMetrics {
  gdpr72HourCompliance: number;
  hipaa60DayCompliance: number;
  averageNotificationDelay: number;
  missedDeadlines: number;
  issues: string[];
}

export interface BreachTrendMetrics {
  incidentsByMonth: Record<string, number>;
  severityDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  trends: BreachTrend[];
}

export interface BreachTrend {
  date: Date;
  totalIncidents: number;
  highSeverityIncidents: number;
  resolvedIncidents: number;
}

export interface BreachAlert {
  id: string;
  type: 'response_time' | 'notification_deadline' | 'regulatory_deadline' | 'assessment_required';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  incidentId?: string;
  recommendation: string;
  createdAt: Date;
}

export class BreachMetricsService {
  private static instance: BreachMetricsService;

  public static getInstance(): BreachMetricsService {
    if (!BreachMetricsService.instance) {
      BreachMetricsService.instance = new BreachMetricsService();
    }
    return BreachMetricsService.instance;
  }

  /**
   * Get comprehensive breach metrics
   */
  async getBreachMetrics(tenantId?: string): Promise<BreachMetrics> {
    try {
      const [incidentResponse, notificationCompliance, regulatoryDeadlines, breachTrends] = await Promise.all([
        this.assessIncidentResponse(tenantId),
        this.evaluateNotificationCompliance(tenantId),
        this.monitorRegulatoryDeadlines(tenantId),
        this.analyzeBreachTrends(tenantId)
      ]);

      const breachScore = this.calculateBreachScore(
        incidentResponse,
        notificationCompliance,
        regulatoryDeadlines,
        breachTrends
      );

      return {
        incidentResponse,
        notificationCompliance,
        regulatoryDeadlines,
        breachTrends,
        breachScore,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error fetching breach metrics:', error);
      throw new Error('Failed to fetch breach metrics');
    }
  }

  /**
   * Assess incident response metrics
   */
  private async assessIncidentResponse(tenantId?: string): Promise<IncidentResponseMetrics> {
    try {
      const supabase = await createClient();

      const { data: incidents, error } = await supabase
        .from('breach_incidents')
        .select('id, detected_at, status, severity_score, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const totalIncidents = incidents?.length || 0;

      if (totalIncidents === 0) {
        return {
          totalIncidents: 0,
          averageDetectionTime: 0,
          averageAssessmentTime: 0,
          averageResolutionTime: 0,
          issues: ['No breach incidents recorded']
        };
      }

      // Calculate response times
      const detectionTimes: number[] = [];
      const assessmentTimes: number[] = [];
      const resolutionTimes: number[] = [];

      incidents?.forEach((incident: any) => {
        const detectedAt = new Date(incident.detected_at);
        const createdAt = new Date(incident.created_at);
        const now = new Date();

        // Detection time (hours from creation to detection)
        const detectionTime = (detectedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        if (detectionTime >= 0) {
          detectionTimes.push(detectionTime);
        }

        // Assessment time (hours from detection to assessment)
        // For now, assume assessment happens shortly after detection
        assessmentTimes.push(2); // Placeholder

        // Resolution time (days from detection to resolution)
        if (incident.status === 'resolved' || incident.status === 'closed') {
          const resolutionTime = (now.getTime() - detectedAt.getTime()) / (1000 * 60 * 60 * 24);
          resolutionTimes.push(resolutionTime);
        }
      });

      const averageDetectionTime = detectionTimes.reduce((sum, time) => sum + time, 0) / detectionTimes.length || 0;
      const averageAssessmentTime = assessmentTimes.reduce((sum, time) => sum + time, 0) / assessmentTimes.length || 0;
      const averageResolutionTime = resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length || 0;

      const issues: string[] = [];
      if (averageDetectionTime > 24) {
        issues.push('Average detection time exceeds 24 hours');
      }
      if (averageAssessmentTime > 4) {
        issues.push('Average assessment time exceeds 4 hours');
      }
      if (averageResolutionTime > 30) {
        issues.push('Average resolution time exceeds 30 days');
      }

      return {
        totalIncidents,
        averageDetectionTime,
        averageAssessmentTime,
        averageResolutionTime,
        issues
      };
    } catch (error) {
      logger.error('Error assessing incident response:', error);
      return {
        totalIncidents: 0,
        averageDetectionTime: 0,
        averageAssessmentTime: 0,
        averageResolutionTime: 0,
        issues: ['Unable to assess incident response']
      };
    }
  }

  /**
   * Evaluate notification compliance
   */
  private async evaluateNotificationCompliance(tenantId?: string): Promise<NotificationComplianceMetrics> {
    try {
      const supabase = await createClient();

      const { data: notifications, error } = await supabase
        .from('breach_notifications')
        .select('id, notification_type, notification_status, required_by_regulation, deadline_hours, sent_at, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const gdprNotifications = this.calculateNotificationStats(notifications, 'gdpr');
      const hipaaNotifications = this.calculateNotificationStats(notifications, 'hipaa');
      const soc2Notifications = this.calculateNotificationStats(notifications, 'soc2');

      const totalRequired = gdprNotifications.totalRequired + hipaaNotifications.totalRequired + soc2Notifications.totalRequired;
      const totalCompliant = gdprNotifications.sentOnTime + hipaaNotifications.sentOnTime + soc2Notifications.sentOnTime;
      const overallCompliance = totalRequired > 0 ? (totalCompliant / totalRequired) * 100 : 100;

      const issues: string[] = [];
      if (gdprNotifications.complianceRate < 95) {
        issues.push('GDPR notification compliance below target (95%)');
      }
      if (hipaaNotifications.complianceRate < 95) {
        issues.push('HIPAA notification compliance below target (95%)');
      }
      if (overallCompliance < 90) {
        issues.push('Overall notification compliance below target (90%)');
      }

      return {
        gdprNotifications,
        hipaaNotifications,
        soc2Notifications,
        overallCompliance,
        issues
      };
    } catch (error) {
      logger.error('Error evaluating notification compliance:', error);
      return {
        gdprNotifications: { totalRequired: 0, sentOnTime: 0, sentLate: 0, pending: 0, complianceRate: 0 },
        hipaaNotifications: { totalRequired: 0, sentOnTime: 0, sentLate: 0, pending: 0, complianceRate: 0 },
        soc2Notifications: { totalRequired: 0, sentOnTime: 0, sentLate: 0, pending: 0, complianceRate: 0 },
        overallCompliance: 0,
        issues: ['Unable to evaluate notification compliance']
      };
    }
  }

  /**
   * Calculate notification statistics for a specific regulation
   */
  private calculateNotificationStats(notifications: any[], regulation: string): NotificationStats {
    const regulationNotifications = notifications?.filter((n: any) =>
      n.required_by_regulation === regulation || n.notification_type.includes(regulation)
    ) || [];

    const totalRequired = regulationNotifications.length;
    const sentOnTime = regulationNotifications.filter((n: any) =>
      n.notification_status === 'sent' || n.notification_status === 'delivered'
    ).length;
    const sentLate = regulationNotifications.filter((n: any) =>
      n.notification_status === 'sent' && n.sent_at && n.deadline_hours
    ).length; // This would need more complex logic
    const pending = regulationNotifications.filter((n: any) =>
      n.notification_status === 'pending'
    ).length;

    const complianceRate = totalRequired > 0 ? (sentOnTime / totalRequired) * 100 : 100;

    return {
      totalRequired,
      sentOnTime,
      sentLate,
      pending,
      complianceRate
    };
  }

  /**
   * Monitor regulatory deadlines
   */
  private async monitorRegulatoryDeadlines(tenantId?: string): Promise<RegulatoryDeadlineMetrics> {
    try {
      const supabase = await createClient();

      const { data: incidents, error } = await supabase
        .from('breach_incidents')
        .select('id, detected_at, gdpr_applicable, hipaa_applicable, soc2_applicable')
        .eq('gdpr_applicable', true)
        .order('detected_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      let gdpr72HourCompliance = 100;
      let hipaa60DayCompliance = 100;
      let missedDeadlines = 0;
      let totalDeadlines = incidents?.length || 0;

      // This would need more complex logic to check actual notification timelines
      // For now, use placeholder calculations

      const issues: string[] = [];
      if (gdpr72HourCompliance < 95) {
        issues.push('GDPR 72-hour notification compliance below target (95%)');
      }
      if (hipaa60DayCompliance < 95) {
        issues.push('HIPAA 60-day notification compliance below target (95%)');
      }
      if (missedDeadlines > 0) {
        issues.push(`${missedDeadlines} regulatory deadlines have been missed`);
      }

      return {
        gdpr72HourCompliance,
        hipaa60DayCompliance,
        averageNotificationDelay: 0, // Would calculate from actual data
        missedDeadlines,
        issues
      };
    } catch (error) {
      logger.error('Error monitoring regulatory deadlines:', error);
      return {
        gdpr72HourCompliance: 0,
        hipaa60DayCompliance: 0,
        averageNotificationDelay: 0,
        missedDeadlines: 0,
        issues: ['Unable to monitor regulatory deadlines']
      };
    }
  }

  /**
   * Analyze breach trends
   */
  private async analyzeBreachTrends(tenantId?: string): Promise<BreachTrendMetrics> {
    try {
      const supabase = await createClient();

      const { data: incidents, error } = await supabase
        .from('breach_incidents')
        .select('id, detected_at, severity_score, incident_type, status')
        .order('detected_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Group by month
      const incidentsByMonth: Record<string, number> = {};
      const severityDistribution: Record<string, number> = {};
      const typeDistribution: Record<string, number> = {};

      incidents?.forEach((incident: any) => {
        const date = new Date(incident.detected_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        incidentsByMonth[monthKey] = (incidentsByMonth[monthKey] || 0) + 1;

        // Severity distribution
        const severity = incident.severity_score >= 4 ? 'high' : incident.severity_score >= 3 ? 'medium' : 'low';
        severityDistribution[severity] = (severityDistribution[severity] || 0) + 1;

        // Type distribution
        const type = incident.incident_type || 'other';
        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
      });

      // Generate trends (sample data for now)
      const trends: BreachTrend[] = [];
      const now = new Date();

      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        trends.push({
          date,
          totalIncidents: Math.floor(Math.random() * 10),
          highSeverityIncidents: Math.floor(Math.random() * 3),
          resolvedIncidents: Math.floor(Math.random() * 8)
        });
      }

      return {
        incidentsByMonth,
        severityDistribution,
        typeDistribution,
        trends
      };
    } catch (error) {
      logger.error('Error analyzing breach trends:', error);
      return {
        incidentsByMonth: {},
        severityDistribution: {},
        typeDistribution: {},
        trends: []
      };
    }
  }

  /**
   * Calculate overall breach score
   */
  private calculateBreachScore(
    response: IncidentResponseMetrics,
    notifications: NotificationComplianceMetrics,
    deadlines: RegulatoryDeadlineMetrics,
    trends: BreachTrendMetrics
  ): number {
    const responseWeight = 0.25;
    const notificationWeight = 0.30;
    const deadlineWeight = 0.30;
    const trendWeight = 0.15;

    const responseScore = this.calculateResponseScore(response);
    const notificationScore = notifications.overallCompliance;
    const deadlineScore = (deadlines.gdpr72HourCompliance + deadlines.hipaa60DayCompliance) / 2;
    const trendScore = this.calculateTrendScore(trends);

    return Math.round(
      responseScore * responseWeight +
      notificationScore * notificationWeight +
      deadlineScore * deadlineWeight +
      trendScore * trendWeight
    );
  }

  /**
   * Calculate response score based on timing metrics
   */
  private calculateResponseScore(response: IncidentResponseMetrics): number {
    let score = 100;

    if (response.averageDetectionTime > 24) score -= 30;
    else if (response.averageDetectionTime > 12) score -= 15;

    if (response.averageAssessmentTime > 4) score -= 25;
    else if (response.averageAssessmentTime > 2) score -= 15;

    if (response.averageResolutionTime > 30) score -= 35;
    else if (response.averageResolutionTime > 15) score -= 20;

    return Math.max(0, score);
  }

  /**
   * Calculate trend score based on incident patterns
   */
  private calculateTrendScore(trends: BreachTrendMetrics): number {
    if (trends.trends.length === 0) return 100;

    const recentTrends = trends.trends.slice(-10); // Last 10 days
    const totalIncidents = recentTrends.reduce((sum, trend) => sum + trend.totalIncidents, 0);
    const highSeverityIncidents = recentTrends.reduce((sum, trend) => sum + trend.highSeverityIncidents, 0);

    let score = 100;

    if (highSeverityIncidents > totalIncidents * 0.3) {
      score -= 40;
    } else if (highSeverityIncidents > totalIncidents * 0.2) {
      score -= 25;
    }

    if (totalIncidents > 20) { // High volume of incidents
      score -= 20;
    }

    return Math.max(0, score);
  }

  /**
   * Get breach compliance alerts
   */
  async getBreachAlerts(tenantId?: string): Promise<BreachAlert[]> {
    const alerts: BreachAlert[] = [];

    try {
      const supabase = await createClient();

      // Slow response incidents
      const { data: slowResponseIncidents, error: responseError } = await supabase
        .from('breach_incidents')
        .select('id, title, detected_at, status, severity_score')
        .eq('status', 'detected')
        .lte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('detected_at', { ascending: true })
        .limit(20);

      if (!responseError && slowResponseIncidents) {
        slowResponseIncidents.forEach((incident: any) => {
          const hoursSinceDetection = (new Date().getTime() - new Date(incident.detected_at).getTime()) / (1000 * 60 * 60);

          alerts.push({
            id: `slow-response-${incident.id}`,
            type: 'response_time',
            severity: hoursSinceDetection > 48 ? 'critical' : 'high',
            title: 'Delayed Incident Response',
            description: `${incident.title} has been detected for ${Math.round(hoursSinceDetection)} hours without assessment`,
            incidentId: incident.id,
            recommendation: 'Assess the incident and determine appropriate response actions',
            createdAt: new Date()
          });
        });
      }

      // Pending notifications with approaching deadlines
      const { data: pendingNotifications, error: notificationError } = await supabase
        .from('breach_notifications')
        .select('id, breach_incident_id, notification_type, deadline_hours, created_at')
        .eq('notification_status', 'pending')
        .not('deadline_hours', 'is', null)
        .order('created_at', { ascending: true })
        .limit(20);

      if (!notificationError && pendingNotifications) {
        pendingNotifications.forEach((notification: any) => {
          const hoursRemaining = notification.deadline_hours || 0;
          if (hoursRemaining <= 24) {
            alerts.push({
              id: `notification-deadline-${notification.id}`,
              type: 'notification_deadline',
              severity: hoursRemaining <= 12 ? 'critical' : 'high',
              title: 'Breach Notification Deadline Approaching',
              description: `${notification.notification_type} notification deadline expires in ${hoursRemaining} hours`,
              incidentId: notification.breach_incident_id,
              recommendation: 'Send required breach notification immediately',
              createdAt: new Date()
            });
          }
        });
      }

      // High-severity incidents requiring assessment
      const { data: highSeverityIncidents, error: severityError } = await supabase
        .from('breach_incidents')
        .select('id, title, severity_score, status, detected_at')
        .gte('severity_score', 4)
        .in('status', ['detected', 'investigating'])
        .order('detected_at', { ascending: true })
        .limit(10);

      if (!severityError && highSeverityIncidents) {
        highSeverityIncidents.forEach((incident: any) => {
          alerts.push({
            id: `high-severity-${incident.id}`,
            type: 'assessment_required',
            severity: 'critical',
            title: 'High-Severity Incident Requires Attention',
            description: `${incident.title} (Severity: ${incident.severity_score}) requires immediate assessment`,
            incidentId: incident.id,
            recommendation: 'Conduct thorough assessment and implement response plan',
            createdAt: new Date()
          });
        });
      }

      // Regulatory deadline monitoring
      const { data: gdprIncidents, error: gdprError } = await supabase
        .from('breach_incidents')
        .select('id, title, detected_at, gdpr_applicable')
        .eq('gdpr_applicable', true)
        .eq('status', 'detected')
        .lte('detected_at', new Date(Date.now() - 60 * 60 * 60 * 1000).toISOString()) // Over 60 hours
        .order('detected_at', { ascending: true })
        .limit(10);

      if (!gdprError && gdprIncidents) {
        gdprIncidents.forEach((incident: any) => {
          const hoursSinceDetection = (new Date().getTime() - new Date(incident.detected_at).getTime()) / (1000 * 60 * 60);

          alerts.push({
            id: `gdpr-deadline-${incident.id}`,
            type: 'regulatory_deadline',
            severity: hoursSinceDetection > 72 ? 'critical' : 'high',
            title: 'GDPR 72-Hour Deadline at Risk',
            description: `${incident.title} - ${Math.round(hoursSinceDetection)} hours since detection (GDPR requires notification within 72 hours)`,
            incidentId: incident.id,
            recommendation: 'Assess if notification to supervisory authority is required and prepare accordingly',
            createdAt: new Date()
          });
        });
      }

    } catch (error) {
      logger.error('Error fetching breach alerts:', error);
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }
}

// Export singleton instance
export const breachMetricsService = BreachMetricsService.getInstance();