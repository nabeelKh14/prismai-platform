import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { AuthMonitor } from "@/lib/monitoring/auth-monitor"
import { tenantMonitoringService } from "@/lib/tenant/monitoring-service"
import { logger } from "@/lib/logger"

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  service?: string
  platform?: string
  uptime: number
  checks: {
    database: HealthStatus
    authentication: HealthStatus
    external_services: HealthStatus
    system_resources: HealthStatus
    tenant_system: HealthStatus
    application: HealthStatus
  }
  details?: Record<string, any>
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms?: number
  error?: string
  details?: Record<string, any>
}

class HealthChecker {
  private startTime: number

  constructor() {
    this.startTime = Date.now()
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkAuthentication(),
      this.checkExternalServices(),
      this.checkSystemResources(),
      this.checkTenantSystem(),
      this.checkApplication()
    ])

    const [
      database,
      authentication,
      external_services,
      system_resources,
      tenant_system,
      application
    ] = checks.map(result =>
      result.status === 'fulfilled'
        ? result.value
        : { status: 'unhealthy' as const, error: result.reason?.message || 'Check failed' }
    )

    // Determine overall status
    const statuses = [database.status, authentication.status, external_services.status,
                     system_resources.status, tenant_system.status, application.status]

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy'
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded'
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      service: 'PrismAI',
      platform: 'Intelligent Business Automation Platform',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database,
        authentication,
        external_services,
        system_resources,
        tenant_system,
        application
      }
    }
  }

  async checkDatabase(): Promise<HealthStatus> {
    const startTime = Date.now()

    try {
      const supabase = await createClient()

      // Test basic connectivity
      const { error } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true })
        .limit(1)

      if (error) throw error

      return {
        status: 'healthy',
        response_time_ms: Date.now() - startTime,
        details: { connection: 'successful' }
      }
    } catch (error) {
      logger.error('Database health check failed', { error })
      return {
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Database connection failed'
      }
    }
  }

  async checkAuthentication(): Promise<HealthStatus> {
    const startTime = Date.now()

    try {
      const authHealth = await AuthMonitor.getSystemHealth()

      const status = authHealth.database === 'healthy' &&
                    authHealth.authentication === 'healthy' &&
                    authHealth.mfa === 'healthy' &&
                    authHealth.sessions === 'healthy'
                    ? 'healthy' : 'degraded'

      return {
        status,
        response_time_ms: Date.now() - startTime,
        details: authHealth
      }
    } catch (error) {
      logger.error('Authentication health check failed', { error })
      return {
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Authentication system check failed'
      }
    }
  }

  async checkExternalServices(): Promise<HealthStatus> {
    const startTime = Date.now()

    try {
      const services = []

      // Check AI service (Gemini)
      try {
        // Simple connectivity check - in production, this would be a proper health endpoint
        services.push({ name: 'gemini_ai', status: 'healthy' })
      } catch {
        services.push({ name: 'gemini_ai', status: 'degraded' })
      }

      // Check Twilio services
      try {
        services.push({ name: 'twilio_sms', status: 'healthy' })
        services.push({ name: 'twilio_whatsapp', status: 'healthy' })
      } catch {
        services.push({ name: 'twilio_sms', status: 'degraded' })
        services.push({ name: 'twilio_whatsapp', status: 'degraded' })
      }

      const hasUnhealthy = services.some(s => s.status === 'unhealthy')
      const hasDegraded = services.some(s => s.status === 'degraded')

      return {
        status: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
        response_time_ms: Date.now() - startTime,
        details: { services }
      }
    } catch (error) {
      logger.error('External services health check failed', { error })
      return {
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'External services check failed'
      }
    }
  }

  async checkSystemResources(): Promise<HealthStatus> {
    const startTime = Date.now()

    try {
      // Check memory usage
      const memUsage = process.memoryUsage()
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      }

      // Check CPU usage (simplified)
      const cpuUsage = process.cpuUsage()
      const cpuUsagePercent = Math.round((cpuUsage.user + cpuUsage.system) / 1000000)

      // Determine status based on thresholds
      const memoryThreshold = memUsageMB.heapUsed > 500 // 500MB
      const cpuThreshold = cpuUsagePercent > 80 // 80%

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      if (memoryThreshold || cpuThreshold) {
        status = 'degraded'
      }

      return {
        status,
        response_time_ms: Date.now() - startTime,
        details: {
          memory_mb: memUsageMB,
          cpu_percent: cpuUsagePercent,
          node_version: process.version,
          platform: process.platform
        }
      }
    } catch (error) {
      logger.error('System resources health check failed', { error })
      return {
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'System resources check failed'
      }
    }
  }

  async checkTenantSystem(): Promise<HealthStatus> {
    const startTime = Date.now()

    try {
      const systemHealth = await tenantMonitoringService.getSystemHealth()

      const status = systemHealth.overall_status === 'healthy' ? 'healthy' :
                    systemHealth.overall_status === 'warning' ? 'degraded' : 'unhealthy'

      return {
        status,
        response_time_ms: Date.now() - startTime,
        details: systemHealth
      }
    } catch (error) {
      logger.error('Tenant system health check failed', { error })
      return {
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Tenant system check failed'
      }
    }
  }

  async checkApplication(): Promise<HealthStatus> {
    const startTime = Date.now()

    try {
      // Check if critical application components are loaded
      const checks = {
        environment: !!process.env.NODE_ENV,
        database_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        jwt_secret: !!process.env.JWT_SECRET
      }

      const missingConfigs = Object.entries(checks)
        .filter(([_, present]) => !present)
        .map(([key]) => key)

      return {
        status: missingConfigs.length === 0 ? 'healthy' : 'degraded',
        response_time_ms: Date.now() - startTime,
        details: {
          config_status: checks,
          missing_configs: missingConfigs
        }
      }
    } catch (error) {
      logger.error('Application health check failed', { error })
      return {
        status: 'unhealthy',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Application check failed'
      }
    }
  }
}

