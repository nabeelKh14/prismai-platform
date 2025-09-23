import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireEnv, getEnv } from '@/lib/env'
import { logger } from '@/lib/logger'
import { ApiVersioning } from '@/lib/api-versioning'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  environment: string
  service?: string
  platform?: string
  services: {
    database: {
      status: 'healthy' | 'unhealthy'
      responseTime?: number
      error?: string
    }
    vapi: {
      status: 'healthy' | 'unhealthy'
      responseTime?: number
      error?: string
    }
    gemini: {
      status: 'healthy' | 'unhealthy'
      responseTime?: number
      error?: string
    }
  }
  uptime: number
}

const startTime = Date.now()

/**
 * @swagger
 * /v1/health:
 *   get:
 *     summary: Health check endpoint (v1)
 *     description: Returns the health status of the API and its dependent services
 *     tags:
 *       - Health
 *       - v1
 *     responses:
 *       200:
 *         description: Health check results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const healthCheckToken = getEnv('HEALTH_CHECK_TOKEN')

  // Simple token-based auth for health checks
  if (healthCheckToken && token !== healthCheckToken) {
    return ApiVersioning.createVersionedResponse(
      { error: 'Unauthorized' },
      'v1',
      401
    )
  }

  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    services: {
      database: { status: 'unhealthy' },
      vapi: { status: 'unhealthy' },
      gemini: { status: 'unhealthy' },
    },
    uptime: Date.now() - startTime,
  }

  // Check database connectivity
  try {
    const dbStart = Date.now()
    const supabase = await createClient()

    // Simple query to test database connectivity
    const { error } = await supabase.from('profiles').select('id').limit(1)

    const dbResponseTime = Date.now() - dbStart

    if (error) {
      healthCheck.services.database = {
        status: 'unhealthy',
        responseTime: dbResponseTime,
        error: error.message,
      }
    } else {
      healthCheck.services.database = {
        status: 'healthy',
        responseTime: dbResponseTime,
      }
    }
  } catch (error) {
    healthCheck.services.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
    }
  }

  // Check ElevenLabs connectivity
  try {
    const vapiStart = Date.now()
    const vapiResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'GET',
      headers: {
        "xi-api-key": String(requireEnv('VAPI_API_KEY')),
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    const vapiResponseTime = Date.now() - vapiStart

    if (vapiResponse.ok || vapiResponse.status === 401) {
      // 401 is expected if we don't have access, but it means the service is up
      healthCheck.services.vapi = {
        status: 'healthy',
        responseTime: vapiResponseTime,
      }
    } else {
      healthCheck.services.vapi = {
        status: 'unhealthy',
        responseTime: vapiResponseTime,
        error: `HTTP ${vapiResponse.status}`,
      }
    }
  } catch (error) {
    healthCheck.services.vapi = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'VAPI connectivity failed',
    }
  }

  // Check Gemini connectivity
  try {
    const geminiStart = Date.now()
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${requireEnv('GEMINI_API_KEY')}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    const geminiResponseTime = Date.now() - geminiStart

    if (geminiResponse.ok) {
      healthCheck.services.gemini = {
        status: 'healthy',
        responseTime: geminiResponseTime,
      }
    } else {
      healthCheck.services.gemini = {
        status: 'unhealthy',
        responseTime: geminiResponseTime,
        error: `HTTP ${geminiResponse.status}`,
      }
    }
  } catch (error) {
    healthCheck.services.gemini = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Gemini connectivity failed',
    }
  }

  // Determine overall status
  const serviceStatuses = Object.values(healthCheck.services).map(s => s.status)
  const unhealthyServices = serviceStatuses.filter(s => s === 'unhealthy')

  if (unhealthyServices.length === 0) {
    healthCheck.status = 'healthy'
  } else if (unhealthyServices.length === serviceStatuses.length) {
    healthCheck.status = 'unhealthy'
  } else {
    healthCheck.status = 'degraded'
  }

  // Log health check results
  logger.info('PrismAI Health check completed (v1)', {
    status: healthCheck.status,
    unhealthyServices: unhealthyServices.length,
    services: Object.fromEntries(
      Object.entries(healthCheck.services).map(([name, service]) => [
        name,
        { status: service.status, responseTime: service.responseTime }
      ])
    ),
  })

  // Return appropriate HTTP status
  const httpStatus = healthCheck.status === 'healthy' ? 200 :
                    healthCheck.status === 'degraded' ? 200 : 503

  return ApiVersioning.createVersionedResponse(healthCheck, 'v1', httpStatus)
}