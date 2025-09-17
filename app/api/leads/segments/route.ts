/**
 * Lead Segments API Routes
 * Handles dynamic and static lead segmentation
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
    const segmentId = searchParams.get('segmentId')
    const includeLeads = searchParams.get('includeLeads') === 'true'

    if (segmentId) {
      // Get specific segment with leads
      const { data: segment, error: segmentError } = await supabase
        .from('lead_segments')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', segmentId)
        .single()

      if (segmentError) {
        if (segmentError.code === 'PGRST116') {
          return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Failed to fetch segment' }, { status: 500 })
      }

      let leads = []
      if (includeLeads) {
        if (segment.segment_type === 'dynamic') {
          // Apply dynamic criteria to get current leads
          leads = await applyDynamicSegmentCriteria(supabase, user.id, segment.criteria)
        } else {
          // Get leads from membership table
          const { data: membershipData } = await supabase
            .from('lead_segment_membership')
            .select(`
              lead_id,
              added_at,
              leads(*)
            `)
            .eq('segment_id', segmentId)

          leads = membershipData?.map(m => m.leads) || []
        }
      }

      return NextResponse.json({ segment: { ...segment, leads } })
    }

    // Get all segments
    const { data: segments, error } = await supabase
      .from('lead_segments')
      .select(`
        *,
        lead_segment_membership(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching segments:', error)
      return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 })
    }

    return NextResponse.json({ segments })

  } catch (error) {
    logger.error('Segments API error:', error)
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
    const { action, segmentId } = body

    if (action === 'create') {
      // Create new segment
      const { name, description, segmentType, criteria, isActive = true } = body

      if (!name || !segmentType || !criteria) {
        return NextResponse.json({
          error: 'Name, segment type, and criteria are required'
        }, { status: 400 })
      }

      // Validate segment type
      if (!['static', 'dynamic'].includes(segmentType)) {
        return NextResponse.json({ error: 'Invalid segment type' }, { status: 400 })
      }

      const { data: segment, error } = await supabase
        .from('lead_segments')
        .insert({
          user_id: user.id,
          name,
          description,
          segment_type: segmentType,
          criteria,
          is_active: isActive
        })
        .select()
        .single()

      if (error) {
        logger.error('Error creating segment:', error)
        return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 })
      }

      // For dynamic segments, populate initial membership
      if (segmentType === 'dynamic') {
        await updateDynamicSegmentMembership(supabase, segment.id, user.id, criteria)
      }

      return NextResponse.json({ segment }, { status: 201 })
    }

    if (action === 'add_leads' && segmentId) {
      // Add leads to static segment
      const { leadIds } = body

      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return NextResponse.json({ error: 'Lead IDs array is required' }, { status: 400 })
      }

      // Verify segment ownership and type
      const { data: segment } = await supabase
        .from('lead_segments')
        .select('segment_type')
        .eq('user_id', user.id)
        .eq('id', segmentId)
        .single()

      if (!segment) {
        return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
      }

      if (segment.segment_type !== 'static') {
        return NextResponse.json({ error: 'Can only manually add leads to static segments' }, { status: 400 })
      }

      // Add leads to segment
      const membershipData = leadIds.map(leadId => ({
        segment_id: segmentId,
        lead_id: leadId
      }))

      const { error } = await supabase
        .from('lead_segment_membership')
        .upsert(membershipData, { onConflict: 'segment_id,lead_id' })

      if (error) {
        logger.error('Error adding leads to segment:', error)
        return NextResponse.json({ error: 'Failed to add leads to segment' }, { status: 500 })
      }

      return NextResponse.json({ message: `${leadIds.length} leads added to segment` })
    }

    if (action === 'remove_leads' && segmentId) {
      // Remove leads from segment
      const { leadIds } = body

      if (!Array.isArray(leadIds)) {
        return NextResponse.json({ error: 'Lead IDs array is required' }, { status: 400 })
      }

      const { error } = await supabase
        .from('lead_segment_membership')
        .delete()
        .eq('segment_id', segmentId)
        .in('lead_id', leadIds)

      if (error) {
        logger.error('Error removing leads from segment:', error)
        return NextResponse.json({ error: 'Failed to remove leads from segment' }, { status: 500 })
      }

      return NextResponse.json({ message: `${leadIds.length} leads removed from segment` })
    }

    if (action === 'refresh_dynamic' && segmentId) {
      // Refresh dynamic segment membership
      const { data: segment } = await supabase
        .from('lead_segments')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', segmentId)
        .single()

      if (!segment) {
        return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
      }

      if (segment.segment_type !== 'dynamic') {
        return NextResponse.json({ error: 'Segment is not dynamic' }, { status: 400 })
      }

      await updateDynamicSegmentMembership(supabase, segmentId, user.id, segment.criteria)

      return NextResponse.json({ message: 'Dynamic segment refreshed' })
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 })

  } catch (error) {
    logger.error('Segments API POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function applyDynamicSegmentCriteria(supabase: any, userId: string, criteria: any) {
  try {
    let query = supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)

    // Apply criteria filters
    if (criteria.minScore) {
      query = query.gte('lead_score', criteria.minScore)
    }

    if (criteria.maxScore) {
      query = query.lte('lead_score', criteria.maxScore)
    }

    if (criteria.status) {
      query = query.eq('status', criteria.status)
    }

    if (criteria.company) {
      query = query.ilike('company', `%${criteria.company}%`)
    }

    if (criteria.jobTitle) {
      query = query.ilike('job_title', `%${criteria.jobTitle}%`)
    }

    if (criteria.tags && Array.isArray(criteria.tags)) {
      // Filter by tags (simplified - would need more complex logic)
      query = query.overlaps('tags', criteria.tags)
    }

    if (criteria.createdAfter) {
      query = query.gte('created_at', criteria.createdAfter)
    }

    if (criteria.createdBefore) {
      query = query.lte('created_at', criteria.createdBefore)
    }

    const { data: leads } = await query.limit(1000) // Limit for performance

    return leads || []
  } catch (error) {
    logger.error('Error applying dynamic segment criteria:', error)
    return []
  }
}

async function updateDynamicSegmentMembership(supabase: any, segmentId: string, userId: string, criteria: any) {
  try {
    // Clear existing membership
    await supabase
      .from('lead_segment_membership')
      .delete()
      .eq('segment_id', segmentId)

    // Get leads matching criteria
    const matchingLeads = await applyDynamicSegmentCriteria(supabase, userId, criteria)

    // Add new membership
    if (matchingLeads.length > 0) {
      const membershipData = matchingLeads.map(lead => ({
        segment_id: segmentId,
        lead_id: lead.id
      }))

      await supabase
        .from('lead_segment_membership')
        .insert(membershipData)
    }

    logger.info(`Updated dynamic segment ${segmentId} with ${matchingLeads.length} leads`)
  } catch (error) {
    logger.error('Error updating dynamic segment membership:', error)
  }
}