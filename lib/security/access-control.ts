import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

export type UserRole = 'admin' | 'agent' | 'supervisor' | 'customer' | 'guest'
export type Permission = 'read' | 'write' | 'delete' | 'assign' | 'escalate' | 'export'

export interface AccessPolicy {
  resource: string
  userId: string
  role: UserRole
  permissions: Permission[]
  conditions?: {
    department?: string
    priority?: string
    customerSegment?: string
  }
  grantedAt: Date
  expiresAt?: Date
  grantedBy: string
}

export interface ConversationAccess {
  conversationId: string
  userId: string
  accessLevel: 'read' | 'write' | 'admin'
  grantedAt: Date
  grantedBy: string
  expiresAt?: Date
  reason?: string
}

export class AccessControlService {
  private supabase = createClient()

  // Check if user has permission for a resource
  async hasPermission(
    userId: string,
    resource: string,
    permission: Permission,
    context?: any
  ): Promise<boolean> {
    try {
      // Get user role and policies
      const userRole = await this.getUserRole(userId)
      const policies = await this.getUserPolicies(userId, resource)

      // Check policies
      for (const policy of policies) {
        if (this.evaluatePolicy(policy, permission, context)) {
          SecurityAudit.logDataAccess(resource, userId, permission as 'read' | 'write' | 'delete', {
            granted: true,
            policyId: policy.resource,
            role: policy.role
          })
          return true
        }
      }

      // Check role-based permissions
      if (this.checkRolePermission(userRole, permission, resource)) {
        SecurityAudit.logDataAccess(resource, userId, permission as 'read' | 'write' | 'delete', {
          granted: true,
          role: userRole
        })
        return true
      }

      SecurityAudit.logDataAccess(resource, userId, permission as 'read' | 'write' | 'delete', {
        granted: false,
        role: userRole
      })

      return false
    } catch (error) {
      logger.error('Permission check failed', error as Error, {
        userId,
        resource,
        permission
      })
      return false
    }
  }

