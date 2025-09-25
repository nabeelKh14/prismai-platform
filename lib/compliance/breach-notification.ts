/**
 * Breach Notification Workflow System
 * Orchestrates automated notification workflows for GDPR, HIPAA, and SOC2 compliance
 * Manages 72-hour GDPR timelines, HIPAA procedures, and multi-stakeholder communications
 */

import { createClient } from '@supabase/supabase-js';
import { notificationTemplateEngine, NotificationContext, RenderedNotification } from './notification-templates';
import { breachAssessmentEngine, RiskAssessment } from './breach-assessment';

// Types for notification workflows
export interface NotificationWorkflow {
  id: string;
  breach_incident_id: string;
  workflow_type: 'gdpr_72h' | 'hipaa_breach' | 'soc2_incident' | 'internal_escalation' | 'stakeholder_notification';
  status: 'pending' | 'active' | 'paused' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduled_notifications: ScheduledNotification[];
  completed_notifications: string[];
  failed_notifications: string[];
  deadline_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ScheduledNotification {
  id: string;
  notification_type: string;
  recipient_type: 'individual' | 'organization' | 'regulator' | 'internal';
  recipient_identifier: string;
  recipient_contact_info: {
    email?: string;
    phone?: string;
    address?: string;
  };
  template_code: string;
  scheduled_send_at: Date;
  deadline_hours?: number;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'acknowledged';
  retry_count: number;
  max_retries: number;
  delivery_method: 'email' | 'sms' | 'mail' | 'phone' | 'portal' | 'in_person';
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface NotificationDeliveryResult {
  notification_id: string;
  success: boolean;
  delivered_at?: Date;
  error_message?: string;
  delivery_method: string;
  recipient_info: string;
  tracking_id?: string;
}

export interface WorkflowExecutionContext {
  breach_incident_id: string;
  risk_assessment: RiskAssessment;
  affected_individuals: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    data_types_affected: string[];
  }>;
  stakeholders: Array<{
    id: string;
    name: string;
    role: string;
    contact_info: {
      email?: string;
      phone?: string;
    };
    notification_types: string[];
  }>;
  regulatory_contacts: Array<{
    organization: string;
    contact_type: string;
    email?: string;
    phone?: string;
    address?: string;
  }>;
}

// Main breach notification workflow engine
export class BreachNotificationWorkflowEngine {
  private supabase: any;
  private activeWorkflows: Map<string, NotificationWorkflow> = new Map();
  private notificationQueue: ScheduledNotification[] = [];

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeWorkflows();
    this.startWorkflowProcessor();
    this.startNotificationProcessor();
  }

  /**
   * Initialize workflows from database
   */
  private async initializeWorkflows(): Promise<void> {
    try {
      const { data: workflows, error } = await this.supabase
        .from('breach_notification_workflows')
        .select('*')
        .in('status', ['pending', 'active']);

      if (error) throw error;

      for (const workflow of workflows || []) {
        this.activeWorkflows.set(workflow.id, workflow as NotificationWorkflow);
      }

      console.log(`Initialized ${this.activeWorkflows.size} active notification workflows`);
    } catch (error) {
      console.error('Failed to initialize notification workflows:', error);
    }
  }

