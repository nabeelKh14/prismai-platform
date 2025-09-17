'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  RefreshCw
} from 'lucide-react'

interface DashboardProps {
  refreshInterval?: number // seconds
}

export function PerformanceDashboard({ refreshInterval = 30 }: DashboardProps) {
  const [metrics, setMetrics] = useState<any>({})
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [timeRange, setTimeRange] = useState('1h')

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [timeRange, refreshInterval])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch all monitoring data
      const [
        systemHealth,
        performanceMetrics,
        resourceUsage,
        loadBalancerStats,
        cdnAnalytics,
        databaseStats
      ] = await Promise.all([
        fetch('/api/monitoring/system-health').then(r => r.json()),
        fetch(`/api/monitoring/metrics?timeRange=${timeRange}`).then(r => r.json()),
        fetch('/api/monitoring/resources').then(r => r.json()),
        fetch('/api/monitoring/load-balancer').then(r => r.json()),
        fetch('/api/monitoring/cdn').then(r => r.json()),
        fetch('/api/monitoring/database').then(r => r.json())
      ])

      setMetrics({
        systemHealth,
        performanceMetrics,
        resourceUsage,
        loadBalancerStats,
        cdnAnalytics,
        databaseStats
      })

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and observability
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">15 minutes</SelectItem>
              <SelectItem value="1h">1 hour</SelectItem>
              <SelectItem value="4h">4 hours</SelectItem>
              <SelectItem value="24h">24 hours</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <span className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            {getStatusIcon(metrics.systemHealth?.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {metrics.systemHealth?.status || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              Overall system status
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(metrics.loadBalancerStats?.totalConnections || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Current active connections
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
              {metrics.performanceMetrics?.averageResponseTime?.toFixed(0) || 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Average API response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.performanceMetrics?.errorRate?.toFixed(2) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              System error rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system">System Resources</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="network">Network & CDN</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <span>{metrics.resourceUsage?.cpu?.usage?.toFixed(1) || 0}%</span>
                  </div>
                  <Progress value={metrics.resourceUsage?.cpu?.usage || 0} />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Load Average</div>
                    <div className="text-muted-foreground">
                      1m: {metrics.resourceUsage?.cpu?.loadAverage?.[0]?.toFixed(2) || 0}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Cores</div>
                    <div className="text-muted-foreground">
                      {metrics.resourceUsage?.cpu?.cores || 0}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Status</div>
                    <Badge variant={metrics.resourceUsage?.cpu?.usage > 80 ? 'destructive' : 'default'}>
                      {metrics.resourceUsage?.cpu?.usage > 80 ? 'High' : 'Normal'}
                    </Badge>
                  </div>
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
                    <span>{metrics.resourceUsage?.memory?.usage?.toFixed(1) || 0}%</span>
                  </div>
                  <Progress value={metrics.resourceUsage?.memory?.usage || 0} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Used</div>
                    <div className="text-muted-foreground">
                      {formatBytes(metrics.resourceUsage?.memory?.used || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Total</div>
                    <div className="text-muted-foreground">
                      {formatBytes(metrics.resourceUsage?.memory?.total || 0)}
                    </div>
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
                    <span>{metrics.resourceUsage?.disk?.usage?.toFixed(1) || 0}%</span>
                  </div>
                  <Progress value={metrics.resourceUsage?.disk?.usage || 0} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Used</div>
                    <div className="text-muted-foreground">
                      {formatBytes(metrics.resourceUsage?.disk?.used || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Total</div>
                    <div className="text-muted-foreground">
                      {formatBytes(metrics.resourceUsage?.disk?.total || 0)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Network I/O */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Network I/O
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">RX/sec</div>
                    <div className="text-muted-foreground">
                      {formatBytes(metrics.resourceUsage?.network?.rxBytesPerSecond || 0)}/s
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">TX/sec</div>
                    <div className="text-muted-foreground">
                      {formatBytes(metrics.resourceUsage?.network?.txBytesPerSecond || 0)}/s
                    </div>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Active Connections</div>
                  <div className="text-muted-foreground">
                    {formatNumber(metrics.resourceUsage?.network?.activeConnections || 0)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Performance</CardTitle>
                <CardDescription>Response times and throughput</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.performanceMetrics?.averageResponseTime?.toFixed(0) || 0}ms
                    </div>
                    <p className="text-xs text-muted-foreground">Avg Response Time</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.performanceMetrics?.requestsPerSecond?.toFixed(1) || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Requests/sec</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>P95</span>
                    <span>{metrics.performanceMetrics?.p95ResponseTime?.toFixed(0) || 0}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>P99</span>
                    <span>{metrics.performanceMetrics?.p99ResponseTime?.toFixed(0) || 0}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Performance</CardTitle>
                <CardDescription>Hit rates and efficiency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">
                  {metrics.databaseStats?.cacheEfficiency?.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">Cache Hit Rate</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Hits</span>
                    <span>{formatNumber(metrics.databaseStats?.cacheHits || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Misses</span>
                    <span>{formatNumber(metrics.databaseStats?.cacheMisses || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Load Balancer</CardTitle>
                <CardDescription>Server distribution and health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.loadBalancerStats?.healthyServers || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Healthy Servers</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.loadBalancerStats?.averageLoad?.toFixed(1) || 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">Avg Load</p>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Total Servers</div>
                  <div className="text-muted-foreground">
                    {metrics.loadBalancerStats?.totalServers || 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.databaseStats?.queryCount || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Total Queries</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.databaseStats?.slowQueries || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">Slow Queries</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Avg Query Time</span>
                    <span>{metrics.databaseStats?.avgQueryTime?.toFixed(2) || 0}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Connection Pool</span>
                    <span>{metrics.databaseStats?.activeConnections || 0}/{metrics.databaseStats?.totalConnections || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Database Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(metrics.databaseStats?.status)}
                  <span className="capitalize">{metrics.databaseStats?.status || 'Unknown'}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Tables</span>
                    <span>{metrics.databaseStats?.tableCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Indexes</span>
                    <span>{metrics.databaseStats?.indexCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size</span>
                    <span>{formatBytes(metrics.databaseStats?.databaseSize || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>CDN Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.cdnAnalytics?.cacheHitRate?.toFixed(1) || 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">Cache Hit Rate</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.cdnAnalytics?.responseTime?.toFixed(0) || 0}ms
                    </div>
                    <p className="text-xs text-muted-foreground">Avg Response Time</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Requests</span>
                    <span>{formatNumber(metrics.cdnAnalytics?.requests || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Data Transferred</span>
                    <span>{formatBytes(metrics.cdnAnalytics?.bytesTransferred || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Network Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(metrics.resourceUsage?.network?.status)}
                  <span className="capitalize">{metrics.resourceUsage?.network?.status || 'Unknown'}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Latency</span>
                    <span>{metrics.resourceUsage?.network?.latency?.toFixed(2) || 0}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Packet Loss</span>
                    <span>{metrics.resourceUsage?.network?.packetLoss?.toFixed(2) || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bandwidth</span>
                    <span>{formatBytes((metrics.resourceUsage?.network?.rxBytesPerSecond || 0) + (metrics.resourceUsage?.network?.txBytesPerSecond || 0))}/s</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>Current system alerts and warnings</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <p className="text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert, index) => (
                    <Alert key={index} className={alert.severity === 'critical' ? 'border-red-500' : alert.severity === 'warning' ? 'border-yellow-500' : 'border-blue-500'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{alert.title}</AlertTitle>
                      <AlertDescription>{alert.message}</AlertDescription>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}