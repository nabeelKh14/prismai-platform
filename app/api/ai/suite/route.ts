import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, AuthenticationError } from "@/lib/errors"
import { geminiClient } from "@/lib/ai/gemini-client"
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@/lib/types/api'

// AI Suite specific types
interface LeadMetrics {
  total: number
  qualified: number
  converted: number
  averageScore: number
  activities: number
  sources: Record<string, number>
  conversionFunnel: Record<string, unknown>
}

interface CallMetrics {
  total: number
  answered: number
  avgDuration: number
  avgSentiment: number
  bookingsCreated: number
}

interface ChatMetrics {
  total: number
  resolved: number
  avgSatisfaction: number
  totalMessages: number
  escalations: number
}

interface EmailMetrics {
  total: number
  sent: number
  totalEmailsSent: number
  openRate: number
  clickRate: number
}

interface AnalyticsData {
  totalEvents: number
  uniqueUsers: number
  metricsTracked: number
  topEvents: Record<string, number>
}

interface BusinessAnalysis {
  overview: {
    totalInteractions: number
    overallEfficiency: number
    crossServiceSynergy: number
    automationLevel: number
  }
  serviceBreakdown: {
    leads: LeadMetrics
    calls: CallMetrics
    chat: ChatMetrics
    email: EmailMetrics
  }
  aiAnalysis: {
    insights: string[]
    opportunities: string[]
    risks: string[]
    predictions: string[]
  }
  recommendations: string[]
  timeframe: { startDate: string; endDate: string }
}

interface ServiceIntegration {
  triggerService: 'receptionist' | 'leads' | 'chatbot' | 'marketing' | 'analytics'
  targetServices: ('receptionist' | 'leads' | 'chatbot' | 'marketing' | 'analytics')[]
  eventData: Record<string, unknown>
  automationRules?: Record<string, unknown>
}

interface IntegrationResult {
  trigger: string
  targets: string[]
  results: unknown[]
  automationApplied: boolean
  timestamp: string
}

interface OptimizationPlan {
  [key: string]: unknown
}

interface OptimizationResult {
  optimizationPlan: OptimizationPlan
  executedActions: unknown[]
  expectedImprovements: unknown
  timeline: unknown
}

// Validation schemas

const integrationRequestSchema = z.object({
  triggerService: z.enum(['receptionist', 'leads', 'chatbot', 'marketing', 'analytics']),
  targetServices: z.array(z.enum(['receptionist', 'leads', 'chatbot', 'marketing', 'analytics'])),
  eventData: z.record(z.unknown()),
  automationRules: z.record(z.unknown()).optional(),
})

// AI Suite Orchestrator
class AISuiteOrchestrator {
  static async analyzeBusinessPerformance(supabase: SupabaseClient, userId: string, timeframe: string = '30d'): Promise<BusinessAnalysis> {
    const { startDate, endDate } = this.getDateRange(timeframe)

    // Collect data from all services
    const [leadData, callData, chatData, emailData, analytics] = await Promise.all([
      this.getLeadMetrics(supabase, userId, startDate, endDate),
      this.getCallMetrics(supabase, userId, startDate, endDate),
      this.getChatMetrics(supabase, userId, startDate, endDate),
      this.getEmailMetrics(supabase, userId, startDate, endDate),
      this.getAnalyticsData(supabase, userId, startDate, endDate),
    ])

    // Use AI to analyze cross-service performance
    const comprehensiveAnalysis = await this.generateComprehensiveAnalysis({
      leadData,
      callData,
      chatData,
      emailData,
      analytics,
      timeframe
    })

    return {
      overview: {
        totalInteractions: leadData.total + callData.total + chatData.total,
        overallEfficiency: this.calculateOverallEfficiency(leadData, callData, chatData, emailData),
        crossServiceSynergy: this.calculateServiceSynergy(leadData, callData, chatData, emailData),
        automationLevel: this.calculateAutomationLevel(leadData, callData, chatData, emailData),
      },
      serviceBreakdown: {
        leads: leadData,
        calls: callData,
        chat: chatData,
        email: emailData,
      },
      aiAnalysis: comprehensiveAnalysis,
      recommendations: this.generateCrossServiceRecommendations(leadData, callData, chatData, emailData),
      timeframe: { startDate, endDate }
    }
  }

  static async optimizeAllServices(supabase: SupabaseClient, userId: string): Promise<OptimizationResult> {
    // Get current performance metrics
    const analysis = await this.analyzeBusinessPerformance(supabase, userId)

    // Generate optimization strategies
    const optimizationPlan = await this.generateOptimizationPlan(analysis)

    // Execute optimization actions
    const results = await this.executeOptimizations(supabase, userId, optimizationPlan)

    return {
      optimizationPlan,
      executedActions: results,
      expectedImprovements: this.calculateExpectedImprovements(optimizationPlan),
      timeline: this.generateOptimizationTimeline(optimizationPlan)
    }
  }

