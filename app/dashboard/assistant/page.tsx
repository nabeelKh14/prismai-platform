import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { MessageSquare, Settings, Phone, Zap } from "lucide-react"

export default async function AssistantPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const { data: aiConfig } = await supabase.from("ai_configurations").select("*").eq("user_id", user.id).single()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">AI Assistant</h1>
        <p className="text-muted-foreground">Configure your AI receptionist's personality and behavior</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Basic Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Basic Settings
            </CardTitle>
            <CardDescription>Configure your AI assistant's basic behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assistant-name">Assistant Name</Label>
              <Input
                id="assistant-name"
                placeholder="e.g., Sarah, Alex, Jordan"
                defaultValue={aiConfig?.assistant_name || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-greeting">Business Greeting</Label>
              <Textarea
                id="business-greeting"
                placeholder="Hello! Thank you for calling [Business Name]. How can I help you today?"
                defaultValue={aiConfig?.greeting_message || ""}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-hours">Business Hours</Label>
              <Input
                id="business-hours"
                placeholder="Monday-Friday 9AM-5PM"
                defaultValue={profile?.business_hours || ""}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>24/7 Availability</Label>
                <p className="text-sm text-muted-foreground">Allow calls outside business hours</p>
              </div>
              <Switch defaultChecked={aiConfig?.always_available || false} />
            </div>
          </CardContent>
        </Card>

        {/* Advanced Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Advanced Settings
            </CardTitle>
            <CardDescription>Fine-tune your AI assistant's capabilities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="personality">Personality Style</Label>
              <select
                id="personality"
                className="w-full p-2 border rounded-md"
                defaultValue={aiConfig?.personality_style || "professional"}
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="response-speed">Response Speed</Label>
              <select
                id="response-speed"
                className="w-full p-2 border rounded-md"
                defaultValue={aiConfig?.response_speed || "normal"}
              >
                <option value="fast">Fast (0.5s)</option>
                <option value="normal">Normal (1s)</option>
                <option value="slow">Thoughtful (1.5s)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Booking Enabled</Label>
                <p className="text-sm text-muted-foreground">Allow AI to schedule appointments</p>
              </div>
              <Switch defaultChecked={aiConfig?.booking_enabled || true} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Transfer to Human</Label>
                <p className="text-sm text-muted-foreground">Option to transfer complex calls</p>
              </div>
              <Switch defaultChecked={aiConfig?.human_transfer_enabled || false} />
            </div>
          </CardContent>
        </Card>

        {/* Services Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Services & Pricing
            </CardTitle>
            <CardDescription>Configure available services and pricing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Available Services</Label>
              <Textarea
                placeholder="List your services, one per line:&#10;Consultation - $100&#10;Follow-up - $50&#10;Emergency - $200"
                defaultValue={profile?.services?.join("\n") || ""}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="booking-buffer">Booking Buffer (minutes)</Label>
              <Input
                id="booking-buffer"
                type="number"
                placeholder="15"
                defaultValue={aiConfig?.booking_buffer_minutes || 15}
              />
            </div>
          </CardContent>
        </Card>

        {/* Phone Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Phone Settings
            </CardTitle>
            <CardDescription>Configure phone number and call handling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone-number">Business Phone Number</Label>
              <Input id="phone-number" placeholder="+1 (555) 123-4567" defaultValue={profile?.phone_number || ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="voicemail">Voicemail Message</Label>
              <Textarea
                id="voicemail"
                placeholder="You've reached [Business Name]. Please leave a message and we'll get back to you soon."
                defaultValue={aiConfig?.voicemail_message || ""}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Call Recording</Label>
                <p className="text-sm text-muted-foreground">Record calls for quality assurance</p>
              </div>
              <Switch defaultChecked={aiConfig?.call_recording_enabled || false} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
          Save Configuration
        </Button>
      </div>
    </div>
  )
}
