-- =====================================
-- COMPLIANCE METRICS DATABASE VIEWS
-- =====================================
-- Comprehensive database views for efficient compliance metrics aggregation
-- Supports real-time dashboard loading and historical trend analysis

-- =====================================
-- BAA COMPLIANCE AGGREGATION VIEW
-- =====================================

CREATE OR REPLACE VIEW public.vw_baa_compliance_metrics AS
SELECT
    tenant_id,
    -- Agreement Status Metrics
    COUNT(*) as total_agreements,
    COUNT(*) FILTER (WHERE status = 'executed') as executed_agreements,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_agreements,
    COUNT(*) FILTER (WHERE status = 'expired') as expired_agreements,
    COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE) as currently_expired,
    COUNT(*) FILTER (WHERE expiration_date <= CURRENT_DATE + INTERVAL '90 days') as expiring_soon,

    -- Execution Rate
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'executed')::DECIMAL /
         NULLIF(COUNT(*), 0)) * 100, 2
    ) as execution_rate,

    -- Average Agreement Age (days since execution)
    ROUND(
        AVG(
            CASE
                WHEN executed_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (CURRENT_DATE - executed_at::DATE)) / 86400
                ELSE NULL
            END
        ), 0
    ) as avg_agreement_age_days,

    -- Renewal Rate (agreements older than 1 year)
    ROUND(
        (COUNT(*) FILTER (WHERE executed_at < CURRENT_DATE - INTERVAL '1 year')::DECIMAL /
         NULLIF(COUNT(*) FILTER (WHERE status = 'executed'), 0)) * 100, 2
    ) as renewal_rate,

    -- Last updated timestamp
    CURRENT_TIMESTAMP as last_updated
FROM public.baa_agreements ba
GROUP BY tenant_id;

-- =====================================
-- VENDOR COMPLIANCE AGGREGATION VIEW
-- =====================================

CREATE OR REPLACE VIEW public.vw_vendor_compliance_metrics AS
SELECT
    tenant_id,
    COUNT(*) as total_vendors,
    COUNT(*) FILTER (WHERE risk_level IN ('high', 'critical')) as high_risk_vendors,
    COUNT(*) FILTER (WHERE last_assessment_date IS NOT NULL) as assessed_vendors,

    -- Assessment Coverage
    ROUND(
        (COUNT(*) FILTER (WHERE last_assessment_date IS NOT NULL)::DECIMAL /
         NULLIF(COUNT(*), 0)) * 100, 2
    ) as assessment_coverage,

    -- Average Compliance Score
    ROUND(
        AVG(
            CASE
                WHEN vca.overall_compliance_score IS NOT NULL
                THEN vca.overall_compliance_score
                ELSE NULL
            END
        ), 2
    ) as avg_compliance_score,

    -- Recent Assessments (last 12 months)
    COUNT(*) FILTER (
        WHERE vca.assessment_date >= CURRENT_DATE - INTERVAL '12 months'
    ) as recent_assessments,

    -- Assessment Frequency (average days between assessments)
    ROUND(
        AVG(
            CASE
                WHEN vca.assessment_date IS NOT NULL
                THEN EXTRACT(EPOCH FROM (CURRENT_DATE - vca.assessment_date)) / 86400
                ELSE NULL
            END
        ), 0
    ) as avg_assessment_age_days,

    CURRENT_TIMESTAMP as last_updated
FROM public.baa_vendors bv
LEFT JOIN public.vendor_compliance_assessments vca ON bv.id = vca.vendor_id
GROUP BY tenant_id;

-- =====================================
-- BREACH INCIDENT AGGREGATION VIEW
-- =====================================

