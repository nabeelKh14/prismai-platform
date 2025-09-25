# PrismAI Troubleshooting Manual

## Overview

This comprehensive troubleshooting manual provides solutions for common issues, error codes, debugging procedures, and recovery strategies for the PrismAI platform. Use this guide to diagnose and resolve problems across all system components.

## Quick Reference

### Emergency Contacts

- **Technical Support**: support@prismai.com
- **Emergency Support**: emergency@prismai.com
- **Status Page**: https://status.prismai.com
- **Community Forum**: https://community.prismai.com

### Common Status Codes

| Code | Description | Action |
|------|-------------|---------|
| 200 | Success | Normal operation |
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Check authentication |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Check resource existence |
| 429 | Rate Limited | Reduce request frequency |
| 500 | Internal Error | Check server logs |
| 502 | Bad Gateway | Check upstream services |
| 503 | Service Unavailable | Check service health |

## System Troubleshooting

### Application Startup Issues

#### Next.js Application Won't Start

**Symptoms:**
- Application fails to start
- Port already in use errors
- Environment variable issues

**Diagnosis:**
```bash
# Check if port is in use
netstat -tlnp | grep :3000

# Check environment variables
node -e "require('dotenv').config(); console.log('Environment loaded successfully')"

# Check Node.js version
node --version
npm --version
```

**Solutions:**

1. **Port Conflict:**
```bash
# Kill process using port 3000
sudo kill -9 $(lsof -ti:3000)

# Or use different port
PORT=3001 npm run dev
```

2. **Environment Variables:**
```bash
# Check .env.local file
ls -la .env.local

# Validate environment variables
npm run validate:env

# Create missing .env.local
cp .env.example .env.local
```

3. **Dependencies:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next
npm run build
```

#### Database Connection Issues

**Symptoms:**
- Database connection errors
- Supabase connection failures
- Query timeout errors

**Diagnosis:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Supabase status
curl https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/status

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

**Solutions:**

1. **Connection String Issues:**
```bash
# Validate DATABASE_URL format
echo $DATABASE_URL

# Test with proper format
DATABASE_URL="postgresql://user:pass@host:5432/db" npm run dev
```

2. **Supabase Configuration:**
```bash
# Check Supabase credentials
echo "URL: $SUPABASE_URL"
echo "Key: ${SUPABASE_ANON_KEY:0:20}..."

# Test Supabase connection
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"
```

3. **Connection Pooling:**
```bash
# Check connection pool settings
psql $DATABASE_URL -c "SHOW max_connections;"

# Optimize connection pool
# Edit database configuration
```

### Authentication Issues

#### Login Problems

**Symptoms:**
- Login requests failing
- Invalid credentials errors
- Session timeout issues

**Diagnosis:**
```bash
# Check authentication logs
tail -f /var/log/auth.log | grep -i "login\|auth"

# Test authentication endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

**Solutions:**

1. **Invalid Credentials:**
```bash
# Reset user password
supabase auth admin create-user --email user@example.com

# Check user table
psql $DATABASE_URL -c "SELECT id, email, created_at FROM auth.users;"
```

2. **JWT Token Issues:**
```bash
# Check JWT secret
echo $NEXTAUTH_SECRET

# Generate new JWT secret
openssl rand -base64 32

# Clear existing sessions
psql $DATABASE_URL -c "DELETE FROM sessions WHERE expires < NOW();"
```

3. **MFA Problems:**
```bash
# Disable MFA for user
psql $DATABASE_URL -c "UPDATE auth.users SET mfa_enabled = false WHERE email = 'user@example.com';"

# Reset MFA secret
psql $DATABASE_URL -c "UPDATE auth.users SET mfa_secret = NULL WHERE email = 'user@example.com';"
```

#### Session Management Issues

**Symptoms:**
- Users being logged out frequently
- Session not persisting
- Multiple login prompts

**Solutions:**

1. **Cookie Configuration:**
```bash
# Check cookie settings in browser
# Ensure secure, httpOnly, sameSite settings

# Update session configuration
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=strict
```

2. **Session Timeout:**
```bash
# Check session timeout settings
echo $SESSION_MAX_AGE

# Adjust session timeout
SESSION_MAX_AGE=3600  # 1 hour
```

### API Issues

#### Rate Limiting Problems