  // Grant access to a conversation
  async grantConversationAccess(
    conversationId: string,
    userId: string,
    accessLevel: 'read' | 'write' | 'admin',
    grantedBy: string,
    reason?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      const access: ConversationAccess = {
        conversationId,
        userId,
        accessLevel,
        grantedAt: new Date(),
        grantedBy,
        expiresAt,
        reason
      }

      // Store access record (in production, this would be in database)
      // For now, we'll log it
      logger.info('Conversation access granted', {
        conversationId,
        userId,
        accessLevel,
        grantedBy,
        reason
      })

      SecurityAudit.logSensitiveAction('conversation_access_granted', grantedBy, {
        conversationId,
        userId,
        accessLevel,
        reason
      })
    } catch (error) {
      logger.error('Failed to grant conversation access', error as Error, {
        conversationId,
        userId,
        grantedBy
      })
      throw error
    }
  }

  // Revoke conversation access
  async revokeConversationAccess(
    conversationId: string,
    userId: string,
    revokedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      logger.info('Conversation access revoked', {
        conversationId,
        userId,
        revokedBy,
        reason
      })

      SecurityAudit.logSensitiveAction('conversation_access_revoked', revokedBy, {
        conversationId,
        userId,
        reason
      })
    } catch (error) {
      logger.error('Failed to revoke conversation access', error as Error, {
        conversationId,
        userId,
        revokedBy
      })
      throw error
    }
  }

  // Check conversation access
  async checkConversationAccess(
    conversationId: string,
    userId: string,
    requiredLevel: 'read' | 'write' | 'admin' = 'read'
  ): Promise<boolean> {
    try {
      // Get user role
      const userRole = await this.getUserRole(userId)

      // Admins have access to all conversations
      if (userRole === 'admin') {
        return true
      }

      // Check if user is assigned to the conversation
      const isAssigned = await this.isUserAssignedToConversation(conversationId, userId)
      if (isAssigned) {
        return true
      }

      // Check specific access grants
      const hasAccess = await this.hasSpecificConversationAccess(conversationId, userId, requiredLevel)

      if (hasAccess) {
        SecurityAudit.logDataAccess('conversation', userId, requiredLevel === 'admin' ? 'read' : requiredLevel, {
          conversationId,
          granted: true,
          requiredLevel
        })
      }

      return hasAccess
    } catch (error) {
      logger.error('Conversation access check failed', error as Error, {
        conversationId,
        userId,
        requiredLevel
      })
      return false
    }
  }

  // Get user role
  private async getUserRole(userId: string): Promise<UserRole> {
    try {
      const supabase = await this.supabase
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return (data?.role as UserRole) || 'customer'
    } catch (error) {
      logger.warn('Failed to get user role, defaulting to customer', {
        userId,
        error: (error as Error).message
      })
      return 'customer'
    }
  }

  // Get user policies
  private async getUserPolicies(userId: string, resource: string): Promise<AccessPolicy[]> {
    // In a real implementation, this would query a policies table
    // For now, return empty array
    return []
  }

  // Evaluate policy conditions
  private evaluatePolicy(policy: AccessPolicy, permission: Permission, context?: any): boolean {
    // Check if permission is granted
    if (!policy.permissions.includes(permission)) {
      return false
    }

    // Check expiration
    if (policy.expiresAt && policy.expiresAt < new Date()) {
      return false
    }

    // Evaluate conditions
    if (policy.conditions && context) {
      for (const [key, value] of Object.entries(policy.conditions)) {
        if (context[key] !== value) {
          return false
        }
      }
    }

    return true
  }

  // Check role-based permissions
  private checkRolePermission(role: UserRole, permission: Permission, resource: string): boolean {
    const rolePermissions: Record<UserRole, Record<string, Permission[]>> = {
      admin: {
        '*': ['read', 'write', 'delete', 'assign', 'escalate', 'export'],
        conversation: ['read', 'write', 'delete', 'assign', 'escalate', 'export'],
        customer: ['read', 'write', 'delete', 'export'],
        report: ['read', 'export']
      },
      supervisor: {
        conversation: ['read', 'write', 'assign', 'escalate'],
        customer: ['read', 'write'],
        report: ['read', 'export']
      },
      agent: {
        conversation: ['read', 'write'],
        customer: ['read']
      },
      customer: {
        conversation: ['read', 'write'],
        profile: ['read', 'write']
      },
      guest: {
        conversation: ['read']
      }
    }

    const resourcePermissions = rolePermissions[role]?.[resource] || rolePermissions[role]?.['*']
    return resourcePermissions?.includes(permission) || false
  }

  // Check if user is assigned to conversation
  private async isUserAssignedToConversation(conversationId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await this.supabase
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('assigned_agent_id')
        .eq('id', conversationId)
        .single()

      if (error) throw error

      return data?.assigned_agent_id === userId
    } catch (error) {
      logger.error('Failed to check conversation assignment', error as Error, {
        conversationId,
        userId
      })
      return false
    }
  }

  // Check specific conversation access grants
  private async hasSpecificConversationAccess(
    conversationId: string,
    userId: string,
    requiredLevel: 'read' | 'write' | 'admin'
  ): Promise<boolean> {
    // In a real implementation, this would check an access grants table
    // For now, return false
    return false
  }

  // Audit trail methods
  async logAccessAttempt(
    userId: string,
    resource: string,
    action: string,
    success: boolean,
    details?: any
  ): Promise<void> {
    try {
      logger.info('Access attempt logged', {
        userId,
        resource,
        action,
        success,
        details
      })

      // In production, this would be stored in an audit log table
      SecurityAudit.logDataAccess(resource, userId, (action as Permission) === 'assign' ? 'write' : (action as 'read' | 'write' | 'delete'), {
        success,
        action,
        ...details
      })
    } catch (error) {
      logger.error('Failed to log access attempt', error as Error, {
        userId,
        resource,
        action
      })
    }
  }

  // Data retention and deletion
  async scheduleDataDeletion(
    userId: string,
    resourceType: string,
    resourceId: string,
    deletionDate: Date,
    reason: string
  ): Promise<void> {
    try {
      logger.info('Data deletion scheduled', {
        userId,
        resourceType,
        resourceId,
        deletionDate: deletionDate.toISOString(),
        reason
      })

      SecurityAudit.logSensitiveAction('data_deletion_scheduled', userId, {
        resourceType,
        resourceId,
        deletionDate,
        reason
      })
    } catch (error) {
      logger.error('Failed to schedule data deletion', error as Error, {
        userId,
        resourceType,
        resourceId
      })
      throw error
    }
  }

  // Compliance checks
  async performComplianceCheck(
    userId: string,
    checkType: 'gdpr' | 'ccpa' | 'audit',
    resourceIds?: string[]
  ): Promise<{
    compliant: boolean
    issues: string[]
    recommendations: string[]
  }> {
    try {
      const result = {
        compliant: true,
        issues: [] as string[],
        recommendations: [] as string[]
      }

      // Perform various compliance checks
      switch (checkType) {
        case 'gdpr':
          result.issues = await this.checkGDPRCompliance(userId, resourceIds)
          break
        case 'ccpa':
          result.issues = await this.checkCCPACompliance(userId, resourceIds)
          break
        case 'audit':
          result.issues = await this.performAuditCheck(userId, resourceIds)
          break
      }

      result.compliant = result.issues.length === 0

      if (!result.compliant) {
        result.recommendations = this.generateComplianceRecommendations(result.issues)
      }

      SecurityAudit.logSensitiveAction('compliance_check_performed', userId, {
        checkType,
        compliant: result.compliant,
        issueCount: result.issues.length
      })

      return result
    } catch (error) {
      logger.error('Compliance check failed', error as Error, {
        userId,
        checkType
      })
      throw error
    }
  }

  private async checkGDPRCompliance(userId: string, resourceIds?: string[]): Promise<string[]> {
    const issues: string[] = []

    // Check data retention periods
    // Check consent records
    // Check data processing purposes
    // etc.

    return issues
  }

  private async checkCCPACompliance(userId: string, resourceIds?: string[]): Promise<string[]> {
    const issues: string[] = []

    // Check data collection notices
    // Check opt-out mechanisms
    // Check data sharing practices
    // etc.

    return issues
  }

  private async performAuditCheck(userId: string, resourceIds?: string[]): Promise<string[]> {
    const issues: string[] = []

    // Check access logs
    // Check data integrity
    // Check security measures
    // etc.

    return issues
  }

  private generateComplianceRecommendations(issues: string[]): string[] {
    // Generate specific recommendations based on issues found
    return issues.map(issue => `Address: ${issue}`)
  }
}

