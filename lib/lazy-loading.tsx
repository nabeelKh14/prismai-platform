// Enhanced lazy loading utilities for route-based code splitting
import React, { Suspense, lazy, ComponentType } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Enhanced loading component with better UX
export function RouteLoadingFallback({ 
  className, 
  showProgress = true 
}: {
  className?: string
  showProgress?: boolean
}) {
  return (
    <div className={cn('min-h-screen flex items-center justify-center', className)}>
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
        {showProgress && (
          <div className="text-sm text-muted-foreground">
            Loading amazing content...
          </div>
        )}
      </div>
    </div>
  )
}

// Error boundary for lazy-loaded components
export class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy load error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-red-500 text-lg">Failed to load component</div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Enhanced lazy component creator with retry logic
export function createLazyRoute<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    loading?: React.ComponentType
    error?: React.ReactNode
    retries?: number
  } = {}
) {
  const { retries = 3 } = options
  let attempts = 0

  const LazyComponent = lazy(() => {
    return importFn().catch((error: Error) => {
      attempts++
      if (attempts < retries) {
        // Retry after a delay
        return new Promise<{ default: T }>((resolve, reject) => {
          setTimeout(() => {
            importFn().then(resolve).catch(reject)
          }, 1000 * attempts)
        })
      }
      throw error
    })
  })

  return function LazyRouteWrapper(props: React.ComponentProps<T>) {
    const LoadingComponent = options.loading || RouteLoadingFallback

    return (
      <LazyLoadErrorBoundary fallback={options.error}>
        <Suspense fallback={<LoadingComponent />}>
          <LazyComponent {...props} />
        </Suspense>
      </LazyLoadErrorBoundary>
    )
  }
}

// Preload utilities for critical routes
export function preloadRoute(importFn: () => Promise<any>) {
  if (typeof window !== 'undefined') {
    importFn()
  }
}

// Route-specific loading components
export const HomePageLoading = () => (
  <div className="min-h-screen bg-[#0B0B0D]">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center space-y-8">
        <Skeleton className="h-16 w-96 mx-auto" />
        <Skeleton className="h-6 w-80 mx-auto" />
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

export const DashboardLoading = () => (
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
            {Array.from({ length: 5 }, (_, j) => (
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
)