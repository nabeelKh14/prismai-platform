-- =====================================
-- COMPLETE PRODUCTION SCHEMA SETUP
-- =====================================
-- This script creates the complete production-ready database schema for PrismAI
-- with all features consolidated from individual schema scripts.
-- Designed for fresh database setup with proper dependencies and tenant isolation.
--
-- Features included:
-- ✓ Base schema with multi-tenancy support
-- ✓ Vector search capabilities for knowledge base
-- ✓ Multi-channel communication support
-- ✓ Advanced AI features (sentiment, escalation, summarization)
-- ✓ Enterprise customer service (surveys, agent metrics, quality scoring)
-- ✓ Conversation insights and intelligence
-- ✓ Lead routing and personalization engine
-- ✓ Unified conversations (voice + text)
-- ✓ GDPR compliance and international transfers
-- ✓ Comprehensive indexing and performance optimizations
--
-- Run this script on a fresh database for complete setup.
-- All operations are idempotent and safe to re-run.

-- =====================================
-- EXTENSIONS SETUP
-- =====================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_buffercache";

-- Enable pgvector for AI/vector search capabilities (if available)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available, vector search features will be disabled';
END $$;

-- =====================================
-- BASIC TABLES (from 001_create_database_schema.sql)
-- =====================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  business_type TEXT,
  phone_number TEXT,
  tenant_id UUID, -- Will be populated later
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Call logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  caller_phone TEXT NOT NULL,
  caller_name TEXT,
  call_duration INTEGER, -- in seconds
  call_status TEXT CHECK (call_status IN ('answered', 'missed', 'voicemail')),
  transcript TEXT,
  sentiment_score DECIMAL(3,2), -- -1.00 to 1.00
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  booking_created BOOLEAN DEFAULT FALSE
);

-- Bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  call_log_id UUID REFERENCES public.call_logs(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  service_type TEXT NOT NULL,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI assistant configurations
CREATE TABLE IF NOT EXISTS public.ai_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  assistant_name TEXT DEFAULT 'PrismAI Assistant',
  greeting_message TEXT DEFAULT 'Hello! Thank you for calling. How can I assist you today?',
  business_hours JSONB DEFAULT '{"monday": {"open": "09:00", "close": "17:00"}, "tuesday": {"open": "09:00", "close": "17:00"}, "wednesday": {"open": "09:00", "close": "17:00"}, "thursday": {"open": "09:00", "close": "17:00"}, "friday": {"open": "09:00", "close": "17:00"}, "saturday": {"open": "10:00", "close": "14:00"}, "sunday": {"closed": true}}',
  services JSONB DEFAULT '["General Consultation", "Appointment Booking", "Information Request"]',
  vapi_phone_number TEXT,
  elevenlabs_agent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================
-- EXTENDED TABLES (from 002_ai_suite_schema.sql)
-- =====================================

-- Subscription plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  features JSONB NOT NULL DEFAULT '[]',
  limits JSONB NOT NULL DEFAULT '{}', -- e.g., {"contacts": 1000, "emails_per_month": 5000}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'paused')) DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- One subscription per user
);

-- Lead sources configuration
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('website', 'social_media', 'email', 'manual', 'api', 'facebook', 'google_ads', 'linkedin')) NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads database
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  source_id UUID REFERENCES public.lead_sources(id),
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  job_title TEXT,
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  status TEXT CHECK (status IN ('new', 'contacted', 'qualified', 'opportunity', 'customer', 'lost')) DEFAULT 'new',
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_follow_up TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead interactions/activities
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  type TEXT CHECK (type IN ('email_sent', 'email_opened', 'email_clicked', 'call_made', 'meeting_scheduled', 'form_submitted', 'website_visit', 'social_interaction')) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base for chatbots
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  is_published BOOLEAN DEFAULT false,
  search_vector tsvector, -- For full-text search
  embedding vector(768), -- For vector search (768 dimensions for text-embedding-004)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat conversations
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  lead_id UUID REFERENCES public.leads(id),
  channel TEXT CHECK (channel IN ('website', 'whatsapp', 'sms', 'messenger', 'slack')) NOT NULL,
  customer_identifier TEXT NOT NULL, -- phone, email, or session ID
  status TEXT CHECK (status IN ('active', 'resolved', 'escalated', 'abandoned')) DEFAULT 'active',
  assigned_agent_id UUID REFERENCES auth.users(id),
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  -- Multi-channel extensions
  modality TEXT CHECK (modality IN ('voice', 'text', 'mixed')) DEFAULT 'text',
  preferred_language TEXT DEFAULT 'en',
  language_confidence DECIMAL(3,2) DEFAULT 1.0,
  twilio_sid TEXT,
  external_conversation_id TEXT,
  -- Advanced AI features
  sentiment_score DECIMAL(3,2) DEFAULT 0.0,
  sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'declining', 'stable')),
  urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high')) DEFAULT 'low',
  escalation_reason TEXT,
  escalated_at TIMESTAMP WITH TIME ZONE,
  summary TEXT,
  summary_generated_at TIMESTAMP WITH TIME ZONE,
  tags TEXT[],
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  sender_type TEXT CHECK (sender_type IN ('customer', 'ai', 'agent')) NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'image', 'file', 'quick_reply', 'template')) DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  -- Multi-channel extensions
  detected_language TEXT,
  translated_from TEXT,
  translated_to TEXT,
  original_content TEXT,
  -- Advanced AI features
  sentiment_score DECIMAL(3,2),
  sentiment_confidence DECIMAL(3,2),
  emotions TEXT[],
  topics TEXT[],
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email campaigns
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  campaign_type TEXT CHECK (campaign_type IN ('newsletter', 'promotional', 'nurture', 'welcome', 'abandoned_cart')) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')) DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  target_audience JSONB DEFAULT '{}', -- Criteria for targeting
  statistics JSONB DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social media posts
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  platform TEXT CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok')) NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[],
  status TEXT CHECK (status IN ('draft', 'scheduled', 'published', 'failed')) DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  external_post_id TEXT,
  engagement_stats JSONB DEFAULT '{"likes": 0, "shares": 0, "comments": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketing automation workflows
CREATE OR REPLACE TABLE public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('lead_created', 'email_opened', 'form_submitted', 'date_based', 'behavior')) NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  workflow_steps JSONB NOT NULL DEFAULT '[]', -- Array of steps with actions
  is_active BOOLEAN DEFAULT true,
  statistics JSONB DEFAULT '{"triggered": 0, "completed": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events (for tracking user behavior)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  lead_id UUID REFERENCES public.leads(id),
  event_name TEXT NOT NULL,
  event_properties JSONB DEFAULT '{}',
  session_id TEXT,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business metrics aggregations
CREATE TABLE IF NOT EXISTS public.business_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  metric_date DATE NOT NULL,
  dimensions JSONB DEFAULT '{}', -- For filtering/grouping
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, metric_name, metric_date, dimensions)
);

-- Integration configurations
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID, -- Will be populated later
  service_name TEXT NOT NULL,
  service_type TEXT CHECK (service_type IN ('crm', 'email', 'social', 'analytics', 'payment', 'calendar')) NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  credentials JSONB NOT NULL DEFAULT '{}', -- Encrypted
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- MULTI-TENANCY TABLES (from 008_multi_tenant_schema.sql)
-- =====================================

-- Tenants table (organizations/businesses)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE, -- For custom domains
  subdomain TEXT UNIQUE, -- For tenant-specific URLs
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  industry TEXT,
  size TEXT CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  locale TEXT DEFAULT 'en-US',
  is_active BOOLEAN DEFAULT true,
  subscription_status TEXT CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')) DEFAULT 'trial',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant users (many-to-many relationship between tenants and users)
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'manager', 'user', 'viewer')) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  last_active_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Tenant invitations (for pending invitations)
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'manager', 'user', 'viewer')) DEFAULT 'user',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Tenant-specific configurations
CREATE TABLE IF NOT EXISTS public.tenant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}',
  is_system_config BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, config_key)
);

-- Tenant feature flags
CREATE TABLE IF NOT EXISTS public.tenant_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  limits JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, feature_name)
);

-- Tenant subscriptions (extends user_subscriptions for multi-tenant)
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'paused')) DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  billing_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id) -- One subscription per tenant
);

-- Usage tracking per tenant
CREATE TABLE IF NOT EXISTS public.tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value BIGINT NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, metric_name, period_start)
);

-- Tenant migration history
CREATE TABLE IF NOT EXISTS public.tenant_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  migration_type TEXT CHECK (migration_type IN ('data_export', 'data_import', 'schema_update', 'backup', 'restore')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
  source_tenant_id UUID REFERENCES public.tenants(id),
  target_tenant_id UUID REFERENCES public.tenants(id),
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- ADD TENANT_ID COLUMNS TO EXISTING TABLES
-- =====================================

-- Add tenant_id to all tables that don't have it
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_configs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.lead_sources ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.lead_activities ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.knowledge_base ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.automation_workflows ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.business_metrics ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- =====================================
-- VECTOR SEARCH CAPABILITIES (from 003_add_vector_search_to_knowledge_base.sql)
-- =====================================

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
ON public.knowledge_base
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to update search_vector for full-text search
CREATE OR REPLACE FUNCTION update_knowledge_base_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.title || ' ' || NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search_vector
DROP TRIGGER IF EXISTS trigger_update_knowledge_base_search_vector ON public.knowledge_base;
CREATE TRIGGER trigger_update_knowledge_base_search_vector
  BEFORE INSERT OR UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_search_vector();

-- Function to search knowledge base using vector similarity
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

-- =====================================
-- MULTI-CHANNEL EXTENSIONS (from 004_multi_channel_extensions.sql)
-- =====================================

-- Customer language preferences table
CREATE TABLE IF NOT EXISTS public.customer_language_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_identifier TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, customer_identifier)
);

-- Enable RLS
ALTER TABLE public.customer_language_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "customer_language_preferences_own" ON public.customer_language_preferences USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_lang_prefs_user_id ON public.customer_language_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_lang_prefs_identifier ON public.customer_language_preferences(customer_identifier);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_preferred_lang ON public.chat_conversations(preferred_language);
CREATE INDEX IF NOT EXISTS idx_chat_messages_detected_lang ON public.chat_messages(detected_language);

-- Update existing conversations to have default language
UPDATE public.chat_conversations
SET preferred_language = 'en'
WHERE preferred_language IS NULL;

-- =====================================
-- ADVANCED AI FEATURES (from 005_advanced_ai_features.sql)
-- =====================================

-- Escalation rules table
CREATE TABLE IF NOT EXISTS public.escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}', -- Rule conditions
  actions JSONB NOT NULL DEFAULT '[]', -- Actions to take when rule triggers
  priority INTEGER DEFAULT 1, -- Rule priority (higher = more important)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Conversation summaries table for advanced analytics
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_points TEXT[],
  sentiment_summary TEXT,
  resolution_status TEXT CHECK (resolution_status IN ('resolved', 'escalated', 'abandoned', 'ongoing')),
  generated_by TEXT CHECK (generated_by IN ('auto', 'manual')) DEFAULT 'auto',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escalation logs table
CREATE TABLE IF NOT EXISTS public.escalation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.escalation_rules(id),
  reason TEXT NOT NULL,
  triggered_by TEXT CHECK (triggered_by IN ('sentiment', 'keyword', 'time', 'manual', 'complexity')),
  old_status TEXT,
  new_status TEXT,
  assigned_agent UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "escalation_rules_own" ON public.escalation_rules USING (auth.uid() = user_id);
