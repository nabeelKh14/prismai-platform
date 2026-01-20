# PrismAI Configuration Manual

## Overview

This manual provides comprehensive configuration guidance for the PrismAI Platform, covering environment variables, security settings, performance tuning, and operational configurations. Proper configuration is essential for security, performance, and maintainability.

## Environment Configuration

### Environment Variables Schema

PrismAI uses a comprehensive environment variable system with Zod schema validation for type safety and validation.

#### Public Environment Variables (Client-side)

```bash
# Core Application Settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Analytics and Monitoring
VERCEL_ANALYTICS_ID=your_vercel_analytics_id
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project

# Logging Configuration
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=false
```

#### Server Environment Variables (Private)

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_CONNECTION_LIMIT=20

# AI Services Configuration
GEMINI_API_KEY=your_gemini_api_key
VAPI_API_KEY=your_vapi_api_key

# Email Configuration
RESEND_API_KEY=your_resend_api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Security and Encryption
JWT_SECRET=your_jwt_secret_key_32_chars_minimum
ENCRYPTION_KEY=your_encryption_key_32_chars_minimum
WEBHOOK_SECRET=your_webhook_secret

# Caching and Performance
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token
REDIS_URL=redis://localhost:6379
HEALTH_CHECK_TOKEN=your_health_check_token
```

### Environment Variable Validation

```typescript
// Public environment variables schema
const publicEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  VERCEL_ANALYTICS_ID: z.string().optional(),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(false)
})

// Server environment variables schema
const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  VAPI_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  WEBHOOK_SECRET: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  REDIS_URL: z.string().url().optional().or(z.literal('')),
  DATABASE_CONNECTION_LIMIT: z.coerce.number().default(20),
  HEALTH_CHECK_TOKEN: z.string().optional()
})
```

### Configuration Functions

```typescript
// Environment variable helper functions
export function getPublicEnv(): z.infer<typeof publicEnvSchema>
export function getServerEnv(): z.infer<typeof serverEnvSchema>
export function requireEnv(key: string): string
export function getOptionalEnv(key: string): string | undefined
export function isDevelopment(): boolean
export function isProduction(): boolean
```

## AI Services Configuration

### Google Gemini AI

```bash
# Google Gemini Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Optional AI model configurations
GEMINI_MODEL_DEFAULT=gemini-1.5-flash
GEMINI_MODEL_PRO=gemini-1.5-pro
GEMINI_EMBEDDING_MODEL=text-embedding-004
GEMINI_MAX_TOKENS=4000
GEMINI_TEMPERATURE=0.7
```

### VAPI Voice AI

```bash
# VAPI Configuration
VAPI_API_KEY=your_vapi_api_key
VAPI_WEBHOOK_URL=https://yourdomain.com/api/webhooks/vapi

# Voice configuration
VAPI_VOICE_ID=your_voice_id
VAPI_MODEL=your_vapi_model
```

### ElevenLabs TTS

```bash
# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id
ELEVENLABS_MODEL=eleven_monolingual_v1
```

## Database Configuration

### Supabase Configuration

```bash
# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database Connection Limits
DATABASE_CONNECTION_LIMIT=20

# Optional direct database URL
DATABASE_URL=postgresql://username:password@host:port/database
```

### Database Extensions

```sql
-- Required extensions for PrismAI
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;  -- For vector search
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";  -- For query optimization
CREATE EXTENSION IF NOT EXISTS "pg_buffercache";  -- For buffer cache management
```

### Connection Pooling Configuration

```bash
# Connection pooling settings
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=300
DB_POOL_CONNECTION_TIMEOUT=30
DB_QUERY_TIMEOUT=30000
```

## Caching Configuration

### Redis Configuration

```bash
# Primary Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Fallback Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
REDIS_KEY_PREFIX=prismai:
```

### Cache TTL Settings

```typescript
export const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 3600,    // 1 hour
  LONG: 86400,     // 24 hours
  SESSION: 3600,   // 1 hour
  AI_RESPONSE: 1800, // 30 minutes
  ANALYTICS: 900,  // 15 minutes
} as const
```

## Security Configuration

### Authentication & JWT

```bash
# JWT Configuration
JWT_SECRET=your_jwt_secret_key_32_chars_minimum
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Session Configuration
SESSION_COOKIE_NAME=session_token
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=strict
SESSION_MAX_AGE=3600
SESSION_REFRESH_MAX_AGE=604800
```

### Encryption

```bash
# Encryption Configuration
ENCRYPTION_KEY=your_encryption_key_32_chars_minimum
ENCRYPTION_ALGORITHM=aes-256-gcm

