-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- TABLES
-- ============================================================================

-- agent_profiles: detailed agent information
CREATE TABLE IF NOT EXISTS public.agent_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'supervisor')),
    department TEXT,
    skills TEXT[],
    languages TEXT[] DEFAULT ARRAY['en'],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- agent_performance_metrics: performance tracking for agents
CREATE TABLE IF NOT EXISTS public.agent_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    conversations_handled INTEGER NOT NULL DEFAULT 0,
    avg_response_time_seconds NUMERIC(10,2),
    avg_resolution_time_seconds NUMERIC(10,2),
    csat_score NUMERIC(5,2),
    first_contact_resolution_rate NUMERIC(5,2),
    customer_satisfaction_rating NUMERIC(5,2),
    total_messages_sent INTEGER NOT NULL DEFAULT 0,
    total_messages_received INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (agent_id, metric_date)
);

-- agent_goals: performance goals for agents
CREATE TABLE IF NOT EXISTS public.agent_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('conversations', 'csat', 'response_time', 'resolution_time')),
    target_value NUMERIC(10,2) NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- chat_conversations: live chat conversations
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    customer_identifier TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('web', 'mobile', 'api', 'whatsapp', 'telegram', 'facebook', 'instagram')),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'assigned', 'resolved', 'escalated', 'closed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_agent UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    summary TEXT,
    summary_generated_at TIMESTAMPTZ,
    satisfaction_rating NUMERIC(3,1),
    language TEXT DEFAULT 'en',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- file_attachments: file attachments for conversations and messages
CREATE TABLE IF NOT EXISTS public.file_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- survey_templates: reusable survey templates
CREATE TABLE IF NOT EXISTS public.survey_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_event TEXT NOT NULL CHECK (trigger_event IN ('conversation_end', 'manual', 'scheduled', 'escalation')),
    delivery_channels TEXT[] DEFAULT ARRAY['email'],
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- chat_messages: messages within chat conversations
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system', 'bot')),
    sender_id UUID,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system', 'typing')),
    metadata JSONB DEFAULT '{}'::jsonb,
    detected_language TEXT,
    translated_from TEXT,
    translated_to TEXT,
    sentiment_score NUMERIC(3,2),
    intent_classification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users table (backbone for auth-linked entities)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- accounts table: organizations/tenants
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- account_users: membership + roles
CREATE TABLE IF NOT EXISTS public.account_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (account_id, user_id)
);

-- workspaces: logical environments within an account
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (account_id, slug)
);

-- workspace_members: users in a workspace
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin','member','viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);

-- agents: AI / human-like agents
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    model TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- conversations: multi-channel threads
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    channel TEXT NOT NULL, -- 'email','chat','phone','social','sms','custom'
    subject TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'normal',
    assigned_agent UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- messages within conversations
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('customer','agent','system')),
    sender_id UUID REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
    content TEXT,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    metadata JSONB DEFAULT '{}'::jsonb,
    detected_language TEXT,
    sentiment_score NUMERIC(3,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- customers / leads core table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    name TEXT,
    company TEXT,
    source TEXT,
    owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    customer_segment TEXT,
    lifecycle_stage TEXT CHECK (lifecycle_stage IN ('prospect', 'lead', 'customer', 'churned')),
    last_contact_at TIMESTAMPTZ,
    total_conversations INTEGER NOT NULL DEFAULT 0,
    satisfaction_score NUMERIC(5,2),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- lead_behavior_patterns with user_id (per instructions)
CREATE TABLE IF NOT EXISTS public.lead_behavior_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    pattern_type TEXT NOT NULL,
    score NUMERIC(5,2) NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- lead_preferences with user_id (per instructions)
CREATE TABLE IF NOT EXISTS public.lead_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    preference_type TEXT NOT NULL,
    value TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- lead_journey_stages with user_id (per instructions)
CREATE TABLE IF NOT EXISTS public.lead_journey_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    stage TEXT NOT NULL,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exited_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- files: uploaded files metadata
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes BIGINT,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- knowledge base: articles for support/AI context
CREATE TABLE IF NOT EXISTS public.knowledge_base_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.knowledge_base_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    embedding VECTOR(1536),
    search_vector TSVECTOR,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- quality review configuration
CREATE TABLE IF NOT EXISTS public.quality_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    weight NUMERIC(5,2) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.quality_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    overall_score NUMERIC(5,2),
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quality_review_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES public.quality_reviews(id) ON DELETE CASCADE,
    criteria_id UUID NOT NULL REFERENCES public.quality_criteria(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL,
    comment TEXT,
    UNIQUE (review_id, criteria_id)
);

-- monitoring: agent and system metrics
CREATE TABLE IF NOT EXISTS public.agent_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    conversations_handled INTEGER NOT NULL DEFAULT 0,
    avg_first_response_time_ms BIGINT,
    avg_resolution_time_ms BIGINT,
    csat NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (agent_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- surveys for CSAT/NPS/feedback
CREATE TABLE IF NOT EXISTS public.surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'csat','nps','custom'
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    respondent_id UUID,
    conversation_id UUID,
    answers JSONB NOT NULL,
    score NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI provider configuration (for per-workspace keys/settings)
CREATE TABLE IF NOT EXISTS public.ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, provider)
);

