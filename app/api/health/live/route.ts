import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Simple liveness check - just verify the application is running
  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  })
}