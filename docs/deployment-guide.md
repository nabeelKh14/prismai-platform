# PrismAI Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the PrismAI platform in production environments. The platform supports multiple deployment strategies including Docker-based deployments, cloud platforms, and traditional server deployments.

## Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+, CentOS 8+, or similar)
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: Minimum 20GB SSD storage
- **Network**: Public internet access for external API calls

### Software Dependencies
- **Docker**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later
- **Git**: For version control
- **Nginx** (optional): For reverse proxy and SSL termination

## Quick Start Deployment

### Using Docker Compose (Recommended)

1. **Clone the Repository**
```bash
git clone https://github.com/prismai/prismai-platform.git
cd prismai-platform
```

2. **Environment Configuration**
```bash
# Copy environment template
cp deployment/environments/production.env .env.local

# Edit the environment file with your configuration
nano .env.local
```

3. **Deploy with Docker Compose**
```bash
# Start all services
docker-compose -f deployment/docker/docker-compose.production.yml up -d

# Check service status
docker-compose -f deployment/docker/docker-compose.production.yml ps
```

4. **Verify Deployment**
```bash
# Check application health
curl http://localhost:3000/api/v1/health

# Check logs
docker-compose -f deployment/docker/docker-compose.production.yml logs -f app
```

## Docker Deployment

### Production Dockerfile

The platform includes a multi-stage production Dockerfile optimized for security and performance:

```dockerfile
# Multi-stage build for optimal production image
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini \
    curl \
    wget \
    openssl \
    ca-certificates

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Production runtime image
FROM base AS runner

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Security: Remove unnecessary packages
RUN apk del curl wget && \
    rm -rf /tmp/* /var/cache/apk/*

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Start the application
CMD ["node", "server.js"]
```

### Key Security Features
- **Non-root User**: Application runs as non-privileged user
- **Minimal Attack Surface**: Only essential packages installed
- **Security Updates**: Regular security patching
- **Health Checks**: Built-in health monitoring

### Building Custom Images

```bash
# Build production image
docker build -f deployment/docker/Dockerfile -t prismai-app:latest .

# Run with custom configuration
docker run -d \
  --name prismai-app \
  -p 3000:3000 \
  -e DATABASE_URL="your_database_url" \
  -e NEXTAUTH_SECRET="your_secret" \
  --restart unless-stopped \
  prismai-app:latest
```

## Environment Configuration

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/prismai"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# Authentication
NEXTAUTH_SECRET="your_nextauth_secret"
NEXTAUTH_URL="https://yourdomain.com"

# AI Services
GEMINI_API_KEY="your_gemini_api_key"
ELEVENLABS_API_KEY="your_elevenlabs_api_key"
VAPI_API_KEY="your_vapi_api_key"

# Communication Services
TWILIO_ACCOUNT_SID="your_twilio_account_sid"
TWILIO_AUTH_TOKEN="your_twilio_auth_token"
TWILIO_PHONE_NUMBER="your_twilio_phone_number"

# Application Settings
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NODE_ENV="production"
PORT="3000"
```

### Environment Templates

The platform provides environment templates for different deployment scenarios:

```bash
# Production environment
cp deployment/environments/production.env .env.local

# Development environment
cp deployment/environments/development.env .env.local