-- API keys for external integrations
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    label TEXT,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature flags per workspace
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    flag TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, flag)
);

-- Vector store for knowledge base content
CREATE TABLE IF NOT EXISTS public.knowledge_base_article_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES public.knowledge_base_articles(id) ON DELETE CASCADE,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (article_id)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Helper: current authenticated user id (for policies)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Helper: current workspace ids from JWT (array)
CREATE OR REPLACE FUNCTION public.current_workspace_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        string_to_array(
            NULLIF(current_setting('request.jwt.claim.workspace_ids', true), ''),
            ','
        )::uuid[],
        ARRAY[]::uuid[]
    );
$$;

-- Check if user belongs to workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = public.current_user_id()
    );
$$;

-- Function to update search vector for knowledge base articles
CREATE OR REPLACE FUNCTION public.update_kb_article_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$;

-- Function to update conversation summary and timestamps
CREATE OR REPLACE FUNCTION public.update_conversation_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update the conversation's updated_at timestamp
    UPDATE public.conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;

    -- Update total conversations count for customer
    IF NEW.sender_type = 'customer' THEN
        UPDATE public.customers
        SET total_conversations = (
            SELECT COUNT(*)
            FROM public.conversations c
            WHERE c.customer_id = customers.id
        ),
        last_contact_at = NOW()
        WHERE id = (
            SELECT customer_id
            FROM public.conversations
            WHERE id = NEW.conversation_id
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Function to update chat conversation summary and timestamps
CREATE OR REPLACE FUNCTION public.update_chat_conversation_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update the chat conversation's updated_at timestamp
    UPDATE public.chat_conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;

    RETURN NEW;
END;
$$;

-- Function to generate conversation summary using AI (placeholder)
CREATE OR REPLACE FUNCTION public.generate_conversation_summary(p_conversation_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    summary_text TEXT;
BEGIN
    -- This is a placeholder function. In a real implementation,
    -- this would call an AI service to generate a summary
    SELECT string_agg(content, ' ')
    INTO summary_text
    FROM public.messages
    WHERE conversation_id = p_conversation_id
    ORDER BY created_at
    LIMIT 10;

    RETURN LEFT(COALESCE(summary_text, 'No messages'), 500);
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Example trigger: ensure workspace member exists when inserting agents
CREATE OR REPLACE FUNCTION public.ensure_agent_workspace_member()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT public.is_workspace_member(NEW.workspace_id) THEN
        RAISE EXCEPTION 'User is not a member of the target workspace';
    END IF;
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_agents_workspace_member'
    ) THEN
        CREATE TRIGGER trg_agents_workspace_member
        BEFORE INSERT ON public.agents
        FOR EACH ROW
        EXECUTE FUNCTION public.ensure_agent_workspace_member();
    END IF;
END;
$$;

-- Trigger to update search vector on knowledge base articles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_kb_article_search_vector'
    ) THEN
        CREATE TRIGGER trg_kb_article_search_vector
        BEFORE INSERT OR UPDATE ON public.knowledge_base_articles
        FOR EACH ROW
        EXECUTE FUNCTION public.update_kb_article_search_vector();
    END IF;
END;
$$;

-- Trigger to update conversation summary on message insert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_conversation_summary_update'
    ) THEN
        CREATE TRIGGER trg_conversation_summary_update
        AFTER INSERT ON public.messages
        FOR EACH ROW
        EXECUTE FUNCTION public.update_conversation_summary();
    END IF;
END;
$$;

-- Trigger to update chat conversation summary on message insert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_chat_conversation_summary_update'
    ) THEN
        CREATE TRIGGER trg_chat_conversation_summary_update
        AFTER INSERT ON public.chat_messages
        FOR EACH ROW
        EXECUTE FUNCTION public.update_chat_conversation_summary();
    END IF;
END;
$$;

