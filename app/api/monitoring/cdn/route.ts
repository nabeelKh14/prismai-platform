import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { cdnService } from "@/lib/monitoring/cdn-service"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '24h'

    // Get CDN analytics
    const analytics = await cdnService.getAnalytics(timeRange as any)

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Error in CDN API:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}