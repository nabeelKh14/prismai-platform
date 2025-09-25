import { logger } from '@/lib/logger'
import { alertingSystem, AlertSeverity, AlertType } from '@/lib/monitoring/alerting-system'

export enum CRMErrorType {
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  PERMISSION_ERROR = 'permission_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  TIMEOUT_ERROR = 'timeout_error',
  DATA_INTEGRITY_ERROR = 'data_integrity_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export enum CRMErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CRMErrorContext {
  userId: string
  provider: string
  operation: string
  endpoint?: string
  requestId?: string
  customerId?: string
  retryCount?: number
  timestamp: Date
  metadata?: Record<string, any>
}

export interface CRMErrorRecoveryStrategy {
  canRecover: boolean
  shouldRetry: boolean
  retryDelay?: number
  alternativeAction?: string
  escalationRequired?: boolean
}

export class CRMError extends Error {
  public readonly type: CRMErrorType
  public readonly severity: CRMErrorSeverity
  public readonly context: CRMErrorContext
  public readonly originalError?: Error
  public readonly httpStatus?: number
  public readonly providerResponse?: any

  constructor(
    type: CRMErrorType,
    message: string,
    context: CRMErrorContext,
    originalError?: Error,
    httpStatus?: number,
    providerResponse?: any
  ) {
    super(message)
    this.name = 'CRMError'
    this.type = type
    this.severity = this.determineSeverity(type, httpStatus)
    this.context = context
    this.originalError = originalError
    this.httpStatus = httpStatus
    this.providerResponse = providerResponse
  }

  private determineSeverity(type: CRMErrorType, httpStatus?: number): CRMErrorSeverity {
    switch (type) {
      case CRMErrorType.AUTHENTICATION_ERROR:
      case CRMErrorType.PERMISSION_ERROR:
        return CRMErrorSeverity.HIGH
      case CRMErrorType.RATE_LIMIT_ERROR:
      case CRMErrorType.QUOTA_EXCEEDED:
        return CRMErrorSeverity.MEDIUM
      case CRMErrorType.SERVICE_UNAVAILABLE:
      case CRMErrorType.NETWORK_ERROR:
        return CRMErrorSeverity.HIGH
      case CRMErrorType.RESOURCE_NOT_FOUND:
        return CRMErrorSeverity.LOW
      case CRMErrorType.VALIDATION_ERROR:
      case CRMErrorType.DATA_INTEGRITY_ERROR:
        return CRMErrorSeverity.MEDIUM
      case CRMErrorType.TIMEOUT_ERROR:
        return CRMErrorSeverity.HIGH
      default:
        return httpStatus && httpStatus >= 500 ? CRMErrorSeverity.HIGH : CRMErrorSeverity.MEDIUM
    }
  }

  getRecoveryStrategy(): CRMErrorRecoveryStrategy {
    switch (this.type) {
      case CRMErrorType.AUTHENTICATION_ERROR:
        return {
          canRecover: true,
          shouldRetry: false,
          alternativeAction: 'token_refresh',
          escalationRequired: true
        }
      case CRMErrorType.RATE_LIMIT_ERROR:
        return {
          canRecover: true,
          shouldRetry: true,
          retryDelay: this.calculateRetryDelay()
        }
      case CRMErrorType.NETWORK_ERROR:
        return {
          canRecover: true,
          shouldRetry: true,
          retryDelay: this.calculateRetryDelay()
        }
      case CRMErrorType.SERVICE_UNAVAILABLE:
        return {
          canRecover: true,
          shouldRetry: true,
          retryDelay: this.calculateRetryDelay(),
          escalationRequired: true
        }
      case CRMErrorType.TIMEOUT_ERROR:
        return {
          canRecover: true,
          shouldRetry: true,
          retryDelay: this.calculateRetryDelay()
        }
      case CRMErrorType.QUOTA_EXCEEDED:
        return {
          canRecover: false,
          shouldRetry: false,
          escalationRequired: true
        }
      case CRMErrorType.PERMISSION_ERROR:
        return {
          canRecover: false,
          shouldRetry: false,
          escalationRequired: true
        }
      default:
        return {
          canRecover: false,
          shouldRetry: false
        }
    }
  }

