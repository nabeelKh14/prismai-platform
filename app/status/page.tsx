'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, Activity, Database, Shield, Zap, Globe } from 'lucide-react'

interface SystemStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: { status: string; response_time_ms?: number; error?: string; details?: any }
    authentication: { status: string; response_time_ms?: number; error?: string; details?: any }
    external_services: { status: string; response_time_ms?: number; error?: string; details?: any }
    system_resources: { status: string; response_time_ms?: number; error?: string; details?: any }
    tenant_system: { status: string; response_time_ms?: number; error?: string; details?: any }
    application: { status: string; response_time_ms?: number; error?: string; details?: any }
  }
}

interface Incident {
  id: string
  title: string
  description: string
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  severity: 'minor' | 'major' | 'critical'
  created_at: string
  updated_at: string
  affected_services: string[]
}

export default function StatusPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchStatus = async () => {
    try {
      setLoading(true)

      // Fetch system health
      const healthResponse = await fetch('/api/health')
      const healthData = await healthResponse.json()
      setSystemStatus(healthData)

      // Mock incidents data (in production, this would come from an API)
      setIncidents([
        {
          id: 'incident-1',
          title: 'API Response Time Degradation',
          description: 'We are experiencing slightly elevated API response times. Our engineering team is investigating and implementing optimizations.',
          status: 'monitoring',
          severity: 'minor',
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          affected_services: ['API', 'Dashboard']
        }
      ])

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()

    // Update every 60 seconds
    const interval = setInterval(fetchStatus, 60000)

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
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'unhealthy': return <XCircle className="h-5 w-5 text-red-600" />
      default: return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getIncidentStatusColor = (status: string) => {
    switch (status) {
      case 'investigating': return 'bg-yellow-100 text-yellow-800'
      case 'identified': return 'bg-orange-100 text-orange-800'
      case 'monitoring': return 'bg-blue-100 text-blue-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getIncidentSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-yellow-100 text-yellow-800'
      case 'major': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const getOverallStatus = () => {
    if (!systemStatus) return 'unknown'

    const statuses = Object.values(systemStatus.checks).map(check => check.status)
    if (statuses.includes('unhealthy')) return 'unhealthy'
    if (statuses.includes('degraded')) return 'degraded'
    return 'healthy'
  }

  const overallStatus = getOverallStatus()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Globe className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">System Status</h1>
          </div>
          <p className="text-lg text-gray-600 mb-4">
            Current status and uptime of our services
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
            <span>Last updated: {lastUpdate.toLocaleString()}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {getStatusIcon(overallStatus)}
                <div>
                  <h2 className="text-2xl font-bold">All Systems Operational</h2>
                  <p className="text-gray-600">
                    {overallStatus === 'healthy' && 'All services are running normally'}
                    {overallStatus === 'degraded' && 'Some services are experiencing minor issues'}
                    {overallStatus === 'unhealthy' && 'Some services are currently unavailable'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Uptime</div>
                <div className="text-lg font-semibold">
                  {systemStatus ? formatUptime(systemStatus.uptime) : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {systemStatus && Object.entries(systemStatus.checks).map(([service, status]) => (
            <Card key={service}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium capitalize">
                  {service.replace('_', ' ')}
                </CardTitle>
                {getStatusIcon(status.status)}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant={status.status === 'healthy' ? 'default' : 'destructive'}
                    className="capitalize"
                  >
                    {status.status}
                  </Badge>
                  {status.response_time_ms && (
                    <span className="text-sm text-gray-500">
                      {status.response_time_ms}ms
                    </span>
                  )}
                </div>
                {status.error && (
                  <p className="text-sm text-red-600 mt-2">{status.error}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System Metrics */}
        {systemStatus && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>System Metrics</CardTitle>
              <CardDescription>Current system resource utilization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Memory Usage</span>
                    <span>
                      {systemStatus.checks.system_resources.details?.memory_mb?.heapUsed || 0} MB
                    </span>
                  </div>
                  <Progress
                    value={(systemStatus.checks.system_resources.details?.memory_mb?.heapUsed || 0) / 10}
                    className="h-2"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>CPU Usage</span>
                    <span>
                      {systemStatus.checks.system_resources.details?.cpu_percent || 0}%
                    </span>
                  </div>
                  <Progress
                    value={systemStatus.checks.system_resources.details?.cpu_percent || 0}
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Incidents */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
            <CardDescription>Current service disruptions and maintenance</CardDescription>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">All Systems Operational</h3>
                <p className="text-gray-600">
                  No active incidents at this time. All services are running normally.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <Alert key={incident.id} className="border-l-4 border-l-orange-500">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="flex items-center gap-2 mb-2">
                      {incident.title}
                      <Badge className={getIncidentSeverityColor(incident.severity)}>
                        {incident.severity}
                      </Badge>
                      <Badge className={getIncidentStatusColor(incident.status)}>
                        {incident.status}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription>
                      <p className="mb-3">{incident.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Started: {new Date(incident.created_at).toLocaleString()}</span>
                        <span>Updated: {new Date(incident.updated_at).toLocaleString()}</span>
                      </div>
                      {incident.affected_services.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm text-gray-500">Affected services: </span>
                          {incident.affected_services.map((service) => (
                            <Badge key={service} variant="outline" className="mr-1">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Incident History */}
        <Card>
          <CardHeader>
            <CardTitle>Incident History</CardTitle>
            <CardDescription>Past incidents and their resolutions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Database Maintenance</h4>
                  <Badge className="bg-green-100 text-green-800">Resolved</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Scheduled database maintenance completed successfully with no service disruption.
                </p>
                <div className="text-xs text-gray-500">
                  Resolved on {new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">API Rate Limiting Issue</h4>
                  <Badge className="bg-green-100 text-green-800">Resolved</Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Temporary rate limiting issue has been resolved. API performance has returned to normal.
                </p>
                <div className="text-xs text-gray-500">
                  Resolved on {new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            For urgent issues, please contact our support team at{' '}
            <a href="mailto:support@prismai.com" className="text-blue-600 hover:underline">
              support@prismai.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}