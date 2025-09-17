-- Comprehensive Logging and Audit Trail Schema
-- This script creates tables for enterprise-grade logging, audit trails, and compliance

-- System logs table (enhanced version)
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  source TEXT NOT NULL CHECK (source IN ('api', 'database', 'auth', 'external', 'system', 'application')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT,
  request_id TEXT,
  ip_address INET,
  user_agent TEXT,
  error_stack TEXT,
  tags TEXT[] DEFAULT '{}',
  correlation_id TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for system_logs
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_request_id ON system_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation_id ON system_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_id ON system_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_tags ON system_logs USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_system_logs_metadata ON system_logs USING GIN(metadata);

-- Audit trails table for all user actions
CREATE TABLE IF NOT EXISTS public.audit_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  method TEXT CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  endpoint TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  request_id TEXT,
  correlation_id TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  duration_ms INTEGER,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  compliance_flags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for audit_trails
CREATE INDEX IF NOT EXISTS idx_audit_trails_timestamp ON audit_trails(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trails_user_id ON audit_trails(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trails_tenant_id ON audit_trails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_trails_action ON audit_trails(action);
CREATE INDEX IF NOT EXISTS idx_audit_trails_resource_type ON audit_trails(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_trails_resource_id ON audit_trails(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_trails_correlation_id ON audit_trails(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_trails_risk_level ON audit_trails(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_trails_compliance_flags ON audit_trails USING GIN(compliance_flags);

-- Log retention policies table
CREATE TABLE IF NOT EXISTS public.log_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  log_type TEXT NOT NULL CHECK (log_type IN ('system_logs', 'audit_trails', 'security_events', 'auth_audit_log')),
  retention_days INTEGER NOT NULL,
  archive_after_days INTEGER,
  delete_after_days INTEGER,
  compression_enabled BOOLEAN DEFAULT false,
  encryption_enabled BOOLEAN DEFAULT true,
  backup_required BOOLEAN DEFAULT true,
  compliance_requirements TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log archives table
CREATE TABLE IF NOT EXISTS public.log_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_name TEXT NOT NULL,
  log_type TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  record_count INTEGER NOT NULL,
  file_size_bytes BIGINT,
  storage_location TEXT,
  checksum TEXT,
  compression_algorithm TEXT,
  encryption_algorithm TEXT,
  retention_policy_id UUID REFERENCES log_retention_policies(id),
  archived_by UUID REFERENCES auth.users(id),
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  compliance_verified BOOLEAN DEFAULT false
);

-- Create indexes for log_archives
CREATE INDEX IF NOT EXISTS idx_log_archives_log_type ON log_archives(log_type);
CREATE INDEX IF NOT EXISTS idx_log_archives_start_date ON log_archives(start_date);
CREATE INDEX IF NOT EXISTS idx_log_archives_end_date ON log_archives(end_date);
CREATE INDEX IF NOT EXISTS idx_log_archives_retention_policy ON log_archives(retention_policy_id);

-- Anomaly detection patterns table
CREATE TABLE IF NOT EXISTS public.anomaly_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('frequency', 'threshold', 'correlation', 'behavioral')),
  log_type TEXT NOT NULL,
  conditions JSONB NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  alert_enabled BOOLEAN DEFAULT true,
  alert_channels TEXT[] DEFAULT '{"dashboard"}',
  cooldown_minutes INTEGER DEFAULT 60,
  false_positive_rate DECIMAL(5,4) DEFAULT 0.05,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anomaly detections table
CREATE TABLE IF NOT EXISTS public.anomaly_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES anomaly_patterns(id),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  log_entries JSONB NOT NULL,
  anomaly_score DECIMAL(5,4) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  description TEXT NOT NULL,
  affected_users UUID[] DEFAULT '{}',
  affected_resources JSONB DEFAULT '{}',
  alert_sent BOOLEAN DEFAULT false,
  alert_sent_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for anomaly_detections
CREATE INDEX IF NOT EXISTS idx_anomaly_detections_pattern_id ON anomaly_detections(pattern_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_detections_detected_at ON anomaly_detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_detections_resolved ON anomaly_detections(resolved);

-- Compliance audit reports table
CREATE TABLE IF NOT EXISTS public.compliance_audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('gdpr_audit', 'ccpa_audit', 'soc2_audit', 'iso27001_audit', 'custom_audit')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT CHECK (status IN ('generating', 'completed', 'failed')) DEFAULT 'generating',
  findings JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '{}',
  compliance_score DECIMAL(5,2),
  critical_issues INTEGER DEFAULT 0,
  high_issues INTEGER DEFAULT 0,
  medium_issues INTEGER DEFAULT 0,
  low_issues INTEGER DEFAULT 0,
  total_records_reviewed INTEGER DEFAULT 0,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  next_audit_date TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for compliance_audit_reports
CREATE INDEX IF NOT EXISTS idx_compliance_reports_type ON compliance_audit_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_period ON compliance_audit_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_status ON compliance_audit_reports(status);

-- Log export requests table
CREATE TABLE IF NOT EXISTS public.log_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  log_type TEXT NOT NULL,
  date_range_start TIMESTAMPTZ NOT NULL,
  date_range_end TIMESTAMPTZ NOT NULL,
  filters JSONB DEFAULT '{}',
  format TEXT CHECK (format IN ('json', 'csv', 'parquet', 'xml')) DEFAULT 'json',
  compression TEXT CHECK (compression IN ('none', 'gzip', 'zip', 'bzip2')) DEFAULT 'gzip',
  include_attachments BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  record_count INTEGER,
  file_size_bytes BIGINT,
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  compliance_approved BOOLEAN DEFAULT false,
  compliance_approved_by UUID REFERENCES auth.users(id),
  compliance_approved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for log_export_requests
CREATE INDEX IF NOT EXISTS idx_log_exports_requested_by ON log_export_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_log_exports_status ON log_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_log_exports_date_range ON log_export_requests(date_range_start, date_range_end);

-- Insert default retention policies
INSERT INTO public.log_retention_policies (name, description, log_type, retention_days, archive_after_days, delete_after_days, compliance_requirements) VALUES
('System Logs Standard', 'Standard retention for system logs', 'system_logs', 90, 30, 2555, '{"gdpr", "ccpa"}'),
('Audit Trails Enterprise', 'Extended retention for audit trails', 'audit_trails', 2555, 365, 2555, '{"gdpr", "ccpa", "soc2"}'),
('Security Events Critical', 'Critical retention for security events', 'security_events', 2555, 90, 2555, '{"gdpr", "ccpa", "soc2", "iso27001"}'),
('Auth Logs Standard', 'Standard retention for authentication logs', 'auth_audit_log', 365, 90, 2555, '{"gdpr", "ccpa"}')
ON CONFLICT DO NOTHING;

-- Insert default anomaly patterns
INSERT INTO public.anomaly_patterns (name, description, pattern_type, log_type, conditions, severity) VALUES
('Failed Login Spike', 'Detects unusual spikes in failed login attempts', 'frequency', 'auth_audit_log', '{"action": "login_failed", "threshold": 10, "window_minutes": 5}', 'high'),
('Unusual Login Locations', 'Detects logins from unusual geographic locations', 'behavioral', 'audit_trails', '{"action": "login_success", "check_location_anomaly": true}', 'medium'),
('Admin Privilege Escalation', 'Detects attempts to escalate privileges', 'threshold', 'audit_trails', '{"action": "permission_change", "risk_level": "high"}', 'critical'),
('Data Export Anomalies', 'Detects unusual data export patterns', 'frequency', 'audit_trails', '{"resource_type": "customer_data", "action": "export", "threshold": 5, "window_hours": 1}', 'high'),
('API Rate Limit Violations', 'Detects excessive API calls violating rate limits', 'frequency', 'system_logs', '{"source": "api", "level": "warn", "message_contains": "rate_limit", "threshold": 20, "window_minutes": 10}', 'medium')
ON CONFLICT DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_export_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (these would need to be adjusted based on tenant isolation requirements)
-- For now, basic policies for authenticated users
CREATE POLICY "system_logs_tenant_access" ON public.system_logs FOR SELECT USING (
  tenant_id IS NULL OR tenant_id = ANY(get_user_tenant_ids())
);

CREATE POLICY "audit_trails_tenant_access" ON public.audit_trails FOR SELECT USING (
  tenant_id IS NULL OR tenant_id = ANY(get_user_tenant_ids())
);

CREATE POLICY "log_retention_policies_tenant_access" ON public.log_retention_policies FOR SELECT USING (true);

CREATE POLICY "log_archives_tenant_access" ON public.log_archives FOR SELECT USING (
  EXISTS (SELECT 1 FROM log_retention_policies WHERE id = retention_policy_id AND is_active = true)
);

CREATE POLICY "anomaly_patterns_tenant_access" ON public.anomaly_patterns FOR SELECT USING (true);

CREATE POLICY "anomaly_detections_tenant_access" ON public.anomaly_detections FOR SELECT USING (true);

CREATE POLICY "compliance_reports_tenant_access" ON public.compliance_audit_reports FOR SELECT USING (true);

CREATE POLICY "log_exports_user_access" ON public.log_export_requests FOR SELECT USING (auth.uid() = requested_by);

-- Create functions for log management
CREATE OR REPLACE FUNCTION public.get_correlation_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'corr_' || encode(gen_random_bytes(16), 'hex');
END;
$$;

-- Function to automatically archive old logs
CREATE OR REPLACE FUNCTION public.archive_old_logs()
RETURNS TABLE(processed_count INTEGER, archived_count INTEGER, deleted_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  policy_record RECORD;
  archive_start TIMESTAMPTZ;
  archive_end TIMESTAMPTZ;
  processed INTEGER := 0;
  archived INTEGER := 0;
  deleted INTEGER := 0;
BEGIN
  FOR policy_record IN SELECT * FROM log_retention_policies WHERE is_active = true LOOP
    -- Archive logs
    IF policy_record.archive_after_days IS NOT NULL THEN
      archive_start := NOW() - INTERVAL '1 day' * policy_record.archive_after_days;
      archive_end := NOW() - INTERVAL '1 day' * policy_record.retention_days;

      -- This would trigger actual archiving logic
      -- For now, just count
      CASE policy_record.log_type
        WHEN 'system_logs' THEN
          SELECT COUNT(*) INTO processed FROM system_logs
          WHERE timestamp < archive_start AND timestamp >= archive_end;
        WHEN 'audit_trails' THEN
          SELECT COUNT(*) INTO processed FROM audit_trails
          WHERE timestamp < archive_start AND timestamp >= archive_end;
        WHEN 'security_events' THEN
          SELECT COUNT(*) INTO processed FROM security_events
          WHERE timestamp < archive_start AND timestamp >= archive_end;
        WHEN 'auth_audit_log' THEN
          SELECT COUNT(*) INTO processed FROM auth_audit_log
          WHERE created_at < archive_start AND created_at >= archive_end;
      END CASE;

      archived := archived + processed;
    END IF;

    -- Delete old logs
    IF policy_record.delete_after_days IS NOT NULL THEN
      archive_start := NOW() - INTERVAL '1 day' * policy_record.delete_after_days;

      CASE policy_record.log_type
        WHEN 'system_logs' THEN
          DELETE FROM system_logs WHERE timestamp < archive_start;
          GET DIAGNOSTICS processed = ROW_COUNT;
        WHEN 'audit_trails' THEN
          DELETE FROM audit_trails WHERE timestamp < archive_start;
          GET DIAGNOSTICS processed = ROW_COUNT;
        WHEN 'security_events' THEN
          DELETE FROM security_events WHERE timestamp < archive_start;
          GET DIAGNOSTICS processed = ROW_COUNT;
        WHEN 'auth_audit_log' THEN
          DELETE FROM auth_audit_log WHERE created_at < archive_start;
          GET DIAGNOSTICS processed = ROW_COUNT;
      END CASE;

      deleted := deleted + processed;
    END IF;
  END LOOP;

  RETURN QUERY SELECT archived, archived, deleted;
END;
$$;

-- Function to detect anomalies
CREATE OR REPLACE FUNCTION public.detect_anomalies()
RETURNS TABLE(pattern_name TEXT, detections_count INTEGER, severity TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  pattern_record RECORD;
  detection_count INTEGER;
BEGIN
  FOR pattern_record IN SELECT * FROM anomaly_patterns WHERE is_active = true LOOP
    -- This would implement actual anomaly detection logic
    -- For now, return placeholder
    detection_count := 0;

    IF detection_count > 0 THEN
      RETURN QUERY SELECT pattern_record.name, detection_count, pattern_record.severity::TEXT;
    END IF;
  END LOOP;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.system_logs TO authenticated;
GRANT SELECT ON public.audit_trails TO authenticated;
GRANT SELECT ON public.log_retention_policies TO authenticated;
GRANT SELECT ON public.log_archives TO authenticated;
GRANT SELECT ON public.anomaly_patterns TO authenticated;
GRANT SELECT ON public.anomaly_detections TO authenticated;
GRANT SELECT ON public.compliance_audit_reports TO authenticated;
GRANT SELECT, INSERT ON public.log_export_requests TO authenticated;

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_logs_composite ON system_logs(level, source, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_trails_composite ON audit_trails(action, resource_type, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_anomaly_detections_composite ON anomaly_detections(pattern_id, detected_at DESC, resolved);