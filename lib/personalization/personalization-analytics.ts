/**
 * Personalization Analytics and Monitoring
 * Comprehensive analytics and monitoring system for the personalization engine
 */

import { createClient } from '@/lib/supabase/server'
import { geminiClient } from '@/lib/ai/gemini-client'
import { logger } from '@/lib/logger'

export interface PersonalizationMetrics {
  userId: string
  date: Date
  totalLeads: number
  personalizedSequences: number
  behavioralTriggers: number
  contentAdaptations: number
  humanLikeEngagements: number
  followupOptimizations: number
  avgEngagementScore: number
  conversionRate: number
  personalizationROI: number
  channelPerformance: Record<string, ChannelMetrics>
  sequencePerformance: SequenceMetrics
  triggerPerformance: TriggerMetrics
  contentPerformance: ContentMetrics
}

export interface ChannelMetrics {
  channel: string
  totalSent: number
  openRate: number
  clickRate: number
  responseRate: number
  conversionRate: number
  avgResponseTime: number
  effectiveness: number
}

export interface SequenceMetrics {
  totalSequences: number
  activeSequences: number
  completedSequences: number
  avgCompletionRate: number
  avgEngagementScore: number
  topPerformingSequences: string[]
  underperformingSequences: string[]
}

export interface TriggerMetrics {
  totalTriggers: number
  activeTriggers: number
  avgTriggerFrequency: number
  mostEffectiveTriggers: string[]
  triggerAccuracy: number
  falsePositiveRate: number
}

export interface ContentMetrics {
  totalContentPieces: number
  adaptationRate: number
  avgAdaptationConfidence: number
  contentEffectiveness: Record<string, number>
  topicPerformance: Record<string, number>
  lengthPerformance: Record<string, number>
}

export interface AnalyticsReport {
  id: string
  userId: string
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom'
  dateRange: { start: Date; end: Date }
  metrics: PersonalizationMetrics
  insights: AnalyticsInsight[]
  recommendations: AnalyticsRecommendation[]
  generatedAt: Date
}

export interface AnalyticsInsight {
  id: string
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  confidence: number
  data: Record<string, any>
  timestamp: Date
}

export interface AnalyticsRecommendation {
  id: string
  category: 'content' | 'timing' | 'channel' | 'frequency' | 'personalization'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  expectedImpact: number
  implementationEffort: 'low' | 'medium' | 'high'
  steps: string[]
  timestamp: Date
}

export interface PerformanceBenchmark {
  metric: string
  currentValue: number
  targetValue: number
  industryAverage: number
  lastPeriodValue: number
  trend: 'improving' | 'declining' | 'stable'
  status: 'on_track' | 'needs_attention' | 'critical'
}

export class PersonalizationAnalytics {
  private static instance: PersonalizationAnalytics
  private metricsCache: Map<string, PersonalizationMetrics> = new Map()
  private insightsCache: Map<string, AnalyticsInsight[]> = new Map()

  constructor() {}

  static getInstance(): PersonalizationAnalytics {
    if (!PersonalizationAnalytics.instance) {
      PersonalizationAnalytics.instance = new PersonalizationAnalytics()
    }
    return PersonalizationAnalytics.instance
  }

