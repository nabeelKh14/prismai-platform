# Complete Database Setup Sequence for PrismAI

## Overview
This document provides the complete, step-by-step process for setting up the PrismAI database with proper multi-tenancy and Row Level Security (RLS) policies. Following this sequence ensures that all tables exist before applying RLS fixes.

## Problem Solved
The original issue was that RLS fix scripts failed because they assumed tenant tables (`tenants`, `tenant_users`) existed, but these were only created in later schema scripts. This caused errors like "relation public.tenant_users does not exist".

## Solution
We've created a comprehensive setup script (`000_complete_schema_setup.sql`) that includes all necessary tables from the start, and updated the RLS fix scripts to be more robust.

## Setup Sequence

### 🚀 QUICK START (Recommended for New Databases)
If you're setting up a new database, run this single script:

```sql
-- Run this in Supabase SQL Editor or psql
\i scripts/000_complete_schema_setup.sql
```

This script creates:
- ✅ All base tables (profiles, call_logs, bookings, etc.)
- ✅ All extended tables (leads, chat_conversations, etc.)
- ✅ Multi-tenancy tables (tenants, tenant_users, etc.)
- ✅ All necessary indexes
- ✅ Basic RLS policies
- ✅ Auto-tenant creation for new users

### 🔧 MIGRATION PATH (For Existing Databases)

If you have an existing database with partial schema, follow this sequence:

#### Step 1: Assess Current State
```sql
-- Check what tables currently exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

#### Step 2: Complete Schema Setup
```sql
-- This script safely creates any missing tables
\i scripts/000_complete_schema_setup.sql
```

#### Step 3: Migrate to Tenant-Based RLS
```sql
-- Update all policies to use tenant-based access
\i scripts/009_tenant_isolation_migration.sql
```

#### Step 4: Apply RLS Fixes
```sql
-- Fix any remaining tenant access issues
\i scripts/010_rls_policy_fixes.sql
```

#### Step 5: Verify Setup
```sql
-- Run comprehensive verification
\i scripts/011_rls_verification_queries.sql
```

## Detailed Script Descriptions

### 000_complete_schema_setup.sql (NEW)
**Purpose**: Complete database schema with multi-tenancy from the start
**When to use**: New databases or when tenant tables are missing
**What it does**:
- Creates all tables with tenant_id columns
- Sets up multi-tenancy infrastructure
- Adds comprehensive indexes
- Creates basic RLS policies
- Sets up auto-tenant creation for new users

### 001_create_database_schema.sql (LEGACY)
**Purpose**: Basic schema without multi-tenancy
**When to use**: Only if you want user-based access (not recommended)
**Note**: This creates tables without tenant_id columns

### 002_ai_suite_schema.sql (LEGACY)
**Purpose**: Extended features without multi-tenancy
**When to use**: Only if you want user-based access (not recommended)
**Note**: This also creates tables without tenant_id columns

### 008_multi_tenant_schema.sql (LEGACY)
**Purpose**: Adds multi-tenancy to existing schema
**When to use**: If you've run 001/002 and need to add tenant support
**Note**: Requires existing tables from 001/002

### 009_tenant_isolation_migration.sql
**Purpose**: Migrates from user-based to tenant-based RLS policies
**When to use**: After tenant tables exist, to update all policies
**What it does**:
- Updates all RLS policies to use tenant-based access
- Migrates existing data to include tenant_id
- Creates tenant records for existing users

### 010_rls_policy_fixes.sql (UPDATED)
**Purpose**: Fixes tenant access issues and creates missing tenants
**When to use**: After tenant tables exist, to resolve access problems
**What it does**:
- Creates tenant records for users without them
- Updates improved tenant functions
- Populates missing tenant_id values
- Provides comprehensive diagnostics

### 011_rls_verification_queries.sql
**Purpose**: Comprehensive verification of RLS setup
**When to use**: After applying fixes, to confirm everything works
**What it does**:
- Checks all users have tenant access
- Verifies NULL tenant_id values are resolved
- Tests RLS policy effectiveness
- Provides detailed status reports

## Troubleshooting

### Error: "relation public.tenants does not exist"
**Solution**: Run `000_complete_schema_setup.sql` first

### Error: "relation public.tenant_users does not exist"
**Solution**: Run `000_complete_schema_setup.sql` first

### Users still locked out after fixes
**Solution**:
```sql
-- Check for remaining issues
SELECT * FROM public.rls_access_log
WHERE access_granted = false
ORDER BY created_at DESC;
```

### NULL tenant_id values persist
**Solution**: Re-run the RLS fixes script:
```sql
\i scripts/010_rls_policy_fixes.sql
```

## Verification Steps

After completing setup, verify everything works:

### 1. Check User Access
```sql
SELECT
    u.email,
    array_length(public.get_user_tenant_ids(), 1) as tenant_count,
    public.get_current_tenant_id() as current_tenant
FROM auth.users u;
```

### 2. Check Data Integrity
```sql
SELECT
    table_name,
    COUNT(*) as total_rows,
    COUNT(*) FILTER (WHERE tenant_id IS NULL) as null_tenant_ids
FROM (
    SELECT 'profiles' as table_name, tenant_id FROM public.profiles
    UNION ALL SELECT 'leads', tenant_id FROM public.leads
    UNION ALL SELECT 'chat_conversations', tenant_id FROM public.chat_conversations
) checks
GROUP BY table_name;
```

### 3. Test RLS Policies
```sql
-- As an authenticated user, try accessing your data
SELECT * FROM public.profiles WHERE id = auth.uid();
SELECT * FROM public.leads LIMIT 5;
```

## Expected Results

### ✅ Success Indicators
- All users can access their data after authentication
- No NULL tenant_id values in core tables
- New user registration creates tenant automatically
- RLS policies enforce proper tenant isolation
- Functions return valid tenant IDs

### ⚠️ Warning Signs
- Users report being unable to access data
- NULL values in tenant_id columns
- Functions return empty arrays
- RLS policy errors in logs

## Maintenance

### Regular Checks
```sql
-- Monthly verification
\i scripts/011_rls_verification_queries.sql
```

### Adding New Tables
When adding new tables that need tenant isolation:
1. Include `tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE`
2. Add appropriate indexes
3. Create tenant-based RLS policies
4. Update the verification queries

## Support

If you encounter issues:
1. Run the verification queries and note any failures
2. Check the `public.rls_access_log` table for errors
3. Ensure scripts are run in the correct order
4. Verify you have admin privileges in the database

---

**Note**: The `000_complete_schema_setup.sql` script is the recommended starting point for all new installations as it includes everything needed for proper multi-tenancy from the beginning.