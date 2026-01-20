-- Conversation Insights Schema Enhancement
-- This script adds tables and functionality for conversation summarization and insight extraction

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
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),

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

-- Create indexes for better query performance
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

-- Log the completion of schema creation
DO $$
BEGIN
    RAISE NOTICE 'Conversation insights schema created successfully at %', NOW();
END $$;