# PrismAI AI-Contextualized Technical Overview

This document is the single source of truth for AI systems to understand, analyze, modify, and extend the PrismAI platform. It encodes architecture, dependencies, flows, constraints, and non-obvious implementation details in a form optimized for machine consumption.

---

## 1. Repository & Architecture Overview

PrismAI is a production-grade, multi-tenant SaaS platform built on:

- Next.js 15 (App Router), React 18, TypeScript
- Supabase (Postgres + Auth + Storage) with extensive SQL schema
- pgvector for semantic search
- External AI services:
  - Google Gemini (LLM + embeddings)
  - VAPI (voice pipeline)
  - ElevenLabs (TTS)
- Telephony/messaging and notifications:
  - Twilio, email (Resend/SMTP), WhatsApp, SMS
- Vercel-oriented deployment with Docker / k8s options
- Comprehensive monitoring, RLS, security, and compliance features

High-level flow:

- Frontend (Next.js) → API Routes (app/api/**) → Supabase / external AI / integrations
- Middleware for security, rate limiting, headers, tenant isolation
- Database schema provides:
  - Multi-tenancy (tenants, tenant_users, RLS)
  - Omnichannel conversations (chat, voice, SMS, WhatsApp)
  - Knowledge base + vector search
  - Lead gen, marketing, surveys, QA, agent metrics
  - Logging, compliance, performance, GDPR/rls

---

## 2. File Tree & Module Topology (High-Level)

Note: Only key structures relevant for AI reasoning and modification are listed.

- [`package.json`](package.json:1)
  - Defines Next.js app, scripts, and dependencies.

- [`next.config.mjs`](next.config.mjs:1)
  - Next.js configuration; build tolerates lint/TS errors; dev server uses custom port config object (non-standard).

- `app/`
  - Next.js App Router entrypoints (pages, layouts, API routes).
  - `app/api/**`:
    - Route handlers for:
      - Knowledge base import and search.
      - Monitoring: `/monitoring/metrics`, `/monitoring/agents`.
      - Analytics export.
      - Surveys: templates & instances.
      - Agents: metrics, goals.
      - Quality: criteria, reviews.
      - Files: upload/listing.
    - Handlers interact with Supabase and domain libs.

- `components/`
  - Reusable UI, based on shadcn/Radix and custom components.
  - `components/ui/**`: inputs, dialogs, table, sidebar, etc.
  - `components/ui/file-preview.tsx`: secure preview of uploaded files.

- `hooks/`
  - `use-ai-assistant.ts`, `use-conversation.ts`: coordinate frontend with AI APIs.
  - `use-toast.ts`, `use-mobile.ts`: UI utilities.

- `lib/`
  - Core runtime logic, organized by concern. Key areas:
  - `lib/env.ts`:
    - Zod-validated environment schema with strict runtime validation.
  - `lib/logger.ts`:
    - Structured logging, security/performance helpers.
  - `lib/errors.ts`:
    - Centralized error utilities (not fully shown here; assume usage).
  - `lib/security.ts`, `lib/security/**`:
    - Access control, DB security manager, etc.
  - `lib/rate-limit/**`:
    - Multi-strategy rate limiting and abuse detection.
  - `lib/monitoring/**`:
    - Performance monitor, alerting, metrics, log aggregation.
  - `lib/personalization/**`, `lib/predictive-scoring/**`, `lib/lead-routing/**`:
    - Lead/engagement routing algorithms, predictive scoring.
  - `lib/phi/**`:
    - Content safety/sanitization.
  - `lib/ai/gemini-client.ts`:
    - Gemini client wrapper; embeddings + chat.
  - `lib/integrations/**`:
    - CRM and external tool connectors (e.g., Salesforce).
  - `lib/auth/**`:
    - MFA, RBAC, password policy, sessions, enterprise security.

- `middleware.ts`, `middleware.developer-portal.ts`
  - Request filtering, security headers, rate limiting.

- `scripts/`
  - SQL schema and migrations:
    - `000_complete_production_schema.sql` and related scripts:
      - Full normalized schema for conversations, leads, KB, analytics, compliance, multi-tenant, RLS, indexes, vector search.
    - Topic-specific SQL files (vector search, multi-channel, AI features, etc.).
  - `backup-scheduler.js` and other ops scripts.

- `deployment/`
  - `environments/*.env`: baseline env templates.
  - `monitoring/*.yml`: Prometheus and alerting configs.
  - Deployment scripts (`deploy-production.sh`, `env-manager.js`).

- `docs/`
  - Business/product specs, advanced-features guide, configuration manual, monitoring & deployment guides, security/troubleshooting docs.

- `ml_service/`
  - Python-based ML service scaffold (separate service assumptions).

- `styles/`
  - Tailwind / global CSS.

---

## 3. Environment & Configuration (For AI Agents)

Source of truth: [`lib/env.ts`](lib/env.ts:1) plus docs/configuration-manual.md.

Validation model:

- `publicEnvSchema`:
  - `NODE_ENV`: 'development' | 'production' | 'test' (default 'development')
  - `NEXT_PUBLIC_APP_URL`: required URL
  - `NEXT_PUBLIC_SUPABASE_URL`: required URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: required
  - `VERCEL_ANALYTICS_ID?`, `SENTRY_DSN?`
  - `LOG_LEVEL`: 'error' | 'warn' | 'info' | 'debug' (default 'info')
  - `ENABLE_REQUEST_LOGGING`: boolean (default false)

- `serverEnvSchema` extends public with:
  - `SUPABASE_SERVICE_ROLE_KEY`: required
  - `GEMINI_API_KEY`, `VAPI_API_KEY`: required
  - Optional: `RESEND_API_KEY`, SMTP fields, Redis URLs/tokens, `JWT_SECRET`, `ENCRYPTION_KEY`, `WEBHOOK_SECRET`, `DATABASE_CONNECTION_LIMIT`, `HEALTH_CHECK_TOKEN`.

Runtime behavior:

- Validation occurs at module load; on failure (non-test) it throws and prevents app boot.
- In tests, a fully-populated default env is synthesized.

Feature flags (derived):

- `features.analytics`: enabled if `VERCEL_ANALYTICS_ID`.
- `features.monitoring`: enabled if `SENTRY_DSN`.
- `features.email`: enabled if Resend or SMTP configured.
- `features.caching`: if Redis/Upstash configured.
- `features.webhooks`: if `WEBHOOK_SECRET`.

AI agents MUST:

- Assume environment validation is strict: missing values = runtime crash.
- Use [`requireEnv()`](lib/env.ts:124) / [`getEnv()`](lib/env.ts:132) helpers rather than raw `process.env` whenever inside server code for consistency.

---

## 4. API Surface & Endpoint Semantics

Note: Some routes are inferred from docs and file names; consult actual `app/api/**` files when editing.

Core patterns:

- Next.js route handlers under `app/api/**/route.ts`.
- Typical handler shape:
  - Validate method.
  - AuthN/AuthZ via Supabase JWT / RLS.
  - Use domain libs for business logic.
  - Return typed JSON with standardized errors.

Representative endpoint categories:

1. Monitoring & Health

- `GET /api/monitoring/metrics`
  - Returns system, app, DB metrics (see docs/monitoring-guide.md example).
  - Backed by `lib/monitoring/performance-monitor.ts` style utilities.
- `GET /api/monitoring/agents`
  - Aggregated agent availability/performance.
- `GET /api/v1/health`
  - Global health check: app, DB, Redis, AI, external APIs.

2. Files & Knowledge Base

- `POST /api/files/upload`
  - Handles secure uploads (validate type, size; see `lib/secure-file-upload.ts`, `components/ui/file-preview.tsx`).
- `GET /api/files`
  - Lists files with tenant scoping.
- `POST /api/knowledge-base/import`
  - Ingests documents, computes embeddings via Gemini, stores into `knowledge_base` with `embedding` for pgvector search.
- `rpc('search_knowledge_base_vector')` (Postgres function)
  - Called from vector search services to perform similarity search.

3. Surveys & Quality

- `/api/surveys/templates` (CRUD for `survey_templates`)
- `/api/surveys/templates/[id]`
- `/api/quality/criteria`
- `/api/quality/reviews`
- Implement survey triggers and QA workflows using DB tables:
  - `survey_templates`, `customer_surveys`, `survey_responses`
  - `quality_criteria`, `quality_reviews` (from SQL scripts and docs).

4. Agents & Performance

- `/api/agents/metrics`
- `/api/agents/goals`
- Interact with `agent_profiles`, `agent_performance_metrics`, `agent_goals`.

5. Analytics & Export

- `/api/analytics/customer-service/export`
  - Exports conversation/metric datasets, leveraging `business_metrics`, `chat_conversations`, `chat_messages`.

Authentication & Authorization:

- Auth is via Supabase `auth.users` and JWT; multi-tenancy via:
  - `tenants`, `tenant_users`, `tenant_id` column on core tables.
  - RLS policies enforce `tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())`.
- Many tables enforce RLS; all queries MUST include tenant context or rely on Supabase RLS.

Error handling:

- Consistent pattern: safe parsing (Zod), structured JSON errors, logging via `lib/logger.ts`.
- For AI agents editing code: maintain this consistency; ensure non-200 responses use JSON with `error`/`message` fields where patterns exist.

Rate limiting & security middleware:

- `middleware.ts` applies:
  - Security headers.
  - Rate limiting on `/api/**` (via `lib/rate-limit/**`).
- External Express-style rate-limiter (`express-rate-limit`) used in some server utilities; align with existing config.

---

## 5. Database & Data Model (Critical for AI Agents)

Primary reference: [`scripts/000_complete_production_schema.sql`](scripts/000_complete_production_schema.sql:1)

Key concepts:

1. Multi-tenancy

- `tenants`: organizations.
- `tenant_users`: link users ↔ tenants with role.
- Most business tables have `tenant_id` + strict RLS.
- Auto-provisioning trigger:
  - `handle_new_user()` (on `auth.users` insert)
    - Creates tenant, tenant_user, profile, ai_config.

2. Core Entities

- `profiles`: user/business profile; references `auth.users`.
- `ai_configs`: assistant configuration per tenant/user.
- `call_logs`, `bookings`: telephony & appointment data.
- `lead_sources`, `leads`, `lead_activities`: lead generation and attribution.

3. Conversations & Messaging

- `chat_conversations`:
  - `channel` (web, whatsapp, sms, etc.)
  - `modality` (voice/text/mixed)
  - AI metrics: sentiment_score, urgency_level, escalations, etc.
- `chat_messages`:
  - `sender_type` (customer/ai/agent)
  - enrichment: language detection, sentiment, etc.
- `conversation_summaries`, `escalation_rules`, `escalation_logs`:
  - AI-driven escalations, auto-summaries.

4. Knowledge Base & Vector Search

- `knowledge_base`:
  - `search_vector` (tsvector), `embedding vector(768)`
  - `search_knowledge_base_vector()`:
    - Returns top matches with similarity threshold.
- `idx_knowledge_base_embedding` ivfflat index for vector search.

5. Marketing & Automation

- `email_campaigns`, `social_posts`, `automation_workflows`
- `analytics_events`, `business_metrics`
  - Support analytics dashboards and automation triggers.

6. Enterprise Customer Service

- `survey_templates`, `customer_surveys`, `survey_responses`
- `agent_profiles`, `agent_performance_metrics`, `agent_goals`
- `quality_criteria`, `quality_reviews`, calibration tooling (via docs).

7. Compliance & Logging

- GDPR / SCC / TIA / data residency:
  - `scc_templates`, `scc_applications`, `transfer_impact_assessments`, etc.
- Logging/audit:
  - `transfer_audit_logs`, security events, `performance_metrics`.
- RLS is widely used to enforce tenant isolation and principle of least privilege.

8. Indexing & Performance

- Extensive indexes across leads, conversations, KB, metrics.
- Materialized views:
  - `mv_tenant_daily_analytics`, `mv_tenant_daily_metrics`, `mv_tenant_performance_summary`.
- Cache metadata & connection pool stats tables to support intelligent performance tuning.

AI agents modifying schema MUST:

- Preserve RLS policies and multi-tenant invariants.
- Keep `tenant_id` consistent and indexed on new tenant-scoped tables.
- Ensure new relationships respect existing foreign key patterns.

---

## 6. Dependency Graph & Integrations

Key internal dependencies (conceptual):

- API routes depend on:
  - `lib/env.ts` for configuration.
  - `lib/security.*`, `lib/auth/*` for auth, RBAC, sessions.
  - `lib/monitoring/*` for metrics and logs.
  - `lib/ai/*` for AI calls (Gemini, etc.).
  - `lib/rate-limit/*` for throttling.
  - Supabase client initialization (not fully shown; assumed present).

- `lib/ai/gemini-client.ts`
  - Depends on `GEMINI_API_KEY`.
  - Provides:
    - Chat completions.
    - Embeddings (`text-embedding-004`) used by vector search.

- Vector Search:
  - `lib/ai/gemini-client.ts` → embeddings → `knowledge_base.embedding` → SQL fn `search_knowledge_base_vector`.

- External services:
  - Gemini: LLM + embeddings, used for:
    - Conversation analysis.
    - KB embeddings.
    - Insights and predictive models (per advanced-features guide).
  - VAPI + ElevenLabs:
    - Telephony pipeline (initiate calls, stream audio, TTS).
  - Twilio:
    - SMS and WhatsApp connectors.
  - Analytics/log services:
    - Generic `LOG_SERVICE_URL`, etc. for streaming metrics and logs.

Data flow between modules:

- Requests → middleware (security/limits) → handlers →:
  - Supabase (RLS enforced) for persistent data.
  - AI services for enrichment (sentiment, topics, routing).
  - Monitoring and logging libs record metrics/logs.
- Background jobs (implied via SQL triggers and scripts) update:
  - Aggregations, materialized views, usage metrics.
  - Conversation summaries and escalation logs.

---

## 7. Core Data Flows (Text Diagrams)

1. Authentication / Tenant Provisioning

- New auth user created in Supabase:
  - Trigger `handle_new_user()`:
    - Create `tenant`.
    - Add `tenant_user` with role `owner`.
    - Create `profiles` row.
    - Create `ai_configs` with defaults.
- API access:
  - JWT from Supabase → Next.js route.
  - RLS ensures only rows with matching tenant_id are visible.

2. AI Conversation Flow (Chat & Voice)

- User/customer message or call:
  - Inbound via webchat / WhatsApp / SMS / VAPI webhook.
  - Normalized into `chat_messages` + `chat_conversations`.
- AI processing:
  - Use Gemini for:
    - Response generation.
    - Sentiment and topic extraction.
  - Use ElevenLabs (if configured) for TTS in voice paths.
- Routing:
  - Use escalation rules & sentiment to:
    - Escalate to agent.
    - Update `escalation_logs`, `conversation_summaries`.
- Analytics:
  - Metrics persisted (surveys, QA, agent performance, business metrics).

3. Knowledge Base & Vector Search

- Admin imports content via `/api/knowledge-base/import`:
  - Generate embedding with Gemini.
  - Insert into `knowledge_base` with `embedding`.
- Query:
  - User query → embed → call `search_knowledge_base_vector` → ranked docs.
  - Response used in chat/voice flows.

4. File Upload & Processing

- `/api/files/upload`:
  - Validate file size/type.
  - Store (likely Supabase storage or local, based on config).
  - Record metadata in a tenant-scoped table.
- `components/ui/file-preview.tsx`:
  - Securely renders previews without executing arbitrary content.

5. Monitoring & Alerting

- Performance & business events:
  - Logged via `lib/logger.ts` and `lib/monitoring/*`.
- `/api/monitoring/metrics`:
  - Exposes aggregated metrics for dashboards.
- Alerting:
  - Rules in `lib/monitoring/alerting-system.ts`
  - Channels: email, Slack, SMS, WhatsApp, webhooks.

---

## 8. Error Handling, Logging, and Security Patterns

Error handling:

- Centralized helpers in `lib/errors.ts` (and patterns in docs):
  - Use domain-specific error types when throwing from libs.
  - API handlers typically:
    - Catch errors.
    - Log via `Logger.error`.
    - Return structured JSON (`{ error: string, details? }`) with appropriate status.

Logging & monitoring:

- `lib/logger.ts`:
  - Structured logs with correlation IDs, user/session/request metadata.
  - Sends to external log service if configured.
  - Dev mode: logs to console.

Security:

- Extensive RLS in SQL:
  - All tenant data restricted to `tenant_users`.
- `middleware.ts`:
  - Security headers; rate limiting on `/api`.
- `lib/security/*`:
  - Access control enforcement.
- `lib/auth/*`:
  - MFA, strong password policies, robust session management.
- File uploads:
  - Content-type allowlists; best-effort hardening in `lib/secure-file-upload.ts`.
- Compliance managers (HIPAA/GDPR/SOC2) encapsulate:
  - PHI handling, data subject requests, logging, breach flows.

AI agents MUST:

- Preserve RLS when altering queries.
- Preserve or extend security headers when editing middleware.
- Never bypass `lib/env.ts` validation for new sensitive configs; integrate into schema.

---

## 9. AI & Algorithmic Implementations

Key algorithmic domains (see docs/advanced-features-guide.md):

1. Gemini Integration (lib/ai/gemini-client.ts)

- Provides:
  - `createChatCompletion` / chat-style APIs for:
    - Assistant responses.
    - Conversation intelligence.
  - `createEmbedding`:
    - Uses `text-embedding-004` for KB and search.
  - `analyzeTranscript`:
    - Returns:
      - `sentimentScore`
      - booking intent
      - topics, etc.

2. Voice & TTS (VAPI, ElevenLabs)

- `VAPIClient`:
  - Initiate calls with config:
    - System prompt, voice model, recording options.
  - Stream audio; integrate with transcription + Gemini analysis.
- `ElevenLabsClient`:
  - High-quality TTS; supports cloning voices & controlling stability, similarity, style.

3. Vector Search with pgvector

- SQL:
  - `search_knowledge_base_vector(query_embedding, match_threshold, match_count)`
  - Computes `similarity = 1 - (embedding <=> query_embedding)`.
- Algorithmic notes:
  - Uses `ivfflat` index with `vector_cosine_ops`.
  - Filters by `is_published` and `similarity > threshold`.

4. Lead Scoring & Predictive Analytics

- `lib/predictive-scoring/*` and predictive examples in docs:
  - Features assembled from lead activity, engagement, and metadata.
  - ML model (external or `ml_service`) used for:
    - Lead score.
    - Confidence.
    - Explanation factors.

5. Intelligent Routing & Escalation

- `lib/lead-routing/*`:
  - Prioritize leads based on score, channel, SLA.
- `escalation_rules` + triggers:
  - Automatically escalate based on:
    - Sentiment trend.
    - Urgency.
    - Keywords/timeouts.
- `QualityReviewWorkflow`:
  - Auto-samples conversations for QA.

6. Conversation Intelligence

- `ConversationInsightsAnalyzer`, `PredictiveAnalyticsEngine`:
  - Patterns, satisfaction drivers, revenue opportunities.
- Data sources:
  - Conversations, surveys, metrics & logs.

---

## 10. Technology Stack & Tooling Reference

Defined in [`package.json`](package.json:1):

- Runtime:
  - Node.js 18+ (assumed), Next.js `^15.5.4`, React 18, TypeScript ^5.
- UI:
  - Tailwind CSS 3.4, Radix UI, shadcn patterns, lucide-react.
- Data & backend:
  - `@supabase/supabase-js`, `@supabase/ssr`
  - pgvector, Postgres, RLS.
- AI:
  - `@google-cloud/translate` (optional)
  - Custom Gemini/VAPI/ElevenLabs clients (in `lib/ai/**`; some referenced in docs).
- Communication:
  - `twilio`, email libraries, webhooks.
- Security & rate limiting:
  - `helmet`, `express-rate-limit`, custom rate-limit strategies.
- Docs & API:
  - `next-swagger-doc`, `swagger-jsdoc`, `swagger-ui-react`.
- Testing:
  - Jest, Testing Library, Playwright.
- Build:
  - Next CLI, Tailwind, PostCSS, bundle analyzer tools.

Scripts (only non-obvious aspects relevant to AI):

- `"build:vercel"` includes `typecheck` and `lint` before build.
- `"deploy:*"` scripts wrap Vercel CLI with pre-build verification.
- Tolerant CI:
  - `ignoreDuringBuilds` and `ignoreBuildErrors` mean type/lint issues won’t block out-of-the-box builds; agents should still fix them.

---

## 11. Implementation Rules & Gotchas for AI Systems

When generating or modifying code:

1. Respect env validation:
   - Add new required env vars ONLY via `lib/env.ts` schemas.
   - Avoid direct `process.env` reads in shared libraries; use exported helpers.

2. Maintain multi-tenant & RLS guarantees:
   - All new tenant data tables must include `tenant_id` and RLS.
   - Queries must be written so Supabase RLS can enforce isolation (no bypass via service role unless explicitly justified).

3. Use centralized utilities:
   - Logging via `lib/logger.ts`.
   - Security helpers in `lib/security/**`.
   - Rate limiting in `lib/rate-limit/**`.
   - File security in `lib/secure-file-upload.ts`.
   - Don’t duplicate ad-hoc implementations.

4. Preserve monitoring hooks:
   - When touching API routes, keep or extend calls to performance/monitoring libs so dashboards remain accurate.

5. Follow typed contracts:
   - Exported types/interfaces from `lib/**` and integration modules are the source of truth for API shapes.
   - Route handlers should align their input/output with these types and with SQL schema.

6. AI integrations:
   - Use centralized clients (`GeminiClient`, `VAPIClient`, etc.) instead of embedding raw HTTP logic.

7. Avoid weakening security/compliance:
   - Do not remove RLS, audit logging, encryption hooks, or security headers.
   - Ensure new flows log security events when accessing sensitive data.

8. Performance:
   - Favor set-based DB operations and existing indexed columns.
   - Leverage materialized views where present; avoid heavy aggregations in request handlers.

---

## 12. How To Extend PrismAI Safely (For AI Agents)

When implementing new features:

1. Identify relevant domain:
   - Conversations, KB, leads, surveys, etc.
2. Add/extend:
   - Types in `lib/**`.
   - DB schema via new `scripts/0xx_*.sql` (maintain idempotency, indexes, RLS).
3. Wire endpoints:
   - Add Next.js route in `app/api/.../route.ts`.
   - Use env helpers, security, logging, and Supabase client.
4. Integrate AI:
   - Via `lib/ai/gemini-client.ts` (embeddings/chat).
   - Keep models, thresholds, tokens configurable via env.
5. Document:
   - Update relevant docs in `docs/` only with non-ambiguous, implementation-consistent details.

This overview is designed so that another AI system, given this file plus the codebase, can reconstruct the full architecture, understand critical invariants, and perform safe, aligned modifications without human-in-the-loop clarification.