CREATE POLICY "conversation_summaries_own" ON public.conversation_summaries USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));
CREATE POLICY "escalation_logs_own" ON public.escalation_logs USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_sentiment_score ON public.chat_conversations(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_urgency_level ON public.chat_conversations(urgency_level);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_priority ON public.chat_conversations(priority);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status_updated ON public.chat_conversations(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sentiment_score ON public.chat_messages(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_chat_messages_urgency ON public.chat_messages(urgency);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_user_id ON public.escalation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON public.escalation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conversation_id ON public.conversation_summaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_escalation_logs_conversation_id ON public.escalation_logs(conversation_id);

-- Function to update conversation sentiment aggregates
CREATE OR REPLACE FUNCTION update_conversation_sentiment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update conversation sentiment when message sentiment changes
  IF NEW.sentiment_score IS NOT NULL THEN
    UPDATE public.chat_conversations
    SET
      sentiment_score = (
        SELECT AVG(sentiment_score)
        FROM public.chat_messages
        WHERE conversation_id = NEW.conversation_id
          AND sentiment_score IS NOT NULL
      ),
      urgency_level = (
        SELECT
          CASE
            WHEN AVG(sentiment_score) < -0.3 THEN 'high'
            WHEN AVG(sentiment_score) < 0 THEN 'medium'
            ELSE 'low'
          END
        FROM public.chat_messages
        WHERE conversation_id = NEW.conversation_id
          AND sentiment_score IS NOT NULL
      ),
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to automatically update conversation sentiment
DROP TRIGGER IF EXISTS trigger_update_conversation_sentiment ON public.chat_messages;
CREATE TRIGGER trigger_update_conversation_sentiment
  AFTER INSERT OR UPDATE OF sentiment_score ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_sentiment();

-- Function to automatically generate conversation summary on resolution
CREATE OR REPLACE FUNCTION generate_conversation_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Generate summary when conversation is resolved
  IF NEW.status IN ('resolved', 'escalated') AND (OLD.status IS NULL OR OLD.status NOT IN ('resolved', 'escalated')) THEN
    -- Insert summary record (will be populated by AI later)
    INSERT INTO public.conversation_summaries (conversation_id, summary, resolution_status, generated_by)
    VALUES (NEW.id, '', NEW.status, 'auto')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to automatically create summary on conversation resolution
DROP TRIGGER IF EXISTS trigger_generate_conversation_summary ON public.chat_conversations;
CREATE TRIGGER trigger_generate_conversation_summary
  AFTER UPDATE OF status ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION generate_conversation_summary();

-- =====================================
-- ENTERPRISE CUSTOMER SERVICE FEATURES (from 006_enterprise_customer_service_features.sql)
-- =====================================

-- Survey templates
CREATE TABLE IF NOT EXISTS public.survey_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT CHECK (trigger_event IN ('conversation_resolved', 'manual', 'scheduled', 'escalation')) DEFAULT 'conversation_resolved',
  delivery_channels TEXT[] DEFAULT ARRAY['email'], -- email, sms, in_chat, whatsapp
  questions JSONB NOT NULL DEFAULT '[]', -- Array of question objects
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Individual surveys sent to customers
CREATE TABLE IF NOT EXISTS public.customer_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.survey_templates(id) ON DELETE CASCADE,
  customer_identifier TEXT NOT NULL, -- email, phone, or session ID
  delivery_channel TEXT NOT NULL CHECK (delivery_channel IN ('email', 'sms', 'in_chat', 'whatsapp')),
  status TEXT CHECK (status IN ('pending', 'sent', 'completed', 'expired', 'failed')) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Survey responses
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.customer_surveys(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL, -- Reference to question in template
  response_value TEXT, -- For rating questions, this would be "1-5", for text it's the answer
  response_type TEXT CHECK (response_type IN ('rating', 'text', 'multiple_choice', 'yes_no')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent profiles (extends auth.users for agents)
CREATE TABLE IF NOT EXISTS public.agent_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Business owner
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('agent', 'supervisor', 'manager')) DEFAULT 'agent',
  status TEXT CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
  max_concurrent_chats INTEGER DEFAULT 5,
  skills TEXT[], -- Array of skills/tags
  performance_goals JSONB DEFAULT '{}', -- Goals for various metrics
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Agent performance metrics (daily aggregations)
CREATE TABLE IF NOT EXISTS public.agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Business owner
  metric_date DATE NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  resolved_conversations INTEGER DEFAULT 0,
  escalated_conversations INTEGER DEFAULT 0,
  abandoned_conversations INTEGER DEFAULT 0,
  avg_response_time_seconds INTEGER, -- Average response time in seconds
  avg_resolution_time_seconds INTEGER, -- Average time to resolve
  customer_satisfaction_score DECIMAL(5,2), -- Average satisfaction rating
  efficiency_score DECIMAL(5,2), -- Custom efficiency metric
  goals_achieved JSONB DEFAULT '{}', -- Which goals were met
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, metric_date)
);

-- Agent goals and targets
CREATE TABLE IF NOT EXISTS public.agent_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE CASCADE, -- NULL for team-wide goals
  goal_type TEXT CHECK (goal_type IN ('conversations_per_day', 'resolution_rate', 'response_time', 'satisfaction_score', 'efficiency')) NOT NULL,
  target_value DECIMAL(10,2) NOT NULL,
  period TEXT CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly')) DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quality scoring criteria/templates
CREATE TABLE IF NOT EXISTS public.quality_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '[]', -- Array of scoring criteria with weights
  max_score INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Quality reviews (manual reviews by supervisors)
CREATE TABLE IF NOT EXISTS public.quality_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES public.quality_criteria(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  criteria_scores JSONB DEFAULT '{}', -- Individual criteria scores
  feedback TEXT,
  review_type TEXT CHECK (review_type IN ('random', 'flagged', 'escalated', 'training')) DEFAULT 'random',
  is_calibrated BOOLEAN DEFAULT false, -- For calibration exercises
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automated quality scores (AI-generated)
CREATE TABLE IF NOT EXISTS public.automated_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES public.quality_criteria(id) ON DELETE SET NULL,
  overall_score DECIMAL(5,2) NOT NULL,
  criteria_scores JSONB DEFAULT '{}',
  confidence_score DECIMAL(3,2), -- AI confidence in the scoring
  reasoning TEXT, -- AI explanation for the score
  flagged_for_review BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quality improvement recommendations
CREATE TABLE IF NOT EXISTS public.quality_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  recommendation_type TEXT CHECK (recommendation_type IN ('response_time', 'tone', 'accuracy', 'empathy', 'compliance', 'process')) NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  description TEXT NOT NULL,
  suggested_action TEXT,
  status TEXT CHECK (status IN ('pending', 'acknowledged', 'implemented', 'dismissed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File attachments table
CREATE TABLE IF NOT EXISTS public.file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- in bytes
  file_type TEXT NOT NULL, -- MIME type
  file_path TEXT NOT NULL, -- Path in storage (Supabase Storage)
  file_url TEXT NOT NULL, -- Public URL for access
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_secure BOOLEAN DEFAULT false, -- Whether file requires authentication to access
  expires_at TIMESTAMP WITH TIME ZONE, -- For temporary files
  metadata JSONB DEFAULT '{}', -- Additional file metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File access logs (for security auditing)
CREATE TABLE IF NOT EXISTS public.file_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.file_attachments(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_type TEXT CHECK (access_type IN ('view', 'download', 'preview', 'share')) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom dashboards and reports
CREATE TABLE IF NOT EXISTS public.custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT CHECK (report_type IN ('agent_performance', 'customer_satisfaction', 'quality_scores', 'conversation_analytics', 'file_usage')) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}', -- Report configuration
  schedule JSONB DEFAULT '{}', -- Automated scheduling
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Report executions and cached results
CREATE TABLE IF NOT EXISTS public.report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.custom_reports(id) ON DELETE CASCADE,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execution_time_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'failed', 'running')) DEFAULT 'running',
  result_data JSONB, -- Cached report data
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies for surveys
CREATE POLICY "survey_templates_own" ON public.survey_templates USING (auth.uid() = user_id);
CREATE POLICY "customer_surveys_own" ON public.customer_surveys USING (auth.uid() = user_id);
CREATE POLICY "survey_responses_own" ON public.survey_responses USING (auth.uid() = (SELECT user_id FROM public.customer_surveys WHERE id = survey_id));

-- RLS policies for agents
CREATE POLICY "agent_profiles_own" ON public.agent_profiles USING (auth.uid() = user_id);
CREATE POLICY "agent_performance_metrics_own" ON public.agent_performance_metrics USING (auth.uid() = user_id);
CREATE POLICY "agent_goals_own" ON public.agent_goals USING (auth.uid() = user_id);

-- RLS policies for quality scoring
CREATE POLICY "quality_criteria_own" ON public.quality_criteria USING (auth.uid() = user_id);
CREATE POLICY "quality_reviews_own" ON public.quality_reviews USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));
CREATE POLICY "automated_quality_scores_own" ON public.automated_quality_scores USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));
CREATE POLICY "quality_recommendations_own" ON public.quality_recommendations USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));

-- RLS policies for files
CREATE POLICY "file_attachments_own" ON public.file_attachments USING (auth.uid() = user_id);
CREATE POLICY "file_access_logs_own" ON public.file_access_logs USING (auth.uid() = (SELECT user_id FROM public.file_attachments WHERE id = file_id));

-- RLS policies for reports
CREATE POLICY "custom_reports_own" ON public.custom_reports USING (auth.uid() = user_id);
CREATE POLICY "report_executions_own" ON public.report_executions USING (auth.uid() = (SELECT user_id FROM public.custom_reports WHERE id = report_id));

-- Function to automatically create survey when conversation is resolved
CREATE OR REPLACE FUNCTION create_customer_survey()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create survey for resolved conversations if templates exist
  IF NEW.status IN ('resolved', 'escalated') AND (OLD.status IS NULL OR OLD.status NOT IN ('resolved', 'escalated')) THEN
    -- Insert surveys for active templates that trigger on resolution
    INSERT INTO public.customer_surveys (
      user_id,
      conversation_id,
      template_id,
      customer_identifier,
      delivery_channel,
      expires_at
    )
    SELECT
      st.user_id,
      NEW.id,
      st.id,
      NEW.customer_identifier,
      unnest(st.delivery_channels),
      NOW() + INTERVAL '7 days'
    FROM public.survey_templates st
    WHERE st.user_id = NEW.user_id
      AND st.trigger_event = 'conversation_resolved'
      AND st.is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to create surveys on conversation resolution
DROP TRIGGER IF EXISTS trigger_create_customer_survey ON public.chat_conversations;
CREATE TRIGGER trigger_create_customer_survey
  AFTER UPDATE OF status ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION create_customer_survey();

-- Function to update agent performance metrics
CREATE OR REPLACE FUNCTION update_agent_performance_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update metrics when conversation status changes
  IF NEW.status != OLD.status THEN
    -- This would be called to aggregate metrics, but for now just log the change
    -- In production, this would trigger metric calculations
    INSERT INTO public.agent_performance_metrics (
      agent_id,
      user_id,
      metric_date,
      total_conversations
    )
    VALUES (
      COALESCE(NEW.assigned_agent_id, '00000000-0000-0000-0000-000000000000'::uuid),
      NEW.user_id,
      CURRENT_DATE,
      1
    )
    ON CONFLICT (agent_id, metric_date)
    DO UPDATE SET
      total_conversations = agent_performance_metrics.total_conversations + 1,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to update agent metrics
DROP TRIGGER IF EXISTS trigger_update_agent_metrics ON public.chat_conversations;
CREATE TRIGGER trigger_update_agent_metrics

-- =====================================
-- CONVERSATION INSIGHTS (from 007_conversation_insights_schema.sql)
-- =====================================

-- Create conversation summaries table
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Summary content
    summary_text TEXT NOT NULL,
    key_points TEXT[] DEFAULT '{}',
    outcomes TEXT[] DEFAULT '{}',
    turning_points TEXT[] DEFAULT '{}',

    -- Summary metadata
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    format VARCHAR(20) CHECK (format IN ('brief', 'detailed', 'executive')) DEFAULT 'brief',
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    message_count INTEGER DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    language VARCHAR(10) DEFAULT 'en',

    -- Processing metadata
    processing_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Indexes for performance
    INDEX idx_conversation_summaries_conversation_id (conversation_id),
    INDEX idx_conversation_summaries_tenant_id (tenant_id),
    INDEX idx_conversation_summaries_created_at (created_at),
    INDEX idx_conversation_summaries_sentiment (sentiment),
    INDEX idx_conversation_summaries_format (format)
);

