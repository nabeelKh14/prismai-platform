import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'

export interface SecurityScanResult {
  endpoint: string
  method: string
  vulnerabilities: Vulnerability[]
  riskScore: number
  recommendations: string[]
  scanTimestamp: Date
}

export interface Vulnerability {
  type: VulnerabilityType
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  location: string
  cwe: string
  remediation: string
}

export type VulnerabilityType =
  | 'sql_injection'
  | 'xss'
  | 'csrf'
  | 'broken_auth'
  | 'insecure_headers'
  | 'rate_limit_bypass'
  | 'sensitive_data_exposure'
  | 'broken_access_control'
  | 'security_misconfiguration'
  | 'injection'
  | 'xxe'
  | 'deserialization'

export class APISecurityScanner {
  private static vulnerabilityPatterns = {
    sql_injection: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b.*\$\{.*\})/i,
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b.*\+.*)/i,
      /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\%27)|(\%23))/i,
    ],
    xss: [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
    ],
    path_traversal: [
      /\.\.\//g,
      /\.\\/g,
      /%2e%2e%2f/gi,
      /%2e%2e\\/gi,
    ],
    command_injection: [
      /(\||&|;|\$\(|\`)/g,
      /exec\s*\(/i,
      /eval\s*\(/i,
      /system\s*\(/i,
    ],
  }

  /**
   * Scan API endpoint for security vulnerabilities
   */
  static async scanEndpoint(
    request: NextRequest,
    response?: any
  ): Promise<SecurityScanResult> {
    const vulnerabilities: Vulnerability[] = []
    const recommendations: string[] = []

    const endpoint = request.nextUrl.pathname
    const method = request.method

    // Scan request for vulnerabilities
    const requestVulns = await this.scanRequest(request)
    vulnerabilities.push(...requestVulns)

    // Scan response for vulnerabilities (if provided)
    if (response) {
      const responseVulns = this.scanResponse(response)
      vulnerabilities.push(...responseVulns)
    }

    // Check for common API security issues
    const apiVulns = this.checkAPISecurity(request)
    vulnerabilities.push(...apiVulns)

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(vulnerabilities))

    // Calculate risk score
    const riskScore = this.calculateRiskScore(vulnerabilities)

    const result: SecurityScanResult = {
      endpoint,
      method,
      vulnerabilities,
      riskScore,
      recommendations,
      scanTimestamp: new Date(),
    }

    // Log high-risk findings
    if (riskScore >= 7) {
      logger.error('High-risk security vulnerability detected', {
        endpoint,
        method,
        riskScore,
        vulnerabilities: vulnerabilities.filter(v => v.severity === 'high' || v.severity === 'critical'),
      })
    }

    return result
  }

  /**
   * Scan request for security vulnerabilities
   */
  private static async scanRequest(request: NextRequest): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = []

    // Get request data
    const url = request.nextUrl.pathname + request.nextUrl.search
    const headers = Array.from(request.headers.entries())
    const body = await this.getRequestBody(request)

    // Check URL for vulnerabilities
    vulnerabilities.push(...this.scanContent(url, 'url', 'URL Parameter'))

    // Check headers for vulnerabilities
    for (const [key, value] of headers) {
      vulnerabilities.push(...this.scanContent(value, 'header', `Header: ${key}`))
    }

    // Check body for vulnerabilities
    if (body) {
      vulnerabilities.push(...this.scanContent(body, 'body', 'Request Body'))
    }

    return vulnerabilities
  }

  /**
   * Scan response for security vulnerabilities
   */
  private static scanResponse(response: any): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = []

    // Check response headers
    if (response.headers) {
      try {
        const headersObj = response.headers as any
        if (typeof headersObj.entries === 'function') {
          const headers = Array.from(headersObj.entries()) as [string, string][]
          for (const [key, value] of headers) {
            if (key.toLowerCase().includes('set-cookie')) {
              // Check for insecure cookie settings
              if (!value.includes('Secure') || !value.includes('HttpOnly')) {
                vulnerabilities.push({
                  type: 'sensitive_data_exposure',
                  severity: 'medium',
                  description: 'Insecure cookie settings detected',
                  location: `Response Header: ${key}`,
                  cwe: 'CWE-614',
                  remediation: 'Add Secure and HttpOnly flags to cookies',
                })
              }
            }
          }
        }
      } catch {
        // Skip header analysis if headers are not iterable
      }
    }

    // Check response body for sensitive data exposure
    if (response.body) {
      const bodyContent = JSON.stringify(response.body)
      if (this.containsSensitiveData(bodyContent)) {
        vulnerabilities.push({
          type: 'sensitive_data_exposure',
          severity: 'high',
          description: 'Potential sensitive data exposure in response',
          location: 'Response Body',
          cwe: 'CWE-200',
          remediation: 'Ensure sensitive data is properly masked or encrypted',
        })
      }
    }

    return vulnerabilities
  }

  /**
   * Check for common API security issues
   */
  private static checkAPISecurity(request: NextRequest): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = []

    // Check for missing security headers
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'content-security-policy',
      'strict-transport-security',
    ]

    for (const header of securityHeaders) {
      if (!request.headers.get(header)) {
        vulnerabilities.push({
          type: 'insecure_headers',
          severity: 'medium',
          description: `Missing security header: ${header}`,
          location: 'Request Headers',
          cwe: 'CWE-693',
          remediation: `Add ${header} header to responses`,
        })
      }
    }

    // Check for HTTP method security
    if (request.method === 'TRACE' || request.method === 'TRACK') {
      vulnerabilities.push({
        type: 'security_misconfiguration',
        severity: 'medium',
        description: 'Potentially dangerous HTTP method enabled',
        location: 'HTTP Method',
        cwe: 'CWE-16',
        remediation: 'Disable TRACE and TRACK methods',
      })
    }

    // Check for API versioning
    if (!request.nextUrl.pathname.includes('/v1/') && !request.nextUrl.pathname.includes('/api/')) {
      vulnerabilities.push({
        type: 'security_misconfiguration',
        severity: 'low',
        description: 'API versioning not implemented',
        location: 'URL Path',
        cwe: 'CWE-16',
        remediation: 'Implement proper API versioning',
      })
    }

    return vulnerabilities
  }

  /**
   * Scan content for vulnerabilities using pattern matching
   */
  private static scanContent(
    content: string,
    contentType: string,
    location: string
  ): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = []

    // SQL Injection detection
    for (const pattern of this.vulnerabilityPatterns.sql_injection) {
      if (pattern.test(content)) {
        vulnerabilities.push({
          type: 'sql_injection',
          severity: 'high',
          description: 'Potential SQL injection vulnerability detected',
          location: `${contentType} - ${location}`,
          cwe: 'CWE-89',
          remediation: 'Use parameterized queries or prepared statements',
        })
        break
      }
    }

    // XSS detection
    for (const pattern of this.vulnerabilityPatterns.xss) {
      if (pattern.test(content)) {
        vulnerabilities.push({
          type: 'xss',
          severity: 'high',
          description: 'Potential XSS vulnerability detected',
          location: `${contentType} - ${location}`,
          cwe: 'CWE-79',
          remediation: 'Sanitize user input and use Content Security Policy',
        })
        break
      }
    }

    // Path traversal detection
    for (const pattern of this.vulnerabilityPatterns.path_traversal) {
      if (pattern.test(content)) {
        vulnerabilities.push({
          type: 'broken_access_control',
          severity: 'high',
          description: 'Potential path traversal vulnerability detected',
          location: `${contentType} - ${location}`,
          cwe: 'CWE-22',
          remediation: 'Validate and sanitize file paths',
        })
        break
      }
    }

    // Command injection detection
    for (const pattern of this.vulnerabilityPatterns.command_injection) {
      if (pattern.test(content)) {
        vulnerabilities.push({
          type: 'injection',
          severity: 'critical',
          description: 'Potential command injection vulnerability detected',
          location: `${contentType} - ${location}`,
          cwe: 'CWE-77',
          remediation: 'Avoid shell commands or use safe APIs',
        })
        break
      }
    }

    return vulnerabilities
  }

  /**
   * Check if content contains sensitive data
   */
  private static containsSensitiveData(content: string): boolean {
    const sensitivePatterns = [
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card numbers
      /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
      /\b\d{10,15}\b/, // Phone numbers
      /\b(password|token|key|secret|auth)\b/i, // Sensitive keywords
    ]

    return sensitivePatterns.some(pattern => pattern.test(content))
  }

  /**
   * Get request body safely
   */
  private static async getRequestBody(request: NextRequest): Promise<string | null> {
    try {
      if (request.method === 'GET' || request.method === 'HEAD') {
        return null
      }

      const contentType = request.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        return null
      }

      const body = await request.text()
      return body
    } catch {
      return null
    }
  }

  /**
   * Generate recommendations based on vulnerabilities
   */
  private static generateRecommendations(vulnerabilities: Vulnerability[]): string[] {
    const recommendations: string[] = []

    const vulnTypes = vulnerabilities.map(v => v.type)
    const uniqueTypes = [...new Set(vulnTypes)]

    if (uniqueTypes.includes('sql_injection')) {
      recommendations.push('Implement parameterized queries and input validation')
      recommendations.push('Use ORM with built-in SQL injection protection')
    }

    if (uniqueTypes.includes('xss')) {
      recommendations.push('Implement Content Security Policy (CSP)')
      recommendations.push('Use proper output encoding for user-generated content')
      recommendations.push('Validate and sanitize all user inputs')
    }

    if (uniqueTypes.includes('csrf')) {
      recommendations.push('Implement CSRF tokens for state-changing operations')
      recommendations.push('Use SameSite cookie attributes')
    }

    if (uniqueTypes.includes('insecure_headers')) {
      recommendations.push('Add security headers: X-Frame-Options, CSP, HSTS')
      recommendations.push('Implement secure cookie settings')
    }

    if (uniqueTypes.includes('sensitive_data_exposure')) {
      recommendations.push('Encrypt sensitive data at rest and in transit')
      recommendations.push('Implement proper data masking')
      recommendations.push('Use tokenization for sensitive information')
    }

    if (uniqueTypes.includes('broken_access_control')) {
      recommendations.push('Implement proper authorization checks')
      recommendations.push('Use role-based access control (RBAC)')
      recommendations.push('Validate user permissions on every request')
    }

    return recommendations
  }

  /**
   * Calculate risk score based on vulnerabilities
   */
  private static calculateRiskScore(vulnerabilities: Vulnerability[]): number {
    const severityWeights = {
      low: 1,
      medium: 3,
      high: 5,
      critical: 10,
    }

    const totalScore = vulnerabilities.reduce((score, vuln) => {
      return score + severityWeights[vuln.severity]
    }, 0)

    // Normalize to 0-10 scale
    return Math.min(Math.max(totalScore / 10, 0), 10)
  }

  /**
   * Run comprehensive security assessment
   */
  static async runSecurityAssessment(
    endpoints: Array<{ path: string; method: string }>
  ): Promise<{
    summary: {
      totalEndpoints: number
      vulnerableEndpoints: number
      criticalVulnerabilities: number
      highVulnerabilities: number
      riskScore: number
    }
    detailedResults: SecurityScanResult[]
  }> {
    const detailedResults: SecurityScanResult[] = []
    let vulnerableEndpoints = 0
    let criticalVulnerabilities = 0
    let highVulnerabilities = 0
    let totalRiskScore = 0

    // In a real implementation, this would make actual requests to endpoints
    // For now, we'll simulate scanning based on endpoint patterns

    for (const endpoint of endpoints) {
      const mockRequest = this.createMockRequest(endpoint.path, endpoint.method)
      const result = await this.scanEndpoint(mockRequest)

      detailedResults.push(result)

      if (result.vulnerabilities.length > 0) {
        vulnerableEndpoints++
      }

      criticalVulnerabilities += result.vulnerabilities.filter(v => v.severity === 'critical').length
      highVulnerabilities += result.vulnerabilities.filter(v => v.severity === 'high').length
      totalRiskScore += result.riskScore
    }

    const averageRiskScore = totalRiskScore / endpoints.length

    return {
      summary: {
        totalEndpoints: endpoints.length,
        vulnerableEndpoints,
        criticalVulnerabilities,
        highVulnerabilities,
        riskScore: averageRiskScore,
      },
      detailedResults,
    }
  }

  /**
   * Create mock request for testing
   */
  private static createMockRequest(path: string, method: string): NextRequest {
    const url = `http://localhost:3000${path}`
    const request = new Request(url, { method })

    // Create a minimal NextRequest-like object
    return {
      nextUrl: { pathname: path, search: '' },
      method,
      headers: new Headers(request.headers),
    } as NextRequest
  }
}

// Export convenience functions
export async function scanAPIEndpoint(
  request: NextRequest,
  response?: any
): Promise<SecurityScanResult> {
  return APISecurityScanner.scanEndpoint(request, response)
}

export async function runSecurityAssessment(
  endpoints: Array<{ path: string; method: string }>
) {
  return APISecurityScanner.runSecurityAssessment(endpoints)
}