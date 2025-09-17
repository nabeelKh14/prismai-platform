import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if system_logs table exists
    const { data: systemLogsExists, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'system_logs')
      .single()

    if (checkError && !checkError.message.includes('No rows found')) {
      console.error('Error checking system_logs table:', checkError)
    }

    // Check if audit_trails table exists
    const { data: auditTrailsExists, error: auditCheckError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'audit_trails')
      .single()

    if (auditCheckError && !auditCheckError.message.includes('No rows found')) {
      console.error('Error checking audit_trails table:', auditCheckError)
    }

    const results = {
      system_logs: {
        exists: !!systemLogsExists,
        status: systemLogsExists ? 'already exists' : 'needs creation'
      },
      audit_trails: {
        exists: !!auditTrailsExists,
        status: auditTrailsExists ? 'already exists' : 'needs creation'
      }
    }

    // If tables don't exist, try to create them using basic SQL
    if (!systemLogsExists) {
      try {
        // Create system_logs table
        const { error: createError } = await supabase.rpc('exec', {
          sql: `
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
          `
        })

        if (createError) {
          console.error('Failed to create system_logs table:', createError)
          results.system_logs.status = 'creation failed'
        } else {
          results.system_logs.status = 'created successfully'
        }
      } catch (err) {
        console.error('Error creating system_logs table:', err)
        results.system_logs.status = 'creation failed'
      }
    }

    if (!auditTrailsExists) {
      try {
        // Create audit_trails table
        const { error: createAuditError } = await supabase.rpc('exec', {
          sql: `
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
          `
        })

        if (createAuditError) {
          console.error('Failed to create audit_trails table:', createAuditError)
          results.audit_trails.status = 'creation failed'
        } else {
          results.audit_trails.status = 'created successfully'
        }
      } catch (err) {
        console.error('Error creating audit_trails table:', err)
        results.audit_trails.status = 'creation failed'
      }
    }

    return NextResponse.json({
      success: true,
      service: 'PrismAI',
      message: 'PrismAI logging setup check completed',
      results
    })

  } catch (error) {
    console.error('Setup logging API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to setup logging tables',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'PrismAI',
    message: 'Use POST to setup PrismAI logging tables',
    endpoint: '/api/setup-logging',
    method: 'POST'
  })
}