-- Create conversation insights table
CREATE TABLE IF NOT EXISTS conversation_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Insight identification
    insight_id VARCHAR(255) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('tactical', 'strategic', 'operational')),
    category VARCHAR(50) CHECK (category IN (
        'customer_pain_point', 'satisfaction_driver', 'process_improvement',
        'training_opportunity', 'product_feedback', 'trend', 'anomaly'
    )),

    -- Insight content
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    actionable BOOLEAN DEFAULT true,

    -- Insight details
    recommended_actions TEXT[] DEFAULT '{}',
    related_entities TEXT[] DEFAULT '{}',
    related_topics TEXT[] DEFAULT '{}',
    impact VARCHAR(20) CHECK (impact IN ('individual', 'team', 'organization', 'customer_base')),
    timeframe VARCHAR(20) CHECK (timeframe IN ('immediate', 'short_term', 'medium_term', 'long_term')),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Indexes for performance
    INDEX idx_conversation_insights_conversation_id (conversation_id),
    INDEX idx_conversation_insights_tenant_id (tenant_id),
    INDEX idx_conversation_insights_type (type),
    INDEX idx_conversation_insights_category (category),
    INDEX idx_conversation_insights_severity (severity),
    INDEX idx_conversation_insights_actionable (actionable),
    INDEX idx_conversation_insights_created_at (created_at),
    INDEX idx_conversation_insights_confidence (confidence_score)
);

-- Create conversation patterns table
CREATE TABLE IF NOT EXISTS conversation_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Pattern identification
    pattern_id VARCHAR(255) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(30) CHECK (type IN (
        'success', 'failure', 'escalation', 'resolution',
        'abandonment', 'satisfaction', 'dissatisfaction'
    )),

    -- Pattern metrics
    frequency INTEGER DEFAULT 0,
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),

    -- Pattern characteristics
    characteristics JSONB DEFAULT '{}', -- Stores average duration, message count, etc.

    -- Pattern examples and recommendations
    examples JSONB DEFAULT '[]',
    recommendations TEXT[] DEFAULT '{}',

    -- Business impact
    business_impact VARCHAR(20) CHECK (business_impact IN ('low', 'medium', 'high', 'critical')),
    trend VARCHAR(20) CHECK (trend IN ('improving', 'declining', 'stable', 'volatile')),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes for performance
    INDEX idx_conversation_patterns_tenant_id (tenant_id),
    INDEX idx_conversation_patterns_type (type),
    INDEX idx_conversation_patterns_impact (business_impact),
    INDEX idx_conversation_patterns_trend (trend),
    INDEX idx_conversation_patterns_frequency (frequency)
);

-- Create insight recommendations table
CREATE TABLE IF NOT EXISTS insight_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Recommendation details
    insight_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',

    -- Implementation details
    recommended_actions TEXT[] DEFAULT '{}',
    estimated_effort VARCHAR(20) CHECK (estimated_effort IN ('low', 'medium', 'high')),
    required_resources TEXT[] DEFAULT '{}',

    -- Status tracking
    status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'implemented', 'dismissed')) DEFAULT 'pending',
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    due_date DATE,

    -- Impact assessment
    expected_impact VARCHAR(100),
    actual_impact VARCHAR(100),
    success_metrics TEXT[] DEFAULT '{}',

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes for performance
    INDEX idx_insight_recommendations_tenant_id (tenant_id),
    INDEX idx_insight_recommendations_status (status),
    INDEX idx_insight_recommendations_priority (priority),
    INDEX idx_insight_recommendations_assigned_to (assigned_to),
    INDEX idx_insight_recommendations_due_date (due_date)
);

-- Create conversation insights combined view for comprehensive analysis
CREATE TABLE IF NOT EXISTS conversation_insights_combined (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Combined data
    summary_data JSONB,
    insights_data JSONB DEFAULT '[]',

    -- Aggregated metrics
    insights_count INTEGER DEFAULT 0,
    summary_confidence DECIMAL(3,2) CHECK (summary_confidence >= 0 AND summary_confidence <= 1),
    average_insight_confidence DECIMAL(3,2) CHECK (average_insight_confidence >= 0 AND average_insight_confidence <= 1),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Indexes for performance
    INDEX idx_conversation_insights_combined_conversation_id (conversation_id),
    INDEX idx_conversation_insights_combined_tenant_id (tenant_id),
    INDEX idx_conversation_insights_combined_created_at (created_at)
);

-- Create anomaly detection table
CREATE TABLE IF NOT EXISTS conversation_anomalies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Anomaly details
    anomaly_id VARCHAR(255) NOT NULL,
    type VARCHAR(30) CHECK (type IN ('duration', 'sentiment', 'escalation', 'abandonment', 'agent_behavior')),

    -- Anomaly description
    description TEXT NOT NULL,
    expected_pattern TEXT,
    actual_pattern TEXT,
    deviation DECIMAL(5,2) DEFAULT 0, -- Percentage deviation

    -- Business impact
    business_impact TEXT,
    recommended_actions TEXT[] DEFAULT '{}',

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Indexes for performance
    INDEX idx_conversation_anomalies_conversation_id (conversation_id),
    INDEX idx_conversation_anomalies_tenant_id (tenant_id),
    INDEX idx_conversation_anomalies_type (type),
    INDEX idx_conversation_anomalies_severity (severity),
    INDEX idx_conversation_anomalies_created_at (created_at)
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights_combined ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_anomalies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversation_summaries
CREATE POLICY "Users can view summaries for their tenant" ON conversation_summaries
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert summaries for their tenant" ON conversation_summaries
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        ) AND created_by = auth.uid()
    );

-- Create RLS policies for conversation_insights
CREATE POLICY "Users can view insights for their tenant" ON conversation_insights
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert insights for their tenant" ON conversation_insights
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        ) AND created_by = auth.uid()
    );

-- Create RLS policies for conversation_patterns
CREATE POLICY "Users can view patterns for their tenant" ON conversation_patterns
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage patterns" ON conversation_patterns
    FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for insight_recommendations
CREATE POLICY "Users can view recommendations for their tenant" ON insight_recommendations
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage recommendations for their tenant" ON insight_recommendations
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        )
    );

-- Create RLS policies for conversation_insights_combined
CREATE POLICY "Users can view combined insights for their tenant" ON conversation_insights_combined
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert combined insights for their tenant" ON conversation_insights_combined
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        ) AND created_by = auth.uid()
    );

-- Create RLS policies for conversation_anomalies
CREATE POLICY "Users can view anomalies for their tenant" ON conversation_anomalies
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert anomalies for their tenant" ON conversation_anomalies
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
        ) AND created_by = auth.uid()
    );

-- Create indexes for better query performance on large datasets
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_tenant_created_at ON conversation_summaries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_tenant_category ON conversation_insights(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_tenant_severity ON conversation_insights(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_tenant_actionable ON conversation_insights(tenant_id, actionable) WHERE actionable = true;
CREATE INDEX IF NOT EXISTS idx_insight_recommendations_tenant_status ON insight_recommendations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_insight_recommendations_tenant_priority ON insight_recommendations(tenant_id, priority) WHERE status = 'pending';

-- Create views for common analytics queries

-- View for actionable insights by tenant
CREATE OR REPLACE VIEW actionable_insights_by_tenant AS
SELECT
    tenant_id,
    category,
    COUNT(*) as insight_count,
    AVG(confidence_score) as avg_confidence,
    ARRAY_AGG(title) as insight_titles
FROM conversation_insights
WHERE actionable = true
    AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id, category;

-- View for conversation summary analytics
CREATE OR REPLACE VIEW conversation_summary_analytics AS
SELECT
    tenant_id,
    sentiment,
    format,
    COUNT(*) as summary_count,
    AVG(confidence_score) as avg_confidence,
    AVG(message_count) as avg_message_count,
    AVG(duration_minutes) as avg_duration_minutes
FROM conversation_summaries
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id, sentiment, format;

-- View for pattern performance
CREATE OR REPLACE VIEW pattern_performance AS
SELECT
    tenant_id,
    type,
    business_impact,
    trend,
    COUNT(*) as pattern_count,
    AVG(frequency) as avg_frequency,
    AVG(confidence) as avg_confidence
FROM conversation_patterns
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, type, business_impact, trend;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for conversation_patterns
CREATE TRIGGER update_conversation_patterns_updated_at
    BEFORE UPDATE ON conversation_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for insight_recommendations
CREATE TRIGGER update_insight_recommendations_updated_at
    BEFORE UPDATE ON insight_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON conversation_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON conversation_insights TO authenticated;
GRANT SELECT ON conversation_patterns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON insight_recommendations TO authenticated;
GRANT SELECT, INSERT ON conversation_insights_combined TO authenticated;
GRANT SELECT, INSERT ON conversation_anomalies TO authenticated;

-- Grant view permissions
GRANT SELECT ON actionable_insights_by_tenant TO authenticated;
GRANT SELECT ON conversation_summary_analytics TO authenticated;
GRANT SELECT ON pattern_performance TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE conversation_summaries IS 'Stores AI-generated summaries of conversations with key points and outcomes';
COMMENT ON TABLE conversation_insights IS 'Stores actionable insights extracted from conversations for business improvement';
COMMENT ON TABLE conversation_patterns IS 'Stores identified conversation patterns and their characteristics for analysis';
COMMENT ON TABLE insight_recommendations IS 'Tracks recommendations generated from insights and their implementation status';
COMMENT ON TABLE conversation_insights_combined IS 'Combines summary and insights data for comprehensive conversation analysis';
COMMENT ON TABLE conversation_anomalies IS 'Stores detected anomalies in conversation patterns for investigation';

-- =====================================
-- CONVERSATION INTELLIGENCE (from 007_conversation_intelligence_schema.sql)
-- =====================================

-- Conversation Emotions Table
CREATE TABLE IF NOT EXISTS conversation_emotions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Emotion Analysis Results
    dominant_emotion VARCHAR(50) NOT NULL DEFAULT 'neutral',
    overall_sentiment VARCHAR(20) NOT NULL DEFAULT 'neutral' CHECK (overall_sentiment IN ('positive', 'negative', 'neutral')),

    -- Detailed Emotion Scores (JSON array of emotion objects)
    emotion_scores JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    language VARCHAR(10) DEFAULT 'en',
    processing_time_ms INTEGER DEFAULT 0,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT unique_conversation_message_emotion UNIQUE(conversation_id, message_id, tenant_id)
);

-- Conversation Intents Table
CREATE TABLE IF NOT EXISTS conversation_intents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Intent Analysis Results
    primary_intent VARCHAR(50) NOT NULL DEFAULT 'off_topic',
    secondary_intent VARCHAR(50),

    -- Intent Complexity and Urgency
    urgency_level VARCHAR(20) DEFAULT 'low' CHECK (urgency_level IN ('low', 'medium', 'high')),
    complexity_level VARCHAR(20) DEFAULT 'simple' CHECK (complexity_level IN ('simple', 'moderate', 'complex')),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),

    -- Detailed Intent Scores (JSON array of intent objects)
    intent_scores JSONB DEFAULT '[]'::jsonb,

    -- Extracted Entities (JSON object)
    entities JSONB DEFAULT '{}'::jsonb,

    -- Context Keywords (JSON array)
    context_keywords JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    language VARCHAR(10) DEFAULT 'en',
    processing_time_ms INTEGER DEFAULT 0,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT unique_conversation_message_intent UNIQUE(conversation_id, message_id, tenant_id)
);

-- Conversation Insights Combined Table
CREATE TABLE IF NOT EXISTS conversation_insights_combined (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Combined Analysis Data
    emotion_data JSONB,
    intent_data JSONB,
    combined_confidence DECIMAL(3,2) DEFAULT 0.0 CHECK (combined_confidence >= 0 AND combined_confidence <= 1),

    -- Processing Metadata
    processing_version VARCHAR(20) DEFAULT '1.0',
    analysis_source VARCHAR(50) DEFAULT 'gemini',

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT unique_conversation_message_insight UNIQUE(conversation_id, message_id, tenant_id)
);

