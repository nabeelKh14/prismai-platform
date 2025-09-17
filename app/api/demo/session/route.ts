import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { demoController } from '@/lib/ai/demo-controller'

export async function POST(request: NextRequest) {
  try {
    const { scenarioName, conversationId } = await request.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = await demoController.startDemoSession(user.id, scenarioName, conversationId)

    return NextResponse.json({
      service: 'PrismAI',
      platform: 'Intelligent Business Automation Platform',
      sessionId
    })
  } catch (error) {
    console.error('Failed to start demo session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scenarios = demoController.getAvailableScenarios()

    const { data: sessions } = await supabase
      .from('demo_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      service: 'PrismAI',
      platform: 'Intelligent Business Automation Platform',
      scenarios,
      sessions
    })
  } catch (error) {
    console.error('Failed to fetch demo data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}