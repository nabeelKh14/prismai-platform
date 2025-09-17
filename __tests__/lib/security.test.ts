import { sanitizeString, sanitizeEmail, securitySchemas, CSRFProtection } from '@/lib/security'

describe('Security Utilities', () => {
  describe('Input Sanitization', () => {
    it('should sanitize dangerous HTML characters', () => {
      const input = '<script>alert(\"xss\")</script>'
      const result = sanitizeString(input)
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    })

    it('should handle ampersands correctly', () => {
      const input = 'Company & Associates'
      const result = sanitizeString(input)
      expect(result).toBe('Company &amp; Associates')
    })

    it('should trim whitespace', () => {
      const input = '  test string  '
      const result = sanitizeString(input)
      expect(result).toBe('test string')
    })

    it('should sanitize email addresses', () => {
      const input = '  TEST@EXAMPLE.COM  '
      const result = sanitizeEmail(input)
      expect(result).toBe('test@example.com')
    })
  })

  describe('Security Schemas', () => {
    it('should validate correct email', () => {
      const result = securitySchemas.email.safeParse('user@example.com')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('user@example.com')
      }
    })

    it('should reject invalid email', () => {
      const result = securitySchemas.email.safeParse('invalid-email')
      expect(result.success).toBe(false)
    })

    it('should validate strong password', () => {
      const result = securitySchemas.password.safeParse('StrongPass123!')
      expect(result.success).toBe(true)
    })

    it('should reject weak password', () => {
      const result = securitySchemas.password.safeParse('weak')
      expect(result.success).toBe(false)
    })

    it('should validate phone number', () => {
      const result = securitySchemas.phoneNumber.safeParse('+1234567890')
      expect(result.success).toBe(true)
    })

    it('should reject invalid phone number', () => {
      const result = securitySchemas.phoneNumber.safeParse('not-a-phone')
      expect(result.success).toBe(false)
    })

    it('should validate business name', () => {
      const result = securitySchemas.businessName.safeParse('Acme Corp.')
      expect(result.success).toBe(true)
    })

    it('should reject business name with dangerous characters', () => {
      const result = securitySchemas.businessName.safeParse('<script>alert(\"xss\")</script>')
      expect(result.success).toBe(false)
    })

    it('should validate UUID', () => {
      const result = securitySchemas.uuid.safeParse('550e8400-e29b-41d4-a716-446655440000')
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const result = securitySchemas.uuid.safeParse('not-a-uuid')
      expect(result.success).toBe(false)
    })
  })

  describe('CSRF Protection', () => {
    const sessionId = 'test-session-123'

    it('should generate and validate CSRF token', () => {
      const token = CSRFProtection.generateToken(sessionId)
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)

      const isValid = CSRFProtection.validateToken(token, sessionId)
      expect(isValid).toBe(true)
    })

    it('should reject token with wrong session ID', () => {
      const token = CSRFProtection.generateToken(sessionId)
      const isValid = CSRFProtection.validateToken(token, 'wrong-session')
      expect(isValid).toBe(false)
    })

    it('should reject malformed token', () => {
      const isValid = CSRFProtection.validateToken('invalid-token', sessionId)
      expect(isValid).toBe(false)
    })

    it('should reject expired token', () => {
      const token = CSRFProtection.generateToken(sessionId)
      // Validate with very short max age
      const isValid = CSRFProtection.validateToken(token, sessionId, 0)
      expect(isValid).toBe(false)
    })
  })
})