**Symptoms:**
- 429 Too Many Requests errors
- API calls being blocked
- Performance degradation

**Diagnosis:**
```bash
# Check rate limit logs
tail -f /var/log/rate-limit.log

# Test rate limits
for i in {1..10}; do
  curl -w "%{http_code} " http://localhost:3000/api/test
done
```

**Solutions:**

1. **Adjust Rate Limits:**
```bash
# Update rate limit configuration
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # 100 requests per window
```

2. **Implement Exponential Backoff:**
```javascript
// Client-side rate limit handling
async function makeRequest(url, options = {}) {
  let delay = 1000; // Start with 1 second

  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status !== 429) {
        return response;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    } catch (error) {
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}
```

#### API Response Delays

**Symptoms:**
- Slow API responses
- Timeout errors
- High response times

**Diagnosis:**
```bash
# Test API response times
time curl http://localhost:3000/api/test

# Check database query performance
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM conversations LIMIT 10;"

# Monitor system resources
htop
```

**Solutions:**

1. **Database Query Optimization:**
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_conversations_user_updated
ON conversations(user_id, updated_at DESC);

-- Optimize slow queries
EXPLAIN ANALYZE SELECT * FROM conversations
WHERE user_id = $1
ORDER BY updated_at DESC
LIMIT 50;
```

2. **Caching Implementation:**
```javascript
// Implement response caching
const cache = new Map();

async function getCachedData(key, fetcher, ttl = 300) {
  if (cache.has(key)) {
    const { data, expiry } = cache.get(key);
    if (Date.now() < expiry) {
      return data;
    }
    cache.delete(key);
  }

  const data = await fetcher();
  cache.set(key, {
    data,
    expiry: Date.now() + (ttl * 1000)
  });

  return data;
}
```

### Database Issues

#### Connection Pool Exhaustion

**Symptoms:**
- Database connection errors
- Slow query performance
- Application timeouts

**Diagnosis:**
```bash
# Check active connections
psql $DATABASE_URL -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"

# Check connection pool settings
psql $DATABASE_URL -c "SHOW max_connections;"

# Monitor connection usage
psql $DATABASE_URL -c "SELECT * FROM pg_stat_database WHERE datname = current_database();"
```

**Solutions:**

1. **Increase Connection Pool:**
```bash
# Update PostgreSQL configuration
max_connections = 200

# Update application connection pool
DB_POOL_MIN=5
DB_POOL_MAX=50
DB_POOL_IDLE=10000
```

2. **Connection Pool Monitoring:**
```javascript
// Monitor connection pool usage
const monitorConnectionPool = () => {
  setInterval(async () => {
    const pool = getConnectionPool();
    const stats = pool.getStats();

    if (stats.waiting > 10) {
      logger.warn('High connection pool waiting', stats);
    }
  }, 30000);
};
```

#### Slow Query Performance

**Symptoms:**
- High query execution times
- Database timeouts
- Poor application performance

**Diagnosis:**
```bash
# Identify slow queries
psql $DATABASE_URL -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check query plans
psql $DATABASE_URL -c "EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM conversations WHERE user_id = 'user123' ORDER BY created_at DESC LIMIT 50;"

# Check table statistics
psql $DATABASE_URL -c "ANALYZE conversations;"
```

**Solutions:**

1. **Add Missing Indexes:**
```sql
-- Add composite index for common query pattern
CREATE INDEX CONCURRENTLY idx_conversations_user_status_created
ON conversations(user_id, status, created_at DESC);

-- Add partial index for active conversations
CREATE INDEX CONCURRENTLY idx_conversations_active
ON conversations(user_id, updated_at DESC)
WHERE status IN ('active', 'waiting', 'assigned');
```

2. **Query Optimization:**
```sql
-- Optimize query with better filtering
SELECT c.id, c.status, c.created_at, c.updated_at
FROM conversations c
WHERE c.user_id = $1
  AND c.status IN ('active', 'waiting', 'assigned')
ORDER BY c.updated_at DESC
LIMIT 50;

-- Use pagination instead of large LIMITs
SELECT * FROM conversations
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50 OFFSET $2;
```

### AI Services Issues

#### Gemini API Problems

**Symptoms:**
- AI responses failing
- High API error rates
- Slow AI processing

**Diagnosis:**
```bash
# Test Gemini API directly
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -d '{
    "contents": [{
      "parts": [{"text": "Hello"}]
    }]
  }'

