# PrismAI Security Guidelines

## Overview

This document outlines the comprehensive security architecture, best practices, and guidelines for the PrismAI Platform. Security is implemented at multiple layers including application security, infrastructure security, data protection, and operational security.

## Security Architecture

### Multi-Layer Security Approach

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Layers                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ Application │  │   Network   │  │   Database  │  │External │ │
│  │  Security   │  │  Security   │  │  Security   │  │Services │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│         │                │                │                │     │
│         ▼                ▼                ▼                ▼     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │  Input      │  │  Access     │  │  Encryption │  │  Audit  │ │
│  │ Validation  │  │  Control    │  │ & Protection│  │  Logging│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Security Components

#### 1. Core Security Libraries
- **lib/security.ts**: Main security utilities and middleware
- **lib/security-monitoring.ts**: Security event monitoring
- **lib/compliance/**: HIPAA, GDPR, SOC2 compliance modules
- **lib/phi/**: PHI (Protected Health Information) compliance
- **lib/rate-limit/**: Multi-strategy rate limiting system

#### 2. Authentication & Authorization
- **Supabase Auth**: JWT-based authentication with Row-Level Security
- **Multi-Factor Authentication**: TOTP and SMS-based MFA
- **Role-Based Access Control (RBAC)**: Granular permission system
- **Session Management**: Secure session handling with expiration

#### 3. Input Validation & Sanitization
- **XSS Protection**: Comprehensive cross-site scripting prevention
- **SQL Injection Prevention**: Parameterized queries and input sanitization
- **CSRF Protection**: Double-submit cookie pattern
- **File Upload Security**: File type validation and secure handling

#### 4. Data Protection
- **Encryption at Rest**: Database and file encryption (pgcrypto)
- **Encryption in Transit**: TLS 1.3 for all communications
- **Data Classification**: Sensitive data identification and protection
- **Data Minimization**: Collect only necessary data

## Security Implementation

### Core Security Library (lib/security.ts)

#### Security Utilities

```typescript
// Core security validation schemas
export const securitySchemas = {
  email: z.string()
    .email('Invalid email address')
    .min(3, 'Email too short')
    .max(254, 'Email too long')
    .transform(sanitizeEmail),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
           'Password must contain uppercase, lowercase, number, and special character'),

  apiKey: z.string()
    .min(20, 'API key too short')
    .max(100, 'API key too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'API key contains invalid characters'),
}

// Security headers configuration
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}

// Content Security Policy
export const cspConfig = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  fontSrc: ["'self'", "data:"],
  connectSrc: ["'self'", "https:", "wss:"],
  mediaSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: []
}
```

#### Input Sanitization

```typescript
// Comprehensive input sanitization
export function sanitizeInput(input: string, type: 'html' | 'sql' | 'general'): string {
  if (typeof input !== 'string') return ''

  switch (type) {
    case 'html':
      return sanitizeHTML(input)
    case 'sql':
      return sanitizeSQLInput(input)
    case 'general':
      return input
        .trim()
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+=/gi, '') // Remove event handlers
    default:
      return input
  }
}

export function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') return ''

  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote']
  const allowedAttributes = ['href', 'target', 'rel']

  return input
    .replace(/<[^>]*>/g, (tag) => {
      const tagName = tag.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/)?.[1]?.toLowerCase()
      if (!tagName || !allowedTags.includes(tagName)) {
        return ''
      }

      if (tagName === 'a') {
        const href = tag.match(/href=["']([^"']*)["']/)?.[1]
        if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))) {
          return tag.replace(/<a([^>]*)>/, `<a$1 rel="noopener noreferrer" target="_blank">`)
        }
        return ''
      }

      return tag
    })
}

export function sanitizeSQLInput(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    .replace(/'/g, "''") // Escape single quotes for SQL
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/gi, '') // Remove dangerous SQL keywords
}
```

### Rate Limiting System (lib/rate-limit/)

#### Multi-Strategy Rate Limiting

```typescript
// Rate limiting strategies
export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket'
}

// Rate limit tiers
export const RATE_LIMIT_TIERS = {
  FREE: {
    requests: 100,
    window: 60 * 60 * 1000, // 1 hour
  },
  PRO: {
    requests: 1000,
    window: 60 * 60 * 1000, // 1 hour
  },
  ENTERPRISE: {
    requests: 10000,
    window: 60 * 60 * 1000, // 1 hour
  },
} as const

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  SLIDING_WINDOW: {
    windowSize: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  FIXED_WINDOW: {
    windowSize: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
  },
  ABUSE_THRESHOLDS: {
    suspicious: 0.8,
    malicious: 0.95,
  },
} as const

// Advanced rate limiting implementation
export class AdvancedRateLimiter {
  private store: Map<string, { count: number; resetTime: number }> = new Map()
  
  async checkLimit(
    identifier: string,
    strategy: RateLimitStrategy,
    config: { maxRequests: number; windowSize: number }
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const key = `${identifier}:${strategy}`
    const record = this.store.get(key)

    if (!record || now > record.resetTime) {
      // New window
      this.store.set(key, {
        count: 1,
        resetTime: now + config.windowSize
      })
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowSize
      }
    }

    if (record.count >= config.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime
      }
    }

    // Increment count
    record.count++
    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetTime: record.resetTime
    }
  }

  // Abuse detection
  detectAbuse(identifier: string, requestCount: number): AbuseLevel {
    if (requestCount > RATE_LIMIT_CONFIG.ABUSE_THRESHOLDS.malicious) {
      return 'malicious'
    }
    if (requestCount > RATE_LIMIT_CONFIG.ABUSE_THRESHOLDS.suspicious) {
      return 'suspicious'
    }
    return 'normal'
  }
}
```

### Security Monitoring (lib/security-monitoring.ts)

#### Security Event Monitoring

```typescript
// Security event types
export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'authentication_failure',
  AUTHORIZATION_FAILURE = 'authorization_failure',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CSRF_VIOLATION = 'csrf_violation',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  INVALID_REQUEST = 'invalid_request',
  BOT_DETECTION = 'bot_detection',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt'
}

// Security monitoring system
export class SecurityMonitor {
  private events: SecurityEvent[] = []
  private alertThresholds = {
    failed_logins: 5,
    suspicious_activity: 10,
    rate_limit_violations: 20
  }

  // Log security event
  logEvent(
    type: SecurityEventType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>
  ): void {
    const event: SecurityEvent = {
      id: generateId(),
      type,
      severity,
      timestamp: new Date().toISOString(),
      details: {
        ...details,
        ip: getClientIP(),
        user_agent: getUserAgent(),
        session_id: getSessionId()
      }
    }

    this.events.push(event)
    this.checkAlerts(event)
    this.persistEvent(event)
  }

  // Check for alert conditions
  private checkAlerts(event: SecurityEvent): void {
    if (event.severity === 'critical') {
      this.triggerCriticalAlert(event)
    }

    if (event.type === SecurityEventType.AUTHENTICATION_FAILURE) {
      this.checkFailedLogins(event.details.user_id)
    }

    if (event.type === SecurityEventType.RATE_LIMIT_EXCEEDED) {
      this.checkRateLimitViolations(event.details.ip)
    }
  }

  // Real-time security dashboard data
  getSecurityMetrics(): SecurityMetrics {
    const now = Date.now()
    const last24h = this.events.filter(e => 
      new Date(e.timestamp).getTime() > now - 24 * 60 * 60 * 1000
    )

    return {
      totalEvents: this.events.length,
      last24hEvents: last24h.length,
      criticalEvents: this.events.filter(e => e.severity === 'critical').length,
      topThreats: this.getTopThreats(),
      alertCount: this.getActiveAlerts().length,
      blockedIPs: this.getBlockedIPs(),
      suspiciousActivity: this.getSuspiciousActivity()
    }
  }
}
```

### PHI Compliance (lib/phi/)

#### Protected Health Information Handling

```typescript
// PHI compliance system
export class PHICompliance {
  // PHI data classification
  static classifyData(data: any): DataClassification {
    const phiIndicators = [
      'ssn', 'social_security', 'medical_record',
      'diagnosis', 'prescription', 'insurance',
      'phone', 'address', 'birth_date', 'age'
    ]

    const dataStr = JSON.stringify(data).toLowerCase()
    const phiCount = phiIndicators.filter(indicator => 
      dataStr.includes(indicator)
    ).length

    if (phiCount >= 3) {
      return 'phi_high'
    } else if (phiCount >= 1) {
      return 'phi_medium'
    }
    return 'non_phi'
  }

  // PHI encryption
  static encryptPHI(data: string, keyId: string): EncryptedPHI {
    const encrypted = encrypt(data, getPHIKey(keyId))
    return {
      encrypted_data: encrypted.data,
      key_id: keyId,
      encryption_algorithm: 'AES-256-GCM',
      created_at: new Date().toISOString()
    }
  }

  // PHI audit trail
  static logPHIAccess(
    userId: string,
    patientId: string,
    action: 'read' | 'write' | 'delete',
    dataType: string
  ): void {
    logger.info('PHI access logged', {
      user_id: userId,
      patient_id: patientId,
      action,
      data_type: dataType,
      timestamp: new Date().toISOString(),
      audit_type: 'phi_access'
    })
  }
}
```

### Compliance Framework (lib/compliance/)

#### HIPAA Compliance

```typescript
// HIPAA compliance system
export class HIPAACompliance {
  // HIPAA audit requirements
  static logAccess(
    userId: string,
    patientId: string,
    resource: string,
    action: string
  ): void {
    const auditEntry = {
      user_id: userId,
      patient_id: patientId,
      resource_accessed: resource,
      action_taken: action,
      timestamp: new Date().toISOString(),
      ip_address: getClientIP(),
      user_agent: getUserAgent(),
      session_id: getSessionId()
    }

    // Store in HIPAA audit log
    auditLogRepository.create(auditEntry)
  }

  // Breach detection and notification
  static detectBreach(securityEvent: SecurityEvent): BreachAssessment {
    const breachIndicators = [
      'unauthorized_access',
      'data_exfiltration',
      'privilege_escalation'
    ]

    const isBreach = breachIndicators.some(indicator => 
      securityEvent.type.includes(indicator)
    )

    if (isBreach) {
      return {
        isBreach: true,
        severity: 'critical',
        notificationRequired: true,
        timeline: this.calculateBreachTimeline(securityEvent)
      }
    }

    return { isBreach: false, severity: 'low', notificationRequired: false }
  }
}
```

#### GDPR Compliance

```typescript
// GDPR compliance system
export class GDPRCompliance {
  // Data subject rights
  static async handleDataSubjectRequest(
    requestType: 'access' | 'rectification' | 'erasure' | 'portability',
    userId: string,
    dataSubjectEmail: string
  ): Promise<void> {
    switch (requestType) {
      case 'access':
        await this.handleDataAccessRequest(dataSubjectEmail)
        break
      case 'erasure':
        await this.handleDataErasureRequest(dataSubjectEmail)
        break
      case 'portability':
        await this.handleDataPortabilityRequest(dataSubjectEmail)
        break
      case 'rectification':
        await this.handleDataRectificationRequest(dataSubjectEmail)
        break
    }
  }

  // Data minimization compliance
  static validateDataMinimization(
    purpose: string,
    dataFields: string[]
  ): DataMinimizationAssessment {
    const requiredFields = this.getRequiredFieldsForPurpose(purpose)
    const hasExcessiveFields = dataFields.length > requiredFields.length

    return {
      compliant: !hasExcessiveFields,
      purpose,
      requiredFields,
      providedFields: dataFields,
      recommendations: hasExcessiveFields 
        ? ['Remove excessive data fields', 'Use privacy by design principles']
        : []
    }
  }
}
```

## Authentication Security

### JWT Token Security

#### Token Configuration

```typescript
// JWT configuration from environment
export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: '1h',
  refreshExpiresIn: '7d',
  issuer: 'prismai',
  audience: 'prismai-users',
  algorithm: 'HS256'
}

// Token validation with Supabase
export async function validateJWT(token: string): Promise<JWTPayload> {
  try {
    const { data, error } = await supabase.auth.getUser(token)
    
    if (error || !data.user) {
      throw new AuthenticationError('Invalid token')
    }

    return {
      sub: data.user.id,
      email: data.user.email,
      role: data.user.user_metadata?.role || 'user',
      tenant_id: data.user.user_metadata?.tenant_id
    }
  } catch (error) {
    throw new AuthenticationError('Token validation failed')
  }
}
```

### Multi-Factor Authentication

#### TOTP Implementation

```typescript
// MFA configuration
export const mfaConfig = {
  issuer: 'PrismAI',
  digits: 6,
  algorithm: 'SHA1',
  period: 30,
  window: 1
}

// Generate TOTP secret
export async function generateTOTPSecret(): Promise<string> {
  const secret = speakeasy.generateSecret({
    name: mfaConfig.issuer,
    issuer: mfaConfig.issuer
  })
  return secret.base32
}

// Verify TOTP token
export function verifyTOTPToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: mfaConfig.window
  })
}
```

## Data Protection

### Encryption System

#### Database Encryption

```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create encryption functions
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key_id UUID)
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(data, get_encryption_key(key_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create decryption functions
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data BYTEA, key_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, get_encryption_key(key_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### File Encryption

```typescript
// File encryption service
export class FileEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32
  private static readonly IV_LENGTH = 12

  static async encryptFile(
    fileBuffer: Buffer,
    encryptionKey: string
  ): Promise<EncryptedFile> {
    const iv = crypto.randomBytes(this.IV_LENGTH)
    const key = crypto.scryptSync(encryptionKey, 'salt', this.KEY_LENGTH)
    
    const cipher = crypto.createCipher(this.ALGORITHM, key)
    cipher.setAAD(Buffer.from('file-encryption'))

    const encrypted = Buffer.concat([
      cipher.update(fileBuffer),
      cipher.final()
    ])

    const authTag = cipher.getAuthTag()

    return {
      encryptedData: Buffer.concat([iv, authTag, encrypted]),
      iv,
      authTag,
      algorithm: this.ALGORITHM
    }
  }

  static async decryptFile(
    encryptedBuffer: Buffer,
    encryptionKey: string
  ): Promise<Buffer> {
    const iv = encryptedBuffer.slice(0, this.IV_LENGTH)
    const authTag = encryptedBuffer.slice(this.IV_LENGTH, this.IV_LENGTH + 16)
    const encrypted = encryptedBuffer.slice(this.IV_LENGTH + 16)

    const key = crypto.scryptSync(encryptionKey, 'salt', this.KEY_LENGTH)
    
    const decipher = crypto.createDecipher(this.ALGORITHM, key)
    decipher.setAAD(Buffer.from('file-encryption'))
    decipher.setAuthTag(authTag)

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])
  }
}
```

## Access Control

### Row-Level Security (RLS)

#### Database RLS Policies

```sql
-- Enable RLS on all tenant tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "tenant_isolation" ON tenants
  FOR ALL USING (id = current_setting('app.current_tenant_id')::uuid);

-- User profile access policy
CREATE POLICY "user_profile_access" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Conversation access policy
CREATE POLICY "conversation_access" ON conversations
  FOR ALL USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM tenant_users 
      WHERE user_id = auth.uid() 
      AND tenant_id = conversations.user_id
    )
  );

-- Admin access policy
CREATE POLICY "admin_full_access" ON conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );
```

### Role-Based Access Control

```typescript
// User roles and permissions
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
  AGENT: 'agent',
  USER: 'user'
} as const

// Permission matrix
export const PERMISSIONS = {
  [USER_ROLES.SUPER_ADMIN]: [
    'system:admin',
    'users:manage',
    'agents:manage',
    'conversations:access',
    'analytics:view',
    'settings:modify',
    'billing:manage',
    'tenant:manage'
  ],
  [USER_ROLES.ADMIN]: [
    'users:manage',
    'agents:manage',
    'conversations:access',
    'analytics:view',
    'settings:modify'
  ],
  [USER_ROLES.MANAGER]: [
    'agents:view',
    'conversations:access',
    'analytics:view',
    'reports:generate'
  ],
  [USER_ROLES.SUPERVISOR]: [
    'conversations:access',
    'agents:view',
    'quality:review',
    'reports:view'
  ],
  [USER_ROLES.AGENT]: [
    'conversations:access',
    'customers:contact',
    'knowledge:view'
  ],
  [USER_ROLES.USER]: [
    'profile:view',
    'conversations:participate'
  ]
}

// Permission checking middleware
export function requirePermission(permission: string) {
  return async (request: NextRequest) => {
    const user = await getCurrentUser(request)
    
    if (!user) {
      throw new AuthenticationError('Authentication required')
    }

    const userPermissions = PERMISSIONS[user.role as keyof typeof PERMISSIONS] || []
    
    if (!userPermissions.includes(permission)) {
      logger.warn('Permission denied', {
        user_id: user.id,
        permission,
        resource: request.nextUrl.pathname,
        role: user.role
      })
      throw new AuthorizationError('Insufficient permissions')
    }
  }
}
```

## Security Middleware

### Global Security Middleware

```typescript
// middleware.ts - Main security middleware
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AdvancedRateLimiter } from '@/lib/rate-limit/advanced-rate-limiter'
import { SecurityMonitor } from '@/lib/security-monitoring'
import { BotDetection } from '@/lib/security/bot-detection'

const rateLimiter = new AdvancedRateLimiter()
const securityMonitor = new SecurityMonitor()

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Apply security headers
  const securityHeaders = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  }

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await rateLimiter.checkLimit(
      clientId,
      RateLimitStrategy.SLIDING_WINDOW,
      { maxRequests: 100, windowSize: 60 * 1000 }
    )

    if (!rateLimitResult.allowed) {
      securityMonitor.logEvent(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        'medium',
        { client_id: clientId, endpoint: request.nextUrl.pathname }
      )
      
      return new NextResponse('Rate limit exceeded', { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        }
      })
    }

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())
  }

  // Bot detection
  if (BotDetection.detectBot(request)) {
    securityMonitor.logEvent(
      SecurityEventType.BOT_DETECTION,
      'medium',
      { 
        client_id: getClientIdentifier(request),
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    )
    return new NextResponse('Bot access denied', { status: 403 })
  }

  // CSRF protection for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token')
    const sessionId = getSessionId(request)
    
    if (!csrfToken || !CSRFProtection.validateToken(csrfToken, sessionId)) {
      securityMonitor.logEvent(
        SecurityEventType.CSRF_VIOLATION,
        'high',
        { client_id: getClientIdentifier(request) }
      )
      return new NextResponse('CSRF token invalid', { status: 403 })
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

## Security Monitoring & Alerting

### Real-time Security Monitoring

```typescript
// Security dashboard metrics
export function getSecurityDashboardMetrics(): SecurityDashboardData {
  return {
    activeThreats: getActiveThreats(),
    securityEvents: getRecentSecurityEvents(),
    blockedIPs: getBlockedIPAddresses(),
    failedLogins: getFailedLoginAttempts(),
    suspiciousActivity: getSuspiciousActivityPatterns(),
    complianceStatus: getComplianceStatus(),
    auditTrail: getRecentAuditEntries()
  }
}

// Automated threat response
export class ThreatResponse {
  static async handleThreat(threat: SecurityThreat): Promise<void> {
    switch (threat.severity) {
      case 'critical':
        await this.handleCriticalThreat(threat)
        break
      case 'high':
        await this.handleHighThreat(threat)
        break
      case 'medium':
        await this.handleMediumThreat(threat)
        break
      case 'low':
        await this.handleLowThreat(threat)
        break
    }
  }

  private static async handleCriticalThreat(threat: SecurityThreat): Promise<void> {
    // Immediately block IP
    await blockIPAddress(threat.sourceIP, '24h')
    
    // Send emergency alert
    await sendEmergencyAlert({
      type: 'critical_security_threat',
      threat,
      immediate_action_required: true
    })
    
    // Log for forensics
    logger.error('CRITICAL SECURITY THREAT', threat)
  }
}
```

## Compliance & Auditing

### Comprehensive Audit Logging

```typescript
// Audit logging system
export class AuditLogger {
  static async logSecurityEvent(
    event: SecurityAuditEvent
  ): Promise<void> {
    const auditEntry = {
      event_type: event.type,
      user_id: event.userId,
      session_id: event.sessionId,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      resource: event.resource,
      action: event.action,
      result: event.result,
      timestamp: new Date().toISOString(),
      severity: event.severity,
      details: event.details
    }

    // Store in audit log
    await auditLogRepository.create(auditEntry)

    // Real-time alerting for critical events
    if (event.severity === 'critical') {
      await securityMonitor.alert('critical_audit_event', auditEntry)
    }
  }

  // Generate compliance reports
  static async generateComplianceReport(
    framework: 'HIPAA' | 'GDPR' | 'SOC2',
    dateRange: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    const auditEntries = await auditLogRepository.findByDateRange(
      dateRange.start,
      dateRange.end
    )

    switch (framework) {
      case 'HIPAA':
        return this.generateHIPAAReport(auditEntries)
      case 'GDPR':
        return this.generateGDPRReport(auditEntries)
      case 'SOC2':
        return this.generateSOC2Report(auditEntries)
    }
  }
}
```

## Security Best Practices

### Development Security

#### Code Security Guidelines

```typescript
// Secure coding practices
export const SECURE_CODING_GUIDELINES = {
  inputValidation: {
    validateAllInputs: true,
    whitelistApproach: true,
    outputEncoding: true,
    parameterizedQueries: true
  },
  authentication: {
    strongPasswords: true,
    mfaEnabled: true,
    sessionManagement: true,
    tokenValidation: true
  },
  authorization: {
    principleOfLeastPrivilege: true,
    roleBasedAccess: true,
    resourceLevelPermissions: true,
    tenantIsolation: true
  },
  dataProtection: {
    encryptionAtRest: true,
    encryptionInTransit: true,
    dataMinimization: true,
    secureDeletion: true
  }
}

// Security testing utilities
export class SecurityTester {
  static async testInputValidation(input: string): Promise<ValidationResult> {
    const testPayloads = [
      '<script>alert("xss")</script>',
      "'; DROP TABLE users; --",
      '${7*7}',
      '../../../etc/passwd',
      '<img src=x onerror=alert("xss")>'
    ]

    const results = testPayloads.map(payload => {
      const sanitized = sanitizeInput(input + payload, 'general')
      const isSafe = !sanitized.includes(payload)
      return { payload, safe: isSafe }
    })

    return {
      overall: results.every(r => r.safe),
      results
    }
  }

  static async testAuthenticationBypass(): Promise<AuthTestResult> {
    const bypassAttempts = [
      'admin\' OR \'1\'=\'1',
      'admin\'--',
      'admin\'/*',
      '\' OR 1=1--',
      '\' OR \'a\'=\'a'
    ]

    const results = await Promise.all(
      bypassAttempts.map(attempt => 
        testLoginEndpoint(attempt, 'anypassword')
      )
    )

    return {
      bypassed: results.some(r => r.success),
      attempts: results
    }
  }
}
```

### Security Maintenance

#### Regular Security Tasks

```typescript
// Security maintenance scheduler
export class SecurityMaintenance {
  // Daily security checks
  static async performDailyChecks(): Promise<void> {
    await this.checkFailedLogins()
    await this.scanForSuspiciousActivity()
    await this.updateSecurityMetrics()
    await this.rotateLogFiles()
  }

  // Weekly security review
  static async performWeeklyReview(): Promise<void> {
    await this.reviewUserAccess()
    await this.auditPermissions()
    await this.updateThreatIntelligence()
    await this.testBackupSecurity()
  }

  // Monthly security audit
  static async performMonthlyAudit(): Promise<void> {
    await this.runVulnerabilityScan()
    await this.penetrationTest()
    await this.updateSecurityPolicies()
    await this.complianceCheck()
  }
}
```

## Incident Response

### Security Incident Management

```typescript
// Incident response system
export class IncidentResponse {
  static async handleSecurityIncident(
    incident: SecurityIncident
  ): Promise<IncidentResponse> {
    // 1. Immediate containment
    await this.containIncident(incident)
    
    // 2. Assessment
    const assessment = await this.assessImpact(incident)
    
    // 3. Eradication
    await this.eradicateThreat(incident)
    
    // 4. Recovery
    await this.recoverSystems(incident)
    
    // 5. Post-incident review
    await this.documentLessons(incident, assessment)
    
    return {
      incidentId: incident.id,
      resolved: true,
      timeline: assessment.timeline,
      impact: assessment.impact,
      actions: assessment.actions
    }
  }

  private static async containIncident(incident: SecurityIncident): Promise<void> {
    // Block malicious IPs
    if (incident.sourceIPs) {
      await blockIPAddresses(incident.sourceIPs, '48h')
    }
    
    // Revoke compromised sessions
    if (incident.compromisedUsers) {
      await revokeUserSessions(incident.compromisedUsers)
    }
    
    // Enable enhanced monitoring
    await enableEnhancedMonitoring()
  }
}
```

This security guidelines document provides comprehensive information for maintaining the security posture of the PrismAI platform through best practices, monitoring, and incident response procedures. The implementation is based on the actual security libraries and middleware found in the codebase.