/**
 * GDPR 72-Hour Notification Workflow
 * Implements automated workflows to ensure GDPR 72-hour notification compliance
 * Includes automatic escalation and deadline management
 */

import { createClient } from '@supabase/supabase-js';
import { breachNotificationWorkflowEngine } from './breach-notification';
import { breachAssessmentEngine } from './breach-assessment';
import { notificationTemplateEngine } from './notification-templates';

// Types for GDPR 72-hour workflow
export interface GDPR72HourWorkflow {
  id: string;
  breach_incident_id: string;
  status: 'initiated' | 'assessment' | 'notification_prepared' | 'supervisory_notified' | 'individuals_notified' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  detection_timestamp: Date;
  deadline_72h: Date;
  time_remaining_hours: number;
  escalation_level: number;
  notifications_sent: string[];
  escalation_triggers: EscalationTrigger[];
  created_at: Date;
  updated_at: Date;
}

export interface EscalationTrigger {
  id: string;
  trigger_type: 'time_remaining' | 'assessment_complete' | 'manual_escalation' | 'system_alert';
  trigger_time: Date;
  escalation_level: number;
  description: string;
  action_taken?: string;
  resolved: boolean;
  resolved_at?: Date;
}

export interface GDPRNotificationContext {
  breach_incident_id: string;
  incident_id: string;
  organization_name: string;
  supervisory_authority: string;
  data_protection_officer: string;
  detected_at: Date;
  breach_type: string;
  affected_data_types: string[];
  estimated_records_affected?: number;
  risk_level: string;
  mitigation_measures: string[];
  contact_information: string;
  assessment_summary: string;
  legal_basis: string;
  cross_border_transfers: boolean;
  international_organization: boolean;
}

