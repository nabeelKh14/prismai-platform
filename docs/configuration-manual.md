# PrismAI Configuration Manual

## Overview

This manual provides comprehensive configuration guidance for the PrismAI platform, covering environment variables, security settings, performance tuning, and operational configurations. Proper configuration is essential for security, performance, and maintainability.

## Environment Configuration

### Environment Variables

#### Core Application Settings

```bash
# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
PORT=3000
HOSTNAME=0.0.0.0

# Build Configuration
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_BUILD_ID=production-build

# Performance Settings
NODE_OPTIONS="--max-old-space-size=4096"
GENERATE_SOURCEMAP=false
```

#### Database Configuration

```bash
# Supabase Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/prismai
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database Connection Pooling
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE=10000
DB_POOL_TIMEOUT=30000

# Database Performance
DB_QUERY_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=60000
```

#### Authentication Configuration

```bash
# JWT Configuration
NEXTAUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_URL=https://yourdomain.com
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Session Configuration
SESSION_COOKIE_NAME=session_token
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=strict
SESSION_MAX_AGE=3600
SESSION_REFRESH_MAX_AGE=604800

# MFA Configuration
MFA_ENABLED=true
MFA_ISSUER=PrismAI
MFA_TOTP_WINDOW=1
MFA_SMS_ENABLED=true
MFA_EMAIL_ENABLED=true
```

#### AI Services Configuration

```bash
# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
GEMINI_MAX_TOKENS=1000
GEMINI_TEMPERATURE=0.7
GEMINI_EMBEDDING_MODEL=text-embedding-004

# ElevenLabs TTS
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id
ELEVENLABS_MODEL=eleven_monolingual_v1

# VAPI Voice AI
VAPI_API_KEY=your_vapi_api_key
VAPI_MODEL=your_vapi_model
VAPI_VOICE_ID=your_voice_id
VAPI_WEBHOOK_URL=https://yourdomain.com/api/webhooks/vapi
```

#### Communication Services

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=your_messaging_service_sid

# WhatsApp Configuration
WHATSAPP_ENABLED=true
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_WEBHOOK_URL=https://yourdomain.com/api/webhooks/whatsapp

# SMS Configuration
SMS_ENABLED=true
SMS_FROM_NUMBER=+1234567890
SMS_MAX_LENGTH=160
```

#### Security Configuration

```bash
# CSRF Protection
CSRF_SECRET=your_csrf_secret_key
CSRF_TOKEN_EXPIRES_IN=3600
CSRF_COOKIE_NAME=csrf_token

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_ENABLED=true

# Security Headers
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
HSTS_ENABLED=true
HSTS_MAX_AGE=31536000

# Content Security Policy
CSP_DEFAULT_SRC=self
CSP_SCRIPT_SRC=self unsafe-inline
CSP_STYLE_SRC=self unsafe-inline
CSP_IMG_SRC=self data: https:
CSP_FONT_SRC=self data:
CSP_CONNECT_SRC=self https: wss:
```

#### Caching Configuration

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
REDIS_KEY_PREFIX=prismai:

# Cache TTL Settings
CACHE_TTL=3600
CACHE_SHORT_TTL=300
CACHE_LONG_TTL=86400
CACHE_SESSION_TTL=3600

# Cache Keys
CACHE_KEY_AGENTS=agents:list
CACHE_KEY_KNOWLEDGE_BASE=kb:search
CACHE_KEY_ANALYTICS=analytics:data
```

#### File Upload Configuration

```bash
# Upload Settings
UPLOAD_PATH=/app/uploads
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/csv,application/json
UPLOAD_ENABLED=true

# Image Optimization
IMAGE_QUALITY=80
IMAGE_MAX_WIDTH=1920
IMAGE_MAX_HEIGHT=1080
IMAGE_FORMATS=webp,avif,jpeg
```

#### Monitoring Configuration

```bash
# Health Check
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PATH=/api/v1/health
HEALTH_CHECK_TIMEOUT=10000

# Metrics
METRICS_ENABLED=true
METRICS_PATH=/api/v1/metrics
METRICS_COLLECTION_INTERVAL=60000

# Logging
LOG_LEVEL=info
LOG_PATH=/app/logs
LOG_MAX_SIZE=10485760
LOG_MAX_FILES=10
```

#### Email Configuration

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Email Templates
EMAIL_FROM=noreply@yourdomain.com
EMAIL_TEMPLATES_PATH=/app/templates/email
EMAIL_ENABLED=true
```

## Configuration Files

### Next.js Configuration

#### next.config.mjs

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output configuration
  output: 'standalone',

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'production'
              ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;"
              : "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;",
          },
        ],
      },
    ]
  },

  // Image optimization
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 60,
  },

  // Performance optimizations
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
      'recharts',
      'date-fns',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
    optimizeCss: true,
    scrollRestoration: true,
    swcMinify: true,
    esmExternals: true,
  },

  // Compression
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
}
```

