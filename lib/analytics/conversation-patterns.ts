import { logger } from '@/lib/logger'
import { ValidationError } from '@/lib/errors'

export interface ConversationPattern {
  patternId: string
  name: string
  description: string
  type: 'success' | 'failure' | 'escalation' | 'resolution' | 'abandonment' | 'satisfaction' | 'dissatisfaction'
  frequency: number
  confidence: number
  characteristics: {
    averageDuration: number
    messageCount: number
    sentimentProgression: string[]
    commonIntents: string[]
    commonEntities: string[]
    timeOfDay?: number[]
    dayOfWeek?: number[]
  }
  examples: Array<{
    conversationId: string
    score: number
    keyIndicators: string[]
  }>
  recommendations: string[]
  businessImpact: 'low' | 'medium' | 'high' | 'critical'
  trend: 'improving' | 'declining' | 'stable' | 'volatile'
  timestamp: string
}

export interface PatternAnalysisRequest {
  tenantId: string
  timeRange: {
    startDate: Date
    endDate: Date
  }
  filters?: {
    agentIds?: string[]
    customerSegments?: string[]
    conversationTypes?: string[]
    minMessageCount?: number
    maxMessageCount?: number
  }
  options?: {
    minPatternFrequency?: number
    minConfidence?: number
    maxPatterns?: number
    includeRecommendations?: boolean
    patternTypes?: string[]
  }
}

export interface TrendAnalysis {
  metric: string
  timeframe: string
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  changePercentage: number
  significance: 'low' | 'medium' | 'high'
  affectedPatterns: string[]
  forecast?: {
    nextPeriod: number
    confidence: number
  }
}

export interface PatternAnalytics {
  totalConversations: number
  patternsIdentified: number
  successRate: number
  averageResolutionTime: number
  topPatterns: ConversationPattern[]
  trends: TrendAnalysis[]
  insights: Array<{
    type: 'positive' | 'negative' | 'neutral'
    message: string
    impact: 'low' | 'medium' | 'high'
  }>
  recommendations: string[]
}

export interface AnomalyDetection {
  anomalyId: string
  conversationId: string
  type: 'duration' | 'sentiment' | 'escalation' | 'abandonment' | 'agent_behavior'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  expectedPattern: string
  actualPattern: string
  deviation: number
  businessImpact: string
  recommendedActions: string[]
  timestamp: string
}

class ConversationPatternAnalysisService {
  private readonly PATTERN_TYPES = [
    'success', 'failure', 'escalation', 'resolution',
    'abandonment', 'satisfaction', 'dissatisfaction'
  ] as const

  async analyzePatterns(request: PatternAnalysisRequest): Promise<ConversationPattern[]> {
    const startTime = Date.now()

    try {
      // Input validation
      if (!request.tenantId) {
        throw new ValidationError('Tenant ID is required')
      }

      if (!request.timeRange?.startDate || !request.timeRange?.endDate) {
        throw new ValidationError('Time range with start and end dates is required')
      }

      logger.info('Starting conversation pattern analysis', {
        tenantId: request.tenantId,
        startDate: request.timeRange.startDate.toISOString(),
        endDate: request.timeRange.endDate.toISOString(),
        filters: request.filters
      })

      // This would typically query a database for conversation data
      // and perform pattern analysis using statistical methods
      // For now, return mock patterns for demonstration

      const patterns = await this.identifyPatterns(request)

      // Apply filters
      const minFrequency = request.options?.minPatternFrequency || 5
      const minConfidence = request.options?.minConfidence || 0.6
      const maxPatterns = request.options?.maxPatterns || 20

      let filteredPatterns = patterns
        .filter(p => p.frequency >= minFrequency && p.confidence >= minConfidence)

      if (request.options?.patternTypes && request.options.patternTypes.length > 0) {
        filteredPatterns = filteredPatterns.filter(p =>
          request.options!.patternTypes!.includes(p.type)
        )
      }

      // Sort by business impact and confidence
      filteredPatterns = filteredPatterns
        .sort((a, b) => {
          const impactWeight = { low: 1, medium: 2, high: 3, critical: 4 }
          const aScore = impactWeight[a.businessImpact] * a.confidence
          const bScore = impactWeight[b.businessImpact] * b.confidence
          return bScore - aScore
        })
        .slice(0, maxPatterns)

      const processingTime = Date.now() - startTime

      logger.info('Conversation pattern analysis completed', {
        tenantId: request.tenantId,
        patternsFound: filteredPatterns.length,
        processingTime
      })

      return filteredPatterns

    } catch (error) {
      logger.error('Conversation pattern analysis failed', error as Error, {
        tenantId: request.tenantId
      })

      throw error
    }
  }

