import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

export interface BAATemplate {
  id: string
  userId: string
  name: string
  description: string
  templateType: 'standard' | 'custom' | 'enterprise'
  templateContent: {
    sections: Array<{
      title: string
      content: string
      order: number
    }>
    requiredClauses: string[]
  }
  defaultVariables: Record<string, any>
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface BAATemplateVersion {
  id: string
  templateId: string
  versionNumber: string
  versionNotes: string
  templateContent: BAATemplate['templateContent']
  defaultVariables: Record<string, any>
  isCurrent: boolean
  createdBy: string
  createdAt: Date
}

export interface TemplateCustomization {
  templateId: string
  versionId: string
  customVariables: Record<string, any>
  customizedContent?: {
    sections: Array<{
      title: string
      content: string
      order: number
    }>
  }
}

export class BAATemplateService {
  private supabase = createClient()

  /**
   * Create a new BAA template with version control
   * HIPAA Compliance: Ensures standardized templates with audit trail
   */
  async createTemplate(
    userId: string,
    templateData: Omit<BAATemplate, 'id' | 'createdAt' | 'updatedAt'>,
    versionNotes = 'Initial template version'
  ): Promise<{ template: BAATemplate; version: BAATemplateVersion }> {
    try {
      const supabase = await this.supabase

      // Start transaction
      const { data: template, error: templateError } = await supabase
        .from('baa_templates')
        .insert({
          user_id: userId,
          name: templateData.name,
          description: templateData.description,
          template_type: templateData.templateType,
          template_content: templateData.templateContent,
          default_variables: templateData.defaultVariables,
          is_active: templateData.isActive,
          created_by: userId
        })
        .select()
        .single()

      if (templateError) throw templateError

      // Create initial version
      const versionNumber = '1.0.0'
      const { data: version, error: versionError } = await supabase
        .from('baa_template_versions')
        .insert({
          template_id: template.id,
          version_number: versionNumber,
          version_notes: versionNotes,
          template_content: templateData.templateContent,
          default_variables: templateData.defaultVariables,
          is_current: true,
          created_by: userId
        })
        .select()
        .single()

      if (versionError) throw versionError

      // Log audit trail
      await this.logAuditEvent(userId, 'template_created', 'template', template.id, {
        templateName: templateData.name,
        versionNumber
      })

      SecurityAudit.logSensitiveAction('baa_template_created', userId, {
        templateId: template.id,
        templateName: templateData.name,
        templateType: templateData.templateType
      })

      return {
        template: this.mapTemplateFromDB(template),
        version: this.mapVersionFromDB(version)
      }
    } catch (error) {
      logger.error('Failed to create BAA template', error as Error, {
        userId,
        templateName: templateData.name
      })
      throw error
    }
  }

  /**
   * Create a new version of an existing template
   * HIPAA Compliance: Maintains version history for compliance tracking
   */
  async createTemplateVersion(
    userId: string,
    templateId: string,
    versionData: {
      versionNumber: string
      versionNotes: string
      templateContent: BAATemplate['templateContent']
      defaultVariables: Record<string, any>
    }
  ): Promise<BAATemplateVersion> {
    try {
      const supabase = await this.supabase

      // Verify template ownership
      const { data: template, error: templateError } = await supabase
        .from('baa_templates')
        .select('user_id')
        .eq('id', templateId)
        .single()

      if (templateError) throw templateError
      if (template.user_id !== userId) {
        throw new Error('Access denied: Template not owned by user')
      }

      // Set previous version as not current
      await supabase
        .from('baa_template_versions')
        .update({ is_current: false })
        .eq('template_id', templateId)
        .eq('is_current', true)

      // Create new version
      const { data: version, error: versionError } = await supabase
        .from('baa_template_versions')
        .insert({
          template_id: templateId,
          version_number: versionData.versionNumber,
          version_notes: versionData.versionNotes,
          template_content: versionData.templateContent,
          default_variables: versionData.defaultVariables,
          is_current: true,
          created_by: userId
        })
        .select()
        .single()

      if (versionError) throw versionError

      // Update template's updated_at timestamp
      await supabase
        .from('baa_templates')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', templateId)

      // Log audit trail
      await this.logAuditEvent(userId, 'template_versioned', 'template', templateId, {
        versionNumber: versionData.versionNumber,
        previousVersion: 'current'
      })

      SecurityAudit.logSensitiveAction('baa_template_versioned', userId, {
        templateId,
        versionNumber: versionData.versionNumber,
        versionNotes: versionData.versionNotes
      })

      return this.mapVersionFromDB(version)
    } catch (error) {
      logger.error('Failed to create template version', error as Error, {
        userId,
        templateId,
        versionNumber: versionData.versionNumber
      })
      throw error
    }
  }

