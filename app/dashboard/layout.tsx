import type React from "react"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white">
      <DashboardNav />
      <div className="lg:pl-64 min-h-screen relative z-10">{children}</div>
    </div>
  )
}