### Middleware Configuration

#### middleware.ts

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withSecurityHeaders } from '@/lib/security'

export function middleware(request: NextRequest) {
  // Apply security headers to all routes
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
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### Security Configuration

#### lib/security.ts

The security configuration includes comprehensive protection mechanisms:

```typescript
// Input Validation Schemas
export const securitySchemas = {
  email: z.string()
    .email('Invalid email address')
    .min(3, 'Email too short')
    .max(254, 'Email too long')
    .transform(sanitizeEmail),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]/,
           'Password must contain uppercase, lowercase, number, and special character'),

  apiKey: z.string()
    .min(20, 'API key too short')
    .max(100, 'API key too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'API key contains invalid characters'),
}

// CSRF Protection
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
    // Token validation logic
  }
}
```

## Database Configuration

### Supabase Configuration

#### Database Schema Setup

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- Set up Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);
```

#### Connection Pooling

```bash
# Supabase Connection Pooling Settings
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=300
DB_POOL_CONNECTION_TIMEOUT=30
```

### Redis Configuration

#### Redis Setup

```bash
# Redis Configuration File (/etc/redis/redis.conf)
maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
```

#### Redis Security

```bash
# Redis Password Protection
requirepass your_redis_password

# Network Security
bind 127.0.0.1
protected-mode yes

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command SHUTDOWN SHUTDOWN_REDIS
```

## Performance Configuration

### Application Performance

#### Memory Optimization

```bash
# Node.js Memory Settings
NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size --memory-reducer"

# Garbage Collection
NODE_OPTIONS="$NODE_OPTIONS --expose-gc --max-semi-space-size=64"
```

#### CPU Optimization

```bash
# CPU Settings for production
NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=4096"
UV_THREADPOOL_SIZE=64
```

### Database Performance

#### Query Optimization

```sql
-- Create optimized indexes
CREATE INDEX CONCURRENTLY idx_conversations_user_status_updated
ON conversations(user_id, status, updated_at DESC);

CREATE INDEX CONCURRENTLY idx_knowledge_base_embedding
ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Partition large tables
CREATE TABLE conversations_y2024m01 PARTITION OF conversations
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### Connection Pooling

```bash
# PgBouncer Configuration
[databases]
prismai = host=localhost port=5432 dbname=prismai

[pgbouncer]
pool_mode = transaction
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
```

### Caching Configuration

#### Application Cache

```typescript
// Cache Configuration
export const cacheConfig = {
  ttl: {
    short: 300,      // 5 minutes
    medium: 3600,    // 1 hour
    long: 86400,     // 24 hours
    session: 3600,   // 1 hour
  },
  keys: {
    agents: 'agents:list',
    knowledgeBase: 'kb:search',
    analytics: 'analytics:data',
    user: 'user:profile',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
}
```

## Security Configuration

### SSL/TLS Configuration

#### Certificate Configuration

```bash
# Let's Encrypt Configuration
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
SSL_CHAIN_PATH=/etc/letsencrypt/live/yourdomain.com/chain.pem

# Custom Certificate
SSL_CERT_PATH=/etc/ssl/certs/yourdomain.com.crt
SSL_KEY_PATH=/etc/ssl/private/yourdomain.com.key
```

#### HSTS Configuration

```bash
# HTTP Strict Transport Security
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true
```

### Firewall Configuration

#### UFW Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow necessary ports
sudo ufw allow ssh
sudo ufw allow https
sudo ufw allow http

# Allow specific IPs for admin access
sudo ufw allow from 192.168.1.0/24 to any port 22

# Rate limiting
sudo ufw limit ssh
```

#### iptables Configuration

```bash
# Basic iptables rules
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set
iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Drop invalid packets
iptables -A INPUT -m state --state INVALID -j DROP
```

### API Security

#### Rate Limiting Configuration

```typescript
// Rate Limiting Rules
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
}
```

#### CORS Configuration

```typescript
// CORS Settings
export const corsConfig = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com', 'https://app.yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
}
```

## Monitoring Configuration

### Health Checks

#### Application Health

```typescript
// Health Check Configuration
export const healthCheckConfig = {
  path: '/api/v1/health',
  timeout: 10000,
  retries: 3,
  checks: {
    database: true,
    redis: true,
    aiServices: true,
    externalApis: true,
  },
}
```

#### Database Health

```sql
-- Database health check query
SELECT
  'database' as component,
  'healthy' as status,
  NOW() as timestamp;
```

### Metrics Collection

#### Prometheus Configuration

```yaml
# Prometheus scraping configuration
scrape_configs:
  - job_name: 'prismai'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 15s
    metrics_path: '/api/v1/metrics'
