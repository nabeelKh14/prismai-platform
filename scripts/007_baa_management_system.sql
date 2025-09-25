-- BAA (Business Associate Agreement) Management System for HIPAA Compliance
-- Comprehensive system for managing BAA templates, agreements, vendor compliance, and audit trails

-- =====================================
-- BAA TEMPLATES WITH VERSION CONTROL
-- =====================================

-- BAA template library with version control
CREATE TABLE IF NOT EXISTS public.baa_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT CHECK (template_type IN ('standard', 'custom', 'enterprise')) DEFAULT 'standard',
  template_content JSONB NOT NULL, -- Rich template with placeholders and sections
  default_variables JSONB DEFAULT '{}', -- Default values for template variables
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- BAA template versions for version control
CREATE TABLE IF NOT EXISTS public.baa_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.baa_templates(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL, -- Semantic versioning (e.g., "1.0.0", "1.1.0")
  version_notes TEXT,
  template_content JSONB NOT NULL,
  default_variables JSONB DEFAULT '{}',
  is_current BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, version_number)
);

-- =====================================
-- BAA AGREEMENTS LIFECYCLE MANAGEMENT
-- =====================================

-- BAA agreements with complete lifecycle tracking
CREATE TABLE IF NOT EXISTS public.baa_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.baa_templates(id) ON DELETE CASCADE,
  template_version_id UUID NOT NULL REFERENCES public.baa_template_versions(id) ON DELETE CASCADE,

  -- Vendor/Covered Entity Information
  vendor_name TEXT NOT NULL,
  vendor_contact_name TEXT,
  vendor_contact_email TEXT,
  vendor_contact_phone TEXT,
  vendor_address JSONB, -- Structured address information

  -- Agreement Details
  agreement_number TEXT UNIQUE, -- Auto-generated or manual
  effective_date DATE NOT NULL,
  expiration_date DATE,
  renewal_notice_days INTEGER DEFAULT 90, -- Days before expiration to send notice

  -- Lifecycle Status
  status TEXT CHECK (status IN ('draft', 'review', 'pending_signature', 'executed', 'expired', 'terminated', 'renewed')) DEFAULT 'draft',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',

  -- Customizations and Variables
  custom_variables JSONB DEFAULT '{}', -- Tenant-specific customizations
  customized_content JSONB, -- Any custom clauses or modifications

  -- Execution Tracking
  executed_at TIMESTAMP WITH TIME ZONE,
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  execution_method TEXT CHECK (execution_method IN ('electronic', 'wet_signature', 'verbal')) DEFAULT 'electronic',

  -- Metadata
  tags TEXT[], -- For categorization and filtering
  notes TEXT,
  attachments JSONB DEFAULT '[]', -- Related document references

  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- VENDOR COMPLIANCE TRACKING
-- =====================================

-- Vendor profiles for compliance management
CREATE TABLE IF NOT EXISTS public.baa_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  vendor_type TEXT CHECK (vendor_type IN ('cloud_service', 'software_vendor', 'consultant', 'data_processor', 'other')) DEFAULT 'other',

  -- Contact Information
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  compliance_contact_name TEXT,
  compliance_contact_email TEXT,
  compliance_contact_phone TEXT,

  -- Compliance Information
  business_address JSONB,
  tax_id TEXT, -- EIN or equivalent
  duns_number TEXT, -- DUNS number for vendor identification

  -- Risk Assessment
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  last_assessment_date DATE,
  next_assessment_date DATE,
  assessment_frequency_months INTEGER DEFAULT 12,

  -- Status and Metadata
  status TEXT CHECK (status IN ('active', 'inactive', 'under_review', 'suspended')) DEFAULT 'active',
  notes TEXT,
  tags TEXT[],

  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, vendor_name)
);

-- Vendor compliance assessments
CREATE TABLE IF NOT EXISTS public.vendor_compliance_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.baa_vendors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Assessment Details
  assessment_type TEXT CHECK (assessment_type IN ('initial', 'annual', 'incident_response', 'renewal')) DEFAULT 'initial',
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assessor_name TEXT,
  assessor_contact TEXT,

  -- Compliance Scores (0-100 scale)
  overall_compliance_score DECIMAL(5,2),
  security_score DECIMAL(5,2),
  privacy_score DECIMAL(5,2),
  operational_score DECIMAL(5,2),

  -- Assessment Components
  assessment_areas JSONB DEFAULT '{}', -- Detailed breakdown by compliance area
  findings JSONB DEFAULT '[]', -- Array of findings with severity levels
  recommendations JSONB DEFAULT '[]', -- Array of recommendations
  remediation_plan JSONB, -- Required remediation actions

  -- Status and Tracking
  status TEXT CHECK (status IN ('draft', 'in_review', 'approved', 'requires_action', 'rejected')) DEFAULT 'draft',
  due_date DATE,
  completed_date DATE,

  -- Metadata
  assessment_document_url TEXT, -- Link to full assessment document
  notes TEXT,

  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- BAA COMPLIANCE MONITORING
