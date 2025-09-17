import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { accessControlService } from '@/lib/security/access-control'

export interface LogExportRequest {
  id: string
  requestedBy: string
  requestedAt: Date
  logType: 'system_logs' | 'audit_trails' | 'security_events' | 'auth_audit_log'
  dateRangeStart: Date
  dateRangeEnd: Date
  filters: Record<string, any>
  format: 'json' | 'csv' | 'parquet' | 'xml'
  compression: 'none' | 'gzip' | 'zip' | 'bzip2'
  includeAttachments: boolean
  status: 'pending' | 'processing' | 'completed' | 'failed'
  recordCount?: number
  fileSizeBytes?: number
  downloadUrl?: string
  expiresAt: Date
  completedAt?: Date
  errorMessage?: string
  complianceApproved: boolean
  complianceApprovedBy?: string
  complianceApprovedAt?: Date
  metadata: Record<string, any>
}

export interface ExportResult {
  success: boolean
  recordCount: number
  fileSizeBytes: number
  downloadUrl?: string
  errorMessage?: string
}

export class LogExportService {
  private static instance: LogExportService

  static getInstance(): LogExportService {
    if (!LogExportService.instance) {
      LogExportService.instance = new LogExportService()
    }
    return LogExportService.instance
  }

  /**
   * Create a log export request
   */
  async createExportRequest(
    requestedBy: string,
    logType: LogExportRequest['logType'],
    dateRangeStart: Date,
    dateRangeEnd: Date,
    options: {
      filters?: Record<string, any>
      format?: LogExportRequest['format']
      compression?: LogExportRequest['compression']
      includeAttachments?: boolean
      tenantId?: string
    } = {}
  ): Promise<LogExportRequest> {
    try {
      // Check permissions
      const hasPermission = await accessControlService.hasPermission(
        requestedBy,
        'logs',
        'export'
      )

      if (!hasPermission) {
        throw new Error('Insufficient permissions to export logs')
      }

      // Validate date range (max 90 days for security)
      const maxRange = 90 * 24 * 60 * 60 * 1000 // 90 days in milliseconds
      if (dateRangeEnd.getTime() - dateRangeStart.getTime() > maxRange) {
        throw new Error('Export date range cannot exceed 90 days')
      }

      // Check for compliance approval requirement
      const requiresApproval = this.requiresComplianceApproval(logType, options.filters)
      if (requiresApproval) {
        // In production, this would trigger an approval workflow
        logger.warn('Export requires compliance approval', {
          logType,
          requestedBy,
          dateRangeStart: dateRangeStart.toISOString(),
          dateRangeEnd: dateRangeEnd.toISOString()
        })
      }

      const exportRequest: LogExportRequest = {
        id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestedBy,
        requestedAt: new Date(),
        logType,
        dateRangeStart,
        dateRangeEnd,
        filters: options.filters || {},
        format: options.format || 'json',
        compression: options.compression || 'gzip',
        includeAttachments: options.includeAttachments || false,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        complianceApproved: !requiresApproval,
        metadata: {
          tenantId: options.tenantId,
          requiresApproval
        }
      }

      // Save to database
      const supabase = await createClient()
      await supabase
        .from('log_export_requests')
        .insert({
          id: exportRequest.id,
          requested_by: exportRequest.requestedBy,
          requested_at: exportRequest.requestedAt.toISOString(),
          log_type: exportRequest.logType,
          date_range_start: exportRequest.dateRangeStart.toISOString(),
          date_range_end: exportRequest.dateRangeEnd.toISOString(),
          filters: exportRequest.filters,
          format: exportRequest.format,
          compression: exportRequest.compression,
          include_attachments: exportRequest.includeAttachments,
          status: exportRequest.status,
          expires_at: exportRequest.expiresAt.toISOString(),
          compliance_approved: exportRequest.complianceApproved,
          metadata: exportRequest.metadata
        })

      // Start processing in background
      this.processExportRequest(exportRequest)

      await logger.info('Log export request created', {
        exportId: exportRequest.id,
        logType,
        requestedBy,
        dateRange: `${dateRangeStart.toISOString()} to ${dateRangeEnd.toISOString()}`,
        requiresApproval
      })

      return exportRequest

    } catch (error) {
      await logger.error('Failed to create export request', {
        error,
        requestedBy,
        logType
      })
      throw error
    }
  }

