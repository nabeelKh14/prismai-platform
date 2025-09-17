-- Rate Limiting Schema for PrismAI
-- This script creates all necessary tables for comprehensive API rate limiting

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(128) UNIQUE NOT NULL,
    user_id VARCHAR(255),
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    custom_limits JSONB,
    metadata JSONB DEFAULT '{}',
    deactivated_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tier ON api_keys(tier);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Usage analytics table
CREATE TABLE IF NOT EXISTS usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    api_key VARCHAR(255),
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_count INTEGER DEFAULT 1,
    time_window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    time_window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    tier VARCHAR(20) NOT NULL,
    quota_used INTEGER DEFAULT 1,
    quota_limit INTEGER NOT NULL,
    blocked_requests INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for usage analytics
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_api_key ON usage_analytics(api_key);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_endpoint ON usage_analytics(endpoint);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_time_window ON usage_analytics(time_window_start, time_window_end);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_created_at ON usage_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_tier ON usage_analytics(tier);

-- Partition usage_analytics by month for better performance
-- (This would be implemented in production with actual partitioning)

-- Quota usage table
CREATE TABLE IF NOT EXISTS quota_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) UNIQUE NOT NULL, -- user_id, api_key, or IP
    used INTEGER DEFAULT 0,
    limit INTEGER NOT NULL,
    reset_time TIMESTAMP WITH TIME ZONE NOT NULL,
    tier VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for quota usage
CREATE INDEX IF NOT EXISTS idx_quota_usage_identifier ON quota_usage(identifier);
CREATE INDEX IF NOT EXISTS idx_quota_usage_reset_time ON quota_usage(reset_time);
CREATE INDEX IF NOT EXISTS idx_quota_usage_tier ON quota_usage(tier);

-- Rate limit bypasses table
CREATE TABLE IF NOT EXISTS rate_limit_bypasses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    api_key VARCHAR(255),
    endpoint VARCHAR(500) DEFAULT '*',
    reason VARCHAR(100) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    granted_by VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for rate limit bypasses
