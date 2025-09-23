import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MCPDashboard } from "@/components/mcp/mcp-dashboard"
import DotGrid from '@/components/DotGrid'

export default async function MCPPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  return (
    <div>
      {/* Interactive dot-grid background */}
      <DotGrid
        dotSize={2}
        gap={24}
        baseColor="#00ffff"
        activeColor="#ffffff"
        proximity={120}
        speedTrigger={50}
        shockRadius={200}
        shockStrength={3}
        className="fixed inset-0 z-0"
        style={{ opacity: 0.6 }}
      />
      <MCPDashboard />
    </div>
  )
}