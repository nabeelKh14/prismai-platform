'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, TrendingUp, Users, Target, Zap, BarChart3, Settings, Play, Pause, Eye } from 'lucide-react'
import DotGrid from '@/components/DotGrid'

interface Lead {
  id: string
  email: string
  first_name: string
  last_name: string
  company: string
  job_title: string
  lead_score: number
  status: string
  engagement_score: number
  conversion_probability: number
  created_at: string
  tags: string[]
}

interface Workflow {
  id: string
  name: string
  status: string
  trigger_type: string
}

interface ABTest {
  id: string
  name: string
  test_type: string
  status: string
  variants: any[]
}

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [abTests, setAbTests] = useState<ABTest[]>([])
  const [analytics, setAnalytics] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [leadsRes, workflowsRes, abTestsRes, analyticsRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/leads/workflows'),
        fetch('/api/leads/ab-tests'),
        fetch('/api/leads/analytics?action=performance')
      ])

      const [leadsData, workflowsData, abTestsData, analyticsData] = await Promise.all([
        leadsRes.json(),
        workflowsRes.json(),
        abTestsRes.json(),
        analyticsRes.json()
      ])

      setLeads(leadsData.leads || [])
      setWorkflows(workflowsData.workflows || [])
      setAbTests(abTestsData.abTests || [])
      setAnalytics(analyticsData.performance || {})
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      new: 'secondary',
      contacted: 'default',
      qualified: 'default',
      opportunity: 'default',
      customer: 'default',
      lost: 'destructive'
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Generation</h1>
          <p className="text-muted-foreground">Advanced lead nurturing and optimization platform</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>
                  Create a new lead with automatic scoring and enrichment.
                </DialogDescription>
              </DialogHeader>
              <LeadForm onSuccess={loadDashboardData} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalLeads || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{Math.round((analytics.totalLeads || 0) * 0.12)} from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Lead Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avgScore || 0}</div>
            <Progress value={analytics.avgScore || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.conversionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              +2.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workflows.filter(w => w.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {workflows.filter(w => w.status === 'running').length} currently running
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="ab-tests">A/B Tests</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Leads</CardTitle>
              <CardDescription>Latest leads with their scores and status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.slice(0, 10).map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>{`${lead.first_name} ${lead.last_name}`}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{lead.company}</TableCell>
                      <TableCell>
                        <span className={getScoreColor(lead.lead_score)}>
                          {lead.lead_score}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Lead Nurturing Workflows</h3>
              <p className="text-sm text-muted-foreground">
                Automate lead nurturing with conditional workflows
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Workflow
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Create Workflow</DialogTitle>
                  <DialogDescription>
                    Build a visual workflow for lead nurturing
                  </DialogDescription>
                </DialogHeader>
                <WorkflowBuilder onSuccess={loadDashboardData} />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id}>
                <CardHeader>
                  <CardTitle className="text-base">{workflow.name}</CardTitle>
                  <CardDescription>{workflow.trigger_type} trigger</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'}>
                      {workflow.status}
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        {workflow.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ab-tests" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">A/B Testing</h3>
              <p className="text-sm text-muted-foreground">
                Optimize your lead generation with data-driven testing
              </p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Test
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create A/B Test</DialogTitle>
                  <DialogDescription>
                    Test different variations to optimize conversions
                  </DialogDescription>
                </DialogHeader>
                <ABTestForm onSuccess={loadDashboardData} />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {abTests.map((test) => (
              <Card key={test.id}>
                <CardHeader>
                  <CardTitle className="text-base">{test.name}</CardTitle>
                  <CardDescription>{test.test_type.replace('_', ' ')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Status:</span>
                      <Badge variant={test.status === 'running' ? 'default' : 'secondary'}>
                        {test.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Variants:</span>
                      <span>{test.variants?.length || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead Generation Analytics</CardTitle>
              <CardDescription>Comprehensive insights into your lead generation performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Conversion Funnel</h4>
                  <Button variant="outline" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Funnel Analysis
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Engagement Tracking</h4>
                  <Button variant="outline" className="w-full">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Engagement Metrics
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lead Generation Settings</CardTitle>
              <CardDescription>Configure scoring models, automation rules, and integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="scoring-model">Default Scoring Model</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select scoring model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enhanced">Enhanced AI Scoring</SelectItem>
                      <SelectItem value="predictive">Predictive ML Model</SelectItem>
                      <SelectItem value="custom">Custom Rules</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Placeholder components (would be implemented separately)
function LeadForm({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="lead@example.com" />
      </div>
      <div>
        <Label htmlFor="firstName">First Name</Label>
        <Input id="firstName" placeholder="John" />
      </div>
      <div>
        <Label htmlFor="lastName">Last Name</Label>
        <Input id="lastName" placeholder="Doe" />
      </div>
      <div>
        <Label htmlFor="company">Company</Label>
        <Input id="company" placeholder="Acme Corp" />
      </div>
      <Button className="w-full">Create Lead</Button>
    </div>
  )
}

function WorkflowBuilder({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="workflow-name">Workflow Name</Label>
        <Input id="workflow-name" placeholder="Welcome Series" />
      </div>
      <div>
        <Label htmlFor="trigger-type">Trigger Type</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select trigger" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead_created">Lead Created</SelectItem>
            <SelectItem value="score_changed">Score Changed</SelectItem>
            <SelectItem value="behavior">Behavior</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Workflow builder canvas would go here</p>
        <p className="text-sm text-muted-foreground mt-2">Drag and drop steps to build your workflow</p>
      </div>
      <Button className="w-full">Create Workflow</Button>
    </div>
  )
}

function ABTestForm({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="test-name">Test Name</Label>
        <Input id="test-name" placeholder="Email Subject Line Test" />
      </div>
      <div>
        <Label htmlFor="test-type">Test Type</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select test type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email_subject">Email Subject</SelectItem>
            <SelectItem value="email_content">Email Content</SelectItem>
            <SelectItem value="send_time">Send Time</SelectItem>
            <SelectItem value="landing_page">Landing Page</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button className="w-full">Create Test</Button>
    </div>
  )
}