-- =====================================

-- BAA compliance monitoring and incidents
CREATE TABLE IF NOT EXISTS public.baa_compliance_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.baa_agreements(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.baa_vendors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Incident Details
  incident_type TEXT CHECK (incident_type IN ('breach', 'non_compliance', 'audit_finding', 'contract_violation', 'security_incident')) NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('open', 'investigating', 'remediation', 'resolved', 'closed')) DEFAULT 'open',

  -- Description and Impact
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact_assessment TEXT,
  affected_phi_types TEXT[], -- Types of PHI potentially affected
  affected_individuals_count INTEGER,

  -- Timeline
  discovered_date DATE NOT NULL,
  reported_date DATE,
  resolved_date DATE,

  -- Resolution
  resolution_summary TEXT,
  preventive_measures TEXT,
  lessons_learned TEXT,

  -- Reporting Requirements
  hipaa_breach_notification_required BOOLEAN DEFAULT false,
  notification_deadline DATE,
  notification_sent_date DATE,

  -- Metadata
  tags TEXT[],
  notes TEXT,
  attachments JSONB DEFAULT '[]',

  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- BAA AUDIT LOGGING
-- =====================================

-- Comprehensive audit trail for all BAA-related activities
CREATE TABLE IF NOT EXISTS public.baa_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Activity Details
  activity_type TEXT CHECK (activity_type IN (
    'template_created', 'template_updated', 'template_versioned', 'template_deactivated',
    'agreement_created', 'agreement_updated', 'agreement_executed', 'agreement_expired', 'agreement_terminated',
    'vendor_created', 'vendor_updated', 'vendor_assessed',
    'compliance_incident_created', 'compliance_incident_updated', 'compliance_incident_resolved',
    'access_granted', 'access_revoked', 'access_attempt_denied'
  )) NOT NULL,

  -- Related Entities
  entity_type TEXT CHECK (entity_type IN ('template', 'agreement', 'vendor', 'assessment', 'incident', 'access_control')) NOT NULL,
  entity_id UUID, -- References the affected entity
  related_entity_type TEXT, -- For cross-references (e.g., agreement -> vendor)
  related_entity_id UUID,

  -- Activity Details
  description TEXT NOT NULL,
  old_values JSONB, -- Previous state for updates
  new_values JSONB, -- New state for updates
  metadata JSONB DEFAULT '{}', -- Additional context

  -- Context Information
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- BAA ACCESS CONTROLS
-- =====================================

-- BAA-based access permissions
CREATE TABLE IF NOT EXISTS public.baa_access_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.baa_agreements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Permission Details
  permission_type TEXT CHECK (permission_type IN ('view', 'edit', 'execute', 'terminate', 'manage_compliance')) NOT NULL,
  resource_type TEXT CHECK (resource_type IN ('agreement', 'vendor_data', 'phi_data', 'audit_logs', 'all')) DEFAULT 'agreement',

  -- Scope and Conditions
  conditions JSONB DEFAULT '{}', -- Conditional access rules
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Status
  is_active BOOLEAN DEFAULT true,
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agreement_id, user_id, permission_type, resource_type)
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- BAA Template indexes
CREATE INDEX IF NOT EXISTS idx_baa_templates_user_id ON public.baa_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_baa_templates_status ON public.baa_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_baa_template_versions_template_id ON public.baa_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_baa_template_versions_current ON public.baa_template_versions(is_current) WHERE is_current = true;

-- BAA Agreement indexes
CREATE INDEX IF NOT EXISTS idx_baa_agreements_user_id ON public.baa_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_baa_agreements_status ON public.baa_agreements(status);
CREATE INDEX IF NOT EXISTS idx_baa_agreements_vendor ON public.baa_agreements(vendor_name);
CREATE INDEX IF NOT EXISTS idx_baa_agreements_expiration ON public.baa_agreements(expiration_date);
CREATE INDEX IF NOT EXISTS idx_baa_agreements_effective ON public.baa_agreements(effective_date);
CREATE INDEX IF NOT EXISTS idx_baa_agreements_number ON public.baa_agreements(agreement_number);

