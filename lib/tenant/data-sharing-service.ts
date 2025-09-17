import { createClient } from '@/lib/supabase/server'
import { tenantService } from '@/lib/tenant/tenant-service'
import { logger } from '@/lib/logger'
import { ValidationError, AuthorizationError } from '@/lib/errors'

// Data sharing types
export type SharingScope = 'public' | 'tenants' | 'partners' | 'private'
export type ResourceType = 'knowledge_base' | 'template' | 'workflow' | 'campaign' | 'integration'

export interface SharedResource {
  id: string
  tenant_id: string
  resource_type: ResourceType
  resource_id: string
  title: string
  description?: string
  sharing_scope: SharingScope
  allowed_tenants?: string[] // For 'tenants' scope
  partner_tenants?: string[] // For 'partners' scope
  tags: string[]
  metadata: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SharingRequest {
  id: string
  from_tenant_id: string
  to_tenant_id: string
  resource_type: ResourceType
  resource_id: string
  request_message?: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
}

export interface DataSharingPermissions {
  canShare: boolean
  canViewShared: boolean
  canRequestAccess: boolean
  allowedScopes: SharingScope[]
}

export class DataSharingService {
  private async getSupabase() {
    return await createClient()
  }

  /**
   * Share a resource with specified scope
   */
  async shareResource(
    tenantId: string,
    resourceType: ResourceType,
    resourceId: string,
    sharingScope: SharingScope,
    options: {
      title: string
      description?: string
      allowedTenants?: string[]
      partnerTenants?: string[]
      tags?: string[]
      metadata?: Record<string, any>
    },
    userId: string
  ): Promise<SharedResource> {
    await tenantService.checkPermission(userId, tenantId, 'data:write')

    const supabase = await this.getSupabase()

    // Validate sharing scope permissions
    const permissions = await this.getSharingPermissions(tenantId, userId)
    if (!permissions.allowedScopes.includes(sharingScope)) {
      throw new AuthorizationError(`Sharing scope '${sharingScope}' not allowed`)
    }

    // Validate allowed tenants exist and user has access
    if (sharingScope === 'tenants' && options.allowedTenants) {
      for (const allowedTenantId of options.allowedTenants) {
        await tenantService.checkTenantAccess(userId, allowedTenantId)
      }
    }

    const { data: sharedResource, error } = await supabase
      .from('shared_resources')
      .insert({
        tenant_id: tenantId,
        resource_type: resourceType,
        resource_id: resourceId,
        title: options.title,
        description: options.description,
        sharing_scope: sharingScope,
        allowed_tenants: options.allowedTenants,
        partner_tenants: options.partnerTenants,
        tags: options.tags || [],
        metadata: options.metadata || {},
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    logger.info('Resource shared successfully', {
      tenantId,
      resourceType,
      resourceId,
      sharingScope,
      userId
    })

    return sharedResource
  }

  /**
   * Get shared resources accessible to a tenant
   */
  async getSharedResources(
    tenantId: string,
    userId: string,
    filters?: {
      resourceType?: ResourceType
      sharingScope?: SharingScope
      tags?: string[]
    }
  ): Promise<SharedResource[]> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    let query = supabase
      .from('shared_resources')
      .select('*')
      .eq('is_active', true)
      .or(`sharing_scope.eq.public,sharing_scope.eq.tenants,and(sharing_scope.eq.tenants,allowed_tenants.cs.{${tenantId}})`)
      .neq('tenant_id', tenantId) // Exclude own resources

    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType)
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags)
    }

    const { data: resources, error } = await query

    if (error) throw error

