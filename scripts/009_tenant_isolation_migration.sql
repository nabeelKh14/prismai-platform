-- Tenant Isolation Migration
-- This script updates all existing tables to use tenant-based row-level security

-- =====================================
-- HELPER FUNCTIONS FOR TENANT ACCESS
-- =====================================

-- Function to get current user's tenant IDs
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(tenant_id)
  FROM public.tenant_users
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Function to check if user has access to a specific tenant
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = check_tenant_id
      AND is_active = true
  );
$$;

-- =====================================
-- UPDATE EXISTING RLS POLICIES
-- =====================================

-- Drop old user-based policies and create tenant-based ones

-- Profiles table
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;

CREATE POLICY "profiles_tenant_access" ON public.profiles FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Call logs table
DROP POLICY IF EXISTS "call_logs_select_own" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_insert_own" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_update_own" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_delete_own" ON public.call_logs;

CREATE POLICY "call_logs_tenant_access" ON public.call_logs FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Bookings table
DROP POLICY IF EXISTS "bookings_select_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_own" ON public.bookings;

CREATE POLICY "bookings_tenant_access" ON public.bookings FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- AI configs table
DROP POLICY IF EXISTS "ai_configs_select_own" ON public.ai_configs;
DROP POLICY IF EXISTS "ai_configs_insert_own" ON public.ai_configs;
DROP POLICY IF EXISTS "ai_configs_update_own" ON public.ai_configs;
DROP POLICY IF EXISTS "ai_configs_delete_own" ON public.ai_configs;

CREATE POLICY "ai_configs_tenant_access" ON public.ai_configs FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Lead sources table
DROP POLICY IF EXISTS "lead_sources_own" ON public.lead_sources;
CREATE POLICY "lead_sources_tenant_access" ON public.lead_sources FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Leads table
DROP POLICY IF EXISTS "leads_own" ON public.leads;
CREATE POLICY "leads_tenant_access" ON public.leads FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Lead activities table
DROP POLICY IF EXISTS "lead_activities_own" ON public.lead_activities;
CREATE POLICY "lead_activities_tenant_access" ON public.lead_activities FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Knowledge base table
DROP POLICY IF EXISTS "knowledge_base_own" ON public.knowledge_base;
CREATE POLICY "knowledge_base_tenant_access" ON public.knowledge_base FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Chat conversations table
DROP POLICY IF EXISTS "chat_conversations_own" ON public.chat_conversations;
CREATE POLICY "chat_conversations_tenant_access" ON public.chat_conversations FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Chat messages table
DROP POLICY IF EXISTS "chat_messages_own" ON public.chat_messages;
CREATE POLICY "chat_messages_tenant_access" ON public.chat_messages FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Email campaigns table
DROP POLICY IF EXISTS "email_campaigns_own" ON public.email_campaigns;
CREATE POLICY "email_campaigns_tenant_access" ON public.email_campaigns FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Social posts table
DROP POLICY IF EXISTS "social_posts_own" ON public.social_posts;
CREATE POLICY "social_posts_tenant_access" ON public.social_posts FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Automation workflows table
DROP POLICY IF EXISTS "automation_workflows_own" ON public.automation_workflows;
CREATE POLICY "automation_workflows_tenant_access" ON public.automation_workflows FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Analytics events table
DROP POLICY IF EXISTS "analytics_events_own" ON public.analytics_events;
CREATE POLICY "analytics_events_tenant_access" ON public.analytics_events FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Business metrics table
DROP POLICY IF EXISTS "business_metrics_own" ON public.business_metrics;
CREATE POLICY "business_metrics_tenant_access" ON public.business_metrics FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Integrations table
DROP POLICY IF EXISTS "integrations_own" ON public.integrations;
CREATE POLICY "integrations_tenant_access" ON public.integrations FOR ALL USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- =====================================
-- MIGRATION DATA SCRIPT
-- =====================================

-- This script migrates existing data to tenant structure
-- Run this after creating tenants for existing users

DO $$
DECLARE
    user_record RECORD;
    tenant_id UUID;
