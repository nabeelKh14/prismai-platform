"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Calendar, Download, TrendingUp, TrendingDown, BarChart3, PieChart, Users, Clock, MessageSquare, Star } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AnalyticsData {
  totalConversations: number
  resolvedConversations: number
  averageResolutionTime: number
  customerSatisfaction: number
  channelBreakdown: {
    whatsapp: number
    sms: number
    website: number
  }
  dailyVolume: Array<{
    date: string
    conversations: number
    resolved: number
    satisfaction: number
  }>
  agentPerformance: Array<{
    id: string
    name: string
    conversations: number
    resolutionRate: number
    avgResponseTime: number
    satisfactionScore: number
    efficiency: number
  }>
  conversationOutcomes: {
    resolved: number
    escalated: number
    abandoned: number
    transferred: number
  }
  satisfactionTrends: Array<{
    date: string
    score: number
  }>
}

export default function CustomerServiceAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [timeRange, setTimeRange] = useState('7d')
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics/customer-service?timeRange=${timeRange}`)
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (error) {
      console.error('Failed to load analytics:', error)
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const exportData = async (format: 'csv' | 'pdf') => {
    try {
      const response = await fetch(`/api/analytics/customer-service/export?format=${format}&timeRange=${timeRange}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-service-analytics-${timeRange}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export Complete",
        description: `Analytics data exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      console.error('Export failed:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      </div>
    )
  }

  const resolutionRate = (data.resolvedConversations / data.totalConversations) * 100
  const abandonmentRate = (data.conversationOutcomes.abandoned / data.totalConversations) * 100

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Customer Service Analytics</h1>
            <p className="text-muted-foreground">Comprehensive insights into customer service performance</p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">1 Day</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => exportData('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => exportData('pdf')}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalConversations.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +12% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolutionRate.toFixed(1)}%</div>
            <Progress value={resolutionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data.averageResolutionTime / 60)}m</div>
            <p className="text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 inline mr-1" />
              -5% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.customerSatisfaction.toFixed(1)}%</div>
            <div className="flex mt-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(data.customerSatisfaction / 20)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agent Performance</TabsTrigger>
          <TabsTrigger value="channels">Channel Analytics</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversation Outcomes */}
            <Card>
              <CardHeader>
                <CardTitle>Conversation Outcomes</CardTitle>
                <CardDescription>How conversations are resolved</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Resolved</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{data.conversationOutcomes.resolved}</p>
                      <p className="text-xs text-muted-foreground">
                        {((data.conversationOutcomes.resolved / data.totalConversations) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm">Abandoned</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{data.conversationOutcomes.abandoned}</p>
                      <p className="text-xs text-muted-foreground">
                        {abandonmentRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">Escalated</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{data.conversationOutcomes.escalated}</p>
                      <p className="text-xs text-muted-foreground">
                        {((data.conversationOutcomes.escalated / data.totalConversations) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">Transferred</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{data.conversationOutcomes.transferred}</p>
                      <p className="text-xs text-muted-foreground">
                        {((data.conversationOutcomes.transferred / data.totalConversations) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Channel Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Channel Breakdown</CardTitle>
                <CardDescription>Conversations by communication channel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                      <span className="text-sm">WhatsApp</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{data.channelBreakdown.whatsapp}</p>
                      <p className="text-xs text-muted-foreground">
                        {((data.channelBreakdown.whatsapp / data.totalConversations) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Website</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{data.channelBreakdown.website}</p>
                      <p className="text-xs text-muted-foreground">
                        {((data.channelBreakdown.website / data.totalConversations) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">SMS</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{data.channelBreakdown.sms}</p>
                      <p className="text-xs text-muted-foreground">
                        {((data.channelBreakdown.sms / data.totalConversations) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance Analytics</CardTitle>
              <CardDescription>Detailed performance metrics for each agent</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Conversations</TableHead>
                    <TableHead>Resolution Rate</TableHead>
                    <TableHead>Avg Response Time</TableHead>
                    <TableHead>Satisfaction Score</TableHead>
                    <TableHead>Efficiency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agentPerformance.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell>{agent.conversations}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{agent.resolutionRate.toFixed(1)}%</span>
                          <Progress value={agent.resolutionRate} className="w-16" />
                        </div>
                      </TableCell>
                      <TableCell>{Math.round(agent.avgResponseTime / 60)}m</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{agent.satisfactionScore.toFixed(1)}%</span>
                          <Progress value={agent.satisfactionScore} className="w-16" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{agent.efficiency.toFixed(1)}%</span>
                          <Progress value={agent.efficiency} className="w-16" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* WhatsApp Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                  WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">{data.channelBreakdown.whatsapp}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Resolution Rate</span>
                    <span>96%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Response Time</span>
                    <span>2.3m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Satisfaction</span>
                    <span>94%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Website Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-600" />
                  Website
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">{data.channelBreakdown.website}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Resolution Rate</span>
                    <span>89%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Response Time</span>
                    <span>3.1m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Satisfaction</span>
                    <span>87%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SMS Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  SMS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">{data.channelBreakdown.sms}</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Resolution Rate</span>
                    <span>85%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Response Time</span>
                    <span>4.2m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Satisfaction</span>
                    <span>82%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Volume Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Conversation Volume</CardTitle>
                <CardDescription>Conversations over the selected time period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.dailyVolume.map((day, index) => (
                    <div key={day.date} className="flex items-center justify-between">
                      <span className="text-sm">{new Date(day.date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{day.conversations}</p>
                          <p className="text-xs text-muted-foreground">
                            {day.resolved} resolved
                          </p>
                        </div>
                        <div className="w-24">
                          <Progress value={(day.conversations / Math.max(...data.dailyVolume.map(d => d.conversations))) * 100} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Satisfaction Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Satisfaction Trend</CardTitle>
                <CardDescription>Satisfaction scores over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.satisfactionTrends.map((point, index) => (
                    <div key={point.date} className="flex items-center justify-between">
                      <span className="text-sm">{new Date(point.date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{point.score.toFixed(1)}%</p>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < Math.round(point.score / 20)
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="w-24">
                          <Progress value={point.score} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}