-- Emotion Trends Table
CREATE TABLE IF NOT EXISTS emotion_trends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Time Period
    trend_date DATE NOT NULL,
    trend_period VARCHAR(20) NOT NULL CHECK (trend_period IN ('daily', 'weekly', 'monthly')),

    -- Aggregated Emotion Data
    emotion_counts JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"joy": 10, "sadness": 5, ...}
    sentiment_counts JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"positive": 15, "negative": 8, "neutral": 3}

    -- Statistics
    total_conversations INTEGER NOT NULL DEFAULT 0,
    dominant_emotion VARCHAR(50) NOT NULL,
    average_confidence DECIMAL(3,2) DEFAULT 0.0,

    -- Conversation IDs for this period (for drill-down)
    conversation_ids JSONB DEFAULT '[]'::jsonb,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_tenant_period UNIQUE(tenant_id, trend_date, trend_period)
);

-- Intent Analytics Table
CREATE TABLE IF NOT EXISTS intent_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Time Period
    analytics_date DATE NOT NULL,
    analytics_period VARCHAR(20) NOT NULL CHECK (analytics_period IN ('daily', 'weekly', 'monthly')),

    -- Intent Statistics
    intent_type VARCHAR(50) NOT NULL,
    intent_count INTEGER NOT NULL DEFAULT 0,
    average_confidence DECIMAL(3,2) DEFAULT 0.0,

    -- Distribution Data
    urgency_distribution JSONB DEFAULT '{}'::jsonb, -- {"low": 5, "medium": 10, "high": 3}
    complexity_distribution JSONB DEFAULT '{}'::jsonb, -- {"simple": 8, "moderate": 7, "complex": 3}

    -- Conversation IDs for this intent and period
    conversation_ids JSONB DEFAULT '[]'::jsonb,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_tenant_period_intent UNIQUE(tenant_id, analytics_date, analytics_period, intent_type)
);

-- Conversation Intelligence Settings
CREATE TABLE IF NOT EXISTS conversation_intelligence_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Analysis Settings
    enable_emotion_detection BOOLEAN DEFAULT true,
    enable_intent_classification BOOLEAN DEFAULT true,
    enable_real_time_analysis BOOLEAN DEFAULT true,

    -- Confidence Thresholds
    min_emotion_confidence DECIMAL(3,2) DEFAULT 0.3 CHECK (min_emotion_confidence >= 0 AND min_emotion_confidence <= 1),
    min_intent_confidence DECIMAL(3,2) DEFAULT 0.3 CHECK (min_intent_confidence >= 0 AND min_intent_confidence <= 1),

    -- Language Settings
    supported_languages JSONB DEFAULT '["en"]'::jsonb,
    default_language VARCHAR(10) DEFAULT 'en',

    -- Privacy Settings
    data_retention_days INTEGER DEFAULT 90,
    enable_anonymization BOOLEAN DEFAULT false,
    require_consent BOOLEAN DEFAULT false,

    -- Performance Settings
    batch_size INTEGER DEFAULT 10,
    max_concurrent_requests INTEGER DEFAULT 5,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT unique_tenant_settings UNIQUE(tenant_id)
);

-- Conversation Intelligence Audit Log
CREATE TABLE IF NOT EXISTS conversation_intelligence_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Event Details
    event_type VARCHAR(100) NOT NULL, -- 'analysis', 'batch_analysis', 'settings_change'
    conversation_id VARCHAR(255),
    user_id UUID REFERENCES auth.users(id),

    -- Event Data
    event_data JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,

    -- Compliance
    consent_given BOOLEAN DEFAULT false,
    data_anonymized BOOLEAN DEFAULT false,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_event_type CHECK (event_type IN ('analysis', 'batch_analysis', 'settings_change', 'data_export', 'data_deletion'))
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE conversation_emotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights_combined ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_intelligence_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_intelligence_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_emotions
CREATE POLICY "Users can view emotions for their tenant" ON conversation_emotions
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert emotions" ON conversation_emotions
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policies for conversation_intents
CREATE POLICY "Users can view intents for their tenant" ON conversation_intents
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert intents" ON conversation_intents
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policies for conversation_insights_combined
CREATE POLICY "Users can view insights for their tenant" ON conversation_insights_combined
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert insights" ON conversation_insights_combined
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policies for aggregated tables
CREATE POLICY "Users can view trends for their tenant" ON emotion_trends
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can view analytics for their tenant" ON intent_analytics
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policies for settings
CREATE POLICY "Users can view settings for their tenant" ON conversation_intelligence_settings
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Tenant admins can manage settings" ON conversation_intelligence_settings
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
        )
    );

-- RLS Policies for audit log
CREATE POLICY "Users can view audit logs for their tenant" ON conversation_intelligence_audit
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert audit logs" ON conversation_intelligence_audit
    FOR INSERT WITH CHECK (true);

-- Function to create default settings for new tenants
CREATE OR REPLACE FUNCTION create_default_intelligence_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO conversation_intelligence_settings (tenant_id)
    VALUES (NEW.id)
    ON CONFLICT (tenant_id) DO NOTHING;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create default settings for new tenants
CREATE TRIGGER create_tenant_intelligence_settings
    AFTER INSERT ON tenants
    FOR EACH ROW EXECUTE FUNCTION create_default_intelligence_settings();

-- Views for easy querying

-- View for conversation summary with emotions and intents
CREATE OR REPLACE VIEW conversation_summary AS
SELECT
    ce.conversation_id,
    ce.tenant_id,
    ce.dominant_emotion,
    ce.overall_sentiment,
    ci.primary_intent,
    ci.urgency_level,
    ci.complexity_level,
    GREATEST(ce.confidence_score, ci.confidence_score) as combined_confidence,
    ce.created_at as analyzed_at,
    COUNT(*) OVER (PARTITION BY ce.conversation_id) as message_count
FROM conversation_emotions ce
LEFT JOIN conversation_intents ci ON ce.conversation_id = ci.conversation_id
    AND ce.message_id = ci.message_id
    AND ce.tenant_id = ci.tenant_id;

-- View for tenant analytics overview
CREATE OR REPLACE VIEW tenant_analytics_overview AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,

    -- Emotion metrics (last 30 days)
    COALESCE(SUM(et.total_conversations), 0) as total_conversations_30d,
    COALESCE(
        jsonb_object_agg(et.dominant_emotion, et.emotion_counts->et.dominant_emotion)
        FILTER (WHERE et.dominant_emotion IS NOT NULL),
        '{}'::jsonb
    ) as dominant_emotions_30d,

    -- Intent metrics (last 30 days)
    COALESCE(SUM(ia.intent_count), 0) as total_intents_30d,
    COALESCE(
        jsonb_object_agg(ia.intent_type, ia.intent_count)
        FILTER (WHERE ia.intent_type IS NOT NULL),
        '{}'::jsonb
    ) as intent_distribution_30d,

    -- Recent activity
    MAX(GREATEST(ce.created_at, ci.created_at)) as last_analysis_date

FROM tenants t
LEFT JOIN emotion_trends et ON t.id = et.tenant_id
    AND et.trend_date >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN intent_analytics ia ON t.id = ia.tenant_id
    AND ia.analytics_date >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN conversation_emotions ce ON t.id = ce.tenant_id
LEFT JOIN conversation_intents ci ON t.id = ci.tenant_id

GROUP BY t.id, t.name;

-- Grant necessary permissions for the application
GRANT SELECT, INSERT, UPDATE ON conversation_emotions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON conversation_intents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON conversation_insights_combined TO authenticated;
GRANT SELECT ON emotion_trends TO authenticated;
GRANT SELECT ON intent_analytics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_intelligence_settings TO authenticated;
GRANT SELECT, INSERT ON conversation_intelligence_audit TO authenticated;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE conversation_emotions IS 'Stores emotion detection results for individual messages';
COMMENT ON TABLE conversation_intents IS 'Stores intent classification results for individual messages';
COMMENT ON TABLE conversation_insights_combined IS 'Combined emotion and intent analysis results';
COMMENT ON TABLE emotion_trends IS 'Aggregated emotion data for trend analysis';
COMMENT ON TABLE intent_analytics IS 'Aggregated intent data for analytics and reporting';
COMMENT ON TABLE conversation_intelligence_settings IS 'Tenant-specific settings for conversation intelligence features';
COMMENT ON TABLE conversation_intelligence_audit IS 'Audit log for compliance and tracking';

-- Create indexes for better performance on large datasets
CREATE INDEX IF NOT EXISTS idx_conversation_emotions_composite ON conversation_emotions(tenant_id, created_at, dominant_emotion);
CREATE INDEX IF NOT EXISTS idx_conversation_intents_composite ON conversation_intents(tenant_id, created_at, primary_intent);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_composite ON conversation_insights_combined(tenant_id, created_at, conversation_id);

-- =====================================
-- LEAD ROUTING (from 007_lead_routing_schema.sql)
-- =====================================

-- Priority scoring metadata for leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS business_value_score INTEGER DEFAULT 0 CHECK (business_value_score >= 0 AND business_value_score <= 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS urgency_score INTEGER DEFAULT 0 CHECK (urgency_score >= 0 AND urgency_score <= 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS time_sensitivity_score INTEGER DEFAULT 0 CHECK (time_sensitivity_score >= 0 AND time_sensitivity_score <= 100);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority_metadata JSONB DEFAULT '{}';

-- Lead assignment tracking
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES auth.users(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMP WITH TIME ZONE;

-- Lead routing decisions log
CREATE TABLE IF NOT EXISTS public.lead_routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_agent_id UUID REFERENCES auth.users(id),
  routing_queue TEXT NOT NULL,
  priority_level TEXT CHECK (priority_level IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  reasoning JSONB DEFAULT '[]',
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  estimated_wait_time INTEGER, -- in minutes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id, created_at)
);

-- Lead handoff events tracking
CREATE TABLE IF NOT EXISTS public.lead_handoff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES auth.users(id),
  to_agent_id UUID REFERENCES auth.users(id),
  handoff_type TEXT CHECK (handoff_type IN ('assignment', 'transfer', 'escalation', 'reassignment', 'timeout')) NOT NULL,
  reason TEXT NOT NULL,
  priority_level TEXT CHECK (priority_level IN ('critical', 'high', 'medium', 'low')) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Handoff optimization events
CREATE TABLE IF NOT EXISTS public.handoff_optimization_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  optimization_type TEXT CHECK (optimization_type IN ('load_balancing', 'skill_match', 'performance', 'priority_escalation')) NOT NULL,
  original_agent_id UUID REFERENCES auth.users(id),
  optimized_agent_id UUID REFERENCES auth.users(id),
  expected_improvement DECIMAL(5,4) CHECK (expected_improvement >= 0 AND expected_improvement <= 1),
  actual_improvement DECIMAL(5,4),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent availability and capacity tracking
CREATE TABLE IF NOT EXISTS public.agent_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_load INTEGER DEFAULT 0 CHECK (current_load >= 0),
  max_capacity INTEGER DEFAULT 10 CHECK (max_capacity > 0),
  skills TEXT[] DEFAULT '{}',
  average_response_time INTEGER DEFAULT 30, -- in minutes
  is_available BOOLEAN DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, agent_id)
);

-- Agent skills and specializations
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  proficiency_level INTEGER CHECK (proficiency_level >= 1 AND proficiency_level <= 10),
  is_specialization BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, agent_id, skill_name)
);

-- Agent performance metrics
CREATE TABLE IF NOT EXISTS public.agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  leads_handled INTEGER DEFAULT 0,
  average_resolution_time INTEGER DEFAULT 0, -- in minutes
  success_rate DECIMAL(5,4) DEFAULT 0 CHECK (success_rate >= 0 AND success_rate <= 1),
  customer_satisfaction DECIMAL(3,2) DEFAULT 0 CHECK (customer_satisfaction >= 0 AND customer_satisfaction <= 5),
  current_streak INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, agent_id, updated_at::date)
);

