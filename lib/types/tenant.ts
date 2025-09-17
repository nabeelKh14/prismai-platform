import { z } from 'zod'

// Tenant core types
export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Tenant name is required'),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  description: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  website_url: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  timezone: z.string().default('UTC'),
  currency: z.string().default('USD'),
  locale: z.string().default('en-US'),
  is_active: z.boolean().default(true),
  subscription_status: z.enum(['trial', 'active', 'suspended', 'cancelled']).default('trial'),
  trial_ends_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const TenantUserSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'manager', 'user', 'viewer']),
  is_active: z.boolean().default(true),
  invited_by: z.string().uuid().optional(),
  invited_at: z.string().datetime(),
  joined_at: z.string().datetime().optional(),
  last_active_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const TenantInvitationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'user', 'viewer']),
  invited_by: z.string().uuid(),
  token: z.string(),
  expires_at: z.string().datetime(),
  accepted_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
})

export const TenantConfigSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  config_key: z.string(),
  config_value: z.record(z.any()),
  is_system_config: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const TenantFeatureSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  feature_name: z.string(),
  is_enabled: z.boolean().default(true),
  limits: z.record(z.any()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const TenantSubscriptionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: z.enum(['active', 'canceled', 'past_due', 'unpaid', 'paused']),
  current_period_start: z.string().datetime(),
  current_period_end: z.string().datetime(),
  stripe_subscription_id: z.string().optional(),
  stripe_customer_id: z.string().optional(),
  billing_email: z.string().email().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const TenantUsageSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  metric_name: z.string(),
  metric_value: z.number(),
  period_start: z.string(),
  period_end: z.string(),
  created_at: z.string().datetime(),
})

// Type exports
export type Tenant = z.infer<typeof TenantSchema>
export type TenantUser = z.infer<typeof TenantUserSchema>
export type TenantInvitation = z.infer<typeof TenantInvitationSchema>
export type TenantConfig = z.infer<typeof TenantConfigSchema>
export type TenantFeature = z.infer<typeof TenantFeatureSchema>
export type TenantSubscription = z.infer<typeof TenantSubscriptionSchema>
export type TenantUsage = z.infer<typeof TenantUsageSchema>

// Request/Response types
export const CreateTenantRequestSchema = z.object({
  name: z.string().min(1, 'Tenant name is required'),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  size: z.enum(['startup', 'small', 'medium', 'large', 'enterprise']).optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  locale: z.string().optional(),
})

export const UpdateTenantRequestSchema = CreateTenantRequestSchema.partial()

export const InviteUserRequestSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'user', 'viewer']),
})

export const UpdateTenantUserRequestSchema = z.object({
  role: z.enum(['owner', 'admin', 'manager', 'user', 'viewer']).optional(),
  is_active: z.boolean().optional(),
})

export const TenantConfigRequestSchema = z.object({
  config_key: z.string(),
  config_value: z.record(z.any()),
})

export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>
export type UpdateTenantRequest = z.infer<typeof UpdateTenantRequestSchema>
export type InviteUserRequest = z.infer<typeof InviteUserRequestSchema>
export type UpdateTenantUserRequest = z.infer<typeof UpdateTenantUserRequestSchema>
export type TenantConfigRequest = z.infer<typeof TenantConfigRequestSchema>

// API Response types
export interface TenantWithUsers extends Tenant {
  users: (TenantUser & {
    user: {
      id: string
      email: string
      user_metadata?: Record<string, any>
    }
  })[]
  subscription?: TenantSubscription & {
    plan: {
      id: string
      name: string
      price_monthly: number
    }
  }
  features: TenantFeature[]
  usage: TenantUsage[]
}

export interface TenantContext {
  tenant: Tenant
  userRole: TenantUser['role']
  permissions: string[]
  features: Record<string, TenantFeature>
}

// Permission definitions
export const TENANT_PERMISSIONS = {
  // Tenant management
  'tenant:update': ['owner', 'admin'],
  'tenant:delete': ['owner'],
  'tenant:invite_users': ['owner', 'admin'],
  'tenant:manage_users': ['owner', 'admin'],
  'tenant:view_billing': ['owner', 'admin', 'manager'],
  'tenant:manage_billing': ['owner', 'admin'],

  // User management
  'users:view': ['owner', 'admin', 'manager'],
  'users:manage': ['owner', 'admin'],

  // Data access
  'data:read': ['owner', 'admin', 'manager', 'user', 'viewer'],
  'data:write': ['owner', 'admin', 'manager', 'user'],
  'data:delete': ['owner', 'admin', 'manager'],

  // Feature access
  'ai_receptionist:access': ['owner', 'admin', 'manager', 'user'],
  'chatbot:access': ['owner', 'admin', 'manager', 'user'],
  'analytics:access': ['owner', 'admin', 'manager', 'user', 'viewer'],
  'integrations:access': ['owner', 'admin', 'manager'],
} as const

export type Permission = keyof typeof TENANT_PERMISSIONS

// Utility functions
export function hasPermission(userRole: TenantUser['role'], permission: Permission): boolean {
  const allowedRoles = TENANT_PERMISSIONS[permission]
  return (allowedRoles as readonly string[]).includes(userRole)
}

export function getUserPermissions(userRole: TenantUser['role']): Permission[] {
  return Object.keys(TENANT_PERMISSIONS).filter(permission =>
    hasPermission(userRole, permission as Permission)
  ) as Permission[]
}