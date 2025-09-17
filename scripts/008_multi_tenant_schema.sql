-- Multi-tenant Architecture Implementation
-- This script adds tenant isolation to the existing PrismAI

-- =====================================
-- TENANT MANAGEMENT TABLES
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

-- =====================================
-- TENANT CONFIGURATIONS
-- =====================================

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

-- =====================================
-- BILLING & USAGE TRACKING
-- =====================================

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

-- =====================================
-- MIGRATION TABLES
-- =====================================

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
-- ADD TENANT_ID TO EXISTING TABLES
-- =====================================

-- Add tenant_id to profiles (nullable for migration)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add tenant_id to all other tables
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.ai_configs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
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

-- Tenant indexes
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON public.tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON public.tenants(is_active);

-- Tenant users indexes
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON public.tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON public.tenant_users(role);

-- Tenant invitations indexes
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant_id ON public.tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON public.tenant_invitations(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON public.tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_expires_at ON public.tenant_invitations(expires_at);

-- Tenant configs indexes
CREATE INDEX IF NOT EXISTS idx_tenant_configs_tenant_id ON public.tenant_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_configs_key ON public.tenant_configs(config_key);

-- Tenant features indexes
CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant_id ON public.tenant_features(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_features_name ON public.tenant_features(feature_name);

-- Tenant subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_id ON public.tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON public.tenant_subscriptions(status);

-- Tenant usage indexes
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_id ON public.tenant_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_metric ON public.tenant_usage(metric_name);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_period ON public.tenant_usage(period_start, period_end);

-- Add tenant_id indexes to existing tables
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

-- =====================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================

-- Enable RLS on new tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_migrations ENABLE ROW LEVEL SECURITY;

-- Tenant policies (users can only see tenants they belong to)
CREATE POLICY "tenants_member_access" ON public.tenants FOR SELECT USING (
  id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Tenant users policies
CREATE POLICY "tenant_users_member_access" ON public.tenant_users FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "tenant_users_member_insert" ON public.tenant_users FOR INSERT WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
  )
);

-- Tenant invitations policies
CREATE POLICY "tenant_invitations_member_access" ON public.tenant_invitations FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Tenant configs policies
CREATE POLICY "tenant_configs_member_access" ON public.tenant_configs FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Tenant features policies
CREATE POLICY "tenant_features_member_access" ON public.tenant_features FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Tenant subscriptions policies
CREATE POLICY "tenant_subscriptions_member_access" ON public.tenant_subscriptions FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Tenant usage policies
CREATE POLICY "tenant_usage_member_access" ON public.tenant_usage FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- =====================================
-- UPDATE EXISTING RLS POLICIES
-- =====================================

-- Drop old user-based policies and create tenant-based ones
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;

-- New tenant-based policies for profiles
CREATE POLICY "profiles_tenant_access" ON public.profiles FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Update other tables similarly (showing pattern for a few key tables)
DROP POLICY IF EXISTS "call_logs_select_own" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_insert_own" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_update_own" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_delete_own" ON public.call_logs;

CREATE POLICY "call_logs_tenant_access" ON public.call_logs FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Similar pattern for other tables...
-- (In a real migration, we'd update all tables systematically)

-- =====================================
-- FUNCTIONS AND TRIGGERS
-- =====================================

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
      AND tu.role IN (
        CASE
          WHEN required_role = 'viewer' THEN ARRAY['owner', 'admin', 'manager', 'user', 'viewer']
          WHEN required_role = 'user' THEN ARRAY['owner', 'admin', 'manager', 'user']
          WHEN required_role = 'manager' THEN ARRAY['owner', 'admin', 'manager']
          WHEN required_role = 'admin' THEN ARRAY['owner', 'admin']
          WHEN required_role = 'owner' THEN ARRAY['owner']
          ELSE ARRAY[]::TEXT[]
        END
      )
  );
$$;

-- Function to create default tenant for new users
CREATE OR REPLACE FUNCTION public.create_default_tenant_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_id UUID;
BEGIN
  -- Create a default tenant for the new user
  INSERT INTO public.tenants (name, subscription_status, trial_ends_at)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'My Business'),
    'trial',
    NOW() + INTERVAL '30 days'
  )
  RETURNING id INTO tenant_id;

  -- Add user as owner of the tenant
  INSERT INTO public.tenant_users (tenant_id, user_id, role, joined_at)
  VALUES (tenant_id, NEW.id, 'owner', NOW());

  -- Update profile with tenant_id
  UPDATE public.profiles
  SET tenant_id = tenant_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Update the user creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_tenant_for_user();

-- =====================================
-- SEED DATA FOR MULTI-TENANCY
-- =====================================

-- Insert default tenant features
INSERT INTO public.tenant_features (tenant_id, feature_name, is_enabled, limits)
SELECT
  t.id,
  f.feature_name,
  f.is_enabled,
  f.limits
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('ai_receptionist', true, '{"monthly_calls": 1000}'::jsonb),
    ('chatbot', true, '{"monthly_messages": 5000}'::jsonb),
    ('lead_generation', true, '{"monthly_leads": 1000}'::jsonb),
    ('email_campaigns', true, '{"monthly_emails": 5000}'::jsonb),
    ('analytics', true, '{}'::jsonb),
    ('integrations', true, '{"max_integrations": 10}'::jsonb)
) AS f(feature_name, is_enabled, limits)
ON CONFLICT (tenant_id, feature_name) DO NOTHING;

-- =====================================
-- MIGRATION HELPERS
-- =====================================

-- Function to migrate existing data to tenant structure
CREATE OR REPLACE FUNCTION public.migrate_user_data_to_tenant(user_uuid UUID, tenant_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update all tables with tenant_id for this user
  UPDATE public.profiles SET tenant_id = tenant_uuid WHERE id = user_uuid;
  UPDATE public.call_logs SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.bookings SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.ai_configs SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.lead_sources SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.leads SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.lead_activities SET tenant_id = tenant_uuid WHERE lead_id IN (
    SELECT id FROM public.leads WHERE user_id = user_uuid
  );
  UPDATE public.knowledge_base SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.chat_conversations SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.chat_messages SET tenant_id = tenant_uuid WHERE conversation_id IN (
    SELECT id FROM public.chat_conversations WHERE user_id = user_uuid
  );
  UPDATE public.email_campaigns SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.social_posts SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.automation_workflows SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.analytics_events SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.business_metrics SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
  UPDATE public.integrations SET tenant_id = tenant_uuid WHERE user_id = user_uuid;
END;
$$;