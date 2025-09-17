export interface RateLimitInfo {
  count: number
  resetTime: number
  remaining: number
  windowStart?: number
  windowEnd?: number
}

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  burstLimit?: number
  keyGenerator?: (request: NextRequest) => string
}

export interface ApiKeyInfo {
  id: string
  key: string
  userId: string
  tier: 'free' | 'pro' | 'enterprise'
  createdAt: Date
  expiresAt?: Date
  lastUsedAt?: Date
  isActive: boolean
  customLimits?: {
    maxRequests: number
    windowMs: number
  }
}

export interface UsageAnalytics {
  userId?: string
  apiKey?: string
  endpoint: string
  method: string
  requestCount: number
  timeWindow: {
    start: Date
    end: Date
  }
  tier: string
  quotaUsed: number
  quotaLimit: number
  blockedRequests: number
}

export interface QuotaInfo {
  identifier: string
  used: number
  limit: number
  resetTime: Date
  tier: string
}

export interface RateLimitBypass {
  userId?: string
  apiKey?: string
  endpoint: string
  reason: string
  grantedAt: Date
  expiresAt?: Date
}

export interface MonitoringData {
  timestamp: Date
  endpoint: string
  method: string
  userId?: string
  apiKey?: string
  tier: string
  requestCount: number
  blockedCount: number
  averageResponseTime: number
  errorRate: number
  cacheHitRate: number
}

// Import NextRequest for type definitions
import { NextRequest } from 'next/server'