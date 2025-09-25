/**
 * Multi-Stakeholder Notification System
 * Comprehensive system for managing notifications to various stakeholders
 * Integrates with GDPR, HIPAA, and SOC2 workflows for unified communication management
 */

import { createClient } from '@supabase/supabase-js';
import { notificationTemplateEngine } from './notification-templates';
import { breachNotificationWorkflowEngine } from './breach-notification';

// Types for multi-stakeholder notifications
export interface StakeholderGroup {
  id: string;
  name: string;
  description: string;
  stakeholder_type: 'affected_individuals' | 'regulators' | 'internal_teams' | 'executives' | 'board' | 'auditors' | 'law_enforcement' | 'media' | 'vendors' | 'customers';
  notification_priority: 'low' | 'medium' | 'high' | 'urgent';
  default_delivery_methods: ('email' | 'sms' | 'mail' | 'phone' | 'portal' | 'in_person')[];
  requires_approval: boolean;
  approval_required_from?: string;
  communication_frequency: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'as_needed';
  escalation_triggers: EscalationTrigger[];
  created_at: Date;
  updated_at: Date;
}

export interface StakeholderContact {
  id: string;
  stakeholder_group_id: string;
  contact_type: 'primary' | 'secondary' | 'backup' | 'escalation';
  name: string;
  title?: string;
  organization?: string;
  email?: string;
  phone?: string;
  address?: string;
  preferred_language: string;
  timezone: string;
  notification_preferences: NotificationPreferences;
  is_active: boolean;
  last_contacted?: Date;
  contact_history: ContactHistoryEntry[];
  created_at: Date;
  updated_at: Date;
}

export interface NotificationPreferences {
  preferred_delivery_methods: ('email' | 'sms' | 'mail' | 'phone' | 'portal' | 'in_person')[];
  do_not_disturb_hours?: { start: number; end: number }; // 24-hour format
  weekend_notifications: boolean;
  emergency_override: boolean;
  language_preference: string;
  format_preference: 'summary' | 'detailed' | 'executive';
}

export interface ContactHistoryEntry {
  id: string;
  notification_id: string;
  contact_timestamp: Date;
  delivery_method: string;
  status: 'sent' | 'delivered' | 'failed' | 'acknowledged';
  response_time?: number; // minutes
  notes?: string;
}

export interface EscalationTrigger {
  id: string;
  trigger_condition: 'time_elapsed' | 'no_response' | 'priority_change' | 'manual';
  trigger_value: number | string;
  escalation_action: 'notify_backup' | 'escalate_priority' | 'change_method' | 'manual_intervention';
  cooldown_period_minutes: number;
  max_occurrences: number;
  current_occurrences: number;
  last_triggered?: Date;
  enabled: boolean;
}

