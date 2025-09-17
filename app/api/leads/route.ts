/**
 * Advanced Lead Generation API Routes
 * Handles lead management, scoring, workflows, and analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnhancedLeadScoringEngine } from '@/lib/mcp/enhanced-lead-scoring'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const segment = searchParams.get('segment')
    const minScore = searchParams.get('minScore')
    const maxScore = searchParams.get('maxScore')
    const search = searchParams.get('search')

    let query = supabase
      .from('leads')
      .select(`
        *,
        lead_sources(name),
        lead_activities(count),
        lead_engagement(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (minScore) {
      query = query.gte('lead_score', parseInt(minScore))
    }

    if (maxScore) {
      query = query.lte('lead_score', parseInt(maxScore))
    }

    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%`)
    }

    // Handle segment filtering
    if (segment) {
      const { data: segmentData } = await supabase
        .from('lead_segments')
        .select('id, criteria')
        .eq('user_id', user.id)
        .eq('name', segment)
        .single()

      if (segmentData) {
        // Apply segment criteria (simplified - would need more complex logic for full implementation)
        const criteria = segmentData.criteria
        if (criteria.minScore) {
          query = query.gte('lead_score', criteria.minScore)
        }
        if (criteria.status) {
          query = query.eq('status', criteria.status)
        }
      }
    }

    // Pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: leads, error, count } = await query

    if (error) {
      logger.error('Error fetching leads:', error)
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    logger.error('Lead fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      email,
      firstName,
      lastName,
      company,
      jobTitle,
      phone,
      sourceId,
      tags = [],
      customFields = {}
    } = body

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if lead already exists
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('user_id', user.id)
      .eq('email', email)
      .single()

    if (existingLead) {
      return NextResponse.json({ error: 'Lead with this email already exists' }, { status: 409 })
    }

    // Calculate lead score
    const leadData = {
      email,
      firstName,
      lastName,
      company,
      jobTitle,
      engagement: {}
    }

    const scoring = await EnhancedLeadScoringEngine.calculateLeadScore(leadData)

    // Create lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        user_id: user.id,
        source_id: sourceId,
        email,
        first_name: firstName,
        last_name: lastName,
        company,
        job_title: jobTitle,
        phone,
        lead_score: scoring.score,
        tags,
        custom_fields: customFields,
        predictive_score: scoring.score,
        engagement_score: 0
      })
      .select()
      .single()

    if (leadError) {
      logger.error('Error creating lead:', leadError)
      return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
    }

    // Log lead creation activity
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: lead.id,
        type: 'lead_created',
        description: 'Lead created via API',
        metadata: { source: 'api', scoring }
      })

    // Trigger workflows if any match
    await triggerMatchingWorkflows(supabase, lead, user.id)

    // Add attribution touchpoint
    if (sourceId) {
      await supabase
        .from('attribution_touchpoints')
        .insert({
          lead_id: lead.id,
          source_id: sourceId,
          touchpoint_type: 'lead_creation',
          channel: 'api'
        })
    }

    return NextResponse.json({
      lead: {
        ...lead,
        scoring
      }
    }, { status: 201 })

  } catch (error) {
    logger.error('Lead creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function triggerMatchingWorkflows(supabase: any, lead: any, userId: string) {
  try {
    // Find workflows that match the lead creation trigger
    const { data: workflows } = await supabase
      .from('lead_workflows')
      .select('*')
      .eq('user_id', userId)
      .eq('trigger_type', 'lead_created')
      .eq('status', 'active')

    for (const workflow of workflows || []) {
      // Check if trigger conditions match
      const conditions = workflow.trigger_conditions
      let shouldTrigger = true

      if (conditions.minScore && lead.lead_score < conditions.minScore) {
        shouldTrigger = false
      }

      if (conditions.sourceId && lead.source_id !== conditions.sourceId) {
        shouldTrigger = false
      }

      if (shouldTrigger) {
        // Create workflow execution
        await supabase
          .from('workflow_executions')
          .insert({
            workflow_id: workflow.id,
            lead_id: lead.id,
            execution_data: {
              triggered_by: 'lead_created',
              initial_score: lead.lead_score
            }
          })
      }
    }
  } catch (error) {
    logger.error('Error triggering workflows:', error)
  }
}