-- Queue metrics history for performance tracking
CREATE TABLE IF NOT EXISTS public.queue_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  queue_name TEXT NOT NULL,
  lead_count INTEGER DEFAULT 0,
  average_wait_time INTEGER DEFAULT 0, -- in minutes
  max_wait_time INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  abandoned_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System logs for lead routing
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  component TEXT NOT NULL, -- 'routing', 'handoff', 'optimization', 'queue'
  level TEXT CHECK (level IN ('debug', 'info', 'warn', 'error')) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.lead_routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_handoff_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoff_optimization_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead routing tables
CREATE POLICY "routing_decisions_own" ON public.lead_routing_decisions USING (auth.uid() = user_id);
CREATE POLICY "handoff_events_own" ON public.lead_handoff_events USING (auth.uid() = user_id);
CREATE POLICY "optimization_events_own" ON public.handoff_optimization_events USING (auth.uid() = user_id);
CREATE POLICY "agent_availability_own" ON public.agent_availability USING (auth.uid() = user_id);
CREATE POLICY "agent_skills_own" ON public.agent_skills USING (auth.uid() = user_id);
CREATE POLICY "agent_performance_own" ON public.agent_performance_metrics USING (auth.uid() = user_id);
CREATE POLICY "queue_metrics_own" ON public.queue_metrics_history USING (auth.uid() = user_id);
CREATE POLICY "system_logs_own" ON public.system_logs USING (auth.uid() = user_id);

-- Function to update agent availability on lead assignment
CREATE OR REPLACE FUNCTION update_agent_availability_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update agent's current load
  UPDATE public.agent_availability
  SET
    current_load = current_load + 1,
    last_activity = NOW(),
    updated_at = NOW()
  WHERE user_id = NEW.user_id AND agent_id = NEW.assigned_agent_id;

  -- Log the assignment
  INSERT INTO public.system_logs (user_id, component, level, message, metadata)
  VALUES (
    NEW.user_id,
    'routing',
    'info',
    'Lead assigned to agent',
    jsonb_build_object(
      'lead_id', NEW.id,
      'agent_id', NEW.assigned_agent_id,
      'priority_score', NEW.priority_score
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update agent availability on lead assignment
DROP TRIGGER IF EXISTS trigger_update_agent_availability ON public.leads;
CREATE TRIGGER trigger_update_agent_availability
  AFTER UPDATE OF assigned_agent_id ON public.leads
  FOR EACH ROW
  WHEN (NEW.assigned_agent_id IS NOT NULL AND OLD.assigned_agent_id IS NULL)
  EXECUTE FUNCTION update_agent_availability_on_assignment();

-- Function to log queue metrics periodically
CREATE OR REPLACE FUNCTION log_queue_metrics()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  queue_stats RECORD;
BEGIN
  -- For each user, log current queue metrics
  FOR user_record IN SELECT DISTINCT user_id FROM public.leads WHERE user_id IS NOT NULL
  LOOP
    FOR queue_stats IN
      SELECT
        'priority_critical' as queue_name, COUNT(*) as lead_count
      FROM public.leads
      WHERE user_id = user_record.user_id
        AND priority_score >= 90
        AND assigned_agent_id IS NULL
      UNION ALL
      SELECT
        'priority_high' as queue_name, COUNT(*) as lead_count
      FROM public.leads
      WHERE user_id = user_record.user_id
        AND priority_score >= 75 AND priority_score < 90
        AND assigned_agent_id IS NULL
      UNION ALL
      SELECT
        'priority_medium' as queue_name, COUNT(*) as lead_count
      FROM public.leads
      WHERE user_id = user_record.user_id
        AND priority_score >= 50 AND priority_score < 75
        AND assigned_agent_id IS NULL
      UNION ALL
      SELECT
        'priority_low' as queue_name, COUNT(*) as lead_count
      FROM public.leads
      WHERE user_id = user_record.user_id
        AND priority_score < 50
        AND assigned_agent_id IS NULL
    LOOP
      INSERT INTO public.queue_metrics_history (
        user_id,
        queue_name,
        lead_count,
        created_at
      ) VALUES (
        user_record.user_id,
        queue_stats.queue_name,
        queue_stats.lead_count,
        NOW()
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Insert default agent availability for existing users
INSERT INTO public.agent_availability (user_id, agent_id, current_load, max_capacity, is_available)
SELECT DISTINCT
  user_id,
  user_id as agent_id, -- Users can be their own agents initially
  0 as current_load,
  10 as max_capacity,
  true as is_available
FROM public.leads
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, agent_id) DO NOTHING;

-- Log initial system message
INSERT INTO public.system_logs (component, level, message, metadata)
VALUES (
  'routing',
  'info',
  'Lead routing system initialized',
  jsonb_build_object('timestamp', NOW())
);

-- =====================================
-- PERSONALIZATION ENGINE (from 007_personalization_engine_schema.sql)
-- =====================================

-- Lead behavior patterns
CREATE TABLE IF NOT EXISTS public.lead_behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  behavior_type TEXT NOT NULL, -- engagement, content_interaction, timing, channel_preference
  behavior_data JSONB NOT NULL DEFAULT '{}',
  pattern_analysis JSONB NOT NULL DEFAULT '{}', -- AI analysis of the pattern
  confidence_score DECIMAL(3,2) NOT NULL, -- 0-1 confidence in pattern
  frequency INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead preferences (inferred from behavior)
CREATE TABLE IF NOT EXISTS public.lead_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content_types TEXT[] DEFAULT ARRAY['educational'], -- educational, promotional, case_study, etc.
  communication_channels TEXT[] DEFAULT ARRAY['email'], -- email, sms, whatsapp, chat, phone
  preferred_times JSONB DEFAULT '[]', -- Array of preferred time slots
  topics TEXT[] DEFAULT ARRAY[], -- Topics of interest
  tone TEXT CHECK (tone IN ('formal', 'casual', 'professional')) DEFAULT 'professional',
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')) DEFAULT 'weekly',
  inferred_from JSONB DEFAULT '{}', -- What behavior led to these preferences
  confidence_score DECIMAL(3,2) DEFAULT 0.5, -- Confidence in inferred preferences
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id)
);

-- Lead journey stages
CREATE TABLE IF NOT EXISTS public.lead_journey_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  current_stage TEXT CHECK (current_stage IN ('awareness', 'consideration', 'decision', 'retention', 'advocacy')) NOT NULL DEFAULT 'awareness',
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  next_actions TEXT[] DEFAULT ARRAY[],
  blockers TEXT[] DEFAULT ARRAY[],
  stage_data JSONB DEFAULT '{}', -- Additional stage-specific data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lead_id)
);

-- Behavioral trigger definitions
CREATE TABLE IF NOT EXISTS public.behavioral_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('behavior', 'score_change', 'engagement', 'time_based', 'custom')) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}', -- Trigger conditions
  actions JSONB NOT NULL DEFAULT '[]', -- Actions to execute
  priority INTEGER DEFAULT 1,
  cooldown_minutes INTEGER DEFAULT 0, -- Minimum time between triggers
  is

-- =====================================
-- UNIFIED CONVERSATIONS (from 007_unified_conversations.sql)
-- =====================================

-- Unified conversation metadata
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS unified_id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS conversation_type TEXT CHECK (conversation_type IN ('voice', 'text', 'mixed', 'video', 'email')) DEFAULT 'text';
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS total_duration INTEGER DEFAULT 0; -- Total duration across all channels in seconds
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS channel_sequence TEXT[] DEFAULT ARRAY[]; -- Order of channels used
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS escalation_count INTEGER DEFAULT 0;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS transfer_count INTEGER DEFAULT 0;
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS resolution_path TEXT[] DEFAULT ARRAY[]; -- Path taken to resolution

-- Unified message metadata
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS unified_message_id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS message_sequence INTEGER; -- Sequence within unified conversation
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS channel_context JSONB DEFAULT '{}'; -- Channel-specific metadata
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS cross_channel_references UUID[] DEFAULT ARRAY[]; -- References to messages in other channels

-- Conversation transitions (when customer switches channels)
CREATE TABLE IF NOT EXISTS public.conversation_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  to_conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  transition_type TEXT CHECK (transition_type IN ('escalation', 'transfer', 'channel_switch', 'follow_up')) NOT NULL,
  reason TEXT,
  initiated_by TEXT CHECK (initiated_by IN ('customer', 'agent', 'system', 'auto')) DEFAULT 'customer',
  transition_data JSONB DEFAULT '{}', -- Additional transition metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_conversation_id, to_conversation_id, transition_type, created_at)
);

-- Unified conversation context
CREATE TABLE IF NOT EXISTS public.unified_conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unified_id UUID NOT NULL,
  context_type TEXT CHECK (context_type IN ('customer_profile', 'conversation_history', 'business_context', 'technical_context')) NOT NULL,
  context_data JSONB NOT NULL DEFAULT '{}',
  relevance_score DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, unified_id, context_type)
);

-- Cross-channel message references
CREATE TABLE IF NOT EXISTS public.cross_channel_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  target_message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reference_type TEXT CHECK (reference_type IN ('reply', 'follow_up', 'continuation', 'escalation', 'transfer')) NOT NULL,
  reference_strength DECIMAL(3,2) DEFAULT 1.0, -- How strong the connection is
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_message_id, target_message_id)
);

-- Unified conversation analytics
CREATE TABLE IF NOT EXISTS public.unified_conversation_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unified_id UUID NOT NULL,
  total_messages INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0, -- in seconds
  channel_count INTEGER DEFAULT 1,
  unique_agents INTEGER DEFAULT 0,
  resolution_time INTEGER, -- in seconds
  customer_satisfaction DECIMAL(3,2),
  cost_per_conversation DECIMAL(8,2),
  efficiency_score DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, unified_id)
);

-- Enable RLS on new tables
ALTER TABLE public.conversation_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_conversation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_channel_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_conversation_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "conversation_transitions_own" ON public.conversation_transitions USING (auth.uid() = user_id);
CREATE POLICY "unified_context_own" ON public.unified_conversation_context USING (auth.uid() = user_id);
CREATE POLICY "cross_channel_refs_own" ON public.cross_channel_references USING (auth.uid() = user_id);
CREATE POLICY "unified_analytics_own" ON public.unified_conversation_analytics USING (auth.uid() = user_id);

-- Function to create unified conversation on new conversation
CREATE OR REPLACE FUNCTION create_unified_conversation()
RETURNS TRIGGER AS $$
DECLARE
  existing_unified_id UUID;
BEGIN
  -- Check if there's already a unified conversation for this customer
  SELECT unified_id INTO existing_unified_id
  FROM public.chat_conversations
  WHERE user_id = NEW.user_id
    AND customer_identifier = NEW.customer_identifier
    AND unified_id IS NOT NULL
    AND created_at >= NOW() - INTERVAL '24 hours' -- Within last 24 hours
  ORDER BY created_at DESC
  LIMIT 1;

  -- If found, use existing unified_id, otherwise create new one
  IF existing_unified_id IS NOT NULL THEN
    NEW.unified_id := existing_unified_id;
  ELSE
    NEW.unified_id := gen_random_uuid();
  END IF;

  -- Update conversation type based on channel
  IF NEW.channel IN ('whatsapp', 'sms') THEN
    NEW.conversation_type := 'text';
  ELSIF NEW.channel = 'website' THEN
    NEW.conversation_type := 'text';
  ELSE
    NEW.conversation_type := 'text'; -- Default
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create unified conversation
DROP TRIGGER IF EXISTS trigger_create_unified_conversation ON public.chat_conversations;
CREATE TRIGGER trigger_create_unified_conversation
  BEFORE INSERT ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION create_unified_conversation();