  /**
   * Initialize analytics system for a user
   */
  async initialize(userId: string): Promise<void> {
    try {
      logger.info('Initializing personalization analytics', { userId })

      // Load cached metrics
      await this.loadCachedMetrics(userId)

      logger.info('Personalization analytics initialized', { userId })
    } catch (error) {
      logger.error('Error initializing personalization analytics', error as Error, { userId })
      throw error
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(
    userId: string,
    reportType: 'daily' | 'weekly' | 'monthly' | 'custom',
    dateRange?: { start: Date; end: Date }
  ): Promise<AnalyticsReport> {
    try {
      // Calculate date range
      const endDate = new Date()
      const startDate = dateRange?.start || this.getDefaultStartDate(reportType, endDate)

      // Collect metrics
      const metrics = await this.collectMetrics(userId, startDate, endDate)

      // Generate insights
      const insights = await this.generateInsights(userId, metrics, startDate, endDate)

      // Generate recommendations
      const recommendations = await this.generateRecommendations(userId, metrics, insights)

      const report: AnalyticsReport = {
        id: crypto.randomUUID(),
        userId,
        reportType,
        dateRange: { start: startDate, end: endDate },
        metrics,
        insights,
        recommendations,
        generatedAt: new Date()
      }

      // Cache report
      await this.cacheReport(report, userId)

      logger.info('Generated analytics report', {
        userId,
        reportType,
        dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
        insightsCount: insights.length,
        recommendationsCount: recommendations.length
      })

      return report
    } catch (error) {
      logger.error('Error generating analytics report', error as Error, { userId, reportType })
      throw error
    }
  }

  /**
   * Get real-time metrics dashboard
   */
  async getRealtimeMetrics(userId: string): Promise<PersonalizationMetrics> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      return await this.collectMetrics(userId, today, new Date())
    } catch (error) {
      logger.error('Error getting realtime metrics', error as Error, { userId })
      return this.getDefaultMetrics(userId)
    }
  }

  /**
   * Analyze personalization performance trends
   */
  async analyzeTrends(
    userId: string,
    metric: string,
    days: number = 30
  ): Promise<TrendAnalysis> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      const historicalData = await this.getHistoricalData(userId, metric, startDate, endDate)

      // Perform trend analysis
      const analysis = await this.performTrendAnalysis(historicalData, metric)

