/**
 * Individual Lead API Routes
 * Handles operations on specific leads
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnhancedLeadScoringEngine } from '@/lib/mcp/enhanced-lead-scoring'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    const { id } = await params

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        lead_sources(name),
        lead_activities(*),
        lead_engagement(*),
        workflow_executions(
          *,
          lead_workflows(name, description)
        ),
        sequence_enrollments(
          *,
          email_sequences(name)
        ),
        attribution_touchpoints(
          *,
          lead_sources(name)
        )
      `)
      .eq('user_id', user.id)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }
      logger.error('Error fetching lead:', error)
      return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
    }

    // Get lead quality analysis
    const qualityAnalysis = await EnhancedLeadScoringEngine.analyzeLeadQuality(lead)

    return NextResponse.json({
      lead,
      analysis: qualityAnalysis
    })

  } catch (error) {
    logger.error('Lead fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    const { id } = await params

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      company,
      jobTitle,
      phone,
      status,
      tags,
      customFields,
      lifecycleStage
    } = body

    // Get current lead data
    const { data: currentLead, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
    }

    // Prepare update data
    const updateData: any = {}
    if (firstName !== undefined) updateData.first_name = firstName
    if (lastName !== undefined) updateData.last_name = lastName
    if (company !== undefined) updateData.company = company
    if (jobTitle !== undefined) updateData.job_title = jobTitle
    if (phone !== undefined) updateData.phone = phone
    if (status !== undefined) updateData.status = status
    if (tags !== undefined) updateData.tags = tags
    if (customFields !== undefined) updateData.custom_fields = customFields
    if (lifecycleStage !== undefined) updateData.lifecycle_stage = lifecycleStage

    // Recalculate score if relevant fields changed
    let newScore = currentLead.lead_score
    if (company !== undefined || jobTitle !== undefined) {
      const leadData = {
        email: currentLead.email,
        firstName: firstName || currentLead.first_name,
        lastName: lastName || currentLead.last_name,
        company: company || currentLead.company,
        jobTitle: jobTitle || currentLead.job_title,
        engagement: {}
      }

      const scoring = await EnhancedLeadScoringEngine.calculateLeadScore(leadData)
      newScore = scoring.score
      updateData.lead_score = newScore
      updateData.predictive_score = scoring.score
    }

    // Update lead
    const { data: lead, error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      logger.error('Error updating lead:', updateError)
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
    }

    // Log activity
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: id,
        type: 'lead_updated',
        description: 'Lead information updated',
        metadata: {
          changes: Object.keys(updateData),
          old_score: currentLead.lead_score,
          new_score: newScore
        }
      })

    // Trigger score-based workflows if score changed
    if (newScore !== currentLead.lead_score) {
      await triggerScoreBasedWorkflows(supabase, lead, user.id, newScore)
    }

    return NextResponse.json({ lead })

  } catch (error) {
    logger.error('Lead update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    const { id } = await params

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id)

    if (error) {
      logger.error('Error deleting lead:', error)
      return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Lead deleted successfully' })

  } catch (error) {
    logger.error('Lead deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function triggerScoreBasedWorkflows(supabase: any, lead: any, userId: string, newScore: number) {
  try {
    // Find workflows triggered by score changes
    const { data: workflows } = await supabase
      .from('lead_workflows')
      .select('*')
      .eq('user_id', userId)
      .eq('trigger_type', 'score_changed')
      .eq('status', 'active')

    for (const workflow of workflows || []) {
      const conditions = workflow.trigger_conditions

      // Check if score threshold is met
      if (conditions.minScore && newScore >= conditions.minScore) {
        // Check if workflow execution already exists
        const { data: existingExecution } = await supabase
          .from('workflow_executions')
          .select('id')
          .eq('workflow_id', workflow.id)
          .eq('lead_id', lead.id)
          .eq('status', 'running')
          .single()

        if (!existingExecution) {
          await supabase
            .from('workflow_executions')
            .insert({
              workflow_id: workflow.id,
              lead_id: lead.id,
              execution_data: {
                triggered_by: 'score_changed',
                score_threshold: conditions.minScore,
                current_score: newScore
              }
            })
        }
      }
    }
  } catch (error) {
    logger.error('Error triggering score-based workflows:', error)
  }
}