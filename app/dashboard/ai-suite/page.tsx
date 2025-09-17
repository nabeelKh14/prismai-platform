"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  Phone, 
  MessageSquare, 
  Users, 
  Mail, 
  BarChart3, 
  TrendingUp, 
  Activity,
  Zap,
  Target,
  Brain,
  Rocket,
  Settings
} from "lucide-react"

interface AIService {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'pending'
  metrics: {
    usage: number
    performance: number
    lastUsed: string
  }
  features: string[]
}

interface SuiteMetrics {
  totalInteractions: number
  aiAccuracy: number
  customerSatisfaction: number
  costSavings: number
  automationRate: number
}

export default function AISuitePage() {
  const [services, setServices] = useState<AIService[]>([])
  const [metrics, setMetrics] = useState<SuiteMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  const aiServices: AIService[] = [
    {
      id: 'receptionist',
      name: 'PrismAI Assistant',
      description: 'Intelligent voice-based call handling and appointment scheduling',
      status: 'active',
      metrics: {
        usage: 85,
        performance: 94,
        lastUsed: '2 hours ago'
      },
      features: ['Voice Recognition', 'Appointment Booking', 'Call Routing', 'Sentiment Analysis']
    },
    {
      id: 'lead-generation',
      name: 'Lead Generation Engine',
      description: 'AI-powered lead scoring, qualification, and nurturing system',
      status: 'active',
      metrics: {
        usage: 78,
        performance: 89,
        lastUsed: '1 hour ago'
      },
      features: ['Lead Scoring', 'Automated Outreach', 'Qualification', 'Multi-channel Capture']
    },
    {
      id: 'chatbot',
      name: '24/7 Customer Service',
      description: 'Intelligent chatbot for customer support across all channels',
      status: 'active',
      metrics: {
        usage: 92,
        performance: 91,
        lastUsed: '15 minutes ago'
      },
      features: ['Multi-channel Support', 'Knowledge Base', 'Escalation', 'Sentiment Detection']
    },
    {
      id: 'marketing',
      name: 'Marketing Automation',
      description: 'AI-driven content creation and campaign optimization',
      status: 'active',
      metrics: {
        usage: 65,
        performance: 87,
        lastUsed: '3 hours ago'
      },
      features: ['Email Campaigns', 'Social Media', 'Content Generation', 'A/B Testing']
    },
    {
      id: 'analytics',
      name: 'AI Analytics & Insights',
      description: 'Predictive analytics and business intelligence dashboard',
      status: 'active',
      metrics: {
        usage: 72,
        performance: 93,
        lastUsed: '30 minutes ago'
      },
      features: ['Predictive Models', 'Performance Tracking', 'ROI Analysis', 'Custom Reports']
    }
  ]

  const suiteMetrics: SuiteMetrics = {
    totalInteractions: 12847,
    aiAccuracy: 94.2,
    customerSatisfaction: 4.7,
    costSavings: 68500,
    automationRate: 87.3
  }

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setServices(aiServices)
      setMetrics(suiteMetrics)
      setLoading(false)
    }, 1000)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'inactive': return 'bg-red-500'
      case 'pending': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getServiceIcon = (serviceId: string) => {
    switch (serviceId) {
      case 'receptionist': return <Phone className="h-5 w-5" />
      case 'lead-generation': return <Target className="h-5 w-5" />
      case 'chatbot': return <MessageSquare className="h-5 w-5" />
      case 'marketing': return <Mail className="h-5 w-5" />
      case 'analytics': return <BarChart3 className="h-5 w-5" />
      default: return <Brain className="h-5 w-5" />
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
          <h1 className="text-3xl font-bold text-white">PrismAI Platform</h1>
          <p className="text-gray-400 mt-2">
            Comprehensive AI-powered business automation platform
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="secondary" className="bg-green-500/20 text-green-400">
            <Activity className="h-3 w-3 mr-1" />
            All Systems Operational
          </Badge>
          <Button size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure Suite
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Interactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.totalInteractions.toLocaleString()}</div>
              <div className="flex items-center text-sm text-green-400 mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +12% from last month
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">AI Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.aiAccuracy}%</div>
              <Progress value={metrics.aiAccuracy} className="mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Customer Satisfaction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.customerSatisfaction}/5.0</div>
              <div className="text-sm text-gray-400 mt-1">⭐⭐⭐⭐⭐</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Cost Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${metrics.costSavings.toLocaleString()}</div>
              <div className="text-sm text-green-400 mt-1">Per month</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Automation Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.automationRate}%</div>
              <Progress value={metrics.automationRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-800/50 border-gray-700">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">AI Services</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service Status */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Service Status</CardTitle>
                <CardDescription>Real-time status of all AI services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`} />
                      <div className="flex items-center space-x-2">
                        {getServiceIcon(service.id)}
                        <span className="text-white font-medium">{service.name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">{service.metrics.performance}% accuracy</div>
                      <div className="text-xs text-gray-500">{service.metrics.lastUsed}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Recent AI Activity</CardTitle>
                <CardDescription>Latest automated actions across all services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                  <Phone className="h-4 w-4 text-blue-400" />
                  <span className="text-gray-300">PrismAI Assistant handled 23 calls in the last hour</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <Users className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">Lead Engine qualified 5 new prospects</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <MessageSquare className="h-4 w-4 text-purple-400" />
                  <span className="text-gray-300">Chatbot resolved 47 customer inquiries</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <Mail className="h-4 w-4 text-pink-400" />
                  <span className="text-gray-300">Marketing AI sent 1,247 personalized emails</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <BarChart3 className="h-4 w-4 text-yellow-400" />
                  <span className="text-gray-300">Analytics generated 3 new business insights</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
              <CardDescription>Common tasks and AI-powered automations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button variant="outline" className="h-20 flex-col space-y-2 border-gray-600 hover:bg-gray-700">
                  <Zap className="h-5 w-5" />
                  <span>Optimize All Services</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2 border-gray-600 hover:bg-gray-700">
                  <Brain className="h-5 w-5" />
                  <span>Generate Insights</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2 border-gray-600 hover:bg-gray-700">
                  <Rocket className="h-5 w-5" />
                  <span>Launch Campaign</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2 border-gray-600 hover:bg-gray-700">
                  <Settings className="h-5 w-5" />
                  <span>Suite Settings</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {services.map((service) => (
              <Card key={service.id} className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getServiceIcon(service.id)}
                      <div>
                        <CardTitle className="text-white">{service.name}</CardTitle>
                        <CardDescription>{service.description}</CardDescription>
                      </div>
                    </div>
                    <Badge 
                      variant={service.status === 'active' ? 'default' : 'secondary'}
                      className={service.status === 'active' ? 'bg-green-500/20 text-green-400' : ''}
                    >
                      {service.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">Usage</div>
                      <div className="text-2xl font-bold text-white">{service.metrics.usage}%</div>
                      <Progress value={service.metrics.usage} className="mt-1" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Performance</div>
                      <div className="text-2xl font-bold text-white">{service.metrics.performance}%</div>
                      <Progress value={service.metrics.performance} className="mt-1" />
                    </div>
                  </div>
                  
                  <Separator className="bg-gray-700" />
                  
                  <div>
                    <div className="text-sm font-medium text-gray-400 mb-2">Key Features</div>
                    <div className="flex flex-wrap gap-2">
                      {service.features.map((feature, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm text-gray-400">Last used: {service.metrics.lastUsed}</span>
                    <Button size="sm" variant="outline">Configure</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Performance Analytics</CardTitle>
              <CardDescription>Detailed performance metrics across all AI services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">Performance charts and detailed analytics coming soon...</p>
                <Button className="mt-4" variant="outline">
                  View Analytics Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">AI-Generated Business Insights</CardTitle>
              <CardDescription>Intelligent recommendations to optimize your business performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">AI insights and recommendations coming soon...</p>
                <Button className="mt-4" variant="outline">
                  Generate Insights
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}