import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, Phone, Clock } from "lucide-react"

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Get analytics data
  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Calculate metrics
  const totalCalls = callLogs?.length || 0
  const totalBookings = bookings?.length || 0
  const conversionRate = totalCalls > 0 ? Math.round((totalBookings / totalCalls) * 100) : 0
  const avgCallDuration = callLogs?.length
    ? Math.round(callLogs.reduce((sum, call) => sum + (call.duration || 0), 0) / callLogs.length)
    : 0

  // Get call data by hour for peak times
  const callsByHour = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    calls: callLogs?.filter((call) => new Date(call.created_at).getHours() === i).length || 0,
  }))

  const peakHour = callsByHour.reduce((max, current) => (current.calls > max.calls ? current : max), callsByHour[0])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">Detailed insights into your AI receptionist performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalls}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">Calls to bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Call Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCallDuration}s</div>
            <p className="text-xs text-muted-foreground">Average length</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{peakHour.hour}:00</div>
            <p className="text-xs text-muted-foreground">{peakHour.calls} calls</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Call Volume by Hour</CardTitle>
            <CardDescription>Peak calling times throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {callsByHour.slice(8, 20).map((data) => (
                <div key={data.hour} className="flex items-center space-x-2">
                  <div className="w-12 text-sm text-muted-foreground">{data.hour}:00</div>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-pink-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.max((data.calls / Math.max(...callsByHour.map((c) => c.calls), 1)) * 100, 2)}%`,
                      }}
                    />
                  </div>
                  <div className="w-8 text-sm text-right">{data.calls}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call Outcomes</CardTitle>
            <CardDescription>How your calls are being handled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {["completed", "missed", "in-progress"].map((status) => {
                const count = callLogs?.filter((call) => call.status === status).length || 0
                const percentage = totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0
                return (
                  <div key={status} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{status}</span>
                      <span>
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          status === "completed" ? "bg-green-500" : status === "missed" ? "bg-red-500" : "bg-yellow-500"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Types */}
      {bookings && bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Popular Services</CardTitle>
            <CardDescription>Most requested service types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(
                bookings.reduce(
                  (acc, booking) => {
                    acc[booking.service_type] = (acc[booking.service_type] || 0) + 1
                    return acc
                  },
                  {} as Record<string, number>,
                ),
              ).map(([service, count]) => {
                const percentage = Math.round((count / bookings.length) * 100)
                return (
                  <div key={service} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{service}</span>
                      <span>
                        {count} bookings ({percentage}%)
                      </span>
                    </div>
                    <div className="bg-muted rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-pink-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
