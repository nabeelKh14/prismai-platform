# Supabase RLS Policy Fixes - Application Instructions

## Overview
This document provides step-by-step instructions for applying the RLS policy fixes to resolve tenant-based access problems that cause user lockouts.

## Problem Description
Users without proper tenant records were being completely locked out of data access due to overly restrictive Row Level Security (RLS) policies. The `get_user_tenant_ids()` function returned empty arrays for users without tenant records, causing `tenant_id = ANY({})` to evaluate to FALSE.

## Files Included
- `010_rls_policy_fixes.sql` - Comprehensive SQL script with all fixes
- `README_RLS_FIXES.md` - This instruction file

## Prerequisites
- Access to Supabase dashboard or psql client
- Database admin privileges
- Backup of current database (recommended)

## Step-by-Step Application Instructions

### Step 1: Create Database Backup
```sql
-- Create a backup before applying changes
-- Use Supabase dashboard or pg_dump
pg_dump "your-connection-string" > pre_rls_fix_backup.sql
```

### Step 2: Run Diagnostic Queries (Optional but Recommended)
Before applying fixes, run these queries to understand the current state:

```sql
-- Check users without tenant records
SELECT
    u.id as user_id,
    u.email,
    CASE WHEN tu.user_id IS NULL THEN 'NO_TENANT_RECORD' ELSE 'HAS_TENANT_RECORD' END as status
FROM auth.users u
LEFT JOIN public.tenant_users tu ON u.id = tu.user_id AND tu.is_active = true;
```

### Step 3: Apply the RLS Fixes
Execute the `010_rls_policy_fixes.sql` script in your Supabase SQL editor:

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the entire contents of `010_rls_policy_fixes.sql`
4. Click "Run" to execute the script

Alternatively, if using psql:
```bash
psql "your-connection-string" -f scripts/010_rls_policy_fixes.sql
```

### Step 4: Monitor Execution
The script will:
- ✅ Update `get_user_tenant_ids()` function with fallback logic
- ✅ Create tenant records for users without them
- ✅ Populate NULL tenant_id values
- ✅ Update RLS policies with safeguards
- ✅ Provide verification output

### Step 5: Verify the Fixes
After execution, run the verification queries included in the script:

```sql
-- Check that all users now have tenant access
SELECT
    u.id as user_id,
    u.email,
    array_length(public.get_user_tenant_ids(), 1) as tenant_count,
    CASE WHEN array_length(public.get_user_tenant_ids(), 1) > 0 THEN 'HAS_ACCESS' ELSE 'NO_ACCESS' END as access_status
FROM auth.users u;
```

## What the Fix Does

### 1. Improved Functions
- **`get_user_tenant_ids()`**: Now automatically creates a default tenant if user has no tenant records
- **`get_current_tenant_id()`**: Enhanced with fallback logic

### 2. Data Fixes
- Creates tenant records for all existing users without them
- Populates NULL tenant_id values in existing data
- Ensures data consistency across all tables

### 3. Policy Updates
- Updates RLS policies to be more permissive during tenant creation
- Adds safeguards to prevent lockouts
- Maintains security while ensuring access

### 4. Monitoring
- Creates access logging table for troubleshooting
- Provides comprehensive validation queries

## Expected Results

### Before Fix
- Users without tenant records: ❌ Locked out
- NULL tenant_id values: ❌ Data access issues
- Authentication successful but data access failed

### After Fix
- All users have tenant records: ✅
- NULL tenant_id values resolved: ✅
- Consistent data access: ✅
- Automatic tenant creation for new users: ✅

## Testing the Fixes

### Test Case 1: New User Registration
1. Create a new user account
2. Verify automatic tenant creation
3. Confirm data access works immediately

### Test Case 2: Existing User Access
1. Login with existing user who had no tenant record
2. Verify they can now access their data
3. Check that tenant was created automatically

### Test Case 3: Data Operations
1. Create new records (leads, conversations, etc.)
2. Verify tenant_id is properly set
3. Confirm RLS policies allow access

## Troubleshooting

### Issue: Script Execution Fails
**Solution**: Check database permissions and ensure you're running as admin

### Issue: Some Users Still Locked Out
**Solution**: Run the diagnostic queries to identify remaining issues:
```sql
-- Check for remaining issues
SELECT * FROM public.rls_access_log
WHERE access_granted = false
ORDER BY created_at DESC;
```

### Issue: Performance Impact
**Solution**: The functions include caching and are optimized for performance

## Rollback Plan

If issues occur, you can rollback using:

1. Restore from backup created in Step 1
2. Revert to previous function versions:
```sql
-- Restore original functions if needed
DROP FUNCTION IF EXISTS public.get_user_tenant_ids();
-- [Restore original function definition]
```

## Monitoring and Maintenance

### Ongoing Monitoring
- Monitor the `rls_access_log` table for access issues
- Set up alerts for users without tenant records
- Regularly audit tenant distribution

### Maintenance Tasks
- Clean up inactive tenants periodically
- Monitor tenant usage patterns
- Update tenant features as needed

## Support

If you encounter issues:
1. Check the verification queries output
2. Review the `rls_access_log` table
3. Contact support with diagnostic information

## Success Criteria

✅ All users can access their data after authentication
✅ No NULL tenant_id values in critical tables
✅ New user registration works seamlessly
✅ RLS policies enforce proper tenant isolation
✅ System performance remains acceptable

---

**Note**: This fix ensures backward compatibility while resolving the access issues. The enhanced functions will automatically handle edge cases and prevent future lockouts.