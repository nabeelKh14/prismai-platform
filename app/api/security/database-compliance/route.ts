import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { databaseSecurityManager } from "@/lib/security/database-security-manager"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const limit = parseInt(url.searchParams.get('limit') || '100')

    switch (action) {
      case 'audit_events':
        // Get recent audit events
        const userId = url.searchParams.get('userId') || undefined
        const actionFilter = url.searchParams.get('action') || undefined
        const auditEvents = await databaseSecurityManager.getRecentAuditEvents(limit, userId, actionFilter)
        return NextResponse.json({
          auditEvents,
          totalCount: auditEvents.length,
          lastUpdated: new Date().toISOString()
        })

      case 'audit_summary':
        // Get security audit summary
        const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const endDate = url.searchParams.get('endDate') || new Date().toISOString()

        const { data: summary, error } = await supabase.rpc('get_security_audit_summary', {
          p_start_date: startDate,
          p_end_date: endDate
        })

        if (error) throw error

        return NextResponse.json({
          summary,
          period: { startDate, endDate },
          lastUpdated: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          error: "Invalid action. Use 'audit_events' or 'audit_summary'"
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in database compliance API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for security and compliance actions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'generate_compliance_report':
        // Generate compliance report
        const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const endDate = params.endDate || new Date().toISOString()

        const complianceReport = await databaseSecurityManager.generateComplianceReport(startDate, endDate)
        return NextResponse.json({
          success: true,
          report: complianceReport
        })

      case 'check_permissions':
        // Check user permissions
        if (!params.userId || !params.action || !params.resource) {
          return NextResponse.json({
            error: "Missing required parameters: userId, action, resource"
          }, { status: 400 })
        }

        const permissionCheck = await databaseSecurityManager.checkAccessPermissions(
          params.userId,
          params.action,
          params.resource,
          params.context
        )

        return NextResponse.json({
          success: true,
          permissions: permissionCheck
        })

      case 'log_audit_event':
        // Log a custom audit event
        if (!params.action || !params.resource) {
          return NextResponse.json({
            error: "Missing required parameters: action, resource"
          }, { status: 400 })
        }

        await databaseSecurityManager.logAuditEvent({
          userId: params.userId || user.id,
          action: params.action,
          resource: params.resource,
          details: params.details || {},
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          success: params.success !== false,
          errorMessage: params.errorMessage,
          complianceFlags: params.complianceFlags || []
        })

        return NextResponse.json({
          success: true,
          message: 'Audit event logged successfully'
        })

      case 'encrypt_data':
        // Encrypt sensitive data
        if (!params.data || !params.context) {
          return NextResponse.json({
            error: "Missing required parameters: data, context"
          }, { status: 400 })
        }

        const encryptedData = await databaseSecurityManager.encryptSensitiveData(params.data, params.context)
        return NextResponse.json({
          success: true,
          encryptedData
        })

      case 'decrypt_data':
        // Decrypt sensitive data
        if (!params.encryptedData || !params.context) {
          return NextResponse.json({
            error: "Missing required parameters: encryptedData, context"
          }, { status: 400 })
        }

        const decryptedData = await databaseSecurityManager.decryptSensitiveData(params.encryptedData, params.context)
        return NextResponse.json({
          success: true,
          decryptedData
        })

      case 'cleanup_audit_logs':
        // Clean up old audit logs
        const daysToKeep = params.days || 90

        const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_old_audit_logs', {
          p_days: daysToKeep
        })

        if (cleanupError) throw cleanupError

        return NextResponse.json({
          success: true,
          message: `Cleaned up ${cleanupResult} old audit log entries`,
          recordsDeleted: cleanupResult
        })

      default:
        return NextResponse.json({
          error: "Invalid action",
          supportedActions: [
            'generate_compliance_report',
            'check_permissions',
            'log_audit_event',
            'encrypt_data',
            'decrypt_data',
            'cleanup_audit_logs'
          ]
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in database compliance action API:', error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}