BEGIN
    -- Loop through all existing users
    FOR user_record IN
        SELECT id, raw_user_meta_data
        FROM auth.users
        WHERE id NOT IN (
            SELECT user_id FROM public.tenant_users WHERE is_active = true
        )
    LOOP
        -- Create tenant for user
        INSERT INTO public.tenants (
            name,
            subscription_status,
            trial_ends_at
        )
        VALUES (
            COALESCE(user_record.raw_user_meta_data ->> 'business_name', 'My Business'),
            'trial',
            NOW() + INTERVAL '30 days'
        )
        RETURNING id INTO tenant_id;

        -- Add user as owner
        INSERT INTO public.tenant_users (
            tenant_id,
            user_id,
            role,
            joined_at
        )
        VALUES (
            tenant_id,
            user_record.id,
            'owner',
            NOW()
        );

        -- Update existing data with tenant_id
        UPDATE public.profiles SET tenant_id = tenant_id WHERE id = user_record.id;
        UPDATE public.call_logs SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.bookings SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.ai_configs SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.lead_sources SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.leads SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.lead_activities SET tenant_id = tenant_id WHERE lead_id IN (
            SELECT id FROM public.leads WHERE user_id = user_record.id
        );
        UPDATE public.knowledge_base SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.chat_conversations SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.chat_messages SET tenant_id = tenant_id WHERE conversation_id IN (
            SELECT id FROM public.chat_conversations WHERE user_id = user_record.id
        );
        UPDATE public.email_campaigns SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.social_posts SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.automation_workflows SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.analytics_events SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.business_metrics SET tenant_id = tenant_id WHERE user_id = user_record.id;
        UPDATE public.integrations SET tenant_id = tenant_id WHERE user_id = user_record.id;

        RAISE NOTICE 'Migrated user % to tenant %', user_record.id, tenant_id;
    END LOOP;

    RAISE NOTICE 'Migration completed successfully';
END $$;

-- =====================================
-- CREATE DEFAULT FEATURES FOR EXISTING TENANTS
-- =====================================

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
-- VALIDATION QUERIES
-- =====================================

-- Check that all tables have tenant_id populated
DO $$
DECLARE
    table_name TEXT;
    null_count INTEGER;
BEGIN
    FOR table_name IN
        SELECT unnest(ARRAY[
            'profiles', 'call_logs', 'bookings', 'ai_configs', 'lead_sources',
            'leads', 'lead_activities', 'knowledge_base', 'chat_conversations',
            'chat_messages', 'email_campaigns', 'social_posts', 'automation_workflows',
            'analytics_events', 'business_metrics', 'integrations'
        ])
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE tenant_id IS NULL', table_name)
        INTO null_count;

        IF null_count > 0 THEN
            RAISE WARNING 'Table % has % rows with NULL tenant_id', table_name, null_count;
        ELSE
            RAISE NOTICE 'Table % migration completed successfully', table_name;
        END IF;
    END LOOP;
END $$;

-- =====================================
-- PERFORMANCE OPTIMIZATION
-- =====================================

-- Create partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_active ON public.profiles(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_created ON public.call_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON public.leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant_active ON public.chat_conversations(tenant_id, status) WHERE status = 'active';

-- =====================================
-- AUDIT LOGGING
-- =====================================

-- Create audit log for tenant isolation changes
CREATE TABLE IF NOT EXISTS public.tenant_isolation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id UUID,
  tenant_id UUID,
  user_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit table
ALTER TABLE public.tenant_isolation_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_audit_tenant_access" ON public.tenant_isolation_audit FOR SELECT USING (
  tenant_id = ANY(get_user_tenant_ids())
);

-- Function to log tenant isolation changes
CREATE OR REPLACE FUNCTION public.log_tenant_isolation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_isolation_audit (
    table_name,
    operation,
    record_id,
    tenant_id,
    user_id,
    old_values,
    new_values
  )
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add audit triggers to key tables (optional - uncomment if needed)
-- CREATE TRIGGER audit_profiles_changes AFTER INSERT OR UPDATE OR DELETE ON public.profiles
--   FOR EACH ROW EXECUTE FUNCTION public.log_tenant_isolation_change();
--
-- CREATE TRIGGER audit_leads_changes AFTER INSERT OR UPDATE OR DELETE ON public.leads
--   FOR EACH ROW EXECUTE FUNCTION public.log_tenant_isolation_change();

-- =====================================
-- FINAL VALIDATION
-- =====================================

-- Verify RLS is working correctly
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE '%tenant_access%';

    RAISE NOTICE 'Created % tenant-based RLS policies', policy_count;

    IF policy_count < 15 THEN
        RAISE WARNING 'Expected at least 15 tenant policies, but found %', policy_count;
    END IF;
END $$;

RAISE NOTICE 'Tenant isolation migration completed successfully!';
RAISE NOTICE 'All data has been migrated to tenant-based structure.';
RAISE NOTICE 'Row-level security is now enforced at the tenant level.';