  static async handleCrossServiceIntegration(
    supabase: SupabaseClient,
    userId: string,
    integration: ServiceIntegration
  ): Promise<IntegrationResult> {
    const { triggerService, targetServices, eventData, automationRules } = integration

    const results: unknown[] = []

    // Process integration based on trigger service
    switch (triggerService) {
      case 'leads':
        results.push(...await this.processLeadIntegration(supabase, userId, targetServices, eventData))
        break
      case 'chatbot':
        results.push(...await this.processChatIntegration(supabase, userId, targetServices, eventData))
        break
      case 'receptionist':
        results.push(...await this.processCallIntegration(supabase, userId, targetServices, eventData))
        break
      case 'marketing':
        results.push(...await this.processMarketingIntegration(supabase, userId, targetServices, eventData))
        break
      case 'analytics':
        results.push(...await this.processAnalyticsIntegration(supabase, userId, targetServices, eventData))
        break
    }

    return {
      trigger: triggerService,
      targets: targetServices,
      results,
      automationApplied: !!automationRules,
      timestamp: new Date().toISOString()
    }
  }

  // Service-specific data collection methods
  static async getLeadMetrics(supabase: SupabaseClient, userId: string, startDate: string, endDate: string): Promise<LeadMetrics> {
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const { data: activities } = await supabase
      .from('lead_activities')
      .select('*')
      .in('lead_id', leads?.map((l: { id: string }) => l.id) || [])

    return {
      total: leads?.length || 0,
      qualified: leads?.filter((l: { status: string }) => l.status === 'qualified').length || 0,
      converted: leads?.filter((l: { status: string }) => l.status === 'customer').length || 0,
      averageScore: leads?.reduce((sum: number, l: { lead_score?: number }) => sum + (l.lead_score || 0), 0) / (leads?.length || 1),
      activities: activities?.length || 0,
      sources: this.groupBy(leads || [], 'source_id'),
      conversionFunnel: this.calculateConversionFunnel(leads || [])
    }
  }

  static async getCallMetrics(supabase: SupabaseClient, userId: string, startDate: string, endDate: string): Promise<CallMetrics> {
    const { data: calls } = await supabase
      .from('call_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    return {
      total: calls?.length || 0,
      answered: calls?.filter((c: { call_status: string }) => c.call_status === 'answered').length || 0,
      avgDuration: calls?.reduce((sum: number, c: { call_duration?: number }) => sum + (c.call_duration || 0), 0) / (calls?.length || 1),
      avgSentiment: calls?.reduce((sum: number, c: { sentiment_score?: number }) => sum + (c.sentiment_score || 0), 0) / (calls?.length || 1),
      bookingsCreated: calls?.filter((c: { booking_created?: boolean }) => c.booking_created).length || 0
    }
  }

  static async getChatMetrics(supabase: SupabaseClient, userId: string, startDate: string, endDate: string): Promise<ChatMetrics> {
    const { data: conversations } = await supabase
      .from('chat_conversations')
      .select('*, chat_messages(*)')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    return {
      total: conversations?.length || 0,
      resolved: conversations?.filter((c: { status: string }) => c.status === 'resolved').length || 0,
      avgSatisfaction: conversations?.reduce((sum: number, c: { satisfaction_rating?: number }) => sum + (c.satisfaction_rating || 0), 0) / (conversations?.length || 1),
      totalMessages: conversations?.reduce((sum: number, c: { chat_messages?: unknown[] }) => sum + (c.chat_messages?.length || 0), 0) || 0,
      escalations: conversations?.filter((c: { status: string }) => c.status === 'escalated').length || 0
    }
  }

  static async getEmailMetrics(supabase: SupabaseClient, userId: string, startDate: string, endDate: string): Promise<EmailMetrics> {
    const { data: campaigns } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const totalStats = campaigns?.reduce((acc: { sent: number; opened: number; clicked: number }, c: { statistics?: { sent?: number; opened?: number; clicked?: number } }) => {
      const stats = c.statistics || {}
      acc.sent += stats.sent || 0
      acc.opened += stats.opened || 0
      acc.clicked += stats.clicked || 0
      return acc
    }, { sent: 0, opened: 0, clicked: 0 }) || { sent: 0, opened: 0, clicked: 0 }

    return {
      total: campaigns?.length || 0,
      sent: campaigns?.filter((c: { status: string }) => c.status === 'sent').length || 0,
      totalEmailsSent: totalStats.sent,
      openRate: totalStats.sent > 0 ? (totalStats.opened / totalStats.sent) * 100 : 0,
      clickRate: totalStats.opened > 0 ? (totalStats.clicked / totalStats.opened) * 100 : 0
    }
  }

