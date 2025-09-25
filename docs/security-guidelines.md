# PrismAI Security Guidelines

## Overview

This document outlines the comprehensive security architecture, best practices, and guidelines for the PrismAI platform. Security is implemented at multiple layers including application security, infrastructure security, data protection, and operational security.

## Security Architecture

### Multi-Layer Security Approach

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │   Network       │    │   Data          │
│   Security      │    │   Security      │    │   Security      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Input         │    │   Access        │    │   Encryption    │
│   Validation    │    │   Control       │    │   & Protection  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Security Components

#### 1. Authentication & Authorization
- **JWT-based Authentication**: Secure token-based authentication
- **Multi-Factor Authentication (MFA)**: TOTP and SMS-based MFA
- **Role-Based Access Control (RBAC)**: Granular permission system
- **Session Management**: Secure session handling with expiration

#### 2. Input Validation & Sanitization
- **XSS Protection**: Comprehensive cross-site scripting prevention
- **SQL Injection Prevention**: Parameterized queries and input sanitization
- **CSRF Protection**: Double-submit cookie pattern
- **File Upload Security**: File type validation and malware scanning

#### 3. Data Protection
- **Encryption at Rest**: Database and file encryption
- **Encryption in Transit**: TLS 1.3 for all communications
- **Data Classification**: Sensitive data identification and protection
- **Data Minimization**: Collect only necessary data

#### 4. Infrastructure Security
- **Container Security**: Non-root containers with minimal attack surface
- **Network Security**: Firewall rules and network segmentation
- **Monitoring & Logging**: Comprehensive security event logging
- **Vulnerability Management**: Regular security updates and patches

## Authentication Security

### JWT Token Security

#### Token Configuration

```typescript
// JWT Configuration
export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: '1h',
  refreshExpiresIn: '7d',
  issuer: 'prismai',
  audience: 'prismai-users',
  algorithm: 'HS256'
}
```

#### Token Validation

```typescript
// Secure token validation
export function validateJWT(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithms: [jwtConfig.algorithm]
    })

    // Additional security checks
    if (!decoded.sub || !decoded.iat || !decoded.exp) {
      throw new AuthenticationError('Invalid token structure')
    }

    // Check token expiration with clock skew tolerance
    const now = Math.floor(Date.now() / 1000)
    if (decoded.exp < now - 60) { // 60 second tolerance
      throw new AuthenticationError('Token expired')
    }

    return decoded
  } catch (error) {
    throw new AuthenticationError('Token validation failed')
  }
}
```

### Multi-Factor Authentication

#### TOTP Implementation

