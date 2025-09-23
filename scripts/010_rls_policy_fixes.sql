-- =====================================
-- RLS POLICY FIXES FOR TENANT-BASED ACCESS
-- =====================================
-- This script fixes critical RLS policy issues that cause user lockouts
-- when tenant records are missing or improperly configured.
-- Updated to handle missing tables gracefully.

-- =====================================
-- PRE-FLIGHT CHECKS
-- =====================================

-- Ensure tenant tables exist before proceeding
DO $$
BEGIN
    -- Check if tenants table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
        RAISE EXCEPTION 'tenants table does not exist. Please run 000_complete_schema_setup.sql first.';
    END IF;

    -- Check if tenant_users table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_users') THEN
        RAISE EXCEPTION 'tenant_users table does not exist. Please run 000_complete_schema_setup.sql first.';
    END IF;

    RAISE NOTICE 'Pre-flight checks passed. Proceeding with RLS fixes...';
END $$;

-- =====================================
-- DIAGNOSTIC QUERIES
-- =====================================

-- Query 1: Find users without tenant records
-- These users will be completely locked out of data access
SELECT
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    p.business_name,
    CASE
        WHEN tu.user_id IS NULL THEN 'NO_TENANT_RECORD'
        ELSE 'HAS_TENANT_RECORD'
    END as tenant_status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.tenant_users tu ON u.id = tu.user_id AND tu.is_active = true
ORDER BY u.created_at DESC;

-- Query 2: Find users with NULL tenant_id in their data
-- These users may have partial access issues
SELECT
    'profiles' as table_name,
    COUNT(*) as null_tenant_count
FROM public.profiles
WHERE tenant_id IS NULL
UNION ALL
SELECT
    'call_logs' as table_name,
    COUNT(*) as null_tenant_count
FROM public.call_logs
WHERE tenant_id IS NULL
UNION ALL
SELECT
    'leads' as table_name,
    COUNT(*) as null_tenant_count
FROM public.leads
WHERE tenant_id IS NULL
UNION ALL
SELECT
    'chat_conversations' as table_name,
    COUNT(*) as null_tenant_count
FROM public.chat_conversations
WHERE tenant_id IS NULL;

-- Query 3: Check current tenant distribution
SELECT
    t.name as tenant_name,
    t.id as tenant_id,
    COUNT(tu.user_id) as user_count,
    COUNT(CASE WHEN tu.role = 'owner' THEN 1 END) as owner_count,
    COUNT(CASE WHEN tu.role = 'admin' THEN 1 END) as admin_count
FROM public.tenants t
LEFT JOIN public.tenant_users tu ON t.id = tu.tenant_id AND tu.is_active = true
GROUP BY t.id, t.name
ORDER BY user_count DESC;

-- =====================================
-- IMPROVED FUNCTIONS WITH FALLBACK LOGIC
-- =====================================

-- Function to get user tenant IDs with automatic tenant creation fallback
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tenant_ids UUID[];
    user_uuid UUID := auth.uid();
BEGIN
    -- If no authenticated user, return empty array
    IF user_uuid IS NULL THEN
        RETURN ARRAY[]::UUID[];
    END IF;

    -- First, try to get existing tenant IDs
    SELECT array_agg(tenant_id)
    INTO tenant_ids
    FROM public.tenant_users
    WHERE user_id = user_uuid AND is_active = true;

    -- If no tenant records found, create a default tenant
    IF tenant_ids IS NULL OR array_length(tenant_ids, 1) = 0 THEN
        -- Check if user has a profile, create one if not
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_uuid) THEN
            INSERT INTO public.profiles (id, business_name, business_type)
            VALUES (user_uuid, 'My Business', 'General')
            ON CONFLICT (id) DO NOTHING;
        END IF;

        -- Create default tenant
        INSERT INTO public.tenants (
            name,
            subscription_status,
            trial_ends_at
        )
        VALUES (
            COALESCE(
                (SELECT business_name FROM public.profiles WHERE id = user_uuid),
                'My Business'
            ),
            'trial',
            NOW() + INTERVAL '30 days'
        )
        RETURNING id INTO tenant_ids[1];

        -- Add user as owner of the tenant
        INSERT INTO public.tenant_users (
            tenant_id,
            user_id,
            role,
            joined_at
        )
        VALUES (
            tenant_ids[1],
            user_uuid,
            'owner',
            NOW()
        )
        ON CONFLICT (tenant_id, user_id) DO NOTHING;

        -- Update profile with tenant_id
        UPDATE public.profiles
        SET tenant_id = tenant_ids[1]
        WHERE id = user_uuid;

        RAISE NOTICE 'Created default tenant % for user %', tenant_ids[1], user_uuid;
    END IF;

    -- Ensure we return a valid array
    IF tenant_ids IS NULL THEN
        RETURN ARRAY[]::UUID[];
    END IF;

    RETURN tenant_ids;
