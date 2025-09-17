"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Plus, Users, TrendingUp, Target, BarChart3, Clock, Star, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Agent {
  id: string
  name: string
  email: string
  role: string
  status: string
  max_concurrent_chats: number
  skills: string[]
  created_at: string
}

interface AgentMetrics {
  id: string
  agent_id: string
  metric_date: string
  total_conversations: number
  resolved_conversations: number
  escalated_conversations: number
  avg_response_time_seconds: number
  avg_resolution_time_seconds: number
  customer_satisfaction_score: number
  efficiency_score: number
  agent_profiles: {
    name: string
    email: string
    role: string
  }
}

interface AgentGoal {
  id: string
  agent_id: string | null
  goal_type: string
  target_value: number
  period: string
  is_active: boolean
  agent_profiles: {
    name: string
  } | null
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [metrics, setMetrics] = useState<AgentMetrics[]>([])
  const [goals, setGoals] = useState<AgentGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateAgentDialog, setShowCreateAgentDialog] = useState(false)
  const [showCreateGoalDialog, setShowCreateGoalDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [agentsRes, metricsRes, goalsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/agents/metrics'),
        fetch('/api/agents/goals')
      ])

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json()
        setAgents(agentsData)
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        setMetrics(metricsData)
      }

      if (goalsRes.ok) {
        const goalsData = await goalsRes.json()
        setGoals(goalsData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast({
        title: "Error",
        description: "Failed to load agent data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAgent = async (agentData: any) => {
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Agent created successfully",
        })
        setShowCreateAgentDialog(false)
        loadData()
      } else {
        throw new Error('Failed to create agent')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create agent",
        variant: "destructive",
      })
    }
  }

  const handleCreateGoal = async (goalData: any) => {
    try {
      const response = await fetch('/api/agents/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Goal created successfully",
        })
        setShowCreateGoalDialog(false)
        loadData()
      } else {
        throw new Error('Failed to create goal')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create goal",
        variant: "destructive",
      })
    }
  }

  const getRoleBadge = (role: string) => {
    const variants: any = {
      agent: "default",
      supervisor: "secondary",
      manager: "destructive"
    }
    return <Badge variant={variants[role] || "default"}>{role}</Badge>
  }

  const getStatusBadge = (status: string) => {
    const variants: any = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive"
    }
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading agents...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Agent Management</h1>
            <p className="text-muted-foreground">Manage agents, track performance, and set goals</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showCreateGoalDialog} onOpenChange={setShowCreateGoalDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Target className="h-4 w-4 mr-2" />
                  Set Goal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Agent Goal</DialogTitle>
                  <DialogDescription>
                    Set performance goals for agents
                  </DialogDescription>
                </DialogHeader>
                <GoalForm onSubmit={handleCreateGoal} agents={agents} />
              </DialogContent>
            </Dialog>
            <Dialog open={showCreateAgentDialog} onOpenChange={setShowCreateAgentDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Agent
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Agent</DialogTitle>
                  <DialogDescription>
                    Create a new agent profile
                  </DialogDescription>
                </DialogHeader>
                <AgentForm onSubmit={handleCreateAgent} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="goals">Goals & Targets</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card key={agent.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    {getRoleBadge(agent.role)}
                  </div>
                  <CardDescription>{agent.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      {getStatusBadge(agent.status)}
                    </div>
                    <div className="flex justify-between">
                      <span>Max Chats:</span>
                      <span>{agent.max_concurrent_chats}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Skills:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.skills.map((skill, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agents.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {agents.filter(a => a.status === 'active').length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Satisfaction</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4.1</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.reduce((sum, m) => sum + m.total_conversations, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Agent Performance Metrics</CardTitle>
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
                    <TableHead>Satisfaction</TableHead>
                    <TableHead>Efficiency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.slice(0, 10).map((metric) => (
                    <TableRow key={metric.id}>
                      <TableCell className="font-medium">
                        {metric.agent_profiles?.name}
                      </TableCell>
                      <TableCell>{metric.total_conversations}</TableCell>
                      <TableCell>
                        {metric.total_conversations > 0
                          ? Math.round((metric.resolved_conversations / metric.total_conversations) * 100)
                          : 0}%
                      </TableCell>
                      <TableCell>
                        {metric.avg_response_time_seconds
                          ? Math.round(metric.avg_response_time_seconds / 60)
                          : 0}m
                      </TableCell>
                      <TableCell>
                        {metric.customer_satisfaction_score || 0}%
                      </TableCell>
                      <TableCell>
                        {metric.efficiency_score || 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Goals & Targets</CardTitle>
              <CardDescription>Performance goals and achievement tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Goal Type</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goals.map((goal) => (
                    <TableRow key={goal.id}>
                      <TableCell className="font-medium capitalize">
                        {goal.goal_type.replace('_', ' ')}
                      </TableCell>
                      <TableCell>
                        {goal.agent_profiles?.name || 'Team-wide'}
                      </TableCell>
                      <TableCell>{goal.target_value}</TableCell>
                      <TableCell className="capitalize">{goal.period}</TableCell>
                      <TableCell>
                        <Badge variant={goal.is_active ? "default" : "secondary"}>
                          {goal.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.random() * 100} className="w-16" />
                          <span className="text-sm">75%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AgentForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'agent',
    max_concurrent_chats: 5,
    skills: [] as string[]
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const addSkill = () => {
    setFormData(prev => ({
      ...prev,
      skills: [...prev.skills, '']
    }))
  }

  const updateSkill = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.map((skill, i) => i === index ? value : skill)
    }))
  }

  const removeSkill = (index: number) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
        />
      </div>

      <div>
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="max_chats">Max Concurrent Chats</Label>
        <Input
          id="max_chats"
          type="number"
          min="1"
          max="10"
          value={formData.max_concurrent_chats}
          onChange={(e) => setFormData(prev => ({ ...prev, max_concurrent_chats: parseInt(e.target.value) }))}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Skills</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSkill}>
            <Plus className="h-4 w-4 mr-1" />
            Add Skill
          </Button>
        </div>

        <div className="space-y-2">
          {formData.skills.map((skill, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Skill name"
                value={skill}
                onChange={(e) => updateSkill(index, e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeSkill(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">Create Agent</Button>
      </div>
    </form>
  )
}

function GoalForm({ onSubmit, agents }: { onSubmit: (data: any) => void, agents: Agent[] }) {
  const [formData, setFormData] = useState({
    agent_id: '',
    goal_type: 'conversations_per_day',
    target_value: 0,
    period: 'monthly',
    is_active: true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="agent">Agent (leave empty for team-wide goal)</Label>
        <Select
          value={formData.agent_id}
          onValueChange={(value) => setFormData(prev => ({ ...prev, agent_id: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select agent (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Team-wide</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="goal_type">Goal Type</Label>
        <Select
          value={formData.goal_type}
          onValueChange={(value) => setFormData(prev => ({ ...prev, goal_type: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="conversations_per_day">Conversations per Day</SelectItem>
            <SelectItem value="resolution_rate">Resolution Rate (%)</SelectItem>
            <SelectItem value="response_time">Response Time (minutes)</SelectItem>
            <SelectItem value="satisfaction_score">Satisfaction Score (%)</SelectItem>
            <SelectItem value="efficiency">Efficiency Score (%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="target">Target Value</Label>
        <Input
          id="target"
          type="number"
          min="0"
          step="0.1"
          value={formData.target_value}
          onChange={(e) => setFormData(prev => ({ ...prev, target_value: parseFloat(e.target.value) }))}
          required
        />
      </div>

      <div>
        <Label htmlFor="period">Period</Label>
        <Select
          value={formData.period}
          onValueChange={(value) => setFormData(prev => ({ ...prev, period: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">Create Goal</Button>
      </div>
    </form>
  )
}