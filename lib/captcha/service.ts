import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { AbuseDetectionService } from '@/lib/rate-limit/abuse-detection'

export interface CaptchaConfig {
  provider: 'recaptcha' | 'hcaptcha' | 'turnstile'
  siteKey: string
  secretKey: string
  minScore: number
}

export class CaptchaService {
  private config: CaptchaConfig

  constructor(config?: Partial<CaptchaConfig>) {
    this.config = {
      provider: config?.provider || 'recaptcha',
      siteKey: process.env.CAPTCHA_SITE_KEY || '',
      secretKey: process.env.CAPTCHA_SECRET_KEY || '',
      minScore: config?.minScore || 0.5,
      ...config
    }
  }

  // Generate CAPTCHA challenge HTML
  generateCaptchaHtml(action: string = 'submit'): string {
    switch (this.config.provider) {
      case 'recaptcha':
        return this.generateRecaptchaHtml(action)
      case 'hcaptcha':
        return this.generateHcaptchaHtml()
      case 'turnstile':
        return this.generateTurnstileHtml()
      default:
        return ''
    }
  }

  // Validate CAPTCHA response
  async validateCaptcha(
    token: string,
    action?: string,
    request?: NextRequest
  ): Promise<{
    success: boolean
    score?: number
    error?: string
  }> {
    try {
      switch (this.config.provider) {
        case 'recaptcha':
          return await this.validateRecaptcha(token, action)
        case 'hcaptcha':
          return await this.validateHcaptcha(token)
        case 'turnstile':
          return await this.validateTurnstile(token)
        default:
          return { success: false, error: 'Unsupported CAPTCHA provider' }
      }
    } catch (error) {
      logger.error('CAPTCHA validation error', error as Error, {
        provider: this.config.provider,
        action
      })

      // Track failed validation as suspicious activity
      if (request) {
        await AbuseDetectionService.trackSuspiciousActivity(request, {
          riskScore: 10,
          captchaRequired: true
        })
      }

      return { success: false, error: 'Validation failed' }
    }
  }

  // Check if CAPTCHA is required for request
  async requiresCaptcha(request: NextRequest): Promise<boolean> {
    // Check abuse detection first
    const abuseRequired = await AbuseDetectionService.requiresCaptcha(request)
    if (abuseRequired) return true

    // Additional checks can be added here
    // e.g., based on user behavior, geographic location, etc.

    return false
  }

  // Private methods for each provider
  private generateRecaptchaHtml(action: string): string {
    return `
      <script src="https://www.google.com/recaptcha/api.js" async defer></script>
      <div class="g-recaptcha"
           data-sitekey="${this.config.siteKey}"
           data-action="${action}">
      </div>
    `
  }

  private generateHcaptchaHtml(): string {
    return `
      <script src="https://js.hcaptcha.com/1/api.js" async defer></script>
      <div class="h-captcha"
           data-sitekey="${this.config.siteKey}">
      </div>
    `
  }

  private generateTurnstileHtml(): string {
    return `
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      <div class="cf-turnstile"
           data-sitekey="${this.config.siteKey}">
      </div>
    `
  }

  private async validateRecaptcha(token: string, action?: string): Promise<{
    success: boolean
    score?: number
    error?: string
  }> {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: this.config.secretKey,
        response: token
      })
    })

    const data = await response.json()

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'Verification failed'
      }
    }

    // Check action if provided
    if (action && data.action !== action) {
      return {
        success: false,
        error: 'Action mismatch'
      }
    }

    // Check score for v3
    if (data.score !== undefined && data.score < this.config.minScore) {
      return {
        success: false,
        score: data.score,
        error: `Score too low: ${data.score}`
      }
    }

    return {
      success: true,
      score: data.score
    }
  }

  private async validateHcaptcha(token: string): Promise<{
    success: boolean
    score?: number
    error?: string
  }> {
    const response = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: this.config.secretKey,
        response: token
      })
    })

    const data = await response.json()

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'Verification failed'
      }
    }

    return {
      success: true,
      score: data.score
    }
  }

  private async validateTurnstile(token: string): Promise<{
    success: boolean
    score?: number
    error?: string
  }> {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: this.config.secretKey,
        response: token
      })
    })

    const data = await response.json()

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'Verification failed'
      }
    }

    return {
      success: true,
      score: data.score
    }
  }
}

// Export singleton instance
export const captchaService = new CaptchaService()

// Middleware function for CAPTCHA validation
export async function withCaptchaValidation(
  handler: (request: NextRequest, ...args: any[]) => Promise<any>,
  action: string = 'submit'
) {
  return async (request: NextRequest, ...args: any[]) => {
    // Check if CAPTCHA is required
    const requiresCaptcha = await captchaService.requiresCaptcha(request)

    if (requiresCaptcha) {
      const captchaToken = request.headers.get('x-captcha-token')

      if (!captchaToken) {
        return new Response(
          JSON.stringify({
            error: 'CAPTCHA required',
            captchaHtml: captchaService.generateCaptchaHtml(action)
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      const validation = await captchaService.validateCaptcha(captchaToken, action, request)

      if (!validation.success) {
        // Track failed CAPTCHA as suspicious activity
        await AbuseDetectionService.trackSuspiciousActivity(request, {
          riskScore: 15,
          captchaRequired: true
        })

        return new Response(
          JSON.stringify({
            error: 'CAPTCHA validation failed',
            details: validation.error,
            captchaHtml: captchaService.generateCaptchaHtml(action)
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }

    return handler(request, ...args)
  }
}