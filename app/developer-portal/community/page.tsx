'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageSquare, ThumbsUp, Users, HelpCircle, Lightbulb, Bug } from 'lucide-react'
import DotGrid from '@/components/DotGrid'
import { toast } from 'sonner'

// Mock data for demonstration
const discussions = [
  {
    id: 1,
    title: 'Best practices for API rate limiting',
    author: 'John Doe',
    avatar: '/placeholder-user.jpg',
    category: 'Best Practices',
    replies: 12,
    likes: 24,
    lastActivity: '2 hours ago',
    tags: ['rate-limiting', 'performance'],
    excerpt: 'I\'m looking for recommendations on how to handle rate limiting in high-traffic applications...'
  },
  {
    id: 2,
    title: 'Embedding API returning 429 errors',
    author: 'Jane Smith',
    avatar: '/placeholder-user.jpg',
    category: 'Support',
    replies: 5,
    likes: 8,
    lastActivity: '4 hours ago',
    tags: ['embeddings', 'error', '429'],
    excerpt: 'Getting rate limit errors when using the embeddings endpoint. Any suggestions?'
  },
  {
    id: 3,
    title: 'New webhook events for live chat',
    author: 'Mike Johnson',
    avatar: '/placeholder-user.jpg',
    category: 'Announcements',
    replies: 18,
    likes: 45,
    lastActivity: '1 day ago',
    tags: ['webhooks', 'live-chat', 'new-feature'],
    excerpt: 'We\'ve added new webhook events for live chat conversations. Check out the documentation...'
  }
]

const categories = [
  { name: 'All Topics', count: 156, icon: MessageSquare },
  { name: 'Support', count: 43, icon: HelpCircle },
  { name: 'Best Practices', count: 28, icon: Lightbulb },
  { name: 'Announcements', count: 12, icon: Users },
  { name: 'Bug Reports', count: 8, icon: Bug },
]

export default function CommunityPage() {
  const [selectedCategory, setSelectedCategory] = useState('All Topics')
  const [showNewDiscussion, setShowNewDiscussion] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  const handleCreateDiscussion = () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Please fill in both title and content')
      return
    }

    // In a real app, this would create the discussion
    toast.success('Discussion created successfully!')
    setShowNewDiscussion(false)
    setNewTitle('')
    setNewContent('')
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
          <h1 className="text-3xl font-bold">Developer Community</h1>
          <p className="text-muted-foreground">Connect with other developers, share knowledge, and get help</p>
        </div>
        <Button onClick={() => setShowNewDiscussion(true)}>
          <MessageSquare className="mr-2 h-4 w-4" />
          Start Discussion
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map((category) => (
                <Button
                  key={category.name}
                  variant={selectedCategory === category.name ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category.name)}
                >
                  <category.icon className="mr-2 h-4 w-4" />
                  {category.name}
                  <Badge variant="secondary" className="ml-auto">
                    {category.count}
                  </Badge>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Community Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Developers</span>
                <span className="font-semibold">1,247</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Discussions</span>
                <span className="font-semibold">156</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Solutions</span>
                <span className="font-semibold">89</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {showNewDiscussion ? (
            <Card>
              <CardHeader>
                <CardTitle>Start a New Discussion</CardTitle>
                <CardDescription>
                  Share your questions, ideas, or help other developers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    placeholder="What's your question or topic?"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content</label>
                  <Textarea
                    placeholder="Provide details about your question or discussion topic..."
                    rows={6}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowNewDiscussion(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateDiscussion}>
                    Create Discussion
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {discussions.map((discussion) => (
                <Card key={discussion.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={discussion.avatar} />
                        <AvatarFallback>{discussion.author.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold hover:text-primary">
                            {discussion.title}
                          </h3>
                          <Badge variant="outline">{discussion.category}</Badge>
                        </div>

                        <p className="text-muted-foreground text-sm">
                          {discussion.excerpt}
                        </p>

                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>by {discussion.author}</span>
                          <span>•</span>
                          <span>{discussion.lastActivity}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex space-x-2">
                            {discussion.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <MessageSquare className="h-4 w-4" />
                              <span>{discussion.replies}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <ThumbsUp className="h-4 w-4" />
                              <span>{discussion.likes}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}