# Check API quota
curl -H "x-goog-api-key: $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/projects/$GOOGLE_PROJECT/models/gemini-1.5-flash
```

**Solutions:**

1. **API Key Issues:**
```bash
# Validate API key format
echo $GEMINI_API_KEY | wc -c  # Should be > 20 characters

# Check API key permissions
# Go to Google Cloud Console > APIs & Services > Credentials
```

2. **Rate Limiting:**
```javascript
// Implement retry with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};
```

#### Embedding Generation Issues

**Symptoms:**
- Knowledge base search failing
- Vector search not working
- Embedding API errors

**Solutions:**

1. **Text Preprocessing:**
```javascript
// Clean text before embedding
const cleanText = (text) => {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[^\w\s]/g, ' ')  // Remove special characters
    .trim()
    .substring(0, 10000);  // Limit length
};
```

2. **Batch Processing:**
```javascript
// Process embeddings in batches
const generateEmbeddingsBatch = async (texts) => {
  const batchSize = 10;
  const results = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await generateEmbeddings(batch);
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
};
```

### Communication Channel Issues

#### Twilio SMS Problems

**Symptoms:**
- SMS messages not sending
- Delivery failures
- Invalid phone number errors

**Diagnosis:**
```bash
# Test Twilio credentials
curl -X GET https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json \
  -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN

# Check phone number format
echo $TWILIO_PHONE_NUMBER

# Test SMS sending
curl -X POST https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json \
  -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN \
  -d "From=$TWILIO_PHONE_NUMBER" \
  -d "To=+1234567890" \
  -d "Body=Test message"
```

**Solutions:**

1. **Phone Number Format:**
```javascript
// Validate and format phone numbers
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }

  return cleaned;
};
```

2. **Error Handling:**
```javascript
// Handle Twilio errors gracefully
const sendSMSWithRetry = async (to, message, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      return result;
    } catch (error) {
      if (error.code === 21211 && i < maxRetries - 1) {
        // Invalid phone number, don't retry
        throw error;
      } else if (error.code === 429 && i < maxRetries - 1) {
        // Rate limited, retry with backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
};
```

#### WebSocket Connection Issues

**Symptoms:**
- Real-time chat not working
- Connection drops frequently
- Message delivery delays

**Diagnosis:**
```bash
# Check WebSocket server status
netstat -tlnp | grep :3001

# Test WebSocket connection
wscat -c ws://localhost:3001

# Check WebSocket logs
tail -f /var/log/websocket.log
```

**Solutions:**

1. **Connection Management:**
```javascript
// Improved WebSocket connection handling
class RobustWebSocket {
  constructor(url) {
    this.url = url;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();

    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      this.emit('message', event.data);
    };

    this.ws.onclose = () => {
      this.emit('disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnectDelay *= 2; // Exponential backoff
        this.connect();
      }, this.reconnectDelay);
    } else {
      this.emit('maxReconnectAttemptsReached');
    }
  }

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.emit('error', new Error('WebSocket not connected'));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }
}
```

2. **Heartbeat Implementation:**
```javascript
// WebSocket heartbeat
class WebSocketHeartbeat {
  constructor(ws, interval = 30000) {
    this.ws = ws;
    this.interval = interval;
    this.heartbeatTimer = null;
    this.missedHeartbeats = 0;
    this.maxMissedHeartbeats = 3;

    this.startHeartbeat();
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        this.missedHeartbeats++;

        if (this.missedHeartbeats > this.maxMissedHeartbeats) {
          this.ws.close();
        }
      }
    }, this.interval);
  }

  handlePong() {
    this.missedHeartbeats = 0;
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }
}
```

### Performance Issues

#### High Memory Usage

**Symptoms:**
- Application using excessive memory
- Out of memory errors
- Performance degradation

**Diagnosis:**
```bash
# Check memory usage
ps aux --sort=-%mem | head -10

# Monitor memory over time
while true; do
  ps -o pid,ppid,pcpu,pmem,rsz,vsz,comm | grep node
  sleep 5
done

