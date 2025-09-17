# PrismAI Production Deployment Guide

## Prerequisites

### Required Accounts & Services
1. **Vercel Account** (recommended) or **Netlify/Railway**
2. **Supabase Project** for database and authentication
3. **Google Gemini API Account** for AI processing
4. **VAPI Account** for voice integration
5. **Domain name** (optional but recommended)

### Required Environment Variables

Create these in your deployment platform:

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_APP_NAME=PrismAI
NEXT_PUBLIC_APP_DESCRIPTION="Intelligent Business Automation Platform"

# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Services (Required)
GEMINI_API_KEY=your_gemini_api_key
VAPI_API_KEY=your_vapi_api_key

# Security
JWT_SECRET=your_jwt_secret_minimum_32_characters
ENCRYPTION_KEY=your_encryption_key_32_characters
WEBHOOK_SECRET=your_webhook_secret
CSRF_SECRET=your_csrf_secret

# Optional: Monitoring & Analytics
VERCEL_ANALYTICS_ID=your_vercel_analytics_id
SENTRY_DSN=your_sentry_dsn

# Optional: Email Service
RESEND_API_KEY=your_resend_api_key
# OR SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

# Optional: Caching (Recommended for production)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
# OR
REDIS_URL=your_redis_url

# Optional: Monitoring
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
HEALTH_CHECK_TOKEN=your_health_check_token
```

## Deployment Steps

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Run the database migration:
   ```sql
   -- Copy and run the contents of scripts/001_create_database_schema.sql
   ```
3. Enable Row Level Security
4. Configure authentication providers (email/password)
5. Set up database backups

### 2. Vercel Deployment (Recommended)

1. **Connect Repository**
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```

2. **Configure Environment Variables**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Add all required environment variables listed above
   - Make sure to set different values for Preview/Production

3. **Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm ci`
   - Node.js Version: `18.x`

4. **Custom Domain** (Optional)
   - Add your domain in Vercel Dashboard
   - Configure DNS records
   - SSL will be automatically configured

### 3. Alternative Deployments

#### Netlify
```bash
# Build settings
Build command: npm run build && npm run export
Publish directory: out
```

#### Railway
```bash
# Create railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health"
  }
}
```

#### Docker Deployment
```dockerfile
# Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
```

## Post-Deployment Setup

### 1. Health Check
Verify your deployment:
```bash
curl https://yourdomain.com/api/health?token=your_health_check_token
```

### 2. Configure Webhooks
Set up webhooks for VAPI:
- VAPI Dashboard → Webhooks
- Add: `https://yourdomain.com/api/webhooks/vapi`

### 3. DNS Configuration
If using custom domain:
```
# DNS Records
A    @    76.76.19.19
A    www  76.76.19.19
```

### 4. SSL Certificate
Most platforms handle SSL automatically. For custom setups:
- Use Let's Encrypt or Cloudflare
- Configure HTTPS redirects

## Monitoring & Maintenance

### 1. Set Up Monitoring

**Uptime Monitoring:**
```bash
# Add these to your monitoring service
GET https://yourdomain.com/api/health
Expected: 200 status
Interval: 5 minutes
```

**Error Tracking:**
- Configure Sentry for error tracking
- Set up alerts for critical errors

### 2. Backup Strategy

**Database Backups:**
- Supabase provides automatic backups
- Schedule additional backups if needed

**Environment Variables:**
- Keep secure backups of all environment variables
- Use secret management services

### 3. Performance Optimization

**CDN Configuration:**
```javascript
// next.config.mjs
const nextConfig = {
  images: {
    domains: ['your-cdn-domain.com'],
  },
  headers: async () => [
    {
      source: '/static/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],
}
```

**Database Optimization:**
- Monitor query performance
- Add indexes for frequently queried columns
- Implement connection pooling

## Security Checklist

- [ ] All environment variables secured
- [ ] HTTPS enabled and enforced
- [ ] Database access restricted to application
- [ ] API rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] Regular dependency updates
- [ ] Webhook signatures validated
- [ ] Database backups encrypted

## Scaling Considerations

### Horizontal Scaling
- Vercel automatically handles scaling
- For other platforms, configure auto-scaling

### Database Scaling
- Monitor Supabase usage
- Upgrade plan as needed
- Consider read replicas for high traffic

### Caching Strategy
- Implement Redis for session storage
- Use CDN for static assets
- Cache API responses where appropriate

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check environment variables
   # Verify all dependencies installed
   # Check TypeScript errors
   npm run typecheck
   ```

2. **Runtime Errors**
   ```bash
   # Check application logs
   vercel logs
   
   # Test health endpoint
   curl https://yourdomain.com/api/health
   ```

3. **Database Connection Issues**
   - Verify Supabase URL and keys
   - Check RLS policies
   - Monitor connection limits

4. **AI Service Issues**
   - Verify API keys
   - Check rate limits
   - Monitor service status

### Performance Issues

1. **Slow API Responses**
   - Check database query performance
   - Monitor external API latency
   - Implement caching

2. **High Memory Usage**
   - Monitor application metrics
   - Check for memory leaks
   - Optimize large operations

## Support & Resources

- **Documentation:** Check project README
- **Health Check:** `/api/health`
- **Logs:** Available in deployment platform
- **Monitoring:** Set up alerts for critical metrics
- **Support:** Contact support@prismai.com for assistance