  /**
   * Create and start a GDPR 72-hour notification workflow
   */
  async createGDPR72HourWorkflow(breachIncidentId: string): Promise<NotificationWorkflow> {
    console.log(`Creating GDPR 72-hour workflow for incident ${breachIncidentId}`);

    // Get breach incident details
    const incident = await this.getBreachIncident(breachIncidentId);
    if (!incident) {
      throw new Error(`Breach incident ${breachIncidentId} not found`);
    }

    // Get risk assessment
    const riskAssessment = await this.getLatestRiskAssessment(breachIncidentId);
    if (!riskAssessment) {
      throw new Error(`Risk assessment for incident ${breachIncidentId} not found`);
    }

    // Create workflow
    const workflow: Omit<NotificationWorkflow, 'id' | 'created_at' | 'updated_at'> = {
      breach_incident_id: breachIncidentId,
      workflow_type: 'gdpr_72h',
      status: 'active',
      priority: riskAssessment.risk_level === 'critical' ? 'urgent' : 'high',
      scheduled_notifications: [],
      completed_notifications: [],
      failed_notifications: [],
      deadline_at: new Date(incident.detected_at.getTime() + (72 * 60 * 60 * 1000)) // 72 hours from detection
    };

    // Schedule notifications based on risk level
    const notifications = await this.scheduleGDPRNotifications(incident, riskAssessment);
    workflow.scheduled_notifications = notifications;

    // Store workflow in database
    const { data, error } = await this.supabase
      .from('breach_notification_workflows')
      .insert([workflow])
      .select()
      .single();

    if (error) {
      console.error('Failed to create GDPR workflow:', error);
      throw error;
    }

    const createdWorkflow = { ...workflow, id: data.id, created_at: data.created_at, updated_at: data.updated_at };

    // Cache workflow
    this.activeWorkflows.set(createdWorkflow.id, createdWorkflow);

    // Log workflow creation
    await this.logWorkflowEvent(createdWorkflow, 'created', 'system');

    // Start immediate processing for urgent notifications
    if (createdWorkflow.priority === 'urgent') {
      this.processWorkflow(createdWorkflow);
    }

    return createdWorkflow;
  }

  /**
   * Create and start a HIPAA breach notification workflow
   */
  async createHIPAABreachWorkflow(breachIncidentId: string): Promise<NotificationWorkflow> {
    console.log(`Creating HIPAA breach workflow for incident ${breachIncidentId}`);

    // Get breach incident details
    const incident = await this.getBreachIncident(breachIncidentId);
    if (!incident) {
      throw new Error(`Breach incident ${breachIncidentId} not found`);
    }

    // Get risk assessment
    const riskAssessment = await this.getLatestRiskAssessment(breachIncidentId);
    if (!riskAssessment) {
      throw new Error(`Risk assessment for incident ${breachIncidentId} not found`);
    }

    // Create workflow
    const workflow: Omit<NotificationWorkflow, 'id' | 'created_at' | 'updated_at'> = {
      breach_incident_id: breachIncidentId,
      workflow_type: 'hipaa_breach',
      status: 'active',
      priority: 'high',
      scheduled_notifications: [],
      completed_notifications: [],
      failed_notifications: [],
      deadline_at: new Date(incident.detected_at.getTime() + (60 * 24 * 60 * 60 * 1000)) // 60 days from detection
    };

    // Schedule notifications based on breach characteristics
    const notifications = await this.scheduleHIPAANotifications(incident, riskAssessment);
    workflow.scheduled_notifications = notifications;

    // Store workflow in database
    const { data, error } = await this.supabase
      .from('breach_notification_workflows')
      .insert([workflow])
      .select()
      .single();

    if (error) {
      console.error('Failed to create HIPAA workflow:', error);
      throw error;
    }

    const createdWorkflow = { ...workflow, id: data.id, created_at: data.created_at, updated_at: data.updated_at };

    // Cache workflow
    this.activeWorkflows.set(createdWorkflow.id, createdWorkflow);

    // Log workflow creation
    await this.logWorkflowEvent(createdWorkflow, 'created', 'system');

    return createdWorkflow;
  }

  /**
   * Create and start a SOC2 incident response workflow
   */
  async createSOC2IncidentWorkflow(breachIncidentId: string): Promise<NotificationWorkflow> {
    console.log(`Creating SOC2 incident workflow for incident ${breachIncidentId}`);

    // Get breach incident details
    const incident = await this.getBreachIncident(breachIncidentId);
    if (!incident) {
      throw new Error(`Breach incident ${breachIncidentId} not found`);
    }

    // Create workflow
    const workflow: Omit<NotificationWorkflow, 'id' | 'created_at' | 'updated_at'> = {
      breach_incident_id: breachIncidentId,
      workflow_type: 'soc2_incident',
      status: 'active',
      priority: 'medium',
      scheduled_notifications: [],
      completed_notifications: [],
      failed_notifications: []
    };

    // Schedule notifications for SOC2 requirements
    const notifications = await this.scheduleSOC2Notifications(incident);
    workflow.scheduled_notifications = notifications;

    // Store workflow in database
    const { data, error } = await this.supabase
      .from('breach_notification_workflows')
      .insert([workflow])
      .select()
      .single();

    if (error) {
      console.error('Failed to create SOC2 workflow:', error);
      throw error;
    }

    const createdWorkflow = { ...workflow, id: data.id, created_at: data.created_at, updated_at: data.updated_at };

    // Cache workflow
    this.activeWorkflows.set(createdWorkflow.id, createdWorkflow);

    // Log workflow creation
    await this.logWorkflowEvent(createdWorkflow, 'created', 'system');

    return createdWorkflow;
  }