-- Trigger to update updated_at timestamp on agent_profiles
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_agent_profiles_updated_at'
    ) THEN
        CREATE TRIGGER trg_agent_profiles_updated_at
        BEFORE UPDATE ON public.agent_profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_agent_goals_updated_at'
    ) THEN
        CREATE TRIGGER trg_agent_goals_updated_at
        BEFORE UPDATE ON public.agent_goals
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_survey_templates_updated_at'
    ) THEN
        CREATE TRIGGER trg_survey_templates_updated_at
        BEFORE UPDATE ON public.survey_templates
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_chat_conversations_updated_at'
    ) THEN
        CREATE TRIGGER trg_chat_conversations_updated_at
        BEFORE UPDATE ON public.chat_conversations
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY ENABLE
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_behavior_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_journey_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_review_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_article_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES (MATCHING AUTHORITATIVE SCHEMA, NO INVALID COLUMNS)
-- ============================================================================

-- Accounts: users can see accounts they belong to
CREATE POLICY accounts_select
ON public.accounts
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.account_users au
        WHERE au.account_id = id
          AND au.user_id = public.current_user_id()
    )
);

-- Account users: users see their own memberships
CREATE POLICY account_users_select
ON public.account_users
FOR SELECT
USING (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM public.account_users au2
        WHERE au2.account_id = account_id
          AND au2.user_id = public.current_user_id()
          AND au2.role IN ('owner','admin')
    )
);

-- Workspaces: visible if member of workspace or owning account
CREATE POLICY workspaces_select
ON public.workspaces
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = id
          AND wm.user_id = public.current_user_id()
    )
    OR EXISTS (
        SELECT 1
        FROM public.account_users au
        WHERE au.account_id = workspaces.account_id
          AND au.user_id = public.current_user_id()
    )
);

-- Workspace members: visible within same workspace
CREATE POLICY workspace_members_select
ON public.workspace_members
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_members.workspace_id
          AND wm.user_id = public.current_user_id()
    )
);

-- Agents: restrict by workspace membership
CREATE POLICY agents_select
ON public.agents
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY agents_insert
ON public.agents
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY agents_update
ON public.agents
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

-- Conversations: restricted by workspace membership
CREATE POLICY conversations_select
ON public.conversations
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY conversations_insert
ON public.conversations
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY conversations_update
ON public.conversations
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

-- Messages: through conversation workspace
CREATE POLICY messages_select
ON public.messages
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND public.is_workspace_member(c.workspace_id)
    )
);

CREATE POLICY messages_insert
ON public.messages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = conversation_id
          AND public.is_workspace_member(c.workspace_id)
    )
);

-- Customers: restricted by workspace membership
CREATE POLICY customers_select
ON public.customers
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY customers_insert
ON public.customers
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY customers_update
ON public.customers
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

-- Lead behavior patterns
CREATE POLICY lead_behavior_patterns_select
ON public.lead_behavior_patterns
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.id = lead_behavior_patterns.lead_id
          AND public.is_workspace_member(c.workspace_id)
    )
);

CREATE POLICY lead_behavior_patterns_insert
ON public.lead_behavior_patterns
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.id = lead_id
          AND public.is_workspace_member(c.workspace_id)
    )
);

-- Lead preferences
CREATE POLICY lead_preferences_select
ON public.lead_preferences
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.id = lead_preferences.lead_id
          AND public.is_workspace_member(c.workspace_id)
    )
);

CREATE POLICY lead_preferences_insert
ON public.lead_preferences
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.id = lead_id
          AND public.is_workspace_member(c.workspace_id)
    )
);

-- Lead journey stages
CREATE POLICY lead_journey_stages_select
ON public.lead_journey_stages
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.id = lead_journey_stages.lead_id
          AND public.is_workspace_member(c.workspace_id)
    )
);

CREATE POLICY lead_journey_stages_insert
ON public.lead_journey_stages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.id = lead_id
          AND public.is_workspace_member(c.workspace_id)
    )
);

-- Files
CREATE POLICY files_select
ON public.files
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY files_insert
ON public.files
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- Knowledge base
CREATE POLICY knowledge_base_categories_select
ON public.knowledge_base_categories
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY knowledge_base_categories_insert
ON public.knowledge_base_categories
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY knowledge_base_articles_select
ON public.knowledge_base_articles
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY knowledge_base_articles_insert
ON public.knowledge_base_articles
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- Quality criteria
CREATE POLICY quality_criteria_select
ON public.quality_criteria
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY quality_criteria_insert
ON public.quality_criteria
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- Quality reviews
CREATE POLICY quality_reviews_select
ON public.quality_reviews
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY quality_reviews_insert
ON public.quality_reviews
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- Quality review scores (via review)
CREATE POLICY quality_review_scores_select
ON public.quality_review_scores
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.quality_reviews qr
        WHERE qr.id = quality_review_scores.review_id
          AND public.is_workspace_member(qr.workspace_id)
    )
);

