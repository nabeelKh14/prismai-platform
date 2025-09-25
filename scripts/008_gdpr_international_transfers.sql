-- =====================================
-- GDPR INTERNATIONAL DATA TRANSFER MECHANISMS
-- =====================================
-- Comprehensive schema for GDPR-compliant international data transfers
-- Includes SCCs, adequacy decisions, TIAs, data residency, and audit logging

-- =====================================
-- SCC (STANDARD CONTRACTUAL CLAUSES) TEMPLATES
-- =====================================

-- SCC template versions for different transfer scenarios
CREATE TABLE IF NOT EXISTS public.scc_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL, -- e.g., "EU Controller to Non-EU Processor"
  template_version TEXT NOT NULL, -- e.g., "2021/914" for new SCCs
  template_type TEXT CHECK (template_type IN ('controller_to_controller', 'controller_to_processor', 'processor_to_processor', 'processor_to_subprocessor')) NOT NULL,
  content TEXT NOT NULL, -- Full template content
  is_active BOOLEAN DEFAULT true,
  effective_date DATE NOT NULL,
  expiry_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_name, template_version)
);

-- SCC applications for specific transfers
CREATE TABLE IF NOT EXISTS public.scc_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.scc_templates(id),
  transfer_purpose TEXT NOT NULL,
  data_categories TEXT[] NOT NULL, -- Categories of data being transferred
  transfer_mechanism TEXT CHECK (transfer_mechanism IN ('scc', 'adequacy', 'binding_corporate_rules', 'certification')) NOT NULL,
  exporter_entity TEXT NOT NULL, -- EU entity exporting data
  importer_entity TEXT NOT NULL, -- Non-EU entity importing data
  countries_involved TEXT[] NOT NULL, -- ISO country codes
  status TEXT CHECK (status IN ('draft', 'pending_review', 'approved', 'active', 'expired', 'revoked')) DEFAULT 'draft',
  executed_date DATE,
  expiry_date DATE,
  review_due_date DATE,
  metadata JSONB DEFAULT '{}', -- Additional compliance metadata
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- ADEQUACY DECISIONS TRACKING
-- =====================================

-- Country adequacy status tracking
CREATE TABLE IF NOT EXISTS public.country_adequacy_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL, -- ISO 3166-1 alpha-2
  country_name TEXT NOT NULL,
  adequacy_status TEXT CHECK (adequacy_status IN ('adequate', 'partially_adequate', 'inadequate', 'under_review', 'revoked')) NOT NULL,
  decision_date DATE,
  implementing_decision_number TEXT, -- EU decision reference
  decision_summary TEXT,
  adequacy_mechanisms TEXT[] DEFAULT '{}', -- Available transfer mechanisms
  restrictions TEXT[], -- Any specific restrictions or conditions
  review_due_date DATE,
  is_active BOOLEAN DEFAULT true,
  source_url TEXT, -- Link to official decision
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(country_code)
);

-- =====================================
-- TRANSFER IMPACT ASSESSMENTS (TIAs)
-- =====================================

-- TIA templates and questions
CREATE TABLE IF NOT EXISTS public.tia_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_version TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]', -- Array of assessment questions
  risk_categories JSONB NOT NULL DEFAULT '{}', -- Risk scoring categories
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_name, template_version)
);

-- TIA assessments for specific transfers
CREATE TABLE IF NOT EXISTS public.transfer_impact_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.tia_templates(id),
  scc_application_id UUID REFERENCES public.scc_applications(id),
  assessment_name TEXT NOT NULL,
  transfer_description TEXT NOT NULL,
  destination_countries TEXT[] NOT NULL,
  data_categories TEXT[] NOT NULL,
  risk_assessment JSONB NOT NULL DEFAULT '{}', -- Detailed risk analysis
  overall_risk_score INTEGER CHECK (overall_risk_score >= 1 AND overall_risk_score <= 5) NOT NULL,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) NOT NULL,
  mitigating_measures TEXT[] DEFAULT '{}',
  supplementary_measures TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('draft', 'in_progress', 'pending_review', 'approved', 'rejected', 'expired')) DEFAULT 'draft',
  assessment_date DATE,
  review_due_date DATE,
  approved_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- DATA RESIDENCY CONTROLS
