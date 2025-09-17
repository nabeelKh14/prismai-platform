"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  CreditCard,
  Phone,
  Mail,
  Globe,
  Key,
  Save,
  AlertTriangle
} from "lucide-react"

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    // Profile settings
    businessName: "Your Business",
    businessType: "Technology",
    contactEmail: "contact@yourbusiness.com",
    contactPhone: "+1 (555) 123-4567",
    website: "https://yourbusiness.com",
    timezone: "America/New_York",
    
    // AI Assistant settings
    assistantName: "PrismAI Assistant",
    greetingMessage: "Hello! Thank you for calling. How can I assist you today?",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    responseStyle: "professional",
    
    // Notification settings
    emailNotifications: true,
    smsNotifications: false,
    callAlerts: true,
    bookingAlerts: true,
    weeklyReports: true,
    
    // Security settings
    twoFactorAuth: false,
    sessionTimeout: "24",
    allowedDomains: "",
    
    // Billing settings
    currentPlan: "Growth",
    billingEmail: "billing@yourbusiness.com",
    autoRenew: true
  })

  const handleSave = async (section: string) => {
    setLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setLoading(false)
    // Show success message
  }

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-2">
            Manage your account, AI services, and business configuration
          </p>
        </div>
        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
          <SettingsIcon className="h-3 w-3 mr-1" />
          All Services Active
        </Badge>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-gray-800/50 border-gray-700">
          <TabsTrigger value="profile" className="data-[state=active]:bg-gray-700">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="ai-assistant" className="data-[state=active]:bg-gray-700">
            <Phone className="h-4 w-4 mr-2" />
            AI Assistant
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-gray-700">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-gray-700">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-gray-700">
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Business Profile</CardTitle>
              <CardDescription>Update your business information and contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName" className="text-gray-300">Business Name</Label>
                  <Input
                    id="businessName"
                    value={settings.businessName}
                    onChange={(e) => updateSetting('businessName', e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType" className="text-gray-300">Business Type</Label>
                  <Select value={settings.businessType} onValueChange={(value) => updateSetting('businessType', value)}>
                    <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="healthcare">Healthcare</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail" className="text-gray-300">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) => updateSetting('contactEmail', e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone" className="text-gray-300">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={settings.contactPhone}
                    onChange={(e) => updateSetting('contactPhone', e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-gray-300">Website</Label>
                  <Input
                    id="website"
                    value={settings.website}
                    onChange={(e) => updateSetting('website', e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-gray-300">Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(value) => updateSetting('timezone', value)}>
                    <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={() => handleSave('profile')} disabled={loading} className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-assistant" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">AI Assistant Configuration</CardTitle>
              <CardDescription>Customize your AI receptionist's behavior and responses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assistantName" className="text-gray-300">Assistant Name</Label>
                <Input
                  id="assistantName"
                  value={settings.assistantName}
                  onChange={(e) => updateSetting('assistantName', e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="greetingMessage" className="text-gray-300">Greeting Message</Label>
                <Textarea
                  id="greetingMessage"
                  value={settings.greetingMessage}
                  onChange={(e) => updateSetting('greetingMessage', e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="voiceId" className="text-gray-300">Voice Selection</Label>
                  <Select value={settings.voiceId} onValueChange={(value) => updateSetting('voiceId', value)}>
                    <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="21m00Tcm4TlvDq8ikWAM">Professional Female</SelectItem>
                      <SelectItem value="EXAVITQu4vr4xnSDxMaL">Professional Male</SelectItem>
                      <SelectItem value="VR6AewLTigWG4xSOukaG">Friendly Female</SelectItem>
                      <SelectItem value="pNInz6obpgDQGcFmaJgB">Friendly Male</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responseStyle" className="text-gray-300">Response Style</Label>
                  <Select value={settings.responseStyle} onValueChange={(value) => updateSetting('responseStyle', value)}>
                    <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={() => handleSave('ai-assistant')} disabled={loading} className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save AI Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified about important events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-gray-300">Email Notifications</Label>
                    <p className="text-sm text-gray-400">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => updateSetting('emailNotifications', checked)}
                  />
                </div>

                <Separator className="bg-gray-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-gray-300">SMS Notifications</Label>
                    <p className="text-sm text-gray-400">Receive notifications via SMS</p>
                  </div>
                  <Switch
                    checked={settings.smsNotifications}
                    onCheckedChange={(checked) => updateSetting('smsNotifications', checked)}
                  />
                </div>

                <Separator className="bg-gray-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-gray-300">Call Alerts</Label>
                    <p className="text-sm text-gray-400">Get notified when calls are received</p>
                  </div>
                  <Switch
                    checked={settings.callAlerts}
                    onCheckedChange={(checked) => updateSetting('callAlerts', checked)}
                  />
                </div>

                <Separator className="bg-gray-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-gray-300">Booking Alerts</Label>
                    <p className="text-sm text-gray-400">Get notified when appointments are booked</p>
                  </div>
                  <Switch
                    checked={settings.bookingAlerts}
                    onCheckedChange={(checked) => updateSetting('bookingAlerts', checked)}
                  />
                </div>

                <Separator className="bg-gray-700" />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-gray-300">Weekly Reports</Label>
                    <p className="text-sm text-gray-400">Receive weekly performance summaries</p>
                  </div>
                  <Switch
                    checked={settings.weeklyReports}
                    onCheckedChange={(checked) => updateSetting('weeklyReports', checked)}
                  />
                </div>
              </div>

              <Button onClick={() => handleSave('notifications')} disabled={loading} className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save Notifications'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Security Settings</CardTitle>
              <CardDescription>Manage your account security and access controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-gray-300">Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-400">Add an extra layer of security to your account</p>
                </div>
                <Switch
                  checked={settings.twoFactorAuth}
                  onCheckedChange={(checked) => updateSetting('twoFactorAuth', checked)}
                />
              </div>

              <Separator className="bg-gray-700" />

              <div className="space-y-2">
                <Label htmlFor="sessionTimeout" className="text-gray-300">Session Timeout (hours)</Label>
                <Select value={settings.sessionTimeout} onValueChange={(value) => updateSetting('sessionTimeout', value)}>
                  <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allowedDomains" className="text-gray-300">Allowed Email Domains</Label>
                <Input
                  id="allowedDomains"
                  placeholder="yourdomain.com, anotherdomain.com"
                  value={settings.allowedDomains}
                  onChange={(e) => updateSetting('allowedDomains', e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white"
                />
                <p className="text-sm text-gray-400">Leave empty to allow all domains</p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <span className="text-yellow-400 font-medium">Security Recommendation</span>
                </div>
                <p className="text-sm text-gray-300 mt-2">
                  Enable two-factor authentication and restrict email domains for enhanced security.
                </p>
              </div>

              <Button onClick={() => handleSave('security')} disabled={loading} className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : 'Save Security Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Billing & Subscription</CardTitle>
              <CardDescription>Manage your subscription and billing information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gradient-to-r from-cyan-500/10 to-pink-500/10 border border-cyan-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Current Plan: {settings.currentPlan}</h3>
                    <p className="text-gray-400 text-sm">$299/month - Billed monthly</p>
                  </div>
                  <Badge className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white">
                    Active
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingEmail" className="text-gray-300">Billing Email</Label>
                <Input
                  id="billingEmail"
                  type="email"
                  value={settings.billingEmail}
                  onChange={(e) => updateSetting('billingEmail', e.target.value)}
                  className="bg-gray-700/50 border-gray-600 text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-gray-300">Auto-Renew Subscription</Label>
                  <p className="text-sm text-gray-400">Automatically renew your subscription</p>
                </div>
                <Switch
                  checked={settings.autoRenew}
                  onCheckedChange={(checked) => updateSetting('autoRenew', checked)}
                />
              </div>

              <div className="flex space-x-3">
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                  Change Plan
                </Button>
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                  View Invoices
                </Button>
                <Button onClick={() => handleSave('billing')} disabled={loading} className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Billing'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}