// Main GDPR 72-hour workflow engine
export class GDPR72HourWorkflowEngine {
  private supabase: any;
  private activeWorkflows: Map<string, GDPR72HourWorkflow> = new Map();
  private readonly ESCALATION_INTERVALS = [48, 24, 12, 6, 3, 1]; // Hours before deadline
  private readonly MAX_ESCALATION_LEVEL = 5;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeWorkflows();
    this.startWorkflowMonitor();
    this.startEscalationMonitor();
  }

  /**
   * Initialize existing workflows from database
   */
  private async initializeWorkflows(): Promise<void> {
    try {
      const { data: workflows, error } = await this.supabase
        .from('breach_gdpr_72h_workflows')
        .select('*')
        .in('status', ['initiated', 'assessment', 'notification_prepared']);

      if (error) throw error;

      for (const workflow of workflows || []) {
        this.activeWorkflows.set(workflow.id, workflow as GDPR72HourWorkflow);
        this.scheduleEscalationChecks(workflow);
      }

      console.log(`Initialized ${this.activeWorkflows.size} GDPR 72-hour workflows`);
    } catch (error) {
      console.error('Failed to initialize GDPR 72-hour workflows:', error);
    }
  }

  /**
   * Create and start a new GDPR 72-hour workflow
   */
  async createGDPR72HourWorkflow(breachIncidentId: string): Promise<GDPR72HourWorkflow> {
    console.log(`Creating GDPR 72-hour workflow for incident ${breachIncidentId}`);

    // Get breach incident details
    const incident = await this.getBreachIncident(breachIncidentId);
    if (!incident) {
      throw new Error(`Breach incident ${breachIncidentId} not found`);
    }

    // Check if GDPR is applicable
    if (!incident.gdpr_applicable) {
      throw new Error(`GDPR not applicable for incident ${breachIncidentId}`);
    }

    // Calculate 72-hour deadline
    const deadline72h = new Date(incident.detected_at.getTime() + (72 * 60 * 60 * 1000));
    const now = new Date();
    const timeRemainingHours = Math.max(0, (deadline72h.getTime() - now.getTime()) / (1000 * 60 * 60));

    // Determine priority based on risk level
    const riskAssessment = await this.getLatestRiskAssessment(breachIncidentId);
    const priority = riskAssessment?.risk_level === 'critical' ? 'critical' :
                    riskAssessment?.risk_level === 'high' ? 'high' : 'medium';

    // Create workflow
    const workflow: Omit<GDPR72HourWorkflow, 'id' | 'created_at' | 'updated_at'> = {
      breach_incident_id: breachIncidentId,
      status: 'initiated',
      priority: priority,
      detection_timestamp: incident.detected_at,
      deadline_72h: deadline72h,
      time_remaining_hours: timeRemainingHours,
      escalation_level: 0,
      notifications_sent: [],
      escalation_triggers: []
    };

    // Store workflow in database
    const { data, error } = await this.supabase
      .from('breach_gdpr_72h_workflows')
      .insert([workflow])
      .select()
      .single();

    if (error) {
      console.error('Failed to create GDPR 72-hour workflow:', error);
      throw error;
    }

    const createdWorkflow = { ...workflow, id: data.id, created_at: data.created_at, updated_at: data.updated_at };

    // Cache workflow
    this.activeWorkflows.set(createdWorkflow.id, createdWorkflow);

    // Log workflow creation
    await this.logWorkflowEvent(createdWorkflow, 'created', 'system');

    // Schedule initial escalation checks
    this.scheduleEscalationChecks(createdWorkflow);

    // Start assessment process
    this.startAssessmentProcess(createdWorkflow);

    return createdWorkflow;
  }

  /**
   * Start the assessment process for the workflow
   */
  private async startAssessmentProcess(workflow: GDPR72HourWorkflow): Promise<void> {
    try {
      console.log(`Starting assessment process for GDPR workflow ${workflow.id}`);

      // Get or create risk assessment
      const riskAssessment = await this.getLatestRiskAssessment(workflow.breach_incident_id);

      if (!riskAssessment) {
        // Trigger initial assessment
        await breachAssessmentEngine.performInitialAssessment(
          await this.getBreachIncident(workflow.breach_incident_id)
        );
      }

      // Update workflow status
      await this.updateWorkflowStatus(workflow.id, 'assessment');

      // Schedule notification preparation
      setTimeout(() => {
        this.prepareNotifications(workflow);
      }, 5000); // Small delay to allow assessment to complete

    } catch (error) {
      console.error(`Error starting assessment process for workflow ${workflow.id}:`, error);
      await this.logWorkflowEvent(workflow, 'assessment_failed', 'system');
    }
  }

  /**
   * Prepare notifications for the workflow
   */
  private async prepareNotifications(workflow: GDPR72HourWorkflow): Promise<void> {
    try {
      console.log(`Preparing notifications for GDPR workflow ${workflow.id}`);

      const incident = await this.getBreachIncident(workflow.breach_incident_id);
      const riskAssessment = await this.getLatestRiskAssessment(workflow.breach_incident_id);

      if (!riskAssessment) {
        throw new Error('Risk assessment required for notification preparation');
      }

      // Prepare supervisory authority notification
      const supervisoryNotification = await this.prepareSupervisoryAuthorityNotification(
        incident,
        riskAssessment
      );

      // Prepare individual notifications if high risk
      const individualNotifications = await this.prepareIndividualNotifications(
        incident,
        riskAssessment
      );

      // Update workflow status
      await this.updateWorkflowStatus(workflow.id, 'notification_prepared');

      // Send notifications immediately for high-priority cases
      if (workflow.priority === 'critical' || workflow.priority === 'high') {
        await this.sendNotifications(workflow, [supervisoryNotification, ...individualNotifications]);
      }

    } catch (error) {
      console.error(`Error preparing notifications for workflow ${workflow.id}:`, error);
      await this.logWorkflowEvent(workflow, 'notification_preparation_failed', 'system');
    }
  }

  /**
   * Send prepared notifications
   */
  private async sendNotifications(
    workflow: GDPR72HourWorkflow,
    notifications: any[]
  ): Promise<void> {
    try {
      console.log(`Sending notifications for GDPR workflow ${workflow.id}`);

      for (const notification of notifications) {
        // Use the breach notification workflow engine to send
        const result = await breachNotificationWorkflowEngine.sendNotification(notification);

        if (result.success) {
          workflow.notifications_sent.push(notification.id);
          await this.logWorkflowEvent(workflow, 'notification_sent', 'system');
        } else {
          await this.logWorkflowEvent(workflow, 'notification_failed', 'system');
        }
      }

      // Update workflow status
      if (workflow.notifications_sent.length > 0) {
        await this.updateWorkflowStatus(workflow.id, 'supervisory_notified');
      }

    } catch (error) {
      console.error(`Error sending notifications for workflow ${workflow.id}:`, error);
      await this.logWorkflowEvent(workflow, 'notification_send_failed', 'system');
    }
  }

  /**
   * Handle escalation triggers
   */
  private async handleEscalation(workflow: GDPR72HourWorkflow, trigger: EscalationTrigger): Promise<void> {
    try {
      console.log(`Handling escalation level ${trigger.escalation_level} for workflow ${workflow.id}`);

      // Escalate to next level
      workflow.escalation_level = trigger.escalation_level;

      // Log escalation
      await this.logWorkflowEvent(workflow, `escalation_level_${trigger.escalation_level}`, 'system');

      // Take escalation actions based on level
      switch (trigger.escalation_level) {
        case 1:
          // Level 1: Notify DPO and legal team
          await this.notifyInternalStakeholders(workflow, 'dpo_legal_notification');
          break;
        case 2:
          // Level 2: Notify executive team
          await this.notifyInternalStakeholders(workflow, 'executive_escalation');
          break;
        case 3:
          // Level 3: Prepare emergency notification
          await this.prepareEmergencyNotification(workflow);
          break;
        case 4:
          // Level 4: Activate emergency response team
          await this.activateEmergencyResponse(workflow);
          break;
        case 5:
          // Level 5: Final escalation - mark as overdue
          await this.markWorkflowOverdue(workflow);
          break;
      }

      // Update workflow
      await this.updateWorkflow(workflow);

    } catch (error) {
      console.error(`Error handling escalation for workflow ${workflow.id}:`, error);
    }
  }

  /**
   * Monitor workflows and trigger escalations
   */
  private async monitorWorkflows(): Promise<void> {
    const now = new Date();

    for (const workflow of this.activeWorkflows.values()) {
      // Calculate time remaining
      const timeRemaining = (workflow.deadline_72h.getTime() - now.getTime()) / (1000 * 60 * 60);
      workflow.time_remaining_hours = Math.max(0, timeRemaining);

      // Check if escalation is needed
      const nextEscalationLevel = this.getNextEscalationLevel(workflow);

      if (nextEscalationLevel > workflow.escalation_level) {
        const trigger: EscalationTrigger = {
          id: `esc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          trigger_type: 'time_remaining',
          trigger_time: now,
          escalation_level: nextEscalationLevel,
          description: `Time remaining: ${timeRemaining.toFixed(1)} hours`,
          resolved: false
        };

        workflow.escalation_triggers.push(trigger);
        await this.handleEscalation(workflow, trigger);
      }

      // Check if workflow is overdue
      if (timeRemaining <= 0 && workflow.status !== 'overdue' && workflow.status !== 'completed') {
        await this.markWorkflowOverdue(workflow);
      }

      // Update workflow
      await this.updateWorkflow(workflow);
    }
  }

  /**
   * Get next escalation level based on time remaining
   */
  private getNextEscalationLevel(workflow: GDPR72HourWorkflow): number {
    const timeRemaining = workflow.time_remaining_hours;

    for (let i = 0; i < this.ESCALATION_INTERVALS.length; i++) {
      if (timeRemaining <= this.ESCALATION_INTERVALS[i]) {
        return i + 1;
      }
    }

    return 0; // No escalation needed
  }

  /**
   * Prepare supervisory authority notification
   */
  private async prepareSupervisoryAuthorityNotification(
    incident: any,
    riskAssessment: any
  ): Promise<any> {
    const context: GDPRNotificationContext = {
      breach_incident_id: incident.id,
      incident_id: incident.incident_id,
      organization_name: 'Organization Name', // Should come from config
      supervisory_authority: 'Data Protection Authority',
      data_protection_officer: 'DPO Name',
      detected_at: incident.detected_at,
      breach_type: incident.incident_type,
      affected_data_types: incident.affected_data_types,
      estimated_records_affected: incident.estimated_records_affected,
      risk_level: riskAssessment.risk_level,
      mitigation_measures: riskAssessment.mitigation_measures,
      contact_information: 'privacy@company.com',
      assessment_summary: riskAssessment.assessment_notes,
      legal_basis: 'Legitimate interest and consent',
      cross_border_transfers: false,
      international_organization: false
    };

    // Get template and render notification
    const template = await notificationTemplateEngine.getTemplateForIncident(
      incident,
      'gdpr_supervisory_authority'
    );

    if (!template) {
      throw new Error('GDPR supervisory authority template not found');
    }

    const renderedNotification = await notificationTemplateEngine.renderNotification(template, context);

    return {
      id: `gdpr-supervisory-${incident.id}`,
      notification_type: 'gdpr_supervisory_authority',
      recipient_type: 'regulator',
      recipient_identifier: 'supervisory_authority',
      recipient_contact_info: { email: 'dpa@regulator.gov' },
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
   * Prepare individual notifications
   */
  private async prepareIndividualNotifications(
    incident: any,
    riskAssessment: any
  ): Promise<any[]> {
    // Only send individual notifications for high-risk breaches
    if (riskAssessment.risk_level !== 'high' && riskAssessment.risk_level !== 'critical') {
      return [];
    }

    const context: GDPRNotificationContext = {
      breach_incident_id: incident.id,
      incident_id: incident.incident_id,
      organization_name: 'Organization Name',
      supervisory_authority: 'Data Protection Authority',
      data_protection_officer: 'DPO Name',
      detected_at: incident.detected_at,
      breach_type: incident.incident_type,
      affected_data_types: incident.affected_data_types,
      estimated_records_affected: incident.estimated_records_affected,
      risk_level: riskAssessment.risk_level,
      mitigation_measures: riskAssessment.mitigation_measures,
      contact_information: 'privacy@company.com',
      assessment_summary: riskAssessment.assessment_notes,
      legal_basis: 'Legitimate interest and consent',
      cross_border_transfers: false,
      international_organization: false
    };

    // Get template and render notification
    const template = await notificationTemplateEngine.getTemplateForIncident(
      incident,
      'gdpr_data_subject'
    );

    if (!template) {
      console.warn('GDPR data subject template not found');
      return [];
    }

    const renderedNotification = await notificationTemplateEngine.renderNotification(template, context);

    return [{
      id: `gdpr-individual-${incident.id}`,
      notification_type: 'gdpr_data_subject',
      recipient_type: 'individual',
      recipient_identifier: 'affected_individuals',
      recipient_contact_info: { email: 'individuals@company.com' },
      template_code: template.template_code,
      scheduled_send_at: new Date(),
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      delivery_method: 'email',
      priority: 'high',
      content: renderedNotification
    }];
  }

  /**
   * Notify internal stakeholders
   */
  private async notifyInternalStakeholders(workflow: GDPR72HourWorkflow, notificationType: string): Promise<void> {
    // Implementation would notify DPO, legal team, executives, etc.
    console.log(`Notifying internal stakeholders for workflow ${workflow.id} with type ${notificationType}`);
  }

  /**
   * Prepare emergency notification
   */
  private async prepareEmergencyNotification(workflow: GDPR72HourWorkflow): Promise<void> {
    console.log(`Preparing emergency notification for workflow ${workflow.id}`);
    // Implementation would prepare emergency notification procedures
  }

  /**
   * Activate emergency response
   */
  private async activateEmergencyResponse(workflow: GDPR72HourWorkflow): Promise<void> {
    console.log(`Activating emergency response for workflow ${workflow.id}`);
    // Implementation would activate emergency response team
  }

  /**
   * Mark workflow as overdue
   */
  private async markWorkflowOverdue(workflow: GDPR72HourWorkflow): Promise<void> {
    workflow.status = 'overdue';
    await this.logWorkflowEvent(workflow, 'deadline_missed', 'system');

    // Send final escalation notification
    await this.notifyInternalStakeholders(workflow, 'deadline_missed_notification');

    await this.updateWorkflow(workflow);
  }

  /**
   * Schedule escalation checks
   */
  private scheduleEscalationChecks(workflow: GDPR72HourWorkflow): void {
    // Schedule checks at escalation intervals
    for (const interval of this.ESCALATION_INTERVALS) {
      const checkTime = new Date(workflow.deadline_72h.getTime() - (interval * 60 * 60 * 1000));

      if (checkTime > new Date()) {
        setTimeout(() => {
          this.checkEscalation(workflow, interval);
        }, checkTime.getTime() - Date.now());
      }
    }
  }

  /**
   * Check if escalation is needed
   */
  private async checkEscalation(workflow: GDPR72HourWorkflow, interval: number): Promise<void> {
    const updatedWorkflow = this.activeWorkflows.get(workflow.id);
    if (!updatedWorkflow || updatedWorkflow.status === 'completed') {
      return;
    }

    const timeRemaining = updatedWorkflow.time_remaining_hours;

    if (timeRemaining <= interval && updatedWorkflow.escalation_level < this.ESCALATION_INTERVALS.indexOf(interval) + 1) {
      const trigger: EscalationTrigger = {
        id: `esc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        trigger_type: 'time_remaining',
        trigger_time: new Date(),
        escalation_level: this.ESCALATION_INTERVALS.indexOf(interval) + 1,
        description: `Time remaining: ${timeRemaining.toFixed(1)} hours`,
        resolved: false
      };

      updatedWorkflow.escalation_triggers.push(trigger);
      await this.handleEscalation(updatedWorkflow, trigger);
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

  private async updateWorkflowStatus(workflowId: string, status: GDPR72HourWorkflow['status']): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    workflow.status = status;
    workflow.updated_at = new Date();

    await this.supabase
      .from('breach_gdpr_72h_workflows')
      .update({
        status: status,
        updated_at: workflow.updated_at
      })
      .eq('id', workflowId);
  }

  private async updateWorkflow(workflow: GDPR72HourWorkflow): Promise<void> {
    workflow.updated_at = new Date();

    await this.supabase
      .from('breach_gdpr_72h_workflows')
      .update({
        status: workflow.status,
        time_remaining_hours: workflow.time_remaining_hours,
        escalation_level: workflow.escalation_level,
        notifications_sent: workflow.notifications_sent,
        escalation_triggers: workflow.escalation_triggers,
        updated_at: workflow.updated_at
      })
      .eq('id', workflow.id);
  }

  private async logWorkflowEvent(workflow: GDPR72HourWorkflow, event: string, user: string): Promise<void> {
    await this.supabase
      .from('breach_audit_logs')
      .insert([{
        breach_incident_id: workflow.breach_incident_id,
        action: 'gdpr_workflow_event',
        user_identifier: user,
        changes: { workflow_event: event, workflow_id: workflow.id }
      }]);
  }

  /**
   * Workflow monitor - runs periodically
   */
  private startWorkflowMonitor(): void {
    setInterval(() => {
      this.monitorWorkflows();
    }, 300000); // Check every 5 minutes
  }

  /**
   * Escalation monitor - runs frequently
   */
  private startEscalationMonitor(): void {
    setInterval(() => {
      this.checkAllEscalations();
    }, 60000); // Check every minute
  }

  private async checkAllEscalations(): Promise<void> {
    for (const workflow of this.activeWorkflows.values()) {
      const timeRemaining = workflow.time_remaining_hours;
      const nextEscalationLevel = this.getNextEscalationLevel(workflow);

      if (nextEscalationLevel > workflow.escalation_level) {
        const trigger: EscalationTrigger = {
          id: `esc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          trigger_type: 'time_remaining',
          trigger_time: new Date(),
          escalation_level: nextEscalationLevel,
          description: `Time remaining: ${timeRemaining.toFixed(1)} hours`,
          resolved: false
        };

        workflow.escalation_triggers.push(trigger);
        await this.handleEscalation(workflow, trigger);
      }
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): GDPR72HourWorkflow | null {
    return this.activeWorkflows.get(workflowId) || null;
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows(): GDPR72HourWorkflow[] {
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
      .from('breach_gdpr_72h_workflows')
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
export const gdpr72HourWorkflowEngine = new GDPR72HourWorkflowEngine(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);