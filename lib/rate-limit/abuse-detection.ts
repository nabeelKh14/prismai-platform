import { NextRequest } from 'next/server'
import { cache, createCacheKey } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { SecurityAudit } from '@/lib/security'

interface AbusePattern {
  pattern: RegExp
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  action: 'log' | 'block' | 'captcha' | 'alert'
}

interface SuspiciousActivity {
  ip: string
  userAgent: string
  requestCount: number
  blockedRequests: number
  captchaRequired: boolean
  lastActivity: Date
  riskScore: number
}

export class AbuseDetectionService {
  private static readonly SUSPICIOUS_PATTERNS: AbusePattern[] = [
    // SQL Injection patterns
    {
      pattern: /(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b).*(\bor\b|\band\b).*(\d|=)/i,
      description: 'Potential SQL injection',
      severity: 'high',
      action: 'block'
    },
    // XSS patterns
    {
      pattern: /<script[^>]*>.*?<\/script>/i,
      description: 'Script injection attempt',
      severity: 'high',
      action: 'block'
    },
    {
      pattern: /javascript:/i,
      description: 'JavaScript URL injection',
      severity: 'high',
      action: 'block'
    },
    // Path traversal
    {
      pattern: /\.\.[\/\\]/,
      description: 'Path traversal attempt',
      severity: 'critical',
      action: 'block'
    },
    // Command injection
    {
      pattern: /(\||&|;|\$\(|\`)/,
      description: 'Command injection attempt',
      severity: 'critical',
      action: 'block'
    },
    // Excessive special characters
    {
      pattern: /.{200,}/,
      description: 'Excessively long input',
      severity: 'medium',
      action: 'captcha'
    },
    // Rapid form submissions
    {
      pattern: /.{0,10}/, // Very short inputs in rapid succession
      description: 'Potential bot activity',
      severity: 'low',
      action: 'log'
    }
  ]

  private static readonly RISK_THRESHOLDS = {
    low: 10,
    medium: 25,
    high: 50,
    critical: 100
  }

  // Analyze request for suspicious patterns
  static analyzeRequest(request: NextRequest): {
    isSuspicious: boolean
    riskScore: number
    patterns: AbusePattern[]
    recommendedAction: 'allow' | 'captcha' | 'block'
  } {
    const url = request.nextUrl.pathname + request.nextUrl.search
    const userAgent = request.headers.get('user-agent') || ''
    const body = request.method === 'POST' ? '' : '' // Would need body parsing
    const ip = this.getClientIP(request)

    // Skip abuse detection for localhost/development
    if (ip === 'unknown' || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return {
        isSuspicious: false,
        riskScore: 0,
        patterns: [],
        recommendedAction: 'allow'
      }
    }

    let riskScore = 0
    const matchedPatterns: AbusePattern[] = []

    // Check URL patterns (NOT user agent - user agents commonly contain special chars like &)
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.pattern.test(url)) {
        matchedPatterns.push(pattern)
        riskScore += this.getSeverityScore(pattern.severity)
      }
    }

    // Additional heuristics
    riskScore += this.checkUserAgentAnomalies(userAgent)
    riskScore += this.checkRequestFrequency(request)
    riskScore += this.checkGeographicAnomalies(request)

    const isSuspicious = riskScore >= this.RISK_THRESHOLDS.low
    const recommendedAction = this.determineAction(riskScore, matchedPatterns)

    if (isSuspicious) {
      logger.logSecurity('Suspicious request detected', undefined, {
        riskScore,
        patterns: matchedPatterns.map(p => p.description),
        recommendedAction,
        ip: this.getClientIP(request),
        url,
        userAgent
      })
    }

    return {
      isSuspicious,
      riskScore,
      patterns: matchedPatterns,
      recommendedAction
    }
  }

  // Track suspicious activity
  static async trackSuspiciousActivity(
    request: NextRequest,
    activity: Partial<SuspiciousActivity>
  ): Promise<void> {
    const ip = this.getClientIP(request)
    const key = createCacheKey('suspicious-activity', ip)

    try {
      const existing = await cache.get<SuspiciousActivity>(key) || {
        ip,
        userAgent: request.headers.get('user-agent') || '',
        requestCount: 0,
        blockedRequests: 0,
        captchaRequired: false,
        lastActivity: new Date(),
        riskScore: 0
      }

      const updated: SuspiciousActivity = {
        ...existing,
        ...activity,
        requestCount: existing.requestCount + 1,
        lastActivity: new Date(),
        riskScore: Math.max(existing.riskScore, activity.riskScore || 0)
      }

      // Store for 24 hours
      await cache.set(key, updated, 24 * 60 * 60 * 1000)

      // Alert on high risk scores
      if (updated.riskScore >= this.RISK_THRESHOLDS.high) {
        SecurityAudit.logSensitiveAction('high_risk_activity_detected', 'system', {
          ip,
          riskScore: updated.riskScore,
          requestCount: updated.requestCount,
          blockedRequests: updated.blockedRequests
        })
      }
    } catch (error) {
      logger.error('Failed to track suspicious activity', error as Error, { ip })
    }
  }

  // Check if CAPTCHA is required
  static async requiresCaptcha(request: NextRequest): Promise<boolean> {
    const ip = this.getClientIP(request)
    const key = createCacheKey('suspicious-activity', ip)

    try {
      const activity = await cache.get<SuspiciousActivity>(key)
      return activity?.captchaRequired ||
        (activity?.riskScore || 0) >= this.RISK_THRESHOLDS.medium
    } catch {
      return false
    }
  }

  // Validate CAPTCHA response
  static async validateCaptcha(token: string, expectedAction: string): Promise<boolean> {
    // This would integrate with a CAPTCHA service like reCAPTCHA or hCaptcha
    // For now, return true for development
    try {
      // Example integration with reCAPTCHA
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY || '',
          response: token
        })
      })

      const data = await response.json()
      return data.success && data.action === expectedAction && data.score >= 0.5
    } catch (error) {
      logger.error('CAPTCHA validation failed', error as Error)
      return false
    }
  }

  // Dynamic rate limiting based on risk
  static getDynamicRateLimit(riskScore: number): { maxRequests: number; windowMs: number } {
    if (riskScore >= this.RISK_THRESHOLDS.critical) {
      return { maxRequests: 1, windowMs: 60 * 60 * 1000 } // 1 per hour
    } else if (riskScore >= this.RISK_THRESHOLDS.high) {
      return { maxRequests: 5, windowMs: 15 * 60 * 1000 } // 5 per 15 minutes
    } else if (riskScore >= this.RISK_THRESHOLDS.medium) {
      return { maxRequests: 20, windowMs: 15 * 60 * 1000 } // 20 per 15 minutes
    } else {
      return { maxRequests: 100, windowMs: 15 * 60 * 1000 } // 100 per 15 minutes
    }
  }

  // Private helper methods
  private static getSeverityScore(severity: AbusePattern['severity']): number {
    switch (severity) {
      case 'low': return 5
      case 'medium': return 15
      case 'high': return 30
      case 'critical': return 50
      default: return 0
    }
  }

  private static determineAction(
    riskScore: number,
    patterns: AbusePattern[]
  ): 'allow' | 'captcha' | 'block' {
    // Check for critical patterns that require blocking
    if (patterns.some(p => p.severity === 'critical')) {
      return 'block'
    }

    // Check for high-severity patterns
    if (patterns.some(p => p.severity === 'high') || riskScore >= this.RISK_THRESHOLDS.high) {
      return 'block'
    }

    // Medium risk requires CAPTCHA
    if (riskScore >= this.RISK_THRESHOLDS.medium) {
      return 'captcha'
    }

    // Low risk allows with monitoring
    return 'allow'
  }

  private static checkUserAgentAnomalies(userAgent: string): number {
    let score = 0

    // Missing user agent
    if (!userAgent || userAgent.length < 10) {
      score += 10
    }

    // Common bot patterns
    if (/bot|crawler|spider|scraper/i.test(userAgent)) {
      score += 5
    }

    // Suspicious user agents
    if (/python|curl|wget|postman/i.test(userAgent)) {
      score += 15
    }

    return score
  }

  private static checkRequestFrequency(request: NextRequest): number {
    // This would check recent request patterns
    // For now, return 0 - would need to implement request tracking
    return 0
  }

  private static checkGeographicAnomalies(request: NextRequest): number {
    // This would check for suspicious geographic patterns
    // For now, return 0 - would need geographic data
    return 0
  }

  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfIP = request.headers.get('cf-connecting-ip')

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    return realIP || cfIP || 'unknown'
  }
}