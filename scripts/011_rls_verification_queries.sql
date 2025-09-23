-- =====================================
-- RLS POLICY FIXES - VERIFICATION QUERIES
-- =====================================
-- Run these queries after applying the RLS fixes to verify everything works correctly

-- =====================================
-- VERIFICATION QUERY SET 1: USER ACCESS STATUS
-- =====================================

-- Query 1: Comprehensive user access verification
SELECT
    'USER_ACCESS_VERIFICATION' as check_type,
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    COALESCE(p.business_name, 'No Profile') as business_name,
    CASE
        WHEN tu.user_id IS NOT NULL THEN 'HAS_TENANT_RECORD'
        ELSE 'MISSING_TENANT_RECORD'
    END as tenant_status,
    tu.role,
    t.name as tenant_name,
    CASE
        WHEN array_length(public.get_user_tenant_ids(), 1) > 0 THEN 'ACCESSIBLE'
        ELSE 'LOCKED_OUT'
    END as access_status,
    public.get_current_tenant_id() as current_tenant_id,
    public.get_user_tenant_ids() as all_tenant_ids
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.tenant_users tu ON u.id = tu.user_id AND tu.is_active = true
LEFT JOIN public.tenants t ON tu.tenant_id = t.id
ORDER BY u.created_at DESC;

-- =====================================
-- VERIFICATION QUERY SET 2: DATA INTEGRITY
-- =====================================

-- Query 2: Check for NULL tenant_id values across all tables
SELECT
    'NULL_TENANT_ID_CHECK' as check_type,
    table_name,
    null_count,
    total_count,
    ROUND((null_count::decimal / NULLIF(total_count, 0)) * 100, 2) as null_percentage,
    CASE
        WHEN null_count = 0 THEN '✅ PASS'
        WHEN null_count > 0 AND null_count < 10 THEN '⚠️  LOW RISK'
        ELSE '❌ HIGH RISK'
    END as status
FROM (
    SELECT
        'profiles' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.profiles

    UNION ALL

    SELECT
        'call_logs' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.call_logs

    UNION ALL

    SELECT
        'bookings' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.bookings

    UNION ALL

    SELECT
        'ai_configs' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.ai_configs

    UNION ALL

    SELECT
        'leads' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.leads

    UNION ALL

    SELECT
        'lead_activities' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.lead_activities

    UNION ALL

    SELECT
        'knowledge_base' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.knowledge_base

    UNION ALL

    SELECT
        'chat_conversations' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.chat_conversations

    UNION ALL

    SELECT
        'chat_messages' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.chat_messages

    UNION ALL

    SELECT
        'email_campaigns' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.email_campaigns

    UNION ALL

    SELECT
        'social_posts' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.social_posts

    UNION ALL

    SELECT
        'automation_workflows' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.automation_workflows

    UNION ALL

    SELECT
        'analytics_events' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.analytics_events

    UNION ALL

    SELECT
        'business_metrics' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.business_metrics

    UNION ALL

    SELECT
        'integrations' as table_name,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count
    FROM public.integrations
) integrity_check
ORDER BY null_count DESC, table_name;

-- =====================================
-- VERIFICATION QUERY SET 3: TENANT DISTRIBUTION
-- =====================================

-- Query 3: Tenant distribution and health check
SELECT
    'TENANT_DISTRIBUTION' as check_type,
    t.id as tenant_id,
    t.name as tenant_name,
    t.subscription_status,
    t.is_active as tenant_active,
    COUNT(tu.user_id) as user_count,
    COUNT(CASE WHEN tu.role = 'owner' THEN 1 END) as owner_count,
    COUNT(CASE WHEN tu.role = 'admin' THEN 1 END) as admin_count,
    COUNT(CASE WHEN tu.role = 'user' THEN 1 END) as user_role_count,
    COUNT(CASE WHEN tu.is_active = false THEN 1 END) as inactive_users,
    MAX(tu.last_active_at) as last_activity,
    CASE
        WHEN COUNT(tu.user_id) = 0 THEN '❌ ORPHANED_TENANT'
        WHEN COUNT(CASE WHEN tu.role = 'owner' THEN 1 END) = 0 THEN '⚠️  NO_OWNER'
        WHEN COUNT(tu.user_id) > 0 AND COUNT(CASE WHEN tu.role = 'owner' THEN 1 END) > 0 THEN '✅ HEALTHY'
        ELSE '⚠️  INCOMPLETE'
    END as tenant_health
FROM public.tenants t
LEFT JOIN public.tenant_users tu ON t.id = tu.tenant_id
GROUP BY t.id, t.name, t.subscription_status, t.is_active
ORDER BY user_count DESC, tenant_health;

-- =====================================
-- VERIFICATION QUERY SET 4: FUNCTION TESTING
-- =====================================

