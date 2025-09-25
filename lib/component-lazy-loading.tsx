'use client'

import React, { Suspense, ComponentType } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'


// Chart Components - Heavy libraries that should be lazy loaded
export const LazyChart = ({ loading, children, ...props }: any) => (
  <div className="w-full h-64">
    <Skeleton className="h-full w-full" />
  </div>
)

// Recharts wrapper
export const LazyRecharts = ({ loading, children, ...props }: any) => (
  <div className="w-full h-64 flex items-center justify-center">
    <div className="text-center space-y-2">
      <Skeleton className="h-4 w-32 mx-auto" />
      <Skeleton className="h-3 w-24 mx-auto" />
    </div>
  </div>
)

// Dashboard Components - Heavy business logic components
export const LazyDashboardNav = ({ children, ...props }: any) => (
  <div className="space-y-2">
    <div className="h-10 bg-gray-200 rounded animate-pulse" />
    <div className="h-10 bg-gray-200 rounded animate-pulse" />
    <div className="h-10 bg-gray-200 rounded animate-pulse" />
    <div className="h-10 bg-gray-200 rounded animate-pulse" />
    <div className="h-10 bg-gray-200 rounded animate-pulse" />
  </div>
)

export const LazyMetricsDashboard = ({ children, ...props }: any) => (
  <Card>
    <CardContent className="p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </CardContent>
  </Card>
)

export const LazyConversationDisplay = ({ children, ...props }: any) => (
  <div className="space-y-4">
    {Array.from({ length: 3 }, (_, i) => (
      <div key={i} className="flex space-x-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    ))}
  </div>
)

export const LazyMultimodalInput = ({ children, ...props }: any) => (
  <div className="space-y-3">
    <Skeleton className="h-12 w-full" />
    <div className="flex space-x-2">
      <Skeleton className="h-10 w-10" />
      <Skeleton className="h-10 w-10" />
      <Skeleton className="h-10 w-10" />
    </div>
  </div>
)

export const LazyScenarioSelector = ({ children, ...props }: any) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {Array.from({ length: 4 }, (_, i) => (
      <Card key={i}>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
)

// AI Components - Heavy AI-related functionality
export const LazyCallDemo = ({ children, ...props }: any) => (
  <Card>
    <CardContent className="p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24 mt-1" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    </CardContent>
  </Card>
)

// Developer Portal Components
export const LazyDeveloperPortalNav = ({ children, ...props }: any) => (
  <div className="space-y-2">
    {Array.from({ length: 6 }, (_, i) => (
      <Skeleton key={i} className="h-10 w-full" />
    ))}
  </div>
)

// MCP Components
export const LazyMCPDashboard = ({ children, ...props }: any) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardContent className="p-4">
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  </div>
)

// Monitoring Components
export const LazyPerformanceDashboard = ({ children, ...props }: any) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardContent className="p-4">
        <Skeleton className="h-48 w-full" />
      </CardContent>
    </Card>
  </div>
)

// Heavy UI Components
export const LazyCalendar = ({ children, ...props }: any) => (
  <div className="p-3">
    <Skeleton className="h-6 w-32 mb-4" />
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 35 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-8" />
      ))}
    </div>
  </div>
)

export const LazyCommand = ({ children, ...props }: any) => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" />
    <div className="space-y-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  </div>
)

export const LazyTable = ({ children, ...props }: any) => (
  <div className="space-y-3">
    <div className="flex space-x-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-4 w-24" />
      ))}
    </div>
    {Array.from({ length: 5 }, (_, i) => (
      <div key={i} className="flex space-x-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
)

// Animation and Visual Components
export const LazyDotGrid = ({ children, ...props }: any) => (
  <div className="w-full h-full bg-muted/20 animate-pulse" />
)

export const LazyTiltedCard = ({ children, ...props }: any) => (
  <div className="w-full h-64 bg-muted/20 animate-pulse rounded-lg" />
)

export const LazyPrism = ({ children, ...props }: any) => (
  <div className="w-full h-32 bg-muted/20 animate-pulse rounded-lg" />
)

export const LazyStaggeredMenu = ({ children, ...props }: any) => (
  <div className="space-y-2">
    {Array.from({ length: 4 }, (_, i) => (
      <Skeleton key={i} className="h-10 w-full" />
    ))}
  </div>
)


// Intersection observer based lazy loading
export function IntersectionLazyLoad({
  children,
  fallback,
  rootMargin = '100px',
  threshold = 0.1,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
  rootMargin?: string
  threshold?: number
}) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [ref, setRef] = React.useState<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!ref) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {
        rootMargin,
        threshold,
      }
    )

    observer.observe(ref)

    return () => observer.disconnect()
  }, [ref, rootMargin, threshold])

  return (
    <div ref={setRef}>
      {isVisible ? children : fallback}
    </div>
  )
}