-- Vendor indexes
CREATE INDEX IF NOT EXISTS idx_baa_vendors_user_id ON public.baa_vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_baa_vendors_status ON public.baa_vendors(status);
CREATE INDEX IF NOT EXISTS idx_baa_vendors_risk ON public.baa_vendors(risk_level);
CREATE INDEX IF NOT EXISTS idx_baa_vendors_assessment ON public.baa_vendors(next_assessment_date);

-- Compliance assessment indexes
CREATE INDEX IF NOT EXISTS idx_vendor_assessments_vendor_id ON public.vendor_compliance_assessments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_assessments_status ON public.vendor_compliance_assessments(status);
CREATE INDEX IF NOT EXISTS idx_vendor_assessments_due ON public.vendor_compliance_assessments(due_date);
CREATE INDEX IF NOT EXISTS idx_vendor_assessments_date ON public.vendor_compliance_assessments(assessment_date DESC);

-- Incident indexes
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_agreement ON public.baa_compliance_incidents(agreement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_vendor ON public.baa_compliance_incidents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_status ON public.baa_compliance_incidents(status);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_severity ON public.baa_compliance_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_type ON public.baa_compliance_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_discovered ON public.baa_compliance_incidents(discovered_date DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_baa_audit_logs_user_id ON public.baa_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_baa_audit_logs_activity ON public.baa_audit_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_baa_audit_logs_entity ON public.baa_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_baa_audit_logs_created ON public.baa_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_baa_audit_logs_related ON public.baa_audit_logs(related_entity_type, related_entity_id);

-- Access permission indexes
CREATE INDEX IF NOT EXISTS idx_baa_access_permissions_agreement ON public.baa_access_permissions(agreement_id);
CREATE INDEX IF NOT EXISTS idx_baa_access_permissions_user ON public.baa_access_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_baa_access_permissions_active ON public.baa_access_permissions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_baa_access_permissions_expires ON public.baa_access_permissions(expires_at) WHERE expires_at IS NOT NULL;

-- =====================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================

-- Enable RLS on all BAA tables
ALTER TABLE public.baa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baa_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baa_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baa_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baa_compliance_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baa_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baa_access_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for BAA templates
CREATE POLICY "baa_templates_own" ON public.baa_templates USING (auth.uid() = user_id);
CREATE POLICY "baa_template_versions_own" ON public.baa_template_versions USING (auth.uid() = (SELECT user_id FROM public.baa_templates WHERE id = template_id));

-- RLS policies for BAA agreements
CREATE POLICY "baa_agreements_own" ON public.baa_agreements USING (auth.uid() = user_id);
CREATE POLICY "baa_agreements_template_own" ON public.baa_agreements USING (auth.uid() = (SELECT user_id FROM public.baa_templates WHERE id = template_id));

-- RLS policies for vendors
CREATE POLICY "baa_vendors_own" ON public.baa_vendors USING (auth.uid() = user_id);

-- RLS policies for compliance assessments
CREATE POLICY "vendor_assessments_own" ON public.vendor_compliance_assessments USING (auth.uid() = user_id);
CREATE POLICY "vendor_assessments_vendor_own" ON public.vendor_compliance_assessments USING (auth.uid() = (SELECT user_id FROM public.baa_vendors WHERE id = vendor_id));

-- RLS policies for compliance incidents
CREATE POLICY "compliance_incidents_own" ON public.baa_compliance_incidents USING (auth.uid() = user_id);
CREATE POLICY "compliance_incidents_agreement_own" ON public.baa_compliance_incidents USING (auth.uid() = (SELECT user_id FROM public.baa_agreements WHERE id = agreement_id));

-- RLS policies for audit logs
CREATE POLICY "baa_audit_logs_own" ON public.baa_audit_logs USING (auth.uid() = user_id);

-- RLS policies for access permissions
CREATE POLICY "access_permissions_own" ON public.baa_access_permissions USING (auth.uid() = user_id);
CREATE POLICY "access_permissions_granted_own" ON public.baa_access_permissions USING (auth.uid() = granted_by);

-- =====================================
-- FUNCTIONS AND TRIGGERS
-- =====================================

-- Function to automatically generate agreement numbers
CREATE OR REPLACE FUNCTION generate_baa_agreement_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
  formatted_number TEXT;
BEGIN
  -- Get the next sequential number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(agreement_number FROM 'BAA-(\d{4})') AS INTEGER)
  ), 0) + 1
  INTO next_number
  FROM public.baa_agreements
  WHERE agreement_number LIKE 'BAA-' || EXTRACT(YEAR FROM CURRENT_DATE) || '%';

  -- Format as BAA-YYYY-NNNN
  formatted_number := 'BAA-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
                     LPAD(next_number::TEXT, 4, '0');

  RETURN formatted_number;
