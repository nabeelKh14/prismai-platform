import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Phone, Clock, MessageSquare } from "lucide-react"
import DotGrid from '@/components/DotGrid'

export default async function CallsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

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
          <h1 className="text-3xl font-bold mb-2">Call Logs</h1>
          <p className="text-muted-foreground">View and manage all incoming calls</p>
        </div>
        <Button variant="outline">
          <Phone className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input placeholder="Search by phone number or caller..." className="flex-1" />
            <Button variant="outline">Filter</Button>
          </div>
        </CardContent>
      </Card>

      {/* Call Logs */}
      <div className="space-y-4">
        {callLogs && callLogs.length > 0 ? (
          callLogs.map((call) => (
            <Card key={call.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{call.caller_phone || "Unknown Number"}</p>
                      <p className="text-sm text-muted-foreground">{new Date(call.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {call.duration || 0}s
                      </div>
                    </div>

                    <Badge
                      variant={
                        call.status === "completed" ? "default" : call.status === "missed" ? "destructive" : "secondary"
                      }
                    >
                      {call.status}
                    </Badge>

                    <Button variant="outline" size="sm">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </div>
                </div>

                {call.transcript && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Transcript:</p>
                    <p className="text-sm">{call.transcript.substring(0, 200)}...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No calls yet</p>
                <p className="text-sm">Your call logs will appear here once you start receiving calls</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
