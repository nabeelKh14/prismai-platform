import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: criteria, error } = await supabase
      .from('quality_criteria')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching quality criteria:', error)
      return NextResponse.json({ error: "Failed to fetch quality criteria" }, { status: 500 })
    }

    return NextResponse.json(criteria)
  } catch (error) {
    console.error('Error in quality criteria API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, criteria, max_score } = body

    if (!name || !criteria || !Array.isArray(criteria)) {
      return NextResponse.json({ error: "Name and criteria array are required" }, { status: 400 })
    }

    const { data: qualityCriteria, error } = await supabase
      .from('quality_criteria')
      .insert({
        user_id: user.id,
        name,
        description,
        criteria,
        max_score: max_score || 100
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating quality criteria:', error)
      return NextResponse.json({ error: "Failed to create quality criteria" }, { status: 500 })
    }

    return NextResponse.json(qualityCriteria, { status: 201 })
  } catch (error) {
    console.error('Error in quality criteria POST:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}