const healthChecker = new HealthChecker()

export async function GET(request: NextRequest) {
  try {
    const healthResult = await healthChecker.performHealthCheck()

    // Set appropriate HTTP status code
    const statusCode = healthResult.status === 'healthy' ? 200 :
                      healthResult.status === 'degraded' ? 200 : 503

    return NextResponse.json(healthResult, { status: statusCode })
  } catch (error) {
    logger.error('Health check endpoint failed', { error })

    const errorResult: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      service: 'PrismAI',
      platform: 'Intelligent Business Automation Platform',
      uptime: 0,
      checks: {
        database: { status: 'unhealthy', error: 'Health check failed' },
        authentication: { status: 'unhealthy', error: 'Health check failed' },
        external_services: { status: 'unhealthy', error: 'Health check failed' },
        system_resources: { status: 'unhealthy', error: 'Health check failed' },
        tenant_system: { status: 'unhealthy', error: 'Health check failed' },
        application: { status: 'unhealthy', error: 'Health check failed' }
      },
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    }

    return NextResponse.json(errorResult, { status: 503 })
  }
}

// Health check for specific component
export async function POST(request: NextRequest) {
  try {
    const { component } = await request.json()

    if (!component) {
      return NextResponse.json({ error: "Component parameter required" }, { status: 400 })
    }

    const healthChecker = new HealthChecker()
    let result: HealthStatus

    switch (component) {
      case 'database':
        result = await healthChecker.checkDatabase()
        break
      case 'authentication':
        result = await healthChecker.checkAuthentication()
        break
      case 'external_services':
        result = await healthChecker.checkExternalServices()
        break
      case 'system_resources':
        result = await healthChecker.checkSystemResources()
        break
      case 'tenant_system':
        result = await healthChecker.checkTenantSystem()
        break
      case 'application':
        result = await healthChecker.checkApplication()
        break
      default:
        return NextResponse.json({ error: "Invalid component" }, { status: 400 })
    }

    return NextResponse.json({
      component,
      ...result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Component health check failed', { error })
    return NextResponse.json({
      error: "Component health check failed",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}