CREATE OR REPLACE VIEW public.vw_breach_incident_metrics AS
SELECT
    tenant_id,
    -- Incident Counts
    COUNT(*) as total_incidents,
    COUNT(*) FILTER (WHERE status IN ('open', 'investigating')) as open_incidents,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as resolved_incidents,
    COUNT(*) FILTER (WHERE severity_score >= 4) as high_severity_incidents,

    -- Response Time Metrics (hours)
    ROUND(
        AVG(
            CASE
                WHEN detected_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (CURRENT_DATE - detected_at)) / 3600
                ELSE NULL
            END
        ), 2
    ) as avg_detection_time_hours,

    ROUND(
        AVG(
            CASE
                WHEN status IN ('resolved', 'closed') AND detected_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600
                ELSE NULL
            END
        ), 2
    ) as avg_resolution_time_hours,

    -- Regulatory Applicability
    COUNT(*) FILTER (WHERE gdpr_applicable = true) as gdpr_incidents,
    COUNT(*) FILTER (WHERE hipaa_applicable = true) as hipaa_incidents,
    COUNT(*) FILTER (WHERE soc2_applicable = true) as soc2_incidents,

    -- Incident Types Distribution
    jsonb_object_agg(incident_type, count) FILTER (WHERE incident_type IS NOT NULL) as incident_type_distribution,

    -- Severity Distribution
    jsonb_object_agg(
        CASE
            WHEN severity_score >= 4 THEN 'critical'
            WHEN severity_score >= 3 THEN 'high'
            WHEN severity_score >= 2 THEN 'medium'
            ELSE 'low'
        END,
        count
    ) FILTER (WHERE severity_score IS NOT NULL) as severity_distribution,

    CURRENT_TIMESTAMP as last_updated
FROM public.breach_incidents bi
GROUP BY tenant_id;

-- =====================================
-- BREACH NOTIFICATION AGGREGATION VIEW
-- =====================================

CREATE OR REPLACE VIEW public.vw_breach_notification_metrics AS
SELECT
    tenant_id,
    -- Overall Notification Metrics
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE notification_status IN ('sent', 'delivered')) as sent_notifications,
    COUNT(*) FILTER (WHERE notification_status = 'pending') as pending_notifications,
    COUNT(*) FILTER (WHERE notification_status = 'failed') as failed_notifications,

    -- Compliance Rates by Regulation
    ROUND(
        (COUNT(*) FILTER (WHERE required_by_regulation = 'gdpr' AND notification_status IN ('sent', 'delivered'))::DECIMAL /
         NULLIF(COUNT(*) FILTER (WHERE required_by_regulation = 'gdpr'), 0)) * 100, 2
    ) as gdpr_compliance_rate,

    ROUND(
        (COUNT(*) FILTER (WHERE required_by_regulation = 'hipaa' AND notification_status IN ('sent', 'delivered'))::DECIMAL /
         NULLIF(COUNT(*) FILTER (WHERE required_by_regulation = 'hipaa'), 0)) * 100, 2
    ) as hipaa_compliance_rate,

    ROUND(
        (COUNT(*) FILTER (WHERE required_by_regulation = 'soc2' AND notification_status IN ('sent', 'delivered'))::DECIMAL /
         NULLIF(COUNT(*) FILTER (WHERE required_by_regulation = 'soc2'), 0)) * 100, 2
    ) as soc2_compliance_rate,

    -- Average Response Times (hours)
    ROUND(
        AVG(
            CASE
                WHEN sent_at IS NOT NULL AND created_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (sent_at - created_at)) / 3600
                ELSE NULL
            END
        ), 2
    ) as avg_notification_time_hours,

    -- Deadline Compliance
    COUNT(*) FILTER (
        WHERE deadline_hours IS NOT NULL
        AND sent_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (sent_at - created_at)) / 3600 <= deadline_hours
    ) as on_time_notifications,

    COUNT(*) FILTER (
        WHERE deadline_hours IS NOT NULL
        AND sent_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (sent_at - created_at)) / 3600 > deadline_hours
    ) as late_notifications,

    -- Notification Methods Distribution
    jsonb_object_agg(delivery_method, count) FILTER (WHERE delivery_method IS NOT NULL) as delivery_method_distribution,

    CURRENT_TIMESTAMP as last_updated
FROM public.breach_notifications bn
GROUP BY tenant_id;

-- =====================================
-- INTERNATIONAL TRANSFER AGGREGATION VIEW
-- =====================================