  /**
   * Process an export request
   */
  private async processExportRequest(exportRequest: LogExportRequest): Promise<void> {
    try {
      // Update status to processing
      await this.updateExportStatus(exportRequest.id, 'processing')

      // Check compliance approval if required
      if (exportRequest.metadata.requiresApproval && !exportRequest.complianceApproved) {
        await this.updateExportStatus(exportRequest.id, 'pending', 'Waiting for compliance approval')
        return
      }

      // Export the data
      const result = await this.exportLogData(exportRequest)

      if (result.success) {
        await this.updateExportStatus(
          exportRequest.id,
          'completed',
          undefined,
          result.recordCount,
          result.fileSizeBytes,
          result.downloadUrl,
          new Date()
        )

        await logger.info('Log export completed', {
          exportId: exportRequest.id,
          recordCount: result.recordCount,
          fileSizeBytes: result.fileSizeBytes
        })
      } else {
        await this.updateExportStatus(exportRequest.id, 'failed', result.errorMessage)
        await logger.error('Log export failed', {
          exportId: exportRequest.id,
          error: result.errorMessage
        })
      }

    } catch (error) {
      await this.updateExportStatus(
        exportRequest.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      )
      await logger.error('Export processing failed', {
        error,
        exportId: exportRequest.id
      })
    }
  }

  /**
   * Export log data
   */
  private async exportLogData(exportRequest: LogExportRequest): Promise<ExportResult> {
    try {
      const supabase = await createClient()

      // Query the data
      let query = supabase
        .from(exportRequest.logType)
        .select('*')
        .gte('timestamp', exportRequest.dateRangeStart.toISOString())
        .lte('timestamp', exportRequest.dateRangeEnd.toISOString())
        .order('timestamp', { ascending: true })

      // Apply filters
      if (exportRequest.filters.userId) {
        query = query.eq('user_id', exportRequest.filters.userId)
      }
      if (exportRequest.filters.level) {
        query = query.eq('level', exportRequest.filters.level)
      }
      if (exportRequest.filters.action) {
        query = query.eq('action', exportRequest.filters.action)
      }
      if (exportRequest.filters.source) {
        query = query.eq('source', exportRequest.filters.source)
      }
      if (exportRequest.filters.riskLevel) {
        query = query.eq('risk_level', exportRequest.filters.riskLevel)
      }

      // Limit for safety (max 100k records)
      query = query.limit(100000)

      const { data, error } = await query

      if (error) throw error
      if (!data || data.length === 0) {
        return {
          success: false,
          recordCount: 0,
          fileSizeBytes: 0,
          errorMessage: 'No data found for the specified criteria'
        }
      }

      // Format the data
      let formattedData: string
      let fileExtension: string

      switch (exportRequest.format) {
        case 'csv':
          formattedData = this.convertToCSV(data)
          fileExtension = 'csv'
          break
        case 'xml':
          formattedData = this.convertToXML(data, exportRequest.logType)
          fileExtension = 'xml'
          break
        case 'parquet':
          // Parquet would require additional libraries, simplified for now
          formattedData = JSON.stringify(data, null, 2)
          fileExtension = 'json'
          break
        default: // json
          formattedData = JSON.stringify(data, null, 2)
          fileExtension = 'json'
      }

      // Compress if requested
      let finalData = formattedData
      let compressionExtension = ''

      if (exportRequest.compression !== 'none') {
        // In production, implement actual compression
        // For now, just add extension
        compressionExtension = exportRequest.compression === 'gzip' ? '.gz' :
                              exportRequest.compression === 'zip' ? '.zip' : '.bz2'
      }

      // Generate download URL (in production, upload to secure storage)
      const fileName = `${exportRequest.logType}_${exportRequest.dateRangeStart.toISOString().split('T')[0]}_${exportRequest.dateRangeEnd.toISOString().split('T')[0]}.${fileExtension}${compressionExtension}`
      const downloadUrl = `/api/exports/download/${exportRequest.id}/${fileName}`

      // In production, you would:
      // 1. Upload the file to secure cloud storage (S3, etc.)
      // 2. Generate a signed URL with expiration
      // 3. Store the actual file URL

      return {
        success: true,
        recordCount: data.length,
        fileSizeBytes: Buffer.byteLength(finalData, 'utf8'),
        downloadUrl
      }

    } catch (error) {
      return {
        success: false,
        recordCount: 0,
        fileSizeBytes: 0,
        errorMessage: error instanceof Error ? error.message : 'Export failed'
      }
    }
  }

