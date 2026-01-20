import { NextRequest, NextResponse } from "next/server"
import { pipelineOrchestrator, TenantConfig } from "@/lib/conversation/pipeline/orchestrator"
import { messageIngestionService } from "@/lib/conversation/pipeline/message-ingestion"
import { realTimeProcessor } from "@/lib/conversation/pipeline/real-time-processor"
import { conversationAnalysisHandler } from "@/lib/websocket/conversation-analysis-handler"
import { conversationIntelligenceMonitor } from "@/lib/monitoring/conversation-intelligence-monitor"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    const tenantId = searchParams.get('tenant_id')

    switch (endpoint) {
      case 'health':
        return await getPipelineHealth(tenantId || 'default')

      case 'metrics':
        return await getPipelineMetrics(tenantId || 'default')

      case 'config':
        return await getTenantConfig(tenantId || 'default')

      case 'stats':
        return await getComponentStats()

      default:
        return NextResponse.json({
          error: "Invalid endpoint. Available: health, metrics, config, stats"
        }, { status: 400 })
    }
  } catch (error) {
    logger.error('Error in conversation pipeline API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, tenant_id, config } = body

    switch (action) {
      case 'configure_tenant':
        return await configureTenant(tenant_id, config)

      case 'reset_metrics':
        return await resetPipelineMetrics(tenant_id)

      case 'trigger_health_check':
        return await triggerHealthCheck(tenant_id)

      case 'cleanup':
        return await cleanupPipeline()

      default:
        return NextResponse.json({
          error: "Invalid action. Available: configure_tenant, reset_metrics, trigger_health_check, cleanup"
        }, { status: 400 })
    }
  } catch (error) {
    logger.error('Error in conversation pipeline POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function getPipelineHealth(tenantId: string) {
  try {
    const health = await pipelineOrchestrator.getHealth()

    // Add tenant-specific information
    const tenantConfig = getTenantConfigFromMemory(tenantId)

    return NextResponse.json({
      ...health,
      tenant_id: tenantId,
      tenant_config: tenantConfig,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to get pipeline health', error as Error, { tenantId })
    return NextResponse.json({
      error: "Failed to get pipeline health",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function getPipelineMetrics(tenantId: string) {
  try {
    // Collect metrics from all components
    const processingStats = realTimeProcessor.getProcessingStats()
    const connectionStats = conversationAnalysisHandler.getConnectionStats()
    const ingestionStats = messageIngestionService.getQueueStats()
    const monitorMetrics = conversationIntelligenceMonitor.getMetrics()

    // Calculate derived metrics
    const totalMessages = ingestionStats.total
    const successRate = totalMessages > 0
      ? ((totalMessages - ingestionStats.failed) / totalMessages) * 100
      : 0

    const averageEndToEndLatency = processingStats.averageProcessingTime

    return NextResponse.json({
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),

      // Component metrics
      ingestion: {
        queue_size: ingestionStats.total,
        pending: ingestionStats.pending,
        processing: ingestionStats.processing,
        completed: ingestionStats.completed,
        failed: ingestionStats.failed,
        by_channel: ingestionStats.byChannel,
        by_priority: ingestionStats.byPriority
      },

      processing: {
        total_processed: processingStats.totalProcessed,
        cache_hit_rate: processingStats.cacheHitRate,
        average_processing_time: processingStats.averageProcessingTime,
        error_rate: processingStats.errorRate,
        active_analyses: processingStats.activeAnalyses,
        cache_size: processingStats.cacheSize
      },

      websocket: {
        total_connections: connectionStats.totalConnections,
        active_connections: connectionStats.activeConnections,
        subscriptions: connectionStats.subscriptions,
        queued_messages: connectionStats.queuedMessages,
        rate_limited_clients: connectionStats.rateLimitedClients
      },

      monitoring: {
        total_analyses: monitorMetrics.totalAnalyses,
        successful_analyses: monitorMetrics.successfulAnalyses,
        failed_analyses: monitorMetrics.failedAnalyses,
        average_processing_time: monitorMetrics.averageProcessingTime,
        emotion_accuracy: monitorMetrics.emotionDetectionAccuracy,
        intent_accuracy: monitorMetrics.intentClassificationAccuracy,
        api_calls: monitorMetrics.apiCallCount,
        api_errors: monitorMetrics.apiErrorCount,
        cache_hit_rate: monitorMetrics.cacheHitRate,
        tenant_usage: monitorMetrics.tenantUsage
      },

      // Derived metrics
      derived: {
        success_rate: successRate,
        average_end_to_end_latency: averageEndToEndLatency,
        messages_per_second: totalMessages > 0 ? totalMessages / (Date.now() / 1000) : 0,
        throughput_efficiency: successRate * (1 - processingStats.errorRate)
      }
    })
  } catch (error) {
    logger.error('Failed to get pipeline metrics', error as Error, { tenantId })
    return NextResponse.json({
      error: "Failed to get pipeline metrics",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function getTenantConfig(tenantId: string) {
  try {
    const config = getTenantConfigFromMemory(tenantId)

    if (!config) {
      return NextResponse.json({
        error: "Tenant configuration not found"
      }, { status: 404 })
    }

    return NextResponse.json({
      tenant_id: tenantId,
      config,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to get tenant config', error as Error, { tenantId })
    return NextResponse.json({
      error: "Failed to get tenant configuration",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function getComponentStats() {
  try {
    const processingStats = realTimeProcessor.getProcessingStats()
    const connectionStats = conversationAnalysisHandler.getConnectionStats()
    const ingestionStats = messageIngestionService.getQueueStats()

    return NextResponse.json({
      timestamp: new Date().toISOString(),

      ingestion: {
        status: 'healthy',
        queue_stats: ingestionStats,
        health_score: ingestionStats.failed / Math.max(ingestionStats.total, 1) < 0.1 ? 100 : 50
      },

      processing: {
        status: processingStats.errorRate < 0.1 ? 'healthy' : 'degraded',
        performance_stats: processingStats,
        health_score: Math.max(0, 100 - (processingStats.errorRate * 1000))
      },

      websocket: {
        status: connectionStats.queuedMessages < 50 ? 'healthy' : 'degraded',
        connection_stats: connectionStats,
        health_score: connectionStats.activeConnections > 0 ? 100 : 0
      },

      overall: {
        status: 'healthy',
        total_components: 3,
        healthy_components: 3,
        uptime: process.uptime()
      }
    })
  } catch (error) {
    logger.error('Failed to get component stats', error as Error)
    return NextResponse.json({
      error: "Failed to get component statistics",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function configureTenant(tenantId: string, config: Partial<TenantConfig>) {
  try {
    if (!tenantId) {
      return NextResponse.json({
        error: "Tenant ID is required"
      }, { status: 400 })
    }

    // Merge with default configuration
    const defaultConfig: TenantConfig = {
      tenantId,
      enabled: true,
      rateLimit: 1000,
      maxConcurrentAnalyses: 50,
      enableCaching: true,
      cacheTtl: 300000, // 5 minutes
      priority: 'normal',
      features: {
        emotionDetection: true,
        intentClassification: true,
        realTimeProcessing: true,
        batchProcessing: false
      }
    }

    const fullConfig: TenantConfig = {
      ...defaultConfig,
      ...config,
      tenantId
    }

    // Configure tenant in orchestrator
    pipelineOrchestrator.configureTenant(fullConfig)

    logger.info('Tenant configuration updated', {
      tenantId,
      config: fullConfig
    })

    return NextResponse.json({
      success: true,
      tenant_id: tenantId,
      config: fullConfig,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to configure tenant', error as Error, { tenantId })
    return NextResponse.json({
      error: "Failed to configure tenant",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function resetPipelineMetrics(tenantId?: string) {
  try {
    // Reset metrics in all components
    realTimeProcessor.cleanupCache()
    conversationIntelligenceMonitor.resetMetrics()

    // Clean up old messages
    const cleanedMessages = messageIngestionService.cleanup()
    const cleanedConnections = conversationAnalysisHandler.cleanupInactiveConnections()

    logger.info('Pipeline metrics reset', {
      tenantId,
      cleanedMessages,
      cleanedConnections
    })

    return NextResponse.json({
      success: true,
      actions: [
        'Processing cache cleared',
        'Monitor metrics reset',
        'Old messages cleaned up',
        'Inactive connections removed'
      ],
      cleaned_messages: cleanedMessages,
      cleaned_connections: cleanedConnections,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to reset pipeline metrics', error as Error, { tenantId })
    return NextResponse.json({
      error: "Failed to reset pipeline metrics",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function triggerHealthCheck(tenantId?: string) {
  try {
    const health = await pipelineOrchestrator.getHealth()

    // Run individual component health checks
    const componentHealth = {
      ingestion: await messageIngestionService.healthCheck(),
      processing: await realTimeProcessor.healthCheck(),
      websocket: await conversationAnalysisHandler.healthCheck(),
      monitor: (await conversationIntelligenceMonitor.healthCheck()).healthy
    }

    return NextResponse.json({
      success: true,
      tenant_id: tenantId,
      overall_health: health,
      component_health: componentHealth,
      recommendations: health.issues.length > 0 ? health.issues : ['All systems operational'],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to trigger health check', error as Error, { tenantId })
    return NextResponse.json({
      error: "Failed to trigger health check",
      details: (error as Error).message
    }, { status: 500 })
  }
}

async function cleanupPipeline() {
  try {
    // Perform comprehensive cleanup
    const cleanedCache = realTimeProcessor.cleanupCache()
    const cleanedMessages = messageIngestionService.cleanup()
    const cleanedConnections = conversationAnalysisHandler.cleanupInactiveConnections()

    // Reset any failed states
    pipelineOrchestrator.cleanup()

    logger.info('Pipeline cleanup completed', {
      cleanedCache,
      cleanedMessages,
      cleanedConnections
    })

    return NextResponse.json({
      success: true,
      cleanup_actions: [
        'Cache entries cleaned',
        'Old messages removed',
        'Inactive connections closed',
        'Pipeline state reset'
      ],
      cleaned_cache: cleanedCache,
      cleaned_messages: cleanedMessages,
      cleaned_connections: cleanedConnections,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to cleanup pipeline', error as Error)
    return NextResponse.json({
      error: "Failed to cleanup pipeline",
      details: (error as Error).message
    }, { status: 500 })
  }
}

// Helper function to get tenant config from memory
// In a real implementation, this would fetch from database
function getTenantConfigFromMemory(tenantId: string): TenantConfig | null {
  // Return a default configuration for now
  // In production, this would be stored in database or cache
  return {
    tenantId,
    enabled: true,
    rateLimit: 1000,
    maxConcurrentAnalyses: 50,
    enableCaching: true,
    cacheTtl: 300000,
    priority: 'normal',
    features: {
      emotionDetection: true,
      intentClassification: true,
      realTimeProcessing: true,
      batchProcessing: false
    }
  }
}