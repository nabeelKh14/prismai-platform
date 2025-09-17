'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RefreshCw, Activity, Database, Shield, Zap, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms?: number
  error?: string
  details?: Record<string, any>
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: HealthStatus
    authentication: HealthStatus
    external_services: HealthStatus
    system_resources: HealthStatus
    tenant_system: HealthStatus
    application: HealthStatus
  }
}

interface MetricsData {
  activeChats: number
  queueLength: number
  averageResponseTime: number
  totalAgents: number
  onlineAgents: number
  resolvedToday: number
  abandonedToday: number
  satisfactionScore: number
}

interface AlertData {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  status: 'active' | 'acknowledged' | 'resolved'
  triggered_at: string
  resolved_at?: string
  acknowledged_at?: string
  acknowledged_by?: string
  channels_notified: string[]
  metadata: Record<string, any>
}

export default function MonitoringDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [alerts, setAlerts] = useState<AlertData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const { toast } = useToast()

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'acknowledge',
          alertId
        })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Alert acknowledged successfully'
        })
        fetchData() // Refresh data
      } else {
        throw new Error('Failed to acknowledge alert')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert',
        variant: 'destructive'
      })
    }
  }

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resolve',
          alertId
        })
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Alert resolved successfully'
        })
        fetchData() // Refresh data
      } else {
        throw new Error('Failed to resolve alert')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve alert',
        variant: 'destructive'
      })
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch comprehensive dashboard data
      const response = await fetch('/api/monitoring/dashboard')
      const data = await response.json()

      if (response.ok) {
        setSystemHealth(data.systemHealth)
        setMetrics({
          activeChats: data.conversationMetrics.active_conversations,
          queueLength: data.conversationMetrics.waiting_conversations,
          averageResponseTime: data.keyMetrics.average_response_time,
          totalAgents: data.agentMetrics.total_agents,
          onlineAgents: data.agentMetrics.online_agents,
          resolvedToday: data.keyMetrics.total_api_requests,
          abandonedToday: 0, // TODO: Add abandoned conversations metric
          satisfactionScore: 95 // TODO: Add satisfaction score from data
        })
        setAlerts(data.recentAlerts)
      } else {
        throw new Error(data.error || 'Failed to fetch dashboard data')
      }

      setLastUpdate(new Date())
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch monitoring data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchData, 30000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'unhealthy': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-600" />
      default: return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  if (loading && !systemHealth) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time system health and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
          <Button onClick={fetchData} disabled={loading} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
          <CardDescription>
            Overall system health and key indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              {getStatusIcon(systemHealth?.status || 'unknown')}
              <div>
                <p className="text-sm font-medium">Overall Status</p>
                <p className={`text-lg font-bold capitalize ${getStatusColor(systemHealth?.status || 'unknown')}`}>
                  {systemHealth?.status || 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Database</p>
                <p className={`text-lg font-bold capitalize ${getStatusColor(systemHealth?.checks.database.status || 'unknown')}`}>
                  {systemHealth?.checks.database.status || 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Authentication</p>
                <p className={`text-lg font-bold capitalize ${getStatusColor(systemHealth?.checks.authentication.status || 'unknown')}`}>
                  {systemHealth?.checks.authentication.status || 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">API Performance</p>
                <p className="text-lg font-bold">
                  {systemHealth?.checks.system_resources.details?.cpu_percent || 0}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.activeChats || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Currently active conversations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Queue Length</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.queueLength || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Conversations waiting
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.averageResponseTime || 0}s</div>
                <p className="text-xs text-muted-foreground">
                  Average agent response time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Satisfaction Score</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.satisfactionScore || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  Customer satisfaction rating
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Resources */}
          <Card>
            <CardHeader>
              <CardTitle>System Resources</CardTitle>
              <CardDescription>Current system resource utilization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Memory Usage</span>
                  <span>{systemHealth?.checks.system_resources.details?.memory_mb?.heapUsed || 0} MB</span>
                </div>
                <Progress value={(systemHealth?.checks.system_resources.details?.memory_mb?.heapUsed || 0) / 10} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>CPU Usage</span>
                  <span>{systemHealth?.checks.system_resources.details?.cpu_percent || 0}%</span>
                </div>
                <Progress value={systemHealth?.checks.system_resources.details?.cpu_percent || 0} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemHealth && Object.entries(systemHealth.checks).map(([component, status]) => (
              <Card key={component}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 capitalize">
                    {getStatusIcon(status.status)}
                    {component.replace('_', ' ')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Badge variant={status.status === 'healthy' ? 'default' : 'destructive'}>
                      {status.status}
                    </Badge>
                    {status.response_time_ms && (
                      <p className="text-sm text-muted-foreground">
                        Response time: {status.response_time_ms}ms
                      </p>
                    )}
                    {status.error && (
                      <p className="text-sm text-red-600">{status.error}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">System Alerts</h3>
              <p className="text-sm text-muted-foreground">
                Monitor and manage system alerts and notifications
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Refresh alerts
                  fetchData()
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-muted-foreground">No active alerts</p>
                    <p className="text-sm text-muted-foreground">All systems are operating normally</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              alerts.map((alert) => (
                <Alert key={alert.id} className={
                  alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                  alert.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                  alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {alert.title}
                      <Badge variant={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      <Badge variant="outline">
                        {alert.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {alert.status === 'active' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleResolveAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        </>
                      )}
                      {alert.status === 'acknowledged' && (
                        <Badge variant="secondary">Acknowledged</Badge>
                      )}
                      {alert.status === 'resolved' && (
                        <Badge variant="default">Resolved</Badge>
                      )}
                    </div>
                  </AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">{alert.message}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Triggered: {new Date(alert.triggered_at).toLocaleString()}</span>
                      {alert.acknowledged_at && (
                        <span>Acknowledged: {new Date(alert.acknowledged_at).toLocaleString()}</span>
                      )}
                      {alert.resolved_at && (
                        <span>Resolved: {new Date(alert.resolved_at).toLocaleString()}</span>
                      )}
                    </div>
                    {alert.channels_notified && alert.channels_notified.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">
                          Notified via: {alert.channels_notified.join(', ')}
                        </p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}