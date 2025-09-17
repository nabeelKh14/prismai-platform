import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  Tenant,
  TenantUser,
  TenantInvitation,
  TenantConfig,
  TenantFeature,
  TenantSubscription,
  TenantUsage,
  CreateTenantRequest,
  UpdateTenantRequest,
  InviteUserRequest,
  UpdateTenantUserRequest,
  TenantConfigRequest,
  TenantWithUsers,
  hasPermission,
  getUserPermissions,
} from '@/lib/types/tenant'
import { ValidationError, AuthenticationError, AuthorizationError } from '@/lib/errors'

export class TenantService {
  private async getSupabase() {
    return await createClient()
  }

  // =====================================
  // TENANT MANAGEMENT
  // =====================================

  async createTenant(request: CreateTenantRequest, ownerId: string): Promise<Tenant> {
    const supabase = await this.getSupabase()

    // Check if user already has a tenant
    const { data: existingTenant } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', ownerId)
      .eq('role', 'owner')
      .single()

    if (existingTenant) {
      throw new ValidationError('User already owns a tenant')
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: request.name,
        domain: request.domain,
        subdomain: request.subdomain,
        description: request.description,
        industry: request.industry,
        size: request.size,
        timezone: request.timezone || 'UTC',
        currency: request.currency || 'USD',
        locale: request.locale || 'en-US',
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (tenantError) throw tenantError

    // Add owner to tenant
    const { error: userError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant.id,
        user_id: ownerId,
        role: 'owner',
        joined_at: new Date().toISOString(),
      })

    if (userError) throw userError

    // Create default features
    await this.createDefaultFeatures(supabase, tenant.id)

    logger.info('Tenant created successfully', { tenantId: tenant.id, ownerId })
    return tenant
  }

