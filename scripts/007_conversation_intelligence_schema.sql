-- Advanced Conversation Intelligence Engine Database Schema
-- This script creates all necessary tables for emotion detection and intent classification

-- =====================================================
-- CONVERSATION EMOTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_emotions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Emotion Analysis Results
    dominant_emotion VARCHAR(50) NOT NULL DEFAULT 'neutral',
    overall_sentiment VARCHAR(20) NOT NULL DEFAULT 'neutral' CHECK (overall_sentiment IN ('positive', 'negative', 'neutral')),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),

    -- Detailed Emotion Scores (JSON array of emotion objects)
    emotion_scores JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    language VARCHAR(10) DEFAULT 'en',
    processing_time_ms INTEGER DEFAULT 0,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT unique_conversation_message_emotion UNIQUE(conversation_id, message_id, tenant_id)
);

-- Indexes for conversation_emotions
CREATE INDEX IF NOT EXISTS idx_conversation_emotions_conversation_id ON conversation_emotions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_emotions_tenant_id ON conversation_emotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_emotions_dominant_emotion ON conversation_emotions(dominant_emotion);
CREATE INDEX IF NOT EXISTS idx_conversation_emotions_sentiment ON conversation_emotions(overall_sentiment);
CREATE INDEX IF NOT EXISTS idx_conversation_emotions_created_at ON conversation_emotions(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_emotions_tenant_created ON conversation_emotions(tenant_id, created_at);

-- =====================================================
-- CONVERSATION INTENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_intents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Intent Analysis Results
    primary_intent VARCHAR(50) NOT NULL DEFAULT 'off_topic',
    secondary_intent VARCHAR(50),

    -- Intent Complexity and Urgency
    urgency_level VARCHAR(20) DEFAULT 'low' CHECK (urgency_level IN ('low', 'medium', 'high')),
    complexity_level VARCHAR(20) DEFAULT 'simple' CHECK (complexity_level IN ('simple', 'moderate', 'complex')),
    confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),

    -- Detailed Intent Scores (JSON array of intent objects)
    intent_scores JSONB DEFAULT '[]'::jsonb,

    -- Extracted Entities (JSON object)
    entities JSONB DEFAULT '{}'::jsonb,

    -- Context Keywords (JSON array)
    context_keywords JSONB DEFAULT '[]'::jsonb,

    -- Metadata
    language VARCHAR(10) DEFAULT 'en',
    processing_time_ms INTEGER DEFAULT 0,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT unique_conversation_message_intent UNIQUE(conversation_id, message_id, tenant_id)
);

-- Indexes for conversation_intents
CREATE INDEX IF NOT EXISTS idx_conversation_intents_conversation_id ON conversation_intents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_intents_tenant_id ON conversation_intents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_intents_primary_intent ON conversation_intents(primary_intent);
CREATE INDEX IF NOT EXISTS idx_conversation_intents_urgency ON conversation_intents(urgency_level);
CREATE INDEX IF NOT EXISTS idx_conversation_intents_created_at ON conversation_intents(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_intents_tenant_created ON conversation_intents(tenant_id, created_at);

-- =====================================================
-- CONVERSATION INSIGHTS TABLE (Combined Analysis)
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Combined Analysis Data
    emotion_data JSONB,
    intent_data JSONB,
    combined_confidence DECIMAL(3,2) DEFAULT 0.0 CHECK (combined_confidence >= 0 AND combined_confidence <= 1),

    -- Processing Metadata
    processing_version VARCHAR(20) DEFAULT '1.0',
    analysis_source VARCHAR(50) DEFAULT 'gemini',

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT unique_conversation_message_insight UNIQUE(conversation_id, message_id, tenant_id)
);

-- Indexes for conversation_insights
CREATE INDEX IF NOT EXISTS idx_conversation_insights_conversation_id ON conversation_insights(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_tenant_id ON conversation_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_created_at ON conversation_insights(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_tenant_created ON conversation_insights(tenant_id, created_at);

-- =====================================================
-- EMOTION TRENDS TABLE (Aggregated Data)
-- =====================================================
CREATE TABLE IF NOT EXISTS emotion_trends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Time Period
    trend_date DATE NOT NULL,
    trend_period VARCHAR(20) NOT NULL CHECK (trend_period IN ('daily', 'weekly', 'monthly')),

    -- Aggregated Emotion Data
    emotion_counts JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"joy": 10, "sadness": 5, ...}
    sentiment_counts JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"positive": 15, "negative": 8, "neutral": 3}

    -- Statistics
    total_conversations INTEGER NOT NULL DEFAULT 0,
    dominant_emotion VARCHAR(50) NOT NULL,
    average_confidence DECIMAL(3,2) DEFAULT 0.0,

    -- Conversation IDs for this period (for drill-down)
    conversation_ids JSONB DEFAULT '[]'::jsonb,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_tenant_period UNIQUE(tenant_id, trend_date, trend_period)
);

