/**
 * Breach Notification Templates System
 * Manages standardized templates for different breach types and regulatory requirements
 * Supports GDPR, HIPAA, SOC2, and multi-language notifications
 */

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Types for notification templates
export interface NotificationTemplate {
  id: string;
  template_code: string;
  template_name: string;
  regulation: 'gdpr' | 'hipaa' | 'soc2' | 'general';
  breach_type?: string;
  language: string;
  subject_template: string;
  body_template: string;
  required_fields: string[];
  is_active: boolean;
  version: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  default_value?: string;
  validation_pattern?: string;
  examples: string[];
}

export interface NotificationContext {
  breach_incident_id: string;
  incident_id: string;
  organization_name: string;
  organization_address?: string;
  detected_at: Date;
  breach_type: string;
  affected_data_types: string[];
  estimated_records_affected?: number;
  risk_level: string;
  mitigation_measures: string[];
  contact_information: string;
  custom_fields?: Record<string, any>;
}

export interface RenderedNotification {
  subject: string;
  body: string;
  recipient_type: string;
  delivery_method: 'email' | 'sms' | 'mail' | 'phone' | 'portal' | 'in_person';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  attachments?: string[];
}

// Template variable schemas
const TemplateVariableSchema = z.object({
  name: z.string(),
  description: z.string(),
  required: z.boolean(),
  default_value: z.string().optional(),
  validation_pattern: z.string().optional(),
  examples: z.array(z.string())
});

