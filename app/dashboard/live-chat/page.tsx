"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquare, Users, Clock, AlertCircle, Send, UserPlus, ArrowRight, Phone, Smartphone, Globe, Zap } from "lucide-react"
import DotGrid from '@/components/DotGrid'
import { useToast } from "@/hooks/use-toast"

interface Conversation {
  id: string
  customer_identifier: string
  channel: string
  status: 'active' | 'waiting' | 'assigned' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_agent?: string
  last_message: string
  last_message_time: string
  message_count: number
  tags: string[]
}

interface Message {
  id: string
  conversation_id: string
  sender_type: 'customer' | 'agent' | 'ai'
  content: string
  timestamp: string
  sender_name?: string
}

interface Agent {
  id: string
  name: string
  status: 'online' | 'busy' | 'offline'
  active_chats: number
  max_chats: number
}

export default function LiveChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [agents, setAgents] = useState<Agent[]>([])
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Server-Sent Events connection
  useEffect(() => {
    const eventSource = new EventSource('/api/websocket/live-chat?userId=user-123')

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleWebSocketMessage(data)
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      toast({
        title: "Connection Error",
        description: "Failed to connect to live chat server",
        variant: "destructive",
      })
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'new_conversation':
        setConversations(prev => [data.conversation, ...prev])
        break
      case 'new_message':
        if (selectedConversation?.id === data.message.conversation_id) {
          setMessages(prev => [...prev, data.message])
        }
        // Update conversation's last message
        setConversations(prev =>
          prev.map(conv =>
            conv.id === data.message.conversation_id
              ? { ...conv, last_message: data.message.content, last_message_time: data.message.timestamp, message_count: conv.message_count + 1 }
              : conv
          )
        )
        break
      case 'conversation_assigned':
        setConversations(prev =>
          prev.map(conv =>
            conv.id === data.conversation_id
              ? { ...conv, status: 'assigned', assigned_agent: data.agent_id }
              : conv
          )
        )
        break
      case 'agent_status_update':
        setAgents(prev =>
          prev.map(agent =>
            agent.id === data.agent_id
              ? { ...agent, status: data.status, active_chats: data.active_chats }
              : agent
          )
        )
        break
    }
  }

  // Load initial data
  useEffect(() => {
    loadConversations()
    loadAgents()
  }, [])

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/live-chat/conversations')
      const data = await response.json()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/live-chat/agents')
      const data = await response.json()
      setAgents(data)
      // Set current agent (in real app, this would come from auth)
      setCurrentAgent(data[0])
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/live-chat/conversations/${conversationId}/messages`)
      const data = await response.json()
      setMessages(data)
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    const message: Message = {
      id: Date.now().toString(),
      conversation_id: selectedConversation.id,
      sender_type: 'agent',
      content: newMessage,
      timestamp: new Date().toISOString(),
      sender_name: currentAgent?.name
    }

    try {
      // Send via API
      await fetch('/api/websocket/live-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'send_message',
          userId: 'user-123',
          message
        })
      })

      setMessages(prev => [...prev, message])
      setNewMessage("")

      // Update conversation
      setConversations(prev =>
        prev.map(conv =>
          conv.id === selectedConversation.id
            ? { ...conv, last_message: message.content, last_message_time: message.timestamp, message_count: conv.message_count + 1 }
            : conv
        )
      )
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({
        title: "Send Failed",
        description: "Failed to send message",
        variant: "destructive",
      })
    }
  }

  const assignConversation = async (conversationId: string, agentId: string) => {
    try {
      await fetch('/api/websocket/live-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'assign_conversation',
          userId: 'user-123',
          conversation_id: conversationId,
          agent_id: agentId
        })
      })

      toast({
        title: "Conversation Assigned",
        description: "Conversation has been assigned to the selected agent",
      })
    } catch (error) {
      console.error('Failed to assign conversation:', error)
      toast({
        title: "Assignment Failed",
        description: "Failed to assign conversation",
        variant: "destructive",
      })
    }
  }

  const transferConversation = async (conversationId: string, newAgentId: string) => {
    try {
      await fetch('/api/websocket/live-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'transfer_conversation',
          userId: 'user-123',
          conversation_id: conversationId,
          new_agent_id: newAgentId
        })
      })

      toast({
        title: "Conversation Transferred",
        description: "Conversation has been transferred to another agent",
      })
    } catch (error) {
      console.error('Failed to transfer conversation:', error)
      toast({
        title: "Transfer Failed",
        description: "Failed to transfer conversation",
        variant: "destructive",
      })
    }
  }

  const resolveConversation = async (conversationId: string) => {
    try {
      await fetch('/api/websocket/live-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'resolve_conversation',
          userId: 'user-123',
          conversation_id: conversationId
        })
      })

      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, status: 'resolved' }
            : conv
        )
      )

      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null)
        setMessages([])
      }

      toast({
        title: "Conversation Resolved",
        description: "Conversation has been marked as resolved",
      })
    } catch (error) {
      console.error('Failed to resolve conversation:', error)
      toast({
        title: "Resolution Failed",
        description: "Failed to resolve conversation",
        variant: "destructive",
      })
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'waiting': return 'bg-yellow-100 text-yellow-800'
      case 'assigned': return 'bg-green-100 text-green-800'
      case 'resolved': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />
      case 'sms': return <Smartphone className="h-4 w-4" />
      case 'website': return <Globe className="h-4 w-4" />
      default: return <MessageSquare className="h-4 w-4" />
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const quickResponses = [
    "Thank you for reaching out! How can I help you today?",
    "I understand your concern. Let me assist you with that.",
    "Please give me a moment to check that for you.",
    "Is there anything else I can help you with?",
    "Thank you for your patience. I'll resolve this shortly."
  ]

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Live Chat Dashboard</h1>
        <p className="text-muted-foreground">Manage real-time customer conversations and agent assignments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Queue & Agents Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Active Agents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Agents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      agent.status === 'online' ? 'bg-green-500' :
                      agent.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'
                    }`} />
                    <span className="text-sm font-medium">{agent.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {agent.active_chats}/{agent.max_chats}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Conversation Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Queue ({conversations.filter(c => c.status === 'waiting').length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {conversations.filter(c => c.status === 'waiting').map((conversation) => (
                  <div key={conversation.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getPriorityColor(conversation.priority)}>
                        {conversation.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conversation.last_message_time).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{conversation.customer_identifier}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conversation.last_message}
                    </p>
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" variant="outline" className="text-xs h-6">
                        Assign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Chat Area */}
        <div className="lg:col-span-2">
          {selectedConversation ? (
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getChannelIcon(selectedConversation.channel)}
                    <span className="font-medium">{selectedConversation.customer_identifier}</span>
                    <Badge className={getStatusColor(selectedConversation.status)}>
                      {selectedConversation.status}
                    </Badge>
                    <Badge className={getPriorityColor(selectedConversation.priority)}>
                      {selectedConversation.priority}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <UserPlus className="h-4 w-4 mr-1" />
                          Transfer
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Transfer Conversation</DialogTitle>
                          <DialogDescription>
                            Select an agent to transfer this conversation to.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Select onValueChange={(agentId) => transferConversation(selectedConversation.id, agentId)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select agent" />
                            </SelectTrigger>
                            <SelectContent>
                              {agents.filter(a => a.id !== currentAgent?.id).map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.name} ({agent.active_chats}/{agent.max_chats})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="outline" onClick={() => resolveConversation(selectedConversation.id)}>
                      Resolve
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender_type === 'agent'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-xs">
                                {message.sender_name?.[0] || message.sender_type[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs opacity-70">
                              {message.sender_name || message.sender_type}
                            </span>
                          </div>
                          <p className="text-sm">{message.content}</p>
                          <span className="text-xs opacity-70">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="p-4 border-t">
                  <div className="flex gap-2 mb-2">
                    {quickResponses.map((response, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant="outline"
                        className="text-xs h-6"
                        onClick={() => setNewMessage(response)}
                      >
                        Quick {index + 1}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 min-h-[60px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                    />
                    <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Conversation</h3>
                <p className="text-muted-foreground">
                  Choose a conversation from the list to start chatting
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Conversation List */}
        <div className="lg:col-span-1">
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="text-lg">Active Conversations</CardTitle>
              <CardDescription>
                {conversations.filter(c => c.status !== 'resolved').length} active chats
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="space-y-2 p-4">
                  {conversations.filter(c => c.status !== 'resolved').map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedConversation?.id === conversation.id ? 'bg-muted' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        setSelectedConversation(conversation)
                        loadMessages(conversation.id)
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(conversation.channel)}
                          <Badge className={getPriorityColor(conversation.priority)} variant="outline">
                            {conversation.priority}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(conversation.last_message_time).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">{conversation.customer_identifier}</p>
                      <p className="text-xs text-muted-foreground truncate mb-2">
                        {conversation.last_message}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge className={getStatusColor(conversation.status)} variant="outline">
                          {conversation.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {conversation.message_count} msgs
                        </span>
                      </div>
                      {conversation.assigned_agent && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Assigned to: {agents.find(a => a.id === conversation.assigned_agent)?.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}