```typescript
// TOTP Configuration
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

#### MFA Enforcement

```typescript
// MFA enforcement middleware
export function requireMFA(requiredRoles: string[] = []) {
  return async (request: NextRequest) => {
    const user = await getCurrentUser(request)

    if (!user.mfa_enabled && requiredRoles.includes(user.role)) {
      throw new AuthenticationError('MFA required for this operation')
    }

    if (user.mfa_enabled && !request.headers.get('x-mfa-token')) {
      throw new AuthenticationError('MFA token required')
    }

    // Verify MFA token if provided
    if (request.headers.get('x-mfa-token')) {
      const mfaToken = request.headers.get('x-mfa-token')!
      const isValid = verifyTOTPToken(user.mfa_secret, mfaToken)

      if (!isValid) {
        throw new AuthenticationError('Invalid MFA token')
      }
    }
  }
}
```

## Input Validation & Sanitization

### XSS Protection

#### HTML Sanitization

```typescript
// Comprehensive HTML sanitization
export function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') return ''

  // Remove all HTML tags except allowed ones
  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote']
  const allowedAttributes = ['href', 'target', 'rel']

  return input
    .replace(/<[^>]*>/g, (tag) => {
      const tagName = tag.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/)?.[1]?.toLowerCase()
      if (!tagName || !allowedTags.includes(tagName)) {
        return ''
      }

      // For links, only allow safe attributes
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
```

#### Content Security Policy (CSP)

```html
<!-- CSP Headers -->
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-{random-nonce}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://generativelanguage.googleapis.com https://api.vapi.ai wss://api.vapi.ai;
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
  block-all-mixed-content;
  require-sri-for script style;
```

### SQL Injection Prevention

#### Parameterized Queries

```typescript
// Safe database operations
export async function safeDatabaseQuery(userId: string, query: string) {
  const sanitizedQuery = sanitizeSQLInput(query)
  const sanitizedUserId = sanitizeString(userId)

  const { data, error } = await supabase
    .rpc('safe_query', {
      query: sanitizedQuery,
      user_id: sanitizedUserId
    })

  if (error) {
    throw new DatabaseError('Query execution failed')
  }

  return data
}
```

#### Input Sanitization

```typescript
// SQL injection prevention
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

### CSRF Protection

#### Double-Submit Cookie Pattern

```typescript
// CSRF token generation
export class CSRFProtection {
  static generateToken(sessionId: string): string {
    const timestamp = Date.now().toString()
    const data = `${sessionId}:${timestamp}`
    const signature = createHash('sha256')
      .update(data + this.secret)
      .digest('hex')

    return Buffer.from(`${data}:${signature}`).toString('base64')
  }

  static validateToken(token: string, sessionId: string, maxAge = 3600000): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [session, timestamp, signature] = decoded.split(':')

      if (session !== sessionId) return false

      const now = Date.now()
      const tokenTime = parseInt(timestamp)
      if (now - tokenTime > maxAge) return false

      const expectedData = `${session}:${timestamp}`
      const expectedSignature = createHash('sha256')
        .update(expectedData + this.secret)
        .digest('hex')

      return timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    } catch {
      return false
    }
  }
}
```

## Data Protection

### Encryption at Rest

#### Database Encryption

```sql
-- Enable database encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create encrypted table
CREATE TABLE sensitive_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  data TEXT NOT NULL,
  encrypted_data BYTEA,
  encryption_key_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Encrypt data before storage
INSERT INTO sensitive_data (user_id, data, encrypted_data, encryption_key_id)
VALUES (
  $1,
  $2,
  pgp_sym_encrypt($2, $3),
  $4
);
```

#### File Encryption

```typescript
// File encryption utilities
export class FileEncryption {
  static async encryptFile(filePath: string, key: string): Promise<void> {
    const fileBuffer = await fs.readFile(filePath)
    const cipher = createCipher('aes-256-gcm', key)
    const encrypted = Buffer.concat([
      cipher.update(fileBuffer),
      cipher.final()
    ])

    const authTag = cipher.getAuthTag()
    const encryptedData = Buffer.concat([encrypted, authTag])

    await fs.writeFile(filePath + '.enc', encryptedData)
  }

  static async decryptFile(filePath: string, key: string): Promise<Buffer> {
    const encryptedData = await fs.readFile(filePath)
    const authTag = encryptedData.slice(-16)
    const encrypted = encryptedData.slice(0, -16)

    const decipher = createDecipher('aes-256-gcm', key)
    decipher.setAuthTag(authTag)

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])
  }
}
```

### Encryption in Transit

#### TLS Configuration

```typescript
// TLS configuration for secure connections
export const tlsConfig = {
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384'
  ],
  honorCipherOrder: true,
  secureProtocol: 'TLSv1_2_method',
  requestCert: true,
  rejectUnauthorized: true
}
```

#### Certificate Management

```typescript
// Certificate validation
export function validateCertificate(cert: string, hostname: string): boolean {
  const certificate = new crypto.X509Certificate(cert)

  // Check certificate validity
  const now = new Date()
  if (now < new Date(certificate.validFrom) || now > new Date(certificate.validTo)) {
    return false
  }

  // Check hostname matches
  const altNames = certificate.getIssuer()
  const commonName = certificate.subject

  return altNames.includes(hostname) || commonName.includes(hostname)
}
```

## Access Control

### Role-Based Access Control (RBAC)

#### User Roles and Permissions

```typescript
// Role definitions
export const userRoles = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  USER: 'user'
} as const

// Permission matrix
export const permissions = {
  [userRoles.SUPER_ADMIN]: [
    'system:admin',
    'users:manage',
    'agents:manage',
    'conversations:access',
    'analytics:view',
    'settings:modify'
  ],
  [userRoles.ADMIN]: [
    'users:manage',
    'agents:manage',
    'conversations:access',
    'analytics:view',
    'settings:modify'
  ],
  [userRoles.MANAGER]: [
    'agents:view',
    'conversations:access',
    'analytics:view',
    'reports:generate'
  ],
  [userRoles.AGENT]: [
    'conversations:access',
    'customers:contact'
  ],
  [userRoles.USER]: [
    'profile:view',
    'conversations:participate'
  ]
}
```

#### Permission Checking

```typescript
// Permission checking middleware
export function requirePermission(permission: string) {
  return async (request: NextRequest) => {
    const user = await getCurrentUser(request)

    if (!user.permissions.includes(permission)) {
      throw new AuthorizationError('Insufficient permissions')
    }

    // Log permission check
    logger.info('Permission check', {
      user_id: user.id,
      permission,
      resource: request.nextUrl.pathname,
      granted: true
    })
  }
}
```

### Row-Level Security (RLS)

#### Database RLS Policies

```sql
-- Enable RLS on sensitive tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own conversations"
ON conversations FOR SELECT
USING (user_id = current_user_id());

CREATE POLICY "Agents can view assigned conversations"
ON conversations FOR SELECT
USING (
  assigned_agent_id = current_user_id()
  OR user_id = current_user_id()
);

CREATE POLICY "Admins can view all conversations"
ON conversations FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = current_user_id()
    AND role IN ('admin', 'super_admin')
  )
);
```

## Infrastructure Security

### Container Security

#### Docker Security Best Practices

```dockerfile
# Use minimal base image
FROM node:18-alpine AS base

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set secure permissions
RUN chown -R nextjs:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1
```

#### Kubernetes Security

```yaml
# Security-focused pod configuration
apiVersion: v1
kind: Pod
metadata:
  name: prismai-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    fsGroup: 1001
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: prismai
    image: prismai:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      runAsUser: 1001
      capabilities:
        drop:
          - ALL
    resources:
      limits:
        cpu: 1000m
        memory: 2Gi
      requests:
        cpu: 500m
        memory: 1Gi
    volumeMounts:
    - name: tmp-volume
      mountPath: /tmp
    - name: cache-volume
      mountPath: /app/.cache
  volumes:
  - name: tmp-volume
    emptyDir: {}
  - name: cache-volume
    emptyDir: {}
```

### Network Security

#### Firewall Configuration

```bash
# UFW firewall rules
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow specific ports
sudo ufw allow ssh
sudo ufw allow https
sudo ufw allow http

# Rate limiting
sudo ufw limit ssh
sudo ufw limit https

# Allow specific IPs for admin access
sudo ufw allow from 192.168.1.0/24 to any port 22
sudo ufw allow from 10.0.0.0/8 to any port 3000
```

#### Network Segmentation

```yaml
# Network policies for Kubernetes
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: prismai-network-policy
spec:
  podSelector:
    matchLabels:
      app: prismai
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 5432
    - protocol: TCP
      port: 6379
```

## Security Monitoring

### Security Event Logging

#### Audit Logging

```typescript
// Security event logging
export class SecurityAudit {
  static logSensitiveAction(
    action: string,
    userId: string,
    details: Record<string, any> = {}
  ): void {
    logger.info('Sensitive action performed', {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ip_address: getClientIP(),
      user_agent: getUserAgent(),
      ...details,
    })
  }

  static logDataAccess(
    resource: string,
    userId: string,
    operation: 'read' | 'write' | 'delete',
    details: Record<string, any> = {}
  ): void {
    logger.info('Data access logged', {
      resource,
      userId,
      operation,
      timestamp: new Date().toISOString(),
      ...details,
    })
  }
}
```

#### Security Alerting

```typescript
// Security alerting configuration
export const securityAlerts = {
  failed_login_attempts: {
    threshold: 5,
    window_minutes: 15,
    severity: 'high',
    channels: ['email', 'slack', 'sms']
  },
  suspicious_activity: {
    threshold: 10,
    window_minutes: 60,
    severity: 'critical',
    channels: ['email', 'slack', 'sms']
  },
  data_breach_attempt: {
    threshold: 1,
    window_minutes: 5,
    severity: 'critical',
    channels: ['email', 'slack', 'sms', 'webhook']
  }
}
```

### Intrusion Detection

#### Rate Limiting

```typescript
// Advanced rate limiting
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: {
    login: 5,           // 5 login attempts
    api: 100,          // 100 API requests
    upload: 10,        // 10 file uploads
    search: 50,        // 50 search requests
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (request: NextRequest) => {
    // Log rate limit violation
    logger.warn('Rate limit exceeded', {
      ip: getClientIP(request),
      endpoint: request.nextUrl.pathname,
      method: request.method
    })

    // Trigger security alert
    securityMonitor.alert('rate_limit_exceeded', {
      ip: getClientIP(request),
      endpoint: request.nextUrl.pathname,
      user_agent: getUserAgent(request)
    })
  }
}
```

#### Bot Detection

```typescript
// Bot detection system
export class BotDetection {
  static detectBot(request: NextRequest): boolean {
    const userAgent = request.headers.get('user-agent') || ''
    const accept = request.headers.get('accept') || ''
    const acceptLanguage = request.headers.get('accept-language') || ''

    const botIndicators = [
      userAgent.toLowerCase().includes('bot'),
      userAgent.toLowerCase().includes('crawler'),
      userAgent.toLowerCase().includes('spider'),
      userAgent === '',
      accept === '',
      acceptLanguage === '',
      userAgent.length < 10,
    ]

    return botIndicators.some(indicator => indicator)
  }

  static handleBotDetection(request: NextRequest): void {
    logger.warn('Bot activity detected', {
      ip: getClientIP(request),
      user_agent: request.headers.get('user-agent'),
      accept: request.headers.get('accept'),
      accept_language: request.headers.get('accept-language'),
      endpoint: request.nextUrl.pathname
    })

    // Block bot requests
    throw new SecurityError('Bot activity detected')
  }
}
```

## Incident Response

### Security Incident Response Plan

#### Incident Classification

```typescript
// Incident severity levels
export const incidentSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const

// Incident types
export const incidentTypes = {
  AUTHENTICATION_BREACH: 'authentication_breach',
  DATA_BREACH: 'data_breach',
  DENIAL_OF_SERVICE: 'denial_of_service',
  MALWARE_INFECTION: 'malware_infection',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity'
} as const
```

#### Incident Response Procedures

```typescript
// Incident response workflow
export class IncidentResponse {
  static async handleIncident(
    type: IncidentType,
    severity: IncidentSeverity,
    details: Record<string, any>
  ): Promise<void> {
    // 1. Assess incident
    const assessment = await this.assessIncident(type, severity, details)

    // 2. Contain incident
    await this.containIncident(type, assessment)

    // 3. Eradicate threat
    await this.eradicateThreat(type, assessment)

    // 4. Recover systems
    await this.recoverSystems(type, assessment)

    // 5. Lessons learned
    await this.documentLessonsLearned(type, assessment)
  }

  static async assessIncident(
    type: IncidentType,
    severity: IncidentSeverity,
    details: Record<string, any>
  ): Promise<IncidentAssessment> {
    // Log incident
    logger.error('Security incident detected', {
      type,
      severity,
      details,
      timestamp: new Date().toISOString()
    })

    // Notify security team
    await notificationService.sendSecurityAlert({
      type,
      severity,
      details,
      priority: 'critical'
    })

    return {
      type,
      severity,
      impact: this.calculateImpact(type, severity),
      affectedSystems: this.identifyAffectedSystems(type, details),
      recommendedActions: this.getRecommendedActions(type, severity)
    }
  }
}
```

### Security Best Practices

#### Password Security

```typescript
// Password policy enforcement
export const passwordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventDictionaryWords: true,
  maxAgeDays: 90,
  historyRetention: 5
}

// Password strength validation
export function validatePasswordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= passwordPolicy.minLength,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    specialChars: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  }

  const score = Object.values(checks).filter(Boolean).length
  const strength = score >= 4 ? 'strong' : score >= 3 ? 'medium' : 'weak'

  return {
    score,
    strength,
    checks,
    valid: Object.values(checks).every(Boolean)
  }
}
```

#### Session Security

```typescript
// Secure session configuration
export const sessionConfig = {
  cookieName: 'session_token',
  cookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600, // 1 hour
    domain: 'yourdomain.com',
    path: '/'
  },
  refreshTokenOptions: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 604800, // 7 days
    domain: 'yourdomain.com',
    path: '/'
  },
  sessionTimeout: 3600, // 1 hour
  refreshTokenTimeout: 604800, // 7 days
  maxConcurrentSessions: 5
}
```

## Compliance and Auditing

### GDPR Compliance

#### Data Protection Measures

```typescript
// GDPR compliance utilities
export class GDPRCompliance {
  static async handleDataSubjectRequest(
    requestType: 'access' | 'rectification' | 'erasure' | 'portability',
    userId: string,
    details: Record<string, any>
  ): Promise<void> {
    switch (requestType) {
      case 'access':
        await this.handleDataAccessRequest(userId)
        break
      case 'rectification':
        await this.handleDataRectificationRequest(userId, details)
        break
      case 'erasure':
        await this.handleDataErasureRequest(userId)
        break
      case 'portability':
        await this.handleDataPortabilityRequest(userId)
        break
    }
  }

  static async handleDataAccessRequest(userId: string): Promise<void> {
    // Generate data access report
    const userData = await this.collectUserData(userId)
    const report = this.generateDataAccessReport(userData)

    // Send report to user
    await notificationService.sendGDPRReport(userId, report)
  }
}
```

### Security Auditing

#### Audit Trail

```typescript
// Comprehensive audit logging
export class SecurityAuditor {
  static async logSecurityEvent(
    eventType: SecurityEventType,
    userId: string | null,
    details: Record<string, any>
  ): Promise<void> {
    const auditEntry = {
      event_type: eventType,
      user_id: userId,
      timestamp: new Date().toISOString(),
      ip_address: getClientIP(),
      user_agent: getUserAgent(),
      session_id: getSessionId(),
      details,
      severity: this.getEventSeverity(eventType)
    }

    // Store in audit log
    await auditLogRepository.create(auditEntry)

    // Trigger alerts for critical events
    if (auditEntry.severity === 'critical') {
      await securityMonitor.alert('security_event', auditEntry)
    }
  }
}
```

## Security Testing

### Security Testing Checklist

#### Authentication Testing

- [ ] Test password strength requirements
- [ ] Verify MFA implementation
- [ ] Test session timeout behavior
- [ ] Validate token expiration
- [ ] Check concurrent session limits

#### Authorization Testing

- [ ] Test role-based access controls
- [ ] Verify permission inheritance
- [ ] Check resource-level permissions
- [ ] Test admin privilege escalation

#### Input Validation Testing

- [ ] Test XSS prevention
- [ ] Verify SQL injection protection
- [ ] Check file upload security
- [ ] Validate CSRF protection

#### Data Protection Testing

- [ ] Verify encryption at rest
- [ ] Test TLS/SSL configuration
- [ ] Check data backup security
- [ ] Validate access logging

### Penetration Testing

#### Automated Security Scanning

```bash
# Run security scans
npm run security:scan
npm run vulnerability:check
npm run dependency:audit

# Penetration testing
npm run pentest:api
npm run pentest:frontend
```

#### Manual Security Testing

```typescript
// Security testing utilities
export class SecurityTester {
  static async testXSSProtection(input: string): Promise<boolean> {
    const testPayloads = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src=x onerror=alert("xss")>',
      '<svg onload=alert("xss")>'
    ]

    for (const payload of testPayloads) {
      const sanitized = sanitizeHTML(input + payload)
      if (sanitized.includes(payload)) {
        return false // XSS protection failed
      }
    }

    return true // XSS protection working
  }

  static async testSQLInjection(input: string): Promise<boolean> {
    const testPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "1' AND (SELECT COUNT(*) FROM users) > 0 --"
    ]

    for (const payload of testPayloads) {
      const sanitized = sanitizeSQLInput(input + payload)
      if (sanitized.includes(payload)) {
        return false // SQL injection protection failed
      }
    }

    return true // SQL injection protection working
  }
}
```

## Security Maintenance

### Regular Security Tasks

#### Daily Security Checks

```bash
# Monitor security logs
tail -f /var/log/security.log | grep -E "(ERROR|CRITICAL|WARNING)"

# Check for failed login attempts
grep "authentication_failure" /var/log/security.log | wc -l

# Monitor system resources
df -h && free -h && uptime
```

#### Weekly Security Reviews

```bash
# Review user access logs
grep "user_access" /var/log/audit.log | head -20

# Check for suspicious IP addresses
grep "suspicious_activity" /var/log/security.log

# Review security alerts
cat /var/log/security_alerts.log
```

#### Monthly Security Audits

```bash
# Run comprehensive security audit
npm run security:audit

# Check dependency vulnerabilities
npm audit --audit-level high

# Review firewall rules
sudo ufw status verbose

# Test backup integrity
check_backup_integrity.sh
```

### Security Updates

#### Patch Management

```typescript
// Automated patch management
export class PatchManager {
  static async checkForUpdates(): Promise<UpdateInfo[]> {
    const updates = await this.fetchAvailableUpdates()
    const criticalUpdates = updates.filter(update => update.severity === 'critical')

    if (criticalUpdates.length > 0) {
      await this.applyCriticalPatches(criticalUpdates)
      await this.restartServices()
    }

    return updates
  }

  static async applyCriticalPatches(updates: UpdateInfo[]): Promise<void> {
    for (const update of updates) {
      try {
        await this.downloadPatch(update)
        await this.applyPatch(update)
        await this.testPatch(update)

        logger.info('Critical patch applied', {
          patch_id: update.id,
          severity: update.severity,
          applied_at: new Date().toISOString()
        })
      } catch (error) {
        logger.error('Failed to apply critical patch', {
          patch_id: update.id,
          error: error.message
        })
      }
    }
  }
}
```

This security guidelines document provides comprehensive information for maintaining the security posture of the PrismAI platform through best practices, monitoring, and incident response procedures.