CREATE OR REPLACE VIEW public.vw_transfer_compliance_metrics AS
SELECT
    tenant_id,
    -- Transfer Volume Metrics
    COUNT(*) as total_transfers,
    COUNT(*) FILTER (WHERE transfer_mechanism = 'adequacy') as adequacy_transfers,
    COUNT(*) FILTER (WHERE transfer_mechanism = 'scc') as scc_transfers,
    COUNT(*) FILTER (WHERE transfer_mechanism IS NULL OR transfer_mechanism = 'none') as non_compliant_transfers,
    COUNT(*) FILTER (WHERE destination_location IN ('RU', 'CN', 'IR', 'BY', 'KP')) as high_risk_transfers,

    -- Compliance Rates
    ROUND(
        ((COUNT(*) FILTER (WHERE transfer_mechanism IN ('adequacy', 'scc')))::DECIMAL /
         NULLIF(COUNT(*), 0)) * 100, 2
    ) as compliance_rate,

    -- Transfer Purpose Distribution
    jsonb_object_agg(purpose, count) FILTER (WHERE purpose IS NOT NULL) as purpose_distribution,

    -- Destination Country Distribution
    jsonb_object_agg(destination_location, count) FILTER (WHERE destination_location IS NOT NULL) as destination_distribution,

    -- Data Volume Metrics
    ROUND(AVG(record_count), 0) as avg_record_count,
    ROUND(AVG(data_volume_bytes / 1024 / 1024), 2) as avg_data_volume_mb,

    -- Recent Activity (last 30 days)
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as recent_transfers,

    CURRENT_TIMESTAMP as last_updated
FROM public.international_transfer_records itr
GROUP BY tenant_id;

-- =====================================
-- TRANSFER IMPACT ASSESSMENT VIEW
-- =====================================

CREATE OR REPLACE VIEW public.vw_tia_compliance_metrics AS
SELECT
    tenant_id,
    COUNT(*) as total_tias,
    COUNT(*) FILTER (WHERE status = 'approved') as completed_tias,
    COUNT(*) FILTER (WHERE status IN ('draft', 'in_progress')) as pending_tias,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_tias,

    -- Risk Score Statistics
    ROUND(AVG(overall_risk_score), 2) as avg_risk_score,
    ROUND(STDDEV(overall_risk_score), 2) as risk_score_stddev,
    MIN(overall_risk_score) as min_risk_score,
    MAX(overall_risk_score) as max_risk_score,

    -- Risk Level Distribution
    jsonb_build_object(
        'low', COUNT(*) FILTER (WHERE risk_level = 'low'),
        'medium', COUNT(*) FILTER (WHERE risk_level = 'medium'),
        'high', COUNT(*) FILTER (WHERE risk_level = 'high'),
        'critical', COUNT(*) FILTER (WHERE risk_level = 'critical')
    ) as risk_level_distribution,

    -- Coverage Rate
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'approved')::DECIMAL /
         NULLIF(COUNT(*), 0)) * 100, 2
    ) as tia_coverage_rate,

    -- Average Assessment Time (days)
    ROUND(
        AVG(
            CASE
                WHEN assessment_date IS NOT NULL
                THEN EXTRACT(EPOCH FROM (assessment_date - created_at)) / 86400
                ELSE NULL
            END
        ), 1
    ) as avg_assessment_time_days,

    CURRENT_TIMESTAMP as last_updated
FROM public.transfer_impact_assessments tia
GROUP BY tenant_id;

-- =====================================
-- COMPREHENSIVE COMPLIANCE SCORES VIEW
-- =====================================

