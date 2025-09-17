"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Brain, Activity, ArrowRight, Settings, Play, MessageSquare, Mic, X } from "lucide-react"
import Link from "next/link"
import { useConversation } from "@/hooks/use-conversation"
import { MultimodalInput } from "@/components/demo/multimodal-input"
import { ConversationDisplay } from "@/components/demo/conversation-display"
import { MetricsDashboard } from "@/components/demo/metrics-dashboard"
import { ScenarioSelector } from "@/components/demo/scenario-selector"
import { demoController } from "@/lib/ai/demo-controller"

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'interactive'>('scenarios')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentScenario, setCurrentScenario] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [sessionMetrics, setSessionMetrics] = useState<any>(null)

  // Initialize conversation
  useEffect(() => {
    const initConversation = async () => {
      try {
        const response = await fetch('/api/unified/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'demo',
            customerIdentifier: 'demo-user'
          })
        })

        if (response.ok) {
          const data = await response.json()
          setConversationId(data.conversationId)
        }
      } catch (error) {
        console.error('Failed to initialize conversation:', error)
      }
    }

    initConversation()
  }, [])

  // Load scenarios
  useEffect(() => {
    const loadScenarios = async () => {
      try {
        const response = await fetch('/api/demo/session')
        if (response.ok) {
          const data = await response.json()
          setScenarios(data.scenarios || {})
        }
      } catch (error) {
        console.error('Failed to load scenarios:', error)
      } finally {
        setLoading(false)
      }
    }

    loadScenarios()
  }, [])

  // Load session metrics periodically
  useEffect(() => {
    if (!currentScenario) return

    const loadMetrics = async () => {
      try {
        const metrics = await demoController.getDemoMetrics(currentScenario)
        setSessionMetrics(metrics)
      } catch (error) {
        console.error('Failed to load session metrics:', error)
      }
    }

    loadMetrics()
    const interval = setInterval(loadMetrics, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [currentScenario])

  const { messages, metrics, isLoading: conversationLoading, error, sendMessage } = useConversation(conversationId || '')

  const handleScenarioSelect = async (scenarioName: string) => {
    if (!conversationId) return

    try {
      const response = await fetch('/api/demo/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioName,
          conversationId
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentScenario(scenarioName)
        setActiveTab('interactive')
      }
    } catch (error) {
      console.error('Failed to start scenario:', error)
    }
  }

  const handleSendMessage = async (content: string, modality: 'voice' | 'text') => {
    await sendMessage(content, modality)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#0B0B0D'}}>
        {/* Premium Background Effects */}
        <div className="absolute inset-0 gradient-premium opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-pink-500/8" />

        <div className="text-center space-y-8 relative z-10 animate-fade-in-up">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center animate-float">
                <Brain className="h-10 w-10 text-cyan-400 animate-pulse" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-ping" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white premium-heading">Initializing AI Demo</h2>
              <p className="text-gray-300 text-lg max-w-md">
                Setting up your personalized AI receptionist experience...
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-400 border-t-transparent"></div>
              <span className="text-cyan-300 font-medium">Loading scenarios...</span>
            </div>
          </div>

          {/* Premium Stats During Loading */}
          <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mt-12">
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gradient-cyan mb-1">99.9%</div>
              <div className="text-xs text-gray-400">Uptime</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gradient-pink mb-1">2.3s</div>
              <div className="text-xs text-gray-400">Response</div>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gradient-cyan mb-1">24/7</div>
              <div className="text-xs text-gray-400">Available</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{backgroundColor: '#0B0B0D'}}>
      {/* Premium Header */}
      <div className="border-b border-cyan-500/20 backdrop-blur supports-[backdrop-filter]:bg-[#0B0B0D]/60 sticky top-0 z-50" style={{backgroundColor: '#0B0B0D'}}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-pink-500 rounded-lg flex items-center justify-center shadow-premium">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-white premium-heading">Interactive AI Demo</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="glass rounded-full px-4 py-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-300">Live Demo</span>
              </div>
              <Button
                variant="outline"
                className="glass-strong text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all duration-300"
                asChild
              >
                <Link href="/">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Background Effects */}
      <div className="absolute inset-0 gradient-premium opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-pink-500/8" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Premium Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 glass rounded-full px-6 py-3 mb-6 animate-fade-in-up">
            <Brain className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">Experience Our AI Technology</span>
          </div>
          <h1 className="premium-heading text-4xl md:text-5xl lg:text-6xl mb-6 text-white animate-fade-in-up" style={{animationDelay: '0.2s'}}>
            Test Drive the{" "}
            <span className="text-gradient">Future of AI</span>
          </h1>
          <p className="premium-subheading text-xl text-gray-300 max-w-3xl mx-auto animate-fade-in-up" style={{animationDelay: '0.4s'}}>
            Interact with our advanced AI receptionist in real-time. Choose from multiple scenarios to experience different use cases.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-12 glass rounded-2xl p-2">
            <TabsTrigger
              value="scenarios"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-pink-500/20 data-[state=active]:text-white rounded-xl transition-all duration-300"
            >
              <Settings className="h-4 w-4" />
              Demo Scenarios
            </TabsTrigger>
            <TabsTrigger
              value="interactive"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/20 data-[state=active]:to-pink-500/20 data-[state=active]:text-white rounded-xl transition-all duration-300"
            >
              <MessageSquare className="h-4 w-4" />
              Interactive Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="space-y-6">
            <ScenarioSelector
              scenarios={scenarios}
              onScenarioSelect={handleScenarioSelect}
              currentScenario={currentScenario || undefined}
            />
          </TabsContent>

          <TabsContent value="interactive" className="space-y-6">
            {conversationId ? (
              <>
                {/* Metrics Dashboard */}
                <MetricsDashboard
                  metrics={metrics}
                  sessionMetrics={sessionMetrics}
                />

                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Conversation Display */}
                  <div className="lg:col-span-2">
                    <ConversationDisplay
                      messages={messages}
                      isLoading={conversationLoading}
                    />
                  </div>

                  {/* Multimodal Input */}
                  <div className="space-y-6">
                    <Card className="card-premium p-6">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-white flex items-center gap-3 text-lg">
                          <div className="w-10 h-10 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 rounded-xl flex items-center justify-center">
                            <Mic className="h-5 w-5 text-cyan-400" />
                          </div>
                          Send Message
                        </CardTitle>
                        <CardDescription className="text-gray-400 text-sm">
                          Type your message or record voice input to interact with our AI
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <MultimodalInput
                          onSendMessage={handleSendMessage}
                          disabled={!conversationId || conversationLoading}
                          placeholder="Ask me anything about our AI services..."
                        />
                      </CardContent>
                    </Card>

                    {/* Current Scenario Info */}
                    {currentScenario && (
                      <Card className="card-premium p-4">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-white text-sm flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            Active Scenario
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-green-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center">
                              <Brain className="h-4 w-4 text-green-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">
                                {scenarios[currentScenario]?.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                Automated demo in progress
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Error Display */}
                    {error && (
                      <Card className="glass-strong border-red-500/30 bg-red-900/10">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center">
                              <X className="h-4 w-4 text-red-400" />
                            </div>
                            <p className="text-red-300 text-sm">{error}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <Card className="card-premium p-8 text-center">
                <CardContent className="p-0">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center">
                      <MessageSquare className="h-8 w-8 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-3 premium-heading">Ready to Experience AI?</h3>
                      <p className="text-gray-300 text-lg leading-relaxed max-w-md">
                        Start a demo scenario to begin interacting with our advanced AI receptionist
                      </p>
                    </div>
                    <Button
                      onClick={() => setActiveTab('scenarios')}
                      className="btn-premium text-lg px-8 py-4 font-semibold rounded-2xl group"
                    >
                      <Play className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                      Choose Your Scenario
                      <ArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}