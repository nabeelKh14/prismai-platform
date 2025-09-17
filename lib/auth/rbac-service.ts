import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface Permission {
  id: string
  permission_name: string
  description: string
  resource: string
  action: string
}

export interface Role {
  id: string
  role_name: string
  description?: string
  is_active: boolean
  created_at: string
}

export interface UserRole {
  id: string
  user_id: string
  role_name: string
  assigned_by?: string
  assigned_at: string
  expires_at?: string
  is_active: boolean
}

export class RBACService {
  /**
   * Check if user has a specific permission
   */
  static async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase.rpc('has_permission', {
        p_user_id: userId,
        p_resource: resource,
        p_action: action
      })

      if (error) {
        logger.error('Failed to check permission', { error, userId, resource, action })
        return false
      }

      return data || false
    } catch (error) {
      logger.error('Permission check failed', { error, userId, resource, action })
      return false
    }
  }

  /**
   * Check if user has a specific role
   */
  static async hasRole(userId: string, roleName: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_name', roleName)
        .eq('is_active', true)
        .is('expires_at', null)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Failed to check role', { error, userId, roleName })
        return false
      }

      return !!data
    } catch (error) {
      logger.error('Role check failed', { error, userId, roleName })
      return false
    }
  }

  /**
   * Get all roles for a user
   */
  static async getUserRoles(userId: string): Promise<UserRole[]> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })

      if (error) {
        logger.error('Failed to get user roles', { error, userId })
        return []
      }

      return data || []
    } catch (error) {
      logger.error('Get user roles failed', { error, userId })
      return []
    }
  }

  /**
   * Get all permissions for a user
   */
  static async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role_permissions (
            permissions (
              id,
              permission_name,
              description,
              resource,
              action
            )
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .is('expires_at', null)

      if (error) {
        logger.error('Failed to get user permissions', { error, userId })
        return []
      }

      // Flatten the nested structure
      const permissions: Permission[] = []
      data?.forEach((roleData: any) => {
        roleData.role_permissions?.forEach((rp: any) => {
          if (rp.permissions) {
            permissions.push(rp.permissions)
          }
        })
      })

      // Remove duplicates
      const uniquePermissions = permissions.filter(
        (perm, index, self) =>
          index === self.findIndex(p => p.id === perm.id)
      )

      return uniquePermissions
    } catch (error) {
      logger.error('Get user permissions failed', { error, userId })
      return []
    }
  }

  /**
   * Assign role to user (admin only)
   */
  static async assignRole(
    userId: string,
    roleName: string,
    assignedBy: string,
    expiresAt?: string
  ): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role_name: roleName,
          assigned_by: assignedBy,
          expires_at: expiresAt,
          is_active: true
        }, {
          onConflict: 'user_id,role_name'
        })

      if (error) {
        logger.error('Failed to assign role', { error, userId, roleName, assignedBy })
        return false
      }

      logger.info('Role assigned successfully', { userId, roleName, assignedBy })
      return true
    } catch (error) {
      logger.error('Role assignment failed', { error, userId, roleName, assignedBy })
      return false
    }
  }

  /**
   * Remove role from user (admin only)
   */
  static async removeRole(userId: string, roleName: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('user_roles')
        .update({
          is_active: false,
          expires_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('role_name', roleName)

      if (error) {
        logger.error('Failed to remove role', { error, userId, roleName })
        return false
      }

      logger.info('Role removed successfully', { userId, roleName })
      return true
    } catch (error) {
      logger.error('Role removal failed', { error, userId, roleName })
      return false
    }
  }

  /**
   * Get all available roles
   */
  static async getAllRoles(): Promise<string[]> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('role_permissions')
        .select('role_name')
        .order('role_name')

      if (error) {
        logger.error('Failed to get all roles', { error })
        return []
      }

      // Get unique role names
      const roles = [...new Set(data?.map(r => r.role_name) || [])]
      return roles
    } catch (error) {
      logger.error('Get all roles failed', { error })
      return []
    }
  }

  /**
   * Get all available permissions
   */
  static async getAllPermissions(): Promise<Permission[]> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('resource', { ascending: true })
        .order('action', { ascending: true })

      if (error) {
        logger.error('Failed to get all permissions', { error })
        return []
      }

      return data || []
    } catch (error) {
      logger.error('Get all permissions failed', { error })
      return []
    }
  }

  /**
   * Create a new role with permissions (admin only)
   */
  static async createRole(
    roleName: string,
    description: string,
    permissionIds: string[]
  ): Promise<boolean> {
    try {
      const supabase = await createClient()

      // Insert role permissions
      const rolePermissions = permissionIds.map(permissionId => ({
        role_name: roleName,
        permission_id: permissionId
      }))

      const { error } = await supabase
        .from('role_permissions')
        .insert(rolePermissions)

      if (error) {
        logger.error('Failed to create role', { error, roleName })
        return false
      }

      logger.info('Role created successfully', { roleName, permissionCount: permissionIds.length })
      return true
    } catch (error) {
      logger.error('Role creation failed', { error, roleName })
      return false
    }
  }

  /**
   * Initialize default roles for new users
   */
  static async initializeUserRoles(userId: string): Promise<void> {
    try {
      // Assign default 'user' role to new users
      await this.assignRole(userId, 'user', 'system')

      logger.info('Default roles initialized for user', { userId })
    } catch (error) {
      logger.error('Failed to initialize user roles', { error, userId })
    }
  }

  /**
   * Check if user is admin
   */
  static async isAdmin(userId: string): Promise<boolean> {
    return this.hasRole(userId, 'admin')
  }

  /**
   * Check if user is moderator
   */
  static async isModerator(userId: string): Promise<boolean> {
    return this.hasRole(userId, 'moderator')
  }
}