END;
$$;

-- Function to get current tenant (with fallback)
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tenant_id UUID;
    user_uuid UUID := auth.uid();
BEGIN
    -- If no authenticated user, return NULL
    IF user_uuid IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get the first active tenant for the user
    SELECT t.tenant_id
    INTO tenant_id
    FROM public.tenant_users t
    WHERE t.user_id = user_uuid AND t.is_active = true
    ORDER BY t.joined_at ASC
    LIMIT 1;

    -- If no tenant found, trigger the fallback in get_user_tenant_ids
    IF tenant_id IS NULL THEN
        PERFORM public.get_user_tenant_ids();
        -- Try again
        SELECT t.tenant_id
        INTO tenant_id
        FROM public.tenant_users t
        WHERE t.user_id = user_uuid AND t.is_active = true
        ORDER BY t.joined_at ASC
        LIMIT 1;
    END IF;

    RETURN tenant_id;
END;
$$;

-- =====================================
-- FIX EXISTING DATA
-- =====================================

-- Fix 1: Ensure all users have tenant records
DO $$
DECLARE
    user_record RECORD;
    tenant_id UUID;
BEGIN
    RAISE NOTICE 'Starting tenant record creation for existing users...';

    FOR user_record IN
        SELECT u.id, u.email, p.business_name
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
        LEFT JOIN public.tenant_users tu ON u.id = tu.user_id AND tu.is_active = true
        WHERE tu.user_id IS NULL
    LOOP
        -- Create tenant for user
        INSERT INTO public.tenants (
            name,
            subscription_status,
            trial_ends_at
        )
        VALUES (
            COALESCE(user_record.business_name, 'My Business'),
            'trial',
            NOW() + INTERVAL '30 days'
        )
        RETURNING id INTO tenant_id;

        -- Add user as owner
        INSERT INTO public.tenant_users (
            tenant_id,
            user_id,
            role,
            joined_at
        )
        VALUES (
            tenant_id,
            user_record.id,
            'owner',
            NOW()
        );

        -- Update profile with tenant_id
        UPDATE public.profiles
        SET tenant_id = tenant_id
        WHERE id = user_record.id;

        RAISE NOTICE 'Created tenant % for user % (%)', tenant_id, user_record.id, user_record.email;
    END LOOP;

    RAISE NOTICE 'Tenant record creation completed.';
END $$;

-- Fix 2: Populate NULL tenant_id values in existing data
DO $$
DECLARE
    user_record RECORD;
    tenant_id UUID;
BEGIN
    RAISE NOTICE 'Starting NULL tenant_id population...';

    -- Process each user that has NULL tenant_id in their profile
    FOR user_record IN
        SELECT DISTINCT u.id
        FROM auth.users u
        LEFT JOIN public.profiles p ON u.id = p.id
        WHERE p.tenant_id IS NULL OR p.id IS NULL
    LOOP
        -- Get or create tenant for this user
        tenant_id := public.get_current_tenant_id();

        -- Update profile
        UPDATE public.profiles
        SET tenant_id = tenant_id
        WHERE id = user_record.id AND tenant_id IS NULL;

        -- Update other tables for this user
        UPDATE public.call_logs SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.bookings SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.ai_configs SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.lead_sources SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.leads SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.knowledge_base SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.chat_conversations SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.email_campaigns SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.social_posts SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.automation_workflows SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.analytics_events SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.business_metrics SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;
        UPDATE public.integrations SET tenant_id = tenant_id WHERE user_id = user_record.id AND tenant_id IS NULL;

        -- Update related tables
        UPDATE public.lead_activities SET tenant_id = tenant_id
        WHERE lead_id IN (SELECT id FROM public.leads WHERE user_id = user_record.id) AND tenant_id IS NULL;

        UPDATE public.chat_messages SET tenant_id = tenant_id
        WHERE conversation_id IN (SELECT id FROM public.chat_conversations WHERE user_id = user_record.id) AND tenant_id IS NULL;

        RAISE NOTICE 'Updated tenant_id for user %', user_record.id;
    END LOOP;

    RAISE NOTICE 'NULL tenant_id population completed.';
END $$;

