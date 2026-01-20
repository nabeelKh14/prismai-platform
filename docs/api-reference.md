# PrismAI API Reference v2.0

Comprehensive REST API documentation for the PrismAI Intelligent Business Automation Platform. This reference covers all available endpoints, authentication methods, data models, and integration examples.

## Table of Contents

- [Authentication](#authentication)
- [Base URL & Versioning](#base-url--versioning)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Webhooks](#webhooks)
- [Multi-Tenancy](#multi-tenancy)
- [SDKs](#sdks)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)

## Authentication

The PrismAI API uses Supabase authentication with JWT tokens. Include the JWT token in the Authorization header for all authenticated requests.

```bash
Authorization: Bearer <jwt_token>
```

### Getting Started

1. Sign up for a PrismAI account at [prismai.com](https://prismai.com)
2. Get your API credentials from the dashboard
3. Use the credentials to authenticate and get a JWT token
4. Include the token in all API requests

### Token Management

Tokens are managed by Supabase Auth and have a default lifetime of 1 hour. Implement token refresh logic in your application.

```typescript
// Example token refresh
async function refreshToken() {
  const { data, error } = await supabase.auth.refreshSession()
  return data.session?.access_token
}
```

## Base URL & Versioning

Production: `https://api.prismai.com`
Development: `http://localhost:3000/api`

### API Versioning
- **v1**: Legacy version (deprecated)
- **v2**: Current stable version (recommended)

## Error Handling

All API responses follow a consistent error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request failed validation",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    },
    "timestamp": "2025-11-10T21:24:37.674Z",
    "requestId": "req_1234567890"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_ERROR` | 401 | Authentication required |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_ERROR` | 429 | Rate limit exceeded |
| `EXTERNAL_SERVICE_ERROR` | 502 | External service unavailable |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Rate Limiting

API requests are rate limited using multiple strategies with tier-based limits.

| Tier | Auth API | AI API | General API | WebSocket |
|------|----------|--------|-------------|-----------|
| Free | 10/min | 5/min | 100/hour | 5 connections |
| Pro | 60/min | 30/min | 1,000/hour | 50 connections |
| Enterprise | 300/min | 100/min | 10,000/hour | 500 connections |

Rate limit headers are included in all responses:

```bash
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-RateLimit-Retry-After: 60
```

## Webhooks

Configure webhooks to receive real-time notifications about events in your account.

### Webhook Events

#### Conversation Events
- `conversation.created` - New conversation started
- `conversation.updated` - Conversation properties changed
- `conversation.resolved` - Conversation marked as resolved
- `conversation.assigned` - Agent assigned to conversation
- `conversation.escalated` - Conversation escalated to supervisor

#### Message Events
- `message.received` - New message received
- `message.sent` - Message sent by agent or system
- `message.typing` - User typing indicator

#### Agent Events
- `agent.status_changed` - Agent online/offline status changed
- `agent.assigned` - Agent assigned to conversation
- `agent.performance_updated` - Performance metrics updated

#### System Events
- `system.alert` - System alert triggered
- `system.maintenance` - Scheduled maintenance notice
- `billing.usage_limit` - Usage limit approaching

### Webhook Security

All webhooks are signed with your webhook secret. Verify signatures in your webhook handler:

```typescript
import crypto from 'crypto'

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(computedSignature, 'hex')
  )
}

// Webhook handler example
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string
  const payload = req.body.toString()
  const secret = process.env.WEBHOOK_SECRET!

  if (!verifyWebhook(payload, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = JSON.parse(payload)
  handleWebhookEvent(event)
  
  res.json({ received: true })
})
```

## Multi-Tenancy

PrismAI is a multi-tenant platform. All data is automatically scoped to the authenticated user's tenant.

### Tenant Context

```typescript
// Tenant context is automatically handled
const { data: { user } } = await supabase.auth.getUser()
// All queries are automatically filtered by tenant
```

### Cross-Tenant Operations (Enterprise)

Enterprise users can access data from other tenants using the `X-Tenant-ID` header:

```bash
X-Tenant-ID: tenant_123456
Authorization: Bearer <jwt_token>
```

## SDKs

Official SDKs are available for popular programming languages:

- [JavaScript/TypeScript](https://github.com/prismai/sdk-js) - Full-featured client
- [Python](https://github.com/prismai/sdk-python) - Complete API coverage
- [PHP](https://github.com/prismai/sdk-php) - REST API wrapper
- [Ruby](https://github.com/prismai/sdk-ruby) - Object-oriented client

### JavaScript SDK Example

```typescript
import { PrismAI } from '@prismai/sdk'

const client = new PrismAI({
  apiKey: 'your_api_key',
  baseUrl: 'https://api.prismai.com'
})

// Create conversation
const conversation = await client.conversations.create({
  customerId: 'cust_123',
  channel: 'whatsapp',
  priority: 'medium'
})

// Send message
await client.messages.send({
  conversationId: conversation.id,
  content: 'Hello, how can I help?',
  sender: 'agent'
})
```

## API Endpoints

### Authentication & User Management

#### POST /api/auth/login
Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "rememberMe": false
}
```

**Response:**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg"
  },
  "session": {
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "expiresAt": "2025-11-10T22:24:37.674Z"
  }
}
```

#### GET /api/auth/me
Get current user profile.

**Response:**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "created_at": "2023-01-15T10:30:00Z",
  "user_metadata": {
    "tenant_id": "tenant_456",
    "role": "agent"
  }
}
```

### Agent Management

#### GET /api/agents
Retrieve agent profiles for the current tenant.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `status` - Filter by agent status
- `role` - Filter by agent role

**Response:**
```json
{
  "agents": [
    {
      "id": "agent_123",
      "user_id": "user_456",
      "name": "John Doe",
      "email": "john@company.com",
      "role": "agent",
      "status": "active",
      "max_concurrent_chats": 5,
      "skills": ["billing", "technical"],
      "performance_goals": {
        "response_time": 120,
        "satisfaction_score": 4.5
      },
      "created_at": "2023-01-15T10:30:00Z",
      "updated_at": "2023-01-15T11:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

#### POST /api/agents
Create a new agent profile.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "role": "agent",
  "max_concurrent_chats": 5,
  "skills": ["support", "sales"]
}
```

#### GET /api/agents/{id}
Retrieve a specific agent.

#### PUT /api/agents/{id}
Update agent properties.

**Request Body:**
```json
{
  "name": "Jane Smith Updated",
  "status": "active",
  "max_concurrent_chats": 8,
  "skills": ["support", "sales", "technical"]
}
```

#### DELETE /api/agents/{id}
Delete an agent profile.

#### GET /api/agents/metrics
Retrieve agent performance metrics.

**Query Parameters:**
- `agent_id` - Specific agent ID (optional)
- `start_date` - Start date (YYYY-MM-DD)
- `end_date` - End date (YYYY-MM-DD)
- `page` - Page number
- `limit` - Items per page

**Response:**
```json
{
  "metrics": [
    {
      "id": "metric_123",
      "agent_id": "agent_456",
      "user_id": "tenant_789",
      "metric_date": "2025-11-10",
      "total_conversations": 25,
      "resolved_conversations": 23,
      "escalated_conversations": 2,
      "abandoned_conversations": 0,
      "avg_response_time_seconds": 95,
      "avg_resolution_time_seconds": 480,
      "customer_satisfaction_score": 4.2,
      "efficiency_score": 87.5,
      "goals_achieved": {
        "response_time": true,
        "satisfaction_score": false
      },
      "created_at": "2025-11-10T21:24:37.674Z",
      "agent_profiles": {
        "name": "John Doe",
        "email": "john@company.com",
        "role": "agent"
      }
    }
  ]
}
```

#### GET /api/agents/goals
Retrieve agent performance goals.

#### POST /api/agents/goals
Create agent performance goals.

**Request Body:**
```json
{
  "agent_id": "agent_123",
  "goals": {
    "response_time": 120,
    "satisfaction_score": 4.5,
    "resolution_rate": 0.95,
    "efficiency_score": 85
  },
  "period": "monthly",
  "start_date": "2025-11-01",
  "end_date": "2025-11-30"
}
```

### Monitoring & Analytics

#### GET /api/monitoring/metrics
Retrieve system performance metrics.

**Query Parameters:**
- `timeRange` - Time range (15m, 1h, 4h, 24h)

**Response:**
```json
{
  "activeChats": 12,
  "queueLength": 3,
  "averageResponseTime": 45,
  "totalAgents": 8,
  "onlineAgents": 6,
  "resolvedToday": 127,
  "abandonedToday": 8,
  "satisfactionScore": 92.5
}
```

#### GET /api/monitoring/agents
Retrieve agent monitoring data.

**Query Parameters:**
- `status` - Filter by agent status
- `timeRange` - Time range for metrics

#### GET /api/analytics/customer-service/export
Export customer service analytics.

**Query Parameters:**
- `start_date` - Start date (YYYY-MM-DD)
- `end_date` - End date (YYYY-MM-DD)
- `format` - Export format (csv, json, xlsx)
- `metrics` - Specific metrics to include

**Response:**
```json
{
  "exportId": "exp_123456",
  "status": "completed",
  "downloadUrl": "https://api.prismai.com/exports/exp_123456/download",
  "expiresAt": "2025-11-17T21:24:37.674Z",
  "fileSize": 1024000,
  "recordCount": 15420
}
```

### Knowledge Base Management

#### GET /api/knowledge-base/search
Search knowledge base articles.

**Query Parameters:**
- `q` - Search query
- `category` - Filter by category
- `tags` - Filter by tags (comma-separated)
- `limit` - Results limit (default: 10, max: 50)

#### POST /api/knowledge-base/import
Import knowledge base articles from file.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` - File to upload (CSV, JSON, or TXT)
- `category` - Default category for articles
- `tags` - Default tags for articles

**Response:**
```json
{
  "success": true,
  "imported": 150,
  "errors": 5,
  "errorDetails": [
    "Row 45: Missing required field 'title'",
    "Row 67: Invalid category 'invalid_category'"
  ]
}
```

### File Management

#### POST /api/files/upload
Upload files to Supabase Storage.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` - File to upload
- `conversationId` - Associated conversation ID (optional)
- `messageId` - Associated message ID (optional)

**Response:**
```json
{
  "id": "file_123",
  "file_name": "document.pdf",
  "file_size": 1024000,
  "file_type": "application/pdf",
  "file_url": "https://storage.prismai.com/files/file_123.pdf",
  "created_at": "2025-11-10T21:24:37.674Z"
}
```

#### GET /api/files
Retrieve file listings.

**Query Parameters:**
- `conversationId` - Filter by conversation
- `messageId` - Filter by message
- `page` - Page number
- `limit` - Items per page

### Survey System

#### GET /api/surveys/templates
Retrieve survey templates.

**Response:**
```json
{
  "templates": [
    {
      "id": "template_123",
      "user_id": "tenant_456",
      "name": "Customer Satisfaction",
      "description": "Post-conversation satisfaction survey",
      "trigger_event": "conversation_resolved",
      "delivery_channels": ["email", "sms"],
      "questions": [
        {
          "id": "q1",
          "type": "rating",
          "question": "How satisfied are you with our service?",
          "required": true,
          "options": [1, 2, 3, 4, 5]
        },
        {
          "id": "q2",
          "type": "text",
          "question": "How can we improve?",
          "required": false
        }
      ],
      "is_active": true,
      "created_at": "2023-01-15T10:30:00Z",
      "updated_at": "2023-01-15T11:45:00Z"
    }
  ]
}
```

#### POST /api/surveys/templates
Create a new survey template.

**Request Body:**
```json
{
  "name": "Product Feedback",
  "description": "Quarterly product feedback survey",
  "trigger_event": "manual",
  "delivery_channels": ["email"],
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Which features do you use most?",
      "required": true,
      "options": ["Dashboard", "Reports", "API", "Mobile App"]
    }
  ]
}
```

#### GET /api/surveys/templates/{id}
Retrieve a specific survey template.

#### PUT /api/surveys/templates/{id}
Update a survey template.

#### DELETE /api/surveys/templates/{id}
Delete a survey template.

### Quality Management

#### GET /api/quality/criteria
Retrieve quality scoring criteria.

#### POST /api/quality/criteria
Create quality scoring criteria.

**Request Body:**
```json
{
  "name": "Customer Service Excellence",
  "description": "Comprehensive quality assessment",
  "criteria": [
    {
      "name": "Response Time",
      "description": "Agent responded within SLA",
      "weight": 25,
      "max_score": 100
    },
    {
      "name": "Problem Resolution",
      "description": "Customer issue was fully resolved",
      "weight": 35,
      "max_score": 100
    }
  ],
  "max_score": 100
}
```

#### GET /api/quality/reviews
Retrieve quality review results.

**Query Parameters:**
- `agent_id` - Filter by agent
- `conversation_id` - Filter by conversation
- `start_date` - Start date
- `end_date` - End date
- `page` - Page number
- `limit` - Items per page

#### POST /api/quality/reviews
Create a quality review.

**Request Body:**
```json
{
  "conversation_id": "conv_123",
  "reviewer_id": "agent_456",
  "criteria_id": "criteria_789",
  "overall_score": 85,
  "criteria_scores": {
    "response_time": 90,
    "problem_resolution": 80
  },
  "feedback": "Good performance overall, room for improvement in response time",
  "review_type": "random"
}
```

### Lead Management

#### GET /api/leads
Retrieve lead database.

**Query Parameters:**
- `status` - Filter by lead status
- `source` - Filter by lead source
- `score_min` - Minimum lead score
- `score_max` - Maximum lead score
- `page` - Page number
- `limit` - Items per page

**Response:**
```json
{
  "leads": [
    {
      "id": "lead_123",
      "email": "lead@example.com",
      "phone": "+1234567890",
      "first_name": "John",
      "last_name": "Doe",
      "company": "Acme Corp",
      "job_title": "CTO",
      "lead_score": 85,
      "status": "qualified",
      "tags": ["enterprise", "high-value"],
      "custom_fields": {
        "industry": "Technology",
        "company_size": "500-1000"
      },
      "last_contact_date": "2025-11-08T14:30:00Z",
      "next_follow_up": "2025-11-15T10:00:00Z",
      "created_at": "2025-11-01T09:00:00Z"
    }
  ]
}
```

#### POST /api/lead-routing/priority
Intelligent lead routing and prioritization.

**Request Body:**
```json
{
  "lead_data": {
    "email": "enterprise-lead@company.com",
    "company_size": "1000+",
    "industry": "finance",
    "budget": 100000,
    "urgency": "high"
  },
  "routing_criteria": {
    "agent_skills": ["enterprise", "finance"],
    "workload_capacity": "available",
    "geographic_preference": "NA"
  }
}
```

**Response:**
```json
{
  "routing_decision": {
    "assigned_agent": "agent_456",
    "priority_score": 92,
    "routing_reason": "High-value enterprise lead with finance industry match",
    "estimated_response_time": "15 minutes",
    "alternatives": [
      {
        "agent": "agent_789",
        "score": 88,
        "reason": "Available senior agent"
      }
    ]
  }
}
```

### Unified Conversations

#### GET /api/unified/conversations
Retrieve multi-modal conversations (voice + text).

**Query Parameters:**
- `channel` - Filter by channel (whatsapp, sms, website, email, phone)
- `status` - Filter by conversation status
- `modality` - Filter by conversation type (voice, text, multimodal)
- `page` - Page number
- `limit` - Items per page

**Response:**
```json
{
  "conversations": [
    {
      "id": "conv_123",
      "customer_identifier": "+1234567890",
      "channel": "whatsapp",
      "modality": "multimodal",
      "status": "active",
      "priority": "high",
      "created_at": "2025-11-10T20:30:00Z",
      "updated_at": "2025-11-10T21:24:37.674Z",
      "last_message": {
        "id": "msg_456",
        "content": "I need help with my order",
        "modality": "text",
        "timestamp": "2025-11-10T21:20:00Z"
      },
      "context": {
        "customer_name": "John Doe",
        "order_id": "ORD-12345",
        "sentiment": "neutral"
      }
    }
  ]
}
```

#### GET /api/unified/conversations/{id}/messages
Retrieve message history for unified conversation.

#### POST /api/unified/conversations
Create new unified conversation.

**Request Body:**
```json
{
  "customer_identifier": "+1234567890",
  "channel": "whatsapp",
  "modality": "multimodal",
  "initial_message": {
    "content": "Hello, I need assistance",
    "modality": "text"
  },
  "context": {
    "customer_name": "John Doe",
    "order_id": "ORD-12345"
  }
}
```

### WebSocket & Real-time

#### GET/POST /api/websocket/live-chat
WebSocket endpoint for real-time chat.

**Connection Example:**
```javascript
const ws = new WebSocket('wss://api.prismai.com/websocket/live-chat?token=jwt_token')

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  handleWebSocketMessage(data)
}

// Send message
ws.send(JSON.stringify({
  type: 'message',
  conversationId: 'conv_123',
  content: 'Hello!',
  modality: 'text'
}))

// Typing indicator
ws.send(JSON.stringify({
  type: 'typing',
  conversationId: 'conv_123',
  isTyping: true
}))
```

**WebSocket Message Types:**
- `message` - New message
- `typing` - Typing indicator
- `agent_assigned` - Agent assigned to conversation
- `conversation_ended` - Conversation ended
- `system_notification` - System notification

### External Webhooks

#### POST /api/webhooks/whatsapp
WhatsApp Business API webhook handler.

#### POST /api/webhooks/sms
SMS webhook handler (Twilio integration).

### AI Services

#### POST /api/ai/chat
Generate AI responses for chat conversations.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful customer service assistant."
    },
    {
      "role": "user",
      "content": "How can I reset my password?"
    }
  ],
  "temperature": 0.7,
  "maxTokens": 1000,
  "model": "gemini-1.5-flash"
}
```

**Response:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "I'd be happy to help you reset your password..."
      },
      "finishReason": "stop"
    }
  ],
  "usage": {
    "promptTokens": 25,
    "completionTokens": 150,
    "totalTokens": 175
  }
}
```

#### POST /api/ai/embeddings
Generate vector embeddings for text content.

**Request Body:**
```json
{
  "input": "Text content to embed",
  "model": "text-embedding-004"
}
```

**Response:**
```json
{
  "embedding": [0.123, 0.456, 0.789, ...]
}
```

## Data Models

### Core Entities

#### Conversation
```typescript
interface Conversation {
  id: string
  user_id: string
  customer_identifier: string
  channel: 'whatsapp' | 'sms' | 'website' | 'email' | 'phone'
  modality: 'voice' | 'text' | 'multimodal'
  status: 'active' | 'resolved' | 'waiting' | 'assigned' | 'escalated' | 'closed'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}
```

#### Message
```typescript
interface Message {
  id: string
  conversation_id: string
  content: string
  sender_type: 'user' | 'agent' | 'system'
  message_type?: 'text' | 'image' | 'file' | 'location' | 'audio' | 'video'
  modality?: 'voice' | 'text' | 'multimodal'
  metadata?: Record<string, any>
  created_at: string
}
```

#### Agent
```typescript
interface Agent {
  id: string
  user_id: string
  name: string
  email: string
  role: 'agent' | 'supervisor' | 'manager'
  status: 'active' | 'inactive' | 'suspended'
  max_concurrent_chats: number
  skills: string[]
  performance_goals: Record<string, any>
  created_at: string
  updated_at: string
}
```

#### Lead
```typescript
interface Lead {
  id: string
  user_id: string
  source_id?: string
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  company?: string
  job_title?: string
  lead_score: number
  status: 'new' | 'contacted' | 'qualified' | 'opportunity' | 'customer' | 'lost'
  tags: string[]
  custom_fields: Record<string, any>
  last_contact_date?: string
  next_follow_up?: string
  notes?: string
  created_at: string
  updated_at: string
}
```

#### Survey Template
```typescript
interface SurveyTemplate {
  id: string
  user_id: string
  name: string
  description?: string
  trigger_event: 'conversation_resolved' | 'manual' | 'scheduled' | 'escalation'
  delivery_channels: string[]
  questions: SurveyQuestion[]
  is_active: boolean
  created_at: string
  updated_at: string
}

interface SurveyQuestion {
  id: string
  type: 'text' | 'rating' | 'multiple_choice' | 'yes_no'
  question: string
  required: boolean
  options?: string[]
  validation?: {
    min_length?: number
    max_length?: number
    pattern?: string
  }
}
```

#### Quality Review
```typescript
interface QualityReview {
  id: string
  conversation_id: string
  reviewer_id: string
  criteria_id: string
  overall_score: number
  criteria_scores: Record<string, number>
  feedback?: string
  review_type: 'random' | 'flagged' | 'escalated' | 'training'
  is_calibrated: boolean
  created_at: string
  updated_at: string
}
```

#### File Attachment
```typescript
interface FileAttachment {
  id: string
  user_id: string
  conversation_id?: string
  message_id?: string
  file_name: string
  file_size: number
  file_type: string
  file_path: string
  file_url: string
  uploaded_by: string
  is_secure: boolean
  expires_at?: string
  metadata: Record<string, any>
  created_at: string
}
```

### Analytics & Monitoring

#### Monitoring Metrics
```typescript
interface MonitoringMetrics {
  activeChats: number
  queueLength: number
  averageResponseTime: number
  totalAgents: number
  onlineAgents: number
  resolvedToday: number
  abandonedToday: number
  satisfactionScore: number
}
```

#### Agent Performance Metrics
```typescript
interface AgentPerformanceMetrics {
  id: string
  agent_id: string
  user_id: string
  metric_date: string
  total_conversations: number
  resolved_conversations: number
  escalated_conversations: number
  abandoned_conversations: number
  avg_response_time_seconds?: number
  avg_resolution_time_seconds?: number
  customer_satisfaction_score?: number
  efficiency_score?: number
  goals_achieved: Record<string, any>
  created_at: string
  updated_at: string
}
```

#### Analytics Data
```typescript
interface AnalyticsData {
  totalConversations: number
  resolvedConversations: number
  activeConversations: number
  resolutionRate: number
  averageResolutionTime: number
  customerSatisfaction: number
  channelBreakdown: {
    whatsapp: number
    sms: number
    website: number
    email?: number
  }
  dailyVolume: Array<{
    date: string
    conversations: number
    resolved: number
    satisfaction: number
  }>
  agentPerformance: Array<{
    id: string
    name: string
    conversations: number
    resolutionRate: number
    avgResponseTime: number
    satisfactionScore: number
    efficiency: number
  }>
  conversationOutcomes: {
    resolved: number
    escalated: number
    abandoned: number
    transferred: number
  }
  satisfactionTrends: Array<{
    date: string
    score: number
  }>
}
```
## Function Signatures & Class Hierarchies

This section provides detailed technical specifications for all API endpoints, including the actual function signatures and class hierarchies from the implementation.

### Core API Implementation Classes

#### Authentication Handler Functions

```typescript
// POST /api/auth/login - Function signature
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Implementation details
  const body = await request.json()
  const { email, password, rememberMe } = body
  
  // Request schema
  interface LoginRequest {
    email: string
    password: string
    rememberMe?: boolean
  }
  
  // Response schema
  interface LoginResponse {
    user: {
      id: string
      email: string
      name?: string
    }
    session: {
      accessToken: string
      refreshToken: string
      expiresAt: string
    }
  }
}

// GET /api/auth/me - Function signature
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Implementation details
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  // Response schema
  interface UserResponse {
    id: string
    email: string
    name?: string
    avatar_url?: string
    created_at: string
    user_metadata?: Record<string, any>
  }
}
```

#### Agent Management Functions

```typescript
// GET /api/agents - Function signature
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  const { data: agents, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  
  // Response schema
  interface AgentProfile {
    id: string
    user_id: string
    name: string
    email: string
    role: 'agent' | 'supervisor' | 'manager'
    status: 'active' | 'inactive' | 'suspended'
    max_concurrent_chats: number
    skills: string[]
    performance_goals: Record<string, any>
    created_at: string
    updated_at: string
  }
}

