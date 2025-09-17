# PrismAI Rebranding - Detailed File Checklist

## Critical Priority Files (Must Update First)

### 1. Project Metadata & Configuration

#### `package.json`
**Current**: `"name": "my-v0-project"`
**Change to**: `"name": "prismai-platform"`
**Additional changes**:
```json
{
  "name": "prismai-platform",
  "description": "PrismAI - Intelligent Business Automation Platform",
  "keywords": [
    "prismai",
    "ai automation", 
    "business intelligence",
    "customer service ai",
    "lead generation",
    "saas platform"
  ]
}
```

#### `README.md`
**Current**: "AI Receptionist - Production-Ready SaaS Platform"
**Change to**: "PrismAI - Intelligent Business Automation Platform"
**Key sections to update**:
- Title and badges
- Overview section
- Feature descriptions
- Installation instructions
- All references to "AI Receptionist" → "PrismAI"
- GitHub clone URL references
- Support email addresses

### 2. Application Core Files

#### `app/layout.tsx`
**Lines to update**: 14-40
**Current metadata**:
```typescript
title: "AI Receptionist - Never Miss a Call Again"
description: "Transform your business with an AI receptionist..."
```
**Change to**:
```typescript
title: "PrismAI - Intelligent Business Automation"
description: "Transform your business with PrismAI's comprehensive AI automation platform. Intelligent customer service, lead generation, and business insights."
keywords: [
  "PrismAI",
  "AI automation",
  "business intelligence", 
  "customer service AI",
  "lead generation",
  "business automation"
]
authors: [{ name: "PrismAI Team" }]
openGraph: {
  title: "PrismAI - Intelligent Business Automation",
  description: "Transform your business with PrismAI's comprehensive AI automation platform."
}
twitter: {
  title: "PrismAI - Intelligent Business Automation",
  description: "Transform your business with PrismAI's comprehensive AI automation platform."
}
```

#### `app/page.tsx`
**Extensive changes needed** (Lines 1-1245):
- Line 46: `<span className="text-xl font-bold text-foreground">PrismAI</span>`
- Line 95-100: Update hero headline to "Exclusively Crafted **PrismAI Platform** for Elite Businesses"
- Line 104-106: Update subheadline to mention PrismAI
- Line 109-111: Update supporting text
- Line 1105: Update footer branding to "PrismAI"
- Line 1228: Update copyright to "© 2025 PrismAI. All rights reserved."
- All instances of "AI Receptionist" → "PrismAI"
- All instances of "AI Business Suite" → "PrismAI Platform"

### 3. Dashboard & Navigation

#### `components/dashboard/dashboard-nav.tsx`
**Line 57**: 
**Current**: `<span className="ml-2 text-lg font-bold">AI Business Suite</span>`
**Change to**: `<span className="ml-2 text-lg font-bold">PrismAI</span>`

### 4. Documentation Files

#### `docs/PRD_AI_BUSINESS_SUITE.md`
**Action**: Rename file to `docs/PRD_PRISMAI_PLATFORM.md`
**Content changes**:
- Line 2: "# PrismAI Platform - Comprehensive SaaS Platform"
- Line 16: Update product vision to mention PrismAI
- Line 19: Update mission statement
- Line 66: Update product ecosystem diagram
- All references throughout document

#### `DEPLOYMENT.md`
**Line 1**: "# PrismAI Production Deployment Guide"
**Throughout**: Replace "AI Receptionist" with "PrismAI"

#### `production-checklist.md`
**Line 1**: "# PrismAI - Production Readiness Checklist"

## High Priority Files

### Environment Configuration

#### `.env.example`
**Line 1**: `# Environment Configuration for PrismAI Platform`
**Add new variables**:
```bash
# Brand Configuration
NEXT_PUBLIC_BRAND_NAME=PrismAI
NEXT_PUBLIC_BRAND_TAGLINE="Intelligent Business Automation"
NEXT_PUBLIC_SUPPORT_EMAIL=support@prismai.com
NEXT_PUBLIC_COMPANY_NAME="PrismAI Inc."
```

### Dashboard Pages

#### `app/dashboard/live-chat/page.tsx`
**Line 342**: `<h1 className="text-3xl font-bold mb-2">PrismAI Live Chat</h1>`
**Line 343**: Update description to mention PrismAI

#### `app/dashboard/knowledge-base/page.tsx`
**Update**: Page title and descriptions to reference PrismAI

#### `app/dashboard/analytics/customer-service/page.tsx`
**Update**: Branding references throughout

### API Routes

#### `app/api/live-chat/agents/route.ts`
**Lines 14-44**: Update mock agent data comments to reference PrismAI system

#### All API routes in `app/api/`
**Update**: Error messages and response metadata to reference PrismAI

### Authentication Pages

#### `app/auth/login/page.tsx`
**Update**: Page branding and welcome messages

#### `app/auth/sign-up/page.tsx`
**Update**: Registration flow branding

## Medium Priority Files

### Database Schema Files