  /**
   * Process a workflow and send scheduled notifications
   */
  async processWorkflow(workflow: NotificationWorkflow): Promise<void> {
    console.log(`Processing workflow ${workflow.id} for incident ${workflow.breach_incident_id}`);

    const now = new Date();
    const dueNotifications = workflow.scheduled_notifications.filter(
      notification => notification.scheduled_send_at <= now && notification.status === 'pending'
    );

    for (const notification of dueNotifications) {
      try {
        const result = await this.sendNotification(notification);

        if (result.success) {
          // Mark as completed
          await this.markNotificationComplete(workflow.id, notification.id, result);

          // Check if workflow should be completed
          if (await this.shouldCompleteWorkflow(workflow)) {
            await this.completeWorkflow(workflow.id);
          }
        } else {
          // Handle retry logic
          await this.handleNotificationFailure(workflow.id, notification, result);
        }
      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        await this.handleNotificationFailure(workflow.id, notification, {
          notification_id: notification.id,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          delivery_method: notification.delivery_method,
          recipient_info: notification.recipient_identifier
        });
      }
    }
  }

  /**
   * Send a single notification
   */
  async sendNotification(notification: ScheduledNotification): Promise<NotificationDeliveryResult> {
    try {
      // Get breach incident for context
      const incident = await this.getBreachIncidentByNotification(notification.id);
      if (!incident) {
        throw new Error(`Breach incident not found for notification ${notification.id}`);
      }

      // Get risk assessment
      const riskAssessment = await this.getLatestRiskAssessment(incident.id);
      if (!riskAssessment) {
        throw new Error(`Risk assessment not found for incident ${incident.id}`);
      }

      // Prepare notification context
      const context: NotificationContext = {
        breach_incident_id: incident.id,
        incident_id: incident.incident_id,
        organization_name: 'Organization Name', // Should come from config
        detected_at: incident.detected_at,
        breach_type: incident.incident_type,
        affected_data_types: incident.affected_data_types,
        estimated_records_affected: incident.estimated_records_affected,
        risk_level: riskAssessment.risk_level,
        mitigation_measures: riskAssessment.mitigation_measures,
        contact_information: notification.recipient_contact_info.email || notification.recipient_contact_info.phone || 'N/A'
      };

      // Get template and render notification
      const template = await notificationTemplateEngine.getTemplateForIncident(
        incident,
        notification.notification_type
      );

      if (!template) {
        throw new Error(`Template not found for notification type ${notification.notification_type}`);
      }

      const renderedNotification = await notificationTemplateEngine.renderNotification(template, context);

      // Send notification based on delivery method
      const deliveryResult = await this.deliverNotification(renderedNotification, notification);

      return {
        notification_id: notification.id,
        success: deliveryResult.success,
        delivered_at: deliveryResult.delivered_at,
        error_message: deliveryResult.error,
        delivery_method: notification.delivery_method,
        recipient_info: notification.recipient_identifier,
        tracking_id: deliveryResult.tracking_id
      };

    } catch (error) {
      console.error(`Error sending notification ${notification.id}:`, error);
      return {
        notification_id: notification.id,
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        delivery_method: notification.delivery_method,
        recipient_info: notification.recipient_identifier
      };
    }
  }