// Main notification template engine
export class NotificationTemplateEngine {
  private supabase: any;
  private templates: Map<string, NotificationTemplate> = new Map();
  private templateVariables: Map<string, TemplateVariable> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initializeTemplates();
    this.initializeTemplateVariables();
  }

  /**
   * Initialize templates from database
   */
  private async initializeTemplates(): Promise<void> {
    try {
      const { data: templates, error } = await this.supabase
        .from('breach_notification_templates')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      for (const template of templates || []) {
        this.templates.set(template.template_code, template as NotificationTemplate);
      }

      console.log(`Initialized ${this.templates.size} notification templates`);
    } catch (error) {
      console.error('Failed to initialize notification templates:', error);
    }
  }

  /**
   * Initialize template variables
   */
  private initializeTemplateVariables(): void {
    const variables: TemplateVariable[] = [
      {
        name: 'incident_id',
        description: 'Unique identifier for the breach incident',
        required: true,
        examples: ['BR-2024-001', 'INC-2024-001-ABC']
      },
      {
        name: 'organization_name',
        description: 'Name of the organization experiencing the breach',
        required: true,
        examples: ['Acme Corporation', 'Healthcare Provider Inc.']
      },
      {
        name: 'organization_address',
        description: 'Physical address of the organization',
        required: false,
        examples: ['123 Main St, City, State 12345']
      },
      {
        name: 'detected_at',
        description: 'Date and time when the breach was detected',
        required: true,
        examples: ['2024-01-15 14:30:00 UTC', 'January 15, 2024 at 2:30 PM']
      },
      {
        name: 'breach_type',
        description: 'Type or category of the breach',
        required: true,
        examples: ['Unauthorized Access', 'Data Exfiltration', 'Malware Infection']
      },
      {
        name: 'affected_data_types',
        description: 'Types of data that were affected by the breach',
        required: true,
        examples: ['Personal identification information, health records', 'Email addresses, phone numbers']
      },
      {
        name: 'estimated_records_affected',
        description: 'Estimated number of records or individuals affected',
        required: false,
        examples: ['1,250 individuals', 'Approximately 500 records']
      },
      {
        name: 'risk_level',
        description: 'Assessed risk level of the breach',
        required: true,
        examples: ['High', 'Critical', 'Medium']
      },
      {
        name: 'mitigation_measures',
        description: 'Actions taken to mitigate the breach',
        required: true,
        examples: ['Systems isolated, passwords reset, monitoring increased']
      },
      {
        name: 'contact_information',
        description: 'Contact information for breach-related inquiries',
        required: true,
        examples: ['privacy@company.com', '1-800-555-0123']
      },
      {
        name: 'data_subject_name',
        description: 'Name of the affected individual (for individual notifications)',
        required: false,
        examples: ['John Doe', 'Jane Smith']
      },
      {
        name: 'breach_description',
        description: 'Detailed description of what happened',
        required: true,
        examples: ['Unauthorized access to customer database occurred on January 15, 2024']
      },
      {
        name: 'recommended_actions',
        description: 'Recommended actions for affected individuals',
        required: false,
        examples: ['Monitor your accounts', 'Change passwords', 'Contact credit bureaus']
      },
      {
        name: 'privacy_officer_contact',
        description: 'Contact information for privacy officer',
        required: false,
        examples: ['privacy.officer@company.com', '555-0101']
      },
      {
        name: 'breach_date',
        description: 'Date when the breach occurred',
        required: true,
        examples: ['2024-01-15', 'January 15, 2024']
      },
      {
        name: 'discovered_date',
        description: 'Date when the breach was discovered',
        required: true,
        examples: ['2024-01-16', 'January 16, 2024']
      },
      {
        name: 'individuals_affected',
        description: 'Number of individuals affected',
        required: false,
        examples: ['1,250', 'Approximately 500']
      },
      {
        name: 'affected_phi_types',
        description: 'Types of protected health information affected',
        required: false,
        examples: ['Medical history, treatment records', 'Diagnostic information']
      },
      {
        name: 'mitigation_steps',
        description: 'Steps taken to mitigate the breach',
        required: true,
        examples: ['Systems secured, notifications sent, monitoring enhanced']
      },
      {
        name: 'safeguards',
        description: 'Existing safeguards that were in place',
        required: false,
        examples: ['Encryption, access controls, monitoring systems']
      },
      {
        name: 'submitted_by',
        description: 'Name of person submitting the notification',
        required: true,
        examples: ['John Smith', 'Privacy Officer']
      },
      {
        name: 'submission_date',
        description: 'Date of notification submission',
        required: true,
        examples: ['2024-01-17', 'January 17, 2024']
      }
    ];

    for (const variable of variables) {
      this.templateVariables.set(variable.name, variable);
    }
  }

  /**
   * Get appropriate template for a breach incident
   */
  async getTemplateForIncident(
    incident: any,
    notificationType: string,
    language: string = 'en'
  ): Promise<NotificationTemplate | null> {
    // Try to find exact match first
    let templateKey = `${notificationType}_${language}`;

    if (this.templates.has(templateKey)) {
      return this.templates.get(templateKey)!;
    }

    // Try without language for fallback
    const typeOnly = notificationType.split('_')[0];
    templateKey = `${typeOnly}_${language}`;

    if (this.templates.has(templateKey)) {
      return this.templates.get(templateKey)!;
    }

    // Try general template for the regulation
    const regulation = this.determineRegulation(notificationType);
    templateKey = `general_${regulation}_${language}`;

    if (this.templates.has(templateKey)) {
      return this.templates.get(templateKey)!;
    }

    // Final fallback to general English template
    return this.templates.get('general_general_en') || null;
  }

  /**
   * Render notification content from template
   */
  async renderNotification(
    template: NotificationTemplate,
    context: NotificationContext,
    customFields?: Record<string, any>
  ): Promise<RenderedNotification> {
    // Validate required fields
    this.validateTemplateContext(template, context);

    // Merge context with custom fields
    const mergedContext = { ...context, ...customFields };

    // Render subject and body
    const subject = this.renderTemplate(template.subject_template, mergedContext);
    const body = this.renderTemplate(template.body_template, mergedContext);

    // Determine delivery method and priority
    const deliveryMethod = this.determineDeliveryMethod(template, context);
    const priority = this.determinePriority(template, context);

    return {
      subject,
      body,
      recipient_type: this.determineRecipientType(template),
      delivery_method: deliveryMethod,
      priority,
      attachments: this.determineAttachments(template, context)
    };
  }

  /**
   * Create a new notification template
   */
  async createTemplate(templateData: {
    template_code: string;
    template_name: string;
    regulation: 'gdpr' | 'hipaa' | 'soc2' | 'general';
    breach_type?: string;
    language?: string;
    subject_template: string;
    body_template: string;
    required_fields: string[];
    created_by: string;
  }): Promise<NotificationTemplate> {
    const template: Omit<NotificationTemplate, 'id' | 'version' | 'created_at' | 'updated_at'> = {
      template_code: templateData.template_code,
      template_name: templateData.template_name,
      regulation: templateData.regulation,
      breach_type: templateData.breach_type,
      language: templateData.language || 'en',
      subject_template: templateData.subject_template,
      body_template: templateData.body_template,
      required_fields: templateData.required_fields,
      is_active: true,
      created_by: templateData.created_by
    };

    // Store in database
    const { data, error } = await this.supabase
      .from('breach_notification_templates')
      .insert([template])
      .select()
      .single();

    if (error) {
      console.error('Failed to create notification template:', error);
      throw error;
    }

    // Cache the new template
    this.templates.set(template.template_code, data as NotificationTemplate);

    return data as NotificationTemplate;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateCode: string,
    updates: Partial<NotificationTemplate>,
    updatedBy: string
  ): Promise<NotificationTemplate> {
    // Get current template
    const currentTemplate = this.templates.get(templateCode);
    if (!currentTemplate) {
      throw new Error(`Template ${templateCode} not found`);
    }

    // Create new version
    const updatedTemplate: Omit<NotificationTemplate, 'id' | 'created_at'> = {
      ...currentTemplate,
      ...updates,
      version: currentTemplate.version + 1,
      updated_at: new Date()
    };

    // Store in database
    const { data, error } = await this.supabase
      .from('breach_notification_templates')
      .update(updatedTemplate)
      .eq('template_code', templateCode)
      .select()
      .single();

    if (error) {
      console.error('Failed to update notification template:', error);
      throw error;
    }

    // Update cache
    this.templates.set(templateCode, data as NotificationTemplate);

    return data as NotificationTemplate;
  }

  /**
   * Get all available template variables
   */
  getTemplateVariables(): TemplateVariable[] {
    return Array.from(this.templateVariables.values());
  }

  /**
   * Validate template context against required fields
   */
  private validateTemplateContext(template: NotificationTemplate, context: NotificationContext): void {
    const missingFields: string[] = [];

    for (const field of template.required_fields) {
      if (!(field in context) && (!context.custom_fields || !(field in context.custom_fields))) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields for template ${template.template_code}: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Render template with context variables
   */
  private renderTemplate(template: string, context: Record<string, any>): string {
    let rendered = template;

    // Replace all variables in the template
    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{${key}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value || ''));
    }

    return rendered;
  }

  /**
   * Determine regulation from notification type
   */
  private determineRegulation(notificationType: string): string {
    if (notificationType.includes('gdpr')) return 'gdpr';
    if (notificationType.includes('hipaa')) return 'hipaa';
    if (notificationType.includes('soc2')) return 'soc2';
    return 'general';
  }

  /**
   * Determine delivery method based on template and context
   */
  private determineDeliveryMethod(template: NotificationTemplate, context: NotificationContext): RenderedNotification['delivery_method'] {
    // Priority order for delivery methods
    if (template.regulation === 'gdpr' && context.risk_level === 'critical') {
      return 'email'; // GDPR requires written notification for high-risk breaches
    }

    if (template.regulation === 'hipaa') {
      return 'mail'; // HIPAA often requires physical mail for formal notifications
    }

    // Default to email for most notifications
    return 'email';
  }

  /**
   * Determine priority based on template and context
   */
  private determinePriority(template: NotificationTemplate, context: NotificationContext): RenderedNotification['priority'] {
    if (context.risk_level === 'critical') return 'urgent';
    if (context.risk_level === 'high') return 'high';
    if (context.risk_level === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Determine recipient type from template
   */
  private determineRecipientType(template: NotificationTemplate): string {
    if (template.template_code.includes('data_subject') || template.template_code.includes('individual')) {
      return 'individual';
    }
    if (template.template_code.includes('supervisory_authority') || template.template_code.includes('hhs')) {
      return 'regulator';
    }
    if (template.template_code.includes('stakeholder') || template.template_code.includes('board')) {
      return 'internal';
    }
    return 'organization';
  }

  /**
   * Determine required attachments
   */
  private determineAttachments(template: NotificationTemplate, context: NotificationContext): string[] {
    const attachments: string[] = [];

    if (template.regulation === 'gdpr') {
      attachments.push('breach_assessment_report');
      attachments.push('timeline_documentation');
    }

    if (template.regulation === 'hipaa') {
      attachments.push('breach_risk_assessment');
      attachments.push('notification_decision_rationale');
    }

    if (template.regulation === 'soc2') {
      attachments.push('incident_response_report');
    }

    return attachments;
  }

  /**
   * Get template preview with sample data
   */
  async getTemplatePreview(templateCode: string, sampleData?: Record<string, any>): Promise<RenderedNotification> {
    const template = this.templates.get(templateCode);
    if (!template) {
      throw new Error(`Template ${templateCode} not found`);
    }

    // Use sample data or generate default sample data
    const context: NotificationContext = sampleData ? (sampleData as NotificationContext) : this.generateSampleContext(template);

    return await this.renderNotification(template, context);
  }

  /**
   * Generate sample context for template preview
   */
  private generateSampleContext(template: NotificationTemplate): NotificationContext {
    const baseContext: NotificationContext = {
      breach_incident_id: 'sample-incident-001',
      incident_id: 'BR-2024-001',
      organization_name: 'Sample Healthcare Organization',
      detected_at: new Date(),
      breach_type: 'Unauthorized Access',
      affected_data_types: ['Protected Health Information', 'Personal Identification Information'],
      estimated_records_affected: 1250,
      risk_level: 'high',
      mitigation_measures: [
        'Isolated affected systems',
        'Reset all compromised credentials',
        'Enhanced monitoring and logging',
        'Notified affected individuals'
      ],
      contact_information: 'privacy@samplehealthcare.com | 1-800-555-0123'
    };

    // Add regulation-specific sample data
    if (template.regulation === 'gdpr') {
      baseContext.custom_fields = {
        supervisory_authority: 'Data Protection Authority',
        dpo_contact: 'dpo@samplehealthcare.com'
      };
    }

    if (template.regulation === 'hipaa') {
      baseContext.custom_fields = {
        privacy_officer: 'Privacy Officer',
        hhs_reference: 'HHS-OCR-REF-2024-001'
      };
    }

    return baseContext;
  }

  /**
   * Validate template syntax
   */
  validateTemplateSyntax(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const variablePattern = /\{([^}]+)\}/g;
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      const variableName = match[1];
      if (!this.templateVariables.has(variableName)) {
        errors.push(`Unknown template variable: {${variableName}}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get templates by regulation
   */
  getTemplatesByRegulation(regulation: string): NotificationTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.regulation === regulation);
  }

  /**
   * Get templates by breach type
   */
  getTemplatesByBreachType(breachType: string): NotificationTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.breach_type === breachType);
  }

  /**
   * Export template for backup or migration
   */
  exportTemplate(templateCode: string): NotificationTemplate | null {
    return this.templates.get(templateCode) || null;
  }

  /**
   * Import template from backup
   */
  async importTemplate(templateData: NotificationTemplate): Promise<void> {
    this.templates.set(templateData.template_code, templateData);

    // Store in database
    const { error } = await this.supabase
      .from('breach_notification_templates')
      .upsert([templateData], { onConflict: 'template_code' });

    if (error) {
      console.error('Failed to import notification template:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationTemplateEngine = new NotificationTemplateEngine(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);