-- Indexes for emotion_trends
CREATE INDEX IF NOT EXISTS idx_emotion_trends_tenant_id ON emotion_trends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emotion_trends_date ON emotion_trends(trend_date);
CREATE INDEX IF NOT EXISTS idx_emotion_trends_period ON emotion_trends(trend_period);
CREATE INDEX IF NOT EXISTS idx_emotion_trends_tenant_date ON emotion_trends(tenant_id, trend_date);

-- =====================================================
-- INTENT ANALYTICS TABLE (Aggregated Data)
-- =====================================================
CREATE TABLE IF NOT EXISTS intent_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Time Period
    analytics_date DATE NOT NULL,
    analytics_period VARCHAR(20) NOT NULL CHECK (analytics_period IN ('daily', 'weekly', 'monthly')),

    -- Intent Statistics
    intent_type VARCHAR(50) NOT NULL,
    intent_count INTEGER NOT NULL DEFAULT 0,
    average_confidence DECIMAL(3,2) DEFAULT 0.0,

    -- Distribution Data
    urgency_distribution JSONB DEFAULT '{}'::jsonb, -- {"low": 5, "medium": 10, "high": 3}
    complexity_distribution JSONB DEFAULT '{}'::jsonb, -- {"simple": 8, "moderate": 7, "complex": 3}

    -- Conversation IDs for this intent and period
    conversation_ids JSONB DEFAULT '[]'::jsonb,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_tenant_period_intent UNIQUE(tenant_id, analytics_date, analytics_period, intent_type)
);

-- Indexes for intent_analytics
CREATE INDEX IF NOT EXISTS idx_intent_analytics_tenant_id ON intent_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intent_analytics_date ON intent_analytics(analytics_date);
CREATE INDEX IF NOT EXISTS idx_intent_analytics_period ON intent_analytics(analytics_period);
CREATE INDEX IF NOT EXISTS idx_intent_analytics_intent_type ON intent_analytics(intent_type);
CREATE INDEX IF NOT EXISTS idx_intent_analytics_tenant_date ON intent_analytics(tenant_id, analytics_date);

-- =====================================================
-- CONVERSATION INTELLIGENCE SETTINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_intelligence_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Analysis Settings
    enable_emotion_detection BOOLEAN DEFAULT true,
    enable_intent_classification BOOLEAN DEFAULT true,
    enable_real_time_analysis BOOLEAN DEFAULT true,

    -- Confidence Thresholds
    min_emotion_confidence DECIMAL(3,2) DEFAULT 0.3 CHECK (min_emotion_confidence >= 0 AND min_emotion_confidence <= 1),
    min_intent_confidence DECIMAL(3,2) DEFAULT 0.3 CHECK (min_intent_confidence >= 0 AND min_intent_confidence <= 1),

    -- Language Settings
    supported_languages JSONB DEFAULT '["en"]'::jsonb,
    default_language VARCHAR(10) DEFAULT 'en',

    -- Privacy Settings
    data_retention_days INTEGER DEFAULT 90,
    enable_anonymization BOOLEAN DEFAULT false,
    require_consent BOOLEAN DEFAULT false,

    -- Performance Settings
    batch_size INTEGER DEFAULT 10,
    max_concurrent_requests INTEGER DEFAULT 5,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT unique_tenant_settings UNIQUE(tenant_id)
);

-- Indexes for conversation_intelligence_settings
CREATE INDEX IF NOT EXISTS idx_intelligence_settings_tenant_id ON conversation_intelligence_settings(tenant_id);

-- =====================================================
-- CONVERSATION INTELLIGENCE AUDIT LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_intelligence_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Event Details
    event_type VARCHAR(100) NOT NULL, -- 'analysis', 'batch_analysis', 'settings_change'
    conversation_id VARCHAR(255),
    user_id UUID REFERENCES auth.users(id),

    -- Event Data
    event_data JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,

    -- Compliance
    consent_given BOOLEAN DEFAULT false,
    data_anonymized BOOLEAN DEFAULT false,

    -- Audit Fields
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_event_type CHECK (event_type IN ('analysis', 'batch_analysis', 'settings_change', 'data_export', 'data_deletion'))
);

-- Indexes for conversation_intelligence_audit
CREATE INDEX IF NOT EXISTS idx_intelligence_audit_tenant_id ON conversation_intelligence_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_audit_event_type ON conversation_intelligence_audit(event_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_audit_created_at ON conversation_intelligence_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_intelligence_audit_conversation_id ON conversation_intelligence_audit(conversation_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE conversation_emotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_intelligence_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_intelligence_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_emotions
CREATE POLICY "Users can view emotions for their tenant" ON conversation_emotions
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert emotions" ON conversation_emotions
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policies for conversation_intents
CREATE POLICY "Users can view intents for their tenant" ON conversation_intents
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert intents" ON conversation_intents
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policies for conversation_insights
CREATE POLICY "Users can view insights for their tenant" ON conversation_insights
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert insights" ON conversation_insights
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policies for aggregated tables
CREATE POLICY "Users can view trends for their tenant" ON emotion_trends
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can view analytics for their tenant" ON intent_analytics
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policies for settings
CREATE POLICY "Users can view settings for their tenant" ON conversation_intelligence_settings
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Tenant admins can manage settings" ON conversation_intelligence_settings
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true AND role IN ('owner', 'admin')
        )
    );