# Staging environment
cp deployment/environments/staging.env .env.local
```

## Cloud Platform Deployment

### AWS Deployment

#### Using AWS ECS Fargate

1. **Create ECS Cluster**
```bash
aws ecs create-cluster --cluster-name prismai-cluster
```

2. **Create Task Definition**
```json
{
  "family": "prismai-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/prismaiTaskRole",
  "containerDefinitions": [
    {
      "name": "prismai-app",
      "image": "your-registry/prismai:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASE_URL",
          "value": "your_database_url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/prismai",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

3. **Deploy Service**
```bash
aws ecs create-service \
  --cluster prismai-cluster \
  --service-name prismai-service \
  --task-definition prismai-task \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
```

#### Using AWS App Runner

```bash
# Create App Runner service
aws apprunner create-service \
  --service-name prismai-service \
  --source-configuration "{
    \"ImageRepository\": {
      \"ImageIdentifier\": \"your-registry/prismai:latest\",
      \"ImageConfiguration\": {
        \"Port\": \"3000\",
        \"EnvironmentVariables\": [
          {
            \"NAME\": \"DATABASE_URL\",
            \"VALUE\": \"your_database_url\"
          }
        ]
      }
    }
  }" \
  --instance-configuration "{
    \"Cpu\": \"1024\",
    \"Memory\": \"2048\"
  }"
```

### Google Cloud Platform

#### Using Cloud Run

```bash
# Build and deploy to Cloud Run
gcloud builds submit --tag gcr.io/PROJECT-ID/prismai

gcloud run deploy --image gcr.io/PROJECT-ID/prismai \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="your_database_url",GEMINI_API_KEY="your_key"
```

#### Using GKE

```bash
# Create GKE cluster
gcloud container clusters create prismai-cluster \
  --num-nodes=3 \
  --machine-type=n1-standard-2 \
  --zone=us-central1-a

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### Azure Deployment

#### Using Azure Container Instances

```bash
# Create container group
az container create \
  --resource-group prismai-rg \
  --name prismai-container \
  --image your-registry/prismai:latest \
  --ports 3000 \
  --environment-variables DATABASE_URL="your_database_url" \
  --cpu 2 \
  --memory 4
```

#### Using Azure Kubernetes Service

```bash
# Create AKS cluster
az aks create \
  --resource-group prismai-rg \
  --name prismai-cluster \
  --node-count 3 \
  --enable-addons monitoring,ingress-appgw \
  --generate-ssh-keys

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## Reverse Proxy Configuration

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/prismai
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Proxy Settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static Assets Caching
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API Caching (disable)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_cache off;
    }
}
```

### Apache Configuration

```apache
# /etc/apache2/sites-available/prismai.conf
<VirtualHost *:80>
    ServerName yourdomain.com
    Redirect permanent / https://yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName yourdomain.com

    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/yourdomain.com.crt
    SSLCertificateKeyFile /etc/ssl/private/yourdomain.com.key

    # Security Headers
    Header always set X-Frame-Options DENY
    Header always set X-Content-Type-Options nosniff
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"

    # Proxy Configuration
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # WebSocket Support
    ProxyPass /ws ws://localhost:3000/ws
    ProxyPassReverse /ws ws://localhost:3000/ws
</VirtualHost>
```

## SSL/TLS Configuration

### Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (add to crontab)
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet
```

### Custom SSL Certificate

```bash
# Convert certificate to required format
openssl pkcs12 -export -out certificate.pfx -inkey private.key -in certificate.crt

# Configure in environment
SSL_CERT_PATH="/path/to/certificate.crt"
SSL_KEY_PATH="/path/to/private.key"
```

## Monitoring and Health Checks

### Health Check Endpoints

```bash
# Application health
curl https://yourdomain.com/api/v1/health

# Database connectivity
curl https://yourdomain.com/api/v1/health/database

# External services
curl https://yourdomain.com/api/v1/health/services
```

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "2.0.0",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "ai_services": "ok"
  }
}
```

### Monitoring Setup

#### Prometheus Metrics

```bash
# Install Prometheus
sudo apt install prometheus

# Configure scraping
scrape_configs:
  - job_name: 'prismai'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/v1/metrics'
```

#### Grafana Dashboards

1. **Import Dashboard**: Use community dashboards for Next.js and Node.js
2. **Custom Metrics**: Monitor AI service usage, chat volume, response times
3. **Alerting**: Configure alerts for system health and performance

## Scaling Configuration

### Horizontal Scaling

#### Docker Compose Scaling

```bash
# Scale application instances
docker-compose -f deployment/docker/docker-compose.production.yml up -d --scale app=3

