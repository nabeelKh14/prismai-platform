"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap, 
  Github, 
  Mail, 
  Building, 
  MessageSquare,
  TrendingUp,
  Activity,
  AlertCircle
} from "lucide-react"

interface MCPService {
  name: string
  capabilities: string[]
  status: 'healthy' | 'unhealthy' | 'connecting'
  lastPing?: string
  description: string
  freeLimit?: string
}

interface MCPStats {
  totalEnhancements: number
  avgScoreImprovement: number
  topSources: string[]
  successRate: number
}

export function MCPDashboard() {
  const [services, setServices] = useState<MCPService[]>([])
  const [stats, setStats] = useState<MCPStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  const mcpServices: MCPService[] = [
    {
      name: 'github-mcp',
      capabilities: ['Profile Analysis', 'Repository Data', 'Activity Tracking'],
      status: 'healthy',
      description: 'Analyze developer profiles and GitHub activity for lead scoring',
      freeLimit: 'Unlimited (public profiles)',
      lastPing: '2 minutes ago'
    },
    {
      name: 'clearbit-mcp',
      capabilities: ['Company Enrichment', 'Person Enrichment', 'Email Verification'],
      status: 'healthy',
      description: 'Enrich leads with company intelligence data',
      freeLimit: '50 enrichments/month',
      lastPing: '3 minutes ago'
    },
    {
      name: 'hunter-mcp',
      capabilities: ['Email Finder', 'Email Verifier', 'Domain Search'],
      status: 'healthy',
      description: 'Verify email deliverability and find contact information',
      freeLimit: '25 searches/month',
      lastPing: '5 minutes ago'
    },
    {
      name: 'stackoverflow-mcp',
      capabilities: ['Question Search', 'Answer Retrieval', 'Tag Analysis'],
      status: 'healthy',
      description: 'Technical expertise analysis for developer leads',
      freeLimit: 'Unlimited',
      lastPing: '1 minute ago'
    },
    {
      name: 'reddit-mcp',
      capabilities: ['Sentiment Analysis', 'Trend Detection', 'Community Insights'],
      status: 'healthy',
      description: 'Market sentiment and industry trend analysis',
      freeLimit: 'Unlimited',
      lastPing: '4 minutes ago'
    },
    {
      name: 'discord-mcp',
      capabilities: ['Message Handling', 'User Management', 'Channel Automation'],
      status: 'connecting',
      description: 'Extend chatbot to Discord communities',
      freeLimit: 'Unlimited',
      lastPing: 'Connecting...'
    },
    {
      name: 'telegram-mcp',
      capabilities: ['Bot Messaging', 'Group Management', 'Inline Queries'],
      status: 'connecting',
      description: 'Global customer support via Telegram',
      freeLimit: 'Unlimited',
      lastPing: 'Connecting...'
    }
  ]

  const mockStats: MCPStats = {
    totalEnhancements: 1247,
    avgScoreImprovement: 23.5,
    topSources: ['GitHub', 'Clearbit', 'Hunter.io', 'StackOverflow'],
    successRate: 94.2
  }

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setServices(mcpServices)
      setStats(mockStats)
      setLoading(false)
    }, 1000)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-500" />
      case 'connecting': return <Clock className="h-4 w-4 text-yellow-500" />
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName) {
      case 'github-mcp': return <Github className="h-5 w-5 text-gray-400" />
      case 'clearbit-mcp': return <Building className="h-5 w-5 text-blue-400" />
      case 'hunter-mcp': return <Mail className="h-5 w-5 text-green-400" />
      case 'discord-mcp': return <MessageSquare className="h-5 w-5 text-purple-400" />
      case 'telegram-mcp': return <MessageSquare className="h-5 w-5 text-blue-400" />
      default: return <Zap className="h-5 w-5 text-orange-400" />
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">MCP Services Dashboard</h1>
          <p className="text-gray-400 mt-2">
            Free Model Context Protocol services enhancing your PrismAI platform
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="secondary" className="bg-green-500/20 text-green-400">
            <Activity className="h-3 w-3 mr-1" />
            {services.filter(s => s.status === 'healthy').length} Services Active
          </Badge>
          <Button size="sm" onClick={() => window.location.reload()}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </div>
      </div>

      {/* Key Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Enhancements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalEnhancements.toLocaleString()}</div>
              <div className="flex items-center text-sm text-green-400 mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +15% this month
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Avg Score Improvement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">+{stats.avgScoreImprovement}</div>
              <div className="text-sm text-gray-400 mt-1">points per lead</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.successRate}%</div>
              <Progress value={stats.successRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Top MCP Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.topSources[0]}</div>
              <div className="text-sm text-gray-400 mt-1">Most valuable data</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-800/50 border-gray-700">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">MCP Services</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Service Status Summary */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Active MCP Services</CardTitle>
              <CardDescription>Free services enhancing your lead scoring and analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {services.filter(s => s.status === 'healthy').map((service) => (
                <div key={service.name} className="flex items-center justify-between p-3 rounded border border-gray-700">
                  <div className="flex items-center space-x-3">
                    {getServiceIcon(service.name)}
                    <div>
                      <div className="font-medium text-white">{service.name.replace('-mcp', '').toUpperCase()}</div>
                      <div className="text-sm text-gray-400">{service.description}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(service.status)}
                      <span className="text-sm text-gray-400">{service.lastPing}</span>
                    </div>
                    <div className="text-xs text-green-400">{service.freeLimit}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Enhancements */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Recent MCP Enhancements</CardTitle>
              <CardDescription>Latest lead scoring improvements from MCP services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-3 text-sm">
                <Github className="h-4 w-4 text-green-400" />
                <span className="text-gray-300">GitHub profile analysis added +25 points to developer lead</span>
                <Badge variant="outline" className="text-xs">2 min ago</Badge>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <Building className="h-4 w-4 text-blue-400" />
                <span className="text-gray-300">Company intelligence enhanced enterprise lead (+30 points)</span>
                <Badge variant="outline" className="text-xs">5 min ago</Badge>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <Mail className="h-4 w-4 text-green-400" />
                <span className="text-gray-300">Email verification improved lead quality score</span>
                <Badge variant="outline" className="text-xs">8 min ago</Badge>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <Zap className="h-4 w-4 text-orange-400" />
                <span className="text-gray-300">StackOverflow analysis identified technical expertise</span>
                <Badge variant="outline" className="text-xs">12 min ago</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {services.map((service) => (
              <Card key={service.name} className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getServiceIcon(service.name)}
                      <div>
                        <CardTitle className="text-white">
                          {service.name.replace('-mcp', '').toUpperCase()}
                        </CardTitle>
                        <CardDescription>{service.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(service.status)}
                      <Badge 
                        variant={service.status === 'healthy' ? 'default' : 'secondary'}
                        className={service.status === 'healthy' ? 'bg-green-500/20 text-green-400' : ''}
                      >
                        {service.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-gray-400 mb-2">Capabilities</div>
                    <div className="flex flex-wrap gap-2">
                      {service.capabilities.map((capability, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <div>
                      <span className="text-sm text-gray-400">Free limit: </span>
                      <span className="text-sm text-green-400">{service.freeLimit}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Last ping: {service.lastPing}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">MCP Integration Status</CardTitle>
              <CardDescription>How MCP services integrate with your PrismAI platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-700 rounded">
                  <div>
                    <div className="font-medium text-white">Lead Scoring Enhancement</div>
                    <div className="text-sm text-gray-400">MCP services automatically enhance lead scores</div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400">Active</Badge>
                </div>
                
                
                <div className="flex items-center justify-between p-4 border border-gray-700 rounded">
                  <div>
                    <div className="font-medium text-white">Multi-Platform Chat</div>
                    <div className="text-sm text-gray-400">Discord and Telegram integration</div>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-400">Connecting</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">MCP Performance Analytics</CardTitle>
              <CardDescription>Detailed analytics on MCP service performance and impact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">Detailed MCP analytics coming soon...</p>
                <Button className="mt-4" variant="outline">
                  View Full Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}