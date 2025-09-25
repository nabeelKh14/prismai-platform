'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  Clock,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'
import { usePerformanceMonitor, usePerformanceBudget } from '@/lib/performance-utils'

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  memoryUsage: number
  firstContentfulPaint?: number
  largestContentfulPaint?: number
  firstInputDelay?: number
  cumulativeLayoutShift?: number
}

interface PerformanceMonitorProps {
  showDetails?: boolean
  compact?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export function PerformanceMonitor({
  showDetails = false,
  compact = false,
  position = 'top-right'
}: PerformanceMonitorProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
  })

  const { budgetExceeded, budgetMetrics } = usePerformanceBudget()

  useEffect(() => {
    // Collect performance metrics
    const collectMetrics = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paintEntries = performance.getEntriesByType('paint')
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
      const fidEntries = performance.getEntriesByType('first-input')
      const clsEntries = performance.getEntriesByType('layout-shift')

      const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime
      const largestContentfulPaint = lcpEntries[0]?.startTime
      const firstInputDelay = (fidEntries[0] as any)?.processingStart
      const cumulativeLayoutShift = clsEntries.reduce((sum, entry) => sum + (entry as any).value, 0)

      setMetrics({
        loadTime: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
        renderTime: performance.now(),
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        firstContentfulPaint,
        largestContentfulPaint,
        firstInputDelay,
        cumulativeLayoutShift,
      })
    }

    // Collect metrics after page load
    if (document.readyState === 'complete') {
      collectMetrics()
    } else {
      window.addEventListener('load', collectMetrics)
    }

    return () => window.removeEventListener('load', collectMetrics)
  }, [])

  const getPerformanceScore = () => {
    let score = 100

    if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > 1800) score -= 20
    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) score -= 25
    if (metrics.firstInputDelay && metrics.firstInputDelay > 100) score -= 15
    if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > 0.1) score -= 15
    if (metrics.loadTime > 3000) score -= 15

    return Math.max(0, score)
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500'
    if (score >= 70) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (score >= 70) return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    return <XCircle className="h-4 w-4 text-red-500" />
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  }

  if (compact) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <Card className="w-64">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getScoreIcon(getPerformanceScore())}
                <span className="font-semibold">Performance</span>
              </div>
              <Badge variant={budgetExceeded ? 'destructive' : 'secondary'}>
                {getPerformanceScore()}%
              </Badge>
            </div>
            {budgetExceeded && (
              <div className="mt-2 text-xs text-red-500">
                Budget exceeded
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!showDetails) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
          className="bg-background/80 backdrop-blur-sm"
        >
          <Activity className="h-4 w-4 mr-2" />
          Performance
        </Button>
        {isVisible && (
          <Card className="w-80 mt-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Overall Score</span>
                <div className="flex items-center gap-1">
                  {getScoreIcon(getPerformanceScore())}
                  <span className={`font-semibold ${getScoreColor(getPerformanceScore())}`}>
                    {getPerformanceScore()}%
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>FCP</span>
                  <span>{formatTime(metrics.firstContentfulPaint || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>LCP</span>
                  <span>{formatTime(metrics.largestContentfulPaint || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>FID</span>
                  <span>{formatTime(metrics.firstInputDelay || 0)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>CLS</span>
                  <span>{(metrics.cumulativeLayoutShift || 0).toFixed(3)}</span>
                </div>
              </div>

              {budgetExceeded && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                  Performance budget exceeded
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Dashboard
          </CardTitle>
          <CardDescription>
            Real-time performance monitoring and optimization insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="budget">Budget</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Overall Score</span>
                <div className="flex items-center gap-2">
                  {getScoreIcon(getPerformanceScore())}
                  <span className={`text-2xl font-bold ${getScoreColor(getPerformanceScore())}`}>
                    {getPerformanceScore()}%
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Load Time</span>
                  <span className="text-sm font-mono">{formatTime(metrics.loadTime)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Memory Usage</span>
                  <span className="text-sm font-mono">{formatBytes(metrics.memoryUsage)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Render Time</span>
                  <span className="text-sm font-mono">{formatTime(metrics.renderTime)}</span>
                </div>
              </div>

              {budgetExceeded && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold text-sm">Budget Exceeded</span>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Performance metrics are above the recommended thresholds
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">CORE WEB VITALS</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>FCP</span>
                      <span className="font-mono">{formatTime(metrics.firstContentfulPaint || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>LCP</span>
                      <span className="font-mono">{formatTime(metrics.largestContentfulPaint || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>FID</span>
                      <span className="font-mono">{formatTime(metrics.firstInputDelay || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>CLS</span>
                      <span className="font-mono">{(metrics.cumulativeLayoutShift || 0).toFixed(3)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">RESOURCES</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Load Time</span>
                      <span className="font-mono">{formatTime(metrics.loadTime)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Memory</span>
                      <span className="font-mono">{formatBytes(metrics.memoryUsage)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Render</span>
                      <span className="font-mono">{formatTime(metrics.renderTime)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="budget" className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">First Contentful Paint</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{formatTime(metrics.firstContentfulPaint || 0)}</span>
                    <span className="text-xs text-muted-foreground">/ 1.8s</span>
                  </div>
                </div>
                <Progress
                  value={Math.min(100, ((metrics.firstContentfulPaint || 0) / 1800) * 100)}
                  className="h-2"
                />

                <div className="flex items-center justify-between">
                  <span className="text-sm">Largest Contentful Paint</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{formatTime(metrics.largestContentfulPaint || 0)}</span>
                    <span className="text-xs text-muted-foreground">/ 2.5s</span>
                  </div>
                </div>
                <Progress
                  value={Math.min(100, ((metrics.largestContentfulPaint || 0) / 2500) * 100)}
                  className="h-2"
                />

                <div className="flex items-center justify-between">
                  <span className="text-sm">First Input Delay</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{formatTime(metrics.firstInputDelay || 0)}</span>
                    <span className="text-xs text-muted-foreground">/ 100ms</span>
                  </div>
                </div>
                <Progress
                  value={Math.min(100, ((metrics.firstInputDelay || 0) / 100) * 100)}
                  className="h-2"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// Performance indicator component for inline use
export function PerformanceIndicator({ score }: { score: number }) {
  const getStatus = (score: number) => {
    if (score >= 90) return { status: 'excellent', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950' }
    if (score >= 70) return { status: 'good', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950' }
    return { status: 'poor', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950' }
  }

  const { status, color, bg } = getStatus(score)

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${bg}`}>
      <div className={`w-2 h-2 rounded-full ${score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} />
      <span className={color}>{status}</span>
      <span className="font-mono">{score}%</span>
    </div>
  )
}

// Bundle analyzer component
export function BundleAnalyzer() {
  const [bundleStats, setBundleStats] = useState<any>(null)

  useEffect(() => {
    // This would typically fetch from a bundle analyzer API
    // For demo purposes, we'll use mock data
    setBundleStats({
      totalSize: '2.4 MB',
      chunks: [
        { name: 'main', size: '1.2 MB', modules: 245 },
        { name: 'vendor', size: '800 KB', modules: 180 },
        { name: 'dashboard', size: '400 KB', modules: 95 },
      ]
    })
  }, [])

  if (!bundleStats) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Bundle Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total Bundle Size</span>
            <span className="text-lg font-mono">{bundleStats.totalSize}</span>
          </div>

          <div className="space-y-2">
            {bundleStats.chunks.map((chunk: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                <div>
                  <div className="font-medium">{chunk.name}</div>
                  <div className="text-xs text-muted-foreground">{chunk.modules} modules</div>
                </div>
                <div className="font-mono">{chunk.size}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}