  /**
   * Approve export for compliance
   */
  async approveExport(
    exportId: string,
    approvedBy: string,
    approvalNotes?: string
  ): Promise<boolean> {
    try {
      // Check permissions
      const hasPermission = await accessControlService.hasPermission(
        approvedBy,
        'compliance',
        'read' // Using read as a generic permission check
      )

      if (!hasPermission) {
        throw new Error('Insufficient permissions to approve exports')
      }

      const supabase = await createClient()

      const { error } = await supabase
        .from('log_export_requests')
        .update({
          compliance_approved: true,
          compliance_approved_by: approvedBy,
          compliance_approved_at: new Date().toISOString(),
          metadata: approvalNotes ? { approval_notes: approvalNotes } : undefined
        })
        .eq('id', exportId)
        .eq('status', 'pending')

      if (error) throw error

      // Get the updated request and process it
      const { data: exportRequest } = await supabase
        .from('log_export_requests')
        .select('*')
        .eq('id', exportId)
        .single()

      if (exportRequest) {
        const request = this.mapDbToExportRequest(exportRequest)
        this.processExportRequest(request)
      }

      await logger.info('Export approved for compliance', {
        exportId,
        approvedBy,
        approvalNotes
      })

      return true

    } catch (error) {
      await logger.error('Failed to approve export', { error, exportId, approvedBy })
      return false
    }
  }

