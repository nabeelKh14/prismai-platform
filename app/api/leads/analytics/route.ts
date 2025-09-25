/**
 * Lead Analytics API Routes
 * Handles conversion funnel analytics, attribution tracking, and performance metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter = startDate && endDate ? {
      gte: startDate,
      lte: endDate
    } : {}

    if (action === 'funnel') {
      // Get conversion funnel data
      const funnelData = await getConversionFunnel(supabase, user.id, dateFilter)
      return NextResponse.json({ funnel: funnelData })
    }

    if (action === 'attribution') {
      // Get attribution data
      const attributionData = await getAttributionAnalytics(supabase, user.id, dateFilter)
      return NextResponse.json({ attribution: attributionData })
    }

    if (action === 'engagement') {
      // Get engagement analytics
      const engagementData = await getEngagementAnalytics(supabase, user.id, dateFilter)
      return NextResponse.json({ engagement: engagementData })
    }

    if (action === 'performance') {
      // Get overall lead performance metrics
      const performanceData = await getLeadPerformanceMetrics(supabase, user.id, dateFilter)
      return NextResponse.json({ performance: performanceData })
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })

  } catch (error) {
    logger.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getConversionFunnel(supabase: any, userId: string, dateFilter: any) {
  try {
    // Get funnel stages
    const { data: stages } = await supabase
      .from('lead_funnel_stages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('stage_order')

    // Get transition data
    let transitionsQuery = supabase
      .from('funnel_transitions')
      .select(`
        from_stage_id,
        to_stage_id,
        lead_id,
        transitioned_at,
        leads!inner(user_id)
      `)
      .eq('leads.user_id', userId)

    if (dateFilter.gte) {
      transitionsQuery = transitionsQuery.gte('transitioned_at', dateFilter.gte)
    }
    if (dateFilter.lte) {
      transitionsQuery = transitionsQuery.lte('transitioned_at', dateFilter.lte)
    }

    const { data: transitions } = await transitionsQuery

    // Calculate funnel metrics
    const funnelMetrics = stages?.map((stage: any) => {
      const stageTransitions = transitions?.filter((t: any) => t.to_stage_id === stage.id) || []
      const uniqueLeads = new Set(stageTransitions.map((t: any) => t.lead_id)).size

      const previousStage = stages?.find((s: any) => s.stage_order === stage.stage_order - 1)
      let conversionRate = 0

      if (previousStage) {
        const previousTransitions = transitions?.filter((t: any) => t.to_stage_id === previousStage.id) || []
        const previousUniqueLeads = new Set(previousTransitions.map((t: any) => t.lead_id)).size
        conversionRate = previousUniqueLeads > 0 ? (uniqueLeads / previousUniqueLeads) * 100 : 0
      }

      return {
        stage: stage.name,
        stageId: stage.id,
        order: stage.stage_order,
        leads: uniqueLeads,
        conversionRate: Math.round(conversionRate * 100) / 100,
        description: stage.description
      }
    }) || []

    // Calculate overall conversion rate
    const firstStage = funnelMetrics.find((m: any) => m.order === 1)
    const lastStage = funnelMetrics.find((m: any) => m.order === Math.max(...funnelMetrics.map((m: any) => m.order)))

    const overallConversionRate = firstStage && lastStage && firstStage.leads > 0
      ? (lastStage.leads / firstStage.leads) * 100
      : 0

    return {
      stages: funnelMetrics,
      overallConversionRate: Math.round(overallConversionRate * 100) / 100,
      totalLeads: firstStage?.leads || 0,
      convertedLeads: lastStage?.leads || 0
    }
  } catch (error) {
    logger.error('Error calculating conversion funnel:', error)
    return { stages: [], overallConversionRate: 0, totalLeads: 0, convertedLeads: 0 }
  }
}

async function getAttributionAnalytics(supabase: any, userId: string, dateFilter: any) {
  try {
    let touchpointsQuery = supabase
      .from('attribution_touchpoints')
      .select(`
        *,
        leads(status),
        lead_sources(name, type)
      `)
      .eq('leads.user_id', userId)

    if (dateFilter.gte) {
      touchpointsQuery = touchpointsQuery.gte('created_at', dateFilter.gte)
    }
    if (dateFilter.lte) {
      touchpointsQuery = touchpointsQuery.lte('created_at', dateFilter.lte)
    }

    const { data: touchpoints } = await touchpointsQuery

    // Group by source and calculate attribution
    const sourceAttribution = new Map()

    touchpoints?.forEach((tp: any) => {
      const sourceId = tp.source_id || 'direct'
      const sourceName = tp.lead_sources?.name || 'Direct'

      if (!sourceAttribution.has(sourceId)) {
        sourceAttribution.set(sourceId, {
          sourceId,
          sourceName,
          touchpoints: 0,
          conversions: 0,
          attributionWeight: 0
        })
      }

      const source = sourceAttribution.get(sourceId)
      source.touchpoints++

      if (tp.leads?.status === 'customer') {
        source.conversions++
      }

      source.attributionWeight += tp.attribution_weight || 1
    })

    // Calculate conversion rates and ROI
    const attributionResults = Array.from(sourceAttribution.values()).map((source: any) => ({
      ...source,
      conversionRate: source.touchpoints > 0 ? (source.conversions / source.touchpoints) * 100 : 0,
      attributionPercentage: 0 // Would calculate based on total attribution weights
    }))

    // Calculate attribution percentages
    const totalWeight = attributionResults.reduce((sum: number, source: any) => sum + source.attributionWeight, 0)
    attributionResults.forEach((source: any) => {
      source.attributionPercentage = totalWeight > 0 ? (source.attributionWeight / totalWeight) * 100 : 0
    })

    return {
      sources: attributionResults.sort((a, b) => b.attributionWeight - a.attributionWeight),
      totalTouchpoints: touchpoints?.length || 0,
      totalConversions: attributionResults.reduce((sum, source) => sum + source.conversions, 0)
    }
  } catch (error) {
    logger.error('Error calculating attribution analytics:', error)
    return { sources: [], totalTouchpoints: 0, totalConversions: 0 }
  }
}

async function getEngagementAnalytics(supabase: any, userId: string, dateFilter: any) {
  try {
    let engagementQuery = supabase
      .from('lead_engagement')
      .select(`
        *,
        leads(email, first_name, last_name)
      `)
      .eq('leads.user_id', userId)

    if (dateFilter.gte) {
      engagementQuery = engagementQuery.gte('created_at', dateFilter.gte)
    }
    if (dateFilter.lte) {
      engagementQuery = engagementQuery.lte('created_at', dateFilter.lte)
    }

    const { data: engagements } = await engagementQuery

    // Group by channel and type
    const channelStats = new Map()
    const typeStats = new Map()

    engagements?.forEach((eng: any) => {
      // Channel stats
      if (!channelStats.has(eng.channel)) {
        channelStats.set(eng.channel, { channel: eng.channel, count: 0, uniqueLeads: new Set() })
      }
      const channel = channelStats.get(eng.channel)
      channel.count++
      channel.uniqueLeads.add(eng.lead_id)

      // Type stats
      if (!typeStats.has(eng.engagement_type)) {
        typeStats.set(eng.engagement_type, { type: eng.engagement_type, count: 0 })
      }
      typeStats.get(eng.engagement_type).count++
    })

    return {
      channels: Array.from(channelStats.values()).map((c: any) => ({
        ...c,
        uniqueLeads: c.uniqueLeads.size
      })),
      types: Array.from(typeStats.values()),
      totalEngagements: engagements?.length || 0,
      avgEngagementScore: engagements?.length > 0
        ? engagements.reduce((sum: number, eng: any) => sum + (eng.engagement_score || 0), 0) / engagements.length
        : 0
    }
  } catch (error) {
    logger.error('Error calculating engagement analytics:', error)
    return { channels: [], types: [], totalEngagements: 0, avgEngagementScore: 0 }
  }
}

async function getLeadPerformanceMetrics(supabase: any, userId: string, dateFilter: any) {
  try {
    let leadsQuery = supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)

    if (dateFilter.gte) {
      leadsQuery = leadsQuery.gte('created_at', dateFilter.gte)
    }
    if (dateFilter.lte) {
      leadsQuery = leadsQuery.lte('created_at', dateFilter.lte)
    }

    const { data: leads } = await leadsQuery

    if (!leads || leads.length === 0) {
      return {
        totalLeads: 0,
        avgScore: 0,
        conversionRate: 0,
        topSources: [],
        scoreDistribution: {}
      }
    }

    const totalLeads = leads.length
    const avgScore = leads.reduce((sum: number, lead: any) => sum + (lead.lead_score || 0), 0) / totalLeads
    const convertedLeads = leads.filter((lead: any) => lead.status === 'customer').length
    const conversionRate = (convertedLeads / totalLeads) * 100

    // Top sources
    const sourceCounts = new Map()
    leads.forEach((lead: any) => {
      const source = lead.source_id || 'direct'
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1)
    })

    const topSources = Array.from(sourceCounts.entries())
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => ({ source, count, percentage: (count / totalLeads) * 100 }))

    // Score distribution
    const scoreDistribution = {
      high: leads.filter((l: any) => (l.lead_score || 0) >= 80).length,
      medium: leads.filter((l: any) => (l.lead_score || 0) >= 60 && (l.lead_score || 0) < 80).length,
      low: leads.filter((l: any) => (l.lead_score || 0) < 60).length
    }

    return {
      totalLeads,
      avgScore: Math.round(avgScore * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      topSources,
      scoreDistribution
    }
  } catch (error) {
    logger.error('Error calculating performance metrics:', error)
    return {
      totalLeads: 0,
      avgScore: 0,
      conversionRate: 0,
      topSources: [],
      scoreDistribution: {}
    }
  }
}