      return {
        metric,
        period: { start: startDate, end: endDate },
        dataPoints: historicalData.length,
        trend: analysis.trend,
        slope: analysis.slope,
        confidence: analysis.confidence,
        predictions: analysis.predictions,
        insights: analysis.insights
      }
    } catch (error) {
      logger.error('Error analyzing trends', error as Error, { userId, metric, days })
      return this.getDefaultTrendAnalysis(metric)
    }
  }

  /**
   * Identify performance anomalies
   */
  async identifyAnomalies(
    userId: string,
    sensitivity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<AnomalyDetection[]> {
    try {
      const metrics = await this.getRealtimeMetrics(userId)
      const historicalData = await this.getHistoricalData(userId, 'all', this.getDefaultStartDate('monthly'), new Date())

      const anomalies = await this.detectAnomalies(metrics, historicalData, sensitivity)

      return anomalies
    } catch (error) {
      logger.error('Error identifying anomalies', error as Error, { userId, sensitivity })
      return []
    }
  }

  /**
   * Generate performance benchmarks
   */
  async generateBenchmarks(userId: string): Promise<PerformanceBenchmark[]> {
    try {
      const metrics = await this.getRealtimeMetrics(userId)
      const industryAverages = await this.getIndustryAverages()

      const benchmarks: PerformanceBenchmark[] = []

      // Generate benchmarks for key metrics
      benchmarks.push(this.createBenchmark(
        'conversion_rate',
        metrics.conversionRate,
        0.05, // 5% target
        industryAverages.conversionRate,
        0.03, // Previous period
        metrics.conversionRate > 0.04 ? 'improving' : 'declining',
        metrics.conversionRate >= 0.05 ? 'on_track' : 'needs_attention'
      ))

      benchmarks.push(this.createBenchmark(
        'engagement_score',
        metrics.avgEngagementScore,
        70,
        industryAverages.engagementScore,
        65,
        metrics.avgEngagementScore > 65 ? 'improving' : 'declining',
        metrics.avgEngagementScore >= 70 ? 'on_track' : 'needs_attention'
      ))

      benchmarks.push(this.createBenchmark(
        'personalization_roi',
        metrics.personalizationROI,
        3.0, // 3x ROI target
        industryAverages.personalizationROI,
        2.5,
        metrics.personalizationROI > 2.5 ? 'improving' : 'declining',
        metrics.personalizationROI >= 3.0 ? 'on_track' : 'needs_attention'
      ))

      return benchmarks
    } catch (error) {
      logger.error('Error generating benchmarks', error as Error, { userId })
      return []
    }
  }

  /**
   * Get personalization effectiveness score
   */
  async getEffectivenessScore(userId: string): Promise<EffectivenessScore> {
    try {
      const metrics = await this.getRealtimeMetrics(userId)
      const benchmarks = await this.generateBenchmarks(userId)

      // Calculate overall effectiveness
      const score = this.calculateEffectivenessScore(metrics, benchmarks)

      // Generate score breakdown
      const breakdown = this.generateScoreBreakdown(metrics, benchmarks)

      return {
        overallScore: score,
        breakdown,
        lastUpdated: new Date(),
        trend: score > 70 ? 'improving' : score > 50 ? 'stable' : 'declining',
        recommendations: await this.generateEffectivenessRecommendations(score, breakdown)
      }
    } catch (error) {
      logger.error('Error getting effectiveness score', error as Error, { userId })
      return this.getDefaultEffectivenessScore()
    }
  }

  // Private helper methods

  private async collectMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PersonalizationMetrics> {
    try {
      const supabase = await createClient()

      // Collect data from various tables
      const [
        leadsData,
        sequencesData,
        triggersData,
        adaptationsData,
        engagementsData,
        followupsData
      ] = await Promise.all([
        this.getLeadsMetrics(userId, startDate, endDate),
        this.getSequencesMetrics(userId, startDate, endDate),
        this.getTriggersMetrics(userId, startDate, endDate),
        this.getContentAdaptationsMetrics(userId, startDate, endDate),
        this.getEngagementMetrics(userId, startDate, endDate),
        this.getFollowupMetrics(userId, startDate, endDate)
      ])

      const metrics: PersonalizationMetrics = {
        userId,
        date: new Date(),
        totalLeads: leadsData.total,
        personalizedSequences: sequencesData.total,
        behavioralTriggers: triggersData.total,
        contentAdaptations: adaptationsData.total,
        humanLikeEngagements: engagementsData.total,
        followupOptimizations: followupsData.total,
        avgEngagementScore: leadsData.avgEngagement,
        conversionRate: leadsData.conversionRate,
        personalizationROI: this.calculateROI(leadsData, sequencesData, triggersData),
        channelPerformance: await this.getChannelPerformance(userId, startDate, endDate),
        sequencePerformance: sequencesData,
        triggerPerformance: triggersData,
        contentPerformance: adaptationsData
      }

      return metrics
    } catch (error) {
      logger.error('Error collecting metrics', error as Error, { userId, startDate: startDate.toISOString(), endDate: endDate.toISOString() })
      return this.getDefaultMetrics(userId)
    }
  }

  private async getLeadsMetrics(userId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const supabase = await createClient()

      const { data: leads } = await supabase
        .from('leads')
        .select('id, lead_score, engagement_score, status, created_at, updated_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      const total = leads?.length || 0
      const avgEngagement = leads ? leads.reduce((sum, lead) => sum + (lead.engagement_score || 0), 0) / total : 0
      const converted = leads?.filter(lead => lead.status === 'converted').length || 0
      const conversionRate = total > 0 ? converted / total : 0

      return { total, avgEngagement, conversionRate }
    } catch (error) {
      logger.error('Error getting leads metrics', error as Error, { userId })
      return { total: 0, avgEngagement: 0, conversionRate: 0 }
    }
  }

  private async getSequencesMetrics(userId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const supabase = await createClient()

      const { data: sequences } = await supabase
        .from('nurturing_sequences')
        .select('id, status, performance, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      const total = sequences?.length || 0
      const active = sequences?.filter(s => s.status === 'active').length || 0
      const completed = sequences?.filter(s => s.status === 'completed').length || 0
      const avgCompletionRate = completed / total || 0

      return {
        totalSequences: total,
        activeSequences: active,
        completedSequences: completed,
        avgCompletionRate
      }
    } catch (error) {
      logger.error('Error getting sequences metrics', error as Error, { userId })
      return { totalSequences: 0, activeSequences: 0, completedSequences: 0, avgCompletionRate: 0 }
    }
  }

  private async getTriggersMetrics(userId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const supabase = await createClient()

      const { data: triggers } = await supabase
        .from('behavioral_triggers')
        .select('id, is_active, created_at')
        .eq('user_id', userId)

      const { data: executions } = await supabase
        .from('trigger_executions')
        .select('id, success, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      const total = triggers?.length || 0
      const active = triggers?.filter(t => t.is_active).length || 0
      const executionsTotal = executions?.length || 0
      const successfulExecutions = executions?.filter(e => e.success).length || 0
      const triggerAccuracy = executionsTotal > 0 ? successfulExecutions / executionsTotal : 0

      return {
        totalTriggers: total,
        activeTriggers: active,
        avgTriggerFrequency: executionsTotal,
        triggerAccuracy
      }
    } catch (error) {
      logger.error('Error getting triggers metrics', error as Error, { userId })
      return { totalTriggers: 0, activeTriggers: 0, avgTriggerFrequency: 0, triggerAccuracy: 0 }
    }
  }

  private async getContentAdaptationsMetrics(userId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const supabase = await createClient()

      const { data: adaptations } = await supabase
        .from('content_adaptation_strategies')
        .select('id, confidence_score, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      const total = adaptations?.length || 0
      const avgConfidence = adaptations ? adaptations.reduce((sum, a) => sum + a.confidence_score, 0) / total : 0

      return {
        totalContentPieces: total,
        adaptationRate: total,
        avgAdaptationConfidence: avgConfidence
      }
    } catch (error) {
      logger.error('Error getting content adaptations metrics', error as Error, { userId })
      return { totalContentPieces: 0, adaptationRate: 0, avgAdaptationConfidence: 0 }
    }
  }

  private async getEngagementMetrics(userId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const supabase = await createClient()

      const { data: engagements } = await supabase
        .from('human_like_engagements')
        .select('id, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      return { total: engagements?.length || 0 }
    } catch (error) {
      logger.error('Error getting engagement metrics', error as Error, { userId })
      return { total: 0 }
    }
  }

  private async getFollowupMetrics(userId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const supabase = await createClient()

      const { data: followups } = await supabase
        .from('scheduled_followups')
        .select('id, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      return { total: followups?.length || 0 }
    } catch (error) {
      logger.error('Error getting followup metrics', error as Error, { userId })
      return { total: 0 }
    }
  }

  private async getChannelPerformance(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, ChannelMetrics>> {
    try {
      const supabase = await createClient()

      const { data: performances } = await supabase
        .from('content_performance')
        .select('content_type, engagement_score, performance_metrics, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      const channelMetrics: Record<string, ChannelMetrics> = {}

      if (performances) {
        const byChannel = performances.reduce((acc, p) => {
          const channel = p.content_type || 'unknown'
          if (!acc[channel]) acc[channel] = []
          acc[channel].push(p)
          return acc
        }, {} as Record<string, any[]>)

        for (const [channel, items] of Object.entries(byChannel)) {
          const total = items.length
          const avgEngagement = items.reduce((sum, item) => sum + (item.engagement_score || 0), 0) / total
          const avgMetrics = items.reduce((acc, item) => {
            const metrics = item.performance_metrics || {}
            return {
              openRate: (acc.openRate || 0) + (metrics.openRate || 0),
              clickRate: (acc.clickRate || 0) + (metrics.clickRate || 0),
              responseRate: (acc.responseRate || 0) + (metrics.responseRate || 0),
              conversionRate: (acc.conversionRate || 0) + (metrics.conversionRate || 0),
              avgResponseTime: (acc.avgResponseTime || 0) + (metrics.avgResponseTime || 0)
            }
          }, { openRate: 0, clickRate: 0, responseRate: 0, conversionRate: 0, avgResponseTime: 0 })

          channelMetrics[channel] = {
            channel,
            totalSent: total,
            openRate: avgMetrics.openRate / total,
            clickRate: avgMetrics.clickRate / total,
            responseRate: avgMetrics.responseRate / total,
            conversionRate: avgMetrics.conversionRate / total,
            avgResponseTime: avgMetrics.avgResponseTime / total,
            effectiveness: (avgMetrics.openRate + avgMetrics.clickRate + avgMetrics.responseRate) / 3
          }
        }
      }

      return channelMetrics
    } catch (error) {
      logger.error('Error getting channel performance', error as Error, { userId })
      return {}
    }
  }

  private calculateROI(leadsData: any, sequencesData: any, triggersData: any): number {
    // Simple ROI calculation - in production would be more sophisticated
    const revenue = leadsData.conversionRate * leadsData.total * 100 // Assuming $100 average deal size
    const cost = (sequencesData.totalSequences + triggersData.totalTriggers) * 10 // Assuming $10 per sequence/trigger
    return cost > 0 ? revenue / cost : 0
  }

  private async generateInsights(
    userId: string,
    metrics: PersonalizationMetrics,
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsInsight[]> {
    const insights: AnalyticsInsight[] = []

    try {
      // Generate insights using AI
      const prompt = `
        Generate insights from personalization metrics:

        Metrics: ${JSON.stringify(metrics)}
        Period: ${startDate.toISOString()} to ${endDate.toISOString()}

        Identify:
        1. Key trends and patterns
        2. Anomalies or outliers
        3. Opportunities for improvement
        4. Risk factors

        Return JSON array of insights with type, title, description, impact, and confidence.
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })

      const insightsData = JSON.parse(response.choices[0].message.content)

      for (const insight of insightsData) {
        insights.push({
          id: crypto.randomUUID(),
          type: insight.type,
          title: insight.title,
          description: insight.description,
          impact: insight.impact,
          confidence: insight.confidence,
          data: insight.data || {},
          timestamp: new Date()
        })
      }
    } catch (error) {
      logger.error('Error generating insights', error as Error, { userId })
    }

    return insights
  }

  private async generateRecommendations(
    userId: string,
    metrics: PersonalizationMetrics,
    insights: AnalyticsInsight[]
  ): Promise<AnalyticsRecommendation[]> {
    const recommendations: AnalyticsRecommendation[] = []

    try {
      // Generate recommendations using AI
      const prompt = `
        Generate recommendations based on metrics and insights:

        Metrics: ${JSON.stringify(metrics)}
        Insights: ${JSON.stringify(insights)}

        Provide actionable recommendations for:
        1. Content optimization
        2. Timing improvements
        3. Channel optimization
        4. Frequency adjustments
        5. Personalization enhancements

        Return JSON array of recommendations with category, title, description, priority, expectedImpact, implementationEffort, and steps.
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4
      })

      const recommendationsData = JSON.parse(response.choices[0].message.content)

      for (const rec of recommendationsData) {
        recommendations.push({
          id: crypto.randomUUID(),
          category: rec.category,
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          expectedImpact: rec.expectedImpact,
          implementationEffort: rec.implementationEffort,
          steps: rec.steps || [],
          timestamp: new Date()
        })
      }
    } catch (error) {
      logger.error('Error generating recommendations', error as Error, { userId })
    }

    return recommendations
  }

  private getDefaultStartDate(reportType: string, endDate: Date = new Date()): Date {
    const end = new Date(endDate)

    switch (reportType) {
      case 'daily':
        return new Date(end.getTime() - 24 * 60 * 60 * 1000)
      case 'weekly':
        return new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
      case 'monthly':
        return new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
      default:
        return new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
  }

  private getDefaultMetrics(userId: string): PersonalizationMetrics {
    return {
      userId,
      date: new Date(),
      totalLeads: 0,
      personalizedSequences: 0,
      behavioralTriggers: 0,
      contentAdaptations: 0,
      humanLikeEngagements: 0,
      followupOptimizations: 0,
      avgEngagementScore: 0,
      conversionRate: 0,
      personalizationROI: 0,
      channelPerformance: {},
      sequencePerformance: {
        totalSequences: 0,
        activeSequences: 0,
        completedSequences: 0,
        avgCompletionRate: 0,
        avgEngagementScore: 0,
        topPerformingSequences: [],
        underperformingSequences: []
      },
      triggerPerformance: {
        totalTriggers: 0,
        activeTriggers: 0,
        avgTriggerFrequency: 0,
        mostEffectiveTriggers: [],
        triggerAccuracy: 0,
        falsePositiveRate: 0
      },
      contentPerformance: {
        totalContentPieces: 0,
        adaptationRate: 0,
        avgAdaptationConfidence: 0,
        contentEffectiveness: {},
        topicPerformance: {},
        lengthPerformance: {}
      }
    }
  }

  private async loadCachedMetrics(userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: metrics } = await supabase
        .from('personalization_metrics')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30)

      for (const metric of metrics || []) {
        const cacheKey = `${userId}:${metric.date}`
        this.metricsCache.set(cacheKey, metric as PersonalizationMetrics)
      }
    } catch (error) {
      logger.error('Error loading cached metrics', error as Error, { userId })
    }
  }

  private async cacheReport(report: AnalyticsReport, userId: string): Promise<void> {
    try {
      const supabase = await createClient()

      await supabase
        .from('analytics_reports')
        .insert({
          id: report.id,
          user_id: userId,
          report_type: report.reportType,
          date_range: report.dateRange,
          metrics: report.metrics,
          insights: report.insights,
          recommendations: report.recommendations,
          generated_at: report.generatedAt
        })
    } catch (error) {
      logger.error('Error caching report', error as Error, { reportId: report.id })
    }
  }

  private async getHistoricalData(
    userId: string,
    metric: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const supabase = await createClient()

      const { data: metrics } = await supabase
        .from('personalization_metrics')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('date', { ascending: true })

      return metrics || []
    } catch (error) {
      logger.error('Error getting historical data', error as Error, { userId, metric })
      return []
    }
  }

  private async performTrendAnalysis(historicalData: any[], metric: string): Promise<any> {
    // Simple trend analysis - in production would use statistical methods
    if (historicalData.length < 2) {
      return {
        trend: 'stable',
        slope: 0,
        confidence: 0.5,
        predictions: [],
        insights: ['Insufficient data for trend analysis']
      }
    }

    const values = historicalData.map(d => d[metric] || 0)
    const slope = this.calculateSlope(values)
    const trend = slope > 0.1 ? 'improving' : slope < -0.1 ? 'declining' : 'stable'

    return {
      trend,
      slope,
      confidence: 0.7,
      predictions: [],
      insights: [`${metric} is ${trend} with slope ${slope.toFixed(3)}`]
    }
  }

  private calculateSlope(values: number[]): number {
    const n = values.length
    if (n < 2) return 0

    const sumX = (n * (n - 1)) / 2
    const sumY = values.reduce((sum, val) => sum + val, 0)
    const sumXY = values.reduce((sum, val, idx) => sum + val * idx, 0)
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  }

  private async detectAnomalies(
    currentMetrics: PersonalizationMetrics,
    historicalData: any[],
    sensitivity: string
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = []

    try {
      // Simple anomaly detection based on standard deviations
      const threshold = sensitivity === 'high' ? 2 : sensitivity === 'medium' ? 2.5 : 3

      for (const metric of ['conversionRate', 'avgEngagementScore', 'personalizationROI']) {
        const values = historicalData.map(d => d[metric] || 0)
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length
        const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length)

        const currentValue = currentMetrics[metric as keyof PersonalizationMetrics] as number
        const zScore = Math.abs((currentValue - mean) / stdDev)

        if (zScore > threshold) {
          anomalies.push({
            id: crypto.randomUUID(),
            metric,
            currentValue,
            expectedValue: mean,
            deviation: zScore,
            severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
            description: `${metric} shows unusual deviation of ${zScore.toFixed(2)} standard deviations`,
            timestamp: new Date()
          })
        }
      }
    } catch (error) {
      logger.error('Error detecting anomalies', error as Error)
    }

    return anomalies
  }

  private async getIndustryAverages(): Promise<any> {
    // In production, this would fetch from industry benchmark database
    return {
      conversionRate: 0.03,
      engagementScore: 65,
      personalizationROI: 2.8
    }
  }

  private createBenchmark(
    metric: string,
    currentValue: number,
    targetValue: number,
    industryAverage: number,
    lastPeriodValue: number,
    trend: 'improving' | 'declining' | 'stable',
    status: 'on_track' | 'needs_attention' | 'critical'
  ): PerformanceBenchmark {
    return {
      metric,
      currentValue,
      targetValue,
      industryAverage,
      lastPeriodValue,
      trend,
      status
    }
  }

  private calculateEffectivenessScore(
    metrics: PersonalizationMetrics,
    benchmarks: PerformanceBenchmark[]
  ): number {
    // Calculate overall effectiveness score (0-100)
    let score = 0

    // Conversion rate contribution (30%)
    const conversionScore = Math.min((metrics.conversionRate / 0.05) * 100, 100) * 0.3
    score += conversionScore

    // Engagement score contribution (25%)
    const engagementScore = Math.min((metrics.avgEngagementScore / 70) * 100, 100) * 0.25
    score += engagementScore

    // ROI contribution (20%)
    const roiScore = Math.min((metrics.personalizationROI / 3.0) * 100, 100) * 0.2
    score += roiScore

    // Activity contribution (15%)
    const activityScore = Math.min((metrics.personalizedSequences / 100) * 100, 100) * 0.15
    score += activityScore

    // Quality contribution (10%)
    const qualityScore = (metrics.triggerPerformance.triggerAccuracy * 100) * 0.1
    score += qualityScore

    return Math.round(score)
  }

  private generateScoreBreakdown(
    metrics: PersonalizationMetrics,
    benchmarks: PerformanceBenchmark[]
  ): Record<string, number> {
    return {
      conversion: Math.min((metrics.conversionRate / 0.05) * 100, 100),
      engagement: Math.min((metrics.avgEngagementScore / 70) * 100, 100),
      roi: Math.min((metrics.personalizationROI / 3.0) * 100, 100),
      activity: Math.min((metrics.personalizedSequences / 100) * 100, 100),
      quality: metrics.triggerPerformance.triggerAccuracy * 100
    }
  }

  private async generateEffectivenessRecommendations(
    overallScore: number,
    breakdown: Record<string, number>
  ): Promise<string[]> {
    const recommendations: string[] = []

    if (breakdown.conversion < 60) {
      recommendations.push('Focus on improving conversion rates through better lead qualification')
    }

    if (breakdown.engagement < 60) {
      recommendations.push('Increase engagement through more personalized content and timing')
    }

    if (breakdown.roi < 60) {
      recommendations.push('Optimize personalization strategies to improve ROI')
    }

    if (breakdown.activity < 60) {
      recommendations.push('Increase personalization activity and sequence creation')
    }

    if (breakdown.quality < 60) {
      recommendations.push('Improve trigger accuracy and reduce false positives')
    }

    return recommendations
  }

  private getDefaultEffectivenessScore(): EffectivenessScore {
    return {
      overallScore: 50,
      breakdown: {
        conversion: 50,
        engagement: 50,
        roi: 50,
        activity: 50,
        quality: 50
      },
      lastUpdated: new Date(),
      trend: 'stable',
      recommendations: ['Complete setup to get accurate effectiveness scores']
    }
  }

  private getDefaultTrendAnalysis(metric: string): TrendAnalysis {
    return {
      metric,
      period: { start: new Date(), end: new Date() },
      dataPoints: 0,
      trend: 'stable',
      slope: 0,
      confidence: 0,
      predictions: [],
      insights: ['Insufficient data for trend analysis']
    }
  }
}

// Type definitions
export interface TrendAnalysis {
  metric: string
  period: { start: Date; end: Date }
  dataPoints: number
  trend: 'improving' | 'declining' | 'stable'
  slope: number
  confidence: number
  predictions: any[]
  insights: string[]
}

export interface AnomalyDetection {
  id: string
  metric: string
  currentValue: number
  expectedValue: number
  deviation: number
  severity: 'low' | 'medium' | 'high'
  description: string
  timestamp: Date
}

export interface EffectivenessScore {
  overallScore: number
  breakdown: Record<string, number>
  lastUpdated: Date
  trend: 'improving' | 'declining' | 'stable'
  recommendations: string[]
}

export const personalizationAnalytics = PersonalizationAnalytics.getInstance()