END;
$$;

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_baa_audit_log(
  p_user_id UUID,
  p_activity_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_description TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO public.baa_audit_logs (
    user_id,
    activity_type,
    entity_type,
    entity_id,
    description,
    old_values,
    new_values,
    metadata
  ) VALUES (
    p_user_id,
    p_activity_type,
    p_entity_type,
    p_entity_id,
    p_description,
    p_old_values,
    p_new_values,
    p_metadata
  ) RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$;

-- Function to check if BAA is active and not expired
CREATE OR REPLACE FUNCTION is_baa_active(baa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.baa_agreements
    WHERE id = baa_id
      AND status = 'executed'
      AND expiration_date > CURRENT_DATE
  );
END;
$$;

-- Function to get BAA expiration warnings
CREATE OR REPLACE FUNCTION get_baa_expiration_warnings(days_ahead INTEGER DEFAULT 90)
RETURNS TABLE (
  agreement_id UUID,
  vendor_name TEXT,
  expiration_date DATE,
  days_until_expiration INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ba.id,
    ba.vendor_name,
    ba.expiration_date,
    (ba.expiration_date - CURRENT_DATE)::INTEGER as days_until_expiration
  FROM public.baa_agreements ba
  WHERE ba.status = 'executed'
    AND ba.expiration_date <= CURRENT_DATE + INTERVAL '1 day' * days_ahead
    AND ba.expiration_date > CURRENT_DATE
  ORDER BY ba.expiration_date;
END;
$$;

-- =====================================
-- SEED DATA
-- =====================================

-- Insert default BAA template
INSERT INTO public.baa_templates (
  user_id,
  name,
  description,
  template_type,
  template_content,
  default_variables,
  created_by
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Standard HIPAA Business Associate Agreement',
  'Comprehensive HIPAA-compliant BAA template with all required elements',
  'standard',
  '{
    "sections": [
      {
        "title": "Parties",
        "content": "This Business Associate Agreement (\"Agreement\") is entered into by and between [COVERED_ENTITY_NAME] (\"Covered Entity\") and [BUSINESS_ASSOCIATE_NAME] (\"Business Associate\").",
        "order": 1
      },
      {
        "title": "Definitions",
        "content": "All capitalized terms used but not otherwise defined in this Agreement shall have the meanings ascribed to them in HIPAA and HITECH Act.",
        "order": 2
      },
      {
        "title": "Obligations of Business Associate",
        "content": "Business Associate agrees to comply with all applicable requirements of HIPAA and HITECH Act regarding the security and privacy of Protected Health Information.",
        "order": 3
      },
      {
        "title": "Permitted Uses and Disclosures",
        "content": "Business Associate may use or disclose PHI only as permitted or required by this Agreement or as Required by Law.",
        "order": 4
      },
      {
        "title": "Security Rule Obligations",
        "content": "Business Associate shall implement appropriate administrative, physical, and technical safeguards to prevent unauthorized use or disclosure of PHI.",
        "order": 5
      },
      {
        "title": "Breach Notification",
        "content": "Business Associate shall report any Security Incident or Breach of Unsecured PHI to Covered Entity within the timeframes required by law.",
        "order": 6
      }
    ],
    "required_clauses": [
      "HIPAA Compliance",
      "Security Safeguards",
      "Breach Notification",
      "Subcontractor Requirements",
      "Access and Amendment",
      "Accounting of Disclosures",
      "Termination Provisions"
    ]
  }'::jsonb,
  '{
    "covered_entity_name": "",
    "business_associate_name": "",
    "effective_date": "",
    "termination_provisions": "Standard termination for cause provisions apply"
  }'::jsonb,
  '00000000-0000-0000-0000-000000000000'::uuid
) ON CONFLICT DO NOTHING;

-- Insert default template version
INSERT INTO public.baa_template_versions (
  template_id,
  version_number,
  version_notes,
  template_content,
  default_variables,
  is_current,
  created_by
)
SELECT
  id,
  '1.0.0',
  'Initial HIPAA-compliant BAA template version',
  template_content,
  default_variables,
  true,
  '00000000-0000-0000-0000-000000000000'::uuid
FROM public.baa_templates
WHERE name = 'Standard HIPAA Business Associate Agreement'
  AND user_id = '00000000-0000-0000-0000-000000000000'::uuid
ON CONFLICT DO NOTHING;