    return resources || []
  }

  /**
   * Request access to a shared resource
   */
  async requestResourceAccess(
    fromTenantId: string,
    toTenantId: string,
    resourceType: ResourceType,
    resourceId: string,
    requestMessage: string,
    userId: string
  ): Promise<SharingRequest> {
    await tenantService.checkTenantAccess(userId, fromTenantId)

    const supabase = await this.getSupabase()

    // Check if resource exists and is shareable
    const { data: resource, error: resourceError } = await supabase
      .from('shared_resources')
      .select('*')
      .eq('tenant_id', toTenantId)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .eq('is_active', true)
      .single()

    if (resourceError || !resource) {
      throw new ValidationError('Resource not found or not shareable')
    }

    // Check if request already exists
    const { data: existingRequest } = await supabase
      .from('sharing_requests')
      .select('id')
      .eq('from_tenant_id', fromTenantId)
      .eq('to_tenant_id', toTenantId)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .eq('status', 'pending')
      .single()

    if (existingRequest) {
      throw new ValidationError('Access request already pending')
    }

    const { data: request, error } = await supabase
      .from('sharing_requests')
      .insert({
        from_tenant_id: fromTenantId,
        to_tenant_id: toTenantId,
        resource_type: resourceType,
        resource_id: resourceId,
        request_message: requestMessage,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    logger.info('Resource access requested', {
      fromTenantId,
      toTenantId,
      resourceType,
      resourceId,
      userId
    })

    return request
  }

  /**
   * Approve or reject sharing request
   */
  async reviewSharingRequest(
    requestId: string,
    action: 'approve' | 'reject',
    reviewerTenantId: string,
    reviewerUserId: string,
    reviewMessage?: string
  ): Promise<SharingRequest> {
    const supabase = await this.getSupabase()

    // Get the request
    const { data: request, error: getError } = await supabase
      .from('sharing_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (getError || !request) {
      throw new ValidationError('Sharing request not found')
    }

    // Verify reviewer has permission (must be from target tenant)
    if (request.to_tenant_id !== reviewerTenantId) {
      throw new AuthorizationError('Not authorized to review this request')
    }

    await tenantService.checkPermission(reviewerUserId, reviewerTenantId, 'data:write')

    const { data: updatedRequest, error } = await supabase
      .from('sharing_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: reviewerUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single()

    if (error) throw error

    // If approved, update the shared resource to include the requesting tenant
    if (action === 'approve') {
      // First get current allowed tenants
      const { data: resource } = await supabase
        .from('shared_resources')
        .select('allowed_tenants')
        .eq('tenant_id', request.to_tenant_id)
        .eq('resource_type', request.resource_type)
        .eq('resource_id', request.resource_id)
        .single()

      const currentTenants = resource?.allowed_tenants || []
      const updatedTenants = [...currentTenants, request.from_tenant_id]

      await supabase
        .from('shared_resources')
        .update({
          allowed_tenants: updatedTenants,
        })
        .eq('tenant_id', request.to_tenant_id)
        .eq('resource_type', request.resource_type)
        .eq('resource_id', request.resource_id)
    }

    logger.info('Sharing request reviewed', {
      requestId,
      action,
      reviewerTenantId,
      reviewerUserId
    })

    return updatedRequest
  }

  /**
   * Get sharing requests for a tenant
   */
  async getSharingRequests(
    tenantId: string,
    userId: string,
    direction: 'incoming' | 'outgoing' = 'incoming'
  ): Promise<SharingRequest[]> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    const column = direction === 'incoming' ? 'to_tenant_id' : 'from_tenant_id'

    const { data: requests, error } = await supabase
      .from('sharing_requests')
      .select('*')
      .eq(column, tenantId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return requests || []
  }

  /**
   * Get data sharing permissions for a tenant
   */
  async getSharingPermissions(tenantId: string, userId: string): Promise<DataSharingPermissions> {
    const tenantContext = await tenantService.getTenantContext(userId, tenantId)

    const basePermissions: DataSharingPermissions = {
      canShare: false,
      canViewShared: true,
      canRequestAccess: true,
      allowedScopes: ['private' as SharingScope],
    }

    // Owner and admin can share with all scopes
    if (['owner', 'admin'].includes(tenantContext.userRole)) {
      basePermissions.canShare = true
      basePermissions.allowedScopes = ['public', 'tenants', 'partners', 'private']
    }
    // Manager can share with limited scopes
    else if (tenantContext.userRole === 'manager') {
      basePermissions.canShare = true
      basePermissions.allowedScopes = ['tenants', 'private']
    }

    return basePermissions
  }

  /**
   * Create sharing templates for common use cases
   */
  async createSharingTemplate(
    tenantId: string,
    templateName: string,
    resourceType: ResourceType,
    defaultScope: SharingScope,
    defaultSettings: Record<string, any>,
    userId: string
  ): Promise<void> {
    await tenantService.checkPermission(userId, tenantId, 'data:write')

    const supabase = await this.getSupabase()

    const { error } = await supabase
      .from('sharing_templates')
      .insert({
        tenant_id: tenantId,
        template_name: templateName,
        resource_type: resourceType,
        default_scope: defaultScope,
        default_settings: defaultSettings,
      })

    if (error) throw error

    logger.info('Sharing template created', { tenantId, templateName, userId })
  }

  /**
   * Get sharing analytics
   */
  async getSharingAnalytics(
    tenantId: string,
    userId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    totalShared: number
    totalAccessed: number
    pendingRequests: number
    approvedRequests: number
    sharingByType: Record<ResourceType, number>
  }> {
    await tenantService.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()

    // Get sharing statistics
    const { data: sharedStats, error: sharedError } = await supabase
      .from('shared_resources')
      .select('resource_type')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    if (sharedError) throw sharedError

    // Get access statistics
    const { data: accessStats, error: accessError } = await supabase
      .from('resource_access_log')
      .select('resource_type')
      .eq('accessing_tenant_id', tenantId)

    if (accessError) throw accessError

    // Get request statistics
    const { data: requestStats, error: requestError } = await supabase
      .from('sharing_requests')
      .select('status')
      .or(`from_tenant_id.eq.${tenantId},to_tenant_id.eq.${tenantId}`)

    if (requestError) throw requestError

    const sharingByType = (sharedStats || []).reduce((acc, stat) => {
      const type = stat.resource_type as ResourceType
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<ResourceType, number>)

    const pendingRequests = (requestStats || []).filter(r => r.status === 'pending').length
    const approvedRequests = (requestStats || []).filter(r => r.status === 'approved').length

    return {
      totalShared: sharedStats?.length || 0,
      totalAccessed: accessStats?.length || 0,
      pendingRequests,
      approvedRequests,
      sharingByType,
    }
  }

  /**
   * Log resource access for analytics
   */
  async logResourceAccess(
    accessingTenantId: string,
    resourceTenantId: string,
    resourceType: ResourceType,
    resourceId: string,
    userId: string
  ): Promise<void> {
    const supabase = await this.getSupabase()

    await supabase
      .from('resource_access_log')
      .insert({
        accessing_tenant_id: accessingTenantId,
        resource_tenant_id: resourceTenantId,
        resource_type: resourceType,
        resource_id: resourceId,
        accessed_by: userId,
      })
  }
}

// Export singleton instance
export const dataSharingService = new DataSharingService()