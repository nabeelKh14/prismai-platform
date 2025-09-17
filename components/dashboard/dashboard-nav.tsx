"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Phone, Calendar, BarChart3, Settings, Users, MessageSquare, Menu, X, Brain, Zap, Workflow, BookOpen, FileText, UserCheck, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "AI Suite", href: "/dashboard/ai-suite", icon: Brain, badge: "New" },
  { name: "MCP Services", href: "/dashboard/mcp", icon: Workflow, badge: "Free" },
  { name: "Knowledge Base", href: "/dashboard/knowledge-base", icon: BookOpen },
  { name: "Live Chat", href: "/dashboard/live-chat", icon: MessageSquare },
  { name: "Monitoring", href: "/dashboard/monitoring", icon: BarChart3 },
  { name: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
  { name: "Call Logs", href: "/dashboard/calls", icon: Phone },
  { name: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "AI Assistant", href: "/dashboard/assistant", icon: Zap },
  { name: "Customers", href: "/dashboard/customers", icon: Users },
  // Enterprise Features
  { name: "Enterprise", href: "/dashboard/enterprise", icon: BarChart3, badge: "Enterprise" },
  { name: "Surveys", href: "/dashboard/surveys", icon: FileText, badge: "Enterprise" },
  { name: "Agents", href: "/dashboard/agents", icon: UserCheck, badge: "Enterprise" },
  { name: "Quality", href: "/dashboard/quality", icon: Shield, badge: "Enterprise" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function DashboardNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-background border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center px-6 py-4 border-b">
            <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Phone className="h-4 w-4 text-white" />
            </div>
            <span className="ml-2 text-lg font-bold">PrismAI</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors relative",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-4 w-4 mr-3" />
                  {item.name}
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-cyan-500 to-pink-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
    </>
  )
}
