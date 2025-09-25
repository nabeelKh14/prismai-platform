'use client'

import { useEffect, useState } from 'react'

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
  })

  useEffect(() => {
    const startTime = performance.now()

    // Measure component load time
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.name.includes(componentName)) {
          setMetrics(prev => ({
            ...prev,
            loadTime: entry.duration,
          }))
        }
      })
    })

    observer.observe({ entryTypes: ['measure', 'navigation'] })

    // Measure render time
    const renderEndTime = performance.now()
    setMetrics(prev => ({
      ...prev,
      renderTime: renderEndTime - startTime,
    }))

    // Measure memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory
      setMetrics(prev => ({
        ...prev,
        memoryUsage: memory.usedJSHeapSize,
      }))
    }

    return () => observer.disconnect()
  }, [componentName])

  return metrics
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting
        setIsIntersecting(isElementIntersecting)

        if (isElementIntersecting && !hasIntersected) {
          setHasIntersected(true)
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [ref, options, hasIntersected])

  return { isIntersecting, hasIntersected }
}

// Preload utilities
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = reject
    img.src = src
  })
}

export function preloadRoute(route: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = route
    document.head.appendChild(link)
  }
}

// Resource hints
export function addResourceHints() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Add DNS prefetch for external resources
    const dnsPrefetchLinks = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ]

    dnsPrefetchLinks.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'dns-prefetch'
      link.href = domain
      document.head.appendChild(link)
    })

    // Add preconnect for critical resources
    const preconnectLinks = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ]

    preconnectLinks.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = domain
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    })
  }, [])
}

// Critical resource preloader
export function useCriticalResourcePreloader() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Preload critical routes
    const criticalRoutes = [
      '/dashboard',
      '/demo',
      '/features',
    ]

    criticalRoutes.forEach(route => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = route
      document.head.appendChild(link)
    })

    // Preload critical images
    const criticalImages = [
      '/placeholder.jpg',
      '/placeholder-user.jpg',
      '/placeholder.svg',
    ]

    criticalImages.forEach(src => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = src
      document.head.appendChild(link)
    })
  }, [])
}

// Performance budget checker
export function usePerformanceBudget() {
  const [budgetExceeded, setBudgetExceeded] = useState(false)
  const [budgetMetrics, setBudgetMetrics] = useState({
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    firstInputDelay: 0,
    cumulativeLayoutShift: 0,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()

      entries.forEach((entry) => {
        switch (entry.entryType) {
          case 'paint':
            if (entry.name === 'first-contentful-paint') {
              setBudgetMetrics(prev => ({
                ...prev,
                firstContentfulPaint: entry.startTime,
              }))
            }
            break
          case 'largest-contentful-paint':
            setBudgetMetrics(prev => ({
              ...prev,
              largestContentfulPaint: entry.startTime,
            }))
            break
          case 'first-input':
            setBudgetMetrics(prev => ({
              ...prev,
              firstInputDelay: (entry as any).processingStart - entry.startTime,
            }))
            break
          case 'layout-shift':
            if (!(entry as any).hadRecentInput) {
              setBudgetMetrics(prev => ({
                ...prev,
                cumulativeLayoutShift: prev.cumulativeLayoutShift + (entry as any).value,
              }))
            }
            break
        }
      })

      // Check if performance budget is exceeded
      const budget = {
        firstContentfulPaint: 1800, // 1.8s
        largestContentfulPaint: 2500, // 2.5s
        firstInputDelay: 100, // 100ms
        cumulativeLayoutShift: 0.1, // 0.1
      }

      const exceeded = Object.entries(budgetMetrics).some(([key, value]) => {
        const budgetValue = budget[key as keyof typeof budget]
        return value > budgetValue
      })

      setBudgetExceeded(exceeded)
    })

    observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] })

    return () => observer.disconnect()
  }, [budgetMetrics])

  return { budgetExceeded, budgetMetrics }
}