# File encryption
FILE_ENCRYPTION_ENABLED=true
FILE_ENCRYPTION_KEY=your_file_encryption_key
```

### Webhook Security

```bash
# Webhook Configuration
WEBHOOK_SECRET=your_webhook_secret
WEBHOOK_SIGNING_ENABLED=true
WEBHOOK_TIMEOUT=10000
```

### Rate Limiting Configuration

```bash
# Rate Limiting Settings
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false
RATE_LIMIT_SKIP_FAILED_REQUESTS=false

# Tier-based rate limiting
RATE_LIMIT_FREE_TIER=100
RATE_LIMIT_PRO_TIER=1000
RATE_LIMIT_ENTERPRISE_TIER=10000
```

## Communication Services

### Twilio Configuration

```bash
# Twilio SMS
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=your_messaging_service_sid

# WhatsApp via Twilio
WHATSAPP_ENABLED=true
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_whatsapp_verify_token
WHATSAPP_WEBHOOK_URL=https://yourdomain.com/api/webhooks/whatsapp
```

### Email Configuration

```bash
# Resend API
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# SMTP Fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Email templates
EMAIL_FROM=noreply@yourdomain.com
EMAIL_REPLY_TO=support@yourdomain.com
```

## File Upload Configuration

```bash
# File Upload Settings
UPLOAD_PATH=/app/uploads
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/csv,application/json
UPLOAD_ENABLED=true

# Supabase Storage
SUPABASE_STORAGE_BUCKET=prismai-uploads
SUPABASE_STORAGE_REGION=us-east-1

# Image Optimization
IMAGE_QUALITY=80
IMAGE_MAX_WIDTH=1920
IMAGE_MAX_HEIGHT=1080
IMAGE_FORMATS=webp,avif,jpeg
```

## Monitoring & Health Checks

```bash
# Health Check Configuration
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PATH=/api/health
HEALTH_CHECK_TIMEOUT=10000
HEALTH_CHECK_TOKEN=your_health_check_token

# Metrics
METRICS_ENABLED=true
METRICS_PATH=/api/metrics
METRICS_COLLECTION_INTERVAL=60000

# Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=false
```

## Configuration Files

### Next.js Configuration

```typescript
// next.config.mjs
const nextConfig = {
  // Build configuration
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  server: {
    port: 3001,
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    return config;
  },
}
```

### Middleware Configuration

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Security headers
  const response = NextResponse.next()
  
  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rateLimit = checkRateLimit(request)
    if (rateLimit.exceeded) {
      return new NextResponse('Rate limit exceeded', { status: 429 })
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

## Performance Configuration

### Memory Optimization

```bash
# Node.js Memory Settings
NODE_OPTIONS="--max-old-space-size=4096"
NODE_OPTIONS="$NODE_OPTIONS --expose-gc --max-semi-space-size=64"

# CPU Settings
UV_THREADPOOL_SIZE=64
```

### Connection Pooling

```bash
# Database connection pooling
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=300
DB_POOL_CONNECTION_TIMEOUT=30

# Redis connection pooling
REDIS_POOL_SIZE=20
REDIS_POOL_MIN=2
```

### CDN Configuration

```bash
# Static asset optimization
CDN_ENABLED=true
CDN_URL=https://cdn.yourdomain.com
ASSET_PREFIX=https://cdn.yourdomain.com
```

## Multi-Tenant Configuration

```bash
# Multi-tenant settings
MULTI_TENANT_ENABLED=true
TENANT_ISOLATION_STRICT=true
TENANT_DATA_SHARING=false

# Tenant-specific configurations
TENANT_DEFAULT_LIMITS=1000
TENANT_ENTERPRISE_LIMITS=10000
```

## Feature Flags

```bash
# Feature toggles
FEATURE_AI_CHAT_ENABLED=true
FEATURE_VOICE_AI_ENABLED=true
FEATURE_FILE_UPLOAD_ENABLED=true
FEATURE_SURVEYS_ENABLED=true
FEATURE_QUALITY_SCORING_ENABLED=true
FEATURE_LEAD_ROUTING_ENABLED=true
FEATURE_ANALYTICS_EXPORT=true