CREATE POLICY quality_review_scores_insert
ON public.quality_review_scores
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.quality_reviews qr
        WHERE qr.id = review_id
          AND public.is_workspace_member(qr.workspace_id)
    )
);

-- Agent metrics
CREATE POLICY agent_metrics_select
ON public.agent_metrics
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY agent_metrics_insert
ON public.agent_metrics
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- System events
CREATE POLICY system_events_select
ON public.system_events
FOR SELECT
USING (
    workspace_id IS NULL
    OR public.is_workspace_member(workspace_id)
);

CREATE POLICY system_events_insert
ON public.system_events
FOR INSERT
WITH CHECK (
    workspace_id IS NULL
    OR public.is_workspace_member(workspace_id)
);

-- Surveys
CREATE POLICY surveys_select
ON public.surveys
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY surveys_insert
ON public.surveys
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- Survey responses
CREATE POLICY survey_responses_select
ON public.survey_responses
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY survey_responses_insert
ON public.survey_responses
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- AI providers
CREATE POLICY ai_providers_select
ON public.ai_providers
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY ai_providers_insert
ON public.ai_providers
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- API keys
CREATE POLICY api_keys_select
ON public.api_keys
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY api_keys_insert
ON public.api_keys
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- Feature flags
CREATE POLICY feature_flags_select
ON public.feature_flags
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY feature_flags_insert
ON public.feature_flags
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

-- Knowledge base article embeddings
CREATE POLICY knowledge_base_article_embeddings_select
ON public.knowledge_base_article_embeddings
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.knowledge_base_articles a
        WHERE a.id = knowledge_base_article_embeddings.article_id
          AND public.is_workspace_member(a.workspace_id)
    )
);

CREATE POLICY knowledge_base_article_embeddings_insert
ON public.knowledge_base_article_embeddings
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.knowledge_base_articles a
        WHERE a.id = article_id
          AND public.is_workspace_member(a.workspace_id)
    )
);

-- Agent profiles: users can see their own profile and admins can see all
CREATE POLICY agent_profiles_select
ON public.agent_profiles
FOR SELECT
USING (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.user_id = public.current_user_id()
          AND wm.role IN ('admin', 'supervisor')
    )
);

CREATE POLICY agent_profiles_insert
ON public.agent_profiles
FOR INSERT
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY agent_profiles_update
ON public.agent_profiles
FOR UPDATE
USING (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.user_id = public.current_user_id()
          AND wm.role IN ('admin', 'supervisor')
    )
)
WITH CHECK (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.user_id = public.current_user_id()
          AND wm.role IN ('admin', 'supervisor')
    )
);

-- Agent performance metrics: users can see metrics for agents they have access to
CREATE POLICY agent_performance_metrics_select
ON public.agent_performance_metrics
FOR SELECT
USING (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM public.agent_profiles ap
        WHERE ap.id = agent_performance_metrics.agent_id
          AND ap.user_id = public.current_user_id()
    )
);

CREATE POLICY agent_performance_metrics_insert
ON public.agent_performance_metrics
FOR INSERT
WITH CHECK (user_id = public.current_user_id());

-- Agent goals: users can see their own goals and admins can see all
CREATE POLICY agent_goals_select
ON public.agent_goals
FOR SELECT
USING (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.user_id = public.current_user_id()
          AND wm.role IN ('admin', 'supervisor')
    )
);

CREATE POLICY agent_goals_insert
ON public.agent_goals
FOR INSERT
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY agent_goals_update
ON public.agent_goals
FOR UPDATE
USING (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.user_id = public.current_user_id()
          AND wm.role IN ('admin', 'supervisor')
    )
)
WITH CHECK (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.user_id = public.current_user_id()
          AND wm.role IN ('admin', 'supervisor')
    )
);

-- File attachments: users can see files they uploaded or files in conversations they have access to
CREATE POLICY file_attachments_select
ON public.file_attachments
FOR SELECT
USING (
    user_id = public.current_user_id()
    OR EXISTS (
        SELECT 1
        FROM public.chat_conversations c
        WHERE c.id = file_attachments.conversation_id
          AND c.user_id = public.current_user_id()
    )
);

CREATE POLICY file_attachments_insert
ON public.file_attachments
FOR INSERT
WITH CHECK (user_id = public.current_user_id());

-- Survey templates: users can see their own templates
CREATE POLICY survey_templates_select
ON public.survey_templates
FOR SELECT
USING (user_id = public.current_user_id());

