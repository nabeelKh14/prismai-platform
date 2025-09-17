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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Plus, Star, AlertTriangle, CheckCircle, TrendingUp, Users, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface QualityCriteria {
  id: string
  name: string
  description: string
  criteria: any[]
  max_score: number
  is_active: boolean
}

interface QualityReview {
  id: string
  conversation_id: string
  reviewer_id: string
  overall_score: number
  feedback: string
  review_type: string
  created_at: string
  quality_criteria: {
    name: string
    max_score: number
  }
  agent_profiles: {
    name: string
  }
  chat_conversations: {
    customer_identifier: string
    channel: string
  }
}

interface AutomatedScore {
  id: string
  conversation_id: string
  overall_score: number
  confidence_score: number
  flagged_for_review: boolean
  created_at: string
  quality_criteria: {
    name: string
  }
}

export default function QualityPage() {
  const [criteria, setCriteria] = useState<QualityCriteria[]>([])
  const [reviews, setReviews] = useState<QualityReview[]>([])
  const [automatedScores, setAutomatedScores] = useState<AutomatedScore[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateCriteriaDialog, setShowCreateCriteriaDialog] = useState(false)
  const [showCreateReviewDialog, setShowCreateReviewDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [criteriaRes, reviewsRes, scoresRes] = await Promise.all([
        fetch('/api/quality/criteria'),
        fetch('/api/quality/reviews'),
        fetch('/api/quality/automated')
      ])

      if (criteriaRes.ok) {
        const criteriaData = await criteriaRes.json()
        setCriteria(criteriaData)
      }

      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json()
        setReviews(reviewsData)
      }

      if (scoresRes.ok) {
        const scoresData = await scoresRes.json()
        setAutomatedScores(scoresData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast({
        title: "Error",
        description: "Failed to load quality data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCriteria = async (criteriaData: any) => {
    try {
      const response = await fetch('/api/quality/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteriaData)
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Quality criteria created successfully",
        })
        setShowCreateCriteriaDialog(false)
        loadData()
      } else {
        throw new Error('Failed to create criteria')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create quality criteria",
        variant: "destructive",
      })
    }
  }

  const getScoreColor = (score: number, maxScore: number = 100) => {
    const percentage = (score / maxScore) * 100
    if (percentage >= 80) return "text-green-600"
    if (percentage >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBadge = (score: number, maxScore: number = 100) => {
    const percentage = (score / maxScore) * 100
    if (percentage >= 80) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>
    if (percentage >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>
    return <Badge className="bg-red-100 text-red-800">Needs Improvement</Badge>
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading quality data...</p>
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
            <h1 className="text-3xl font-bold mb-2">Quality Assurance</h1>
            <p className="text-muted-foreground">Monitor and improve conversation quality</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showCreateReviewDialog} onOpenChange={setShowCreateReviewDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Star className="h-4 w-4 mr-2" />
                  Manual Review
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Quality Review</DialogTitle>
                  <DialogDescription>
                    Manually review a conversation for quality
                  </DialogDescription>
                </DialogHeader>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Manual review form would go here</p>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showCreateCriteriaDialog} onOpenChange={setShowCreateCriteriaDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Criteria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Quality Criteria</DialogTitle>
                  <DialogDescription>
                    Define quality assessment criteria
                  </DialogDescription>
                </DialogHeader>
                <CriteriaForm onSubmit={handleCreateCriteria} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Manual Reviews</TabsTrigger>
          <TabsTrigger value="automated">Automated Scores</TabsTrigger>
          <TabsTrigger value="criteria">Criteria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">84%</div>
                <Progress value={84} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reviews Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reviews.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flagged for Review</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {automatedScores.filter(s => s.flagged_for_review).length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quality Criteria</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{criteria.length}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Quality Reviews</CardTitle>
                <CardDescription>Latest manual quality assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{review.agent_profiles?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {review.chat_conversations?.customer_identifier}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getScoreColor(review.overall_score, review.quality_criteria?.max_score)}`}>
                          {review.overall_score}/{review.quality_criteria?.max_score}
                        </div>
                        {getScoreBadge(review.overall_score, review.quality_criteria?.max_score)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Automated Quality Scores</CardTitle>
                <CardDescription>AI-generated quality assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {automatedScores.slice(0, 5).map((score) => (
                    <div key={score.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Conversation {score.conversation_id.slice(-8)}</p>
                        <p className="text-sm text-muted-foreground">
                          Confidence: {(score.confidence_score * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getScoreColor(score.overall_score)}`}>
                          {score.overall_score}%
                        </div>
                        {score.flagged_for_review && (
                          <Badge variant="destructive" className="text-xs">Flagged</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Manual Quality Reviews</CardTitle>
              <CardDescription>Quality assessments performed by human reviewers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conversation</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{review.chat_conversations?.customer_identifier}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {review.chat_conversations?.channel}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{review.agent_profiles?.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(review.overall_score, review.quality_criteria?.max_score)}`}>
                            {review.overall_score}/{review.quality_criteria?.max_score}
                          </span>
                          {getScoreBadge(review.overall_score, review.quality_criteria?.max_score)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {review.review_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(review.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automated" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated Quality Scores</CardTitle>
              <CardDescription>AI-powered quality assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conversation</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automatedScores.map((score) => (
                    <TableRow key={score.id}>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {score.conversation_id.slice(-8)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(score.overall_score)}`}>
                            {score.overall_score}%
                          </span>
                          <Progress value={score.overall_score} className="w-16" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {(score.confidence_score * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell>
                        {score.flagged_for_review ? (
                          <Badge variant="destructive">Flagged</Badge>
                        ) : (
                          <Badge variant="default">Passed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(score.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="criteria" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {criteria.map((criterion) => (
              <Card key={criterion.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{criterion.name}</CardTitle>
                    <Badge variant={criterion.is_active ? "default" : "secondary"}>
                      {criterion.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>{criterion.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Max Score:</span>
                      <span className="font-medium">{criterion.max_score}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Criteria:</span>
                      <div className="mt-2 space-y-1">
                        {criterion.criteria.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.name}</span>
                            <span>{item.max_score} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CriteriaForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    criteria: [
      { name: 'Greeting', description: 'Proper greeting and introduction', weight: 10, max_score: 10 }
    ],
    max_score: 100,
    is_active: true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const addCriterion = () => {
    setFormData(prev => ({
      ...prev,
      criteria: [...prev.criteria, {
        name: '',
        description: '',
        weight: 10,
        max_score: 10
      }]
    }))
  }

  const updateCriterion = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      )
    }))
  }

  const removeCriterion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index)
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Criteria Name</Label>
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
        <Label htmlFor="max_score">Maximum Score</Label>
        <Input
          id="max_score"
          type="number"
          min="1"
          value={formData.max_score}
          onChange={(e) => setFormData(prev => ({ ...prev, max_score: parseInt(e.target.value) }))}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <Label>Assessment Criteria</Label>
          <Button type="button" variant="outline" size="sm" onClick={addCriterion}>
            <Plus className="h-4 w-4 mr-1" />
            Add Criterion
          </Button>
        </div>

        <div className="space-y-4">
          {formData.criteria.map((criterion, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Criterion {index + 1}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeCriterion(index)}
                >
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={criterion.name}
                    onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                    placeholder="Criterion name"
                  />
                </div>
                <div>
                  <Label>Max Score</Label>
                  <Input
                    type="number"
                    min="1"
                    value={criterion.max_score}
                    onChange={(e) => updateCriterion(index, 'max_score', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="mt-2">
                <Label>Description</Label>
                <Textarea
                  value={criterion.description}
                  onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                  placeholder="Describe this criterion"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">Create Criteria</Button>
      </div>
    </form>
  )
}