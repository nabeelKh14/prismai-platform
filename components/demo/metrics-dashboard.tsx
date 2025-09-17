"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Clock,
  MessageSquare,
  Mic,
  Zap,
  TrendingUp,
  Activity,
  BarChart3,
  Timer
} from "lucide-react"
import type { ConversationMetrics } from "@/hooks/use-conversation"

interface MetricsDashboardProps {
  metrics: ConversationMetrics
  sessionMetrics?: {
    inputsProcessed: number
    responsesGenerated: number
    averageResponseTime: number
    sessionDuration: number
  }
}

export function MetricsDashboard({ metrics, sessionMetrics }: MetricsDashboardProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getResponseTimeColor = (time: number) => {
    if (time < 1000) return "text-green-600"
    if (time < 3000) return "text-yellow-600"
    return "text-red-600"
  }

  const getResponseTimeStatus = (time: number) => {
    if (time < 1000) return "Excellent"
    if (time < 3000) return "Good"
    return "Needs Improvement"
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Response Time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Avg Response Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getResponseTimeColor(metrics.averageResponseTime)}`}>
            {metrics.averageResponseTime}ms
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {getResponseTimeStatus(metrics.averageResponseTime)}
          </div>
          <Progress
            value={Math.min((metrics.averageResponseTime / 3000) * 100, 100)}
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* Total Messages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Total Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metrics.totalMessages}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              <Mic className="h-3 w-3 mr-1" />
              {metrics.voiceMessages} voice
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              {metrics.textMessages} text
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Message Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Message Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Voice</span>
              <span>{metrics.voiceMessages}</span>
            </div>
            <Progress
              value={metrics.totalMessages > 0 ? (metrics.voiceMessages / metrics.totalMessages) * 100 : 0}
              className="h-2"
            />
            <div className="flex justify-between text-sm">
              <span>Text</span>
              <span>{metrics.textMessages}</span>
            </div>
            <Progress
              value={metrics.totalMessages > 0 ? (metrics.textMessages / metrics.totalMessages) * 100 : 0}
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Session Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Session Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            Active
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Last activity: {new Date(metrics.lastActivity).toLocaleTimeString()}
          </div>
          {sessionMetrics && (
            <div className="mt-2 text-xs text-gray-600">
              Session: {formatDuration(sessionMetrics.sessionDuration)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      {sessionMetrics && (
        <>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Session Performance
              </CardTitle>
              <CardDescription>
                Real-time metrics for the current demo session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {sessionMetrics.inputsProcessed}
                  </div>
                  <div className="text-xs text-gray-500">Inputs Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {sessionMetrics.responsesGenerated}
                  </div>
                  <div className="text-xs text-gray-500">Responses Generated</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {sessionMetrics.averageResponseTime}ms
                  </div>
                  <div className="text-xs text-gray-500">Avg Response Time</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">
                    {formatDuration(sessionMetrics.sessionDuration)}
                  </div>
                  <div className="text-xs text-gray-500">Session Duration</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Indicators */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Performance Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Response Time</span>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={Math.max(0, 100 - (sessionMetrics.averageResponseTime / 30))}
                      className="w-20 h-2"
                    />
                    <span className={`text-xs font-medium ${getResponseTimeColor(sessionMetrics.averageResponseTime)}`}>
                      {sessionMetrics.averageResponseTime < 1000 ? 'Fast' :
                       sessionMetrics.averageResponseTime < 3000 ? 'Good' : 'Slow'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Processing Rate</span>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={Math.min(100, (sessionMetrics.responsesGenerated / sessionMetrics.inputsProcessed) * 100)}
                      className="w-20 h-2"
                    />
                    <span className="text-xs font-medium text-green-600">
                      {Math.round((sessionMetrics.responsesGenerated / Math.max(sessionMetrics.inputsProcessed, 1)) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Multimodal Usage</span>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={metrics.totalMessages > 0 ? (metrics.voiceMessages / metrics.totalMessages) * 100 : 0}
                      className="w-20 h-2"
                    />
                    <span className="text-xs font-medium text-blue-600">
                      {metrics.totalMessages > 0 ? Math.round((metrics.voiceMessages / metrics.totalMessages) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}