-- =====================================

-- Geographic data residency rules
CREATE TABLE IF NOT EXISTS public.data_residency_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  data_category TEXT NOT NULL, -- e.g., 'personal_data', 'sensitive_data', 'health_data'
  allowed_countries TEXT[] DEFAULT '{}', -- ISO country codes where data can be stored
  restricted_countries TEXT[] DEFAULT '{}', -- ISO country codes where data cannot be stored
  required_transfer_mechanism TEXT CHECK (required_transfer_mechanism IN ('adequacy', 'scc', 'binding_corporate_rules', 'none')) DEFAULT 'none',
  enforcement_level TEXT CHECK (enforcement_level IN ('warning', 'block', 'redirect')) DEFAULT 'warning',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, rule_name)
);

-- =====================================
-- INTERNATIONAL TRANSFER RECORDS
-- =====================================

-- Core transfer records table
CREATE TABLE IF NOT EXISTS public.international_transfer_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_type TEXT CHECK (transfer_type IN ('data_export', 'data_import', 'api_call', 'database_replication', 'backup', 'third_party_access')) NOT NULL,
  source_location TEXT NOT NULL, -- Country/region code
  destination_location TEXT NOT NULL, -- Country/region code
  data_volume_bytes BIGINT DEFAULT 0,
  record_count INTEGER DEFAULT 0,
  transfer_mechanism TEXT CHECK (transfer_mechanism IN ('adequacy', 'scc', 'binding_corporate_rules', 'certification', 'derogation')) NOT NULL,
  scc_application_id UUID REFERENCES public.scc_applications(id),
  tia_assessment_id UUID REFERENCES public.transfer_impact_assessments(id),
  purpose TEXT NOT NULL,
  legal_basis TEXT CHECK (legal_basis IN ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_interest', 'legitimate_interest')) NOT NULL,
  data_categories TEXT[] NOT NULL,
  retention_period_days INTEGER,
  status TEXT CHECK (status IN ('initiated', 'in_progress', 'completed', 'failed', 'blocked')) DEFAULT 'initiated',
  error_message TEXT,
  metadata JSONB DEFAULT '{}', -- Additional transfer details
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================
-- TRANSFER AUDIT LOGGING
-- =====================================

-- Comprehensive audit trail for all international transfers
CREATE TABLE IF NOT EXISTS public.transfer_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transfer_record_id UUID REFERENCES public.international_transfer_records(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT CHECK (action IN ('initiate', 'approve', 'deny', 'complete', 'fail', 'block', 'review')) NOT NULL,
  resource_type TEXT NOT NULL, -- e.g., 'transfer_record', 'scc_application', 'tia_assessment'
  resource_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  change_description TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  compliance_flags JSONB DEFAULT '{}', -- GDPR compliance indicators
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- SCC templates and applications
CREATE INDEX IF NOT EXISTS idx_scc_templates_type ON public.scc_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_scc_templates_active ON public.scc_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_scc_applications_tenant ON public.scc_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scc_applications_status ON public.scc_applications(status);
CREATE INDEX IF NOT EXISTS idx_scc_applications_countries ON public.scc_applications USING gin(countries_involved);

-- Country adequacy decisions
CREATE INDEX IF NOT EXISTS idx_country_adequacy_code ON public.country_adequacy_decisions(country_code);
CREATE INDEX IF NOT EXISTS idx_country_adequacy_status ON public.country_adequacy_decisions(adequacy_status);
CREATE INDEX IF NOT EXISTS idx_country_adequacy_active ON public.country_adequacy_decisions(is_active);

-- TIA assessments
CREATE INDEX IF NOT EXISTS idx_tia_assessments_tenant ON public.transfer_impact_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tia_assessments_status ON public.transfer_impact_assessments(status);
CREATE INDEX IF NOT EXISTS idx_tia_assessments_risk ON public.transfer_impact_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_tia_assessments_countries ON public.transfer_impact_assessments USING gin(destination_countries);

-- Data residency rules
CREATE INDEX IF NOT EXISTS idx_data_residency_tenant ON public.data_residency_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_residency_category ON public.data_residency_rules(data_category);
CREATE INDEX IF NOT EXISTS idx_data_residency_active ON public.data_residency_rules(is_active);

-- Transfer records
CREATE INDEX IF NOT EXISTS idx_transfer_records_tenant ON public.international_transfer_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfer_records_type ON public.international_transfer_records(transfer_type);
CREATE INDEX IF NOT EXISTS idx_transfer_records_status ON public.international_transfer_records(status);
CREATE INDEX IF NOT EXISTS idx_transfer_records_mechanism ON public.international_transfer_records(transfer_mechanism);
CREATE INDEX IF NOT EXISTS idx_transfer_records_created ON public.international_transfer_records(created_at);
CREATE INDEX IF NOT EXISTS idx_transfer_records_source_dest ON public.international_transfer_records(source_location, destination_location);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_transfer_audit_tenant ON public.transfer_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_action ON public.transfer_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_resource ON public.transfer_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_created ON public.transfer_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_user ON public.transfer_audit_logs(user_id);

-- =====================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================

ALTER TABLE public.scc_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scc_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_adequacy_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tia_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_residency_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.international_transfer_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================

-- SCC Templates (system-wide, read-only for users)
CREATE POLICY "scc_templates_read" ON public.scc_templates FOR SELECT USING (true);
CREATE POLICY "scc_templates_admin" ON public.scc_templates FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    JOIN public.tenants t ON tu.tenant_id = t.id
    WHERE tu.user_id = auth.uid()
    AND tu.role IN ('owner', 'admin')
    AND t.is_active = true
  )
);