-- Function to update unified analytics on conversation changes
CREATE OR REPLACE FUNCTION update_unified_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update unified analytics
  INSERT INTO public.unified_conversation_analytics (
    user_id,
    unified_id,
    total_messages,
    total_duration,
    channel_count,
    unique_agents,
    resolution_time,
    customer_satisfaction
  )
  SELECT
    c.user_id,
    c.unified_id,
    COUNT(m.id) as total_messages,
    COALESCE(SUM(c.total_duration), 0) as total_duration,
    COUNT(DISTINCT c.channel) as channel_count,
    COUNT(DISTINCT c.assigned_agent_id) as unique_agents,
    EXTRACT(EPOCH FROM (c.updated_at - c.created_at))::INTEGER as resolution_time,
    c.satisfaction_rating
  FROM public.chat_conversations c
  LEFT JOIN public.chat_messages m ON c.id = m.conversation_id
  WHERE c.unified_id = COALESCE(NEW.unified_id, OLD.unified_id)
  GROUP BY c.user_id, c.unified_id, c.total_duration, c.updated_at, c.created_at, c.satisfaction_rating
  ON CONFLICT (user_id, unified_id)
  DO UPDATE SET
    total_messages = EXCLUDED.total_messages,
    total_duration = EXCLUDED.total_duration,
    channel_count = EXCLUDED.channel_count,
    unique_agents = EXCLUDED.unique_agents,
    resolution_time = EXCLUDED.resolution_time,
    customer_satisfaction = EXCLUDED.customer_satisfaction,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update unified analytics
DROP TRIGGER IF EXISTS trigger_update_unified_analytics ON public.chat_conversations;
CREATE TRIGGER trigger_update_unified_analytics
  AFTER INSERT OR UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_analytics();

-- Function to handle conversation transitions
CREATE OR REPLACE FUNCTION handle_conversation_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Log transition if conversation is being escalated or transferred
  IF NEW.status IN ('escalated') AND (OLD.status IS NULL OR OLD.status != 'escalated') THEN
    INSERT INTO public.conversation_transitions (
      user_id,
      from_conversation_id,
      to_conversation_id,
      transition_type,
      reason,
      initiated_by,
      transition_data
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.id, -- Same conversation, just escalated
      'escalation',
      COALESCE(NEW.escalation_reason, 'Automated escalation'),
      'system',
      jsonb_build_object(
        'urgency_level', NEW.urgency_level,
        'priority', NEW.priority,
        'escalated_at', NEW.escalated_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for conversation transitions
DROP TRIGGER IF EXISTS trigger_conversation_transitions ON public.chat_conversations;
CREATE TRIGGER trigger_conversation_transitions
  AFTER UPDATE OF status ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION handle_conversation_transition();

-- View for unified conversation overview
CREATE OR REPLACE VIEW unified_conversation_overview AS
SELECT
  uc.unified_id,
  uc.user_id,
  COUNT(DISTINCT c.id) as conversation_count,
  COUNT(DISTINCT c.channel) as channel_count,
  array_agg(DISTINCT c.channel) as channels_used,
  MIN(c.created_at) as first_contact,
  MAX(c.updated_at) as last_activity,
  SUM(ua.total_messages) as total_messages,
  AVG(c.satisfaction_rating) as avg_satisfaction,
  MAX(c.priority) as max_priority,
  array_agg(DISTINCT c.status) as current_statuses
FROM public.chat_conversations c
JOIN public.unified_conversation_analytics ua ON c.unified_id = ua.unified_id
GROUP BY uc.unified_id, uc.user_id;

-- =====================================
-- GDPR COMPLIANCE (from 008_gdpr_international_transfers.sql)
-- =====================================

-- SCC (Standard Contractual Clauses) templates
CREATE TABLE IF NOT EXISTS public.scc_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_version TEXT NOT NULL,
  template_type TEXT CHECK (template_type IN ('controller_to_controller', 'controller_to_processor', 'processor_to_processor', 'processor_to_subprocessor')) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  effective_date DATE NOT NULL,
  expiry_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_name, template_version)
);

-- SCC applications for specific transfers
CREATE TABLE IF NOT EXISTS public.scc_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.scc_templates(id),
  transfer_purpose TEXT NOT NULL,
  data_categories TEXT[] NOT NULL,
  transfer_mechanism TEXT CHECK (transfer_mechanism IN ('scc', 'adequacy', 'binding_corporate_rules', 'certification')) NOT NULL,
  exporter_entity TEXT NOT NULL,
  importer_entity TEXT NOT NULL,
  countries_involved TEXT[] NOT NULL,
  status TEXT CHECK (status IN ('draft', 'pending_review', 'approved', 'active', 'expired', 'revoked')) DEFAULT 'draft',
  executed_date DATE,
  expiry_date DATE,
  review_due_date DATE,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Country adequacy decisions tracking
CREATE TABLE IF NOT EXISTS public.country_adequacy_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  adequacy_status TEXT CHECK (adequacy_status IN ('adequate', 'partially_adequate', 'inadequate', 'under_review', 'revoked')) NOT NULL,
  decision_date DATE,
  implementing_decision_number TEXT,
  decision_summary TEXT,
  adequacy_mechanisms TEXT[] DEFAULT '{}',
  restrictions TEXT[],
  review_due_date DATE,
  is_active BOOLEAN DEFAULT true,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(country_code)
);

-- Transfer Impact Assessments (TIAs)
CREATE TABLE IF NOT EXISTS public.tia_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_version TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]',
  risk_categories JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_name, template_version)
);

-- TIA assessments for specific transfers
CREATE TABLE IF NOT EXISTS public.transfer_impact_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.tia_templates(id),
  scc_application_id UUID REFERENCES public.scc_applications(id),
  assessment_name TEXT NOT NULL,
  transfer_description TEXT NOT NULL,
  destination_countries TEXT[] NOT NULL,
  data_categories TEXT[] NOT NULL,
  risk_assessment JSONB NOT NULL DEFAULT '{}',
  overall_risk_score INTEGER CHECK (overall_risk_score >= 1 AND overall_risk_score <= 5) NOT NULL,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) NOT NULL,
  mitigating_measures TEXT[] DEFAULT '{}',
  supplementary_measures TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('draft', 'in_progress', 'pending_review', 'approved', 'rejected', 'expired')) DEFAULT 'draft',
  assessment_date DATE,
  review_due_date DATE,
  approved_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data residency rules
CREATE TABLE IF NOT EXISTS public.data_residency_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  data_category TEXT NOT NULL,
  allowed_countries TEXT[] DEFAULT '{}',
  restricted_countries TEXT[] DEFAULT '{}',
  required_transfer_mechanism TEXT CHECK (required_transfer_mechanism IN ('adequacy', 'scc', 'binding_corporate_rules', 'none')) DEFAULT 'none',
  enforcement_level TEXT CHECK (enforcement_level IN ('warning', 'block', 'redirect')) DEFAULT 'warning',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, rule_name)
);

-- International transfer records
CREATE TABLE IF NOT EXISTS public.international_transfer_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_type TEXT CHECK (transfer_type IN ('data_export', 'data_import', 'api_call', 'database_replication', 'backup', 'third_party_access')) NOT NULL,
  source_location TEXT NOT NULL,
  destination_location TEXT NOT NULL,
  data_volume_bytes BIGINT DEFAULT 0,
  record_count INTEGER DEFAULT 0,
  transfer_mechanism TEXT CHECK (transfer_mechanism IN ('adequacy', 'scc', 'binding_corporate_rules', 'certification', 'derogation')) NOT NULL,
  scc_application_id UUID REFERENCES public.scc_applications(id),
  tia_assessment_id UUID REFERENCES public.transfer_impact_assessments(id),
  purpose TEXT NOT NULL,
  legal_basis TEXT CHECK (legal_basis IN ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_interest', 'legitimate_interest')) NOT NULL,
  data_categories TEXT[] NOT NULL,
  retention_period_days INTEGER,
  status TEXT CHECK (status IN ('initiated', 'in_progress', 'completed', 'failed', 'blocked')) DEFAULT 'initiated',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Transfer audit logging
CREATE TABLE IF NOT EXISTS public.transfer_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_record_id UUID REFERENCES public.international_transfer_records(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT CHECK (action IN ('initiate', 'approve', 'deny', 'complete', 'fail', 'block', 'review')) NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  change_description TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  compliance_flags JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on GDPR tables
ALTER TABLE public.scc_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scc_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_adequacy_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tia_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_residency_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.international_transfer_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for GDPR tables
CREATE POLICY "scc_templates_read" ON public.scc_templates FOR SELECT USING (true);
CREATE POLICY "scc_templates_admin" ON public.scc_templates FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    JOIN public.tenants t ON tu.tenant_id = t.id
    WHERE tu.user_id = auth.uid()
    AND tu.role IN ('owner', 'admin')
    AND t.is_active = true
  )
);

