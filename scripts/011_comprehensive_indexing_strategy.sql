-- Comprehensive Database Indexing Strategy for PrismAI
-- This script implements enterprise-grade indexing for optimal query performance

-- =====================================
-- PERFORMANCE METRICS TABLES
-- =====================================

-- Create performance_metrics table if it doesn't exist
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

-- RLS policies
CREATE POLICY "performance_metrics_own" ON public.performance_metrics USING (auth.uid() = (metadata->>'user_id')::UUID);

-- =====================================
-- COMPREHENSIVE INDEXING STRATEGY
-- =====================================

-- 1. CORE USER TABLES INDEXES
-- =============================

-- Profiles table - enhance existing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_user_id ON public.profiles(id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_business_type ON public.profiles(business_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- Call logs - comprehensive indexing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_user_id_created_at ON public.call_logs(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_caller_phone ON public.call_logs(caller_phone);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_call_status ON public.call_logs(call_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_sentiment_score ON public.call_logs(sentiment_score DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_call_duration ON public.call_logs(call_duration) WHERE call_duration > 0;

-- Partial index for unanswered calls
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_unanswered ON public.call_logs(created_at DESC)
WHERE call_status IN ('missed', 'voicemail');

-- Bookings - comprehensive indexing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_user_id_status ON public.bookings(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_appointment_date ON public.bookings(appointment_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_call_log_id ON public.bookings(call_log_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

-- Covering index for dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_dashboard_covering ON public.bookings(user_id, status, appointment_date, customer_name, service_type);

-- AI Configs - enhance existing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_configs_user_id ON public.ai_configs(user_id);

-- 2. LEAD GENERATION SYSTEM INDEXES
-- ==================================

-- Leads - enhance existing indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_user_id_status_score ON public.leads(user_id, status, lead_score DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_email_user_id ON public.leads(email, user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_phone_user_id ON public.leads(phone, user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_id ON public.leads(source_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_tags ON public.leads USING gin(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_next_follow_up ON public.leads(next_follow_up) WHERE next_follow_up IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_last_contact ON public.leads(last_contact_date DESC) WHERE last_contact_date IS NOT NULL;

-- JSONB indexes for custom fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_custom_fields ON public.leads USING gin(custom_fields);

-- Lead sources
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_sources_user_id_type ON public.lead_sources(user_id, type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_sources_active ON public.lead_sources(user_id, is_active) WHERE is_active = true;

-- Lead activities - enhance existing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_activities_lead_id_type_created ON public.lead_activities(lead_id, type, created_at DESC);

-- 3. CHAT & CUSTOMER SERVICE INDEXES
-- ===================================

-- Knowledge base - enhance existing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_user_id_published ON public.knowledge_base(user_id, is_published);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(user_id, category);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_tags ON public.knowledge_base USING gin(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_search_user ON public.knowledge_base(user_id, search_vector) WHERE is_published = true;

-- Chat conversations - enhance existing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_user_lead ON public.chat_conversations(user_id, lead_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_customer_id ON public.chat_conversations(customer_identifier);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_agent_assigned ON public.chat_conversations(assigned_agent_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_channel_status ON public.chat_conversations(channel, status);

-- Chat messages - enhance existing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_conversation_sender ON public.chat_messages(conversation_id, sender_type, created_at DESC);

-- 4. MARKETING AUTOMATION INDEXES
-- ================================

-- Email campaigns - enhance existing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_user_status_scheduled ON public.email_campaigns(user_id, status, scheduled_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_sent_at ON public.email_campaigns(sent_at DESC) WHERE sent_at IS NOT NULL;

-- Social posts - enhance existing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_user_platform_status ON public.social_posts(user_id, platform, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_published_at ON public.social_posts(published_at DESC) WHERE published_at IS NOT NULL;

-- Automation workflows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_workflows_user_active ON public.automation_workflows(user_id, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_workflows_trigger_type ON public.automation_workflows(trigger_type);

-- 5. ANALYTICS & METRICS INDEXES
-- ===============================

-- Analytics events - enhance existing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_user_event_created ON public.analytics_events(user_id, event_name, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_lead_id ON public.analytics_events(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_properties ON public.analytics_events USING gin(event_properties);

-- Business metrics - enhance existing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_metrics_user_metric_date ON public.business_metrics(user_id, metric_name, metric_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_metrics_dimensions ON public.business_metrics USING gin(dimensions);

-- Performance metrics - comprehensive indexing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_type_timestamp ON public.performance_metrics(metric_type, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_tags ON public.performance_metrics USING gin(tags);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_metadata ON public.performance_metrics USING gin(metadata);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_created_at ON public.performance_metrics(created_at DESC);

-- 6. INTEGRATION TABLES INDEXES
-- ==============================

-- Integrations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_user_service ON public.integrations(user_id, service_name, service_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_active ON public.integrations(user_id, is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_last_sync ON public.integrations(last_sync_at DESC) WHERE last_sync_at IS NOT NULL;

-- 7. SUBSCRIPTION MANAGEMENT INDEXES
-- ===================================

-- User subscriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_user_status ON public.user_subscriptions(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_period_end ON public.user_subscriptions(current_period_end);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_subscriptions_plan_id ON public.user_subscriptions(plan_id);

-- Subscription plans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active) WHERE is_active = true;

-- 8. SPECIALIZED INDEXES FOR COMMON QUERIES
-- ==========================================

-- Composite indexes for dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_dashboard_recent ON public.leads(user_id, created_at DESC, status, lead_score DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_dashboard ON public.chat_conversations(user_id, status, created_at DESC, channel);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_dashboard ON public.email_campaigns(user_id, status, created_at DESC, campaign_type);

-- Time-based indexes for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_time_range ON public.analytics_events(created_at DESC, user_id, event_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_metrics_time_range ON public.business_metrics(metric_date DESC, user_id, metric_name);

-- Search optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_fulltext_search ON public.knowledge_base USING gin(to_tsvector('english', title || ' ' || content)) WHERE is_published = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_fulltext_search ON public.leads USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || company || ' ' || array_to_string(tags, ' ')));

-- 9. PARTIAL INDEXES FOR PERFORMANCE
-- ===================================

-- Active conversations only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_active_only ON public.chat_conversations(user_id, updated_at DESC) WHERE status = 'active';

-- Published knowledge base only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_base_published_only ON public.knowledge_base(user_id, updated_at DESC) WHERE is_published = true;

-- Active leads only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_active_only ON public.leads(user_id, lead_score DESC, created_at DESC) WHERE status NOT IN ('lost', 'customer');

-- Scheduled campaigns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_scheduled_only ON public.email_campaigns(user_id, scheduled_at) WHERE status = 'scheduled' AND scheduled_at > NOW();

-- 10. INDEX MAINTENANCE FUNCTIONS
-- ================================

-- Function to analyze and report on index usage
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

-- Function to identify unused indexes
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

-- Function to get index size information
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

-- =====================================
-- INDEX MONITORING AND OPTIMIZATION
-- =====================================

-- Create index usage tracking table
CREATE TABLE IF NOT EXISTS public.index_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  scans BIGINT DEFAULT 0,
  tuples_read BIGINT DEFAULT 0,
  tuples_fetched BIGINT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(index_name, table_name)
);

-- Function to update index usage statistics
CREATE OR REPLACE FUNCTION update_index_usage_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.index_usage_stats (index_name, table_name, scans, tuples_read, tuples_fetched, last_updated)
  SELECT
    ps.indexname,
    ps.tablename,
    ps.idx_scan,
    ps.idx_tup_read,
    ps.idx_tup_fetch,
    NOW()
  FROM pg_stat_user_indexes ps
  WHERE ps.schemaname = 'public'
  ON CONFLICT (index_name, table_name)
  DO UPDATE SET
    scans = EXCLUDED.scans,
    tuples_read = EXCLUDED.tuples_read,
    tuples_fetched = EXCLUDED.tuples_fetched,
    last_updated = EXCLUDED.last_updated;
END;
$$;

-- Enable RLS on index usage stats
ALTER TABLE public.index_usage_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "index_usage_stats_admin" ON public.index_usage_stats USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================
-- AUTOMATED INDEX RECOMMENDATIONS
-- =====================================

-- Create table for index recommendations
CREATE TABLE IF NOT EXISTS public.index_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  recommendation_type TEXT CHECK (recommendation_type IN ('single_column', 'composite', 'partial', 'covering')) NOT NULL,
  reasoning TEXT NOT NULL,
  estimated_impact TEXT,
  sql_statement TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  implemented_at TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('pending', 'implemented', 'rejected')) DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE public.index_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "index_recommendations_admin" ON public.index_recommendations USING (auth.jwt() ->> 'role' = 'admin');

-- Function to generate index recommendations based on query patterns
CREATE OR REPLACE FUNCTION generate_index_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Clear old pending recommendations
  DELETE FROM public.index_recommendations
  WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 days';

  -- Analyze tables for potential indexes
  FOR rec IN
    SELECT
      schemaname,
      tablename,
      attname,
      n_distinct,
      correlation
    FROM pg_stats
    WHERE schemaname = 'public'
      AND n_distinct > 0
      AND correlation IS NOT NULL
    ORDER BY n_distinct DESC
  LOOP
    -- Check if index already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = rec.schemaname
        AND tablename = rec.tablename
        AND indexdef LIKE '%' || rec.attname || '%'
    ) THEN
      -- Generate recommendation
      INSERT INTO public.index_recommendations (
        table_name,
        column_name,
        recommendation_type,
        reasoning,
        estimated_impact,
        sql_statement,
        priority
      ) VALUES (
        rec.tablename,
        rec.attname,
        'single_column',
        'Column has high cardinality (' || rec.n_distinct || ' distinct values) and may benefit from indexing',
        'Potential query performance improvement for filters and joins on ' || rec.attname,
        'CREATE INDEX CONCURRENTLY idx_' || rec.tablename || '_' || rec.attname || ' ON ' || rec.schemaname || '.' || rec.tablename || '(' || rec.attname || ');',
        CASE
          WHEN rec.n_distinct > 10000 THEN 'high'
          WHEN rec.n_distinct > 1000 THEN 'medium'
          ELSE 'low'
        END
      );
    END IF;
  END LOOP;
END;
$$;

-- =====================================
-- INDEX HEALTH MONITORING
-- =====================================

-- Function to check index health and bloat
CREATE OR REPLACE FUNCTION check_index_health()
RETURNS TABLE (
  schemaname TEXT,
  tablename TEXT,
  indexname TEXT,
  index_size TEXT,
  bloat_estimate TEXT,
  last_vacuum TIMESTAMP WITH TIME ZONE,
  last_analyze TIMESTAMP WITH TIME ZONE
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
    pg_size_pretty(pg_relation_size(pi.indexname::regclass)) as index_size,
    'Not calculated' as bloat_estimate, -- Would need pgstattuple extension
    ps.last_vacuum,
    ps.last_analyze
  FROM pg_indexes pi
  LEFT JOIN pg_stat_user_tables ps ON pi.tablename = ps.relname
  WHERE pi.schemaname = 'public'
  ORDER BY pg_relation_size(pi.indexname::regclass) DESC;
END;
$$;

-- =====================================
-- SCHEDULED MAINTENANCE
-- =====================================

-- Create a function to run comprehensive index maintenance
CREATE OR REPLACE FUNCTION perform_index_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update index usage statistics
  PERFORM update_index_usage_stats();

  -- Generate new index recommendations
  PERFORM generate_index_recommendations();

  -- Log maintenance completion
  RAISE NOTICE 'Index maintenance completed at %', NOW();
END;
$$;

-- =====================================
-- PERFORMANCE METRICS FOR INDEXING
-- =====================================

-- Add index-specific metrics to performance monitoring
INSERT INTO public.performance_metrics (metric_type, value, unit, metadata, tags) VALUES
('index_count', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'), 'count',
 '{"description": "Total number of indexes in public schema"}', '{"type": "database", "category": "indexing"}'),
('table_count', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'), 'count',
 '{"description": "Total number of tables in public schema"}', '{"type": "database", "category": "schema"}')
ON CONFLICT DO NOTHING;

-- =====================================
-- FINAL OPTIMIZATION NOTES
-- =====================================

/*
Optimization Notes:
1. All indexes use CONCURRENTLY to avoid blocking writes during creation
2. Partial indexes are used where appropriate to reduce index size
3. GIN indexes are used for array and JSONB columns
4. Composite indexes are ordered by selectivity (most selective first)
5. Covering indexes include all columns needed for common queries
6. Time-based indexes use DESC for optimal performance on recent data
7. Foreign key indexes ensure referential integrity performance
8. Full-text search indexes enable efficient text searching
9. Index maintenance functions provide ongoing optimization
10. Automated recommendations help identify new indexing opportunities
*/

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION analyze_index_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION identify_unused_indexes() TO authenticated;
GRANT EXECUTE ON FUNCTION get_index_sizes() TO authenticated;
GRANT EXECUTE ON FUNCTION update_index_usage_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_index_recommendations() TO authenticated;
GRANT EXECUTE ON FUNCTION check_index_health() TO authenticated;
GRANT EXECUTE ON FUNCTION perform_index_maintenance() TO authenticated;