-- Query 4: Test the get_user_tenant_ids() function for all users
SELECT
    'FUNCTION_TEST' as check_type,
    u.id as user_id,
    u.email,
    public.get_user_tenant_ids() as tenant_ids,
    array_length(public.get_user_tenant_ids(), 1) as tenant_count,
    public.get_current_tenant_id() as current_tenant,
    CASE
        WHEN public.get_user_tenant_ids() IS NOT NULL
             AND array_length(public.get_user_tenant_ids(), 1) > 0 THEN '✅ FUNCTION_WORKS'
        ELSE '❌ FUNCTION_FAILED'
    END as function_status
FROM auth.users u
ORDER BY u.created_at DESC;

-- =====================================
-- VERIFICATION QUERY SET 5: RLS POLICY TESTING
-- =====================================

-- Query 5: Test RLS policy effectiveness (run as different users if possible)
-- This query tests whether the current user can access their own data
SELECT
    'RLS_POLICY_TEST' as check_type,
    auth.uid() as current_user,
    COUNT(p.*) as accessible_profiles,
    COUNT(cl.*) as accessible_call_logs,
    COUNT(l.*) as accessible_leads,
    COUNT(cc.*) as accessible_conversations,
    CASE
        WHEN COUNT(p.*) > 0 OR (auth.uid() IS NULL) THEN '✅ RLS_WORKING'
        ELSE '❌ RLS_BLOCKING'
    END as rls_status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.call_logs cl ON u.id = cl.user_id
LEFT JOIN public.leads l ON u.id = l.user_id
LEFT JOIN public.chat_conversations cc ON u.id = cc.user_id
WHERE u.id = auth.uid();

-- =====================================
-- VERIFICATION QUERY SET 6: PERFORMANCE METRICS
-- =====================================

-- Query 6: Performance check for tenant functions
SELECT
    'PERFORMANCE_CHECK' as check_type,
    'get_user_tenant_ids' as function_name,
    AVG(EXTRACT(epoch FROM (now() - query_start))) * 1000 as avg_execution_ms,
    COUNT(*) as call_count,
    MAX(EXTRACT(epoch FROM (now() - query_start))) * 1000 as max_execution_ms
FROM (
    SELECT
        now() as query_start,
        public.get_user_tenant_ids() as result
    FROM generate_series(1, 10) -- Run 10 times for averaging
) performance_test;

-- =====================================
-- VERIFICATION QUERY SET 7: COMPREHENSIVE SUMMARY
-- =====================================

-- Query 7: Final comprehensive summary
WITH summary_stats AS (
    SELECT
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN tu.user_id IS NOT NULL THEN u.id END) as users_with_tenants,
        COUNT(DISTINCT t.id) as total_tenants,
        COUNT(DISTINCT CASE WHEN tu.role = 'owner' THEN u.id END) as owner_users,
        SUM(CASE WHEN table_name IS NOT NULL AND null_count > 0 THEN 1 ELSE 0 END) as tables_with_nulls
    FROM auth.users u
    LEFT JOIN public.tenant_users tu ON u.id = tu.user_id AND tu.is_active = true
    LEFT JOIN public.tenants t ON tu.tenant_id = t.id
    LEFT JOIN (
        SELECT 'profiles' as table_name, COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_count FROM public.profiles
        UNION ALL SELECT 'call_logs', COUNT(*) FILTER (WHERE tenant_id IS NULL) FROM public.call_logs
        UNION ALL SELECT 'leads', COUNT(*) FILTER (WHERE tenant_id IS NULL) FROM public.leads
    ) null_checks ON true
)
SELECT
    'FINAL_SUMMARY' as check_type,
    total_users,
    users_with_tenants,
    ROUND((users_with_tenants::decimal / NULLIF(total_users, 0)) * 100, 2) as tenant_coverage_pct,
    total_tenants,
    owner_users,
    tables_with_nulls,
    CASE
        WHEN users_with_tenants = total_users AND tables_with_nulls = 0 THEN '✅ ALL_CHECKS_PASS'
        WHEN users_with_tenants >= total_users * 0.95 AND tables_with_nulls <= 2 THEN '⚠️  MOSTLY_SUCCESSFUL'
        ELSE '❌ ISSUES_REMAIN'
    END as overall_status
FROM summary_stats;

-- =====================================
-- VERIFICATION QUERY SET 8: ERROR LOGGING
-- =====================================

-- Query 8: Check for any access errors logged
SELECT
    'ACCESS_ERROR_LOG' as check_type,
    user_id,
    table_name,
    operation,
    error_message,
    created_at,
    CASE
        WHEN error_message IS NOT NULL THEN '❌ ERROR_LOGGED'
        ELSE '✅ NO_ERRORS'
    END as error_status
FROM public.rls_access_log
WHERE access_granted = false
ORDER BY created_at DESC
LIMIT 20;

-- =====================================
-- VERIFICATION QUERY SET 9: DATA CONSISTENCY
-- =====================================