// POST /api/agents - Function signature
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  const body = await request.json()
  const { name, email, role, max_concurrent_chats, skills } = body
  
  // Validation checks
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 })
  }
  
  // Request schema
  interface CreateAgentRequest {
    name: string           // Required
    email: string          // Required
    role?: 'agent' | 'supervisor' | 'manager'  // Default: 'agent'
    max_concurrent_chats?: number              // Default: 5
    skills?: string[]                         // Default: []
  }
}
```

#### Monitoring & Metrics Functions

```typescript
// GET /api/monitoring/metrics - Function signature
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const searchParams = new URL(request.url)
  const timeRange = searchParams.get('timeRange') || '1h'
  
  // Time range calculation
  const now = new Date()
  let startTime: Date
  
  switch (timeRange) {
    case '15m':
      startTime = new Date(now.getTime() - 15 * 60 * 1000)
      break
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000)
      break
    case '4h':
      startTime = new Date(now.getTime() - 4 * 60 * 60 * 1000)
      break
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    default:
      startTime = new Date(now.getTime() - 60 * 60 * 1000)
  }
  
  // Response schema
  interface MonitoringMetrics {
    activeChats: number
    queueLength: number
    averageResponseTime: number
    totalAgents: number
    onlineAgents: number
    resolvedToday: number
    abandonedToday: number
    satisfactionScore: number
  }
}

