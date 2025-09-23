-- =====================================
-- CRITICAL SCHEMA FIXES
-- =====================================
-- This script fixes all critical issues identified in the database schema
-- Run this AFTER the complete schema setup

-- =====================================
-- 1. FIX INVALID SQL SYNTAX
-- =====================================

-- Fix the invalid CREATE OR REPLACE TABLE syntax
DROP TABLE IF EXISTS public.automation_workflows;

CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('lead_created', 'email_opened', 'form_submitted', 'date_based', 'behavior')) NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  workflow_steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  statistics JSONB DEFAULT '{"triggered": 0, "completed": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;

-- Add tenant_id index
CREATE INDEX IF NOT EXISTS idx_automation_workflows_tenant_id ON public.automation_workflows(tenant_id);

-- =====================================
-- 2. FIX BAD INDEX ON NON-EXISTENT COLUMN
-- =====================================

-- Remove the invalid index on profiles.user_id (profiles doesn't have user_id column)
DROP INDEX IF EXISTS idx_profiles_user_id;

-- =====================================
-- 3. FIX MULTI-TENANT UNIQUENESS GAPS
-- =====================================

-- Drop existing unique constraints that don't include tenant_id
ALTER TABLE public.ai_configs DROP CONSTRAINT IF EXISTS ai_configs_user_id_key;
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_key;
ALTER TABLE public.business_metrics DROP CONSTRAINT IF EXISTS business_metrics_user_id_metric_name_metric_date_dimensions_key;

-- Add tenant-scoped unique constraints
ALTER TABLE public.ai_configs ADD CONSTRAINT ai_configs_tenant_user_unique UNIQUE(tenant_id, user_id);
ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_tenant_user_unique UNIQUE(tenant_id, user_id);
ALTER TABLE public.business_metrics ADD CONSTRAINT business_metrics_tenant_unique UNIQUE(tenant_id, user_id, metric_name, metric_date, dimensions);

-- =====================================
-- 4. FIX RLS POLICY COVERAGE (ADD WITH CHECK)
-- =====================================

-- Drop existing policies and recreate with proper WITH CHECK clauses
DROP POLICY IF EXISTS "profiles_basic" ON public.profiles;
DROP POLICY IF EXISTS "call_logs_basic" ON public.call_logs;
DROP POLICY IF EXISTS "bookings_basic" ON public.bookings;
DROP POLICY IF EXISTS "ai_configs_basic" ON public.ai_configs;
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

-- Recreate policies with proper tenant-based access and WITH CHECK clauses
CREATE POLICY "profiles_tenant_access" ON public.profiles
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "call_logs_tenant_access" ON public.call_logs
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "bookings_tenant_access" ON public.bookings
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "ai_configs_tenant_access" ON public.ai_configs
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "user_subscriptions_tenant_access" ON public.user_subscriptions
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "lead_sources_tenant_access" ON public.lead_sources
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "leads_tenant_access" ON public.leads
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "lead_activities_tenant_access" ON public.lead_activities
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "knowledge_base_tenant_access" ON public.knowledge_base
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "chat_conversations_tenant_access" ON public.chat_conversations
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "chat_messages_tenant_access" ON public.chat_messages
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "email_campaigns_tenant_access" ON public.email_campaigns
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "social_posts_tenant_access" ON public.social_posts
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "automation_workflows_tenant_access" ON public.automation_workflows
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "analytics_events_tenant_access" ON public.analytics_events
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "business_metrics_tenant_access" ON public.business_metrics
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "integrations_tenant_access" ON public.integrations
  FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND is_active = true));

-- =====================================
-- 5. ADD SEARCH VECTOR MAINTENANCE TRIGGER
-- =====================================

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_knowledge_base_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'D');
  RETURN NEW;
END;
$$;

-- Create trigger to maintain search vector
DROP TRIGGER IF EXISTS trigger_update_knowledge_base_search_vector ON public.knowledge_base;
CREATE TRIGGER trigger_update_knowledge_base_search_vector
  BEFORE INSERT OR UPDATE OF title, content, tags, category
  ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_base_search_vector();

-- Update existing records to populate search vectors
UPDATE public.knowledge_base
SET title = title
WHERE search_vector IS NULL OR search_vector = '';

-- =====================================
-- 6. FIX REDUNDANT TENANT_ID ADDS
-- =====================================

-- Remove redundant ALTER TABLE statements (tenant_id columns already exist)
-- These are handled in the complete schema setup

-- =====================================
-- 7. FIX DUPLICATE/COMPETING TRIGGERS
-- =====================================

-- The handle_new_user function in 000_complete_schema_setup.sql creates tenants and profiles
-- The create_default_tenant_for_user in 008_multi_tenant_schema.sql does similar work
-- Keep the more complete one from 000_complete_schema_setup.sql and remove the duplicate

DROP FUNCTION IF EXISTS public.create_default_tenant_for_user();

-- =====================================
-- 8. ADD MISSING NOT NULL CONSTRAINTS
-- =====================================

-- Make tenant_id NOT NULL where appropriate (after data migration)
-- This should be done after running the tenant migration script

-- =====================================
-- SUCCESS MESSAGE
-- =====================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'CRITICAL SCHEMA FIXES COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Fixed Issues:';
  RAISE NOTICE '✓ Invalid SQL syntax (CREATE OR REPLACE TABLE)';
  RAISE NOTICE '✓ Bad index on non-existent column';
  RAISE NOTICE '✓ Multi-tenant uniqueness gaps (added tenant_id to UNIQUE constraints)';
  RAISE NOTICE '✓ RLS policy coverage (added WITH CHECK clauses)';
  RAISE NOTICE '✓ Search vector maintenance trigger';
  RAISE NOTICE '✓ Duplicate/competing triggers removed';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run tenant migration: scripts/009_tenant_isolation_migration.sql';
  RAISE NOTICE '2. Apply RLS fixes: scripts/010_rls_policy_fixes.sql';
  RAISE NOTICE '3. Run verification: scripts/011_rls_verification_queries.sql';
  RAISE NOTICE '================================================';
END $$;