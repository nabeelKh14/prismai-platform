/**
 * Email Sequences API Routes
 * Handles automated follow-up sequences and enrollment management
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
    const status = searchParams.get('status')

    let query = supabase
      .from('email_sequences')
      .select(`
        *,
        sequence_enrollments(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status === 'active')
    }

    const { data: sequences, error } = await query

    if (error) {
      logger.error('Error fetching email sequences:', error)
      return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 })
    }

    return NextResponse.json({ sequences })

  } catch (error) {
    logger.error('Sequences API error:', error)
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
    const { action, sequenceId, leadId } = body

    if (action === 'create') {
      // Create new email sequence
      const { name, description, triggerType, triggerConditions, sequenceSteps, isActive = true } = body

      if (!name || !triggerType || !sequenceSteps) {
        return NextResponse.json({
          error: 'Name, trigger type, and sequence steps are required'
        }, { status: 400 })
      }

      // Validate trigger type
      const validTriggers = ['lead_created', 'behavior', 'time_based', 'manual', 'score_threshold']
      if (!validTriggers.includes(triggerType)) {
        return NextResponse.json({ error: 'Invalid trigger type' }, { status: 400 })
      }

      // Validate sequence steps
      if (!Array.isArray(sequenceSteps) || sequenceSteps.length === 0) {
        return NextResponse.json({ error: 'At least one sequence step is required' }, { status: 400 })
      }

      const { data: sequence, error } = await supabase
        .from('email_sequences')
        .insert({
          user_id: user.id,
          name,
          description,
          trigger_type: triggerType,
          trigger_conditions: triggerConditions || {},
          sequence_steps: sequenceSteps,
          is_active: isActive
        })
        .select()
        .single()

      if (error) {
        logger.error('Error creating email sequence:', error)
        return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 })
      }

      return NextResponse.json({ sequence }, { status: 201 })
    }

    if (action === 'enroll' && sequenceId && leadId) {
      // Enroll lead in sequence
      const { data: existingEnrollment } = await supabase
        .from('sequence_enrollments')
        .select('id')
        .eq('sequence_id', sequenceId)
        .eq('lead_id', leadId)
        .single()

      if (existingEnrollment) {
        return NextResponse.json({ error: 'Lead is already enrolled in this sequence' }, { status: 409 })
      }

      // Get sequence details
      const { data: sequence } = await supabase
        .from('email_sequences')
        .select('*')
        .eq('id', sequenceId)
        .eq('user_id', user.id)
        .single()

      if (!sequence) {
        return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
      }

      // Calculate next step time
      const firstStep = sequence.sequence_steps[0]
      const nextStepAt = firstStep?.delay_days
        ? new Date(Date.now() + firstStep.delay_days * 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString()

      const { data: enrollment, error } = await supabase
        .from('sequence_enrollments')
        .insert({
          sequence_id: sequenceId,
          lead_id: leadId,
          current_step: 0,
          next_step_at: nextStepAt
        })
        .select()
        .single()

      if (error) {
        logger.error('Error enrolling lead in sequence:', error)
        return NextResponse.json({ error: 'Failed to enroll lead' }, { status: 500 })
      }

      // Log enrollment activity
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          type: 'sequence_enrolled',
          description: `Enrolled in sequence: ${sequence.name}`,
          metadata: { sequenceId, sequenceName: sequence.name }
        })

      return NextResponse.json({ enrollment })
    }

    if (action === 'unenroll' && sequenceId && leadId) {
      // Unenroll lead from sequence
      const { error } = await supabase
        .from('sequence_enrollments')
        .delete()
        .eq('sequence_id', sequenceId)
        .eq('lead_id', leadId)

      if (error) {
        logger.error('Error unenrolling lead from sequence:', error)
        return NextResponse.json({ error: 'Failed to unenroll lead' }, { status: 500 })
      }

      // Log unenrollment activity
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          type: 'sequence_unenrolled',
          description: 'Unenrolled from email sequence',
          metadata: { sequenceId }
        })

      return NextResponse.json({ message: 'Lead unenrolled successfully' })
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })

  } catch (error) {
    logger.error('Sequences API POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}