import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    // Basic readiness check - just verify database connectivity
    const supabase = await createClient()

    const { error } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true })
      .limit(1)

    if (error) {
      return NextResponse.json(
        { status: 'not ready', error: 'Database connection failed' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json(
      {
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Readiness check failed'
      },
      { status: 503 }
    )
  }
}