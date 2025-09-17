-- CRM Integration Schema
-- Adds support for CRM connectors, customer data synchronization, and context enrichment

-- CRM Configurations table
CREATE TABLE IF NOT EXISTS public.crm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('salesforce', 'hubspot', 'pipedrive')),
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  instance_url TEXT,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- CRM Customer Data table
CREATE TABLE IF NOT EXISTS public.crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('salesforce', 'hubspot', 'pipedrive')),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip_code TEXT,
  address_country TEXT,
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  lifecycle_stage TEXT,
  lead_score INTEGER,
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider, external_id)
);

-- CRM Conversation Context table
CREATE TABLE IF NOT EXISTS public.crm_conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('salesforce', 'hubspot', 'pipedrive')),
  context_data JSONB NOT NULL DEFAULT '{}',
  enriched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, customer_id, provider)
);

-- CRM Sync Logs table
CREATE TABLE IF NOT EXISTS public.crm_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('salesforce', 'hubspot', 'pipedrive')),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'customer', 'activity')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  records_processed INTEGER DEFAULT 0,
  errors TEXT[],
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRM Activity Logs table
CREATE TABLE IF NOT EXISTS public.crm_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  customer_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('salesforce', 'hubspot', 'pipedrive')),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'task')),
  subject TEXT NOT NULL,
  description TEXT,
  external_activity_id TEXT,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_conversation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "crm_configs_own" ON public.crm_configs USING (auth.uid() = user_id);
CREATE POLICY "crm_customers_own" ON public.crm_customers USING (auth.uid() = user_id);
CREATE POLICY "crm_conversation_context_own" ON public.crm_conversation_context USING (auth.uid() = (SELECT user_id FROM public.chat_conversations WHERE id = conversation_id));
CREATE POLICY "crm_sync_logs_own" ON public.crm_sync_logs USING (auth.uid() = user_id);
CREATE POLICY "crm_activity_logs_own" ON public.crm_activity_logs USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_configs_user_provider ON public.crm_configs(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_crm_customers_user_provider ON public.crm_customers(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_crm_customers_email ON public.crm_customers(email);
CREATE INDEX IF NOT EXISTS idx_crm_customers_phone ON public.crm_customers(phone);
CREATE INDEX IF NOT EXISTS idx_crm_conversation_context_conversation ON public.crm_conversation_context(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_user_provider ON public.crm_sync_logs(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_crm_activity_logs_conversation ON public.crm_activity_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_logs_customer ON public.crm_activity_logs(customer_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_crm_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_crm_configs_updated_at ON public.crm_configs;
CREATE TRIGGER trigger_update_crm_configs_updated_at
  BEFORE UPDATE ON public.crm_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_updated_at();

DROP TRIGGER IF EXISTS trigger_update_crm_customers_updated_at ON public.crm_customers;
CREATE TRIGGER trigger_update_crm_customers_updated_at
  BEFORE UPDATE ON public.crm_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_updated_at();

-- Function to automatically enrich conversation context when customer data is available
CREATE OR REPLACE FUNCTION enrich_conversation_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function would be called by the CRM service to enrich context
  -- For now, it's a placeholder that can be expanded
  RETURN NEW;
END;
$$;

-- Insert default CRM configurations (inactive by default)
INSERT INTO public.crm_configs (user_id, provider, is_active) VALUES
-- This will be populated when users configure their CRM integrations
-- ('00000000-0000-0000-0000-000000000000', 'salesforce', false),
-- ('00000000-0000-0000-0000-000000000000', 'hubspot', false),
-- ('00000000-0000-0000-0000-000000000000', 'pipedrive', false)
('00000000-0000-0000-0000-000000000000', 'salesforce', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_configs (user_id, provider, is_active) VALUES
('00000000-0000-0000-0000-000000000000', 'hubspot', false)
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_configs (user_id, provider, is_active) VALUES
('00000000-0000-0000-0000-000000000000', 'pipedrive', false)
ON CONFLICT DO NOTHING;