CREATE INDEX IF NOT EXISTS idx_rate_limit_bypasses_user_id ON rate_limit_bypasses(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_bypasses_api_key ON rate_limit_bypasses(api_key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_bypasses_active ON rate_limit_bypasses(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rate_limit_bypasses_expires_at ON rate_limit_bypasses(expires_at);

-- Monitoring metrics table
CREATE TABLE IF NOT EXISTS monitoring_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    user_id VARCHAR(255),
    api_key VARCHAR(255),
    tier VARCHAR(20),
    request_count INTEGER DEFAULT 1,
    blocked_count INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    cache_hit_rate DECIMAL(5,4),
    degradation_level VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for monitoring metrics
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_timestamp ON monitoring_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_endpoint ON monitoring_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_user_id ON monitoring_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_api_key ON monitoring_metrics(api_key);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_tier ON monitoring_metrics(tier);

-- Partition monitoring_metrics by day for better performance
-- (This would be implemented in production)

-- Rate limit configurations table
CREATE TABLE IF NOT EXISTS rate_limit_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(20) NOT NULL,
    endpoint_pattern VARCHAR(500),
    max_requests INTEGER NOT NULL,
    window_ms INTEGER NOT NULL,
    burst_limit INTEGER,
    algorithm VARCHAR(20) DEFAULT 'sliding-window' CHECK (algorithm IN ('sliding-window', 'fixed-window')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for rate limit configs
CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_tier ON rate_limit_configs(tier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_active ON rate_limit_configs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_endpoint ON rate_limit_configs(endpoint_pattern);

-- Insert default rate limit configurations
INSERT INTO rate_limit_configs (name, tier, max_requests, window_ms, burst_limit) VALUES
('free_default', 'free', 100, 900000, 10), -- 100 per 15 minutes, burst 10
('pro_default', 'pro', 1000, 3600000, 100), -- 1000 per hour, burst 100
('enterprise_default', 'enterprise', 10000, 3600000, 1000) -- 10000 per hour, burst 1000
ON CONFLICT (name) DO NOTHING;

-- Insert premium endpoint configurations
INSERT INTO rate_limit_configs (name, tier, endpoint_pattern, max_requests, window_ms) VALUES
('free_analytics', 'free', '/api/analytics%', 10, 3600000), -- Limited analytics for free
('pro_analytics', 'pro', '/api/analytics%', 500, 3600000), -- Full analytics for pro
('enterprise_analytics', 'enterprise', '/api/analytics%', 5000, 3600000), -- Unlimited analytics for enterprise
('free_admin', 'free', '/api/admin%', 0, 3600000), -- No admin access for free
('pro_admin', 'pro', '/api/admin%', 100, 3600000), -- Limited admin for pro
('enterprise_admin', 'enterprise', '/api/admin%', 1000, 3600000) -- Full admin for enterprise
ON CONFLICT (name) DO NOTHING;

-- Create views for analytics
CREATE OR REPLACE VIEW usage_summary AS
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    tier,
    COUNT(*) as total_requests,
    SUM(request_count) as request_count,
    SUM(blocked_requests) as blocked_requests,
    AVG(response_time_ms) as avg_response_time,
    SUM(error_count) as error_count
FROM usage_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('hour', created_at), tier
ORDER BY hour DESC;

CREATE OR REPLACE VIEW top_endpoints AS
SELECT
    endpoint,
    method,
    tier,
    SUM(request_count) as total_requests,
    SUM(blocked_requests) as blocked_requests,
    AVG(response_time_ms) as avg_response_time
FROM usage_analytics
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY endpoint, method, tier
ORDER BY total_requests DESC
LIMIT 100;

CREATE OR REPLACE VIEW quota_usage_summary AS
SELECT
    identifier,
    tier,
    used,
    limit,
    ROUND((used::decimal / limit) * 100, 2) as usage_percentage,
    reset_time,
    CASE
        WHEN used >= limit THEN 'exceeded'
        WHEN used >= limit * 0.8 THEN 'warning'
        ELSE 'normal'
    END as status
FROM quota_usage
WHERE reset_time > NOW()
ORDER BY usage_percentage DESC;

-- Create functions for maintenance
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete analytics older than 90 days
    DELETE FROM usage_analytics
    WHERE created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_bypasses()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Mark expired bypasses as inactive
    UPDATE rate_limit_bypasses
    SET is_active = false, revoked_at = NOW()
    WHERE is_active = true AND expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reset_daily_quotas()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Reset quotas that have expired
    UPDATE quota_usage
    SET used = 0, reset_time = NOW() + INTERVAL '24 hours', updated_at = NOW()
    WHERE reset_time < NOW();

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quota_usage_updated_at
    BEFORE UPDATE ON quota_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limit_configs_updated_at
    BEFORE UPDATE ON rate_limit_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your application)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON usage_analytics TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON quota_usage TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_bypasses TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON monitoring_metrics TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_configs TO your_app_role;
-- GRANT SELECT ON usage_summary TO your_app_role;
-- GRANT SELECT ON top_endpoints TO your_app_role;
-- GRANT SELECT ON quota_usage_summary TO your_app_role;

-- Add comments for documentation
COMMENT ON TABLE api_keys IS 'Stores API keys for different user tiers with custom limits and expiration';
COMMENT ON TABLE usage_analytics IS 'Tracks API usage patterns, request counts, and performance metrics';
COMMENT ON TABLE quota_usage IS 'Manages quota usage and limits for users and API keys';
COMMENT ON TABLE rate_limit_bypasses IS 'Manages temporary bypasses for rate limiting rules';
COMMENT ON TABLE monitoring_metrics IS 'Stores detailed monitoring data for observability';
COMMENT ON TABLE rate_limit_configs IS 'Configurable rate limiting rules by tier and endpoint';

COMMENT ON VIEW usage_summary IS 'Hourly usage summary for the last 30 days';
COMMENT ON VIEW top_endpoints IS 'Most used endpoints in the last 7 days';
COMMENT ON VIEW quota_usage_summary IS 'Current quota usage with status indicators';

-- Create indexes for better performance on views
CREATE INDEX IF NOT EXISTS idx_usage_analytics_created_at_tier ON usage_analytics(created_at, tier);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_endpoint_method ON usage_analytics(endpoint, method);