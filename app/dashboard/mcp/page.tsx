import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MCPDashboard } from "@/components/mcp/mcp-dashboard"

export default async function MCPPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  return <MCPDashboard />
}