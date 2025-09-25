-- Breach Notification Schema for GDPR, HIPAA, and SOC2 Compliance
-- This script creates the database schema for comprehensive breach notification procedures

-- =====================================================
-- BREACH INCIDENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS breach_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('data_breach', 'security_incident', 'unauthorized_access', 'malware', 'ddos', 'phishing', 'insider_threat', 'third_party', 'other')),
    severity_score INTEGER NOT NULL CHECK (severity_score >= 1 AND severity_score <= 5),
    status VARCHAR(20) NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'assessed', 'notifying', 'resolved', 'closed')),
    detection_method VARCHAR(50) NOT NULL CHECK (detection_method IN ('automated', 'manual', 'third_party', 'user_report', 'monitoring')),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detected_by VARCHAR(100),
    affected_systems TEXT[],
    affected_data_types TEXT[],
    estimated_records_affected INTEGER,
    gdpr_applicable BOOLEAN DEFAULT false,
    hipaa_applicable BOOLEAN DEFAULT false,
    soc2_applicable BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BREACH RISK ASSESSMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS breach_risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breach_incident_id UUID NOT NULL REFERENCES breach_incidents(id) ON DELETE CASCADE,
    assessment_type VARCHAR(20) NOT NULL CHECK (assessment_type IN ('initial', 'detailed', 'final')),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    impact_score INTEGER NOT NULL CHECK (impact_score >= 1 AND impact_score <= 10),
    likelihood_score INTEGER NOT NULL CHECK (likelihood_score >= 1 AND likelihood_score <= 10),
    overall_risk_score INTEGER GENERATED ALWAYS AS (impact_score * likelihood_score) STORED,
    affected_individuals_count INTEGER,
    data_sensitivity_level VARCHAR(20) CHECK (data_sensitivity_level IN ('public', 'internal', 'confidential', 'restricted', 'phi', 'pii', 'financial')),
    business_impact TEXT,
    regulatory_impact TEXT,
    mitigation_measures TEXT[],
    assessment_notes TEXT,
    assessed_by VARCHAR(100),
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BREACH NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS breach_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breach_incident_id UUID NOT NULL REFERENCES breach_incidents(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('gdpr_data_subject', 'gdpr_supervisory_authority', 'hipaa_individual', 'hipaa_hhs', 'hipaa_media', 'soc2_stakeholder', 'internal_team', 'executive', 'board', 'regulator', 'law_enforcement')),
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('individual', 'organization', 'regulator', 'internal')),
    recipient_identifier VARCHAR(500), -- email, organization name, etc.
    recipient_contact_info JSONB, -- structured contact information
    notification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'sent', 'delivered', 'failed', 'acknowledged')),
    required_by_regulation VARCHAR(20) CHECK (required_by_regulation IN ('gdpr', 'hipaa', 'soc2', 'internal_policy')),
    deadline_hours INTEGER, -- for GDPR 72-hour requirement
    scheduled_send_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivery_method VARCHAR(20) CHECK (delivery_method IN ('email', 'sms', 'mail', 'phone', 'portal', 'in_person')),
    template_used VARCHAR(100),
    notification_content JSONB, -- stores the actual notification content
    response_received_at TIMESTAMPTZ,
    response_content TEXT,
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BREACH NOTIFICATION TIMELINES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS breach_notification_timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breach_incident_id UUID NOT NULL REFERENCES breach_incidents(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('breach_detected', 'initial_assessment', 'detailed_assessment', 'gdpr_72h_deadline', 'hipaa_60d_deadline', 'notification_sent', 'breach_resolved', 'follow_up_required', 'regulatory_report')),
    scheduled_at TIMESTAMPTZ,
    actual_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed', 'cancelled')),
    responsible_party VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BREACH AUDIT LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS breach_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breach_incident_id UUID REFERENCES breach_incidents(id) ON DELETE SET NULL,
    table_name VARCHAR(50),
    record_id UUID,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'view', 'export')),
    user_identifier VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    changes JSONB, -- stores before/after values
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BREACH CONTACTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS breach_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name VARCHAR(200),
    contact_type VARCHAR(50) NOT NULL CHECK (contact_type IN ('gdpr_dpo', 'gdpr_supervisory_authority', 'hipaa_privacy_officer', 'hipaa_hhs_ocr', 'soc2_auditor', 'legal_counsel', 'executive_team', 'board_member', 'law_enforcement', 'cyber_insurance', 'pr_firm')),
    contact_name VARCHAR(200),
    email VARCHAR(320),
    phone VARCHAR(50),
    address JSONB,
    jurisdiction VARCHAR(100), -- for GDPR supervisory authorities
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BREACH NOTIFICATION TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS breach_notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(50) UNIQUE NOT NULL,
    template_name VARCHAR(200) NOT NULL,
    regulation VARCHAR(20) CHECK (regulation IN ('gdpr', 'hipaa', 'soc2', 'general')),
    breach_type VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    required_fields TEXT[], -- fields that must be populated
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_breach_incidents_status ON breach_incidents(status);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_detected_at ON breach_incidents(detected_at);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_severity ON breach_incidents(severity_score DESC);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_type ON breach_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_gdpr ON breach_incidents(gdpr_applicable, detected_at) WHERE gdpr_applicable = true;
CREATE INDEX IF NOT EXISTS idx_breach_incidents_hipaa ON breach_incidents(hipaa_applicable, detected_at) WHERE hipaa_applicable = true;