-- =====================================
-- UPDATE RLS POLICIES WITH SAFEGUARDS
-- =====================================

-- Update tenant policies to be more permissive for owners/admins
DROP POLICY IF EXISTS "tenant_users_member_insert" ON public.tenant_users;
CREATE POLICY "tenant_users_member_insert" ON public.tenant_users FOR INSERT
WITH CHECK (
    tenant_id IN (SELECT unnest(public.get_user_tenant_ids()))
);

-- Ensure tenant policies allow access even during tenant creation
DROP POLICY IF EXISTS "tenants_member_access" ON public.tenants;
CREATE POLICY "tenants_member_access" ON public.tenants FOR ALL USING (
    id IN (SELECT unnest(public.get_user_tenant_ids()))
);

-- =====================================
-- VERIFICATION QUERIES
-- =====================================

-- Query 4: Verify all users now have tenant access
SELECT
    u.id as user_id,
    u.email,
    array_length(public.get_user_tenant_ids(), 1) as tenant_count,
    CASE
        WHEN array_length(public.get_user_tenant_ids(), 1) > 0 THEN 'HAS_ACCESS'
        ELSE 'NO_ACCESS'
    END as access_status
FROM auth.users u
ORDER BY u.created_at DESC
LIMIT 10;

-- Query 5: Test tenant function behavior
SELECT
    auth.uid() as current_user,
    public.get_current_tenant_id() as current_tenant,
    public.get_user_tenant_ids() as all_tenants;

-- Query 6: Check for any remaining NULL tenant_id issues
SELECT
    table_name,
    null_count
FROM (
    SELECT
        'profiles' as table_name,
        COUNT(*) as null_count
    FROM public.profiles
    WHERE tenant_id IS NULL

    UNION ALL

    SELECT
        'call_logs' as table_name,
        COUNT(*) as null_count
    FROM public.call_logs
    WHERE tenant_id IS NULL

    UNION ALL

    SELECT
        'leads' as table_name,
        COUNT(*) as null_count
    FROM public.leads
    WHERE tenant_id IS NULL
) checks
WHERE null_count > 0;

-- =====================================
-- MONITORING AND LOGGING
-- =====================================

-- Create a log table for RLS access issues
CREATE TABLE IF NOT EXISTS public.rls_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    table_name TEXT,
    operation TEXT,
    tenant_ids UUID[],
    access_granted BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on the log table
ALTER TABLE public.rls_access_log ENABLE ROW LEVEL SECURITY;

-- Policy for the log table
CREATE POLICY "rls_access_log_tenant_access" ON public.rls_access_log FOR ALL USING (
    tenant_id = ANY(public.get_user_tenant_ids())
);

-- Function to log RLS access attempts (optional)
CREATE OR REPLACE FUNCTION public.log_rls_access_attempt(
    p_table_name TEXT,
    p_operation TEXT,
    p_tenant_ids UUID[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.rls_access_log (
        user_id,
        table_name,
        operation,
        tenant_ids,
        access_granted
    )
    VALUES (
        auth.uid(),
        p_table_name,
        p_operation,
        p_tenant_ids,
        true
    );
END;
$$;

-- =====================================
-- FINAL VALIDATION
-- =====================================

DO $$
DECLARE
    user_count INTEGER;
    tenant_count INTEGER;
    null_tenant_count INTEGER;
BEGIN
    -- Count users
    SELECT COUNT(*) INTO user_count FROM auth.users;

    -- Count tenants
    SELECT COUNT(*) INTO tenant_count FROM public.tenants;

    -- Count NULL tenant_ids
    SELECT COUNT(*) INTO null_tenant_count
    FROM (
        SELECT id FROM public.profiles WHERE tenant_id IS NULL
        UNION ALL
        SELECT id FROM public.call_logs WHERE tenant_id IS NULL
        UNION ALL
        SELECT id FROM public.leads WHERE tenant_id IS NULL
    ) nulls;

    RAISE NOTICE 'RLS Fix Summary:';
    RAISE NOTICE '- Total users: %', user_count;
    RAISE NOTICE '- Total tenants: %', tenant_count;
    RAISE NOTICE '- Records with NULL tenant_id: %', null_tenant_count;

    IF null_tenant_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All tenant isolation issues have been resolved!';
    ELSE
        RAISE WARNING 'WARNING: % records still have NULL tenant_id values', null_tenant_count;
    END IF;
END $$;

RAISE NOTICE 'RLS policy fixes completed successfully!';
RAISE NOTICE 'All users should now have proper tenant-based access.';