# Check for memory leaks
node --inspect server.js &
curl http://localhost:9229/json
```

**Solutions:**

1. **Memory Leak Detection:**
```javascript
// Memory leak detection
const memwatch = require('memwatch-next');

memwatch.on('leak', (info) => {
  logger.error('Memory leak detected', info);
});

memwatch.on('stats', (stats) => {
  logger.info('Memory stats', stats);
});
```

2. **Memory Optimization:**
```javascript
// Manual garbage collection
const optimizeMemory = () => {
  if (global.gc) {
    global.gc();
    logger.info('Manual garbage collection completed');
  }
};

// Periodic memory optimization
setInterval(() => {
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
    optimizeMemory();
  }
}, 30000);
```

#### High CPU Usage

**Symptoms:**
- High system load
- Slow response times
- Application timeouts

**Diagnosis:**
```bash
# Check CPU usage
top -p $(pgrep node)

# Profile CPU usage
node --prof server.js &
sleep 10
kill %1
node --prof-process isolate-*.log > profile.txt

# Check for CPU-intensive operations
ps -p $(pgrep node) -o pcpu,pmem,etime
```

**Solutions:**

1. **CPU Profiling:**
```javascript
// CPU profiling
const profiler = require('v8-profiler-node8');

const startProfiling = () => {
  const title = `CPU-${Date.now()}`;
  profiler.startProfiling(title);
  return title;
};

const stopProfiling = (title) => {
  const profile = profiler.stopProfiling(title);
  profile.export()
    .pipe(require('fs').createWriteStream(`${title}.cpuprofile`))
    .on('finish', () => profile.delete());
};
```

2. **CPU Optimization:**
```javascript
// Optimize CPU-intensive operations
const optimizeCPUUsage = () => {
  // Use worker threads for CPU-intensive tasks
  const worker = new Worker('./cpu-intensive-task.js');

  worker.postMessage({ data: largeDataset });

  worker.on('message', (result) => {
    // Handle result
  });
};
```

### Security Issues

#### Authentication Bypass

**Symptoms:**
- Unauthorized access
- Authentication failures
- Security alerts

**Diagnosis:**
```bash
# Check authentication logs
tail -f /var/log/auth.log | grep -i "fail\|error\|unauthorized"

# Test authentication endpoints
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid@test.com","password":"wrong"}'

