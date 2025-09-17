import { NextRequest, NextResponse } from 'next/server'
import {
  runDisasterRecoveryTest,
  reportIncident,
  getBusinessContinuityPlan,
  listDRTests,
  listActiveIncidents
} from '@/lib/backup/disaster-recovery'
import { logger } from '@/lib/logger'
import { EnterpriseSecurity } from '@/lib/auth/enterprise-security'
import { SecurityAudit } from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await EnterpriseSecurity.authenticateRequest(request, {
      requireAuth: true,
      requireAdmin: true
    })
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    let result: any

    switch (action) {
      case 'tests':
        result = await listDRTests(20)
        break

      case 'incidents':
        result = listActiveIncidents()
        break

      case 'bcp':
        result = getBusinessContinuityPlan()
        break

      default:
        result = {
          tests: await listDRTests(10),
          incidents: listActiveIncidents(),
          bcp: getBusinessContinuityPlan(),
        }
    }

    SecurityAudit.logSensitiveAction('dr_data_accessed', authResult.user.id, {
      action: action || 'overview',
    })

    return NextResponse.json(result)

  } catch (error) {
    logger.error('Failed to retrieve disaster recovery data', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let action: string | undefined
  let testType: string | undefined
  let incidentType: string | undefined
  let severity: string | undefined
  let impact: string | undefined
  let incidentId: string | undefined
  let updates: any

  try {
    // Require admin authentication
    const authResult = await EnterpriseSecurity.authenticateRequest(request, {
      requireAuth: true,
      requireAdmin: true
    })
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    ;({ action, testType, incidentType, severity, impact, incidentId, updates } = body)

    let result: any

    switch (action) {
      case 'run_test':
        if (!testType || !['full', 'partial', 'failover'].includes(testType)) {
          return NextResponse.json(
            { error: 'Invalid or missing testType. Must be: full, partial, or failover' },
            { status: 400 }
          )
        }
        result = await runDisasterRecoveryTest(testType as 'full' | 'partial' | 'failover')
        break

      case 'report_incident':
        if (!incidentType || !severity || !impact) {
          return NextResponse.json(
            { error: 'Missing required fields: incidentType, severity, impact' },
            { status: 400 }
          )
        }
        if (!['data_loss', 'service_outage', 'security_breach', 'hardware_failure'].includes(incidentType)) {
          return NextResponse.json(
            { error: 'Invalid incidentType' },
            { status: 400 }
          )
        }
        if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
          return NextResponse.json(
            { error: 'Invalid severity level' },
            { status: 400 }
          )
        }
        result = await reportIncident(incidentType as any, severity as any, impact)
        break

      case 'update_incident':
        if (!incidentId || !updates) {
          return NextResponse.json(
            { error: 'Missing required fields: incidentId, updates' },
            { status: 400 }
          )
        }
        // Import the service to access updateIncident method
        const { disasterRecoveryService } = await import('@/lib/backup/disaster-recovery')
        result = await disasterRecoveryService.updateIncident(incidentId, updates)
        if (!result) {
          return NextResponse.json(
            { error: 'Incident not found' },
            { status: 404 }
          )
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    SecurityAudit.logSensitiveAction('dr_operation_performed', authResult.user.id, {
      action,
      testType,
      incidentType,
      severity,
      incidentId,
    })

    return NextResponse.json(result)

  } catch (error) {
    logger.error('Disaster recovery operation failed', error as Error, {
      action,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}