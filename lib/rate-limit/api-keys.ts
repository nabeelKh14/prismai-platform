import { NextRequest } from 'next/server'
import { cache, createCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { ApiKeyInfo } from './types'
import { createClient } from '@/lib/supabase/server'

export class ApiKeyManager {
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  // Generate a new API key
  static generateApiKey(userId: string, tier: 'free' | 'pro' | 'enterprise'): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 15)
    const tierPrefix = tier.charAt(0).toUpperCase()
    return `${tierPrefix}${timestamp}${random}`.toUpperCase()
  }

  // Create a new API key
  static async createApiKey(
    userId: string,
    tier: 'free' | 'pro' | 'enterprise',
    customLimits?: { maxRequests: number; windowMs: number }
  ): Promise<ApiKeyInfo> {
    const apiKey = this.generateApiKey(userId, tier)
    const now = new Date()

    const keyInfo: ApiKeyInfo = {
      id: crypto.randomUUID(),
      key: apiKey,
      userId,
      tier,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
      isActive: true,
      customLimits,
    }

    try {
      // Store in database
      const supabase = await createClient()
      const { error } = await supabase
        .from('api_keys')
        .insert({
          id: keyInfo.id,
          key_hash: await this.hashApiKey(apiKey),
          user_id: userId,
          tier,
          created_at: keyInfo.createdAt.toISOString(),
          expires_at: keyInfo.expiresAt?.toISOString(),
          is_active: true,
          custom_limits: customLimits,
        })

      if (error) {
        logger.error('Failed to create API key in database', error)
        throw new Error('Failed to create API key')
      }

      // Cache the key info
      await this.cacheApiKeyInfo(apiKey, keyInfo)

      logger.info('API key created successfully', { userId, tier, keyId: keyInfo.id })
      return keyInfo
    } catch (error) {
      logger.error('Error creating API key', error as Error, { userId, tier })
      throw error
    }
  }

  // Validate and get API key info
  static async validateApiKey(apiKey: string): Promise<ApiKeyInfo | null> {
    try {
      // Check cache first
      const cached = await cache.get<ApiKeyInfo>(createCacheKey('api-key', apiKey))
      if (cached && cached.isActive && (!cached.expiresAt || cached.expiresAt > new Date())) {
        // Update last used time
        await this.updateLastUsed(apiKey)
        return cached
      }

      // Check database
      const supabase = await createClient()
      const keyHash = await this.hashApiKey(apiKey)
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return null
      }

      const keyInfo: ApiKeyInfo = {
        id: data.id,
        key: apiKey, // Don't store the actual key in cache
        userId: data.user_id,
        tier: data.tier,
        createdAt: new Date(data.created_at),
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
        isActive: data.is_active,
        customLimits: data.custom_limits,
      }

      // Check if expired
      if (keyInfo.expiresAt && keyInfo.expiresAt <= new Date()) {
        await this.deactivateApiKey(apiKey)
        return null
      }

      // Cache the result
      await this.cacheApiKeyInfo(apiKey, keyInfo)

      // Update last used time
      await this.updateLastUsed(apiKey)

      return keyInfo
    } catch (error) {
      logger.error('Error validating API key', error as Error, { keyHash: await this.hashApiKey(apiKey) })
      return null
    }
  }

  // Rotate an API key
  static async rotateApiKey(oldApiKey: string): Promise<ApiKeyInfo | null> {
    try {
      const keyInfo = await this.validateApiKey(oldApiKey)
      if (!keyInfo) {
        return null
      }

      // Deactivate old key
      await this.deactivateApiKey(oldApiKey)

      // Create new key with same properties
      const newKeyInfo = await this.createApiKey(
        keyInfo.userId,
        keyInfo.tier,
        keyInfo.customLimits
      )

      logger.info('API key rotated successfully', {
        userId: keyInfo.userId,
        oldKeyId: keyInfo.id,
        newKeyId: newKeyInfo.id
      })

      return newKeyInfo
    } catch (error) {
      logger.error('Error rotating API key', error as Error)
      return null
    }
  }

  // Deactivate an API key
  static async deactivateApiKey(apiKey: string): Promise<boolean> {
    try {
      const supabase = await createClient()
      const keyHash = await this.hashApiKey(apiKey)

      const { error } = await supabase
        .from('api_keys')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString()
        })
        .eq('key_hash', keyHash)

      if (error) {
        logger.error('Failed to deactivate API key', error)
        return false
      }

      // Remove from cache
      await cache.del(createCacheKey('api-key', apiKey))

      logger.info('API key deactivated', { keyHash })
      return true
    } catch (error) {
      logger.error('Error deactivating API key', error as Error)
      return false
    }
  }

  // Get all API keys for a user
  static async getUserApiKeys(userId: string): Promise<ApiKeyInfo[]> {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to get user API keys', error, { userId })
        return []
      }

      return data.map((row: any) => ({
        id: row.id,
        key: '', // Don't return actual keys
        userId: row.user_id,
        tier: row.tier,
        createdAt: new Date(row.created_at),
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
        isActive: row.is_active,
        customLimits: row.custom_limits,
      }))
    } catch (error) {
      logger.error('Error getting user API keys', error as Error, { userId })
      return []
    }
  }

  // Extract API key from request
  static extractApiKey(request: NextRequest): string | null {
    return request.headers.get('x-api-key') ||
           request.headers.get('authorization')?.replace('Bearer ', '') ||
           null
  }

  // Private helper methods
  private static async hashApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(apiKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private static async cacheApiKeyInfo(apiKey: string, keyInfo: ApiKeyInfo): Promise<void> {
    const cacheKey = createCacheKey('api-key', apiKey)
    await cache.set(cacheKey, keyInfo, this.CACHE_TTL)
  }

  private static async updateLastUsed(apiKey: string): Promise<void> {
    try {
      const supabase = await createClient()
      const keyHash = await this.hashApiKey(apiKey)
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('key_hash', keyHash)
    } catch (error) {
      // Don't throw, just log
      logger.warn('Failed to update last used time', { error: (error as Error).message })
    }
  }
}