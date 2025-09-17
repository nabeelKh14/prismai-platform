import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { resourceMonitor } from "@/lib/monitoring/resource-monitor"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current resource usage
    const resourceUsage = await resourceMonitor.getCurrentUsage()

    return NextResponse.json(resourceUsage)
  } catch (error) {
    console.error('Error in resources API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}