  /**
   * Deliver notification using appropriate method
   */
  private async deliverNotification(
    renderedNotification: RenderedNotification,
    scheduledNotification: ScheduledNotification
  ): Promise<{ success: boolean; delivered_at?: Date; error?: string; tracking_id?: string }> {
    // Implementation would integrate with email, SMS, etc. services
    // For now, return success for demonstration
    console.log(`Delivering notification via ${renderedNotification.delivery_method}:`, {
      to: scheduledNotification.recipient_identifier,
      subject: renderedNotification.subject,
      priority: renderedNotification.priority
    });

    // Simulate delivery
    return {
      success: true,
      delivered_at: new Date(),
      tracking_id: `TRK-${Date.now()}`
    };
  }

  /**
   * Schedule GDPR-specific notifications
   */
  private async scheduleGDPRNotifications(incident: any, riskAssessment: RiskAssessment): Promise<ScheduledNotification[]> {
    const notifications: ScheduledNotification[] = [];
    const now = new Date();

    // Always notify supervisory authority within 72 hours
    notifications.push({
      id: `gdpr-supervisory-${incident.id}`,
      notification_type: 'gdpr_supervisory_authority',
      recipient_type: 'regulator',
      recipient_identifier: 'supervisory_authority',
      recipient_contact_info: { email: 'dpa@regulator.gov' },
      template_code: 'gdpr_supervisory_authority',
      scheduled_send_at: now, // Send immediately
      deadline_hours: 72,
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      delivery_method: 'email',
      priority: 'urgent'
    });

    // Notify individuals if high risk
    if (riskAssessment.risk_level === 'high' || riskAssessment.risk_level === 'critical') {
      notifications.push({
        id: `gdpr-individual-${incident.id}`,
        notification_type: 'gdpr_data_subject',
        recipient_type: 'individual',
        recipient_identifier: 'affected_individuals',
        recipient_contact_info: { email: 'individuals@company.com' },
        template_code: 'gdpr_data_subject',
        scheduled_send_at: new Date(now.getTime() + (24 * 60 * 60 * 1000)), // Send within 24 hours
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        delivery_method: 'email',
        priority: 'high'
      });
    }

    return notifications;
  }

  /**
   * Schedule HIPAA-specific notifications
   */
  private async scheduleHIPAANotifications(incident: any, riskAssessment: RiskAssessment): Promise<ScheduledNotification[]> {
    const notifications: ScheduledNotification[] = [];
    const now = new Date();

    // Notify individuals within 60 days if breach affects 500+ records or other criteria
    if (incident.estimated_records_affected && incident.estimated_records_affected >= 500) {
      notifications.push({
        id: `hipaa-individual-${incident.id}`,
        notification_type: 'hipaa_individual',
        recipient_type: 'individual',
        recipient_identifier: 'affected_individuals',
        recipient_contact_info: { email: 'individuals@company.com' },
        template_code: 'hipaa_individual',
        scheduled_send_at: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)), // Send within 30 days
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        delivery_method: 'mail', // HIPAA often requires physical mail
        priority: 'high'
      });