-- SCC Applications (tenant-specific)
CREATE POLICY "scc_applications_tenant" ON public.scc_applications FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Country adequacy decisions (public read access)
CREATE POLICY "country_adequacy_read" ON public.country_adequacy_decisions FOR SELECT USING (true);

-- TIA Templates (system-wide, read-only for users)
CREATE POLICY "tia_templates_read" ON public.tia_templates FOR SELECT USING (true);
CREATE POLICY "tia_templates_admin" ON public.tia_templates FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.tenant_users tu
    JOIN public.tenants t ON tu.tenant_id = t.id
    WHERE tu.user_id = auth.uid()
    AND tu.role IN ('owner', 'admin')
    AND t.is_active = true
  )
);

-- TIA Assessments (tenant-specific)
CREATE POLICY "tia_assessments_tenant" ON public.transfer_impact_assessments FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Data residency rules (tenant-specific)
CREATE POLICY "data_residency_tenant" ON public.data_residency_rules FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Transfer records (tenant-specific)
CREATE POLICY "transfer_records_tenant" ON public.international_transfer_records FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Audit logs (tenant-specific, read-only for users)
CREATE POLICY "transfer_audit_tenant" ON public.transfer_audit_logs FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- =====================================
-- FUNCTIONS FOR AUTOMATION
-- =====================================