#### `scripts/002_ai_suite_schema.sql`
**Line 1**: `-- Extended database schema for PrismAI Platform`
**Lines 305-314**: Update subscription plan descriptions:
```sql
INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, features, limits) VALUES
('PrismAI Starter', 'Perfect for small businesses getting started with AI automation', 99.00, 990.00, 
 '["PrismAI Assistant", "Basic Chatbot", "Lead Capture Forms", "Email Automation"]',
 '{"contacts": 1000, "emails_per_month": 5000, "chatbot_messages": 2000}'),
('PrismAI Professional', 'Advanced AI tools for growing businesses', 299.00, 2990.00,
 '["Everything in Starter", "Advanced Lead Generation", "Social Media Automation", "Analytics Dashboard", "CRM Integration"]',
 '{"contacts": 10000, "emails_per_month": 25000, "chatbot_messages": 10000, "social_posts": 200}'),
('PrismAI Enterprise', 'Full AI suite for scaling businesses', 799.00, 7990.00,
 '["Everything in Professional", "Custom AI Training", "Advanced Analytics", "Priority Support", "White-label Options"]',
 '{"contacts": -1, "emails_per_month": -1, "chatbot_messages": -1, "social_posts": -1}')
```

### Configuration Files

#### `next.config.mjs`
**No direct branding changes needed**, but comments could reference PrismAI

### Library Files

#### `lib/env.ts`
**Comments and error messages**: Update to reference PrismAI

#### `lib/ai/gemini-client.ts`
**Comments**: Update system references to PrismAI

### Communication Files

#### `lib/twilio/whatsapp-client.ts`
**System messages**: Update any hardcoded messages to reference PrismAI

#### `lib/twilio/sms-client.ts`
**System messages**: Update any hardcoded messages to reference PrismAI

## Low Priority Files

### Test Files
#### `__tests__/` directory
**Update**: Test descriptions and mock data to reference PrismAI

### Asset Files
#### `public/` directory
**Update**: 
- Favicon and app icons
- Placeholder images
- Any branded assets

### Development Files
#### Various configuration and development files
**Update**: Comments and internal references

## Database Migration Script

Create `scripts/015_rebrand_to_prismai.sql`:

```sql
-- PrismAI Rebranding Database Migration
-- Run this after all code changes are deployed

-- Update subscription plans
UPDATE public.subscription_plans 
SET 
  name = CASE 
    WHEN name = 'Essential' THEN 'PrismAI Starter'
    WHEN name = 'Growth' THEN 'PrismAI Professional' 
    WHEN name = 'Enterprise' THEN 'PrismAI Enterprise'
    ELSE name 
  END,
  description = REPLACE(REPLACE(description, 'AI Business Suite', 'PrismAI Platform'), 'AI Receptionist', 'PrismAI Assistant');

-- Update knowledge base content
UPDATE public.knowledge_base 
SET 
  title = REPLACE(REPLACE(title, 'AI Business Suite', 'PrismAI Platform'), 'AI Receptionist', 'PrismAI Assistant'),
  content = REPLACE(REPLACE(content, 'AI Business Suite', 'PrismAI Platform'), 'AI Receptionist', 'PrismAI Assistant');

-- Update email campaign content
UPDATE public.email_campaigns 
SET 
  name = REPLACE(REPLACE(name, 'AI Business Suite', 'PrismAI Platform'), 'AI Receptionist', 'PrismAI Assistant'),
  subject = REPLACE(REPLACE(subject, 'AI Business Suite', 'PrismAI Platform'), 'AI Receptionist', 'PrismAI Assistant'),
  content = REPLACE(REPLACE(content, 'AI Business Suite', 'PrismAI Platform'), 'AI Receptionist', 'PrismAI Assistant');

-- Update automation workflow names
UPDATE public.automation_workflows 
SET 
  name = REPLACE(REPLACE(name, 'AI Business Suite', 'PrismAI Platform'), 'AI Receptionist', 'PrismAI Assistant'),
  description = REPLACE(REPLACE(description, 'AI Business Suite', 'PrismAI Platform'), 'AI Receptionist', 'PrismAI Assistant');

-- Update chat messages (system messages only)
UPDATE public.chat_messages 
SET content = REPLACE(REPLACE(content, 'AI Business Suite', 'PrismAI Platform'), 'AI Receptionist', 'PrismAI Assistant')
WHERE sender_type = 'ai';
```

## Implementation Order

### Phase 1: Core Infrastructure (2-3 hours)
1. `package.json`
2. `README.md`
3. `app/layout.tsx`
4. `components/dashboard/dashboard-nav.tsx`
5. `.env.example`

### Phase 2: User Interface (3-4 hours)
1. `app/page.tsx` (homepage)
2. All dashboard pages
3. Authentication pages
4. Error pages

### Phase 3: Backend & Data (2-3 hours)
1. API routes and responses
2. Database migration script
3. Environment configuration
4. Documentation files

### Phase 4: Assets & Polish (1-2 hours)
1. Update assets and images
2. Test all user flows
3. Verify branding consistency
4. Update any missed references

## Validation Checklist

After each phase, verify:
- [ ] Application builds successfully
- [ ] No broken links or references
- [ ] All user flows work correctly
- [ ] Branding is consistent across all touchpoints
- [ ] No old brand references remain
- [ ] Database queries work correctly
- [ ] API responses are properly branded

## Rollback Plan

If issues arise:
1. **Code Changes**: Use git to revert to previous commit
2. **Database Changes**: Run reverse migration script
3. **Environment Variables**: Restore previous values
4. **Assets**: Replace with original files

Keep backup of all original files and database state before starting rebranding process.

---

**Total Estimated Time**: 8-12 hours
**Recommended Team Size**: 1-2 developers
**Testing Time**: Additional 2-3 hours
**Documentation Time**: Additional 1-2 hours