  async detectAnomalies(request: PatternAnalysisRequest): Promise<AnomalyDetection[]> {
    const startTime = Date.now()

    try {
      logger.info('Starting anomaly detection', {
        tenantId: request.tenantId,
        timeRange: request.timeRange
      })

      // This would typically use statistical methods and ML algorithms
      // to detect outliers and unusual patterns
      // For now, return mock anomalies

      const anomalies: AnomalyDetection[] = [
        {
          anomalyId: `anom_${Date.now()}_1`,
          conversationId: 'conv_unusual_duration',
          type: 'duration',
          severity: 'high',
          description: 'Conversation duration significantly longer than expected pattern',
          expectedPattern: 'Average 8 minutes for support conversations',
          actualPattern: '42 minutes duration',
          deviation: 425, // percentage deviation
          businessImpact: 'May indicate complex issues requiring attention',
          recommendedActions: [
            'Review conversation for escalation opportunities',
            'Check if additional training is needed',
            'Analyze for process bottlenecks'
          ],
          timestamp: new Date().toISOString()
        }
      ]

      const processingTime = Date.now() - startTime

      logger.info('Anomaly detection completed', {
        tenantId: request.tenantId,
        anomaliesFound: anomalies.length,
        processingTime
      })

      return anomalies

    } catch (error) {
      logger.error('Anomaly detection failed', error as Error, {
        tenantId: request.tenantId
      })

      throw error
    }
  }

  async getPatternAnalytics(request: PatternAnalysisRequest): Promise<PatternAnalytics> {
    const startTime = Date.now()

    try {
      // Get patterns for analysis
      const patterns = await this.analyzePatterns(request)

      // Calculate analytics
      const totalConversations = 1000 // This would come from database
      const successPatterns = patterns.filter(p => p.type === 'success')
      const successRate = successPatterns.length > 0 ?
        successPatterns.reduce((sum, p) => sum + p.frequency, 0) / totalConversations : 0

      const averageResolutionTime = patterns
        .filter(p => p.characteristics.averageDuration > 0)
        .reduce((sum, p, _, arr) => sum + p.characteristics.averageDuration, 0) / patterns.length || 0

      const trends: TrendAnalysis[] = [
        {
          metric: 'success_rate',
          timeframe: 'last_30_days',
          trend: 'increasing',
          changePercentage: 12.5,
          significance: 'medium',
          affectedPatterns: successPatterns.map(p => p.patternId)
        }
      ]

      const insights = [
        {
          type: 'positive' as const,
          message: 'Success rate has increased by 12.5% in the last 30 days',
          impact: 'medium' as const
        },
        {
          type: 'negative' as const,
          message: 'Escalation patterns show increased frequency',
          impact: 'high' as const
        }
      ]

      const recommendations = [
        'Focus training on reducing escalation frequency',
        'Review and optimize top failure patterns',
        'Scale successful conversation patterns across teams'
      ]

      const processingTime = Date.now() - startTime

      logger.info('Pattern analytics completed', {
        tenantId: request.tenantId,
        patternsAnalyzed: patterns.length,
        processingTime
      })

      return {
        totalConversations,
        patternsIdentified: patterns.length,
        successRate,
        averageResolutionTime,
        topPatterns: patterns.slice(0, 5),
        trends,
        insights,
        recommendations
      }

    } catch (error) {
      logger.error('Pattern analytics failed', error as Error, {
        tenantId: request.tenantId
      })

      throw error
    }
  }

