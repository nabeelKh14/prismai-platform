"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Play, Clock, MessageSquare, Mic, Info } from "lucide-react"
import type { DemoScenario } from "@/lib/ai/demo-controller"

interface ScenarioSelectorProps {
  scenarios: Record<string, DemoScenario>
  onScenarioSelect: (scenarioName: string) => Promise<void>
  isLoading?: boolean
  currentScenario?: string
}

export function ScenarioSelector({
  scenarios,
  onScenarioSelect,
  isLoading = false,
  currentScenario
}: ScenarioSelectorProps) {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  const handleScenarioStart = async (scenarioName: string) => {
    setIsStarting(true)
    try {
      await onScenarioSelect(scenarioName)
      setSelectedScenario(scenarioName)
    } catch (error) {
      console.error('Failed to start scenario:', error)
    } finally {
      setIsStarting(false)
    }
  }

  const getScenarioIcon = (scenarioName: string) => {
    if (scenarioName.includes('inquiry')) return '❓'
    if (scenarioName.includes('mixed')) return '🎭'
    if (scenarioName.includes('support')) return '🛠️'
    return '🎯'
  }

  const getModalityCount = (scenario: DemoScenario) => {
    const voiceCount = scenario.inputs.filter(input => input.modality === 'voice').length
    const textCount = scenario.inputs.filter(input => input.modality === 'text').length
    return { voice: voiceCount, text: textCount }
  }

  const getTotalDuration = (scenario: DemoScenario) => {
    const lastInput = scenario.inputs[scenario.inputs.length - 1]
    return lastInput ? lastInput.delay + 5 : 0 // Add buffer time
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Choose a Demo Scenario</h2>
        <p className="text-gray-400">
          Select a scenario to see how our AI handles different types of customer interactions
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {Object.entries(scenarios).map(([scenarioName, scenario]) => {
          const modalityCount = getModalityCount(scenario)
          const totalDuration = getTotalDuration(scenario)
          const isActive = currentScenario === scenarioName

          return (
            <Card
              key={scenarioName}
              className={`bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-colors ${
                isActive ? 'border-purple-500 bg-purple-500/10' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{getScenarioIcon(scenarioName)}</div>
                    <div>
                      <CardTitle className="text-white text-lg">{scenario.name}</CardTitle>
                      <CardDescription className="text-gray-400">
                        {scenario.description}
                      </CardDescription>
                    </div>
                  </div>
                  {isActive && (
                    <Badge className="bg-green-500/20 text-green-400">
                      Active
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Scenario Stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-white">
                      {scenario.inputs.length}
                    </div>
                    <div className="text-xs text-gray-400">Interactions</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white flex items-center justify-center gap-1">
                      <Clock className="h-4 w-4" />
                      {totalDuration}s
                    </div>
                    <div className="text-xs text-gray-400">Duration</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {modalityCount.voice + modalityCount.text}
                    </div>
                    <div className="text-xs text-gray-400">Messages</div>
                  </div>
                </div>

                {/* Modality Breakdown */}
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-300">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {modalityCount.text} text
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-300">
                    <Mic className="h-3 w-3 mr-1" />
                    {modalityCount.voice} voice
                  </Badge>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Info className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-slate-700">
                      <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                          <div className="text-xl">{getScenarioIcon(scenarioName)}</div>
                          {scenario.name}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                          {scenario.description}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-white font-medium mb-2">Scenario Steps:</h4>
                          <div className="space-y-2">
                            {scenario.inputs.map((input, index) => (
                              <div key={index} className="flex items-start gap-3 p-2 bg-slate-800/50 rounded">
                                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {input.modality === 'voice' ? (
                                        <>
                                          <Mic className="h-3 w-3 mr-1" />
                                          Voice
                                        </>
                                      ) : (
                                        <>
                                          <MessageSquare className="h-3 w-3 mr-1" />
                                          Text
                                        </>
                                      )}
                                    </Badge>
                                    <span className="text-xs text-gray-400">
                                      {input.delay}s delay
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-300">
                                    {input.modality === 'voice' ? `Voice: ${input.content}` : input.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    onClick={() => handleScenarioStart(scenarioName)}
                    disabled={isLoading || isStarting || isActive}
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    {isStarting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        {isActive ? 'Running' : 'Start Demo'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Current Scenario Status */}
      {currentScenario && (
        <Card className="bg-green-900/20 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="text-green-400 font-medium">
                  Running: {scenarios[currentScenario]?.name}
                </p>
                <p className="text-sm text-gray-400">
                  The demo scenario is actively simulating customer interactions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}