# Scale with load balancer
docker-compose -f deployment/docker/docker-compose.production.yml up -d nginx
```

#### Kubernetes Scaling

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prismai-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: prismai
  template:
    metadata:
      labels:
        app: prismai
    spec:
      containers:
      - name: prismai
        image: your-registry/prismai:latest
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

### Auto-scaling Rules

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: prismai-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: prismai-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Backup and Recovery

### Database Backup

```bash
# Supabase backup
supabase db dump --db-url "your_database_url" --file backup.sql

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
supabase db dump --db-url "$DATABASE_URL" --file "/backups/backup_$DATE.sql"
```

### File System Backup

```bash
# Backup uploads and static files
tar -czf backups/files_$(date +%Y%m%d).tar.gz /app/uploads /app/public

# Restore files
tar -xzf backups/files_20240101.tar.gz -C /
```

### Recovery Procedures

1. **Database Recovery**
```bash
# Restore from backup
supabase db reset --db-url "$DATABASE_URL"
supabase db push --db-url "$DATABASE_URL" --file backup.sql
```

2. **Application Recovery**
```bash
# Redeploy application
docker-compose -f deployment/docker/docker-compose.production.yml down
docker-compose -f deployment/docker/docker-compose.production.yml up -d --build
```

## Troubleshooting

### Common Deployment Issues

#### Port Conflicts
```bash
# Check port usage
netstat -tlnp | grep :3000

# Kill conflicting process
sudo kill -9 <PID>
```

#### Memory Issues
```bash
# Check memory usage
docker stats

# Increase memory limits
docker update --memory 2g prismai-app
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in certificate.crt -text -noout

# Renew certificate
certbot renew
```

### Log Analysis

#### Application Logs
```bash
# Docker logs
docker-compose -f deployment/docker/docker-compose.production.yml logs -f app

# System logs
tail -f /var/log/syslog
```

#### Performance Monitoring
```bash
# CPU and memory usage
htop

# Disk usage
df -h

# Network connections
netstat -tlnp
```

## Security Hardening

### Firewall Configuration

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow ssh
sudo ufw allow https
sudo ufw allow http
sudo ufw enable

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

### File Permissions

```bash
# Set secure permissions
sudo chown -R nextjs:nodejs /app
sudo chmod -R 755 /app
sudo chmod -R 600 /app/.env.local

# Restrict sensitive directories
sudo chmod 700 /app/.env.local
sudo chmod 750 /app/uploads
```

### Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f deployment/docker/docker-compose.production.yml pull
docker-compose -f deployment/docker/docker-compose.production.yml up -d
```

## Performance Optimization

### Application Tuning

```bash
# Environment variables for performance
NODE_OPTIONS="--max-old-space-size=4096"
NEXT_TELEMETRY_DISABLED=1
```

### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX idx_conversations_status ON chat_conversations(status);
CREATE INDEX idx_conversations_updated_at ON chat_conversations(updated_at);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);
```

### Caching Configuration

```bash
# Redis configuration for production
redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru

# Application cache settings
CACHE_TTL=3600
REDIS_URL="redis://localhost:6379"
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Daily**: Monitor logs and performance metrics
2. **Weekly**: Review security logs and update packages
3. **Monthly**: Test backup and recovery procedures
4. **Quarterly**: Security audit and penetration testing

### Support Channels

- **Documentation**: [https://docs.prismai.com](https://docs.prismai.com)
- **Community**: [https://community.prismai.com](https://community.prismai.com)
- **Support**: support@prismai.com
- **Emergency**: emergency@prismai.com

### Emergency Procedures

1. **Service Outage**
```bash
# Quick restart
docker-compose -f deployment/docker/docker-compose.production.yml restart

# Emergency rollback
git checkout stable
docker-compose -f deployment/docker/docker-compose.production.yml up -d --build
```

2. **Security Incident**
```bash
# Isolate affected systems
docker-compose -f deployment/docker/docker-compose.production.yml down

# Preserve logs for investigation
docker logs prismai-app > incident_logs.txt

# Contact security team
```

This deployment guide provides comprehensive instructions for deploying PrismAI in production environments with best practices for security, performance, and maintainability.