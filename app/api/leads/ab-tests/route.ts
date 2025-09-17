/**
 * A/B Testing API Routes
 * Handles A/B test creation, management, and analytics
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
    const testType = searchParams.get('testType')

    let query = supabase
      .from('ab_tests')
      .select(`
        *,
        ab_test_results(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (testType) {
      query = query.eq('test_type', testType)
    }

    const { data: abTests, error } = await query

    if (error) {
      logger.error('Error fetching A/B tests:', error)
      return NextResponse.json({ error: 'Failed to fetch A/B tests' }, { status: 500 })
    }

    return NextResponse.json({ abTests })

  } catch (error) {
    logger.error('A/B test fetch error:', error)
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
      testType,
      targetAudience,
      variants,
      winnerCriteria,
      startDate,
      endDate,
      status = 'draft'
    } = body

    // Validate required fields
    if (!name || !testType || !variants || !winnerCriteria) {
      return NextResponse.json({
        error: 'Name, test type, variants, and winner criteria are required'
      }, { status: 400 })
    }

    // Validate test type
    const validTypes = ['email_subject', 'email_content', 'send_time', 'landing_page', 'cta_button']
    if (!validTypes.includes(testType)) {
      return NextResponse.json({ error: 'Invalid test type' }, { status: 400 })
    }

    // Validate variants (should have at least 2)
    if (!Array.isArray(variants) || variants.length < 2) {
      return NextResponse.json({ error: 'At least 2 variants are required' }, { status: 400 })
    }

    // Create A/B test
    const { data: abTest, error } = await supabase
      .from('ab_tests')
      .insert({
        user_id: user.id,
        name,
        description,
        test_type: testType,
        target_audience: targetAudience || {},
        variants,
        winner_criteria: winnerCriteria,
        start_date: startDate,
        end_date: endDate,
        status
      })
      .select()
      .single()

    if (error) {
      logger.error('Error creating A/B test:', error)
      return NextResponse.json({ error: 'Failed to create A/B test' }, { status: 500 })
    }

    return NextResponse.json({ abTest }, { status: 201 })

  } catch (error) {
    logger.error('A/B test creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}