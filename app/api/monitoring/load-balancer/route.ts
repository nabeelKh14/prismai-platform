import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { loadBalancer } from "@/lib/monitoring/load-balancer"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get load balancer statistics
    const stats = loadBalancer.getStatistics()

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error in load balancer API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}