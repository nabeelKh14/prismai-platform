import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export interface UserProfile {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phoneNumber?: string
  businessName?: string
  businessType?: string
  avatarUrl?: string
  timezone: string
  language: string
  theme: 'light' | 'dark' | 'system'
  emailNotifications: boolean
  smsNotifications: boolean
  marketingEmails: boolean
  twoFactorEnabled: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface UserPreferences {
  dashboardLayout: 'grid' | 'list'
  defaultView: string
  itemsPerPage: number
  dateFormat: string
  currency: string
  notifications: {
    email: {
      security: boolean
      marketing: boolean
      updates: boolean
    }
    sms: {
      security: boolean
      alerts: boolean
    }
    inApp: {
      mentions: boolean
      replies: boolean
      updates: boolean
    }
  }
}

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long').optional(),
  phoneNumber: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number').optional(),
  businessName: z.string().min(1, 'Business name is required').max(100, 'Business name too long').optional(),
  businessType: z.string().min(1, 'Business type is required').optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  language: z.string().min(1, 'Language is required'),
  theme: z.enum(['light', 'dark', 'system']),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  marketingEmails: z.boolean()
})

const preferencesSchema = z.object({
  dashboardLayout: z.enum(['grid', 'list']),
  defaultView: z.string().min(1),
  itemsPerPage: z.number().min(5).max(100),
  dateFormat: z.string().min(1),
  currency: z.string().min(1),
  notifications: z.object({
    email: z.object({
      security: z.boolean(),
      marketing: z.boolean(),
      updates: z.boolean()
    }),
    sms: z.object({
      security: z.boolean(),
      alerts: z.boolean()
    }),
    inApp: z.object({
      mentions: z.boolean(),
      replies: z.boolean(),
      updates: z.boolean()
    })
  })
})

export class UserProfileService {
  /**
   * PRIVACY BY DESIGN: Default user profile settings prioritize user privacy
   * - emailNotifications: false (users must opt-in to receive emails)
   * - smsNotifications: false (users must opt-in to receive SMS)
   * - marketingEmails: false (prevents unsolicited marketing communications)
   * This implements data minimization and purpose limitation principles.
   */
  private static readonly DEFAULT_PROFILE: Partial<UserProfile> = {
    timezone: 'UTC',
    language: 'en',
    theme: 'system',
    emailNotifications: false, // PRIVACY: Default to false to respect user privacy - users must opt-in to receive emails
    smsNotifications: false,
    marketingEmails: false
  }

  /**
   * PRIVACY BY DESIGN: Default notification preferences implement data minimization
   * - Security notifications: enabled by default (essential for user safety)
   * - Marketing notifications: disabled by default (prevents unsolicited communications)
   * - Update notifications: disabled by default (users must opt-in)
   * - In-app notifications: disabled by default (prevents unwanted interruptions)
   * This ensures users only receive notifications they explicitly consent to.
   */
  private static readonly DEFAULT_PREFERENCES: UserPreferences = {
    dashboardLayout: 'grid',
    defaultView: 'dashboard',
    itemsPerPage: 20,
    dateFormat: 'MM/dd/yyyy',
    currency: 'USD',
    notifications: {
      email: {
        security: true, // PRIVACY: Security notifications must remain enabled for safety
        marketing: false, // PRIVACY: Default to false to prevent unsolicited marketing
        updates: false // PRIVACY: Default to false to respect user privacy - users must opt-in for updates
      },
      sms: {
        security: true, // PRIVACY: Security notifications must remain enabled for safety
        alerts: false // PRIVACY: Default to false to prevent unsolicited alerts
      },
      inApp: {
        mentions: false, // PRIVACY: Default to false to respect user privacy - users must opt-in for mentions
        replies: false, // PRIVACY: Default to false to respect user privacy - users must opt-in for replies
        updates: false // PRIVACY: Default to false to respect user privacy - users must opt-in for updates
      }
    }
  }