  /**
   * Get all templates for a user with current version info
   * HIPAA Compliance: Provides controlled access to template library
   */
  async getUserTemplates(userId: string): Promise<(BAATemplate & { currentVersion: BAATemplateVersion })[]> {
    try {
      const supabase = await this.supabase

      const { data: templates, error } = await supabase
        .from('baa_templates')
        .select(`
          *,
          current_version:baa_template_versions!inner(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      return templates.map(template => ({
        ...this.mapTemplateFromDB(template),
        currentVersion: this.mapVersionFromDB(template.current_version)
      }))
    } catch (error) {
      logger.error('Failed to get user templates', error as Error, { userId })
      throw error
    }
  }

  /**
   * Get a specific template with all versions
   * HIPAA Compliance: Provides complete version history for compliance
   */
  async getTemplateWithVersions(userId: string, templateId: string): Promise<{
    template: BAATemplate
    versions: BAATemplateVersion[]
  }> {
    try {
      const supabase = await this.supabase

      // Get template
      const { data: template, error: templateError } = await supabase
        .from('baa_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (templateError) throw templateError
      if (template.user_id !== userId) {
        throw new Error('Access denied: Template not owned by user')
      }

      // Get all versions
      const { data: versions, error: versionsError } = await supabase
        .from('baa_template_versions')
        .select('*')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })

      if (versionsError) throw versionsError

      return {
        template: this.mapTemplateFromDB(template),
        versions: versions.map(v => this.mapVersionFromDB(v))
      }
    } catch (error) {
      logger.error('Failed to get template with versions', error as Error, {
        userId,
        templateId
      })
      throw error
    }
  }

  /**
   * Generate customized BAA content from template
   * HIPAA Compliance: Ensures consistent customization with audit trail
   */
  async generateCustomizedBAA(
    userId: string,
    templateId: string,
    customVariables: Record<string, any>
  ): Promise<{
    template: BAATemplate
    customizedContent: {
      sections: Array<{
        title: string
        content: string
        order: number
      }>
    }
    variables: Record<string, any>
  }> {
    try {
      const supabase = await this.supabase

      // Get template with current version
      const { data: template, error: templateError } = await supabase
        .from('baa_templates')
        .select(`
          *,
          current_version:baa_template_versions!inner(*)
        `)
        .eq('id', templateId)
        .single()

      if (templateError) throw templateError
      if (template.user_id !== userId) {
        throw new Error('Access denied: Template not owned by user')
      }

      // Merge default variables with custom variables
      const mergedVariables = {
        ...template.current_version.default_variables,
        ...customVariables
      }

      // Generate customized content
      const customizedSections = template.current_version.template_content.sections.map((section: any) => ({
        ...section,
        content: this.interpolateVariables(section.content, mergedVariables)
      }))

      const customizedContent = {
        sections: customizedSections
      }

      // Log customization activity
      await this.logAuditEvent(userId, 'template_customized', 'template', templateId, {
        customVariables: Object.keys(customVariables),
        sectionsCustomized: customizedSections.length
      })

      SecurityAudit.logSensitiveAction('baa_template_customized', userId, {
        templateId,
        templateName: template.name,
        customVariables: Object.keys(customVariables)
      })

      return {
        template: this.mapTemplateFromDB(template),
        customizedContent,
        variables: mergedVariables
      }
    } catch (error) {
      logger.error('Failed to generate customized BAA', error as Error, {
        userId,
        templateId,
        customVariables: Object.keys(customVariables)
      })
      throw error
    }
  }

  /**
   * Deactivate a template (soft delete)
   * HIPAA Compliance: Maintains audit trail for deactivated templates
   */
  async deactivateTemplate(userId: string, templateId: string, reason: string): Promise<void> {
    try {
      const supabase = await this.supabase

      // Verify ownership and deactivate
      const { error } = await supabase
        .from('baa_templates')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .eq('user_id', userId)

      if (error) throw error

      // Log audit trail
      await this.logAuditEvent(userId, 'template_deactivated', 'template', templateId, {
        reason,
        deactivatedAt: new Date().toISOString()
      })

      SecurityAudit.logSensitiveAction('baa_template_deactivated', userId, {
        templateId,
        reason
      })
    } catch (error) {
      logger.error('Failed to deactivate template', error as Error, {
        userId,
        templateId,
        reason
      })
      throw error
    }
  }

  /**
   * Get template statistics for compliance reporting
   * HIPAA Compliance: Provides metrics for compliance monitoring
   */
  async getTemplateStatistics(userId: string): Promise<{
    totalTemplates: number
    activeTemplates: number
    totalVersions: number
    templatesByType: Record<string, number>
  }> {
    try {
      const supabase = await this.supabase

      // Get template counts with IDs
      const { data: templateStats, error: templateError } = await supabase
        .from('baa_templates')
        .select('id, template_type, is_active')
        .eq('user_id', userId)

      if (templateError) throw templateError

      // Get template IDs for version query
      const templateIds = templateStats.map(t => t.id)

      // Get version counts
      const { data: versionStats, error: versionError } = await supabase
        .from('baa_template_versions')
        .select('template_id')
        .in('template_id', templateIds)

      if (versionError) throw versionError

      const totalTemplates = templateStats.length
      const activeTemplates = templateStats.filter(t => t.is_active).length
      const totalVersions = versionStats.length

      const templatesByType = templateStats.reduce((acc, template) => {
        acc[template.template_type] = (acc[template.template_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        totalTemplates,
        activeTemplates,
        totalVersions,
        templatesByType
      }
    } catch (error) {
      logger.error('Failed to get template statistics', error as Error, { userId })
      throw error
    }
  }

  // Private helper methods

  private async logAuditEvent(
    userId: string,
    activityType: string,
    entityType: string,
    entityId: string,
    metadata: any
  ): Promise<void> {
    try {
      const supabase = await this.supabase

      await supabase
        .from('baa_audit_logs')
        .insert({
          user_id: userId,
          activity_type: activityType,
          entity_type: entityType,
          entity_id: entityId,
          description: `${activityType} performed on ${entityType}`,
          metadata: metadata,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      logger.error('Failed to log audit event', error as Error, {
        userId,
        activityType,
        entityType,
        entityId
      })
    }
  }

  private interpolateVariables(content: string, variables: Record<string, any>): string {
    let result = content
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `[${key.toUpperCase()}]`
      result = result.replace(new RegExp(placeholder, 'g'), String(value))
    }
    return result
  }

  private mapTemplateFromDB(data: any): BAATemplate {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      templateType: data.template_type,
      templateContent: data.template_content,
      defaultVariables: data.default_variables,
      isActive: data.is_active,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  private mapVersionFromDB(data: any): BAATemplateVersion {
    return {
      id: data.id,
      templateId: data.template_id,
      versionNumber: data.version_number,
      versionNotes: data.version_notes,
      templateContent: data.template_content,
      defaultVariables: data.default_variables,
      isCurrent: data.is_current,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at)
    }
  }
}

// Export singleton instance
export const baaTemplateService = new BAATemplateService()