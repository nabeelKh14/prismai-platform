/**
 * HIPAA Breach Notification Workflow
 * Implements HIPAA-specific breach notification procedures for PHI breaches
 * Handles 60-day individual notification timeline and HHS OCR reporting requirements
 */

import { createClient } from '@supabase/supabase-js';
import { breachNotificationWorkflowEngine } from './breach-notification';
import { breachAssessmentEngine } from './breach-assessment';
import { notificationTemplateEngine } from './notification-templates';

// Types for HIPAA breach workflow
export interface HIPAABreachWorkflow {
  id: string;
  breach_incident_id: string;
  status: 'initiated' | 'risk_assessment' | 'breach_analysis' | 'notification_decision' | 'individuals_notified' | 'hhs_notified' | 'completed' | 'no_notification_required';
  priority: 'low' | 'medium' | 'high' | 'critical';
  detection_timestamp: Date;
  deadline_60d: Date;
  time_remaining_days: number;
  phi_involved: boolean;
  unsecured_phi: boolean;
  number_affected: number;
  breach_harm_assessment: BreachHarmAssessment;
  notification_decision: NotificationDecision;
  notifications_sent: string[];
  hhs_submitted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BreachHarmAssessment {
  id: string;
  likelihood_of_compromise: 'low' | 'medium' | 'high';
  potential_for_harm: 'low' | 'medium' | 'high';
  mitigation_factors: string[];
  overall_risk_level: 'low' | 'medium' | 'high';
  notification_required: boolean;
  rationale: string;
  assessed_by: string;
  assessed_at: Date;
}

export interface NotificationDecision {
  id: string;
  decision_type: 'notify_individuals' | 'notify_hhs' | 'notify_media' | 'no_notification';
  decision_date: Date;
  decision_rationale: string;
  decided_by: string;
  approved_by?: string;
  approval_date?: Date;
  notification_timeline_days: number;
  special_considerations?: string;
}

export interface HIPAAContact {
  id: string;
  organization_name: string;
  contact_type: 'privacy_officer' | 'hhs_ocr' | 'state_authority' | 'media_contact';
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  address?: string;
  fax?: string;
  preferred_contact_method: 'email' | 'phone' | 'fax' | 'mail';
  is_primary: boolean;
  jurisdiction?: string; // For state authorities
}

// Main HIPAA breach workflow engine
export class HIPAABreachWorkflowEngine {
  private supabase: any;
  private activeWorkflows: Map<string, HIPAABreachWorkflow> = new Map();
  private readonly NOTIFICATION_DEADLINE_DAYS = 60;
  private readonly HHS_THRESHOLD = 500; // Individuals affected threshold for HHS notification

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeWorkflows();
    this.startWorkflowMonitor();
  }

  /**
   * Initialize existing workflows from database
   */
  private async initializeWorkflows(): Promise<void> {
    try {
      const { data: workflows, error } = await this.supabase
        .from('breach_hipaa_workflows')
        .select('*')
        .in('status', ['initiated', 'risk_assessment', 'breach_analysis', 'notification_decision']);

      if (error) throw error;

      for (const workflow of workflows || []) {
        this.activeWorkflows.set(workflow.id, workflow as HIPAABreachWorkflow);
      }

      console.log(`Initialized ${this.activeWorkflows.size} HIPAA breach workflows`);
    } catch (error) {
      console.error('Failed to initialize HIPAA breach workflows:', error);
    }
  }

