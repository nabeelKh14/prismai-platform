'use client'

import React, { useEffect } from 'react'

// Critical resource preloading utilities
export function useCriticalResourcePreloading() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Preload critical routes
    const criticalRoutes = [
      '/dashboard',
      '/demo',
      '/features',
      '/pricing',
    ]

    criticalRoutes.forEach(route => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = route
      document.head.appendChild(link)
    })

    // Preload critical resources
    const criticalResources = [
      { href: '/placeholder.jpg', as: 'image' },
      { href: '/placeholder.svg', as: 'image' },
      { href: '/placeholder-user.jpg', as: 'image' },
    ]

    criticalResources.forEach(resource => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = resource.href
      link.as = resource.as
      document.head.appendChild(link)
    })

    // Preconnect to external domains
    const externalDomains = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ]

    externalDomains.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = domain
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    })

    // DNS prefetch for external resources
    const dnsPrefetchDomains = [
      'https://vercel.com',
      'https://supabase.com',
    ]

    dnsPrefetchDomains.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'dns-prefetch'
      link.href = domain
      document.head.appendChild(link)
    })
  }, [])
}

// Resource hint component
export function ResourceHints({
  routes = [],
  resources = [],
  domains = []
}: {
  routes?: string[]
  resources?: Array<{ href: string; as: string; type?: string }>
  domains?: string[]
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Prefetch routes
    routes.forEach(route => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = route
      document.head.appendChild(link)
    })

    // Preload resources
    resources.forEach(resource => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = resource.href
      link.as = resource.as
      if (resource.type) link.type = resource.type
      document.head.appendChild(link)
    })

    // Preconnect to domains
    domains.forEach(domain => {
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = domain
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    })
  }, [routes, resources, domains])

  return null
}

// Critical CSS preloader
export function CriticalCSSPreloader() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Add critical CSS to head for immediate rendering
    const criticalCSS = `
      /* Critical above-the-fold CSS */
      body {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        line-height: 1.6;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
      }

      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
      }

      .skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
      }

      @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      /* Critical layout styles */
      .hero {
        min-height: 80vh;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .card {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        padding: 1.5rem;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: #0070f3;
        color: white;
        border: none;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 500;
        transition: background 0.2s;
      }

      .btn:hover {
        background: #0051cc;
      }

      /* Critical navigation styles */
      nav {
        background: white;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 50;
      }

      nav .container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 4rem;
      }

      /* Critical grid styles */
      .grid {
        display: grid;
        gap: 1rem;
      }

      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

      @media (min-width: 768px) {
        .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      }
    `

    const style = document.createElement('style')
    style.textContent = criticalCSS
    document.head.insertBefore(style, document.head.firstChild)
  }, [])

  return null
}

// Preload manager for dynamic resources
export function usePreloadManager() {
  const preloadResource = React.useCallback((
    href: string,
    as: string,
    options?: { type?: string; crossOrigin?: string }
  ) => {
    if (typeof window === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = href
    link.as = as

    if (options?.type) link.type = options.type
    if (options?.crossOrigin) link.crossOrigin = options.crossOrigin

    document.head.appendChild(link)
  }, [])

  const prefetchRoute = React.useCallback((route: string) => {
    if (typeof window === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = route
    document.head.appendChild(link)
  }, [])

  const preconnect = React.useCallback((href: string, crossOrigin = 'anonymous') => {
    if (typeof window === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = href
    link.crossOrigin = crossOrigin
    document.head.appendChild(link)
  }, [])

  return {
    preloadResource,
    prefetchRoute,
    preconnect,
  }
}

// Intersection observer based preloading
export function useIntersectionPreloading() {
  const [preloadedResources, setPreloadedResources] = React.useState<Set<string>>(new Set())

  const preloadOnIntersection = React.useCallback((
    elementRef: React.RefObject<Element>,
    resources: Array<{ href: string; as: string; type?: string }>
  ) => {
    if (typeof window === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !preloadedResources.has(entry.target.id)) {
            resources.forEach(resource => {
              const link = document.createElement('link')
              link.rel = 'preload'
              link.href = resource.href
              link.as = resource.as
              if (resource.type) link.type = resource.type
              document.head.appendChild(link)
            })

            setPreloadedResources(prev => new Set([...prev, entry.target.id]))
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => observer.disconnect()
  }, [preloadedResources])

  return { preloadOnIntersection }
}

// Smart preloading based on user behavior
export function useSmartPreloading() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let hoverTimeout: NodeJS.Timeout

    const handleMouseEnter = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      // Preload on hover for links
      if (target.tagName === 'A' && (target as HTMLAnchorElement).href) {
        hoverTimeout = setTimeout(() => {
          const link = document.createElement('link')
          link.rel = 'prefetch'
          link.href = (target as HTMLAnchorElement).href
          document.head.appendChild(link)
        }, 100)
      }
    }

    const handleMouseLeave = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
    }

    // Add event listeners for smart preloading
    document.addEventListener('mouseenter', handleMouseEnter, true)
    document.addEventListener('mouseleave', handleMouseLeave, true)

    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true)
      document.removeEventListener('mouseleave', handleMouseLeave, true)
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
    }
  }, [])
}

// Resource priority manager
export function useResourcePriority() {
  const setResourcePriority = React.useCallback((
    href: string,
    priority: 'high' | 'low'
  ) => {
    if (typeof window === 'undefined') return

    const link = document.querySelector(`link[href="${href}"]`) as HTMLLinkElement

    if (link) {
      if (priority === 'high') {
        link.setAttribute('fetchpriority', 'high')
      } else {
        link.setAttribute('fetchpriority', 'low')
      }
    }
  }, [])

  return { setResourcePriority }
}