/**
 * Lead Workflows API Routes
 * Handles workflow creation, management, and execution
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
      .from('lead_workflows')
      .select(`
        *,
        workflow_executions(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: workflows, error } = await query

    if (error) {
      logger.error('Error fetching workflows:', error)
      return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
    }

    return NextResponse.json({ workflows })

  } catch (error) {
    logger.error('Workflow fetch error:', error)
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
      name,
      description,
      triggerType,
      triggerConditions,
      workflowSteps,
      status = 'draft'
    } = body

    // Validate required fields
    if (!name || !triggerType || !workflowSteps) {
      return NextResponse.json({
        error: 'Name, trigger type, and workflow steps are required'
      }, { status: 400 })
    }

    // Validate trigger type
    const validTriggers = ['lead_created', 'score_changed', 'behavior', 'time_based', 'manual']
    if (!validTriggers.includes(triggerType)) {
      return NextResponse.json({ error: 'Invalid trigger type' }, { status: 400 })
    }

    // Create workflow
    const { data: workflow, error } = await supabase
      .from('lead_workflows')
      .insert({
        user_id: user.id,
        name,
        description,
        trigger_type: triggerType,
        trigger_conditions: triggerConditions || {},
        workflow_steps: workflowSteps,
        status
      })
      .select()
      .single()

    if (error) {
      logger.error('Error creating workflow:', error)
      return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
    }

    return NextResponse.json({ workflow }, { status: 201 })

  } catch (error) {
    logger.error('Workflow creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}