#!/bin/bash

# AI Business Suite API Testing Script
# Make sure your server is running at http://localhost:3001

BASE_URL="http://localhost:3001"

echo "🚀 Testing AI Business Suite APIs..."
echo "======================================"

# Test 1: Health Check
echo "1. Testing Health Check..."
curl -s "$BASE_URL/api/health" | jq '.' 2>/dev/null || curl -s "$BASE_URL/api/health"

echo -e "\n\n2. Testing Lead Generation..."
curl -X POST "$BASE_URL/api/ai/leads" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@company.com",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Tech Innovations Inc",
    "jobTitle": "CEO",
    "source": "website"
  }' | jq '.' 2>/dev/null || echo "Response received"

echo -e "\n\n3. Testing Chatbot..."
curl -X POST "$BASE_URL/api/ai/chatbot" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, I need help with your services",
    "channel": "website",
    "customerIdentifier": "test-user-123"
  }' | jq '.' 2>/dev/null || echo "Response received"

echo -e "\n\n4. Testing Marketing Automation..."
curl -X POST "$BASE_URL/api/ai/marketing" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Campaign",
    "campaignType": "welcome",
    "targetAudience": {
      "segments": ["new_users"]
    }
  }' | jq '.' 2>/dev/null || echo "Response received"

echo -e "\n\n5. Testing Analytics..."
curl -s "$BASE_URL/api/ai/analytics?timeframe=30d&insights=true" | jq '.' 2>/dev/null || curl -s "$BASE_URL/api/ai/analytics?timeframe=30d&insights=true"

echo -e "\n\n6. Testing AI Suite Orchestrator..."
curl -X GET "$BASE_URL/api/ai/suite" | jq '.' 2>/dev/null || curl -s "$BASE_URL/api/ai/suite"

echo -e "\n\n✅ API Testing Complete!"
echo "Note: Some endpoints require authentication. Sign up at http://localhost:3001/auth/sign-up first."