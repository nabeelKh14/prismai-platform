import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Phone, Settings, BarChart3, Calendar, Users, MessageSquare } from "lucide-react"
import DotGrid from '@/components/DotGrid'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Get user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  // Calculate stats
  const totalCalls = callLogs?.length || 0
  const totalBookings = bookings?.length || 0
  const conversionRate = totalCalls > 0 ? Math.round((totalBookings / totalCalls) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0B0B0D] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-pink-500/5 opacity-30" />

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
        style={{ opacity: 0.4 }}
      />

      {/* Dashboard Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-white premium-heading">Dashboard</h1>
            <p className="text-gray-400 premium-subheading">Manage your AI receptionist and view performance metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">Welcome, <span className="text-white font-semibold">{profile?.business_name || "User"}</span></span>
            <Button variant="outline" size="sm" className="glass hover:bg-white/10 text-white border-white/10">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{totalCalls}</div>
              <p className="text-xs text-gray-500 mt-1">{totalCalls === 0 ? "No calls yet" : "This month"}</p>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-pink-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{totalBookings}</div>
              <p className="text-xs text-gray-500 mt-1">{totalBookings === 0 ? "No bookings yet" : "This month"}</p>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Conversion Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{conversionRate}%</div>
              <p className="text-xs text-gray-500 mt-1">{totalCalls === 0 ? "No data yet" : "Calls to bookings"}</p>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Satisfaction</CardTitle>
              <Users className="h-4 w-4 text-pink-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">--</div>
              <p className="text-xs text-gray-500 mt-1">No feedback yet</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Setup Card */}
          <Card className="card-premium-strong border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Settings className="h-5 w-5 text-cyan-400" />
                Complete Your Setup
              </CardTitle>
              <CardDescription className="text-gray-400">Configure your AI receptionist to start receiving calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 glass rounded-xl">
                  <span className="text-sm text-gray-300">Business Information</span>
                  <span className="text-xs text-green-400 font-semibold bg-green-400/10 px-2 py-1 rounded-full">Complete</span>
                </div>
                <div className="flex items-center justify-between p-4 glass rounded-xl">
                  <span className="text-sm text-gray-300">AI Assistant Configuration</span>
                  <span className="text-xs text-yellow-500 font-semibold bg-yellow-500/10 px-2 py-1 rounded-full">Pending</span>
                </div>
                <div className="flex items-center justify-between p-4 glass rounded-xl">
                  <span className="text-sm text-gray-300">Phone Number Setup</span>
                  <span className="text-xs text-yellow-500 font-semibold bg-yellow-500/10 px-2 py-1 rounded-full">Pending</span>
                </div>
              </div>
              <Button className="w-full btn-premium py-6 rounded-xl font-bold text-lg">
                Continue Setup
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <MessageSquare className="h-5 w-5 text-pink-400" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-gray-400">Your latest calls and interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {callLogs && callLogs.length > 0 ? (
                <div className="space-y-3">
                  {callLogs.map((call) => (
                    <div key={call.id} className="flex items-center justify-between p-4 glass rounded-xl hover:bg-white/5 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-white">{call.caller_phone || "Unknown"}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(call.created_at).toLocaleDateString()} • {call.duration}s
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-medium ${call.status === "completed"
                              ? "bg-green-400/10 text-green-400"
                              : call.status === "missed"
                                ? "bg-red-400/10 text-red-400"
                                : "bg-yellow-400/10 text-yellow-400"
                            }`}
                        >
                          {call.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">No activity yet</p>
                  <p className="text-sm">Complete your setup to start receiving calls</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {bookings && bookings.length > 0 && (
          <div className="mt-8">
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Calendar className="h-5 w-5 text-cyan-400" />
                  Recent Bookings
                </CardTitle>
                <CardDescription className="text-gray-400">Latest appointments scheduled by your AI receptionist</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-4 glass rounded-xl hover:bg-white/5 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-white">{booking.customer_name}</p>
                        <p className="text-xs text-gray-500">
                          {booking.service_type} • {booking.customer_phone}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-cyan-400">{new Date(booking.appointment_date).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">{booking.appointment_time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
