import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseBackup, listDatabaseBackups, restoreDatabaseBackup } from '@/lib/backup/database-backup'
import { createFileBackup, listFileBackups, restoreFileBackup } from '@/lib/backup/file-backup'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/auth'
import { SecurityAudit } from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAuth(request, ['admin'])
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    const result: any = {}

    if (type === 'database' || type === 'all') {
      result.database = await listDatabaseBackups()
    }

    if (type === 'files' || type === 'all') {
      result.files = await listFileBackups()
    }

    SecurityAudit.logSensitiveAction('backup_list_accessed', authResult.user.id, {
      type,
      resultCount: Object.keys(result).length,
    })

    return NextResponse.json(result)

  } catch (error) {
    logger.error('Failed to list backups', error as Error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let type: string | undefined
  let action: string | undefined
  let backupId: string | undefined
  let targetPath: string | undefined

  try {
    // Require admin authentication
    const authResult = await requireAuth(request, ['admin'])
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    ;({ type, action, backupId, targetPath } = body)

    if (!type || !action) {
      return NextResponse.json(
        { error: 'Missing required parameters: type and action' },
        { status: 400 }
      )
    }

    let result: any

    switch (action) {
      case 'create':
        if (type === 'database') {
          result = await createDatabaseBackup()
        } else if (type === 'files') {
          result = await createFileBackup()
        } else {
          return NextResponse.json(
            { error: 'Invalid backup type' },
            { status: 400 }
          )
        }
        break

      case 'restore':
        if (!backupId) {
          return NextResponse.json(
            { error: 'backupId is required for restore action' },
            { status: 400 }
          )
        }

        if (type === 'database') {
          result = await restoreDatabaseBackup(backupId)
        } else if (type === 'files') {
          result = await restoreFileBackup(backupId, targetPath)
        } else {
          return NextResponse.json(
            { error: 'Invalid backup type' },
            { status: 400 }
          )
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    SecurityAudit.logSensitiveAction('backup_operation_performed', authResult.user.id, {
      type,
      action,
      backupId,
      success: result.success,
    })

    return NextResponse.json(result)

  } catch (error) {
    logger.error('Backup operation failed', error as Error, {
      type,
      action,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}