export interface StakeholderNotification {
  id: string;
  breach_incident_id: string;
  stakeholder_group_id: string;
  stakeholder_contact_ids: string[];
  notification_type: 'initial' | 'update' | 'escalation' | 'resolution' | 'summary';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  content: string;
  delivery_methods: ('email' | 'sms' | 'mail' | 'phone' | 'portal' | 'in_person')[];
  scheduled_send_at: Date;
  sent_at?: Date;
  status: 'draft' | 'scheduled' | 'sent' | 'delivered' | 'failed' | 'acknowledged';
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: Date;
  approval_status: 'pending' | 'approved' | 'rejected';
  retry_count: number;
  max_retries: number;
  tracking_id: string;
  response_deadline?: Date;
  responses: NotificationResponse[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationResponse {
  id: string;
  notification_id: string;
  stakeholder_contact_id: string;
  response_type: 'acknowledgment' | 'question' | 'concern' | 'request' | 'approval';
  response_content: string;
  response_timestamp: Date;
  requires_followup: boolean;
  followup_priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assigned_to?: string;
  resolved_at?: Date;
  resolution_notes?: string;
}

// Main multi-stakeholder notification engine
export class MultiStakeholderNotificationEngine {
  private supabase: any;
  private stakeholderGroups: Map<string, StakeholderGroup> = new Map();
  private activeNotifications: Map<string, StakeholderNotification> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeStakeholderGroups();
    this.startNotificationProcessor();
    this.startEscalationMonitor();
  }

  /**
   * Initialize stakeholder groups from database
   */
  private async initializeStakeholderGroups(): Promise<void> {
    try {
      const { data: groups, error } = await this.supabase
        .from('breach_stakeholder_groups')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      for (const group of groups || []) {
        this.stakeholderGroups.set(group.id, group as StakeholderGroup);
      }

      console.log(`Initialized ${this.stakeholderGroups.size} stakeholder groups`);
    } catch (error) {
      console.error('Failed to initialize stakeholder groups:', error);
    }
  }

  /**
   * Create a comprehensive stakeholder notification
   */
  async createStakeholderNotification(
    breachIncidentId: string,
    stakeholderGroupId: string,
    notificationData: {
      notification_type: StakeholderNotification['notification_type'];
      subject: string;
      content: string;
      priority?: StakeholderNotification['priority'];
      delivery_methods?: string[];
      scheduled_send_at?: Date;
      requires_approval?: boolean;
      response_deadline?: Date;
      created_by: string;
    }
  ): Promise<StakeholderNotification> {
    console.log(`Creating stakeholder notification for incident ${breachIncidentId}, group ${stakeholderGroupId}`);

    // Get breach incident details
    const incident = await this.getBreachIncident(breachIncidentId);
    if (!incident) {
      throw new Error(`Breach incident ${breachIncidentId} not found`);
    }

    // Get stakeholder group
    const stakeholderGroup = this.stakeholderGroups.get(stakeholderGroupId);
    if (!stakeholderGroup) {
      throw new Error(`Stakeholder group ${stakeholderGroupId} not found`);
    }

    // Get stakeholder contacts
    const stakeholderContacts = await this.getStakeholderContacts(stakeholderGroupId);

    // Determine priority
    const priority = notificationData.priority || stakeholderGroup.notification_priority;

    // Determine delivery methods
    const deliveryMethods = (notificationData.delivery_methods || stakeholderGroup.default_delivery_methods) as ('email' | 'sms' | 'mail' | 'phone' | 'portal' | 'in_person')[];

    // Create notification
    const notification: Omit<StakeholderNotification, 'id' | 'created_at' | 'updated_at'> = {
      breach_incident_id: breachIncidentId,
      stakeholder_group_id: stakeholderGroupId,
      stakeholder_contact_ids: stakeholderContacts.map(contact => contact.id),
      notification_type: notificationData.notification_type,
      priority: priority,
      subject: notificationData.subject,
      content: notificationData.content,
      delivery_methods: deliveryMethods,
      scheduled_send_at: notificationData.scheduled_send_at || new Date(),
      status: 'draft',
      requires_approval: notificationData.requires_approval ?? stakeholderGroup.requires_approval,
      approval_status: 'pending',
      retry_count: 0,
      max_retries: 3,
      tracking_id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      response_deadline: notificationData.response_deadline,
      responses: [],
      created_by: notificationData.created_by
    };

    // Store notification in database
    const { data, error } = await this.supabase
      .from('breach_stakeholder_notifications')
      .insert([notification])
      .select()
      .single();

    if (error) {
      console.error('Failed to create stakeholder notification:', error);
      throw error;
    }

    const createdNotification = { ...notification, id: data.id, created_at: data.created_at, updated_at: data.updated_at };

    // Cache notification
    this.activeNotifications.set(createdNotification.id, createdNotification);

    // Log notification creation
    await this.logNotificationEvent(createdNotification, 'created', notificationData.created_by);

    // Schedule notification if immediate
    if (createdNotification.scheduled_send_at <= new Date()) {
      await this.sendNotification(createdNotification);
    } else {
      this.scheduleNotification(createdNotification);
    }

    return createdNotification;
  }

  /**
   * Send notification to all stakeholders in the group
   */
  async sendNotification(notification: StakeholderNotification): Promise<void> {
    try {
      console.log(`Sending notification ${notification.id} to ${notification.stakeholder_contact_ids.length} stakeholders`);

      // Get stakeholder contacts
      const contacts = await this.getStakeholderContactsByIds(notification.stakeholder_contact_ids);

      // Send to each contact
      for (const contact of contacts) {
        await this.sendToStakeholder(notification, contact);
      }

      // Update notification status
      notification.status = 'sent';
      notification.sent_at = new Date();
      await this.updateNotification(notification);

      // Log successful send
      await this.logNotificationEvent(notification, 'sent', 'system');

      // Schedule follow-up if needed
      if (notification.response_deadline) {
        this.scheduleResponseFollowup(notification);
      }

    } catch (error) {
      console.error(`Error sending notification ${notification.id}:`, error);
      await this.logNotificationEvent(notification, 'send_failed', 'system');

      // Handle retry logic
      await this.handleNotificationRetry(notification);
    }
  }

  /**
   * Send notification to a specific stakeholder
   */
  private async sendToStakeholder(
    notification: StakeholderNotification,
    contact: StakeholderContact
  ): Promise<void> {
    // Check notification preferences and timing
    if (!this.shouldSendNotification(notification, contact)) {
      console.log(`Skipping notification for contact ${contact.id} due to preferences`);
      return;
    }

    // Send via each delivery method
    for (const method of notification.delivery_methods) {
      try {
        await this.deliverByMethod(notification, contact, method);
      } catch (error) {
        console.error(`Failed to deliver via ${method} to contact ${contact.id}:`, error);
      }
    }

    // Update contact last contacted
    contact.last_contacted = new Date();
    await this.updateStakeholderContact(contact);
  }

  /**
   * Deliver notification by specific method
   */
  private async deliverByMethod(
    notification: StakeholderNotification,
    contact: StakeholderContact,
    method: string
  ): Promise<void> {
    switch (method) {
      case 'email':
        await this.sendEmail(notification, contact);
        break;
      case 'sms':
        await this.sendSMS(notification, contact);
        break;
      case 'phone':
        await this.sendPhoneCall(notification, contact);
        break;
      case 'portal':
        await this.sendPortalNotification(notification, contact);
        break;
      default:
        console.log(`Delivery method ${method} not implemented`);
    }
  }

  /**
   * Check if notification should be sent based on preferences
   */
  private shouldSendNotification(
    notification: StakeholderNotification,
    contact: StakeholderContact
  ): boolean {
    const now = new Date();
    const hour = now.getHours();

    // Check do not disturb hours
    if (contact.notification_preferences.do_not_disturb_hours) {
      const dnd = contact.notification_preferences.do_not_disturb_hours;
      if (hour >= dnd.start && hour <= dnd.end) {
        return contact.notification_preferences.emergency_override &&
               (notification.priority === 'urgent' || notification.priority === 'high');
      }
    }

    // Check weekend preferences
    if (now.getDay() === 0 || now.getDay() === 6) {
      if (!contact.notification_preferences.weekend_notifications) {
        return notification.priority === 'urgent';
      }
    }

    return true;
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    notification: StakeholderNotification,
    contact: StakeholderContact
  ): Promise<void> {
    if (!contact.email) {
      throw new Error(`No email address for contact ${contact.id}`);
    }

    console.log(`Sending email to ${contact.email}: ${notification.subject}`);

    // Implementation would integrate with email service
    // For now, just log the action
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    notification: StakeholderNotification,
    contact: StakeholderContact
  ): Promise<void> {
    if (!contact.phone) {
      throw new Error(`No phone number for contact ${contact.id}`);
    }

    console.log(`Sending SMS to ${contact.phone}: ${notification.subject}`);

    // Implementation would integrate with SMS service
    // For now, just log the action
  }

  /**
   * Send phone call notification
   */
  private async sendPhoneCall(
    notification: StakeholderNotification,
    contact: StakeholderContact
  ): Promise<void> {
    if (!contact.phone) {
      throw new Error(`No phone number for contact ${contact.id}`);
    }

    console.log(`Initiating phone call to ${contact.phone}: ${notification.subject}`);

    // Implementation would integrate with phone service
    // For now, just log the action
  }

  /**
   * Send portal notification
   */
  private async sendPortalNotification(
    notification: StakeholderNotification,
    contact: StakeholderContact
  ): Promise<void> {
    console.log(`Sending portal notification for contact ${contact.id}: ${notification.subject}`);

    // Implementation would integrate with notification portal
    // For now, just log the action
  }

  /**
   * Handle notification retry logic
   */
  private async handleNotificationRetry(notification: StakeholderNotification): Promise<void> {
    if (notification.retry_count >= notification.max_retries) {
      notification.status = 'failed';
      await this.updateNotification(notification);
      await this.logNotificationEvent(notification, 'max_retries_exceeded', 'system');
      return;
    }

    notification.retry_count++;
    const retryDelay = Math.pow(2, notification.retry_count) * 5 * 60 * 1000; // Exponential backoff

    console.log(`Scheduling retry ${notification.retry_count} for notification ${notification.id} in ${retryDelay / 1000} seconds`);

    setTimeout(() => {
      this.sendNotification(notification);
    }, retryDelay);
  }

  /**
   * Schedule response follow-up
   */
  private scheduleResponseFollowup(notification: StakeholderNotification): void {
    if (!notification.response_deadline) return;

    const followupDelay = notification.response_deadline.getTime() - Date.now();

    if (followupDelay > 0) {
      setTimeout(() => {
        this.checkResponseFollowup(notification);
      }, followupDelay);
    }
  }

  /**
   * Check if response follow-up is needed
   */
  private async checkResponseFollowup(notification: StakeholderNotification): Promise<void> {
    const responses = notification.responses.filter(r => r.response_type === 'acknowledgment');

    if (responses.length === 0) {
      // No responses received, trigger escalation
      await this.triggerEscalation(notification, 'no_response', 'No acknowledgment received from stakeholders');
    }
  }

  /**
   * Trigger escalation for a notification
   */
  private async triggerEscalation(
    notification: StakeholderNotification,
    triggerType: string,
    reason: string
  ): Promise<void> {
    console.log(`Triggering escalation for notification ${notification.id}: ${reason}`);

    // Get stakeholder group for escalation configuration
    const stakeholderGroup = this.stakeholderGroups.get(notification.stakeholder_group_id);
    if (!stakeholderGroup) return;

    // Find applicable escalation trigger
    const escalationTrigger = stakeholderGroup.escalation_triggers.find(
      trigger => trigger.trigger_condition === triggerType && trigger.enabled
    );

    if (!escalationTrigger) return;

    // Check if max occurrences reached
    if (escalationTrigger.current_occurrences >= escalationTrigger.max_occurrences) {
      console.log(`Max escalation occurrences reached for trigger ${escalationTrigger.id}`);
      return;
    }

    // Execute escalation action
    switch (escalationTrigger.escalation_action) {
      case 'notify_backup':
        await this.notifyBackupContacts(notification);
        break;
      case 'escalate_priority':
        await this.escalateNotificationPriority(notification);
        break;
      case 'change_method':
        await this.changeNotificationMethod(notification);
        break;
      case 'manual_intervention':
        await this.requireManualIntervention(notification, reason);
        break;
    }

    // Update escalation trigger
    escalationTrigger.current_occurrences++;
    escalationTrigger.last_triggered = new Date();

    await this.updateStakeholderGroup(stakeholderGroup);
  }

  /**
   * Notify backup contacts
   */
  private async notifyBackupContacts(notification: StakeholderNotification): Promise<void> {
    console.log(`Notifying backup contacts for notification ${notification.id}`);

    // Get backup contacts for the stakeholder group
    const backupContacts = await this.getBackupContacts(notification.stakeholder_group_id);

    // Send notification to backup contacts
    for (const contact of backupContacts) {
      await this.sendToStakeholder(notification, contact);
    }
  }

  /**
   * Escalate notification priority
   */
  private async escalateNotificationPriority(notification: StakeholderNotification): Promise<void> {
    const priorityLevels = ['low', 'medium', 'high', 'urgent'];
    const currentIndex = priorityLevels.indexOf(notification.priority);

    if (currentIndex < priorityLevels.length - 1) {
      notification.priority = priorityLevels[currentIndex + 1] as StakeholderNotification['priority'];
      await this.updateNotification(notification);
      await this.logNotificationEvent(notification, 'priority_escalated', 'system');
    }
  }

  /**
   * Change notification method
   */
  private async changeNotificationMethod(notification: StakeholderNotification): Promise<void> {
    // Change to alternative delivery methods
    const alternativeMethods = ['phone', 'sms', 'portal'].filter(
      (method: string) => !notification.delivery_methods.includes(method as any)
    );

    if (alternativeMethods.length > 0) {
      notification.delivery_methods = [alternativeMethods[0] as any];
      await this.updateNotification(notification);
      await this.logNotificationEvent(notification, 'method_changed', 'system');
    }
  }

  /**
   * Require manual intervention
   */
  private async requireManualIntervention(
    notification: StakeholderNotification,
    reason: string
  ): Promise<void> {
    console.log(`Manual intervention required for notification ${notification.id}: ${reason}`);

    // Create manual intervention task
    await this.supabase
      .from('breach_manual_interventions')
      .insert([{
        notification_id: notification.id,
        reason: reason,
        priority: notification.priority,
        assigned_to: 'incident-response-manager',
        status: 'pending',
        created_at: new Date()
      }]);

    await this.logNotificationEvent(notification, 'manual_intervention_required', 'system');
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

  private async getStakeholderContacts(groupId: string): Promise<StakeholderContact[]> {
    const { data, error } = await this.supabase
      .from('breach_stakeholder_contacts')
      .select('*')
      .eq('stakeholder_group_id', groupId)
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  }

  private async getStakeholderContactsByIds(contactIds: string[]): Promise<StakeholderContact[]> {
    const { data, error } = await this.supabase
      .from('breach_stakeholder_contacts')
      .select('*')
      .in('id', contactIds)
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  }

  private async getBackupContacts(groupId: string): Promise<StakeholderContact[]> {
    const { data, error } = await this.supabase
      .from('breach_stakeholder_contacts')
      .select('*')
      .eq('stakeholder_group_id', groupId)
      .eq('contact_type', 'backup')
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  }

  private async updateNotification(notification: StakeholderNotification): Promise<void> {
    notification.updated_at = new Date();

    await this.supabase
      .from('breach_stakeholder_notifications')
      .update({
        status: notification.status,
        priority: notification.priority,
        sent_at: notification.sent_at,
        approval_status: notification.approval_status,
        retry_count: notification.retry_count,
        delivery_methods: notification.delivery_methods,
        updated_at: notification.updated_at
      })
      .eq('id', notification.id);
  }

  private async updateStakeholderContact(contact: StakeholderContact): Promise<void> {
    contact.updated_at = new Date();

    await this.supabase
      .from('breach_stakeholder_contacts')
      .update({
        last_contacted: contact.last_contacted,
        updated_at: contact.updated_at
      })
      .eq('id', contact.id);
  }

  private async updateStakeholderGroup(group: StakeholderGroup): Promise<void> {
    group.updated_at = new Date();

    await this.supabase
      .from('breach_stakeholder_groups')
      .update({
        escalation_triggers: group.escalation_triggers,
        updated_at: group.updated_at
      })
      .eq('id', group.id);
  }

  private async logNotificationEvent(
    notification: StakeholderNotification,
    event: string,
    user: string
  ): Promise<void> {
    await this.supabase
      .from('breach_audit_logs')
      .insert([{
        breach_incident_id: notification.breach_incident_id,
        action: 'stakeholder_notification_event',
        user_identifier: user,
        changes: { notification_event: event, notification_id: notification.id }
      }]);
  }

  private scheduleNotification(notification: StakeholderNotification): void {
    const delay = notification.scheduled_send_at.getTime() - Date.now();

    if (delay > 0) {
      setTimeout(() => {
        this.sendNotification(notification);
      }, delay);
    }
  }

  /**
   * Notification processor - runs periodically
   */
  private startNotificationProcessor(): void {
    setInterval(() => {
      this.processScheduledNotifications();
    }, 60000); // Process every minute
  }

  private async processScheduledNotifications(): Promise<void> {
    const now = new Date();

    // Find notifications that are scheduled to be sent
    for (const notification of this.activeNotifications.values()) {
      if (notification.status === 'draft' && notification.scheduled_send_at <= now) {
        await this.sendNotification(notification);
      }
    }
  }

  /**
   * Escalation monitor - runs frequently
   */
  private startEscalationMonitor(): void {
    setInterval(() => {
      this.monitorEscalations();
    }, 300000); // Monitor every 5 minutes
  }

  private async monitorEscalations(): Promise<void> {
    // Check for escalation triggers
    for (const notification of this.activeNotifications.values()) {
      if (notification.response_deadline && notification.response_deadline <= new Date()) {
        await this.triggerEscalation(notification, 'no_response', 'Response deadline exceeded');
      }
    }
  }

  /**
   * Get notification status
   */
  getNotificationStatus(notificationId: string): StakeholderNotification | null {
    return this.activeNotifications.get(notificationId) || null;
  }

  /**
   * Get all active notifications
   */
  getActiveNotifications(): StakeholderNotification[] {
    return Array.from(this.activeNotifications.values());
  }

  /**
   * Create predefined stakeholder groups
   */
  async createPredefinedStakeholderGroups(): Promise<void> {
    const predefinedGroups: Omit<StakeholderGroup, 'id' | 'created_at' | 'updated_at'>[] = [
      {
        name: 'GDPR Supervisory Authorities',
        description: 'Data protection authorities for GDPR compliance',
        stakeholder_type: 'regulators',
        notification_priority: 'urgent',
        default_delivery_methods: ['email'],
        requires_approval: true,
        approval_required_from: 'data-protection-officer',
        communication_frequency: 'immediate',
        escalation_triggers: [
          {
            id: 'gdpr-time-trigger',
            trigger_condition: 'time_elapsed',
            trigger_value: 72,
            escalation_action: 'manual_intervention',
            cooldown_period_minutes: 60,
            max_occurrences: 1,
            current_occurrences: 0,
            enabled: true
          }
        ]
      },
      {
        name: 'HIPAA Privacy Officer',
        description: 'Internal privacy officer for HIPAA compliance',
        stakeholder_type: 'internal_teams',
        notification_priority: 'high',
        default_delivery_methods: ['email', 'phone'],
        requires_approval: false,
        communication_frequency: 'immediate',
        escalation_triggers: []
      },
      {
        name: 'Executive Leadership',
        description: 'C-level executives and board members',
        stakeholder_type: 'executives',
        notification_priority: 'high',
        default_delivery_methods: ['email', 'portal'],
        requires_approval: false,
        communication_frequency: 'daily',
        escalation_triggers: []
      },
      {
        name: 'Affected Individuals',
        description: 'Customers or individuals affected by the breach',
        stakeholder_type: 'affected_individuals',
        notification_priority: 'medium',
        default_delivery_methods: ['email', 'mail'],
        requires_approval: true,
        approval_required_from: 'legal-team',
        communication_frequency: 'as_needed',
        escalation_triggers: []
      }
    ];

    for (const group of predefinedGroups) {
      await this.supabase
        .from('breach_stakeholder_groups')
        .insert([group]);
    }
  }
}

// Export singleton instance
export const multiStakeholderNotificationEngine = new MultiStakeholderNotificationEngine(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);