CREATE POLICY survey_templates_insert
ON public.survey_templates
FOR INSERT
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY survey_templates_update
ON public.survey_templates
FOR UPDATE
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());

-- Chat conversations: users can see their own conversations
CREATE POLICY chat_conversations_select
ON public.chat_conversations
FOR SELECT
USING (user_id = public.current_user_id());

CREATE POLICY chat_conversations_insert
ON public.chat_conversations
FOR INSERT
WITH CHECK (user_id = public.current_user_id());

CREATE POLICY chat_conversations_update
ON public.chat_conversations
FOR UPDATE
USING (user_id = public.current_user_id())
WITH CHECK (user_id = public.current_user_id());

-- Chat messages: through conversation ownership
CREATE POLICY chat_messages_select
ON public.chat_messages
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.chat_conversations c
        WHERE c.id = chat_messages.conversation_id
          AND c.user_id = public.current_user_id()
    )
);

CREATE POLICY chat_messages_insert
ON public.chat_messages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.chat_conversations c
        WHERE c.id = conversation_id
          AND c.user_id = public.current_user_id()
    )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_account_users_user_id ON public.account_users (user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_account_id ON public.workspaces (account_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON public.agents (workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON public.conversations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_customers_workspace_id ON public.customers (workspace_id);
CREATE INDEX IF NOT EXISTS idx_files_workspace_id ON public.files (workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_workspace_id ON public.knowledge_base_categories (workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_workspace_id ON public.knowledge_base_articles (workspace_id);
CREATE INDEX IF NOT EXISTS idx_quality_criteria_workspace_id ON public.quality_criteria (workspace_id);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_workspace_id ON public.quality_reviews (workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_workspace_id ON public.agent_metrics (workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_events_workspace_id ON public.system_events (workspace_id);
CREATE INDEX IF NOT EXISTS idx_surveys_workspace_id ON public.surveys (workspace_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_workspace_id ON public.survey_responses (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_workspace_id ON public.ai_providers (workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON public.api_keys (workspace_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_workspace_id ON public.feature_flags (workspace_id);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_agent_profiles_user_id ON public.agent_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_email ON public.agent_profiles (email);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_role ON public.agent_profiles (role);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_is_active ON public.agent_profiles (is_active);
CREATE INDEX IF NOT EXISTS idx_agent_performance_metrics_agent_id ON public.agent_performance_metrics (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_metrics_user_id ON public.agent_performance_metrics (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_metrics_metric_date ON public.agent_performance_metrics (metric_date);
CREATE INDEX IF NOT EXISTS idx_agent_goals_user_id ON public.agent_goals (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_goals_agent_id ON public.agent_goals (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_goals_goal_type ON public.agent_goals (goal_type);
CREATE INDEX IF NOT EXISTS idx_agent_goals_period ON public.agent_goals (period);
CREATE INDEX IF NOT EXISTS idx_agent_goals_is_active ON public.agent_goals (is_active);
CREATE INDEX IF NOT EXISTS idx_file_attachments_user_id ON public.file_attachments (user_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_conversation_id ON public.file_attachments (conversation_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_message_id ON public.file_attachments (message_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_uploaded_by ON public.file_attachments (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_survey_templates_user_id ON public.survey_templates (user_id);
CREATE INDEX IF NOT EXISTS idx_survey_templates_trigger_event ON public.survey_templates (trigger_event);
CREATE INDEX IF NOT EXISTS idx_survey_templates_is_active ON public.survey_templates (is_active);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_customer_identifier ON public.chat_conversations (customer_identifier);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_channel ON public.chat_conversations (channel);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON public.chat_conversations (status);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_priority ON public.chat_conversations (priority);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_assigned_agent ON public.chat_conversations (assigned_agent);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_type ON public.chat_messages (sender_type);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages (created_at);

-- Text search / trigram indexes examples
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
ON public.customers
USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_kb_articles_title_trgm
ON public.knowledge_base_articles
USING gin (title gin_trgm_ops);

-- Vector index for article embeddings
CREATE INDEX IF NOT EXISTS idx_kb_article_embeddings_vector
ON public.knowledge_base_article_embeddings
USING ivfflat (embedding vector_cosine)
WITH (lists = 100);

-- ============================================================================
-- SEED DATA (MINIMAL, SAFE)
-- ============================================================================

-- Seed a demo account and workspace (idempotent)
INSERT INTO public.accounts (id, name, slug)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Demo Account',
    'demo-account'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, account_id, name, slug)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Demo Workspace',
    'demo-workspace'
)
ON CONFLICT (id) DO NOTHING;