// GET /api/agents/metrics - Function signature
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { searchParams } = new URL(request.url)
  const agent_id = searchParams.get('agent_id')
  const start_date = searchParams.get('start_date')
  const end_date = searchParams.get('end_date')
  
  // Response schema
  interface AgentMetrics {
    id: string
    agent_id: string
    user_id: string
    metric_date: string
    total_conversations: number
    resolved_conversations: number
    escalated_conversations: number
    abandoned_conversations: number
    avg_response_time_seconds: number
    avg_resolution_time_seconds: number
    customer_satisfaction_score: number
    efficiency_score: number
    goals_achieved: Record<string, any>
    created_at: string
    updated_at: string
    agent_profiles: {
      name: string
      email: string
      role: string
    }
  }
}
```

#### File Management Functions

```typescript
// POST /api/files/upload - Function signature
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Form data processing
  const formData = await request.formData()
  const file = formData.get('file') as File
  const conversationId = formData.get('conversationId') as string
  const messageId = formData.get('messageId') as string
  
  // File validation
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  
  // File size and type validation
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File size exceeds limit" }, { status: 400 })
  }
  
  // Request schema
  interface FileUploadRequest {
    file: File                    // Required: File to upload
    conversationId?: string       // Optional: Associated conversation
    messageId?: string           // Optional: Associated message
  }
  
  // Response schema
  interface FileUploadResponse {
    id: string
    file_name: string
    file_size: number
    file_type: string
    file_url: string
    created_at: string
  }
}
```

### Core Library Classes

#### Gemini AI Client

```typescript
class GeminiClient {
  // Constructor
  constructor(): GeminiClient
  