CREATE OR REPLACE VIEW public.vw_compliance_scores AS
WITH baa_scores AS (
    SELECT
        tenant_id,
        -- BAA Score Components (30% weight)
        CASE
            WHEN total_agreements = 0 THEN 0
            ELSE GREATEST(0,
                (execution_rate * 0.4) +
                ((1 - (expired_agreements::DECIMAL / GREATEST(total_agreements, 1))) * 100 * 0.3) +
                (assessment_coverage * 0.3)
            )
        END as baa_component_score
    FROM public.vw_baa_compliance_metrics
),
breach_scores AS (
    SELECT
        tenant_id,
        -- Breach Score Components (25% weight)
        CASE
            WHEN total_incidents = 0 THEN 100
            ELSE GREATEST(0,
                (resolved_incidents::DECIMAL / GREATEST(total_incidents, 1) * 100 * 0.4) +
                (CASE WHEN avg_resolution_time_hours <= 24 THEN 100
                      WHEN avg_resolution_time_hours <= 72 THEN 80
                      WHEN avg_resolution_time_hours <= 168 THEN 60
                      ELSE 40 END * 0.3) +
                ((1 - (high_severity_incidents::DECIMAL / GREATEST(total_incidents, 1))) * 100 * 0.3)
            )
        END as breach_component_score
    FROM public.vw_breach_incident_metrics
),
transfer_scores AS (
    SELECT
        tenant_id,
        -- Transfer Score Components (25% weight)
        GREATEST(0,
            (compliance_rate * 0.5) +
            ((1 - (high_risk_transfers::DECIMAL / GREATEST(total_transfers, 1))) * 100 * 0.3) +
            (CASE WHEN tia_coverage_rate >= 90 THEN 100
                  WHEN tia_coverage_rate >= 75 THEN 80
                  WHEN tia_coverage_rate >= 60 THEN 60
                  ELSE 40 END * 0.2)
        ) as transfer_component_score
    FROM public.vw_transfer_compliance_metrics tcm
    LEFT JOIN public.vw_tia_compliance_metrics tiam ON tcm.tenant_id = tiam.tenant_id
),
notification_scores AS (
    SELECT
        tenant_id,
        -- Notification Score Components (20% weight)
        COALESCE(
            (gdpr_compliance_rate + hipaa_compliance_rate + soc2_compliance_rate) / 3,
            100
        ) as notification_component_score
    FROM public.vw_breach_notification_metrics
)
SELECT
    COALESCE(b.tenant_id, br.tenant_id, t.tenant_id, n.tenant_id) as tenant_id,

    -- Component Scores
    ROUND(COALESCE(b.baa_component_score, 0), 2) as baa_score,
    ROUND(COALESCE(br.breach_component_score, 0), 2) as breach_score,
    ROUND(COALESCE(t.transfer_component_score, 0), 2) as transfer_score,
    ROUND(COALESCE(n.notification_component_score, 0), 2) as notification_score,

    -- Overall Compliance Scores
    ROUND(
        (COALESCE(b.baa_component_score, 0) * 0.30) +
        (COALESCE(br.breach_component_score, 0) * 0.25) +
        (COALESCE(t.transfer_component_score, 0) * 0.25) +
        (COALESCE(n.notification_component_score, 0) * 0.20), 2
    ) as overall_score,

    -- Framework-Specific Scores
    ROUND(
        (COALESCE(b.baa_component_score, 0) * 0.40) +
        (COALESCE(br.breach_component_score, 0) * 0.35) +
        (COALESCE(n.notification_component_score, 0) * 0.25), 2
    ) as hipaa_score,

    ROUND(
        (COALESCE(t.transfer_component_score, 0) * 0.50) +
        (COALESCE(n.notification_component_score, 0) * 0.30) +
        (COALESCE(br.breach_component_score, 0) * 0.20), 2
    ) as gdpr_score,

    ROUND(
        (COALESCE(br.breach_component_score, 0) * 0.40) +
        (COALESCE(t.transfer_component_score, 0) * 0.35) +
        (COALESCE(b.baa_component_score, 0) * 0.25), 2
    ) as soc2_score,

    -- Grade Calculation
    CASE
        WHEN (
            (COALESCE(b.baa_component_score, 0) * 0.30) +
            (COALESCE(br.breach_component_score, 0) * 0.25) +
            (COALESCE(t.transfer_component_score, 0) * 0.25) +
            (COALESCE(n.notification_component_score, 0) * 0.20)
        ) >= 90 THEN 'A'
        WHEN (
            (COALESCE(b.baa_component_score, 0) * 0.30) +
            (COALESCE(br.breach_component_score, 0) * 0.25) +
            (COALESCE(t.transfer_component_score, 0) * 0.25) +
            (COALESCE(n.notification_component_score, 0) * 0.20)
        ) >= 80 THEN 'B'
        WHEN (
            (COALESCE(b.baa_component_score, 0) * 0.30) +
            (COALESCE(br.breach_component_score, 0) * 0.25) +
            (COALESCE(t.transfer_component_score, 0) * 0.25) +
            (COALESCE(n.notification_component_score, 0) * 0.20)
        ) >= 70 THEN 'C'
        WHEN (
            (COALESCE(b.baa_component_score, 0) * 0.30) +
            (COALESCE(br.breach_component_score, 0) * 0.25) +
            (COALESCE(t.transfer_component_score, 0) * 0.25) +
            (COALESCE(n.notification_component_score, 0) * 0.20)
        ) >= 60 THEN 'D'
        ELSE 'F'
    END as overall_grade,

    CURRENT_TIMESTAMP as last_updated