      // Notify HHS OCR for large breaches
      notifications.push({
        id: `hipaa-hhs-${incident.id}`,
        notification_type: 'hipaa_hhs_notification',
        recipient_type: 'regulator',
        recipient_identifier: 'hhs_ocr',
        recipient_contact_info: { email: 'ocr@hhs.gov' },
        template_code: 'hipaa_hhs_notification',
        scheduled_send_at: new Date(now.getTime() + (15 * 24 * 60 * 60 * 1000)), // Send within 15 days
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
        delivery_method: 'email',
        priority: 'urgent'
      });
    }

    return notifications;
  }

  /**
   * Schedule SOC2-specific notifications
   */
  private async scheduleSOC2Notifications(incident: any): Promise<ScheduledNotification[]> {
    const notifications: ScheduledNotification[] = [];
    const now = new Date();

    // Notify internal stakeholders
    notifications.push({
      id: `soc2-stakeholder-${incident.id}`,
      notification_type: 'soc2_stakeholder',
      recipient_type: 'internal',
      recipient_identifier: 'security_team',
      recipient_contact_info: { email: 'security@company.com' },
      template_code: 'soc2_stakeholder',
      scheduled_send_at: now, // Send immediately
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      delivery_method: 'email',
      priority: 'medium'
    });

    return notifications;
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

  private async getBreachIncidentByNotification(notificationId: string): Promise<any> {
    const { data: notification, error: notificationError } = await this.supabase
      .from('breach_notifications')
      .select('breach_incident_id')
      .eq('id', notificationId)
      .single();

    if (notificationError) throw notificationError;

    return await this.getBreachIncident(notification.breach_incident_id);
  }

  private async getLatestRiskAssessment(incidentId: string): Promise<RiskAssessment | null> {
    const { data, error } = await this.supabase
      .from('breach_risk_assessments')
      .select('*')
      .eq('breach_incident_id', incidentId)
      .order('assessed_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data || null;
  }

  private async markNotificationComplete(
    workflowId: string,
    notificationId: string,
    result: NotificationDeliveryResult
  ): Promise<void> {
    // Update notification status
    await this.supabase
      .from('breach_notifications')
      .update({
        status: 'sent',
        sent_at: result.delivered_at,
        updated_at: new Date()
      })
      .eq('id', notificationId);

    // Update workflow
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      workflow.completed_notifications.push(notificationId);
      workflow.updated_at = new Date();

      await this.supabase
        .from('breach_notification_workflows')
        .update({ updated_at: workflow.updated_at })
        .eq('id', workflowId);
    }
  }

  private async handleNotificationFailure(
    workflowId: string,
    notification: ScheduledNotification,
    result: NotificationDeliveryResult
  ): Promise<void> {
    notification.retry_count++;

    if (notification.retry_count >= notification.max_retries) {
      // Mark as failed
      notification.status = 'failed';

      // Update workflow
      const workflow = this.activeWorkflows.get(workflowId);
      if (workflow) {
        workflow.failed_notifications.push(notification.id);
        workflow.updated_at = new Date();

        await this.supabase
          .from('breach_notification_workflows')
          .update({ updated_at: workflow.updated_at })
          .eq('id', workflowId);
      }
    } else {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, notification.retry_count) * 5 * 60 * 1000; // 5min, 10min, 20min, etc.
      notification.scheduled_send_at = new Date(Date.now() + retryDelay);
    }
  }

  private async shouldCompleteWorkflow(workflow: NotificationWorkflow): Promise<boolean> {
    const remainingNotifications = workflow.scheduled_notifications.filter(
      n => n.status === 'pending'
    ).length;

    return remainingNotifications === 0;
  }

  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.updated_at = new Date();

    await this.supabase
      .from('breach_notification_workflows')
      .update({
        status: 'completed',
        updated_at: workflow.updated_at
      })
      .eq('id', workflowId);

    // Remove from active workflows
    this.activeWorkflows.delete(workflowId);

    await this.logWorkflowEvent(workflow, 'completed', 'system');
  }

  private async logWorkflowEvent(workflow: NotificationWorkflow, event: string, user: string): Promise<void> {
    await this.supabase
      .from('breach_audit_logs')
      .insert([{
        breach_incident_id: workflow.breach_incident_id,
        action: 'workflow_event',
        user_identifier: user,
        changes: { workflow_event: event, workflow_id: workflow.id }
      }]);
  }

  /**
   * Workflow processor - runs periodically
   */
  private startWorkflowProcessor(): void {
    setInterval(() => {
      this.processAllActiveWorkflows();
    }, 60000); // Process every minute
  }

  private async processAllActiveWorkflows(): Promise<void> {
    for (const workflow of this.activeWorkflows.values()) {
      if (workflow.status === 'active') {
        await this.processWorkflow(workflow);
      }
    }
  }

  /**
   * Notification processor - runs frequently
   */
  private startNotificationProcessor(): void {
    setInterval(() => {
      this.processNotificationQueue();
    }, 30000); // Process every 30 seconds
  }

  private async processNotificationQueue(): Promise<void> {
    // Process queued notifications
    // Implementation for high-priority notification processing
  }
}

// Export singleton instance
export const breachNotificationWorkflowEngine = new BreachNotificationWorkflowEngine(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);