import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { withErrorHandling, AuthenticationError } from "@/lib/errors"
import { geminiClient } from "@/lib/ai/gemini-client"

// Validation schemas

const insightRequestSchema = z.object({
  type: z.enum(['performance', 'predictions', 'recommendations', 'trends']),
  context: z.record(z.any()).optional(),
})

// AI Analytics Engine
class AnalyticsEngine {
  static async calculateBusinessMetrics(supabase: any, userId: string, timeframe: string) {
    const { startDate, endDate } = this.getDateRange(timeframe)
    
    // Lead metrics
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const { data: allLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)

    // Call metrics
    const { data: callData } = await supabase
      .from('call_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    // Chat metrics
    const { data: chatData } = await supabase
      .from('chat_conversations')
      .select('*, chat_messages(*)')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    // Email campaign metrics
    const { data: emailData } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    // Calculate comprehensive metrics
    return {
      leadMetrics: this.calculateLeadMetrics(leadData || [], allLeads || []),
      callMetrics: this.calculateCallMetrics(callData || []),
      chatMetrics: this.calculateChatMetrics(chatData || []),
      emailMetrics: this.calculateEmailMetrics(emailData || []),
      overallPerformance: this.calculateOverallPerformance(leadData, callData, chatData, emailData),
      timeframe: { startDate, endDate }
    }
  }

  static calculateLeadMetrics(periodLeads: any[], allLeads: any[]) {
    const totalLeads = periodLeads.length
    const qualifiedLeads = periodLeads.filter(lead => lead.status === 'qualified').length
    const convertedLeads = periodLeads.filter(lead => lead.status === 'customer').length
    
    const averageScore = totalLeads > 0 
      ? periodLeads.reduce((sum, lead) => sum + (lead.lead_score || 0), 0) / totalLeads 
      : 0

    // Lead source breakdown
    const sourceBreakdown = periodLeads.reduce((acc, lead) => {
      const source = lead.tags?.[0] || 'direct'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {})

    // Conversion funnel
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0
    const qualificationRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0

    return {
      totalLeads,
      qualifiedLeads,
      convertedLeads,
      averageScore: Math.round(averageScore),
      conversionRate: Math.round(conversionRate * 100) / 100,
      qualificationRate: Math.round(qualificationRate * 100) / 100,
      sourceBreakdown,
      trend: this.calculateTrend(allLeads)
    }
  }

  static calculateCallMetrics(callData: any[]) {
    const totalCalls = callData.length
    const answeredCalls = callData.filter(call => call.call_status === 'answered').length
    const avgDuration = totalCalls > 0 
      ? callData.reduce((sum, call) => sum + (call.call_duration || 0), 0) / totalCalls 
      : 0

    const answerRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0
    const avgSentiment = callData
      .filter(call => call.sentiment_score)
      .reduce((sum, call, _, arr) => sum + call.sentiment_score / arr.length, 0)

    return {
      totalCalls,
      answeredCalls,
      answerRate: Math.round(answerRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
      avgSentiment: Math.round(avgSentiment * 100) / 100,
      bookingsCreated: callData.filter(call => call.booking_created).length
    }
  }

  static calculateChatMetrics(chatData: any[]) {
    const totalConversations = chatData.length
    const resolvedConversations = chatData.filter(chat => chat.status === 'resolved').length
    const avgMessagesPerConversation = totalConversations > 0 
      ? chatData.reduce((sum, chat) => sum + (chat.chat_messages?.length || 0), 0) / totalConversations 
      : 0

    const resolutionRate = totalConversations > 0 ? (resolvedConversations / totalConversations) * 100 : 0
    const avgSatisfaction = chatData
      .filter(chat => chat.satisfaction_rating)
      .reduce((sum, chat, _, arr) => sum + chat.satisfaction_rating / arr.length, 0)

    return {
      totalConversations,
      resolvedConversations,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
      avgMessagesPerConversation: Math.round(avgMessagesPerConversation * 100) / 100,
      avgSatisfaction: Math.round(avgSatisfaction * 100) / 100,
      escalationRate: chatData.filter(chat => chat.status === 'escalated').length
    }
  }

  static calculateEmailMetrics(emailData: any[]) {
    const totalCampaigns = emailData.length
    const sentCampaigns = emailData.filter(email => email.status === 'sent').length
    
    const totalStats = emailData.reduce((acc, email) => {
      const stats = email.statistics || {}
      acc.sent += stats.sent || 0
      acc.delivered += stats.delivered || 0
      acc.opened += stats.opened || 0
      acc.clicked += stats.clicked || 0
      return acc
    }, { sent: 0, delivered: 0, opened: 0, clicked: 0 })

    const deliveryRate = totalStats.sent > 0 ? (totalStats.delivered / totalStats.sent) * 100 : 0
    const openRate = totalStats.delivered > 0 ? (totalStats.opened / totalStats.delivered) * 100 : 0
    const clickRate = totalStats.opened > 0 ? (totalStats.clicked / totalStats.opened) * 100 : 0

    return {
      totalCampaigns,
      sentCampaigns,
      totalEmailsSent: totalStats.sent,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100
    }
  }

  static calculateOverallPerformance(leadData: any[], callData: any[], chatData: any[], emailData: any[]) {
    // Calculate overall business health score
    const leadScore = leadData && leadData.length > 0 ? Math.min(leadData.length / 10, 10) : 0
    const callScore = callData && callData.length > 0 ? Math.min(callData.length / 5, 10) : 0
    const chatScore = chatData && chatData.length > 0 ? Math.min(chatData.length / 20, 10) : 0
    const emailScore = emailData && emailData.length > 0 ? Math.min(emailData.length / 3, 10) : 0

    const overallScore = ((leadScore + callScore + chatScore + emailScore) / 4) * 10

    return {
      healthScore: Math.round(overallScore),
      totalInteractions: (leadData?.length || 0) + (callData?.length || 0) + (chatData?.length || 0),
      activeChannels: [
        leadData?.length > 0 && 'leads',
        callData?.length > 0 && 'calls', 
        chatData?.length > 0 && 'chat',
        emailData?.length > 0 && 'email'
      ].filter(Boolean).length
    }
  }

  static calculateTrend(allData: any[]) {
    if (!allData || allData.length < 2) return 0
    
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const recentCount = allData.filter(item => new Date(item.created_at) >= thirtyDaysAgo).length
    const previousCount = allData.filter(item => 
      new Date(item.created_at) >= sixtyDaysAgo && new Date(item.created_at) < thirtyDaysAgo
    ).length

    if (previousCount === 0) return recentCount > 0 ? 100 : 0
    return Math.round(((recentCount - previousCount) / previousCount) * 100)
  }

  static getDateRange(timeframe: string) {
    const now = new Date()
    let startDate: string

    switch (timeframe) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    return {
      startDate,
      endDate: now.toISOString()
    }
  }

  static async generateInsights(metrics: any, type: string): Promise<{
    insights: string[]
    recommendations: string[]
    predictions: string[]
    opportunities: string[]
  }> {
    try {
      const prompt = `
Analyze these business metrics and provide AI-powered insights:

Metrics Summary:
- Lead Metrics: ${JSON.stringify(metrics.leadMetrics)}
- Call Metrics: ${JSON.stringify(metrics.callMetrics)}
- Chat Metrics: ${JSON.stringify(metrics.chatMetrics)}
- Email Metrics: ${JSON.stringify(metrics.emailMetrics)}
- Overall Performance: ${JSON.stringify(metrics.overallPerformance)}

Provide insights for: ${type}

Generate a JSON response with:
{
  "insights": ["key insights about current performance"],
  "recommendations": ["specific actionable recommendations"],
  "predictions": ["future trends and forecasts"],
  "opportunities": ["growth opportunities and optimizations"]
}

Focus on:
- Data-driven observations
- Actionable recommendations
- Growth opportunities
- Performance optimizations
- Trend analysis
      `

      const response = await geminiClient.createChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        maxTokens: 1500,
      })

      return JSON.parse(response.choices[0]?.message?.content || '{}')
    } catch (error) {
      console.error('Error generating insights:', error)
      
      // Fallback insights based on simple analysis
      return this.generateFallbackInsights(metrics)
    }
  }

  static generateFallbackInsights(metrics: any) {
    const insights = []
    const recommendations = []
    const predictions = []
    const opportunities = []

    // Lead insights
    if (metrics.leadMetrics.totalLeads > 0) {
      insights.push(`Generated ${metrics.leadMetrics.totalLeads} leads with ${metrics.leadMetrics.averageScore}% average quality score`)
      
      if (metrics.leadMetrics.conversionRate < 10) {
        recommendations.push('Focus on lead qualification to improve conversion rates')
        opportunities.push('Implement lead scoring optimization')
      }
    } else {
      recommendations.push('Increase lead generation activities')
      opportunities.push('Implement multi-channel lead capture strategy')
    }

    // Call insights
    if (metrics.callMetrics.totalCalls > 0) {
      if (metrics.callMetrics.answerRate < 80) {
        recommendations.push('Optimize call timing and frequency')
      }
      insights.push(`${metrics.callMetrics.answerRate}% call answer rate with average ${metrics.callMetrics.avgDuration}s duration`)
    }

    // Growth predictions
    if (metrics.leadMetrics.trend > 0) {
      predictions.push(`Lead generation trending upward by ${metrics.leadMetrics.trend}%`)
    } else {
      predictions.push('Lead generation needs attention - consider new strategies')
    }

    return { insights, recommendations, predictions, opportunities }
  }
}

// Get analytics data
export const GET = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const { searchParams } = new URL(request.url)
  const timeframe = searchParams.get('timeframe') || '30d'
  const includeInsights = searchParams.get('insights') === 'true'

