import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, User, Phone, Mail } from "lucide-react"
import DotGrid from '@/components/DotGrid'

export default async function BookingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", user.id)
    .order("appointment_date", { ascending: true })

  // Group bookings by date
  const groupedBookings =
    bookings?.reduce(
      (acc, booking) => {
        const date = new Date(booking.appointment_date).toDateString()
        if (!acc[date]) acc[date] = []
        acc[date].push(booking)
        return acc
      },
      {} as Record<string, typeof bookings>,
    ) || {}

  return (
    <div className="p-6 space-y-6">
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Bookings</h1>
          <p className="text-muted-foreground">Manage appointments scheduled by your AI receptionist</p>
        </div>
        <Button>
          <Calendar className="h-4 w-4 mr-2" />
          Calendar View
        </Button>
      </div>

      {/* Booking Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bookings?.filter((b) => {
                const bookingDate = new Date(b.appointment_date)
                const now = new Date()
                const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
                return bookingDate >= weekStart
              }).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bookings?.filter((b) => new Date(b.appointment_date) > new Date()).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings List */}
      <div className="space-y-6">
        {Object.keys(groupedBookings).length > 0 ? (
          Object.entries(groupedBookings).map(([date, dayBookings]) => (
            <div key={date}>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                {new Date(date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>

              <div className="space-y-3">
                {dayBookings.map((booking) => (
                  <Card key={booking.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">{booking.customer_name}</p>
                            <p className="text-sm text-muted-foreground">{booking.service_type}</p>
                            <div className="flex items-center space-x-4 mt-1">
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Phone className="h-3 w-3 mr-1" />
                                {booking.customer_phone}
                              </div>
                              {booking.customer_email && (
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {booking.customer_email}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="flex items-center text-sm font-medium">
                              <Clock className="h-3 w-3 mr-1" />
                              {booking.appointment_time}
                            </div>
                            <Badge
                              variant={
                                booking.status === "confirmed"
                                  ? "default"
                                  : booking.status === "cancelled"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {booking.status}
                            </Badge>
                          </div>

                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                            <Button variant="outline" size="sm">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>

                      {booking.notes && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">Notes:</p>
                          <p className="text-sm">{booking.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No bookings yet</p>
                <p className="text-sm">Appointments scheduled by your AI receptionist will appear here</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