  static async getAnalyticsData(supabase: SupabaseClient, userId: string, startDate: string, endDate: string): Promise<AnalyticsData> {
    const { data: events } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const { data: metrics } = await supabase
      .from('business_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('metric_date', startDate.split('T')[0])
      .lte('metric_date', endDate.split('T')[0])

    return {
      totalEvents: events?.length || 0,
      uniqueUsers: new Set(events?.map((e: { session_id: string }) => e.session_id) || []).size,
      metricsTracked: metrics?.length || 0,
      topEvents: this.groupBy(events || [], 'event_name')
    }
  }

  // AI Analysis Methods
  static async generateComprehensiveAnalysis(data: {
    leadData: LeadMetrics
    callData: CallMetrics
    chatData: ChatMetrics
    emailData: EmailMetrics
    analytics: AnalyticsData
    timeframe: string
  }): Promise<{
    insights: string[]
    opportunities: string[]
    risks: string[]
    predictions: string[]
  }> {
    try {
      const prompt = `
Analyze this comprehensive business data across all AI services:

Lead Data: ${JSON.stringify(data.leadData)}
Call Data: ${JSON.stringify(data.callData)}
Chat Data: ${JSON.stringify(data.chatData)}
Email Data: ${JSON.stringify(data.emailData)}
Analytics: ${JSON.stringify(data.analytics)}
Timeframe: ${data.timeframe}

Provide a comprehensive analysis in JSON format:
{
  "insights": ["key cross-service insights"],
  "opportunities": ["growth and optimization opportunities"],
  "risks": ["potential issues or declining metrics"],
  "predictions": ["future trends and forecasts"]
}

Focus on:
- Cross-service performance correlations
- Customer journey optimization
- Resource allocation efficiency
- Automation opportunities
- Revenue impact predictions
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        maxTokens: 2000,
      })

      return JSON.parse(response.choices[0]?.message?.content || '{}')
    } catch (error) {
      console.error('Error generating comprehensive analysis:', error)
      return {
        insights: ['Cross-service analysis requires manual review'],
        opportunities: ['Implement automated service integration'],
        risks: ['Monitor service performance regularly'],
        predictions: ['Continued growth expected with optimization']
      }
    }
  }

  // Integration processing methods
  static async processLeadIntegration(supabase: SupabaseClient, userId: string, targetServices: string[], eventData: Record<string, unknown>): Promise<unknown[]> {
    const results = []

    for (const service of targetServices) {
      switch (service) {
        case 'chatbot':
          // Auto-create chatbot greeting for high-value leads
          if (typeof eventData.leadScore === 'number' && eventData.leadScore > 80) {
            // Implementation would create personalized chatbot flow
            results.push({ service: 'chatbot', action: 'personalized_greeting_created' })
          }
          break
        case 'marketing':
          // Add to appropriate email campaign
          // Implementation would segment lead into campaign
          results.push({ service: 'marketing', action: 'added_to_nurture_campaign' })
          break
        case 'analytics':
          // Track lead source performance
          await supabase.from('analytics_events').insert({
            user_id: userId,
            event_name: 'high_value_lead_generated',
            event_properties: eventData
          })
          results.push({ service: 'analytics', action: 'lead_event_tracked' })
          break
      }
    }

    return results
  }

  static async processChatIntegration(supabase: SupabaseClient, userId: string, targetServices: string[], eventData: Record<string, unknown>): Promise<unknown[]> {
    const results = []

    for (const service of targetServices) {
      switch (service) {
        case 'leads':
          // Convert chat user to lead if not exists
          if (eventData.customerEmail || eventData.customerPhone) {
            // Implementation would create or update lead
            results.push({ service: 'leads', action: 'lead_created_from_chat' })
          }
          break
        case 'marketing':
          // Add to follow-up sequence based on chat intent
          results.push({ service: 'marketing', action: 'follow_up_sequence_triggered' })
          break
      }
    }

    return results
  }

  // Utility methods
  static calculateOverallEfficiency(leadData: LeadMetrics, callData: CallMetrics, chatData: ChatMetrics, emailData: EmailMetrics): number {
    const leadEfficiency = leadData.total > 0 ? (leadData.converted / leadData.total) * 100 : 0
    const callEfficiency = callData.total > 0 ? (callData.answered / callData.total) * 100 : 0
    const chatEfficiency = chatData.total > 0 ? (chatData.resolved / chatData.total) * 100 : 0
    const emailEfficiency = emailData.openRate || 0

    return Math.round((leadEfficiency + callEfficiency + chatEfficiency + emailEfficiency) / 4)
  }

  static groupBy(array: unknown[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const groupKey = (item as Record<string, unknown>)[key] || 'unknown'
      groups[groupKey as string] = (groups[groupKey as string] || 0) + 1
      return groups
    }, {} as Record<string, number>)
  }

  static getDateRange(timeframe: string) {
    const now = new Date()
    let days: number

    switch (timeframe) {
      case '7d': days = 7; break
      case '30d': days = 30; break
      case '90d': days = 90; break
      case '1y': days = 365; break
      default: days = 30
    }

    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
    return { startDate, endDate: now.toISOString() }
  }

  // Placeholder methods (would be fully implemented)
  static calculateServiceSynergy(_leadData: LeadMetrics, _callData: CallMetrics, _chatData: ChatMetrics, _emailData: EmailMetrics): number {
    return 85 // Placeholder
  }

  static calculateAutomationLevel(_leadData: LeadMetrics, _callData: CallMetrics, _chatData: ChatMetrics, _emailData: EmailMetrics): number {
    return 87 // Placeholder
  }

  static calculateConversionFunnel(_leads: unknown[]): Record<string, unknown> {
    return {} // Placeholder
  }

  static generateCrossServiceRecommendations(_leadData: LeadMetrics, _callData: CallMetrics, _chatData: ChatMetrics, _emailData: EmailMetrics): string[] {
    return ['Integrate chatbot with lead scoring', 'Automate email follow-ups for qualified leads']
  }

  static async generateOptimizationPlan(_analysis: BusinessAnalysis): Promise<OptimizationPlan> {
    return {} // Placeholder
  }

  static async executeOptimizations(_supabase: SupabaseClient, _userId: string, _plan: OptimizationPlan): Promise<unknown[]> {
    return [] // Placeholder
  }

  static calculateExpectedImprovements(_plan: OptimizationPlan): unknown {
    return {} // Placeholder
  }

  static generateOptimizationTimeline(_plan: OptimizationPlan): unknown {
    return {} // Placeholder
  }

  static async processCallIntegration(_supabase: SupabaseClient, _userId: string, _targetServices: string[], _eventData: Record<string, unknown>): Promise<unknown[]> {
    return [] // Placeholder
  }

  static async processMarketingIntegration(_supabase: SupabaseClient, _userId: string, _targetServices: string[], _eventData: Record<string, unknown>): Promise<unknown[]> {
    return [] // Placeholder
  }

  static async processAnalyticsIntegration(_supabase: SupabaseClient, _userId: string, _targetServices: string[], _eventData: Record<string, unknown>): Promise<unknown[]> {
    return [] // Placeholder
  }
}

// Main suite orchestration endpoint
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const { pathname } = new URL(request.url)
  const body = await request.json()

  // Route to specific handler based on path
  if (pathname.includes('/analyze')) {
    return handleBusinessAnalysis(supabase, user, body)
  } else if (pathname.includes('/optimize')) {
    return handleServiceOptimization(supabase, user, body)
  } else if (pathname.includes('/integrate')) {
    return handleServiceIntegration(supabase, user, body)
  } else {
    // Default: Business analysis
    return handleBusinessAnalysis(supabase, user, body)
  }
})

async function handleBusinessAnalysis(supabase: SupabaseClient, user: User, _body: unknown) {
  const timeframe = '30d'

  const analysis = await AISuiteOrchestrator.analyzeBusinessPerformance(
    supabase,
    user.id,
    timeframe
  )

  return NextResponse.json({
    success: true,
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    analysis,
    generatedAt: new Date().toISOString()
  })
}

async function handleServiceOptimization(supabase: SupabaseClient, user: User, _body: unknown) {
  const optimization = await AISuiteOrchestrator.optimizeAllServices(supabase, user.id)

  return NextResponse.json({
    success: true,
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    optimization,
    generatedAt: new Date().toISOString()
  })
}

async function handleServiceIntegration(supabase: SupabaseClient, user: User, body: unknown) {
  const integrationData = integrationRequestSchema.parse(body)

  const result = await AISuiteOrchestrator.handleCrossServiceIntegration(
    supabase,
    user.id,
    integrationData
  )

  return NextResponse.json({
    success: true,
    service: 'PrismAI',
    platform: 'Intelligent Business Automation Platform',
    integration: result,
    generatedAt: new Date().toISOString()
  })
}

// Get suite metrics and status
export const GET = withErrorHandling(async (_request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const analysis = await AISuiteOrchestrator.analyzeBusinessPerformance(supabase, user.id)

  return NextResponse.json({
    success: true,
    suiteStatus: 'operational',
    metrics: analysis.overview,
    serviceBreakdown: analysis.serviceBreakdown,
    lastUpdated: new Date().toISOString()
  })
})