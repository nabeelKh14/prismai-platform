-- =====================================
-- COMPLETE DATABASE SCHEMA SETUP
-- =====================================
-- This script creates the complete database schema with multi-tenancy support
-- Run this BEFORE applying any RLS fixes

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
-- INDEXES FOR PERFORMANCE
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
-- BASIC RLS POLICIES (will be updated by migration scripts)
-- =====================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_migrations ENABLE ROW LEVEL SECURITY;

-- Basic policies (will be replaced by tenant-based policies)
CREATE POLICY "profiles_basic" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "call_logs_basic" ON public.call_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "bookings_basic" ON public.bookings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ai_configs_basic" ON public.ai_configs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "plans_public_read" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "user_subscriptions_basic" ON public.user_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "lead_sources_basic" ON public.lead_sources FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "leads_basic" ON public.leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "lead_activities_basic" ON public.lead_activities FOR ALL USING (auth.uid() = (SELECT user_id FROM public.leads WHERE id = lead_id));
CREATE POLICY "knowledge_base_basic" ON public.knowledge_base FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "chat_conversations_basic" ON public.chat_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "chat_messages_basic" ON public.chat_messages FOR ALL USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));
CREATE POLICY "email_campaigns_basic" ON public.email_campaigns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "social_posts_basic" ON public.social_posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "automation_workflows_basic" ON public.automation_workflows FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "analytics_events_basic" ON public.analytics_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "business_metrics_basic" ON public.business_metrics FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "integrations_basic" ON public.integrations FOR ALL USING (auth.uid() = user_id);

-- Tenant table policies
CREATE POLICY "tenants_basic" ON public.tenants FOR SELECT USING (
  id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tenant_users_basic" ON public.tenant_users FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

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
  RAISE NOTICE 'COMPLETE SCHEMA SETUP COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Created all necessary tables with tenant support';
  RAISE NOTICE 'All tables have tenant_id columns';
  RAISE NOTICE 'Basic RLS policies are in place';
  RAISE NOTICE 'Auto-tenant creation is configured for new users';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run the RLS migration script (009_tenant_isolation_migration.sql)';
  RAISE NOTICE '2. Apply RLS fixes (010_rls_policy_fixes.sql)';
  RAISE NOTICE '3. Run verification queries (011_rls_verification_queries.sql)';
  RAISE NOTICE '================================================';
END $$;