-- RLS Policies for audit log
CREATE POLICY "Users can view audit logs for their tenant" ON conversation_intelligence_audit
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "System can insert audit logs" ON conversation_intelligence_audit
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_conversation_emotions_updated_at BEFORE UPDATE ON conversation_emotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversation_intents_updated_at BEFORE UPDATE ON conversation_intents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversation_insights_updated_at BEFORE UPDATE ON conversation_insights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversation_intelligence_settings_updated_at BEFORE UPDATE ON conversation_intelligence_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default settings for new tenants
CREATE OR REPLACE FUNCTION create_default_intelligence_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO conversation_intelligence_settings (tenant_id)
    VALUES (NEW.id)
    ON CONFLICT (tenant_id) DO NOTHING;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create default settings for new tenants
CREATE TRIGGER create_tenant_intelligence_settings
    AFTER INSERT ON tenants
    FOR EACH ROW EXECUTE FUNCTION create_default_intelligence_settings();

-- =====================================================
-- VIEWS FOR EASY QUERYING
-- =====================================================

-- View for conversation summary with emotions and intents
CREATE OR REPLACE VIEW conversation_summary AS
SELECT
    ce.conversation_id,
    ce.tenant_id,
    ce.dominant_emotion,
    ce.overall_sentiment,
    ci.primary_intent,
    ci.urgency_level,
    ci.complexity_level,
    GREATEST(ce.confidence_score, ci.confidence_score) as combined_confidence,
    ce.created_at as analyzed_at,
    COUNT(*) OVER (PARTITION BY ce.conversation_id) as message_count
FROM conversation_emotions ce
LEFT JOIN conversation_intents ci ON ce.conversation_id = ci.conversation_id
    AND ce.message_id = ci.message_id
    AND ce.tenant_id = ci.tenant_id;

-- View for tenant analytics overview
CREATE OR REPLACE VIEW tenant_analytics_overview AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,

    -- Emotion metrics (last 30 days)
    COALESCE(SUM(et.total_conversations), 0) as total_conversations_30d,
    COALESCE(
        jsonb_object_agg(et.dominant_emotion, et.emotion_counts->et.dominant_emotion)
        FILTER (WHERE et.dominant_emotion IS NOT NULL),
        '{}'::jsonb
    ) as dominant_emotions_30d,

    -- Intent metrics (last 30 days)
    COALESCE(SUM(ia.intent_count), 0) as total_intents_30d,
    COALESCE(
        jsonb_object_agg(ia.intent_type, ia.intent_count)
        FILTER (WHERE ia.intent_type IS NOT NULL),
        '{}'::jsonb
    ) as intent_distribution_30d,

    -- Recent activity
    MAX(GREATEST(ce.created_at, ci.created_at)) as last_analysis_date

FROM tenants t
LEFT JOIN emotion_trends et ON t.id = et.tenant_id
    AND et.trend_date >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN intent_analytics ia ON t.id = ia.tenant_id
    AND ia.analytics_date >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN conversation_emotions ce ON t.id = ce.tenant_id
LEFT JOIN conversation_intents ci ON t.id = ci.tenant_id

GROUP BY t.id, t.name;

-- =====================================================
-- GRANTS AND PERMISSIONS
-- =====================================================

-- Grant necessary permissions for the application
GRANT SELECT, INSERT, UPDATE ON conversation_emotions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON conversation_intents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON conversation_insights TO authenticated;
GRANT SELECT ON emotion_trends TO authenticated;
GRANT SELECT ON intent_analytics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_intelligence_settings TO authenticated;
GRANT SELECT, INSERT ON conversation_intelligence_audit TO authenticated;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- SAMPLE DATA (Optional - for development/testing)
-- =====================================================

-- Insert default settings for existing tenants
INSERT INTO conversation_intelligence_settings (tenant_id)
SELECT id FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM conversation_intelligence_settings)
ON CONFLICT (tenant_id) DO NOTHING;

COMMENT ON TABLE conversation_emotions IS 'Stores emotion detection results for individual messages';
COMMENT ON TABLE conversation_intents IS 'Stores intent classification results for individual messages';
COMMENT ON TABLE conversation_insights IS 'Combined emotion and intent analysis results';
COMMENT ON TABLE emotion_trends IS 'Aggregated emotion data for trend analysis';
COMMENT ON TABLE intent_analytics IS 'Aggregated intent data for analytics and reporting';
COMMENT ON TABLE conversation_intelligence_settings IS 'Tenant-specific settings for conversation intelligence features';
COMMENT ON TABLE conversation_intelligence_audit IS 'Audit log for compliance and tracking';

-- Create indexes for better performance on large datasets
CREATE INDEX IF NOT EXISTS idx_conversation_emotions_composite ON conversation_emotions(tenant_id, created_at, dominant_emotion);
CREATE INDEX IF NOT EXISTS idx_conversation_intents_composite ON conversation_intents(tenant_id, created_at, primary_intent);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_composite ON conversation_insights(tenant_id, created_at, conversation_id);