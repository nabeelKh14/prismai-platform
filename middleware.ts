// Temporarily disabled middleware for MVP demo
// import { updateSession } from "@/lib/supabase/middleware"
// import { developerPortalMiddleware } from "./middleware.developer-portal"
// import { startSystemMetricsCollection } from "./middleware/performance-monitoring"
// import { monitoringSecurityMiddleware, MonitoringRateLimiter } from "./middleware/monitoring-security"
// import type { NextRequest } from "next/server"
// import { NextResponse } from "next/server"

// Start system metrics collection
// if (typeof window === 'undefined') {
//   startSystemMetricsCollection(5) // Collect every 5 minutes
// }

export async function middleware() {
  // Simple pass-through for MVP demo
  return
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