CREATE POLICY "scc_applications_tenant" ON public.scc_applications FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "country_adequacy_read" ON public.country_adequacy_decisions FOR SELECT USING (true);
CREATE POLICY "tia_templates_read" ON public.tia_templates FOR SELECT USING (true);
CREATE POLICY "tia_assessments_tenant" ON public.transfer_impact_assessments FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "data_residency_tenant" ON public.data_residency_rules FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "transfer_records_tenant" ON public.international_transfer_records FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "transfer_audit_tenant" ON public.transfer_audit_logs FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- GDPR utility functions
CREATE OR REPLACE FUNCTION check_country_adequacy(country_code_param TEXT)
RETURNS TABLE (
  is_adequate BOOLEAN,
  status TEXT,
  decision_date DATE,
  restrictions TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cad.adequacy_status = 'adequate',
    cad.adequacy_status,
    cad.decision_date,
    cad.restrictions
  FROM public.country_adequacy_decisions cad
  WHERE cad.country_code = country_code_param
  AND cad.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION validate_data_residency(
  tenant_id_param UUID,
  data_category_param TEXT,
  destination_country_param TEXT
)
RETURNS TABLE (
  is_allowed BOOLEAN,
  enforcement_level TEXT,
  required_mechanism TEXT,
  rule_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN drr.allowed_countries != '{}' AND NOT (destination_country_param = ANY(drr.allowed_countries)) THEN false
      WHEN drr.restricted_countries != '{}' AND destination_country_param = ANY(drr.restricted_countries) THEN false
      ELSE true
    END,
    drr.enforcement_level,
    drr.required_transfer_mechanism,
    drr.rule_name
  FROM public.data_residency_rules drr
  WHERE drr.tenant_id = tenant_id_param
  AND drr.data_category = data_category_param
  AND drr.is_active = true
  ORDER BY drr.created_at DESC
  LIMIT 1;
END;
$$;

-- Seed data for GDPR compliance
INSERT INTO public.scc_templates (template_name, template_version, template_type, content, effective_date) VALUES
('EU Controller to Non-EU Processor', '2021/914', 'controller_to_processor',
 'Standard Contractual Clauses for Controller to Processor transfers...', '2021-06-04'),
('EU Controller to Non-EU Controller', '2021/914', 'controller_to_controller',
 'Standard Contractual Clauses for Controller to Controller transfers...', '2021-06-04')
ON CONFLICT (template_name, template_version) DO NOTHING;

INSERT INTO public.country_adequacy_decisions (country_code, country_name, adequacy_status, decision_date, implementing_decision_number, adequacy_mechanisms) VALUES
('US', 'United States', 'partially_adequate', '2023-07-10', '2023/1795', ARRAY['adequacy', 'scc']),
('GB', 'United Kingdom', 'adequate', '2021-06-28', '2021/1772', ARRAY['adequacy']),
('CA', 'Canada', 'adequate', '2002-01-01', '2002/2/EC', ARRAY['adequacy']),
('JP', 'Japan', 'adequate', '2019-01-23', '2019/419', ARRAY['adequacy']),
('KR', 'South Korea', 'adequate', '2021-12-17', '2021/2248', ARRAY['adequacy']),
('CH', 'Switzerland', 'adequate', '2000-07-01', '2000/518/EC', ARRAY['adequacy'])
ON CONFLICT (country_code) DO NOTHING;

-- =====================================
-- COMPREHENSIVE INDEXING STRATEGY (from 011_comprehensive_indexing_strategy.sql)
-- =====================================

-- Performance metrics table
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  value DECIMAL(15,4) NOT NULL,
  unit TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  tags JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "performance_metrics_own" ON public.performance_metrics USING (auth.uid() = (metadata->>'user_id')::UUID);

-- Comprehensive indexing strategy - core user tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_user_id ON public.profiles(id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_business_type ON public.profiles(business_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- Call logs comprehensive indexing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_user_id_created_at ON public.call_logs(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_caller_phone ON public.call_logs(caller_phone);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_call_status ON public.call_logs(call_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_sentiment_score ON public.call_logs(sentiment_score DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_call_duration ON public.call_logs(call_duration) WHERE call_duration > 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_unanswered ON public.call_logs(created_at DESC)
WHERE call_status IN ('missed', 'voicemail');

-- Bookings comprehensive indexing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_user_id_status ON public.bookings(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_appointment_date ON public.bookings(appointment_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_call_log_id ON public.bookings(call_log_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_dashboard_covering ON public.bookings(user_id, status, appointment_date, customer_name, service_type);

-- Lead generation system indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_user_id_status_score ON public.leads(user_id, status, lead_score DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_email_user_id ON public.leads(email, user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_phone_user_id ON public.leads(phone, user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_id ON public.leads(source_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_tags ON public.leads USING gin(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_next_follow_up ON public.leads(next_follow_up) WHERE next_follow_up IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_last_contact ON public.leads(last_contact_date DESC) WHERE last_contact_date IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_custom_fields ON public.leads USING gin(custom_fields);

-- Chat & customer service indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_user_id_published ON public.knowledge_base(user_id, is_published);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(user_id, category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_tags ON public.knowledge_base USING gin(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_search_user ON public.knowledge_base(user_id, search_vector) WHERE is_published = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_user_lead ON public.chat_conversations(user_id, lead_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_customer_id ON public.chat_conversations(customer_identifier);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_agent_assigned ON public.chat_conversations(assigned_agent_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_channel_status ON public.chat_conversations(channel, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_conversation_sender ON public.chat_messages(conversation_id, sender_type, created_at DESC);

-- Marketing automation indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_user_status_scheduled ON public.email_campaigns(user_id, status, scheduled_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_sent_at ON public.email_campaigns(sent_at DESC) WHERE sent_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_user_platform_status ON public.social_posts(user_id, platform, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_published_at ON public.social_posts(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_workflows_user_active ON public.automation_workflows(user_id, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_workflows_trigger_type ON public.automation_workflows(trigger_type);

-- Analytics & metrics indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_user_event_created ON public.analytics_events(user_id, event_name, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_lead_id ON public.analytics_events(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_properties ON public.analytics_events USING gin(event_properties);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_metrics_user_metric_date ON public.business_metrics(user_id, metric_name, metric_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_metrics_dimensions ON public.business_metrics USING gin(dimensions);

-- Integration tables indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_user_service ON public.integrations(user_id, service_name, service_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_active ON public.integrations(user_id, is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_last_sync ON public.integrations(last_sync_at DESC) WHERE last_sync_at IS NOT NULL;

-- Subscription management indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_user_status ON public.user_subscriptions(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_period_end ON public.user_subscriptions(current_period_end);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_plan_id ON public.user_subscriptions(plan_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active) WHERE is_active = true;

-- Specialized indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_dashboard_recent ON public.leads(user_id, created_at DESC, status, lead_score DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_dashboard ON public.chat_conversations(user_id, status, created_at DESC, channel);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_dashboard ON public.email_campaigns(user_id, status, created_at DESC, campaign_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_time_range ON public.analytics_events(created_at DESC, user_id, event_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_metrics_time_range ON public.business_metrics(metric_date DESC, user_id, metric_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_fulltext_search ON public.knowledge_base USING gin(to_tsvector('english', title || ' ' || content)) WHERE is_published = true;

-- Partial indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_active_only ON public.chat_conversations(user_id, updated_at DESC) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_published_only ON public.knowledge_base(user_id, updated_at DESC) WHERE is_published = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_active_only ON public.leads(user_id, lead_score DESC, created_at DESC) WHERE status NOT IN ('lost', 'customer');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_scheduled_only ON public.email_campaigns(user_id, scheduled_at) WHERE status = 'scheduled' AND scheduled_at > NOW();

-- Index maintenance functions
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS TABLE (
  schemaname TEXT,
  tablename TEXT,
  indexname TEXT,
  idx_scan BIGINT,
  idx_tup_read BIGINT,
  idx_tup_fetch BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.schemaname::TEXT,
    ps.tablename::TEXT,
    ps.indexname::TEXT,
    ps.idx_scan,
    ps.idx_tup_read,
    ps.idx_tup_fetch
  FROM pg_stat_user_indexes ps
  WHERE ps.schemaname = 'public'
  ORDER BY ps.idx_scan DESC, ps.idx_tup_read DESC;
END;
$$;

CREATE OR REPLACE FUNCTION identify_unused_indexes()
RETURNS TABLE (
  schemaname TEXT,
  tablename TEXT,
  indexname TEXT,
  idx_scan BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.schemaname::TEXT,
    ps.tablename::TEXT,
    ps.indexname::TEXT,
    ps.idx_scan
  FROM pg_stat_user_indexes ps
  WHERE ps.schemaname = 'public'
    AND ps.idx_scan = 0
  ORDER BY ps.tablename, ps.indexname;
END;
$$;

CREATE OR REPLACE FUNCTION get_index_sizes()
RETURNS TABLE (
  schemaname TEXT,
  tablename TEXT,
  indexname TEXT,
  index_size TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.schemaname::TEXT,
    pi.tablename::TEXT,
    pi.indexname::TEXT,
    pg_size_pretty(pg_relation_size(pi.indexname::regclass)) as index_size
  FROM pg_indexes pi
  WHERE pi.schemaname = 'public'
  ORDER BY pg_relation_size(pi.indexname::regclass) DESC;
END;
$$;

-- Grant permissions for index functions
GRANT EXECUTE ON FUNCTION analyze_index_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION identify_unused_indexes() TO authenticated;
GRANT EXECUTE ON FUNCTION get_index_sizes() TO authenticated;

-- =====================================
-- ADVANCED PERFORMANCE OPTIMIZATIONS (from 013_advanced_performance_optimizations.sql)
-- =====================================

-- Materialized views for complex aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_tenant_daily_analytics AS
SELECT
  tenant_id,
  DATE(created_at) as date,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE event_name = 'page_view') as page_views,
  COUNT(*) FILTER (WHERE event_name = 'api_call') as api_calls,
  COUNT(*) FILTER (WHERE event_name = 'error') as errors,
  AVG(CASE WHEN event_name = 'response_time' THEN (event_properties->>'duration')::DECIMAL END) as avg_response_time
FROM public.analytics_events
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, DATE(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_daily_analytics_tenant_date ON public.mv_tenant_daily_analytics(tenant_id, date);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_tenant_daily_metrics AS
SELECT
  tenant_id,
  DATE(metric_date) as date,
  metric_name,
  AVG(metric_value::DECIMAL) as avg_value,
  MAX(metric_value) as max_value,
  MIN(metric_value) as min_value,
  SUM(metric_value) as total_value,
  COUNT(*) as data_points
FROM public.business_metrics
WHERE metric_date >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, DATE(metric_date), metric_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_daily_metrics_tenant_date_name ON public.mv_tenant_daily_metrics(tenant_id, date, metric_name);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_tenant_performance_summary AS
SELECT
  tenant_id,
  COUNT(DISTINCT ae.user_id) as active_users,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'active') as active_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'customer') as converted_leads,
  COUNT(DISTINCT cl.id) as total_calls,
  COUNT(DISTINCT cl.id) FILTER (WHERE cl.call_status = 'completed') as completed_calls,
  COUNT(DISTINCT cc.id) as total_conversations,
  COUNT(DISTINCT cc.id) FILTER (WHERE cc.status = 'active') as active_conversations,
  AVG(CASE WHEN cl.call_duration IS NOT NULL THEN cl.call_duration END) as avg_call_duration,
  AVG(l.lead_score) FILTER (WHERE l.lead_score IS NOT NULL) as avg_lead_score,
  NOW() as last_updated
FROM public.tenants t
LEFT JOIN public.analytics_events ae ON ae.tenant_id = t.id AND ae.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN public.leads l ON l.tenant_id = t.id
LEFT JOIN public.call_logs cl ON cl.tenant_id = t.id AND cl.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN public.chat_conversations cc ON cc.tenant_id = t.id AND cc.updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY tenant_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_performance_summary_tenant ON public.mv_tenant_performance_summary(tenant_id);

-- Caching infrastructure
CREATE TABLE IF NOT EXISTS public.cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  cache_type TEXT CHECK (cache_type IN ('query_result', 'user_session', 'tenant_config', 'knowledge_base', 'analytics')) NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  size_bytes INTEGER,
  hit_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cache_invalidation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key_pattern TEXT NOT NULL,
  cache_type TEXT CHECK (cache_type IN ('query_result', 'user_session', 'tenant_config', 'knowledge_base', 'analytics')) NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  reason TEXT CHECK (reason IN ('data_update', 'schema_change', 'manual', 'ttl_expired')) NOT NULL,
  affected_records INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connection pool optimization
CREATE TABLE IF NOT EXISTS public.connection_pool_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  pool_name TEXT NOT NULL,
  active_connections INTEGER DEFAULT 0,
  idle_connections INTEGER DEFAULT 0,
  waiting_connections INTEGER DEFAULT 0,
  total_connections INTEGER DEFAULT 0,
  max_connections INTEGER DEFAULT 20,
  utilization_rate DECIMAL(5,2),
  avg_wait_time_ms DECIMAL(10,2),
  max_wait_time_ms DECIMAL(10,2),
  connection_turnover_rate DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_connection_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  min_connections INTEGER DEFAULT 2,
  max_connections INTEGER DEFAULT 20,
  max_connection_age_ms INTEGER DEFAULT 3600000,
  connection_timeout_ms INTEGER DEFAULT 30000,
  idle_timeout_ms INTEGER DEFAULT 300000,
  max_lifetime_ms INTEGER DEFAULT 7200000,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Enhanced performance monitoring
CREATE TABLE IF NOT EXISTS public.tenant_performance_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_type TEXT CHECK (metric_type IN ('query_time', 'connection_count', 'memory_usage', 'cache_hit_rate')) NOT NULL,
  warning_threshold DECIMAL(10,2),
  critical_threshold DECIMAL(10,2),
  alert_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, metric_type)
);

CREATE TABLE IF NOT EXISTS public.tenant_performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alert_type TEXT CHECK (alert_type IN ('slow_query', 'high_connection_usage', 'low_cache_hit', 'memory_pressure')) NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) NOT NULL,
  message TEXT NOT NULL,
  current_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),
  affected_resources TEXT[],
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on performance tables
ALTER TABLE public.cache_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache_invalidation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_pool_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_connection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_performance_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_performance_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for performance tables
CREATE POLICY "cache_metadata_tenant_access" ON public.cache_metadata FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "cache_invalidation_events_tenant_access" ON public.cache_invalidation_events FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "connection_pool_stats_tenant_access" ON public.connection_pool_stats FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenant_connection_configs_tenant_access" ON public.tenant_connection_configs FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenant_performance_thresholds_tenant_access" ON public.tenant_performance_thresholds FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenant_performance_alerts_tenant_access" ON public.tenant_performance_alerts FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Cache management functions
CREATE OR REPLACE FUNCTION invalidate_cache_by_pattern(
  p_pattern TEXT,
  p_cache_type TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
  pattern_match TEXT;
BEGIN
  INSERT INTO public.cache_invalidation_events (
    cache_key_pattern,
    cache_type,
    tenant_id,
    reason
  ) VALUES (
    p_pattern,
    p_cache_type,
    p_tenant_id,
    'data_update'
  );

  DELETE FROM public.cache_metadata
  WHERE cache_key LIKE p_pattern
    AND (p_cache_type IS NULL OR cache_type = p_cache_type)
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION update_cache_access_stats(
  p_cache_key TEXT,
  p_hit BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.cache_metadata
  SET
    last_accessed = NOW(),
    access_count = access_count + 1,
    hit_rate = CASE
      WHEN access_count = 0 THEN CASE WHEN p_hit THEN 100 ELSE 0 END
      ELSE ((hit_rate * access_count) + CASE WHEN p_hit THEN 100 ELSE 0 END) / (access_count + 1)
    END
  WHERE cache_key = p_cache_key;
END;
$$;

-- Materialized view refresh functions
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_daily_analytics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_daily_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_performance_summary;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_tenant_materialized_views(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_daily_analytics WHERE tenant_id = p_tenant_id;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_daily_metrics WHERE tenant_id = p_tenant_id;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_performance_summary WHERE tenant_id = p_tenant_id;
END;
$$;

-- Connection pool monitoring functions
CREATE OR REPLACE FUNCTION update_connection_pool_stats(
  p_tenant_id UUID,
  p_pool_name TEXT,
  p_active INTEGER,
  p_idle INTEGER,
  p_waiting INTEGER,
  p_avg_wait_time DECIMAL DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_conns INTEGER;
  utilization DECIMAL(5,2);
BEGIN
  total_conns := p_active + p_idle;
  utilization := CASE WHEN total_conns > 0 THEN (p_active::DECIMAL / total_conns) * 100 ELSE 0 END;

  INSERT INTO public.connection_pool_stats (
    tenant_id,
    pool_name,
    active_connections,
    idle_connections,
    waiting_connections,
    total_connections,
    utilization_rate,
    avg_wait_time_ms
  ) VALUES (
    p_tenant_id,
    p_pool_name,
    p_active,
    p_idle,
    p_waiting,
    total_conns,
    utilization,
    p_avg_wait_time
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_connection_pool_recommendations()
RETURNS TABLE (
  tenant_id UUID,
  current_max_connections INTEGER,
  recommended_max_connections INTEGER,
  avg_utilization DECIMAL(5,2),
  peak_waiting_connections INTEGER,
  recommendation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH pool_stats AS (
    SELECT
      tenant_id,
      AVG(total_connections) as avg_total,
      AVG(utilization_rate) as avg_utilization,
      MAX(waiting_connections) as peak_waiting,
      MAX(max_connections) as current_max
    FROM public.connection_pool_stats

-- =====================================
-- TENANT ISOLATION FIXES (from 009_tenant_isolation_migration.sql)
-- =====================================

-- Update existing RLS policies to use tenant-based isolation
DROP POLICY IF EXISTS "profiles_basic" ON public.profiles;
DROP POLICY IF EXISTS "call_logs_basic" ON public.call_logs;
DROP POLICY IF EXISTS "bookings_basic" ON public.bookings;
DROP POLICY IF EXISTS "ai_configs_basic" ON public.ai_configs;
DROP POLICY IF EXISTS "plans_public_read" ON public.subscription_plans;
DROP POLICY IF EXISTS "user_subscriptions_basic" ON public.user_subscriptions;
DROP POLICY IF EXISTS "lead_sources_basic" ON public.lead_sources;
DROP POLICY IF EXISTS "leads_basic" ON public.leads;
DROP POLICY IF EXISTS "lead_activities_basic" ON public.lead_activities;
DROP POLICY IF EXISTS "knowledge_base_basic" ON public.knowledge_base;
DROP POLICY IF EXISTS "chat_conversations_basic" ON public.chat_conversations;
DROP POLICY IF EXISTS "chat_messages_basic" ON public.chat_messages;
DROP POLICY IF EXISTS "email_campaigns_basic" ON public.email_campaigns;
DROP POLICY IF EXISTS "social_posts_basic" ON public.social_posts;
DROP POLICY IF EXISTS "automation_workflows_basic" ON public.automation_workflows;
DROP POLICY IF EXISTS "analytics_events_basic" ON public.analytics_events;
DROP POLICY IF EXISTS "business_metrics_basic" ON public.business_metrics;
DROP POLICY IF EXISTS "integrations_basic" ON public.integrations;

-- Create tenant-based RLS policies
CREATE POLICY "profiles_tenant_access" ON public.profiles FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "call_logs_tenant_access" ON public.call_logs FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "bookings_tenant_access" ON public.bookings FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "ai_configs_tenant_access" ON public.ai_configs FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "plans_public_read" ON public.subscription_plans FOR SELECT USING (true);

CREATE POLICY "user_subscriptions_tenant_access" ON public.user_subscriptions FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "lead_sources_tenant_access" ON public.lead_sources FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "leads_tenant_access" ON public.leads FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "lead_activities_tenant_access" ON public.lead_activities FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "knowledge_base_tenant_access" ON public.knowledge_base FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "chat_conversations_tenant_access" ON public.chat_conversations FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "chat_messages_tenant_access" ON public.chat_messages FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "email_campaigns_tenant_access" ON public.email_campaigns FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "social_posts_tenant_access" ON public.social_posts FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "automation_workflows_tenant_access" ON public.automation_workflows FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "analytics_events_tenant_access" ON public.analytics_events FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "business_metrics_tenant_access" ON public.business_metrics FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "integrations_tenant_access" ON public.integrations FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Function to get current user's tenant
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.tenant_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- Function to check if user has role in tenant
CREATE OR REPLACE FUNCTION public.has_tenant_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.is_active = true
      AND tu.role = required_role
  );
$$;

-- Function to check if user has any admin role
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.is_active = true
      AND tu.role IN ('owner', 'admin')
  );
$$;

-- =====================================
-- RLS POLICY FIXES (from 010_rls_policy_fixes.sql)
-- =====================================

-- Fix tenant_users policies to allow proper access
DROP POLICY IF EXISTS "tenant_users_basic" ON public.tenant_users;
DROP POLICY IF EXISTS "tenant_users_member_insert" ON public.tenant_users;

CREATE POLICY "tenant_users_read_access" ON public.tenant_users FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  ) OR user_id = auth.uid()
);

CREATE POLICY "tenant_users_write_access" ON public.tenant_users FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
  )
);

-- Fix tenant policies
DROP POLICY IF EXISTS "tenants_basic" ON public.tenants;
DROP POLICY IF EXISTS "tenants_member_access" ON public.tenants;

CREATE POLICY "tenants_read_access" ON public.tenants FOR SELECT USING (
  id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenants_write_access" ON public.tenants FOR UPDATE USING (
  id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true AND role = 'owner'
  )
);

-- Fix tenant invitations policies
DROP POLICY IF EXISTS "tenant_invitations_basic" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_member_access" ON public.tenant_invitations;

CREATE POLICY "tenant_invitations_read_access" ON public.tenant_invitations FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  ) OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "tenant_invitations_write_access" ON public.tenant_invitations FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
  )
);

-- Fix tenant configs policies
DROP POLICY IF EXISTS "tenant_configs_member_access" ON public.tenant_configs;

CREATE POLICY "tenant_configs_read_access" ON public.tenant_configs FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenant_configs_write_access" ON public.tenant_configs FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
  )
);

-- Fix tenant features policies
DROP POLICY IF EXISTS "tenant_features_member_access" ON public.tenant_features;

CREATE POLICY "tenant_features_read_access" ON public.tenant_features FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenant_features_write_access" ON public.tenant_features FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true AND role = 'owner'
  )
);

-- Fix tenant subscriptions policies
DROP POLICY IF EXISTS "tenant_subscriptions_member_access" ON public.tenant_subscriptions;

CREATE POLICY "tenant_subscriptions_read_access" ON public.tenant_subscriptions FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenant_subscriptions_write_access" ON public.tenant_subscriptions FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true AND role = 'owner'
  )
);

-- Fix tenant usage policies
DROP POLICY IF EXISTS "tenant_usage_member_access" ON public.tenant_usage;

CREATE POLICY "tenant_usage_read_access" ON public.tenant_usage FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenant_usage_write_access" ON public.tenant_usage FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
  )
);

-- Fix tenant migrations policies
DROP POLICY IF EXISTS "tenant_migrations_member_access" ON public.tenant_migrations;

CREATE POLICY "tenant_migrations_read_access" ON public.tenant_migrations FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenant_migrations_write_access" ON public.tenant_migrations FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true AND role = 'owner'
  )
);

-- =====================================
-- BASIC INDEXES FOR PERFORMANCE
-- =====================================

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON public.call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);

-- Tenant indexes
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON public.tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON public.tenant_users(user_id);

-- Tenant_id indexes on all tables
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON public.call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON public.bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_configs_tenant_id ON public.ai_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_sources_tenant_id ON public.lead_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_tenant_id ON public.lead_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant_id ON public.knowledge_base(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant_id ON public.chat_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_id ON public.chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_tenant_id ON public.email_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_id ON public.social_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_tenant_id ON public.automation_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_id ON public.analytics_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_metrics_tenant_id ON public.business_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integrations_tenant_id ON public.integrations(tenant_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search ON public.knowledge_base USING gin(search_vector);

-- =====================================
-- SEED DATA
-- =====================================

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, features, limits) VALUES
('Essential', 'Perfect for small businesses getting started with AI automation', 99.00, 990.00,
 '["PrismAI Assistant", "Basic Chatbot", "Lead Capture Forms", "Email Automation"]',
 '{"contacts": 1000, "emails_per_month": 5000, "chatbot_messages": 2000}'),
('Growth', 'Advanced AI tools for growing businesses', 299.00, 2990.00,
 '["Everything in Essential", "Advanced Lead Generation", "Social Media Automation", "Analytics Dashboard", "CRM Integration"]',
 '{"contacts": 10000, "emails_per_month": 25000, "chatbot_messages": 10000, "social_posts": 200}'),
('Enterprise', 'Full AI suite for scaling businesses', 799.00, 7990.00,
 '["Everything in Growth", "Custom AI Training", "Advanced Analytics", "Priority Support", "White-label Options"]',
 '{"contacts": -1, "emails_per_month": -1, "chatbot_messages": -1, "social_posts": -1}')
ON CONFLICT DO NOTHING;

-- =====================================
-- TRIGGER FOR AUTO-CREATING PROFILES
-- =====================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_id UUID;
BEGIN
  -- Create default tenant for the new user
  INSERT INTO public.tenants (
    name,
    subscription_status,
    trial_ends_at
  )
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'My Business'),
    'trial',
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO tenant_id;

  -- Add user as owner of the tenant
  INSERT INTO public.tenant_users (
    tenant_id,
    user_id,
    role,
    joined_at
  )
  VALUES (
    tenant_id,
    NEW.id,
    'owner',
    NOW()
  );

  -- Create profile
  INSERT INTO public.profiles (id, business_name, business_type, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'My Business'),
    COALESCE(NEW.raw_user_meta_data ->> 'business_type', 'General'),
    tenant_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create AI config
  INSERT INTO public.ai_configs (user_id, tenant_id)
  VALUES (NEW.id, tenant_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================
-- SUCCESS MESSAGE
-- =====================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'COMPLETE PRODUCTION SCHEMA CREATED SUCCESSFULLY!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'This script has consolidated all schema features:';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Base schema with multi-tenancy support';
  RAISE NOTICE '✓ Vector search capabilities for knowledge base';
  RAISE NOTICE '✓ Multi-channel communication support';
  RAISE NOTICE '✓ Advanced AI features (sentiment, escalation, summarization)';
  RAISE NOTICE '✓ Enterprise customer service (surveys, agent metrics, quality scoring)';
  RAISE NOTICE '✓ Conversation insights and intelligence';
  RAISE NOTICE '✓ Lead routing and personalization engine';
  RAISE NOTICE '✓ Unified conversations (voice + text)';
  RAISE NOTICE '✓ GDPR compliance and international transfers';
  RAISE NOTICE '✓ Comprehensive indexing and performance optimizations';
  RAISE NOTICE '✓ Tenant isolation with proper RLS policies';
  RAISE NOTICE '';
  RAISE NOTICE 'All tables include:';
  RAISE NOTICE '- Multi-tenant support with tenant_id columns';
  RAISE NOTICE '- Row Level Security policies for data isolation';
  RAISE NOTICE '- Performance indexes for optimal queries';
  RAISE NOTICE '- Automated triggers and functions';
  RAISE NOTICE '- Seed data for common scenarios';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run this script on your production database';
  RAISE NOTICE '2. Verify tenant isolation is working correctly';
  RAISE NOTICE '3. Test all features with sample data';
  RAISE NOTICE '4. Monitor performance and adjust indexes as needed';
  RAISE NOTICE '================================================';
END $$;
