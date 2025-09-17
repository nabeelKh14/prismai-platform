'use client'

import React, { Suspense, lazy } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

// Generic lazy component creator with error boundary
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    loading?: React.ComponentType
    ssr?: boolean
  } = {}
) {
  const LazyComponent = lazy(importFn)
  
  return function WrappedComponent(props: React.ComponentProps<T>) {
    const LoadingComponent = options.loading || (() => <Skeleton className="h-32 w-full" />)
    
    return (
      <Suspense fallback={<LoadingComponent />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

// Lazy-loaded components for better performance
export const LazyVAPISetup = createLazyComponent(
  () => import('@/components/dashboard/vapi-setup'),
  {
    ssr: false, // Client-side only for WebRTC functionality
    loading: () => (
      <div className="w-full max-w-2xl mx-auto">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    ),
  }
)

export const LazyDashboard = createLazyComponent(
  () => import('@/app/dashboard/page'),
  {
    loading: () => (
      <div className="min-h-screen bg-background p-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </div>
              <Skeleton className="h-8 w-16 mt-2" />
              <Skeleton className="h-3 w-20 mt-1" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-8">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6">
              <div className="mb-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, j) => (
                  <div key={j} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  }
)

// Analytics charts that are heavy and should be lazy-loaded
export const LazyAnalyticsCharts = createLazyComponent(
  () => import('@/components/dashboard/analytics-charts'),
  {
    ssr: false, // Charts often have client-side dependencies
    loading: () => (
      <div className="grid gap-6">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <div className="mb-4">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ))}
      </div>
    ),
  }
)

// Reusable loading component
export function LoadingFallback({ 
  className, 
  lines = 3,
  showAvatar = false 
}: {
  className?: string
  lines?: number
  showAvatar?: boolean
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {showAvatar && (
        <div className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      )}
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full'
          )} 
        />
      ))}
    </div>
  )
}

// Suspense wrapper with error boundary
export function SuspenseWrapper({ 
  children, 
  fallback, 
  className 
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Suspense fallback={fallback || <LoadingFallback />}>
        {children}
      </Suspense>
    </div>
  )
}

// Image optimization helper
export function OptimizedImage({
  src,
  alt,
  className,
  priority = false,
  ...props
}: {
  src: string
  alt: string
  className?: string
  priority?: boolean
  [key: string]: any
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...props}
    />
  )
}

// Progressive enhancement wrapper
export function ProgressiveEnhancement({
  children,
  fallback,
  condition = () => typeof window !== 'undefined'
}: {
  children: React.ReactNode
  fallback: React.ReactNode
  condition?: () => boolean
}) {
  if (!condition()) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}