  // Core AI processing methods
  private convertToGeminiMessages(
    messages: ChatCompletionRequest['messages']
  ): {
    systemInstruction?: { parts: { text: string }[] }
    contents: GeminiMessage[]
  }
  
  async createChatCompletion(
    request: ChatCompletionRequest
  ): Promise<{
    choices: Array<{
      message: {
        role: 'assistant'
        content: string
      }
      finishReason: string
    }>
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }>
  
  async createEmbedding(
    request: EmbeddingRequest
  ): Promise<EmbeddingResponse>
  
  async chat(
    messages: ChatCompletionRequest['messages'],
    options: {
      temperature?: number
      maxTokens?: number
      model?: string
    }
  ): Promise<any>
  
  async analyzeTranscript(
    transcript: string
  ): Promise<{
    sentimentScore: number
    bookingRequest: any
    topics: string[]
    satisfaction: string
  }>
}
```

#### Optimized Database Client

```typescript
export class OptimizedSupabaseClient {
  // Private properties
  private supabase: any
  private isServer: boolean
  private tenantId?: string
  private cache: Map<string, any>
  private performanceMetrics: PerformanceMetrics[]
  
  // Constructor
  constructor(
    isServer?: boolean,
    tenantId?: string,
    poolConfig?: ConnectionPoolConfig,
    cacheConfig?: CacheConfig
  )
  
