"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, Send, BarChart3, Users, MessageSquare, Star } from "lucide-react"
import DotGrid from '@/components/DotGrid'
import { useToast } from "@/hooks/use-toast"

interface SurveyTemplate {
  id: string
  name: string
  description: string
  trigger_event: string
  delivery_channels: string[]
  questions: any[]
  is_active: boolean
  created_at: string
}

interface Survey {
  id: string
  customer_identifier: string
  delivery_channel: string
  status: string
  sent_at: string
  completed_at: string
  survey_templates: {
    name: string
    description: string
  }
  survey_responses: any[]
}

function SurveyTemplateForm({ initialData, onSubmit }: {
  initialData?: SurveyTemplate
  onSubmit: (data: any) => void
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    trigger_event: initialData?.trigger_event || 'manual',
    delivery_channels: initialData?.delivery_channels || ['email'],
    questions: initialData?.questions || [],
    is_active: initialData?.is_active ?? true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, {
        id: `q${Date.now()}`,
        type: 'rating',
        question: '',
        scale: 5,
        required: true
      }]
    }))
  }

  const updateQuestion = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === index ? { ...q, [field]: value } : q
      )
    }))
  }

  const removeQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Template Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="trigger">Trigger Event</Label>
        <Select
          value={formData.trigger_event}
          onValueChange={(value) => setFormData(prev => ({ ...prev, trigger_event: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="conversation_resolved">Conversation Resolved</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="escalation">Escalation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Delivery Channels</Label>
        <div className="flex gap-4 mt-2">
          {['email', 'sms', 'in_chat', 'whatsapp'].map((channel) => (
            <div key={channel} className="flex items-center space-x-2">
              <Checkbox
                id={channel}
                checked={formData.delivery_channels.includes(channel)}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({
                    ...prev,
                    delivery_channels: checked
                      ? [...prev.delivery_channels, channel]
                      : prev.delivery_channels.filter(c => c !== channel)
                  }))
                }}
              />
              <Label htmlFor={channel} className="capitalize">{channel}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <Label>Questions</Label>
          <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-1" />
            Add Question
          </Button>
        </div>

        <div className="space-y-4">
          {formData.questions.map((question, index) => (
            <div key={question.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Question {index + 1}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeQuestion(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="Question text"
                  value={question.question}
                  onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                />
                <Select
                  value={question.type}
                  onValueChange={(value) => updateQuestion(index, 'type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Rating (1-5)</SelectItem>
                    <SelectItem value="text">Text Response</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="yes_no">Yes/No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: !!checked }))}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">
          {initialData ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </form>
  )
}

export default function SurveysPage() {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [templatesRes, surveysRes] = await Promise.all([
        fetch('/api/surveys/templates'),
        fetch('/api/surveys')
      ])

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json()
        setTemplates(templatesData)
      }

      if (surveysRes.ok) {
        const surveysData = await surveysRes.json()
        setSurveys(surveysData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast({
        title: "Error",
        description: "Failed to load survey data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async (templateData: any) => {
    try {
      const response = await fetch('/api/surveys/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Survey template created successfully",
        })
        setShowCreateDialog(false)
        loadData()
      } else {
        throw new Error('Failed to create template')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create survey template",
        variant: "destructive",
      })
    }
  }

  const handleUpdateTemplate = async (id: string, templateData: any) => {
    try {
      const response = await fetch(`/api/surveys/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Survey template updated successfully",
        })
        setEditingTemplate(null)
        loadData()
      } else {
        throw new Error('Failed to update template')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update survey template",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this survey template?')) return

    try {
      const response = await fetch(`/api/surveys/templates/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Survey template deleted successfully",
        })
        loadData()
      } else {
        throw new Error('Failed to delete template')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete survey template",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "secondary",
      sent: "default",
      completed: "default",
      expired: "destructive",
      failed: "destructive"
    }
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
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
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading surveys...</p>
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
            <h1 className="text-3xl font-bold mb-2">Customer Satisfaction Surveys</h1>
            <p className="text-muted-foreground">Create and manage customer satisfaction surveys</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Survey Template</DialogTitle>
                <DialogDescription>
                  Create a new customer satisfaction survey template
                </DialogDescription>
              </DialogHeader>
              <SurveyTemplateForm onSubmit={handleCreateTemplate} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="surveys">Active Surveys</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>Trigger: {template.trigger_event}</div>
                    <div>Channels: {template.delivery_channels.join(", ")}</div>
                    <div>Questions: {template.questions.length}</div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="surveys" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Surveys</CardTitle>
              <CardDescription>Track sent surveys and their completion status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {surveys.map((survey) => (
                    <TableRow key={survey.id}>
                      <TableCell className="font-medium">
                        {survey.customer_identifier}
                      </TableCell>
                      <TableCell>{survey.survey_templates?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{survey.delivery_channel}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(survey.status)}</TableCell>
                      <TableCell>
                        {survey.sent_at ? new Date(survey.sent_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        {survey.completed_at ? new Date(survey.completed_at).toLocaleDateString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Surveys</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{surveys.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {surveys.filter(s => s.status === 'completed').length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {surveys.length > 0
                    ? Math.round((surveys.filter(s => s.status === 'completed').length / surveys.length) * 100)
                    : 0}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Satisfaction</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4.2</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Template Dialog */}
      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Survey Template</DialogTitle>
              <DialogDescription>
                Update the survey template settings
              </DialogDescription>
            </DialogHeader>
            <SurveyTemplateForm
              initialData={editingTemplate}
              onSubmit={(data) => handleUpdateTemplate(editingTemplate.id, data)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}