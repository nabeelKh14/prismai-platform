import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { withErrorHandling, createErrorResponse } from "@/lib/errors"
import { logger } from "@/lib/logger"

/**
 * Standardized API response utilities
 */
export const apiResponse = {
  success: (data: any, status: number = 200) =>
    NextResponse.json(data, { status }),

  error: (message: string, status: number = 500, code?: string) =>
    NextResponse.json({ error: message, code }, { status }),

  unauthorized: () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),

  notFound: (resource: string = "Resource") =>
    NextResponse.json({ error: `${resource} not found` }, { status: 404 }),

  badRequest: (message: string = "Bad request") =>
    NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Authentication utilities
 */
export const auth = {
  /**
   * Get authenticated user from request
   */
  getUser: async (request: NextRequest) => {
    try {
      const supabase = await createClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        return { user: null, error: "Unauthorized" }
      }

      return { user, error: null }
    } catch (error) {
      logger.error("Auth error", error as Error)
      return { user: null, error: "Authentication failed" }
    }
  },

  /**
   * Require authentication for API route
   */
  requireAuth: async (request: NextRequest) => {
    const { user, error } = await auth.getUser(request)
    if (!user) {
      return { user: null, response: apiResponse.unauthorized() }
    }
    return { user, response: null }
  }
}

/**
 * Database query utilities
 */
export const db = {
  /**
   * Get Supabase client with authentication
   */
  getClient: async (request?: NextRequest) => {
    const supabase = await createClient()
    if (request) {
      // Set auth context from request if provided
      const token = request.headers.get('authorization')?.replace('Bearer ', '')
      if (token) {
        await supabase.auth.setSession({ access_token: token, refresh_token: '' })
      }
    }
    return supabase
  },

  /**
   * Execute query with error handling
   */
  query: async <T>(
    queryFn: (supabase: any) => Promise<{ data: T | null; error: any }>
  ): Promise<T> => {
    try {
      const supabase = await createClient()
      const { data, error } = await queryFn(supabase)

      if (error) {
        logger.error("Database query error", error)
        throw new Error(`Database error: ${error.message}`)
      }

      return data as T
    } catch (error) {
      logger.error("Database operation failed", error as Error)
      throw error
    }
  }
}

/**
 * Date/time utilities for API routes
 */
export const dateUtils = {
  /**
   * Get date range for analytics queries
   */
  getDateRange: (timeRange: string = '7d') => {
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    return { startDate, endDate: now }
  },

  /**
   * Format time duration in milliseconds
   */
  formatDuration: (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  },

  /**
   * Format bytes for memory usage
   */
  formatBytes: (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

/**
 * Validation utilities
 */
export const validate = {
  /**
   * Validate required fields in request body
   */
  required: (body: any, fields: string[]): string | null => {
    for (const field of fields) {
      if (!body[field]) {
        return `${field} is required`
      }
    }
    return null
  },

  /**
   * Validate email format
   */
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Validate UUID format
   */
  uuid: (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }
}

/**
 * Analytics utilities
 */
export const analytics = {
  /**
   * Calculate performance metrics from conversation data
   */
  calculateMetrics: (conversations: any[]) => {
    const totalConversations = conversations?.length || 0
    const resolvedConversations = conversations?.filter(c => c.status === 'resolved').length || 0
    const activeConversations = conversations?.filter(c => c.status === 'active' || c.status === 'assigned').length || 0

    return {
      totalConversations,
      resolvedConversations,
      activeConversations,
      resolutionRate: totalConversations > 0 ? (resolvedConversations / totalConversations) * 100 : 0,
      averageResolutionTime: 1800, // 30 minutes in seconds - could be calculated from actual data
    }
  },

  /**
   * Generate mock analytics data for development
   */
  generateMockData: (baseData: any, timeRange: string = '7d') => {
    const days = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90

    return {
      ...baseData,
      customerSatisfaction: 92.5,
      channelBreakdown: {
        whatsapp: Math.floor(baseData.totalConversations * 0.45),
        sms: Math.floor(baseData.totalConversations * 0.25),
        website: Math.floor(baseData.totalConversations * 0.30)
      },
      dailyVolume: Array.from({ length: days }, (_, i) => {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        return {
          date: date.toISOString().split('T')[0],
          conversations: Math.floor(Math.random() * 50) + 20,
          resolved: Math.floor(Math.random() * 40) + 15,
          satisfaction: Math.floor(Math.random() * 10) + 85
        }
      }).reverse()
    }
  }
}

/**
 * Higher-order function to wrap API routes with common functionality
 */
export function withApiHandler<T extends any[], R>(
  handler: (
    request: NextRequest,
    context: {
      user: any
      supabase: any
      query: typeof db.query
      validate: typeof validate
      dateUtils: typeof dateUtils
      analytics: typeof analytics
    }
  ) => Promise<R>
) {
  return withErrorHandling(async (request: NextRequest) => {
    const { user, response } = await auth.requireAuth(request)
    if (response) return response

    const supabase = await db.getClient(request)

    const context = {
      user,
      supabase,
      query: db.query,
      validate,
      dateUtils,
      analytics
    }

    return handler(request, context)
  })
}