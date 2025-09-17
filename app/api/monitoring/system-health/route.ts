import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { systemMetricsCollector } from "@/lib/monitoring/system-metrics-collector"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get system health from the collector
    const systemHealth = await systemMetricsCollector.getSystemHealth()

    return NextResponse.json(systemHealth)
  } catch (error) {
    console.error('Error in PrismAI system health API:', error)
    return NextResponse.json({
      service: 'PrismAI',
      error: "Internal server error"
    }, { status: 500 })
  }
}