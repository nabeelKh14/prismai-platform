# PrismAI API Reference

## Overview

The PrismAI API provides comprehensive endpoints for managing AI-powered customer service automation, multi-channel communication, knowledge base management, analytics, and monitoring. All API endpoints follow RESTful conventions and support JSON request/response formats.

## Base URL

```
https://api.prismai.com
```

## Authentication

All API endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Authentication Endpoints

#### Login
**POST** `/api/auth/login`

Authenticate user credentials and establish a session.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "user_password"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  },
  "redirectTo": "/dashboard"
}
```

**MFA Response:**
```json
{
  "success": true,
  "requiresMFA": true,
  "mfaMethods": ["totp", "sms"],
  "sessionId": "session_id"
}
```

**Error Responses:**
- `400`: Missing email or password
- `401`: Invalid credentials
- `429`: Rate limit exceeded

#### Logout
**POST** `/api/auth/logout`

Terminate the current user session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## API Versioning

The API supports versioning through URL paths:

- **v1**: `/api/v1/*` - Current stable version
- **v2**: `/api/v2/*` - Latest version with new features

## Rate Limiting

Rate limits are applied per endpoint and user:

- **Standard endpoints**: 100 requests per minute
- **Heavy endpoints**: 10 requests per minute
- **Authentication endpoints**: 5 attempts per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Common Response Format

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": { /* additional error information */ }
}
```

## Agent Management

### List Agents
**GET** `/api/agents`

Retrieve all agents for the authenticated user.

**Response:**
```json
[
  {
    "id": "agent_id",
    "name": "Agent Name",
    "email": "agent@example.com",
    "role": "agent",
    "max_concurrent_chats": 5,
    "skills": ["customer_service", "technical_support"],
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Create Agent
**POST** `/api/agents`

Create a new agent profile.

**Request Body:**
```json
{
  "name": "Agent Name",
  "email": "agent@example.com",
  "role": "agent",
  "max_concurrent_chats": 5,
  "skills": ["customer_service", "technical_support"]
}
```

**Response:**
```json
{
  "id": "agent_id",
  "name": "Agent Name",
  "email": "agent@example.com",
  "role": "agent",
  "max_concurrent_chats": 5,
  "skills": ["customer_service", "technical_support"],
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Get Agent Metrics
**GET** `/api/agents/metrics`

Retrieve performance metrics for all agents.

**Query Parameters:**
- `timeRange`: Time range for metrics (`15m`, `1h`, `4h`, `24h`)

**Response:**
```json
{
  "agents": [
    {
      "agent_id": "agent_id",
      "name": "Agent Name",
      "active_chats": 3,
      "resolved_today": 15,
      "average_response_time": 45,
      "satisfaction_score": 92.5
    }
  ],
  "summary": {
    "total_agents": 10,
    "active_agents": 8,
    "total_active_chats": 25,
    "total_resolved_today": 127
  }
}
```

### Agent Goals
**GET** `/api/agents/goals`

Retrieve agent performance goals and targets.

**Response:**
```json
{
  "goals": [
    {
      "id": "goal_id",
      "agent_id": "agent_id",
      "type": "response_time",
      "target": 60,
      "current": 45,
      "unit": "seconds",
      "period": "daily"
    }
  ]
}
```

## Knowledge Base Management

### Import Articles
**POST** `/api/knowledge-base/import`

Import knowledge base articles from various file formats.

**Content-Type:** `multipart/form-data`

**Request Body:**
```
file: <file> (CSV, JSON, or TXT format)
```

**Supported Formats:**

**CSV Format:**
```csv
title,content,category,tags,is_published
"Getting Started","Welcome to our platform","General","onboarding,welcome",true
"API Documentation","Complete API reference","Technical","api,documentation",true
```

**JSON Format:**
```json
[
  {
    "title": "Getting Started",
    "content": "Welcome to our platform",
    "category": "General",
    "tags": ["onboarding", "welcome"],
    "is_published": true
  }
]
```

**TXT Format:**
```text
# Getting Started
Welcome to our platform. This guide will help you...

---
# API Documentation
Complete API reference and examples...
```

**Response:**
```json
{
  "success": true,
  "imported": 25,
  "errors": 2,
  "errorDetails": [
    "Row 5: Invalid title format",
    "Row 10: Content too long"
  ]
}
```

### Search Knowledge Base
**GET** `/api/knowledge-base/search`

Search for relevant articles using semantic search.

**Query Parameters:**
- `query`: Search query string
- `limit`: Maximum number of results (default: 10)
- `threshold`: Similarity threshold (default: 0.7)

**Response:**
```json
{
  "results": [
    {
      "id": "article_id",
      "title": "Article Title",
      "content": "Article content...",
      "category": "General",
      "score": 0.95,
      "tags": ["relevant", "tags"]
    }
  ],
  "total": 25
}
```

## AI Services

### Chat Completions
**POST** `/api/ai/chat`

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

### Generate Embeddings
**POST** `/api/ai/embeddings`

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

### AI Escalation
**POST** `/api/ai/escalation`

Escalate complex conversations to human agents.

**Request Body:**
```json
{
  "conversation_id": "conv_id",
  "reason": "complex_technical_issue",
  "priority": "high",
  "context": "Customer having trouble with API integration"
}
```

**Response:**
```json
{
  "success": true,
  "escalation_id": "esc_id",
  "assigned_agent": "agent_id",
  "estimated_wait_time": 120
}
```

## Live Chat

### Get Live Chat Agents
**GET** `/api/live-chat/agents`

Retrieve available live chat agents.

**Response:**
```json
{
  "agents": [
    {
      "id": "agent_id",
      "name": "Agent Name",
      "status": "online",
      "current_chats": 2,
      "max_chats": 5,
      "specialties": ["technical", "billing"]
    }
  ],
  "queue_length": 3
}
```

## Monitoring & Analytics

### System Metrics
**GET** `/api/monitoring/metrics`

Retrieve real-time system performance metrics.

**Query Parameters:**
- `timeRange`: Time range for metrics (`15m`, `1h`, `4h`, `24h`)

**Response:**
```json
{
  "activeChats": 25,
  "queueLength": 3,
  "averageResponseTime": 45,
  "totalAgents": 10,
  "onlineAgents": 8,
  "resolvedToday": 127,
  "abandonedToday": 8,
  "satisfactionScore": 92.5
}
```

### Agent Monitoring
**GET** `/api/monitoring/agents`

Retrieve detailed agent performance metrics.

**Response:**
```json
{
  "agents": [
    {
      "agent_id": "agent_id",
      "name": "Agent Name",
      "status": "online",
      "active_chats": 3,
      "resolved_today": 15,
      "average_response_time": 45,
      "satisfaction_score": 92.5,
      "availability_percentage": 95.2
    }
  ]
}
```

## Surveys

### Survey Templates
**GET** `/api/surveys/templates`

Retrieve available survey templates.

**Response:**
```json
{
  "templates": [
    {
      "id": "template_id",
      "name": "Customer Satisfaction Survey",
      "description": "Post-chat customer satisfaction survey",
      "questions": [
        {
          "id": "q1",
          "type": "rating",
          "question": "How satisfied are you with our service?",
          "required": true
        }
      ]
    }
  ]
}
```

### Create Survey Response
**POST** `/api/surveys/responses`

Submit a survey response.

**Request Body:**
```json
{
  "template_id": "template_id",
  "conversation_id": "conv_id",
  "responses": {
    "q1": 5,
    "q2": "Great service!"
  }
}
```

**Response:**
```json
{
  "success": true,
  "response_id": "response_id"
}
```

## Analytics

### Customer Service Export
**GET** `/api/analytics/customer-service/export`

Export customer service analytics data.

**Query Parameters:**
- `startDate`: Start date (ISO 8601 format)
- `endDate`: End date (ISO 8601 format)
- `format`: Export format (`csv`, `json`)

**Response:**
```json
{
  "export_id": "export_id",
  "status": "processing",
  "download_url": "https://api.prismai.com/exports/export_id"
}
```

## Error Codes

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Internal Server Error |

### Application Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Authentication failed |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `INTERNAL_ERROR` | Internal server error |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

## Webhooks

### Webhook Configuration
**POST** `/api/webhooks`

Configure webhook endpoints for event notifications.

**Request Body:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["chat.completed", "agent.assigned"],
  "secret": "webhook_secret"
}
```

**Supported Events:**
- `chat.started` - New chat conversation started
- `chat.completed` - Chat conversation completed
- `agent.assigned` - Agent assigned to conversation
- `survey.submitted` - Customer survey submitted
- `knowledge.updated` - Knowledge base updated

### Webhook Payload
```json
{
  "event": "chat.completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "conversation_id": "conv_id",
    "duration": 300,
    "satisfaction_score": 5
  }
}
```

## SDK and Libraries

### JavaScript SDK
```javascript
import { PrismAI } from '@prismai/sdk'

const client = new PrismAI({
  apiKey: 'your_api_key',
  baseURL: 'https://api.prismai.com'
})

// Create a chat completion
const response = await client.chat.create({
  messages: [
    { role: 'user', content: 'Hello!' }
  ]
})
```

### Python SDK
```python
from prismai import Client

client = Client(api_key='your_api_key')

# Get agent metrics
metrics = client.agents.get_metrics(time_range='1h')
print(metrics)
```

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

### Version 1.5.0
- Added knowledge base management
- Enhanced authentication with MFA
- Improved rate limiting
- Added survey functionality

This API reference provides comprehensive documentation for all PrismAI platform endpoints and features.