FROM baa_scores b
FULL OUTER JOIN breach_scores br ON b.tenant_id = br.tenant_id
FULL OUTER JOIN transfer_scores t ON COALESCE(b.tenant_id, br.tenant_id) = t.tenant_id
FULL OUTER JOIN notification_scores n ON COALESCE(b.tenant_id, br.tenant_id, t.tenant_id) = n.tenant_id;

-- =====================================
-- COMPLIANCE ALERTS AGGREGATION VIEW
-- =====================================

CREATE OR REPLACE VIEW public.vw_compliance_alerts AS
SELECT
    tenant_id,
    'BAA Expiration' as alert_type,
    'high' as severity,
    COUNT(*) as alert_count,
    jsonb_agg(
        jsonb_build_object(
            'agreement_id', id,
            'vendor_name', vendor_name,
            'days_until_expiry', EXTRACT(DAY FROM (expiration_date - CURRENT_DATE))
        )
    ) as alert_details
FROM public.baa_agreements
WHERE status = 'executed'
    AND expiration_date <= CURRENT_DATE + INTERVAL '90 days'
    AND expiration_date > CURRENT_DATE
GROUP BY tenant_id

UNION ALL

SELECT
    tenant_id,
    'Breach Response Delay' as alert_type,
    CASE
        WHEN EXTRACT(HOUR FROM (CURRENT_DATE - detected_at)) > 48 THEN 'critical'
        WHEN EXTRACT(HOUR FROM (CURRENT_DATE - detected_at)) > 24 THEN 'high'
        ELSE 'medium'
    END as severity,
    COUNT(*) as alert_count,
    jsonb_agg(
        jsonb_build_object(
            'incident_id', id,
            'title', title,
            'hours_since_detection', EXTRACT(HOUR FROM (CURRENT_DATE - detected_at))
        )
    ) as alert_details
FROM public.breach_incidents
WHERE status IN ('detected', 'investigating')
    AND detected_at < CURRENT_DATE - INTERVAL '4 hours'
GROUP BY tenant_id

UNION ALL

SELECT
    tenant_id,
    'High Risk Transfer' as alert_type,
    'high' as severity,
    COUNT(*) as alert_count,
    jsonb_agg(
        jsonb_build_object(
            'transfer_id', id,
            'destination', destination_location,
            'mechanism', transfer_mechanism
        )
    ) as alert_details
FROM public.international_transfer_records
WHERE destination_location IN ('RU', 'CN', 'IR', 'BY', 'KP')
    AND (transfer_mechanism IS NULL OR transfer_mechanism = 'none')
GROUP BY tenant_id;

-- =====================================
-- COMPLIANCE TRENDS VIEW
-- =====================================

CREATE OR REPLACE VIEW public.vw_compliance_trends AS
WITH daily_scores AS (
    SELECT
        tenant_id,
        DATE(created_at) as date,
        -- Calculate daily scores based on incidents and activities
        COUNT(*) FILTER (WHERE table_name = 'breach_incidents') as daily_incidents,
        COUNT(*) FILTER (WHERE table_name = 'breach_notifications' AND action = 'create') as daily_notifications,
        COUNT(*) FILTER (WHERE table_name = 'international_transfer_records' AND action = 'create') as daily_transfers,
        COUNT(*) FILTER (WHERE table_name = 'vendor_compliance_assessments' AND action = 'create') as daily_assessments
    FROM public.breach_audit_logs
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY tenant_id, DATE(created_at)
)
SELECT
    tenant_id,
    date,
    daily_incidents,
    daily_notifications,
    daily_transfers,
    daily_assessments,

    -- Calculate trend-based scores
    ROUND(
        GREATEST(0,
            100 -
            (daily_incidents * 5) -
            (CASE WHEN daily_transfers > 10 THEN 10 ELSE 0 END) +
            (daily_assessments * 2)
        ), 2
    ) as daily_score,

    -- Rolling averages
    ROUND(
        AVG(daily_score) OVER (
            PARTITION BY tenant_id
            ORDER BY date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ), 2
    ) as weekly_average,

    ROUND(
        AVG(daily_score) OVER (
            PARTITION BY tenant_id
            ORDER BY date
            ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
        ), 2
    ) as monthly_average,

    CURRENT_TIMESTAMP as last_updated