  // Calculate business metrics
  const metrics = await AnalyticsEngine.calculateBusinessMetrics(supabase, user.id, timeframe)

  let insights = null
  if (includeInsights) {
    insights = await AnalyticsEngine.generateInsights(metrics, 'performance')
  }

  return NextResponse.json({
    success: true,
    metrics,
    insights,
    generatedAt: new Date().toISOString()
  })
})

// Generate specific insights
export const POST = withErrorHandling(async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  const body = await request.json()
  const { type, context } = insightRequestSchema.parse(body)

  // Get recent metrics for context
  const metrics = await AnalyticsEngine.calculateBusinessMetrics(supabase, user.id, '30d')

  // Generate AI insights
  const insights = await AnalyticsEngine.generateInsights(metrics, type)

  // Store insights for later reference
  const insightRecord = {
    user_id: user.id,
    insight_type: type,
    data: insights,
    metrics_snapshot: metrics,
    context: context || {},
    created_at: new Date().toISOString()
  }

  // Note: Insights could be stored in a separate insights table if needed

  return NextResponse.json({
    success: true,
    type,
    insights,
    basedOnMetrics: {
      timeframe: '30d',
      totalInteractions: metrics.overallPerformance.totalInteractions,
      healthScore: metrics.overallPerformance.healthScore
    }
  })
})