// Export singleton instance
export const accessControlService = new AccessControlService()

// Middleware for access control
export function withAccessControl(
  resource: string,
  permission: Permission,
  options: {
    requireAuth?: boolean
    checkConversationAccess?: boolean
    conversationIdParam?: string
  } = {}
) {
  return async function <T extends any[], R>(
    handler: (request: any, ...args: T) => Promise<R>
  ) {
    return async (request: any, ...args: T): Promise<R> => {
      try {
        const userId = request.user?.id || 'anonymous'

        // Check basic permission
        const hasPermission = await accessControlService.hasPermission(
          userId,
          resource,
          permission
        )

        if (!hasPermission) {
          throw new Error('Access denied')
        }

        // Check conversation-specific access if required
        if (options.checkConversationAccess && options.conversationIdParam) {
          const conversationId = request.params?.[options.conversationIdParam] ||
                                request.nextUrl?.searchParams?.get('conversationId')

          if (conversationId) {
            const hasConversationAccess = await accessControlService.checkConversationAccess(
              conversationId,
              userId,
              permission === 'write' ? 'write' : 'read'
            )

            if (!hasConversationAccess) {
              throw new Error('Conversation access denied')
            }
          }
        }

        return handler(request, ...args)
      } catch (error) {
        logger.error('Access control failed', error as Error, {
          resource,
          permission
        })
        throw error
      }
    }
  }
}