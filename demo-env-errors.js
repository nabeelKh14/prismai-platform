#!/usr/bin/env node

/**
 * Demo script to manually trigger and demonstrate env validation errors
 * Shows actual error output with sensitive variables redacted
 */

// Simplified version of the validation logic for demo purposes
const SENSITIVE_VARS = new Set([
  'GEMINI_API_KEY',
  'VAPI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'WEBHOOK_SECRET',
  'UPSTASH_REDIS_REST_TOKEN',
  'SMTP_PASS',
  'RESEND_API_KEY',
])

function sanitizeErrorMessage(message) {
  let sanitized = message
  SENSITIVE_VARS.forEach(sensitiveVar => {
    const regex = new RegExp(`\\b${sensitiveVar}\\b`, 'g')
    sanitized = sanitized.replace(regex, '[REDACTED]')
  })
  return sanitized
}

function validateEnvSafe(env) {
  const errors = []

  // Check required variables
  const required = [
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'VAPI_API_KEY'
  ]

  const missing = required.filter(key => !env[key] || env[key] === '')
  if (missing.length > 0) {
    errors.push(`Missing: ${missing.join(', ')}`)
  }

  // Check URL format
  if (env.NEXT_PUBLIC_APP_URL && !env.NEXT_PUBLIC_APP_URL.match(/^https?:\/\/.+/)) {
    errors.push(`Invalid: NEXT_PUBLIC_APP_URL: Invalid url`)
  }

  if (errors.length > 0) {
    const errorMessage = `Environment validation failed: ${errors.join(' ')} Please check your .env file`
    return { success: false, error: sanitizeErrorMessage(errorMessage) }
  }

  return { success: true, data: env }
}

console.log('🚀 Environment Validation Error Demonstration\n')

// Test 1: Missing all required variables
console.log('Test 1: Missing all required environment variables')
const env1 = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000'
}
const result1 = validateEnvSafe(env1)
if (!result1.success) {
  console.log('❌ Error:', result1.error)
} else {
  console.log('✅ Validation passed (unexpected)')
}
console.log()

// Test 2: Invalid URL format
console.log('Test 2: Invalid URL format for NEXT_PUBLIC_APP_URL')
const env2 = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_APP_URL: 'not-a-valid-url',
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  GEMINI_API_KEY: 'test-gemini-key',
  VAPI_API_KEY: 'test-vapi-key'
}
const result2 = validateEnvSafe(env2)
if (!result2.success) {
  console.log('❌ Error:', result2.error)
} else {
  console.log('✅ Validation passed (unexpected)')
}
console.log()

// Test 3: Empty required string
console.log('Test 3: Empty GEMINI_API_KEY (required)')
const env3 = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  GEMINI_API_KEY: '',
  VAPI_API_KEY: 'test-vapi-key'
}
const result3 = validateEnvSafe(env3)
if (!result3.success) {
  console.log('❌ Error:', result3.error)
} else {
  console.log('✅ Validation passed (unexpected)')
}
console.log()

// Test 4: Valid configuration (should pass)
console.log('Test 4: Valid configuration (should pass)')
const env4 = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
  GEMINI_API_KEY: 'test-gemini-key',
  VAPI_API_KEY: 'test-vapi-key'
}
const result4 = validateEnvSafe(env4)
if (result4.success) {
  console.log('✅ Validation passed as expected')
} else {
  console.log('❌ Unexpected error:', result4.error)
}

console.log('\n✨ Demo completed')