# Check security headers
curl -I http://localhost:3000 | grep -i "security\|x-frame\|x-content"
```

**Solutions:**

1. **Strengthen Authentication:**
```javascript
// Enhanced authentication middleware
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Additional security checks
    if (decoded.ip !== req.ip) {
      logger.warn('IP mismatch in token', { tokenIP: decoded.ip, requestIP: req.ip });
      return res.status(401).json({ error: 'Token IP mismatch' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid token', { error: error.message });
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

2. **Rate Limiting:**
```javascript
// Implement rate limiting for auth endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      endpoint: req.path
    });
    res.status(429).json({
      error: 'Too many authentication attempts'
    });
  }
});
```

#### Data Exposure

**Symptoms:**
- Sensitive data in logs
- Information disclosure
- Data leaks

**Solutions:**

1. **Data Sanitization:**
```javascript
// Sanitize sensitive data in logs
const sanitizeLogData = (data) => {
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'credit_card'];

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = { ...obj };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  };

  return sanitizeObject(data);
};

// Use in logging
logger.info('User login attempt', sanitizeLogData({
  email: user.email,
  password: user.password, // Will be redacted
  ip: req.ip
}));
```

2. **Secure Headers:**
```javascript
// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};
```

### Deployment Issues

#### Docker Deployment Problems

**Symptoms:**
- Container won't start
- Port binding issues
- Environment variable problems

**Diagnosis:**
```bash
# Check container status
docker ps -a

# Check container logs
docker logs container_name

# Check resource usage
docker stats

# Check environment variables
docker exec container_name env | grep -E "(DATABASE|REDIS|API)"
```

**Solutions:**

1. **Container Debugging:**
```bash
# Run container with debug mode
docker run --rm -it \
  -e NODE_ENV=development \
  -e DEBUG=* \
  your-image:latest \
  /bin/bash

# Check container health
docker inspect container_name | jq '.[0].State.Health'
```

2. **Environment Variables:**
```bash
# Create .env file for Docker
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@db:5432/prismai
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-key
EOF

# Validate environment variables
docker-compose config
```

#### Kubernetes Deployment Issues

**Symptoms:**
- Pods failing to start
- Service discovery problems
- Resource constraints

**Diagnosis:**
```bash
# Check pod status
kubectl get pods

# Check pod logs
kubectl logs pod-name

# Check service endpoints
kubectl get endpoints

# Check resource usage
kubectl top pods
```

**Solutions:**

1. **Pod Debugging:**
```bash
# Debug pod interactively
kubectl exec -it pod-name -- /bin/bash

# Check pod events
kubectl describe pod pod-name

# Check node resources
kubectl describe node node-name
```

2. **Resource Optimization:**
```yaml
# Optimized resource requests and limits
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prismai-deployment
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: prismai
        image: prismai:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Recovery Procedures

### Database Recovery

#### Point-in-Time Recovery

```bash
# Create database backup
supabase db dump --db-url "$DATABASE_URL" --file backup.sql

# Restore from backup
supabase db reset --db-url "$DATABASE_URL"
supabase db push --db-url "$DATABASE_URL" --file backup.sql
```

#### Connection Recovery

```bash
# Check database connectivity
pg_isready -h localhost -p 5432

# Restart database service
sudo systemctl restart postgresql

# Check database logs
tail -f /var/log/postgresql/postgresql.log
```

### Application Recovery

#### Service Restart

```bash
# Graceful restart
pm2 restart prismai

# Force restart
pm2 stop prismai && pm2 start prismai

# Check service status
pm2 status
pm2 logs prismai
```

#### Configuration Recovery

```bash
# Backup current configuration
cp .env.local .env.local.backup

# Restore from backup
cp .env.local.backup .env.local

# Validate configuration
npm run validate:config
```

### Data Recovery

#### File System Recovery

```bash
# Check file system integrity
fsck /dev/sda1

# Restore from backup
rsync -av /backup/files/ /app/

# Check file permissions
find /app -type f -exec chmod 644 {} \;
find /app -type d -exec chmod 755 {} \;
```

#### Cache Recovery

```bash
# Clear application cache
redis-cli FLUSHALL

# Clear CDN cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "X-Auth-Email: $EMAIL" \
  -H "X-Auth-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything": true}'
```

## Monitoring and Alerting

### Log Analysis

#### Application Logs

```bash
# Monitor application logs
tail -f /var/log/prismai/app.log

# Search for errors
grep -i "error" /var/log/prismai/app.log

# Filter by date
sed -n '/2024-01-01/,/2024-01-02/p' /var/log/prismai/app.log
```

#### System Logs

```bash
# Check system logs
journalctl -u prismai -f

# Check authentication logs
journalctl -u sshd | grep "Failed password"

# Check security logs
ausearch -m avc -ts today
```

### Performance Monitoring

#### Resource Monitoring

```bash
# Monitor system resources
htop

# Check disk usage
df -h

# Check memory usage
free -h

# Monitor network connections
netstat -tlnp | grep :3000
```

#### Application Performance

```bash
# Monitor API performance
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:3000/api/test

# Check database performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"

# Monitor cache performance
redis-cli INFO stats
```

## Support and Escalation

### When to Escalate

**Escalate immediately if:**
- Complete system outage
- Data loss or corruption
- Security breach detected
- Critical performance degradation
- Service unavailable for >15 minutes

**Escalate within 1 hour if:**
- Partial system functionality
- Performance degradation
- Non-critical errors
- Configuration issues

### Escalation Process

1. **Self-Service:** Check documentation and community forums
2. **Technical Support:** Submit detailed ticket with logs and diagnostics
3. **Emergency Support:** Call emergency hotline for critical issues
4. **Engineering Escalation:** For complex technical issues requiring code changes

### Support Ticket Information

When submitting a support ticket, include:

- **System Information:** Version, environment, deployment type
- **Error Details:** Exact error messages, stack traces
- **Reproduction Steps:** How to reproduce the issue
- **Environment Details:** OS, Node.js version, database version
- **Recent Changes:** Any recent deployments or configuration changes
- **Log Files:** Relevant application and system logs
- **Performance Data:** CPU, memory, disk usage metrics

This troubleshooting manual provides comprehensive guidance for diagnosing and resolving issues across all components of the PrismAI platform.