  // Core query methods
  async query(
    table: string,
    operation: 'select' | 'insert' | 'update' | 'delete',
    options?: any,
    useCache?: boolean,
    cacheKey?: string
  ): Promise<any>
  
  // Connection management
  async getConnectionPoolStats(): Promise<{
    activeConnections: number
    idleConnections: number
    waitingConnections: number
    utilizationRate: number
  }>
  
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    metrics: {
      averageQueryTime: number
      cacheHitRate: number
      connectionPoolUtilization: number
    }
  }>
}
```

#### Alerting System

```typescript
export class AlertingSystem {
  // Singleton pattern
  static getInstance(): AlertingSystem
  
  // Alert management methods
  async checkAlerts(): Promise<void>
  async triggerAlert(rule: AlertRule, metrics: any): Promise<void>
  async acknowledgeAlert(alertId: string, userId: string): Promise<void>
  async resolveAlert(alertId: string, userId: string): Promise<void>
  
  // Rule management methods
  addRule(rule: AlertRule): void
  removeRule(ruleId: string): void
  updateRule(ruleId: string, updates: Partial<AlertRule>): void
  getRule(ruleId: string): AlertRule | undefined
  
  // Alert retrieval methods
  getActiveAlerts(): Alert[]
  getAlertsBySeverity(severity: AlertSeverity): Alert[]
  getAlertsByTimeRange(startTime: Date, endTime: Date): Alert[]
}
```

#### WebSocket Manager

```typescript
export class WebSocketManager {
  private socket: WebSocket | null = null
  private eventHandlers: Map<WebSocketEventType, Function[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null
  
  // Connection management
  connect(userId: string, token: string): Promise<void>
  disconnect(): void
  reconnect(): void
  
  // Event handling
  on(eventType: WebSocketEventType, handler: Function): void
  off(eventType: WebSocketEventType, handler: Function): void
  emit(eventType: WebSocketEventType, data: any): void
  
  // Message sending
  sendMessage(conversationId: string, content: string, modality: 'voice' | 'text'): void
  sendTypingIndicator(conversationId: string, isTyping: boolean): void
  requestAgentTransfer(conversationId: string, reason: string): void
  uploadFile(file: File, conversationId: string): Promise<void>
  
  // Health monitoring
  startHeartbeat(): void
  stopHeartbeat(): void
  checkConnection(): boolean
}
```

### React Hook Implementations

#### useConversation Hook

```typescript
export const useConversation = (conversationId: string): {
  messages: Message[]
  metrics: ConversationMetrics
  isLoading: boolean
  error: string | null
  sendMessage: (content: string, modality?: 'voice' | 'text', metadata?: Record<string, any>) => Promise<any>
  refetch: () => Promise<void>
}

// Hook interfaces
interface Message {
  id: string
  conversationId: string
  modality: 'voice' | 'text'
  senderType: 'customer' | 'ai' | 'agent'
  content: string
  audioUrl?: string
  timestamp: string
  processingTime?: number
  confidence?: number
  metadata?: Record<string, any>
}

interface ConversationMetrics {
  totalMessages: number
  averageResponseTime: number
  voiceMessages: number
  textMessages: number
  lastActivity: string
}
```

#### useAIAssistant Hook

```typescript
export const useAIAssistant = (config?: AIAssistantConfig): {
  state: AIAssistantState
  sendMessage: (message: string, context?: any) => Promise<void>
  generateResponse: (prompt: string, context?: any) => Promise<string>
  getSuggestions: (input: string) => Promise<string[]>
  clearContext: () => void
  updateContext: (context: Partial<ConversationContext>) => void
}

// Hook interfaces
interface AIAssistantState {
  isLoading: boolean
  error: string | null
  context: ConversationContext
  suggestions: string[]
  response: string | null
}

interface AIAssistantConfig {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  enableStreaming?: boolean
}
```

### Database Schema Functions

#### Vector Search Implementation

```sql
-- Vector search function from scripts/003_add_vector_search_to_knowledge_base.sql
CREATE OR REPLACE FUNCTION search_knowledge_base_vector(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.1,
  match_count int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  category text,
  tags text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.tags,
    1 - (kb.embedding <=> query_embedding) as similarity
  FROM public.knowledge_base kb
  WHERE kb.is_published = true
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

This technical reference provides the complete implementation details for all API endpoints, class hierarchies, and function signatures used in the PrismAI platform.

## Best Practices

### Authentication
- Store API keys securely (environment variables)
- Use short-lived tokens when possible
- Implement proper token refresh logic

### Rate Limiting
- Implement exponential backoff for retries
- Monitor rate limit headers
- Cache responses when appropriate

### Error Handling
- Handle all HTTP status codes appropriately
- Implement retry logic for transient errors
- Log errors for debugging

### Performance
- Use pagination for large datasets
- Cache frequently accessed data
- Batch operations when possible

## Support

For API support and questions:

- **Documentation**: [https://docs.prismai.com](https://docs.prismai.com)
- **Support Email**: support@prismai.com
- **Community Forum**: [https://community.prismai.com](https://community.prismai.com)

## Changelog

### Version 2.0.0
- Added multi-tenant support
- Enhanced AI capabilities with Gemini integration
- Improved monitoring and analytics
- Added webhook support
- Comprehensive file management system
- Advanced quality management and scoring
- Intelligent lead routing and prioritization
- Unified conversation management across all channels
- Advanced WebSocket real-time communication

### Version 1.5.0
- Added knowledge base management
- Enhanced authentication with MFA
- Improved rate limiting
- Added survey functionality

This API reference provides comprehensive documentation for all PrismAI platform endpoints and features.