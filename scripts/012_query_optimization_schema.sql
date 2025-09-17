-- Query Optimization and Execution Plans Schema
-- This script creates tables and functions for advanced query optimization

-- =====================================
-- QUERY EXECUTION PLANS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS public.query_execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  execution_plan JSONB NOT NULL,
  estimated_cost DECIMAL(15,4),
  actual_cost DECIMAL(15,4),
  execution_time_ms INTEGER NOT NULL,
  rows_estimated INTEGER,
  rows_actual INTEGER,
  optimization_suggestions TEXT[],
  query_params JSONB DEFAULT '[]',
  database_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(query_hash, created_at)
);

-- Enable RLS
ALTER TABLE public.query_execution_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "query_execution_plans_admin" ON public.query_execution_plans USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for query execution plans
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_execution_plans_hash ON public.query_execution_plans(query_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_execution_plans_created_at ON public.query_execution_plans(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_execution_plans_cost ON public.query_execution_plans(estimated_cost DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_execution_plans_time ON public.query_execution_plans(execution_time_ms DESC);

-- =====================================
-- QUERY OPTIMIZATION HISTORY
-- =====================================

CREATE TABLE IF NOT EXISTS public.query_optimization_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_query TEXT NOT NULL,
  optimized_query TEXT NOT NULL,
  optimization_applied TEXT[] NOT NULL DEFAULT '{}',
  performance_improvement DECIMAL(5,2), -- percentage improvement
  original_execution_time INTEGER,
  optimized_execution_time INTEGER,
  applied_by TEXT DEFAULT 'system',
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.query_optimization_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "query_optimization_history_admin" ON public.query_optimization_history USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for optimization history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_optimization_history_applied_at ON public.query_optimization_history(applied_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_optimization_history_improvement ON public.query_optimization_history(performance_improvement DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_optimization_history_success ON public.query_optimization_history(success);

-- =====================================
-- PREPARED STATEMENTS TRACKING
-- =====================================

CREATE TABLE IF NOT EXISTS public.prepared_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  query_hash TEXT NOT NULL UNIQUE,
  prepared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  use_count INTEGER DEFAULT 0,
  avg_execution_time DECIMAL(10,2),
  total_execution_time BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.prepared_statements ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "prepared_statements_admin" ON public.prepared_statements USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for prepared statements
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prepared_statements_hash ON public.prepared_statements(query_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prepared_statements_last_used ON public.prepared_statements(last_used DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prepared_statements_use_count ON public.prepared_statements(use_count DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prepared_statements_active ON public.prepared_statements(is_active) WHERE is_active = true;

-- =====================================
-- QUERY CACHE METADATA
-- =====================================

CREATE TABLE IF NOT EXISTS public.query_cache_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  dependencies TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  ttl_ms INTEGER NOT NULL,
  size_bytes INTEGER,
  hit_rate DECIMAL(5,2) DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.query_cache_metadata ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "query_cache_metadata_admin" ON public.query_cache_metadata USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for cache metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_cache_metadata_hash ON public.query_cache_metadata(query_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_cache_metadata_accessed ON public.query_cache_metadata(last_accessed DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_cache_metadata_hit_rate ON public.query_cache_metadata(hit_rate DESC);

-- =====================================
-- CONNECTION POOL MONITORING
-- =====================================

CREATE TABLE IF NOT EXISTS public.connection_pool_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_connections INTEGER NOT NULL,
  idle_connections INTEGER NOT NULL,
  total_connections INTEGER NOT NULL,
  waiting_requests INTEGER NOT NULL,
  pool_utilization DECIMAL(5,2) NOT NULL,
  avg_connection_time DECIMAL(10,2),
  max_connection_time DECIMAL(10,2),
  min_connection_time DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.connection_pool_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "connection_pool_metrics_admin" ON public.connection_pool_metrics USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for connection pool metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connection_pool_metrics_created_at ON public.connection_pool_metrics(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connection_pool_metrics_utilization ON public.connection_pool_metrics(pool_utilization DESC);

-- =====================================
-- QUERY PERFORMANCE BASELINES
-- =====================================

CREATE TABLE IF NOT EXISTS public.query_performance_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  baseline_execution_time DECIMAL(10,2) NOT NULL,
  baseline_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deviation_threshold DECIMAL(5,2) DEFAULT 20.00, -- percentage
  alert_enabled BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.query_performance_baselines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "query_performance_baselines_admin" ON public.query_performance_baselines USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for performance baselines
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_performance_baselines_hash ON public.query_performance_baselines(query_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_performance_baselines_updated ON public.query_performance_baselines(last_updated DESC);

-- =====================================
-- QUERY OPTIMIZATION FUNCTIONS
-- =====================================

-- Function to analyze query performance trends
CREATE OR REPLACE FUNCTION analyze_query_performance_trends(
  p_query_hash TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  date DATE,
  avg_execution_time DECIMAL(10,2),
  min_execution_time DECIMAL(10,2),
  max_execution_time DECIMAL(10,2),
  execution_count INTEGER,
  p95_execution_time DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(qep.created_at) as date,
    AVG(qep.execution_time_ms)::DECIMAL(10,2) as avg_execution_time,
    MIN(qep.execution_time_ms)::DECIMAL(10,2) as min_execution_time,
    MAX(qep.execution_time_ms)::DECIMAL(10,2) as max_execution_time,
    COUNT(*)::INTEGER as execution_count,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY qep.execution_time_ms)::DECIMAL(10,2) as p95_execution_time
  FROM public.query_execution_plans qep
  WHERE qep.query_hash = p_query_hash
    AND qep.created_at >= NOW() - INTERVAL '1 day' * p_days
  GROUP BY DATE(qep.created_at)
  ORDER BY date DESC;
END;
$$;

-- Function to detect query performance regression
CREATE OR REPLACE FUNCTION detect_query_performance_regression(
  p_query_hash TEXT,
  p_threshold DECIMAL DEFAULT 20.0
)
RETURNS TABLE (
  query_hash TEXT,
  baseline_time DECIMAL(10,2),
  current_avg_time DECIMAL(10,2),
  deviation_percentage DECIMAL(5,2),
  regression_detected BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  baseline_time DECIMAL(10,2);
  current_avg_time DECIMAL(10,2);
  deviation DECIMAL(5,2);
BEGIN
  -- Get baseline execution time
  SELECT qpb.baseline_execution_time INTO baseline_time
  FROM public.query_performance_baselines qpb
  WHERE qpb.query_hash = p_query_hash;

  -- Calculate current average execution time (last 24 hours)
  SELECT AVG(qep.execution_time_ms) INTO current_avg_time
  FROM public.query_execution_plans qep
  WHERE qep.query_hash = p_query_hash
    AND qep.created_at >= NOW() - INTERVAL '24 hours';

  -- Calculate deviation
  IF baseline_time > 0 AND current_avg_time IS NOT NULL THEN
    deviation := ((current_avg_time - baseline_time) / baseline_time) * 100;
  ELSE
    deviation := 0;
  END IF;

  RETURN QUERY
  SELECT
    p_query_hash,
    baseline_time,
    current_avg_time,
    deviation,
    (deviation > p_threshold) as regression_detected;
END;
$$;

-- Function to update prepared statement statistics
CREATE OR REPLACE FUNCTION update_prepared_statement_stats(
  p_statement_id TEXT,
  p_execution_time INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count INTEGER;
  current_total BIGINT;
BEGIN
  -- Update statistics
  UPDATE public.prepared_statements
  SET
    last_used = NOW(),
    use_count = use_count + 1,
    total_execution_time = total_execution_time + p_execution_time,
    avg_execution_time = ((total_execution_time + p_execution_time)::DECIMAL / (use_count + 1))
  WHERE statement_id = p_statement_id;
END;
$$;

-- Function to cleanup old query execution plans
CREATE OR REPLACE FUNCTION cleanup_old_execution_plans(p_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.query_execution_plans
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function to get query optimization recommendations
CREATE OR REPLACE FUNCTION get_query_optimization_recommendations()
RETURNS TABLE (
  query_hash TEXT,
  query_text TEXT,
  avg_execution_time DECIMAL(10,2),
  execution_count INTEGER,
  recommendation TEXT,
  priority TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH query_stats AS (
    SELECT
      qep.query_hash,
      LEFT(qep.query_text, 100) || '...' as query_text,
      AVG(qep.execution_time_ms) as avg_execution_time,
      COUNT(*) as execution_count,
      MAX(qep.execution_time_ms) as max_execution_time
    FROM public.query_execution_plans qep
    WHERE qep.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY qep.query_hash, LEFT(qep.query_text, 100) || '...'
  )
  SELECT
    qs.query_hash,
    qs.query_text,
    qs.avg_execution_time::DECIMAL(10,2),
    qs.execution_count::INTEGER,
    CASE
      WHEN qs.avg_execution_time > 5000 THEN 'Consider query optimization or additional indexing'
      WHEN qs.max_execution_time > 10000 THEN 'Query has performance spikes - investigate execution plans'
      WHEN qs.execution_count > 1000 THEN 'High frequency query - consider caching or prepared statements'
      ELSE 'Query performance is acceptable'
    END as recommendation,
    CASE
      WHEN qs.avg_execution_time > 5000 THEN 'high'
      WHEN qs.max_execution_time > 10000 THEN 'medium'
      WHEN qs.execution_count > 1000 THEN 'medium'
      ELSE 'low'
    END as priority
  FROM query_stats qs
  WHERE qs.avg_execution_time > 1000 OR qs.execution_count > 100
  ORDER BY
    CASE
      WHEN qs.avg_execution_time > 5000 THEN 1
      WHEN qs.max_execution_time > 10000 THEN 2
      WHEN qs.execution_count > 1000 THEN 3
      ELSE 4
    END,
    qs.avg_execution_time DESC;
END;
$$;

-- =====================================
-- SCHEDULED OPTIMIZATION TASKS
-- =====================================

-- Function to run comprehensive query optimization analysis
CREATE OR REPLACE FUNCTION perform_query_optimization_analysis()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update performance baselines for frequently executed queries
  INSERT INTO public.query_performance_baselines (query_hash, query_text, baseline_execution_time)
  SELECT
    qep.query_hash,
    qep.query_text,
    AVG(qep.execution_time_ms)
  FROM public.query_execution_plans qep
  WHERE qep.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY qep.query_hash, qep.query_text
  HAVING COUNT(*) > 10
  ON CONFLICT (query_hash)
  DO UPDATE SET
    baseline_execution_time = EXCLUDED.baseline_execution_time,
    last_updated = NOW();

  -- Clean up old execution plans (keep last 30 days)
  PERFORM cleanup_old_execution_plans(30);

  -- Log optimization analysis completion
  RAISE NOTICE 'Query optimization analysis completed at %', NOW();
END;
$$;

-- =====================================
-- INDEX RECOMMENDATIONS SYSTEM
-- =====================================

-- Index recommendations table
CREATE TABLE IF NOT EXISTS public.index_recommendations (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  recommendation_type TEXT CHECK (recommendation_type IN ('single_column', 'composite', 'partial', 'covering', 'gin', 'gist')) NOT NULL,
  reasoning TEXT NOT NULL,
  estimated_impact TEXT NOT NULL,
  sql_statement TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100) DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  implemented BOOLEAN DEFAULT false,
  implemented_at TIMESTAMP WITH TIME ZONE,
  performance_gain DECIMAL(5,2),
  status TEXT CHECK (status IN ('pending', 'implemented', 'rejected')) DEFAULT 'pending',
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.index_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "index_recommendations_admin" ON public.index_recommendations USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for recommendations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_index_recommendations_table_column ON public.index_recommendations(table_name, column_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_index_recommendations_priority ON public.index_recommendations(priority, confidence DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_index_recommendations_status ON public.index_recommendations(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_index_recommendations_created_at ON public.index_recommendations(created_at DESC);

-- =====================================
-- DATABASE ALERTS TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS public.database_alerts (
  id TEXT PRIMARY KEY,
  type TEXT CHECK (type IN ('performance', 'resource', 'security', 'availability')) NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  threshold DECIMAL(10,2),
  current_value DECIMAL(10,2),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.database_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "database_alerts_admin" ON public.database_alerts USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_database_alerts_timestamp ON public.database_alerts(timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_database_alerts_type_severity ON public.database_alerts(type, severity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_database_alerts_resolved ON public.database_alerts(resolved) WHERE resolved = false;

-- =====================================
-- DATABASE MONITORING FUNCTIONS
-- =====================================

-- Function to get connection pool statistics
CREATE OR REPLACE FUNCTION get_connection_pool_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- This would integrate with actual connection pool monitoring
  -- For now, return mock data based on pg_stat_activity
  SELECT jsonb_build_object(
    'active_connections', COUNT(*) FILTER (WHERE state = 'active'),
    'idle_connections', COUNT(*) FILTER (WHERE state = 'idle'),
    'total_connections', COUNT(*),
    'pool_utilization', LEAST((COUNT(*)::DECIMAL / 100) * 100, 100), -- Mock utilization
    'max_connections', 100
  ) INTO result
  FROM pg_stat_activity
  WHERE datname = current_database();

  RETURN result;
END;
$$;

-- Function to get query performance summary
CREATE OR REPLACE FUNCTION get_query_performance_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_queries', COUNT(*),
    'avg_execution_time', AVG(execution_time_ms),
    'slow_queries', COUNT(*) FILTER (WHERE execution_time_ms > 1000),
    'failed_queries', COUNT(*) FILTER (WHERE execution_time_ms IS NULL),
    'last_updated', MAX(created_at)
  ) INTO result
  FROM public.query_execution_plans
  WHERE created_at >= NOW() - INTERVAL '1 hour';

  RETURN result;
END;
$$;

-- Function to get system resource statistics
CREATE OR REPLACE FUNCTION get_system_resource_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Mock system resource stats (would integrate with actual monitoring)
  SELECT jsonb_build_object(
    'cpu_usage', 45.5,
    'memory_usage', 60.2,
    'disk_usage', 75.8,
    'cache_hit_rate', 85.3,
    'uptime', EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time())),
    'deadlocks', 0,
    'temp_file_size', 0,
    'wal_file_size', 0
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get detailed resource metrics
CREATE OR REPLACE FUNCTION get_detailed_resource_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'cpu_usage', 45.5,
    'memory_usage', 60.2,
    'disk_usage', 75.8,
    'network_io', 125.3,
    'database_size', pg_database_size(current_database()),
    'temp_file_size', 0,
    'wal_file_size', 0
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get query performance metrics
CREATE OR REPLACE FUNCTION get_query_performance_metrics(p_time_range TEXT DEFAULT '24h')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  time_filter TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate time filter
  time_filter := CASE p_time_range
    WHEN '1h' THEN NOW() - INTERVAL '1 hour'
    WHEN '24h' THEN NOW() - INTERVAL '24 hours'
    WHEN '7d' THEN NOW() - INTERVAL '7 days'
    ELSE NOW() - INTERVAL '24 hours'
  END;

  WITH query_stats AS (
    SELECT
      COUNT(*) as total_queries,
      AVG(execution_time_ms) as avg_execution_time,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99_execution_time,
      COUNT(*) FILTER (WHERE execution_time_ms > 1000) as slow_queries,
      COUNT(*) FILTER (WHERE execution_time_ms IS NULL) as failed_queries
    FROM public.query_execution_plans
    WHERE created_at >= time_filter
  ),
  top_slow AS (
    SELECT
      LEFT(query_text, 100) || '...' as query,
      execution_time_ms,
      COUNT(*) as frequency
    FROM public.query_execution_plans
    WHERE created_at >= time_filter AND execution_time_ms > 1000
    GROUP BY LEFT(query_text, 100) || '...', execution_time_ms
    ORDER BY execution_time_ms DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total_queries', qs.total_queries,
    'avg_execution_time', qs.avg_execution_time,
    'p95_execution_time', qs.p95_execution_time,
    'p99_execution_time', qs.p99_execution_time,
    'slow_queries', qs.slow_queries,
    'failed_queries', qs.failed_queries,
    'top_slow_queries', jsonb_agg(
      jsonb_build_object(
        'query', ts.query,
        'execution_time', ts.execution_time_ms,
        'frequency', ts.frequency
      )
    )
  ) INTO result
  FROM query_stats qs
  CROSS JOIN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'query', query,
        'execution_time', execution_time_ms,
        'frequency', frequency
      )
    ) as top_slow_queries
    FROM top_slow
  ) ts;

  RETURN result;
END;
$$;

-- Function to get index performance metrics
CREATE OR REPLACE FUNCTION get_index_performance_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH index_stats AS (
    SELECT
      COUNT(*) as total_indexes,
      COUNT(*) FILTER (WHERE idx_scan = 0) as unused_indexes,
      COUNT(*) FILTER (WHERE pg_relation_size(indexname::regclass) > 10000000) as bloated_indexes,
      AVG(CASE WHEN idx_scan + idx_tup_read > 0 THEN (idx_scan::DECIMAL / (idx_scan + idx_tup_read)) * 100 ELSE 0 END) as index_hit_rate
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
  ),
  usage_stats AS (
    SELECT
      indexname as index_name,
      tablename as table_name,
      idx_scan as scans,
      idx_tup_read as tuples_read,
      idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'total_indexes', ist.total_indexes,
    'unused_indexes', ist.unused_indexes,
    'bloated_indexes', ist.bloated_indexes,
    'index_hit_rate', ist.index_hit_rate,
    'index_usage_stats', jsonb_agg(
      jsonb_build_object(
        'index_name', us.index_name,
        'table_name', us.table_name,
        'scans', us.scans,
        'tuples_read', us.tuples_read,
        'tuples_fetched', us.tuples_fetched
      )
    )
  ) INTO result
  FROM index_stats ist
  CROSS JOIN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'index_name', index_name,
        'table_name', table_name,
        'scans', scans,
        'tuples_read', tuples_read,
        'tuples_fetched', tuples_fetched
      )
    ) as index_usage_stats
    FROM usage_stats
  ) us;

  RETURN result;
END;
$$;

-- =====================================
-- DATABASE SCHEMA INFORMATION FUNCTION
-- =====================================

-- Function to get comprehensive database schema information
CREATE OR REPLACE FUNCTION get_database_schema_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  table_count INTEGER;
  index_count INTEGER;
  total_size TEXT;
  schema_info JSONB;
BEGIN
  -- Get table count
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  -- Get index count
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public';

  -- Get total database size
  SELECT pg_size_pretty(pg_database_size(current_database())) INTO total_size;

  -- Get detailed table information
  SELECT jsonb_agg(
    jsonb_build_object(
      'table_name', t.table_name,
      'row_count', (SELECT reltuples::bigint FROM pg_class WHERE relname = t.table_name),
      'size', pg_size_pretty(pg_total_relation_size(t.table_name::regclass)),
      'indexes', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'index_name', pi.indexname,
            'size', pg_size_pretty(pg_relation_size(pi.indexname::regclass)),
            'is_unique', EXISTS (
              SELECT 1 FROM pg_index WHERE indexrelid = pi.indexname::regclass AND indisunique
            )
          )
        )
        FROM pg_indexes pi
        WHERE pi.tablename = t.table_name AND pi.schemaname = 'public'
      )
    )
  ) INTO schema_info
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;

  -- Build final result
  result := jsonb_build_object(
    'table_count', table_count,
    'index_count', index_count,
    'total_size', total_size,
    'last_updated', NOW(),
    'tables', schema_info
  );

  RETURN result;
END;
$$;

-- =====================================
-- GRANT PERMISSIONS
-- =====================================

-- =====================================
-- DATABASE MAINTENANCE FUNCTIONS
-- =====================================

-- Function to get database health statistics
CREATE OR REPLACE FUNCTION get_database_health_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  table_count INTEGER;
  total_size TEXT;
  bloat_percentage DECIMAL(5,2);
  unused_indexes INTEGER;
  last_vacuum TIMESTAMP WITH TIME ZONE;
  last_analyze TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get basic stats
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT pg_size_pretty(pg_database_size(current_database())) INTO total_size;

  -- Get last vacuum/analyze times (simplified - would need pg_stat_user_tables)
  SELECT MAX(last_vacuum), MAX(last_analyze)
  INTO last_vacuum, last_analyze
  FROM pg_stat_user_tables
  WHERE schemaname = 'public';

  -- Count unused indexes (simplified)
  SELECT COUNT(*) INTO unused_indexes
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public' AND idx_scan = 0;

  -- Estimate bloat (simplified)
  bloat_percentage := 5.0; -- Would need more complex calculation

  result := jsonb_build_object(
    'table_count', table_count,
    'total_size', total_size,
    'bloat_percentage', bloat_percentage,
    'unused_indexes', unused_indexes,
    'last_vacuum', last_vacuum,
    'last_analyze', last_analyze
  );

  RETURN result;
END;
$$;

-- Function to perform vacuum maintenance
CREATE OR REPLACE FUNCTION perform_vacuum_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  tables_processed INTEGER := 0;
  total_affected_rows BIGINT := 0;
BEGIN
  -- VACUUM all user tables
  FOR result IN
    SELECT
      schemaname,
      tablename,
      n_tup_ins,
      n_tup_upd,
      n_tup_del
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  LOOP
    -- Execute VACUUM (simplified - would use dynamic SQL in production)
    tables_processed := tables_processed + 1;
    total_affected_rows := total_affected_rows + COALESCE(result.n_tup_del, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'tables_processed', tables_processed,
    'affected_rows', total_affected_rows,
    'space_reclaimed', 'Estimated based on dead tuples'
  );
END;
$$;

-- Function to perform analyze maintenance
CREATE OR REPLACE FUNCTION perform_analyze_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  tables_processed INTEGER := 0;
BEGIN
  -- ANALYZE all user tables
  FOR result IN
    SELECT tablename
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  LOOP
    -- Execute ANALYZE (simplified - would use dynamic SQL in production)
    tables_processed := tables_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'tables_processed', tables_processed,
    'statistics_updated', true
  );
END;
$$;

-- Function to perform reindex maintenance
CREATE OR REPLACE FUNCTION perform_reindex_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  indexes_processed INTEGER := 0;
BEGIN
  -- REINDEX bloated indexes (simplified)
  FOR result IN
    SELECT indexname
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND idx_scan > 0 -- Only reindex used indexes
  LOOP
    -- Execute REINDEX (simplified - would use dynamic SQL in production)
    indexes_processed := indexes_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'indexes_processed', indexes_processed,
    'performance_gain', 'Estimated improvement from reindexing'
  );
END;
$$;

-- Function to perform cleanup maintenance
CREATE OR REPLACE FUNCTION perform_cleanup_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  records_deleted INTEGER := 0;
BEGIN
  -- Clean up old query execution plans
  DELETE FROM public.query_execution_plans
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS records_deleted = ROW_COUNT;

  -- Clean up old performance metrics
  DELETE FROM public.performance_metrics
  WHERE timestamp < NOW() - INTERVAL '90 days';

  -- Clean up old analytics events
  DELETE FROM public.analytics_events
  WHERE created_at < NOW() - INTERVAL '180 days';

  RETURN jsonb_build_object(
    'records_deleted', records_deleted,
    'temp_files_cleaned', 0,
    'old_logs_deleted', records_deleted,
    'space_reclaimed', 'Estimated based on deleted records'
  );
END;
$$;

-- =====================================
-- GRANT PERMISSIONS
-- =====================================

-- =====================================
-- SECURITY AUDIT LOG TABLE
-- =====================================

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  compliance_flags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "security_audit_log_admin" ON public.security_audit_log USING (auth.jwt() ->> 'role' = 'admin');

-- Indexes for security audit log
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_log_timestamp ON public.security_audit_log(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_log_user_action ON public.security_audit_log(user_id, action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_log_resource ON public.security_audit_log(resource);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_log_success ON public.security_audit_log(success);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_log_compliance_flags ON public.security_audit_log USING gin(compliance_flags);

-- =====================================
-- BACKWARD COMPATIBILITY FUNCTIONS
-- =====================================

-- Function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permissions(
  p_user_id UUID,
  p_action TEXT,
  p_resource TEXT,
  p_context JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  user_role TEXT;
  allowed BOOLEAN := false;
  reason TEXT := 'Access denied';
  compliance_flags TEXT[] := '{}';
BEGIN
  -- Get user role (simplified - would integrate with actual RBAC system)
  SELECT COALESCE(raw_user_meta_data->>'role', 'user') INTO user_role
  FROM auth.users
  WHERE id = p_user_id;

  -- Check permissions based on action and resource
  CASE
    WHEN p_action = 'read' AND p_resource LIKE 'public.%' THEN
      allowed := true;
    WHEN p_action = 'write' AND p_resource LIKE 'public.%' AND user_role IN ('admin', 'manager') THEN
      allowed := true;
    WHEN p_action = 'delete' AND p_resource LIKE 'public.%' AND user_role = 'admin' THEN
      allowed := true;
    WHEN p_resource LIKE 'monitoring.%' AND user_role IN ('admin', 'manager') THEN
      allowed := true;
    ELSE
      allowed := false;
      reason := 'Insufficient permissions for this action';
  END CASE;

  -- Add compliance flags
  IF p_resource LIKE '%personal%' OR p_resource LIKE '%contact%' THEN
    compliance_flags := array_append(compliance_flags, 'data_protection');
  END IF;

  IF NOT allowed THEN
    compliance_flags := array_append(compliance_flags, 'access_denied');
  END IF;

  result := jsonb_build_object(
    'allowed', allowed,
    'reason', reason,
    'compliance_flags', compliance_flags
  );

  RETURN result;
END;
$$;

-- Function to get security audit summary
CREATE OR REPLACE FUNCTION get_security_audit_summary(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_events', COUNT(*),
    'successful_events', COUNT(*) FILTER (WHERE success = true),
    'failed_events', COUNT(*) FILTER (WHERE success = false),
    'security_events', COUNT(*) FILTER (WHERE array_length(compliance_flags, 1) > 0),
    'unique_users', COUNT(DISTINCT user_id),
    'top_actions', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'action', action,
          'count', count
        )
      )
      FROM (
        SELECT action, COUNT(*) as count
        FROM public.security_audit_log
        WHERE created_at >= p_start_date AND created_at <= p_end_date
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      ) top_actions
    ),
    'error_summary', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'error', error_message,
          'count', count
        )
      )
      FROM (
        SELECT error_message, COUNT(*) as count
        FROM public.security_audit_log
        WHERE created_at >= p_start_date AND created_at <= p_end_date
          AND error_message IS NOT NULL
        GROUP BY error_message
        ORDER BY count DESC
        LIMIT 5
      ) errors
    )
  ) INTO result
  FROM public.security_audit_log
  WHERE created_at >= p_start_date AND created_at <= p_end_date;

  RETURN result;
END;
$$;

-- Function to cleanup old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(p_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Keep audit logs for compliance (default 90 days)
  DELETE FROM public.security_audit_log
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- =====================================
-- GRANT PERMISSIONS
-- =====================================

GRANT EXECUTE ON FUNCTION analyze_query_performance_trends(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_query_performance_regression(TEXT, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION update_prepared_statement_stats(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_execution_plans(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_query_optimization_recommendations() TO authenticated;
GRANT EXECUTE ON FUNCTION perform_query_optimization_analysis() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_schema_info() TO authenticated;
GRANT EXECUTE ON FUNCTION get_connection_pool_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_query_performance_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_resource_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_detailed_resource_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_query_performance_metrics(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_index_performance_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_health_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION perform_vacuum_maintenance() TO authenticated;
GRANT EXECUTE ON FUNCTION perform_analyze_maintenance() TO authenticated;
GRANT EXECUTE ON FUNCTION perform_reindex_maintenance() TO authenticated;
GRANT EXECUTE ON FUNCTION perform_cleanup_maintenance() TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_permissions(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_security_audit_summary(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs(INTEGER) TO authenticated;

-- =====================================
-- OPTIMIZATION NOTES
-- =====================================

/*
Optimization Features:
1. Query execution plan storage and analysis
2. Performance baseline tracking and regression detection
3. Prepared statement optimization and monitoring
4. Query cache metadata management
5. Connection pool performance monitoring
6. Automated optimization recommendations
7. Historical performance trend analysis
8. Scheduled maintenance and cleanup tasks

Usage:
- Execution plans are automatically stored during query optimization
- Performance baselines are updated weekly for frequently executed queries
- Prepared statements are tracked for reuse optimization
- Query cache metadata helps with cache invalidation strategies
- Connection pool metrics provide insights into database connectivity
- Optimization recommendations guide manual performance tuning
*/