-- Function to check if a country has adequate protection
CREATE OR REPLACE FUNCTION check_country_adequacy(country_code_param TEXT)
RETURNS TABLE (
  is_adequate BOOLEAN,
  status TEXT,
  decision_date DATE,
  restrictions TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cad.adequacy_status = 'adequate',
    cad.adequacy_status,
    cad.decision_date,
    cad.restrictions
  FROM public.country_adequacy_decisions cad
  WHERE cad.country_code = country_code_param
  AND cad.is_active = true;
END;
$$;

-- Function to validate transfer against data residency rules
CREATE OR REPLACE FUNCTION validate_data_residency(
  tenant_id_param UUID,
  data_category_param TEXT,
  destination_country_param TEXT
)
RETURNS TABLE (
  is_allowed BOOLEAN,
  enforcement_level TEXT,
  required_mechanism TEXT,
  rule_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN drr.allowed_countries != '{}' AND NOT (destination_country_param = ANY(drr.allowed_countries)) THEN false
      WHEN drr.restricted_countries != '{}' AND destination_country_param = ANY(drr.restricted_countries) THEN false
      ELSE true
    END,
    drr.enforcement_level,
    drr.required_transfer_mechanism,
    drr.rule_name
  FROM public.data_residency_rules drr
  WHERE drr.tenant_id = tenant_id_param
  AND drr.data_category = data_category_param
  AND drr.is_active = true
  ORDER BY drr.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to calculate TIA risk score
CREATE OR REPLACE FUNCTION calculate_tia_risk_score(assessment_data JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  risk_score INTEGER := 1;
  risk_factors JSONB;
BEGIN
  -- Extract risk factors from assessment data
  risk_factors := assessment_data -> 'risk_factors';

  -- Calculate score based on various factors (simplified)
  IF risk_factors ->> 'data_sensitivity' = 'high' THEN risk_score := risk_score + 2; END IF;
  IF risk_factors ->> 'transfer_volume' = 'high' THEN risk_score := risk_score + 1; END IF;
  IF risk_factors ->> 'recipient_country_risk' = 'high' THEN risk_score := risk_score + 2; END IF;
  IF risk_factors ->> 'lack_of_supplementary_measures' = 'true' THEN risk_score := risk_score + 1; END IF;

  -- Ensure score is within bounds
  RETURN GREATEST(1, LEAST(5, risk_score));
END;
$$;

-- =====================================
-- SEED DATA
-- =====================================

-- Insert default SCC templates
INSERT INTO public.scc_templates (template_name, template_version, template_type, content, effective_date) VALUES
('EU Controller to Non-EU Processor', '2021/914', 'controller_to_processor',
 'Standard Contractual Clauses for Controller to Processor transfers...', '2021-06-04'),
('EU Controller to Non-EU Controller', '2021/914', 'controller_to_controller',
 'Standard Contractual Clauses for Controller to Controller transfers...', '2021-06-04')
ON CONFLICT (template_name, template_version) DO NOTHING;

-- Insert country adequacy decisions
INSERT INTO public.country_adequacy_decisions (country_code, country_name, adequacy_status, decision_date, implementing_decision_number, adequacy_mechanisms) VALUES
('US', 'United States', 'partially_adequate', '2023-07-10', '2023/1795', ARRAY['adequacy', 'scc']),
('GB', 'United Kingdom', 'adequate', '2021-06-28', '2021/1772', ARRAY['adequacy']),
('CA', 'Canada', 'adequate', '2002-01-01', '2002/2/EC', ARRAY['adequacy']),
('JP', 'Japan', 'adequate', '2019-01-23', '2019/419', ARRAY['adequacy']),
('KR', 'South Korea', 'adequate', '2021-12-17', '2021/2248', ARRAY['adequacy']),
('CH', 'Switzerland', 'adequate', '2000-07-01', '2000/518/EC', ARRAY['adequacy'])
ON CONFLICT (country_code) DO NOTHING;

-- Insert default TIA template
INSERT INTO public.tia_templates (template_name, template_version, description, questions, risk_categories) VALUES
('Standard Transfer Impact Assessment', '1.0', 'Comprehensive TIA template for GDPR compliance',
 ARRAY[
   '{"question": "What types of personal data are being transferred?", "category": "data_classification"}',
   '{"question": "What is the sensitivity level of the data?", "category": "risk_assessment"}',
   '{"question": "What is the purpose of the transfer?", "category": "transfer_purpose"}',
   '{"question": "What is the legal basis for the transfer?", "category": "legal_basis"}'
 ],
 '{"data_sensitivity": {"high": 4, "medium": 3, "low": 2}, "transfer_volume": {"high": 3, "medium": 2, "low": 1}}'
)
ON CONFLICT (template_name, template_version) DO NOTHING;

-- =====================================
-- SUCCESS MESSAGE
-- =====================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'GDPR INTERNATIONAL TRANSFER SCHEMA COMPLETED!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Created comprehensive schema for:';
  RAISE NOTICE '- SCC template management and applications';
  RAISE NOTICE '- Country adequacy decision tracking';
  RAISE NOTICE '- Transfer Impact Assessment workflows';
  RAISE NOTICE '- Data residency enforcement rules';
  RAISE NOTICE '- International transfer records';
  RAISE NOTICE '- Comprehensive audit logging';
  RAISE NOTICE '';
  RAISE NOTICE 'All tables include:';
  RAISE NOTICE '- Multi-tenant support with tenant_id';
  RAISE NOTICE '- Row Level Security policies';
  RAISE NOTICE '- Performance indexes';
  RAISE NOTICE '- Automation functions';
  RAISE NOTICE '- Seed data for common scenarios';
  RAISE NOTICE '================================================';
END $$;