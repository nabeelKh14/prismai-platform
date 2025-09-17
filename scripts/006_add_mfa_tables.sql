-- Add MFA (Multi-Factor Authentication) tables and related schema
-- This script adds support for TOTP and SMS-based MFA

-- Create user_mfa table to store MFA settings
CREATE TABLE IF NOT EXISTS user_mfa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    totp_secret TEXT,
    backup_codes TEXT[], -- Array of backup codes
    mfa_enabled BOOLEAN DEFAULT FALSE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    phone_number TEXT,
    sms_verification_code TEXT,
    sms_code_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    enabled_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ,

    -- Ensure only one MFA record per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON user_mfa(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_enabled ON user_mfa(mfa_enabled);

-- Create mfa_attempts table to track verification attempts (for security monitoring)
CREATE TABLE IF NOT EXISTS mfa_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attempt_type VARCHAR(20) NOT NULL CHECK (attempt_type IN ('totp', 'sms', 'backup_code')),
    success BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),

    -- Store failure reasons for analysis
    failure_reason TEXT,
    token_provided TEXT -- Store first/last few chars for debugging (never full token)
);

-- Create indexes for mfa_attempts
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_id ON mfa_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_attempted_at ON mfa_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_success ON mfa_attempts(success);

-- Create user_sessions table for enhanced session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    refresh_token TEXT NOT NULL UNIQUE,
    device_info JSONB, -- Store device/browser info
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT
);

-- Create indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked ON user_sessions(revoked);

-- Create auth_audit_log table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for auth_audit_log
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_action ON auth_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON auth_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_success ON auth_audit_log(success);

-- Create user_roles table for RBAC
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE(user_id, role_name)
);

-- Create indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_name ON user_roles(role_name);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- read, write, delete, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(resource, action)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(role_name, permission_id)
);

-- Create indexes for role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_name ON role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Insert default permissions
INSERT INTO permissions (permission_name, description, resource, action) VALUES
('user.read', 'Read user profile information', 'user', 'read'),
('user.write', 'Update user profile information', 'user', 'write'),
('user.delete', 'Delete user account', 'user', 'delete'),
('leads.read', 'View leads', 'leads', 'read'),
('leads.write', 'Create and update leads', 'leads', 'write'),
('leads.delete', 'Delete leads', 'leads', 'delete'),
('campaigns.read', 'View marketing campaigns', 'campaigns', 'read'),
('campaigns.write', 'Create and manage campaigns', 'campaigns', 'write'),
('campaigns.delete', 'Delete campaigns', 'campaigns', 'delete'),
('analytics.read', 'View analytics and reports', 'analytics', 'read'),
('analytics.write', 'Create and manage reports', 'analytics', 'write'),
('settings.read', 'View system settings', 'settings', 'read'),
('settings.write', 'Modify system settings', 'settings', 'write'),
('admin.users.read', 'View all users (admin)', 'admin.users', 'read'),
('admin.users.write', 'Manage users (admin)', 'admin.users', 'write'),
('admin.system.read', 'View system information (admin)', 'admin.system', 'read'),
('admin.system.write', 'Modify system configuration (admin)', 'admin.system', 'write')
ON CONFLICT (resource, action) DO NOTHING;

-- Insert default roles
INSERT INTO user_roles (user_id, role_name, assigned_by) VALUES
-- Note: This will be populated when users sign up or are assigned roles
-- For now, we'll handle role assignment in the application logic

-- Create function to automatically create MFA record for new users
CREATE OR REPLACE FUNCTION create_user_mfa_record()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_mfa (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create MFA record for new users
DROP TRIGGER IF EXISTS trigger_create_user_mfa ON auth.users;
CREATE TRIGGER trigger_create_user_mfa
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_mfa_record();

-- Create function to log authentication events
CREATE OR REPLACE FUNCTION log_auth_event(
    p_user_id UUID,
    p_action VARCHAR(100),
    p_resource VARCHAR(100) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO auth_audit_log (
        user_id, action, resource, resource_id, details,
        ip_address, user_agent, session_id, success, error_message
    ) VALUES (
        p_user_id, p_action, p_resource, p_resource_id, p_details,
        p_ip_address, p_user_agent, p_session_id, p_success, p_error_message
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION has_permission(
    p_user_id UUID,
    p_resource VARCHAR(100),
    p_action VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
    has_perm BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_name = rp.role_name
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id
          AND ur.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          AND p.resource = p_resource
          AND p.action = p_action
    ) INTO has_perm;

    RETURN has_perm;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS) on tables
ALTER TABLE user_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own MFA data
CREATE POLICY "Users can view own MFA data" ON user_mfa
    FOR ALL USING (auth.uid() = user_id);

-- Users can only see their own MFA attempts
CREATE POLICY "Users can view own MFA attempts" ON mfa_attempts
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Users can only see their own audit logs
CREATE POLICY "Users can view own audit logs" ON auth_audit_log
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only see their own roles
CREATE POLICY "Users can view own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Permissions table is readable by all authenticated users
CREATE POLICY "Authenticated users can view permissions" ON permissions
    FOR SELECT TO authenticated USING (true);

-- Role permissions are readable by users who have roles
CREATE POLICY "Users can view role permissions for their roles" ON role_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role_name = role_permissions.role_name
              AND is_active = TRUE
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_mfa TO authenticated;
GRANT SELECT ON mfa_attempts TO authenticated;
GRANT ALL ON user_sessions TO authenticated;
GRANT SELECT ON auth_audit_log TO authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT ON permissions TO authenticated;
GRANT SELECT ON role_permissions TO authenticated;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_user_mfa_updated_at
    BEFORE UPDATE ON user_mfa
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();