  private calculateRetryDelay(): number {
    const baseDelay = 1000 // 1 second
    const retryCount = this.context.retryCount || 0
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), 30000) // Max 30 seconds
    const jitter = Math.random() * 1000 // Add up to 1 second of jitter
    return exponentialDelay + jitter
  }
}

export class CRMErrorHandler {
  private static readonly MAX_RETRY_ATTEMPTS = 3
  private static readonly ERROR_THRESHOLD_FOR_ALERT = 5
  private static readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

  private errorCounts: Map<string, { count: number; lastError: Date }> = new Map()
  private lastAlertTimes: Map<string, Date> = new Map()

  async handleError(
    error: Error | CRMError,
    context: CRMErrorContext,
    retryCallback?: () => Promise<any>
  ): Promise<any> {
    const crmError = this.normalizeError(error, context)

    // Log the error with full context
    this.logError(crmError)

    // Check if we should trigger an alert
    this.checkAndTriggerAlert(crmError)

    // Determine recovery strategy
    const recovery = crmError.getRecoveryStrategy()

    if (recovery.shouldRetry && retryCallback && (crmError.context.retryCount || 0) < CRMErrorHandler.MAX_RETRY_ATTEMPTS) {
      return this.handleRetry(crmError, retryCallback)
    }

    if (recovery.alternativeAction) {
      return this.handleAlternativeAction(crmError, recovery.alternativeAction)
    }

    // If no recovery possible, throw the error
    throw crmError
  }

  private normalizeError(error: Error | CRMError, context: CRMErrorContext): CRMError {
    if (error instanceof CRMError) {
      return new CRMError(
        error.type,
        error.message,
        { ...context, retryCount: (context.retryCount || 0) + 1 },
        error.originalError,
        error.httpStatus,
        error.providerResponse
      )
    }

    // Classify the error based on the original error
    const { type, httpStatus, providerResponse } = this.classifyError(error, context)

    return new CRMError(
      type,
      error.message,
      { ...context, retryCount: (context.retryCount || 0) + 1 },
      error,
      httpStatus,
      providerResponse
    )
  }

  private classifyError(error: Error, context: CRMErrorContext): {
    type: CRMErrorType
    httpStatus?: number
    providerResponse?: any
  } {
    const message = error.message.toLowerCase()
    const stack = error.stack || ''

    // Check for HTTP status codes in error message or stack
    const statusMatch = message.match(/status (\d+)/) || stack.match(/status (\d+)/)
    const httpStatus = statusMatch ? parseInt(statusMatch[1]) : undefined

    // Authentication errors
    if (httpStatus === 401 || message.includes('unauthorized') || message.includes('authentication')) {
      return { type: CRMErrorType.AUTHENTICATION_ERROR, httpStatus: 401 }
    }

    // Rate limiting errors
    if (httpStatus === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return { type: CRMErrorType.RATE_LIMIT_ERROR, httpStatus: 429 }
    }

    // Permission errors
    if (httpStatus === 403 || message.includes('forbidden') || message.includes('permission')) {
      return { type: CRMErrorType.PERMISSION_ERROR, httpStatus: 403 }
    }

    // Not found errors
    if (httpStatus === 404 || message.includes('not found')) {
      return { type: CRMErrorType.RESOURCE_NOT_FOUND, httpStatus: 404 }
    }

    // Quota exceeded
    if (message.includes('quota') || message.includes('limit exceeded')) {
      return { type: CRMErrorType.QUOTA_EXCEEDED }
    }

    // Service unavailable
    if (httpStatus === 503 || message.includes('service unavailable') || message.includes('maintenance')) {
      return { type: CRMErrorType.SERVICE_UNAVAILABLE, httpStatus: 503 }
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return { type: CRMErrorType.TIMEOUT_ERROR }
    }

    // Network errors
    if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return { type: CRMErrorType.NETWORK_ERROR }
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return { type: CRMErrorType.VALIDATION_ERROR }
    }