  private async identifyPatterns(request: PatternAnalysisRequest): Promise<ConversationPattern[]> {
    // This would typically involve:
    // 1. Querying conversation data from database
    // 2. Applying clustering algorithms
    // 3. Statistical analysis for pattern detection
    // 4. Machine learning models for prediction

    // For demonstration, return mock patterns
    return [
      {
        patternId: `pattern_${Date.now()}_1`,
        name: 'Quick Resolution Pattern',
        description: 'Conversations resolved efficiently with positive sentiment throughout',
        type: 'success',
        frequency: 45,
        confidence: 0.87,
        characteristics: {
          averageDuration: 8.5,
          messageCount: 12,
          sentimentProgression: ['neutral', 'positive', 'positive'],
          commonIntents: ['support_request', 'information_request'],
          commonEntities: ['account', 'login'],
          timeOfDay: [9, 10, 11, 14, 15, 16],
          dayOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
        },
        examples: [
          {
            conversationId: 'conv_quick_001',
            score: 0.92,
            keyIndicators: ['Fast response time', 'Positive sentiment', 'Clear resolution']
          }
        ],
        recommendations: [
          'Document this pattern for training',
          'Use as template for similar conversations',
          'Identify agents who excel in this pattern'
        ],
        businessImpact: 'high',
        trend: 'stable',
        timestamp: new Date().toISOString()
      },
      {
        patternId: `pattern_${Date.now()}_2`,
        name: 'Escalation Pattern',
        description: 'Conversations that escalate from simple requests to complex issues',
        type: 'escalation',
        frequency: 23,
        confidence: 0.76,
        characteristics: {
          averageDuration: 28.3,
          messageCount: 24,
          sentimentProgression: ['neutral', 'negative', 'negative'],
          commonIntents: ['complaint', 'escalation'],
          commonEntities: ['billing', 'service'],
          timeOfDay: [13, 14, 15, 16, 17],
          dayOfWeek: [1, 2, 3, 4, 5]
        },
        examples: [
          {
            conversationId: 'conv_escalation_001',
            score: 0.84,
            keyIndicators: ['Increasing negativity', 'Multiple transfers', 'Long duration']
          }
        ],
        recommendations: [
          'Implement early warning system for escalation',
          'Provide additional training on de-escalation',
          'Review escalation procedures and thresholds'
        ],
        businessImpact: 'high',
        trend: 'volatile',
        timestamp: new Date().toISOString()
      },
      {
        patternId: `pattern_${Date.now()}_3`,
        name: 'Abandonment Pattern',
        description: 'Conversations where customers disconnect before resolution',
        type: 'abandonment',
        frequency: 18,
        confidence: 0.82,
        characteristics: {
          averageDuration: 3.2,
          messageCount: 3,
          sentimentProgression: ['neutral', 'negative'],
          commonIntents: ['inquiry', 'complaint'],
          commonEntities: ['wait_time', 'response'],
          timeOfDay: [12, 13, 17, 18],
          dayOfWeek: [1, 2, 3, 4, 5, 6] // Including Saturday
        },
        examples: [
          {
            conversationId: 'conv_abandon_001',
            score: 0.89,
            keyIndicators: ['Short duration', 'Negative sentiment', 'Early exit']
          }
        ],
        recommendations: [
          'Reduce response times during peak hours',
          'Implement callback system for busy periods',
          'Review queue management and staffing'
        ],
        businessImpact: 'medium',
        trend: 'declining',
        timestamp: new Date().toISOString()
      }
    ]
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const testRequest: PatternAnalysisRequest = {
        tenantId: 'test-tenant',
        timeRange: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          endDate: new Date()
        }
      }

      const patterns = await this.analyzePatterns(testRequest)

      return patterns.length > 0
    } catch (error) {
      logger.error('Pattern analysis health check failed', error as Error)
      return false
    }
  }

  // Get pattern types and their descriptions
  getPatternTypes(): Array<{
    type: string
    name: string
    description: string
    businessValue: string
  }> {
    return [
      {
        type: 'success',
        name: 'Success Pattern',
        description: 'Conversations that achieve positive outcomes efficiently',
        businessValue: 'Identify best practices and scale successful approaches'
      },
      {
        type: 'failure',
        name: 'Failure Pattern',
        description: 'Conversations that fail to achieve desired outcomes',
        businessValue: 'Identify root causes and implement corrective actions'
      },
      {
        type: 'escalation',
        name: 'Escalation Pattern',
        description: 'Conversations that escalate in complexity or negativity',
        businessValue: 'Improve escalation prevention and management'
      },
      {
        type: 'resolution',
        name: 'Resolution Pattern',
        description: 'How issues are typically resolved in conversations',
        businessValue: 'Optimize resolution processes and reduce handle time'
      },
      {
        type: 'abandonment',
        name: 'Abandonment Pattern',
        description: 'Conversations where customers disconnect before resolution',
        businessValue: 'Reduce abandonment rates and improve satisfaction'
      }
    ]
  }
}

// Export singleton instance
export const conversationPatternAnalysisService = new ConversationPatternAnalysisService()