  /**
   * Create and start a new HIPAA breach workflow
   */
  async createHIPAABreachWorkflow(breachIncidentId: string): Promise<HIPAABreachWorkflow> {
    console.log(`Creating HIPAA breach workflow for incident ${breachIncidentId}`);

    // Get breach incident details
    const incident = await this.getBreachIncident(breachIncidentId);
    if (!incident) {
      throw new Error(`Breach incident ${breachIncidentId} not found`);
    }

    // Check if HIPAA is applicable
    if (!incident.hipaa_applicable) {
      throw new Error(`HIPAA not applicable for incident ${breachIncidentId}`);
    }

    // Calculate 60-day deadline
    const deadline60d = new Date(incident.detected_at.getTime() + (this.NOTIFICATION_DEADLINE_DAYS * 24 * 60 * 60 * 1000));
    const now = new Date();
    const timeRemainingDays = Math.max(0, (deadline60d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Determine priority based on number affected
    const priority = incident.estimated_records_affected >= this.HHS_THRESHOLD ? 'critical' : 'high';

    // Create workflow
    const workflow: Omit<HIPAABreachWorkflow, 'id' | 'created_at' | 'updated_at'> = {
      breach_incident_id: breachIncidentId,
      status: 'initiated',
      priority: priority,
      detection_timestamp: incident.detected_at,
      deadline_60d: deadline60d,
      time_remaining_days: timeRemainingDays,
      phi_involved: incident.affected_data_types.includes('phi') || incident.affected_data_types.includes('protected_health_information'),
      unsecured_phi: true, // Default assumption - should be determined during assessment
      number_affected: incident.estimated_records_affected || 0,
      breach_harm_assessment: {
        id: `harm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        likelihood_of_compromise: 'medium',
        potential_for_harm: 'medium',
        mitigation_factors: [],
        overall_risk_level: 'medium',
        notification_required: true,
        rationale: 'Initial assessment - requires detailed analysis',
        assessed_by: 'system',
        assessed_at: new Date()
      },
      notification_decision: {
        id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        decision_type: 'notify_individuals',
        decision_date: new Date(),
        decision_rationale: 'Initial decision - subject to harm assessment',
        decided_by: 'system',
        notification_timeline_days: this.NOTIFICATION_DEADLINE_DAYS
      },
      notifications_sent: [],
      hhs_submitted: false
    };

    // Store workflow in database
    const { data, error } = await this.supabase
      .from('breach_hipaa_workflows')
      .insert([workflow])
      .select()
      .single();

    if (error) {
      console.error('Failed to create HIPAA breach workflow:', error);
      throw error;
    }

    const createdWorkflow = { ...workflow, id: data.id, created_at: data.created_at, updated_at: data.updated_at };

    // Cache workflow
    this.activeWorkflows.set(createdWorkflow.id, createdWorkflow);

    // Log workflow creation
    await this.logWorkflowEvent(createdWorkflow, 'created', 'system');

    // Start breach analysis process
    this.startBreachAnalysis(createdWorkflow);

    return createdWorkflow;
  }

  /**
   * Start the breach analysis process
   */
  private async startBreachAnalysis(workflow: HIPAABreachWorkflow): Promise<void> {
    try {
      console.log(`Starting breach analysis for HIPAA workflow ${workflow.id}`);

      // Get breach incident details
      const incident = await this.getBreachIncident(workflow.breach_incident_id);

      // Perform HIPAA-specific risk assessment
      const harmAssessment = await this.performHIPAABreachRiskAssessment(incident, workflow);

      // Update workflow with assessment results
      workflow.breach_harm_assessment = harmAssessment;
      workflow.status = 'breach_analysis';

      // Make notification decision based on assessment
      const notificationDecision = await this.makeNotificationDecision(workflow, harmAssessment);
      workflow.notification_decision = notificationDecision;

      // Update workflow status
      await this.updateWorkflowStatus(workflow.id, 'notification_decision');

      // Schedule notifications if required
      if (harmAssessment.notification_required) {
        await this.scheduleHIPAANotifications(workflow);
      } else {
        await this.updateWorkflowStatus(workflow.id, 'no_notification_required');
      }

      await this.updateWorkflow(workflow);

    } catch (error) {
      console.error(`Error starting breach analysis for workflow ${workflow.id}:`, error);
      await this.logWorkflowEvent(workflow, 'breach_analysis_failed', 'system');
    }
  }

  /**
   * Perform HIPAA breach risk assessment
   */
  private async performHIPAABreachRiskAssessment(
    incident: any,
    workflow: HIPAABreachWorkflow
  ): Promise<BreachHarmAssessment> {
    console.log(`Performing HIPAA breach risk assessment for incident ${incident.id}`);

    // Get detailed risk assessment
    const riskAssessment = await this.getLatestRiskAssessment(incident.id);

    // Analyze breach characteristics for HIPAA compliance
    const phiInvolved = workflow.phi_involved;
    const unsecuredPHI = workflow.unsecured_phi;
    const numberAffected = workflow.number_affected;

    // Assess likelihood of compromise
    let likelihoodOfCompromise: 'low' | 'medium' | 'high' = 'medium';

    if (incident.incident_type === 'unauthorized_access' || incident.incident_type === 'data_breach') {
      likelihoodOfCompromise = 'high';
    } else if (incident.incident_type === 'malware' || incident.incident_type === 'phishing') {
      likelihoodOfCompromise = 'medium';
    } else {
      likelihoodOfCompromise = 'low';
    }

    // Assess potential for harm
    let potentialForHarm: 'low' | 'medium' | 'high' = 'medium';

    if (phiInvolved && unsecuredPHI) {
      if (numberAffected > 1000) {
        potentialForHarm = 'high';
      } else if (numberAffected > 100) {
        potentialForHarm = 'medium';
      } else {
        potentialForHarm = 'low';
      }
    }

    // Determine overall risk level
    let overallRiskLevel: 'low' | 'medium' | 'high' = 'medium';
    let notificationRequired = true;

    if (likelihoodOfCompromise === 'low' && potentialForHarm === 'low') {
      overallRiskLevel = 'low';
      notificationRequired = false;
    } else if (likelihoodOfCompromise === 'high' || potentialForHarm === 'high') {
      overallRiskLevel = 'high';
      notificationRequired = true;
    } else {
      overallRiskLevel = 'medium';
      notificationRequired = true;
    }

    // Generate rationale
    const rationale = this.generateHIPAARiskRationale(
      likelihoodOfCompromise,
      potentialForHarm,
      overallRiskLevel,
      notificationRequired,
      incident,
      riskAssessment
    );

    return {
      id: `harm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      likelihood_of_compromise: likelihoodOfCompromise,
      potential_for_harm: potentialForHarm,
      mitigation_factors: this.identifyMitigationFactors(incident, riskAssessment),
      overall_risk_level: overallRiskLevel,
      notification_required: notificationRequired,
      rationale: rationale,
      assessed_by: 'hipaa-assessment-engine',
      assessed_at: new Date()
    };
  }

  /**
   * Make notification decision based on harm assessment
   */
  private async makeNotificationDecision(
    workflow: HIPAABreachWorkflow,
    harmAssessment: BreachHarmAssessment
  ): Promise<NotificationDecision> {
    const decisionType = harmAssessment.notification_required ?
      'notify_individuals' : 'no_notification';

    let notificationTimelineDays = this.NOTIFICATION_DEADLINE_DAYS;

    // Adjust timeline based on circumstances
    if (workflow.number_affected >= this.HHS_THRESHOLD) {
      notificationTimelineDays = 30; // Expedited timeline for large breaches
    }

    const rationale = harmAssessment.notification_required ?
      `Notification required due to ${harmAssessment.overall_risk_level} risk level. ` +
      `Likelihood of compromise: ${harmAssessment.likelihood_of_compromise}. ` +
      `Potential for harm: ${harmAssessment.potential_for_harm}.` :
      `No notification required due to ${harmAssessment.overall_risk_level} risk level. ` +
      `${harmAssessment.rationale}`;

    return {
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      decision_type: decisionType,
      decision_date: new Date(),
      decision_rationale: rationale,
      decided_by: 'hipaa-assessment-engine',
      notification_timeline_days: notificationTimelineDays
    };
  }

  /**
   * Schedule HIPAA notifications
   */
  private async scheduleHIPAANotifications(workflow: HIPAABreachWorkflow): Promise<void> {
    try {
      console.log(`Scheduling HIPAA notifications for workflow ${workflow.id}`);

      const incident = await this.getBreachIncident(workflow.breach_incident_id);

      // Schedule individual notifications
      const individualNotification = await this.prepareHIPAAIndividualNotification(incident, workflow);
      workflow.notifications_sent.push(individualNotification.id);

      // Schedule HHS notification if threshold met
      if (workflow.number_affected >= this.HHS_THRESHOLD) {
        const hhsNotification = await this.prepareHIPAAHHSNotification(incident, workflow);
        workflow.notifications_sent.push(hhsNotification.id);
        workflow.hhs_submitted = true;
      }

      // Schedule media notification for very large breaches (500+ affected)
      if (workflow.number_affected >= 500) {
        const mediaNotification = await this.prepareHIPAAMediaNotification(incident, workflow);
        workflow.notifications_sent.push(mediaNotification.id);
      }

      await this.updateWorkflow(workflow);

      // Send notifications
      await this.sendScheduledNotifications(workflow, [individualNotification]);

    } catch (error) {
      console.error(`Error scheduling HIPAA notifications for workflow ${workflow.id}:`, error);
      await this.logWorkflowEvent(workflow, 'notification_scheduling_failed', 'system');
    }
  }

  /**
   * Prepare HIPAA individual notification
   */
  private async prepareHIPAAIndividualNotification(
    incident: any,
    workflow: HIPAABreachWorkflow
  ): Promise<any> {
    const context = {
      breach_incident_id: incident.id,
      incident_id: incident.incident_id,
      organization_name: 'Healthcare Organization',
      detected_at: incident.detected_at,
      breach_type: incident.incident_type,
      affected_data_types: incident.affected_data_types,
      estimated_records_affected: workflow.number_affected,
      risk_level: workflow.breach_harm_assessment.overall_risk_level,
      mitigation_measures: workflow.breach_harm_assessment.mitigation_factors,
      contact_information: 'privacy.officer@healthcare.org',
      custom_fields: {
        breach_date: incident.detected_at.toISOString().split('T')[0],
        discovered_date: incident.detected_at.toISOString().split('T')[0],
        breach_description: incident.description,
        affected_phi_types: incident.affected_data_types.filter((type: string) =>
          type.includes('phi') || type.includes('health') || type.includes('medical')
        ),
        mitigation_steps: workflow.breach_harm_assessment.mitigation_factors,
        recommended_actions: [
          'Monitor your health information',
          'Review your medical records',
          'Contact your healthcare providers if you notice suspicious activity',
          'Consider placing a fraud alert on your credit reports'
        ],
        privacy_officer_contact: 'privacy.officer@healthcare.org',
        individuals_affected: workflow.number_affected
      }
    };

    // Get template and render notification
    const template = await notificationTemplateEngine.getTemplateForIncident(
      incident,
      'hipaa_individual'
    );

    if (!template) {
      throw new Error('HIPAA individual notification template not found');
    }

    const renderedNotification = await notificationTemplateEngine.renderNotification(template, context);

    return {
      id: `hipaa-individual-${incident.id}`,
      notification_type: 'hipaa_individual',
      recipient_type: 'individual',
      recipient_identifier: 'affected_individuals',
      recipient_contact_info: { email: 'patients@healthcare.org' },
      template_code: template.template_code,
      scheduled_send_at: new Date(),
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      delivery_method: 'mail', // HIPAA often requires physical mail for formal notifications
      priority: 'high',
      content: renderedNotification
    };
  }

  /**
   * Prepare HIPAA HHS notification
   */
  private async prepareHIPAAHHSNotification(
    incident: any,
    workflow: HIPAABreachWorkflow
  ): Promise<any> {
    const context = {
      breach_incident_id: incident.id,
      incident_id: incident.incident_id,
      organization_name: 'Healthcare Organization',
      detected_at: incident.detected_at,
      breach_type: incident.incident_type,
      affected_data_types: incident.affected_data_types,
      estimated_records_affected: workflow.number_affected,
      risk_level: workflow.breach_harm_assessment.overall_risk_level,
      mitigation_measures: workflow.breach_harm_assessment.mitigation_factors,
      contact_information: 'privacy.officer@healthcare.org',
      custom_fields: {
        organization_address: '123 Healthcare Ave, City, State 12345',
        contact_person: 'Privacy Officer',
        breach_date: incident.detected_at.toISOString().split('T')[0],
        discovered_date: incident.detected_at.toISOString().split('T')[0],
        individuals_affected: workflow.number_affected,
        breach_description: incident.description,
        affected_phi_types: incident.affected_data_types.filter((type: string) =>
          type.includes('phi') || type.includes('health') || type.includes('medical')
        ),
        safeguards: ['Encryption', 'Access controls', 'Audit logging'],
        mitigation_steps: workflow.breach_harm_assessment.mitigation_factors,
        submitted_by: 'Privacy Officer',
        submission_date: new Date().toISOString().split('T')[0]
      }
    };

    // Get template and render notification
    const template = await notificationTemplateEngine.getTemplateForIncident(
      incident,
      'hipaa_hhs_notification'
    );

    if (!template) {
      throw new Error('HIPAA HHS notification template not found');
    }

    const renderedNotification = await notificationTemplateEngine.renderNotification(template, context);

    return {
      id: `hipaa-hhs-${incident.id}`,
      notification_type: 'hipaa_hhs_notification',
      recipient_type: 'regulator',
      recipient_identifier: 'hhs_ocr',
      recipient_contact_info: { email: 'OCR@hhs.gov' },
      template_code: template.template_code,
      scheduled_send_at: new Date(),
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      delivery_method: 'email',
      priority: 'urgent',
      content: renderedNotification
    };
  }

  /**
   * Prepare HIPAA media notification
   */
  private async prepareHIPAAMediaNotification(
    incident: any,
    workflow: HIPAABreachWorkflow
  ): Promise<any> {
    // Media notification for breaches affecting 500+ individuals
    const context = {
      breach_incident_id: incident.id,
      incident_id: incident.incident_id,
      organization_name: 'Healthcare Organization',
      breach_date: incident.detected_at.toISOString().split('T')[0],
      discovered_date: incident.detected_at.toISOString().split('T')[0],
      individuals_affected: workflow.number_affected,
      breach_type: incident.incident_type,
      breach_description: incident.description,
      contact_information: 'privacy.officer@healthcare.org'
    };

    return {
      id: `hipaa-media-${incident.id}`,
      notification_type: 'hipaa_media_notification',
      recipient_type: 'media',
      recipient_identifier: 'media_outlets',
      recipient_contact_info: { email: 'press@healthcare.org' },
      template_code: 'hipaa_media_notification',
      scheduled_send_at: new Date(),
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      delivery_method: 'email',
      priority: 'high',
      content: context
    };
  }

  /**
   * Send scheduled notifications
   */
  private async sendScheduledNotifications(
    workflow: HIPAABreachWorkflow,
    notifications: any[]
  ): Promise<void> {
    try {
      for (const notification of notifications) {
        const result = await breachNotificationWorkflowEngine.sendNotification(notification);

        if (result.success) {
          await this.logWorkflowEvent(workflow, 'notification_sent', 'system');
        } else {
          await this.logWorkflowEvent(workflow, 'notification_failed', 'system');
        }
      }

      // Update workflow status
      if (workflow.hhs_submitted) {
        await this.updateWorkflowStatus(workflow.id, 'hhs_notified');
      } else {
        await this.updateWorkflowStatus(workflow.id, 'individuals_notified');
      }

    } catch (error) {
      console.error(`Error sending notifications for workflow ${workflow.id}:`, error);
      await this.logWorkflowEvent(workflow, 'notification_send_failed', 'system');
    }
  }

  /**
   * Helper methods
   */
  private async getBreachIncident(incidentId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('breach_incidents')
      .select('*')
      .eq('id', incidentId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getLatestRiskAssessment(incidentId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('breach_risk_assessments')
      .select('*')
      .eq('breach_incident_id', incidentId)
      .order('assessed_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  private async updateWorkflowStatus(workflowId: string, status: HIPAABreachWorkflow['status']): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    workflow.status = status;
    workflow.updated_at = new Date();

    await this.supabase
      .from('breach_hipaa_workflows')
      .update({
        status: status,
        updated_at: workflow.updated_at
      })
      .eq('id', workflowId);
  }

  private async updateWorkflow(workflow: HIPAABreachWorkflow): Promise<void> {
    workflow.updated_at = new Date();

    await this.supabase
      .from('breach_hipaa_workflows')
      .update({
        status: workflow.status,
        time_remaining_days: workflow.time_remaining_days,
        breach_harm_assessment: workflow.breach_harm_assessment,
        notification_decision: workflow.notification_decision,
        notifications_sent: workflow.notifications_sent,
        hhs_submitted: workflow.hhs_submitted,
        updated_at: workflow.updated_at
      })
      .eq('id', workflow.id);
  }

  private async logWorkflowEvent(workflow: HIPAABreachWorkflow, event: string, user: string): Promise<void> {
    await this.supabase
      .from('breach_audit_logs')
      .insert([{
        breach_incident_id: workflow.breach_incident_id,
        action: 'hipaa_workflow_event',
        user_identifier: user,
        changes: { workflow_event: event, workflow_id: workflow.id }
      }]);
  }

  private generateHIPAARiskRationale(
    likelihood: string,
    potential: string,
    overall: string,
    notificationRequired: boolean,
    incident: any,
    riskAssessment: any
  ): string {
    return `HIPAA breach risk assessment determined ${overall} risk level. ` +
           `Likelihood of compromise: ${likelihood}. Potential for harm: ${potential}. ` +
           `Breach type: ${incident.incident_type}. Affected records: ${incident.estimated_records_affected || 'unknown'}. ` +
           `PHI involved: ${incident.affected_data_types.includes('phi') ? 'Yes' : 'No'}. ` +
           `Notification ${notificationRequired ? 'required' : 'not required'} per 45 CFR § 164.404.`;
  }

  private identifyMitigationFactors(incident: any, riskAssessment: any): string[] {
    const factors = [
      'Incident reported to privacy officer',
      'Affected systems isolated',
      'Access credentials reset',
      'Enhanced monitoring implemented'
    ];

    if (incident.incident_type === 'unauthorized_access') {
      factors.push('Access logs reviewed and secured');
    }

    if (incident.incident_type === 'malware') {
      factors.push('Antivirus signatures updated');
      factors.push('Full system scan completed');
    }

    return factors;
  }

  /**
   * Workflow monitor - runs periodically
   */
  private startWorkflowMonitor(): void {
    setInterval(() => {
      this.monitorWorkflows();
    }, 300000); // Check every 5 minutes
  }

  private async monitorWorkflows(): Promise<void> {
    const now = new Date();

    for (const workflow of this.activeWorkflows.values()) {
      // Calculate time remaining
      const timeRemaining = (workflow.deadline_60d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      workflow.time_remaining_days = Math.max(0, timeRemaining);

      // Check if notifications are due
      if (workflow.status === 'notification_decision' && workflow.breach_harm_assessment.notification_required) {
        await this.scheduleHIPAANotifications(workflow);
      }

      // Update workflow
      await this.updateWorkflow(workflow);
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): HIPAABreachWorkflow | null {
    return this.activeWorkflows.get(workflowId) || null;
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows(): HIPAABreachWorkflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Complete a workflow
   */
  async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.updated_at = new Date();

    await this.supabase
      .from('breach_hipaa_workflows')
      .update({
        status: 'completed',
        updated_at: workflow.updated_at
      })
      .eq('id', workflowId);

    this.activeWorkflows.delete(workflowId);

    await this.logWorkflowEvent(workflow, 'completed', 'system');
  }
}

// Export singleton instance
export const hipaaBreachWorkflowEngine = new HIPAABreachWorkflowEngine(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);