  /**
   * Get export requests for user
   */
  async getExportRequests(
    userId: string,
    status?: LogExportRequest['status'],
    limit: number = 50,
    offset: number = 0
  ): Promise<LogExportRequest[]> {
    const supabase = await createClient()

    let query = supabase
      .from('log_export_requests')
      .select('*')
      .eq('requested_by', userId)
      .order('requested_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return (data || []).map(item => this.mapDbToExportRequest(item))
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(limit: number = 50): Promise<LogExportRequest[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('log_export_requests')
      .select('*')
      .eq('compliance_approved', false)
      .eq('status', 'pending')
      .not('metadata->>requiresApproval', 'is', null)
      .order('requested_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map(item => this.mapDbToExportRequest(item))
  }

  /**
   * Download export file
   */
  async downloadExport(exportId: string, userId: string): Promise<{
    data: string
    fileName: string
    contentType: string
  } | null> {
    try {
      const supabase = await createClient()

      // Get export request
      const { data: exportRequest, error } = await supabase
        .from('log_export_requests')
        .select('*')
        .eq('id', exportId)
        .eq('requested_by', userId)
        .eq('status', 'completed')
        .single()

      if (error || !exportRequest) {
        return null
      }

      const request = this.mapDbToExportRequest(exportRequest)

      // Check if expired
      if (new Date() > request.expiresAt) {
        return null
      }

      // In production, retrieve from secure storage
      // For now, re-export the data
      const result = await this.exportLogData(request)

      if (!result.success || !result.downloadUrl) {
        return null
      }

      const fileName = result.downloadUrl.split('/').pop() || 'export.json'
      const contentType = request.format === 'csv' ? 'text/csv' :
                         request.format === 'xml' ? 'application/xml' :
                         'application/json'

      // In production, return the actual file data
      // For now, return placeholder
      return {
        data: 'File data would be here',
        fileName,
        contentType
      }

    } catch (error) {
      await logger.error('Failed to download export', { error, exportId, userId })
      return null
    }
  }

  /**
   * Check if export requires compliance approval
   */
  private requiresComplianceApproval(
    logType: LogExportRequest['logType'],
    filters?: Record<string, any>
  ): boolean {
    // High-risk log types always require approval
    if (logType === 'audit_trails' || logType === 'security_events') {
      return true
    }

    // Large date ranges require approval
    // Filters that might contain sensitive data require approval

    return false // Simplified for now
  }

  /**
   * Update export status
   */
  private async updateExportStatus(
    exportId: string,
    status: LogExportRequest['status'],
    errorMessage?: string,
    recordCount?: number,
    fileSizeBytes?: number,
    downloadUrl?: string,
    completedAt?: Date
  ): Promise<void> {
    const supabase = await createClient()

    const updateData: any = {
      status,
      error_message: errorMessage
    }

    if (recordCount !== undefined) updateData.record_count = recordCount
    if (fileSizeBytes !== undefined) updateData.file_size_bytes = fileSizeBytes
    if (downloadUrl !== undefined) updateData.download_url = downloadUrl
    if (completedAt !== undefined) updateData.completed_at = completedAt.toISOString()

    await supabase
      .from('log_export_requests')
      .update(updateData)
      .eq('id', exportId)
  }

  /**
   * Convert data to CSV
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return ''

    const headers = Object.keys(data[0])
    const rows = data.map(item =>
      headers.map(header => {
        const value = item[header]
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value || ''
      }).join(',')
    )

    return [headers.join(','), ...rows].join('\n')
  }

  /**
   * Convert data to XML
   */
  private convertToXML(data: any[], rootElement: string): string {
    const items = data.map(item => {
      const properties = Object.entries(item)
        .map(([key, value]) => `  <${key}>${this.escapeXml(value)}</${key}>`)
        .join('\n')
      return `  <item>\n${properties}\n  </item>`
    }).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootElement}>\n${items}\n</${rootElement}>`
  }

  /**
   * Escape XML characters
   */
  private escapeXml(value: any): string {
    if (value === null || value === undefined) return ''
    const str = String(value)
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  /**
   * Map database record to export request
   */
  private mapDbToExportRequest(dbRecord: any): LogExportRequest {
    return {
      id: dbRecord.id,
      requestedBy: dbRecord.requested_by,
      requestedAt: new Date(dbRecord.requested_at),
      logType: dbRecord.log_type,
      dateRangeStart: new Date(dbRecord.date_range_start),
      dateRangeEnd: new Date(dbRecord.date_range_end),
      filters: dbRecord.filters || {},
      format: dbRecord.format,
      compression: dbRecord.compression,
      includeAttachments: dbRecord.include_attachments,
      status: dbRecord.status,
      recordCount: dbRecord.record_count,
      fileSizeBytes: dbRecord.file_size_bytes,
      downloadUrl: dbRecord.download_url,
      expiresAt: new Date(dbRecord.expires_at),
      completedAt: dbRecord.completed_at ? new Date(dbRecord.completed_at) : undefined,
      errorMessage: dbRecord.error_message,
      complianceApproved: dbRecord.compliance_approved,
      complianceApprovedBy: dbRecord.compliance_approved_by,
      complianceApprovedAt: dbRecord.compliance_approved_at ? new Date(dbRecord.compliance_approved_at) : undefined,
      metadata: dbRecord.metadata || {}
    }
  }
}

// Export singleton instance
export const logExportService = LogExportService.getInstance()

// Convenience functions
export async function createLogExport(
  requestedBy: string,
  logType: LogExportRequest['logType'],
  dateRangeStart: Date,
  dateRangeEnd: Date,
  options?: Parameters<LogExportService['createExportRequest']>[4]
): Promise<LogExportRequest> {
  return logExportService.createExportRequest(requestedBy, logType, dateRangeStart, dateRangeEnd, options)
}

export async function approveLogExport(
  exportId: string,
  approvedBy: string,
  approvalNotes?: string
): Promise<boolean> {
  return logExportService.approveExport(exportId, approvedBy, approvalNotes)
}

export async function getLogExports(
  userId: string,
  status?: LogExportRequest['status'],
  limit?: number,
  offset?: number
): Promise<LogExportRequest[]> {
  return logExportService.getExportRequests(userId, status, limit, offset)
}