FROM daily_scores
ORDER BY tenant_id, date;

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- BAA Compliance View Indexes
CREATE INDEX IF NOT EXISTS idx_vw_baa_compliance_tenant ON public.vw_baa_compliance_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vw_baa_compliance_execution ON public.vw_baa_compliance_metrics(execution_rate DESC);

-- Vendor Compliance View Indexes
CREATE INDEX IF NOT EXISTS idx_vw_vendor_compliance_tenant ON public.vw_vendor_compliance_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vw_vendor_compliance_coverage ON public.vw_vendor_compliance_metrics(assessment_coverage DESC);

-- Breach Incident View Indexes
CREATE INDEX IF NOT EXISTS idx_vw_breach_incident_tenant ON public.vw_breach_incident_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vw_breach_incident_resolution ON public.vw_breach_incident_metrics(total_incidents DESC);

-- Transfer Compliance View Indexes
CREATE INDEX IF NOT EXISTS idx_vw_transfer_compliance_tenant ON public.vw_transfer_compliance_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vw_transfer_compliance_rate ON public.vw_transfer_compliance_metrics(compliance_rate DESC);

-- Compliance Scores View Indexes
CREATE INDEX IF NOT EXISTS idx_vw_compliance_scores_tenant ON public.vw_compliance_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vw_compliance_scores_overall ON public.vw_compliance_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_vw_compliance_scores_hipaa ON public.vw_compliance_scores(hipaa_score DESC);
CREATE INDEX IF NOT EXISTS idx_vw_compliance_scores_gdpr ON public.vw_compliance_scores(gdpr_score DESC);
CREATE INDEX IF NOT EXISTS idx_vw_compliance_scores_soc2 ON public.vw_compliance_scores(soc2_score DESC);

-- Compliance Alerts View Indexes
CREATE INDEX IF NOT EXISTS idx_vw_compliance_alerts_tenant ON public.vw_compliance_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vw_compliance_alerts_severity ON public.vw_compliance_alerts(severity, tenant_id);

-- Compliance Trends View Indexes
CREATE INDEX IF NOT EXISTS idx_vw_compliance_trends_tenant ON public.vw_compliance_trends(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vw_compliance_trends_date ON public.vw_compliance_trends(date DESC, tenant_id);

-- =====================================
-- SUCCESS MESSAGE
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'COMPLIANCE METRICS VIEWS CREATED SUCCESSFULLY!';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Created the following database views:';
    RAISE NOTICE '- vw_baa_compliance_metrics';
    RAISE NOTICE '- vw_vendor_compliance_metrics';
    RAISE NOTICE '- vw_breach_incident_metrics';
    RAISE NOTICE '- vw_breach_notification_metrics';
    RAISE NOTICE '- vw_transfer_compliance_metrics';
    RAISE NOTICE '- vw_tia_compliance_metrics';
    RAISE NOTICE '- vw_compliance_scores';
    RAISE NOTICE '- vw_compliance_alerts';
    RAISE NOTICE '- vw_compliance_trends';
    RAISE NOTICE '';
    RAISE NOTICE 'Benefits:';
    RAISE NOTICE '- Pre-aggregated metrics for fast dashboard loading';
    RAISE NOTICE '- Real-time compliance scoring (0-100 scale)';
    RAISE NOTICE '- Historical trend analysis support';
    RAISE NOTICE '- Automated alert generation';
    RAISE NOTICE '- Multi-framework compliance tracking';
    RAISE NOTICE '================================================';
END $$;