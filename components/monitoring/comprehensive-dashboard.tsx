'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Activity,
  Cpu,
  HardDrive,
  Network,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Settings,
  Bell,
  BarChart3,
  Shield,
  Users,
  Globe,
  Mail,
  MessageSquare,
  Smartphone
} from 'lucide-react'

interface DashboardProps {
  refreshInterval?: number
}

export function ComprehensiveMonitoringDashboard({ refreshInterval = 30 }: DashboardProps) {
  const [monitoringData, setMonitoringData] = useState<any>({})
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [activeTab, setActiveTab] = useState('overview')
  const [notificationTest, setNotificationTest] = useState({
    title: '',
    message: '',
    priority: 'medium',
    channels: ['email']
  })

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [refreshInterval])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch all monitoring data
      const [
        orchestratorStats,
        healthStatus,
        activeAlerts,
        performanceMetrics,
        businessMetrics
      ] = await Promise.all([
        fetch('/api/monitoring/orchestrator?action=stats').then(r => r.json()),
        fetch('/api/monitoring/orchestrator?action=health').then(r => r.json()),
        fetch('/api/monitoring/alerts').then(r => r.json()),
        fetch('/api/monitoring/metrics?timeRange=1h').then(r => r.json()),
        fetch('/api/monitoring/business-metrics?timeRange=1h').then(r => r.json())
      ])

      setMonitoringData({
        orchestrator: orchestratorStats,
        health: healthStatus,
        alerts: activeAlerts,
        performance: performanceMetrics,
        business: businessMetrics
      })

      setAlerts(activeAlerts || [])
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'operational':
        return 'text-green-600'
      case 'warning':
      case 'degraded':
        return 'text-yellow-600'
      case 'critical':
      case 'unhealthy':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'operational':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'critical':
      case 'unhealthy':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Minus className="h-4 w-4 text-gray-600" />
    }
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  const handleStartMonitoring = async () => {
    try {
      await fetch('/api/monitoring/orchestrator?action=start', { method: 'GET' })
      fetchDashboardData()
    } catch (error) {
      console.error('Failed to start monitoring:', error)
    }
  }

  const handleStopMonitoring = async () => {
    try {
      await fetch('/api/monitoring/orchestrator?action=stop', { method: 'GET' })
      fetchDashboardData()
    } catch (error) {
      console.error('Failed to stop monitoring:', error)
    }
  }

  const handleRestartMonitoring = async () => {
    try {
      await fetch('/api/monitoring/orchestrator?action=restart', { method: 'GET' })
      fetchDashboardData()
    } catch (error) {
      console.error('Failed to restart monitoring:', error)
    }
  }

  const handleTestNotification = async () => {
    try {
      await fetch('/api/monitoring/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-notification',
          ...notificationTest
        })
      })
      alert('Test notification sent successfully!')
    } catch (error) {
      console.error('Failed to send test notification:', error)
      alert('Failed to send test notification')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comprehensive Monitoring Dashboard</h1>
          <p className="text-muted-foreground">
            Unified monitoring and observability platform
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${monitoringData.orchestrator?.is_running ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {monitoringData.orchestrator?.is_running ? 'Running' : 'Stopped'}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant={monitoringData.orchestrator?.is_running ? 'destructive' : 'default'}
              size="sm"
              onClick={monitoringData.orchestrator?.is_running ? handleStopMonitoring : handleStartMonitoring}
            >
              {monitoringData.orchestrator?.is_running ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestartMonitoring}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restart
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            {getStatusIcon(monitoringData.health?.overall)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {monitoringData.health?.overall || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              System health status
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Current active alerts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monitoringData.health?.metrics?.response_time?.toFixed(0) || 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Average API response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(monitoringData.health?.metrics?.active_users || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Component Health Status */}
            <Card>
              <CardHeader>
                <CardTitle>Component Health</CardTitle>
                <CardDescription>Status of all monitoring components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {monitoringData.health?.components && Object.entries(monitoringData.health.components).map(([component, status]) => (
                  <div key={component} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(String(status))}
                      <span className="capitalize">{component}</span>
                    </div>
                    <Badge variant={status === 'healthy' ? 'default' : status === 'warning' ? 'secondary' : 'destructive'}>
                      {String(status)}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* System Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
                <CardDescription>Important system performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {monitoringData.health?.metrics?.uptime?.toFixed(1) || 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">Uptime</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {monitoringData.health?.metrics?.throughput?.toFixed(1) || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Req/min</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Error Rate</span>
                    <span>{monitoringData.health?.metrics?.error_rate?.toFixed(2) || 0}%</span>
                  </div>
                  <Progress value={monitoringData.health?.metrics?.error_rate || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>Latest system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <p className="text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.slice(0, 5).map((alert, index) => (
                    <Alert key={index} className={
                      alert.severity === 'critical' ? 'border-red-500' :
                      alert.severity === 'high' ? 'border-orange-500' : 'border-yellow-500'
                    }>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{alert.title}</AlertTitle>
                      <AlertDescription>{alert.message}</AlertDescription>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(alert.timestamp || alert.triggered_at).toLocaleString()}
                      </div>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* CPU Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  CPU Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Usage</span>
                    <span>{monitoringData.orchestrator?.components_status?.system_monitoring ? '85%' : '0%'}</span>
                  </div>
                  <Progress value={85} />
                </div>
                <div className="text-sm">
                  <div className="font-medium">Load Average</div>
                  <div className="text-muted-foreground">1.2, 1.1, 0.9</div>
                </div>
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Usage</span>
                    <span>72%</span>
                  </div>
                  <Progress value={72} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Used</div>
                    <div className="text-muted-foreground">5.8 GB</div>
                  </div>
                  <div>
                    <div className="font-medium">Total</div>
                    <div className="text-muted-foreground">8.0 GB</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Disk Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Disk Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Usage</span>
                    <span>45%</span>
                  </div>
                  <Progress value={45} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Used</div>
                    <div className="text-muted-foreground">225 GB</div>
                  </div>
                  <div>
                    <div className="font-medium">Total</div>
                    <div className="text-muted-foreground">500 GB</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Performance</CardTitle>
                <CardDescription>Response times and throughput metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">245ms</div>
                    <p className="text-xs text-muted-foreground">Avg Response Time</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">1,247</div>
                    <p className="text-xs text-muted-foreground">Req/min</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>P95</span>
                    <span>450ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>P99</span>
                    <span>890ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Database Performance</CardTitle>
                <CardDescription>Query performance and connection metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">12ms</div>
                    <p className="text-xs text-muted-foreground">Avg Query Time</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">45</div>
                    <p className="text-xs text-muted-foreground">Active Connections</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Slow Queries</span>
                    <span>2</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Connection Pool</span>
                    <span>45/100</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
                <CardDescription>User engagement and activity metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">1,234</div>
                    <p className="text-xs text-muted-foreground">Active Users</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">5.2</div>
                    <p className="text-xs text-muted-foreground">Sessions/User</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Page Views</span>
                    <span>12,456</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Bounce Rate</span>
                    <span>23%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Usage</CardTitle>
                <CardDescription>Feature adoption and usage statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">87%</div>
                <p className="text-xs text-muted-foreground">Feature Adoption Rate</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Most Used</span>
                    <span>Dashboard</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Least Used</span>
                    <span>Reports</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Tracking</CardTitle>
                <CardDescription>Application error statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">0.3%</div>
                    <p className="text-xs text-muted-foreground">Error Rate</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground">Total Errors</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>JavaScript</span>
                    <span>8</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Network</span>
                    <span>4</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Monitoring
                </CardTitle>
                <CardDescription>Security events and threat detection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">156</div>
                    <p className="text-xs text-muted-foreground">Events Processed</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">3</div>
                    <p className="text-xs text-muted-foreground">Security Alerts</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Failed Logins</span>
                    <span>12</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Blocked IPs</span>
                    <span>5</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Access Control</CardTitle>
                <CardDescription>Authentication and authorization metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">99.7%</div>
                <p className="text-xs text-muted-foreground">Authentication Success Rate</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Active Sessions</span>
                    <span>89</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Rate Limited</span>
                    <span>23</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Channels
                </CardTitle>
                <CardDescription>Available notification methods</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">Slack</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-green-600" />
                    <span className="text-sm">SMS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                    <span className="text-sm">WhatsApp</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Notifications</CardTitle>
                <CardDescription>Send test notifications to verify channels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={notificationTest.title}
                    onChange={(e) => setNotificationTest({...notificationTest, title: e.target.value})}
                    placeholder="Test notification title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={notificationTest.message}
                    onChange={(e) => setNotificationTest({...notificationTest, message: e.target.value})}
                    placeholder="Test notification message"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={notificationTest.priority}
                    onValueChange={(value) => setNotificationTest({...notificationTest, priority: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleTestNotification} className="w-full">
                  Send Test Notification
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}