  /**
   * Get user profile
   */
  static async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, return null
          return null
        }
        logger.error('Failed to get user profile', { error, userId })
        throw new Error('Failed to get user profile')
      }

      // Get MFA status
      const { data: mfaData } = await supabase
        .from('user_mfa')
        .select('mfa_enabled, sms_enabled')
        .eq('user_id', userId)
        .single()

      const profile: UserProfile = {
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        phoneNumber: data.phone_number,
        businessName: data.business_name,
        businessType: data.business_type,
        avatarUrl: data.avatar_url,
        timezone: data.timezone || this.DEFAULT_PROFILE.timezone!,
        language: data.language || this.DEFAULT_PROFILE.language!,
        theme: data.theme || this.DEFAULT_PROFILE.theme!,
        emailNotifications: data.email_notifications ?? this.DEFAULT_PROFILE.emailNotifications!,
        smsNotifications: data.sms_notifications ?? this.DEFAULT_PROFILE.smsNotifications!,
        marketingEmails: data.marketing_emails ?? this.DEFAULT_PROFILE.marketingEmails!,
        twoFactorEnabled: mfaData?.mfa_enabled || mfaData?.sms_enabled || false,
        lastLoginAt: data.last_login_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }

      return profile
    } catch (error) {
      logger.error('Get profile failed', { error, userId })
      return null
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      // Validate updates
      const validatedUpdates = profileSchema.parse(updates)

      const supabase = await createClient()

      const { data, error } = await supabase
        .from('profiles')
        .update({
          first_name: validatedUpdates.firstName,
          last_name: validatedUpdates.lastName,
          phone_number: validatedUpdates.phoneNumber,
          business_name: validatedUpdates.businessName,
          business_type: validatedUpdates.businessType,
          timezone: validatedUpdates.timezone,
          language: validatedUpdates.language,
          theme: validatedUpdates.theme,
          email_notifications: validatedUpdates.emailNotifications,
          sms_notifications: validatedUpdates.smsNotifications,
          marketing_emails: validatedUpdates.marketingEmails,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        logger.error('Failed to update user profile', { error, userId })
        throw new Error('Failed to update user profile')
      }

      logger.info('User profile updated', { userId })

      // Return updated profile
      return this.getProfile(userId)
    } catch (error) {
      logger.error('Update profile failed', { error, userId })
      throw error
    }
  }

  /**
   * Get user preferences
   */
  static async getPreferences(userId: string): Promise<UserPreferences> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferences')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Preferences don't exist, return defaults
          return this.DEFAULT_PREFERENCES
        }
        logger.error('Failed to get user preferences', { error, userId })
        return this.DEFAULT_PREFERENCES
      }

      return { ...this.DEFAULT_PREFERENCES, ...data.preferences }
    } catch (error) {
      logger.error('Get preferences failed', { error, userId })
      return this.DEFAULT_PREFERENCES
    }
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    try {
      // Validate preferences
      const validatedPreferences = preferencesSchema.parse(preferences)

      const supabase = await createClient()

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          preferences: validatedPreferences,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) {
        logger.error('Failed to update user preferences', { error, userId })
        throw new Error('Failed to update user preferences')
      }

      logger.info('User preferences updated', { userId })

      return this.getPreferences(userId)
    } catch (error) {
      logger.error('Update preferences failed', { error, userId })
      throw error
    }
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('profiles')
        .update({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        logger.error('Failed to update last login', { error, userId })
      }
    } catch (error) {
      logger.error('Update last login failed', { error, userId })
    }
  }

  /**
   * Upload avatar
   */
  static async uploadAvatar(userId: string, file: File): Promise<string | null> {
    try {
      const supabase = await createClient()

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        logger.error('Failed to upload avatar', { error, userId })
        throw new Error('Failed to upload avatar')
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update profile with avatar URL
      await supabase
        .from('profiles')
        .update({
          avatar_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      logger.info('Avatar uploaded successfully', { userId, fileName })

      return urlData.publicUrl
    } catch (error) {
      logger.error('Avatar upload failed', { error, userId })
      return null
    }
  }

  /**
   * Delete avatar
   */
  static async deleteAvatar(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient()

      // Get current avatar URL
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single()

      if (profile?.avatar_url) {
        // Extract file path from URL
        const urlParts = profile.avatar_url.split('/')
        const fileName = urlParts[urlParts.length - 1]

        // Delete from storage
        await supabase.storage
          .from('avatars')
          .remove([`${userId}/${fileName}`])
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        logger.error('Failed to delete avatar', { error, userId })
        return false
      }

      logger.info('Avatar deleted successfully', { userId })
      return true
    } catch (error) {
      logger.error('Avatar deletion failed', { error, userId })
      return false
    }
  }

  /**
   * Initialize user profile for new users
   */
  static async initializeProfile(userId: string, initialData?: Partial<UserProfile>): Promise<void> {
    try {
      const supabase = await createClient()

      const profileData = {
        id: userId,
        ...this.DEFAULT_PROFILE,
        ...initialData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('profiles')
        .insert(profileData)

      if (error) {
        logger.error('Failed to initialize user profile', { error, userId })
        throw new Error('Failed to initialize user profile')
      }

      // Initialize preferences
      await this.updatePreferences(userId, this.DEFAULT_PREFERENCES)

      logger.info('User profile initialized', { userId })
    } catch (error) {
      logger.error('Profile initialization failed', { error, userId })
      throw error
    }
  }
}