  async updateTenant(tenantId: string, request: UpdateTenantRequest, userId: string): Promise<Tenant> {
    await this.checkPermission(userId, tenantId, 'tenant:update')

    const supabase = await this.getSupabase()
    const { data: tenant, error } = await supabase
      .from('tenants')
      .update({
        ...request,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select()
      .single()

    if (error) throw error

    logger.info('Tenant updated successfully', { tenantId, userId })
    return tenant
  }

  async getTenantWithUsers(tenantId: string, userId: string): Promise<TenantWithUsers> {
    await this.checkTenantAccess(userId, tenantId)

    const supabase = await this.getSupabase()
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select(`
        *,
        users:tenant_users(
          *,
          user:profiles(id, email, business_name)
        ),
        subscription:tenant_subscriptions(
          *,
          plan:subscription_plans(id, name, price_monthly)
        ),
        features:tenant_features(*),
        usage:tenant_usage(*)
      `)
      .eq('id', tenantId)
      .single()

    if (error) throw error

    return tenant as TenantWithUsers
  }

  async getUserTenants(userId: string): Promise<Tenant[]> {
    const supabase = await this.getSupabase()
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select(`
        *,
        user_role:tenant_users!inner(role)
      `)
      .eq('tenant_users.user_id', userId)
      .eq('tenant_users.is_active', true)

    if (error) throw error

    return tenants || []
  }

  // =====================================
  // USER MANAGEMENT
  // =====================================

  async inviteUser(tenantId: string, request: InviteUserRequest, invitedBy: string): Promise<TenantInvitation> {
    await this.checkPermission(invitedBy, tenantId, 'tenant:invite_users')

    const supabase = await this.getSupabase()

    // Check if user is already in tenant
    const { data: existingUser } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', request.email)
      .single()

    if (existingUser) {
      throw new ValidationError('User is already a member of this tenant')
    }

    // Check if invitation already exists
    const { data: existingInvitation } = await supabase
      .from('tenant_invitations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', request.email)
      .eq('accepted_at', null)
      .single()

    if (existingInvitation) {
      throw new ValidationError('Invitation already sent to this email')
    }

    // Create invitation
    const token = this.generateInvitationToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const { data: invitation, error } = await supabase
      .from('tenant_invitations')
      .insert({
        tenant_id: tenantId,
        email: request.email,
        role: request.role,
        invited_by: invitedBy,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    logger.info('User invited to tenant', { tenantId, email: request.email, invitedBy })
    return invitation
  }

  async acceptInvitation(token: string, userId: string): Promise<TenantUser> {
    const supabase = await this.getSupabase()

    // Find invitation
    const { data: invitation, error: findError } = await supabase
      .from('tenant_invitations')
      .select('*, tenant:tenants(*)')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (findError || !invitation) {
      throw new ValidationError('Invalid or expired invitation')
    }

    // Check if user is already in tenant
    const { data: existingUser } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('tenant_id', invitation.tenant_id)
      .eq('user_id', userId)
      .single()

    if (existingUser) {
      throw new ValidationError('User is already a member of this tenant')
    }

    // Add user to tenant
    const { data: tenantUser, error: insertError } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: invitation.tenant_id,
        user_id: userId,
        role: invitation.role,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Mark invitation as accepted
    await supabase
      .from('tenant_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    logger.info('User accepted tenant invitation', { tenantId: invitation.tenant_id, userId })
    return tenantUser
  }

  // =====================================
  // PERMISSION HELPERS
  // =====================================

  async getTenantContext(userId: string, tenantId?: string): Promise<{
    tenant: Tenant
    userRole: TenantUser['role']
    permissions: string[]
    features: Record<string, TenantFeature>
  }> {
    let targetTenantId = tenantId

    if (!targetTenantId) {
      const supabase = await this.getSupabase()
      const { data: userTenant } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!userTenant) {
        throw new AuthenticationError('User is not a member of any tenant')
      }

      targetTenantId = userTenant.tenant_id
    }

    if (!targetTenantId) {
      throw new AuthenticationError('No tenant found for user')
    }

    const tenant = await this.getTenant(targetTenantId)
    const userRole = await this.getUserRole(userId, targetTenantId)
    const permissions = getUserPermissions(userRole)
    const features = await this.getTenantFeatures(targetTenantId)

    return {
      tenant,
      userRole,
      permissions,
      features: features.reduce((acc, feature) => {
        acc[feature.feature_name] = feature
        return acc
      }, {} as Record<string, TenantFeature>),
    }
  }

  async checkPermission(userId: string, tenantId: string, permission: string): Promise<void> {
    const userRole = await this.getUserRole(userId, tenantId)

    if (!hasPermission(userRole, permission as any)) {
      throw new AuthorizationError(`Insufficient permissions: ${permission}`)
    }
  }

  async checkTenantAccess(userId: string, tenantId: string): Promise<void> {
    const supabase = await this.getSupabase()
    const { data: tenantUser, error } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (error || !tenantUser) {
      throw new AuthorizationError('Access denied to tenant')
    }
  }

  // =====================================
  // PRIVATE HELPERS
  // =====================================

  private async getTenant(tenantId: string): Promise<Tenant> {
    const supabase = await this.getSupabase()
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (error) throw error
    return tenant
  }

  private async getTenantUser(tenantId: string, userId: string): Promise<TenantUser> {
    const supabase = await this.getSupabase()
    const { data: tenantUser, error } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return tenantUser
  }

  private async getUserRole(userId: string, tenantId: string): Promise<TenantUser['role']> {
    const tenantUser = await this.getTenantUser(tenantId, userId)
    return tenantUser.role
  }

  private async getTenantFeatures(tenantId: string): Promise<TenantFeature[]> {
    const supabase = await this.getSupabase()
    const { data: features, error } = await supabase
      .from('tenant_features')
      .select('*')
      .eq('tenant_id', tenantId)

    if (error) throw error
    return features || []
  }

  private async createDefaultFeatures(supabase: any, tenantId: string): Promise<void> {
    const defaultFeatures = [
      { feature_name: 'ai_receptionist', is_enabled: true, limits: { monthly_calls: 1000 } },
      { feature_name: 'chatbot', is_enabled: true, limits: { monthly_messages: 5000 } },
      { feature_name: 'lead_generation', is_enabled: true, limits: { monthly_leads: 1000 } },
      { feature_name: 'email_campaigns', is_enabled: true, limits: { monthly_emails: 5000 } },
      { feature_name: 'analytics', is_enabled: true, limits: {} },
      { feature_name: 'integrations', is_enabled: true, limits: { max_integrations: 10 } },
    ]

    const { error } = await supabase
      .from('tenant_features')
      .insert(defaultFeatures.map(feature => ({
        tenant_id: tenantId,
        ...feature,
      })))

    if (error) throw error
  }

  private generateInvitationToken(): string {
    return require('crypto').randomBytes(32).toString('hex')
  }
}

// Export singleton instance
export const tenantService = new TenantService()