# Beta features
BETA_VISUAL_WORKFLOW_BUILDER=false
BETA_ADVANCED_AI_INSIGHTS=false
BETA_ENTERPRISE_INTEGRATIONS=false
```

## Environment-Specific Configuration

### Development Environment

```bash
# Development Settings
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true

# Development Database
SUPABASE_URL=http://localhost:54321
DATABASE_URL=postgresql://postgres:password@localhost:54322/postgres

# Development AI Services (use test keys)
GEMINI_API_KEY=your_dev_gemini_key
VAPI_API_KEY=your_dev_vapi_key
ELEVENLABS_API_KEY=your_dev_elevenlabs_key

# Rate limits (more permissive for development)
RATE_LIMIT_MAX_REQUESTS=1000
```

### Staging Environment

```bash
# Staging Settings
NODE_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.yourdomain.com
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true

# Staging Database
SUPABASE_URL=https://your-staging-project.supabase.co
DATABASE_URL=postgresql://staging-db.yourdomain.com:5432/prismai_staging

# Staging AI Services (limited quotas)
GEMINI_API_KEY=your_staging_gemini_key
RATE_LIMIT_MAX_REQUESTS=500
```

### Production Environment

```bash
# Production Settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
LOG_LEVEL=warn
ENABLE_REQUEST_LOGGING=false

# Production Database
SUPABASE_URL=https://your-prod-project.supabase.co
DATABASE_URL=postgresql://prod-db.yourdomain.com:5432/prismai

# Production AI Services
GEMINI_API_KEY=your_prod_gemini_key
VAPI_API_KEY=your_prod_vapi_key
ELEVENLABS_API_KEY=your_prod_elevenlabs_key

# Production rate limits
RATE_LIMIT_MAX_REQUESTS=100
```

## Configuration Validation

### Environment Validation

```typescript
// Environment validation function
export function validateEnvironment(): void {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'VAPI_API_KEY',
  ]
  
  const missing = requiredEnvVars.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  
  // Validate URL formats
  const urlVars = ['SUPABASE_URL', 'NEXT_PUBLIC_APP_URL']
  urlVars.forEach(key => {
    if (process.env[key] && !isValidUrl(process.env[key]!)) {
      throw new Error(`Invalid URL format for ${key}: ${process.env[key]}`)
    }
  })
}
```

### Configuration Testing

```bash
# Test configuration
npm run test:config

# Validate environment
node -e "require('./lib/env.ts'); console.log('Environment validation passed')"

# Check database connectivity
npm run db:health

# Test external services
npm run services:health

# Validate security settings
npm run security:audit
```

## Security Best Practices

### Secret Management

1. **Use environment variables for all secrets**
2. **Never commit secrets to version control**
3. **Use strong, unique secrets for each environment**
4. **Rotate secrets regularly**
5. **Use a secrets management service in production**

### Environment Variable Security

```bash
# .env file should be 600 permissions
chmod 600 .env

# .env should be in .gitignore
echo ".env" >> .gitignore

# Use different secrets for each environment
NODE_ENV=production
JWT_SECRET_PROD=production_jwt_secret
JWT_SECRET_STAGING=staging_jwt_secret
```

## Troubleshooting Configuration

### Common Issues

#### Environment Variables Not Loading

```bash
# Check if .env.local exists
ls -la .env.local

# Check file permissions
chmod 600 .env.local

# Validate syntax
node -e "require('dotenv').config(); console.log('Environment loaded successfully')"
```

#### Database Connection Issues

```bash
# Test Supabase connection
curl -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$SUPABASE_URL/rest/v1/"

# Test direct database connection
psql "$DATABASE_URL" -c "SELECT 1;"
```

#### API Keys Validation

```bash
# Test Gemini API key
curl -H "Content-Type: application/json" \
     -H "x-goog-api-key: $GEMINI_API_KEY" \
     "https://generativelanguage.googleapis.com/v1/models"

# Test VAPI API key
curl -H "Authorization: Bearer $VAPI_API_KEY" \
     "https://api.vapi.ai/speech-model"
```

### Debug Configuration

```bash
# Enable debug logging
DEBUG=prismai:* npm start

# Show configuration (sanitized)
npm run config:safe-display

# Test all external services
npm run services:test-all
```

This configuration manual provides comprehensive guidance for setting up and maintaining the PrismAI Platform across different environments with best practices for security, performance, and reliability.