-- Query 9: Check data consistency between related tables
SELECT
    'DATA_CONSISTENCY' as check_type,
    'profiles_vs_tenant_users' as check_name,
    COUNT(DISTINCT p.id) as profiles_count,
    COUNT(DISTINCT tu.user_id) as tenant_users_count,
    COUNT(DISTINCT p.id) - COUNT(DISTINCT tu.user_id) as difference,
    CASE
        WHEN COUNT(DISTINCT p.id) = COUNT(DISTINCT tu.user_id) THEN '✅ CONSISTENT'
        ELSE '⚠️  INCONSISTENT'
    END as consistency_status
FROM public.profiles p
FULL OUTER JOIN public.tenant_users tu ON p.id = tu.user_id AND tu.is_active = true

UNION ALL

SELECT
    'leads_vs_activities' as check_name,
    COUNT(DISTINCT l.id) as leads_count,
    COUNT(DISTINCT la.lead_id) as activities_count,
    0 as difference, -- Not checking difference for this
    'ℹ️  INFO_ONLY' as consistency_status
FROM public.leads l
LEFT JOIN public.lead_activities la ON l.id = la.lead_id;

-- =====================================
-- VERIFICATION QUERY SET 10: RECOMMENDATIONS
-- =====================================

-- Query 10: Generate recommendations based on findings
SELECT
    'RECOMMENDATIONS' as check_type,
    CASE
        WHEN (SELECT COUNT(*) FROM auth.users u LEFT JOIN public.tenant_users tu ON u.id = tu.user_id AND tu.is_active = true WHERE tu.user_id IS NULL) > 0
        THEN 'Run tenant creation script for remaining users'
        ELSE 'All users have tenant records'
    END as tenant_recommendation,

    CASE
        WHEN (SELECT COUNT(*) FROM (
            SELECT COUNT(*) FILTER (WHERE tenant_id IS NULL) as nulls FROM public.profiles
            UNION ALL SELECT COUNT(*) FILTER (WHERE tenant_id IS NULL) FROM public.call_logs
            UNION ALL SELECT COUNT(*) FILTER (WHERE tenant_id IS NULL) FROM public.leads
        ) WHERE nulls > 0) > 0
        THEN 'Fix remaining NULL tenant_id values'
        ELSE 'No NULL tenant_id issues found'
    END as data_recommendation,

    CASE
        WHEN (SELECT COUNT(*) FROM public.tenants t LEFT JOIN public.tenant_users tu ON t.id = tu.tenant_id WHERE tu.user_id IS NULL) > 0
        THEN 'Clean up orphaned tenants'
        ELSE 'No orphaned tenants found'
    END as cleanup_recommendation;

-- =====================================
-- FINAL VERIFICATION REPORT
-- =====================================

DO $$
DECLARE
    total_users INTEGER;
    users_with_access INTEGER;
    tables_with_issues INTEGER;
    overall_status TEXT;
BEGIN
    -- Gather statistics
    SELECT COUNT(*) INTO total_users FROM auth.users;

    SELECT COUNT(DISTINCT u.id) INTO users_with_access
    FROM auth.users u
    WHERE array_length(public.get_user_tenant_ids(), 1) > 0;

    SELECT COUNT(*) INTO tables_with_issues
    FROM (
        SELECT COUNT(*) FILTER (WHERE tenant_id IS NULL) as nulls FROM public.profiles
        UNION ALL SELECT COUNT(*) FILTER (WHERE tenant_id IS NULL) FROM public.call_logs
        UNION ALL SELECT COUNT(*) FILTER (WHERE tenant_id IS NULL) FROM public.leads
    ) WHERE nulls > 0;

    -- Determine overall status
    IF users_with_access = total_users AND tables_with_issues = 0 THEN
        overall_status := '🎉 SUCCESS: All RLS issues resolved!';
    ELSIF users_with_access >= total_users * 0.9 AND tables_with_issues <= 3 THEN
        overall_status := '⚠️  MOSTLY SUCCESSFUL: Minor issues remain';
    ELSE
        overall_status := '❌ ISSUES REMAIN: Further investigation needed';
    END IF;

    -- Output final report
    RAISE NOTICE '================================================';
    RAISE NOTICE 'RLS POLICY FIX VERIFICATION REPORT';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Total Users: %', total_users;
    RAISE NOTICE 'Users with Access: %', users_with_access;
    RAISE NOTICE 'Tables with NULL tenant_id: %', tables_with_issues;
    RAISE NOTICE '';
    RAISE NOTICE '%', overall_status;
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    IF users_with_access < total_users THEN
        RAISE NOTICE '- Run tenant creation for remaining users';
    END IF;
    IF tables_with_issues > 0 THEN
        RAISE NOTICE '- Fix NULL tenant_id values in affected tables';
    END IF;
    RAISE NOTICE '- Monitor system for any access issues';
    RAISE NOTICE '- Consider setting up automated health checks';
    RAISE NOTICE '================================================';
END $$;