```

#### Grafana Dashboards

```json
{
  "dashboard": {
    "title": "PrismAI Performance",
    "panels": [
      {
        "title": "Active Conversations",
        "type": "stat",
        "targets": [
          {
            "expr": "prismai_active_conversations",
            "legendFormat": "Active"
          }
        ]
      },
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(prismai_api_response_time_seconds_sum[5m]) / rate(prismai_api_response_time_seconds_count[5m])",
            "legendFormat": "Average Response Time"
          }
        ]
      }
    ]
  }
}
```

## Logging Configuration

### Application Logging

#### Winston Configuration

```typescript
// Logging Configuration
export const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'prismai' },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
  ],
}
```

#### Log Rotation

```bash
# Logrotate Configuration
/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        systemctl reload prismai
    endscript
}
```

### Security Logging

#### Security Event Logging

```typescript
// Security Event Types
export const securityEvents = {
  AUTHENTICATION_FAILURE: 'auth_failure',
  AUTHORIZATION_FAILURE: 'auth_failure',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  CSRF_VIOLATION: 'csrf_violation',
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
  XSS_ATTEMPT: 'xss_attempt',
  INVALID_REQUEST: 'invalid_request',
}
```

## Backup Configuration

### Database Backup

#### Automated Backup Script

```bash
#!/bin/bash
# Database backup script

BACKUP_DIR="/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
supabase db dump --db-url "$DATABASE_URL" --file "$BACKUP_DIR/backup_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/backup_$DATE.sql"

# Clean old backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
```

#### Backup Schedule

```bash
# Crontab for automated backups
# Database backup every 6 hours
0 */6 * * * /app/scripts/backup_database.sh

# File backup daily at 2 AM
0 2 * * * /app/scripts/backup_files.sh

# Log rotation daily at 3 AM
0 3 * * * /app/scripts/rotate_logs.sh
```

### File System Backup

#### File Backup Configuration

```bash
# Backup directories
BACKUP_PATHS=(
  "/app/uploads"
  "/app/public"
  "/app/logs"
  "/etc/ssl/certs"
)

# Backup script
for path in "${BACKUP_PATHS[@]}"; do
  if [ -d "$path" ]; then
    tar -czf "/backups/files/$(basename $path)_$DATE.tar.gz" "$path"
  fi
done
```

## Environment-Specific Configuration

### Development Environment

```bash
# Development Settings
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEBUG=true
LOG_LEVEL=debug

# Development Database
DATABASE_URL=postgresql://localhost:5432/prismai_dev
SUPABASE_URL=http://localhost:54321

# Development AI Services
GEMINI_API_KEY=your_dev_gemini_key
ELEVENLABS_API_KEY=your_dev_elevenlabs_key
```

### Staging Environment

```bash
# Staging Settings
NODE_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.yourdomain.com
LOG_LEVEL=info

# Staging Database
DATABASE_URL=postgresql://staging-db.yourdomain.com:5432/prismai_staging

# Staging AI Services (limited quotas)
GEMINI_API_KEY=your_staging_gemini_key
RATE_LIMIT_MAX_REQUESTS=50
```

### Production Environment

```bash
# Production Settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
LOG_LEVEL=warn

# Production Database
DATABASE_URL=postgresql://prod-db.yourdomain.com:5432/prismai

# Production AI Services
GEMINI_API_KEY=your_prod_gemini_key
RATE_LIMIT_MAX_REQUESTS=100
```

## Configuration Validation

### Environment Validation

```typescript
// Environment validation
export function validateEnvironment(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXTAUTH_SECRET',
    'GEMINI_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
  ]

  const missing = requiredEnvVars.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Validate URL formats
  const urlVars = ['DATABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_APP_URL']
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
npm run validate:env

# Check database connectivity
npm run db:health

# Test external services
npm run services:health
```

## Troubleshooting Configuration

### Common Configuration Issues

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
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Verify credentials
psql $DATABASE_URL -c "SELECT current_user, current_database();"
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/ssl/certs/yourdomain.com.crt -text -noout

# Test SSL connection
curl -v https://yourdomain.com

# Check certificate chain
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### Configuration Debugging

#### Debug Mode

```bash
# Enable debug logging
DEBUG=prismai:* npm start

# Enable verbose output
VERBOSE=true npm start

# Show configuration (without secrets)
npm run config:debug
```

#### Performance Profiling

```bash
# Profile application startup
node --prof server.js

# Memory usage analysis
node --inspect server.js

# CPU profiling
clinic doctor -- node server.js
```

This configuration manual provides comprehensive guidance for setting up and maintaining the PrismAI platform across different environments with best practices for security, performance, and reliability.