CREATE INDEX IF NOT EXISTS idx_breach_notifications_incident ON breach_notifications(breach_incident_id);
CREATE INDEX IF NOT EXISTS idx_breach_notifications_status ON breach_notifications(notification_status);
CREATE INDEX IF NOT EXISTS idx_breach_notifications_deadline ON breach_notifications(deadline_hours, scheduled_send_at) WHERE deadline_hours IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_breach_notifications_type ON breach_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_breach_timelines_incident ON breach_notification_timelines(breach_incident_id);
CREATE INDEX IF NOT EXISTS idx_breach_timelines_event ON breach_notification_timelines(event_type, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_breach_timelines_deadline ON breach_notification_timelines(deadline_at) WHERE deadline_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_breach_audit_incident ON breach_audit_logs(breach_incident_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_breach_audit_timestamp ON breach_audit_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_breach_contacts_type ON breach_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_breach_contacts_active ON breach_contacts(is_active, contact_type);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================
ALTER TABLE breach_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_notification_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_notification_templates ENABLE ROW LEVEL SECURITY;

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

-- Apply updated_at triggers
CREATE TRIGGER update_breach_incidents_updated_at BEFORE UPDATE ON breach_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_breach_notifications_updated_at BEFORE UPDATE ON breach_notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_breach_contacts_updated_at BEFORE UPDATE ON breach_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_breach_templates_updated_at BEFORE UPDATE ON breach_notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_breach_audit_entry()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO breach_audit_logs (breach_incident_id, table_name, record_id, action, changes)
    VALUES (
        COALESCE(NEW.breach_incident_id, OLD.breach_incident_id),
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE
            WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb
            ELSE jsonb_build_object('before', row_to_json(OLD)::jsonb, 'after', row_to_json(NEW)::jsonb)
        END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Apply audit triggers
CREATE TRIGGER audit_breach_incidents AFTER INSERT OR UPDATE OR DELETE ON breach_incidents FOR EACH ROW EXECUTE FUNCTION create_breach_audit_entry();
CREATE TRIGGER audit_breach_notifications AFTER INSERT OR UPDATE OR DELETE ON breach_notifications FOR EACH ROW EXECUTE FUNCTION create_breach_audit_entry();
CREATE TRIGGER audit_breach_timelines AFTER INSERT OR UPDATE OR DELETE ON breach_notification_timelines FOR EACH ROW EXECUTE FUNCTION create_breach_audit_entry();

-- Function to automatically create GDPR timeline entries
CREATE OR REPLACE FUNCTION create_gdpr_timeline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.gdpr_applicable AND TG_OP = 'INSERT' THEN
        -- Create 72-hour deadline timeline entry
        INSERT INTO breach_notification_timelines (
            breach_incident_id,
            event_type,
            deadline_at,
            responsible_party,
            notes
        ) VALUES (
            NEW.id,
            'gdpr_72h_deadline',
            NEW.detected_at + INTERVAL '72 hours',
            'Data Protection Officer',
            'GDPR requires notification to supervisory authority within 72 hours'
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_gdpr_timeline_trigger AFTER INSERT ON breach_incidents FOR EACH ROW EXECUTE FUNCTION create_gdpr_timeline();

-- Function to automatically create HIPAA timeline entries
CREATE OR REPLACE FUNCTION create_hipaa_timeline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hipaa_applicable AND TG_OP = 'INSERT' THEN
        -- Create 60-day deadline timeline entry for individual notifications
        INSERT INTO breach_notification_timelines (
            breach_incident_id,
            event_type,
            deadline_at,
            responsible_party,
            notes
        ) VALUES (
            NEW.id,
            'hipaa_60d_deadline',
            NEW.detected_at + INTERVAL '60 days',
            'Privacy Officer',
            'HIPAA requires notification to affected individuals within 60 days'
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_hipaa_timeline_trigger AFTER INSERT ON breach_incidents FOR EACH ROW EXECUTE FUNCTION create_hipaa_timeline();

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default breach notification templates
INSERT INTO breach_notification_templates (template_code, template_name, regulation, breach_type, subject_template, body_template, required_fields) VALUES
('gdpr_supervisory_authority', 'GDPR Supervisory Authority Notification', 'gdpr', 'data_breach',
 'Data Breach Notification - {incident_id} - {organization_name}',
 'Dear Supervisory Authority,

This is to notify you of a data breach pursuant to Article 33 of the GDPR.

Incident Details:
- Incident ID: {incident_id}
- Detection Date: {detected_at}
- Breach Type: {breach_type}
- Affected Data Types: {affected_data_types}
- Estimated Affected Individuals: {estimated_records_affected}
- Risk Assessment: {risk_level}

Description: {description}

Immediate Actions Taken: {mitigation_measures}

We are continuing to investigate this incident and will provide updates as more information becomes available.

Best regards,
{organization_name} Data Protection Officer',
 ARRAY['incident_id', 'organization_name', 'detected_at', 'breach_type', 'affected_data_types', 'estimated_records_affected', 'risk_level', 'description', 'mitigation_measures']),

('gdpr_data_subject', 'GDPR Data Subject Notification', 'gdpr', 'data_breach',
 'Important: Data Security Incident Affecting Your Information',
 'Dear {data_subject_name},

We are writing to inform you of a data security incident that may have affected your personal information.

What Happened:
{breach_description}

Data Affected:
{affected_data_types}

What We Are Doing:
{mitigation_measures}

What You Can Do:
{recommended_actions}

If you have any questions or concerns, please contact us at {contact_information}.

This notification is provided pursuant to Article 34 of the GDPR.

Best regards,
{organization_name}',
 ARRAY['data_subject_name', 'breach_description', 'affected_data_types', 'mitigation_measures', 'recommended_actions', 'contact_information', 'organization_name']),

('hipaa_individual', 'HIPAA Individual Breach Notification', 'hipaa', 'data_breach',
 'Notice of Privacy Breach - Protected Health Information',
 'Dear {individual_name},

This notice is to inform you of a breach of your unsecured protected health information (PHI) as required by the HIPAA Privacy Rule.

Breach Details:
- Date of Breach: {breach_date}
- Date Discovered: {discovered_date}
- Type of Breach: {breach_type}
- Description: {breach_description}

Protected Health Information Involved:
{affected_phi_types}

Steps Taken to Mitigate Breach:
{mitigation_steps}

What You Should Do:
{recommended_actions}

For more information or to ask questions, please contact our Privacy Officer at {privacy_officer_contact}.

This notification fulfills the requirements under 45 CFR § 164.404.

Sincerely,
{organization_name} Privacy Officer',
 ARRAY['individual_name', 'breach_date', 'discovered_date', 'breach_type', 'breach_description', 'affected_phi_types', 'mitigation_steps', 'recommended_actions', 'privacy_officer_contact', 'organization_name']),

('hipaa_hhs_notification', 'HIPAA HHS OCR Notification', 'hipaa', 'data_breach',
 'HIPAA Breach Notification to HHS OCR',
 'U.S. Department of Health and Human Services
Office for Civil Rights

RE: HIPAA Breach Notification - {organization_name}

This notification is submitted pursuant to 45 CFR § 164.408.

Covered Entity Information:
- Name: {organization_name}
- Address: {organization_address}
- Contact: {contact_person}

Breach Details:
- Date of Breach: {breach_date}
- Date Discovered: {discovered_date}
- Number of Individuals Affected: {individuals_affected}
- Type of Breach: {breach_type}

Description of Breach: {breach_description}

Protected Health Information Involved: {affected_phi_types}

Safeguards in Place: {safeguards}

Mitigation Steps: {mitigation_steps}

Contact Information: {contact_information}

Submitted by: {submitted_by}
Date: {submission_date}',
 ARRAY['organization_name', 'organization_address', 'contact_person', 'breach_date', 'discovered_date', 'individuals_affected', 'breach_type', 'breach_description', 'affected_phi_types', 'safeguards', 'mitigation_steps', 'contact_information', 'submitted_by', 'submission_date']);

-- Insert default breach contacts
INSERT INTO breach_contacts (organization_name, contact_type, contact_name, email, phone, is_primary, is_active) VALUES
('Internal Data Protection Officer', 'gdpr_dpo', 'DPO Name', 'dpo@company.com', '+1-555-0100', true, true),
('Internal Privacy Officer', 'hipaa_privacy_officer', 'Privacy Officer Name', 'privacy@company.com', '+1-555-0101', true, true),
('Cyber Insurance Provider', 'cyber_insurance', 'Insurance Contact', 'claims@insurance.com', '+1-555-0102', false, true),
('Legal Counsel', 'legal_counsel', 'Legal Department', 'legal@company.com', '+1-555-0103', false, true);