    return { type: CRMErrorType.UNKNOWN_ERROR, httpStatus }
  }

  private async handleRetry(crmError: CRMError, retryCallback: () => Promise<any>): Promise<any> {
    const retryDelay = crmError.getRecoveryStrategy().retryDelay || 1000

    logger.info('Retrying CRM operation', {
      provider: crmError.context.provider,
      operation: crmError.context.operation,
      retryCount: crmError.context.retryCount,
      delay: retryDelay
    })

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, retryDelay))

    try {
      return await retryCallback()
    } catch (retryError) {
      // If retry also fails, handle the error again
      return this.handleError(retryError as Error, crmError.context, retryCallback)
    }
  }

  private async handleAlternativeAction(crmError: CRMError, action: string): Promise<any> {
    logger.info('Attempting alternative action for CRM error', {
      provider: crmError.context.provider,
      operation: crmError.context.operation,
      action
    })

    switch (action) {
      case 'token_refresh':
        // This would trigger a token refresh process
        // Implementation depends on the specific CRM provider
        throw new Error('Token refresh not implemented for this provider')

      default:
        throw crmError
    }
  }

  private logError(crmError: CRMError): void {
    const logData = {
      type: crmError.type,
      severity: crmError.severity,
      provider: crmError.context.provider,
      operation: crmError.context.operation,
      userId: crmError.context.userId,
      customerId: crmError.context.customerId,
      requestId: crmError.context.requestId,
      retryCount: crmError.context.retryCount,
      httpStatus: crmError.httpStatus,
      originalError: crmError.originalError?.message,
      stack: crmError.stack
    }

    switch (crmError.severity) {
      case CRMErrorSeverity.CRITICAL:
        logger.error('Critical CRM error occurred', logData)
        break
      case CRMErrorSeverity.HIGH:
        logger.error('High severity CRM error occurred', logData)
        break
      case CRMErrorSeverity.MEDIUM:
        logger.warn('Medium severity CRM error occurred', logData)
        break
      case CRMErrorSeverity.LOW:
        logger.info('Low severity CRM error occurred', logData)
        break
    }
  }

  private checkAndTriggerAlert(crmError: CRMError): void {
    const errorKey = `${crmError.context.provider}:${crmError.type}`

    // Get current error count
    const currentError = this.errorCounts.get(errorKey) || { count: 0, lastError: new Date() }

    // Increment error count
    currentError.count++
    currentError.lastError = new Date()
    this.errorCounts.set(errorKey, currentError)

    // Check if we should trigger an alert
    if (currentError.count >= CRMErrorHandler.ERROR_THRESHOLD_FOR_ALERT) {
      // Check cooldown period
      const lastAlert = this.lastAlertTimes.get(errorKey)
      if (!lastAlert || (Date.now() - lastAlert.getTime()) > CRMErrorHandler.ALERT_COOLDOWN_MS) {
        this.triggerAlert(crmError, currentError.count)
        this.lastAlertTimes.set(errorKey, new Date())
      }
    }
  }

  private triggerAlert(crmError: CRMError, errorCount: number): void {
    const alertType: AlertType = crmError.severity === CRMErrorSeverity.CRITICAL
      ? 'external_service_down'
      : 'high_error_rate'

    const severity: AlertSeverity = crmError.severity === CRMErrorSeverity.CRITICAL
      ? 'critical'
      : 'high'

    // Note: This would need to be implemented differently based on the actual AlertRule interface
    // For now, we'll just log the alert condition
    logger.warn('CRM error threshold exceeded - alert would be triggered', {
      provider: crmError.context.provider,
      errorType: crmError.type,
      errorCount,
      severity: crmError.severity,
      alertType,
      alertSeverity: severity
    })

    logger.warn('CRM error alert triggered', {
      provider: crmError.context.provider,
      errorType: crmError.type,
      errorCount,
      severity: crmError.severity
    })
  }

  // Public methods for monitoring and management
  getErrorStats(provider?: string): Record<string, { count: number; lastError: Date }> {
    const stats: Record<string, { count: number; lastError: Date }> = {}

    for (const [key, value] of this.errorCounts.entries()) {
      if (!provider || key.startsWith(`${provider}:`)) {
        stats[key] = value
      }
    }

    return stats
  }

  resetErrorCount(provider: string, errorType: CRMErrorType): void {
    const errorKey = `${provider}:${errorType}`
    this.errorCounts.delete(errorKey)
    this.lastAlertTimes.delete(errorKey)
  }

  clearAllErrorStats(): void {
    this.errorCounts.clear()
    this.lastAlertTimes.clear()
  }
}

// Export singleton instance
export const crmErrorHandler = new CRMErrorHandler()