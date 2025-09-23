"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Upload,
  Download,
  Eye,
  EyeOff,
  Tag,
  Folder,
  FileText,
  MoreHorizontal,
  Filter,
  CheckCircle,
  XCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import DotGrid from '@/components/DotGrid'

interface KnowledgeArticle {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  is_published: boolean
  created_at: string
  updated_at: string
}

interface ImportProgress {
  total: number
  processed: number
  errors: number
  status: 'idle' | 'processing' | 'completed' | 'error'
}

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress>({ total: 0, processed: 0, errors: 0, status: 'idle' })

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    tags: [] as string[],
    is_published: false
  })

  // Categories and tags from articles
  const categories = Array.from(new Set(articles.map(a => a.category).filter(Boolean)))
  const allTags = Array.from(new Set(articles.flatMap(a => a.tags)))

  // Mock data for demonstration
  const mockArticles: KnowledgeArticle[] = [
    {
      id: "1",
      title: "Getting Started with Our Services",
      content: "Welcome to our comprehensive guide on getting started with our AI-powered business solutions...",
      category: "Getting Started",
      tags: ["onboarding", "tutorial", "basics"],
      is_published: true,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-20T14:30:00Z"
    },
    {
      id: "2",
      title: "PrismAI Features",
      content: "Our PrismAI platform can handle calls 24/7, book appointments, and provide instant responses...",
      category: "Features",
      tags: ["AI", "receptionist", "automation"],
      is_published: true,
      created_at: "2024-01-10T09:00:00Z",
      updated_at: "2024-01-18T11:15:00Z"
    },
    {
      id: "3",
      title: "Troubleshooting Common Issues",
      content: "This guide covers the most common technical issues and their solutions...",
      category: "Support",
      tags: ["troubleshooting", "support", "technical"],
      is_published: false,
      created_at: "2024-01-12T16:00:00Z",
      updated_at: "2024-01-12T16:00:00Z"
    }
  ]

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setArticles(mockArticles)
      setLoading(false)
    }, 1000)
  }, [])

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = categoryFilter === "all" || article.category === categoryFilter
    const matchesStatus = statusFilter === "all" ||
                         (statusFilter === "published" && article.is_published) ||
                         (statusFilter === "draft" && !article.is_published)

    return matchesSearch && matchesCategory && matchesStatus
  })

  const handleCreateArticle = () => {
    // Mock create - in real app, this would call an API
    const newArticle: KnowledgeArticle = {
      id: Date.now().toString(),
      ...formData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setArticles([...articles, newArticle])
    setIsCreateDialogOpen(false)
    resetForm()
  }

  const handleEditArticle = () => {
    if (!selectedArticle) return

    // Mock update - in real app, this would call an API
    setArticles(articles.map(article =>
      article.id === selectedArticle.id
        ? { ...article, ...formData, updated_at: new Date().toISOString() }
        : article
    ))
    setIsEditDialogOpen(false)
    resetForm()
  }

  const handleDeleteArticle = (id: string) => {
    setArticles(articles.filter(article => article.id !== id))
  }

  const handleTogglePublish = (id: string) => {
    setArticles(articles.map(article =>
      article.id === id
        ? { ...article, is_published: !article.is_published, updated_at: new Date().toISOString() }
        : article
    ))
  }

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: '',
      tags: [],
      is_published: false
    })
    setSelectedArticle(null)
  }

  const openEditDialog = (article: KnowledgeArticle) => {
    setSelectedArticle(article)
    setFormData({
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags,
      is_published: article.is_published
    })
    setIsEditDialogOpen(true)
  }

  const handleImport = async (files: FileList) => {
    setImportProgress({ total: files.length, processed: 0, errors: 0, status: 'processing' })

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        // Mock processing - in real app, parse file and create articles
        await new Promise(resolve => setTimeout(resolve, 1000))
        setImportProgress(prev => ({ ...prev, processed: prev.processed + 1 }))
      } catch (error) {
        setImportProgress(prev => ({ ...prev, errors: prev.errors + 1 }))
      }
    }

    setImportProgress(prev => ({ ...prev, status: 'completed' }))
    setTimeout(() => setIsImportDialogOpen(false), 2000)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Knowledge Base</h1>
          <p className="text-gray-400 mt-2">
            Manage your chatbot knowledge base articles and content
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">Import Knowledge Base</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Upload CSV, JSON, or text files to bulk import articles
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400">Drop files here or click to browse</p>
                  <input
                    type="file"
                    multiple
                    accept=".csv,.json,.txt"
                    className="hidden"
                    onChange={(e) => e.target.files && handleImport(e.target.files)}
                  />
                </div>
                {importProgress.status !== 'idle' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Processing...</span>
                      <span className="text-white">{importProgress.processed}/{importProgress.total}</span>
                    </div>
                    <Progress value={(importProgress.processed / importProgress.total) * 100} />
                    {importProgress.errors > 0 && (
                      <p className="text-red-400 text-sm">{importProgress.errors} errors occurred</p>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
                <Plus className="h-4 w-4 mr-2" />
                New Article
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Article</DialogTitle>
              </DialogHeader>
              <ArticleForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleCreateArticle}
                submitLabel="Create Article"
                categories={categories}
                allTags={allTags}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{articles.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {articles.filter(a => a.is_published).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{categories.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{allTags.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-400">Article</TableHead>
                <TableHead className="text-gray-400">Category</TableHead>
                <TableHead className="text-gray-400">Tags</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Updated</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArticles.map((article) => (
                <TableRow key={article.id} className="border-gray-700 hover:bg-gray-700/30">
                  <TableCell>
                    <div>
                      <div className="font-medium text-white">{article.title}</div>
                      <div className="text-sm text-gray-400 line-clamp-2">{article.content}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <Folder className="h-3 w-3 mr-1" />
                      {article.category || 'Uncategorized'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {article.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                          <Tag className="h-2 w-2 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                      {article.tags.length > 2 && (
                        <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">
                          +{article.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      article.is_published
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                    )}>
                      {article.is_published ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Published
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Draft
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    {new Date(article.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePublish(article.id)}
                      >
                        {article.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(article)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteArticle(article.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Article</DialogTitle>
          </DialogHeader>
          <ArticleForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleEditArticle}
            submitLabel="Update Article"
            categories={categories}
            allTags={allTags}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ArticleFormProps {
  formData: {
    title: string
    content: string
    category: string
    tags: string[]
    is_published: boolean
  }
  setFormData: (data: any) => void
  onSubmit: () => void
  submitLabel: string
  categories: string[]
  allTags: string[]
}

function ArticleForm({ formData, setFormData, onSubmit, submitLabel, categories, allTags }: ArticleFormProps) {
  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] })
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title" className="text-white">Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="bg-gray-700/50 border-gray-600 text-white"
          placeholder="Article title"
        />
      </div>

      <div>
        <Label htmlFor="category" className="text-white">Category</Label>
        <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
          <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
            <SelectItem value="new">+ Create new category</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="tags" className="text-white">Tags</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.tags.map(tag => (
            <Badge key={tag} variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-red-400"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
        <Select onValueChange={addTag}>
          <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white">
            <SelectValue placeholder="Add tag" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {allTags.filter(tag => !formData.tags.includes(tag)).map(tag => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
            <SelectItem value="new">+ Create new tag</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="content" className="text-white">Content</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          className="bg-gray-700/50 border-gray-600 text-white min-h-32"
          placeholder="Article content"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="published"
          checked={formData.is_published}
          onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
          className="rounded border-gray-600"
        />
        <Label htmlFor="published" className="text-white">Publish immediately</Label>
      </div>

      <Button onClick={onSubmit} className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
        {submitLabel}
      </Button>
    </div>
  )
}