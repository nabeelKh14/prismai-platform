'use client'

import React, { useEffect, useState } from 'react'

// Font loading optimization utilities
export function useFontOptimization() {
  const [fontsLoaded, setFontsLoaded] = useState<Record<string, boolean>>({})
  const [fontError, setFontError] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if fonts are already loaded
    if ('fonts' in document) {
      const fontFace = (document as any).fonts

      // Monitor font loading
      fontFace.ready.then(() => {
        console.log('All fonts loaded successfully')
        setFontsLoaded(prev => ({ ...prev, system: true }))
      })

      // Monitor individual font families
      const fontFamilies = ['Inter', 'Roboto Mono', 'Geist']
      fontFamilies.forEach(family => {
        fontFace.load(`12px "${family}"`).then(() => {
          setFontsLoaded(prev => ({ ...prev, [family]: true }))
        }).catch(() => {
          setFontError(prev => ({ ...prev, [family]: true }))
        })
      })
    }
  }, [])

  return { fontsLoaded, fontError }
}

// Font preloader component
export function FontPreloader({
  fonts,
  timeout = 3000
}: {
  fonts: Array<{ family: string; src: string; weight?: string; style?: string }>
  timeout?: number
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const fontPromises = fonts.map(font => {
      return new Promise<void>((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'font'
        link.type = 'font/woff2'
        link.crossOrigin = 'anonymous'
        link.href = font.src

        // Add weight and style if specified
        if (font.weight) link.setAttribute('data-weight', font.weight)
        if (font.style) link.setAttribute('data-style', font.style)

        link.onload = () => resolve()
        link.onerror = () => reject()

        document.head.appendChild(link)

        // Timeout fallback
        setTimeout(() => resolve(), timeout)
      })
    })

    Promise.all(fontPromises).catch(console.error)
  }, [fonts, timeout])

  return null
}

// Font display swap utility
export function useFontDisplaySwap() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Add CSS for font display swap
    const style = document.createElement('style')
    style.textContent = `
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('/fonts/inter-var.woff2') format('woff2');
      }

      @font-face {
        font-family: 'Roboto Mono';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('/fonts/roboto-mono-var.woff2') format('woff2');
      }

      @font-face {
        font-family: 'Geist';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('/fonts/geist-var.woff2') format('woff2');
      }
    `
    document.head.appendChild(style)
  }, [])
}

// Critical font CSS inliner
export function useCriticalFontCSS() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Add critical font CSS to head
    const criticalFontCSS = `
      /* Critical font styles */
      .font-sans {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }

      .font-mono {
        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      }

      /* Fallback fonts while loading */
      .font-inter {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-optical-sizing: auto;
        font-variation-settings: 'slnt' 0;
      }

      .font-geist {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
    `

    const style = document.createElement('style')
    style.textContent = criticalFontCSS
    document.head.insertBefore(style, document.head.firstChild)
  }, [])
}

// Font loading with fallback
export function FontWithFallback({
  primary,
  fallback,
  children,
  className
}: {
  primary: string
  fallback: string
  children: React.ReactNode
  className?: string
}) {
  const [fontLoaded, setFontLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkFont = async () => {
      try {
        await document.fonts.load(`12px "${primary}"`)
        setFontLoaded(true)
      } catch {
        // Font failed to load, use fallback
        setFontLoaded(false)
      }
    }

    checkFont()
  }, [primary])

  return (
    <span
      className={className}
      style={{
        fontFamily: fontLoaded ? primary : fallback
      }}
    >
      {children}
    </span>
  )
}

// Optimized font loading hook
export function useOptimizedFontLoading() {
  const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const fontPromises = [
      document.fonts.load('400 12px Inter'),
      document.fonts.load('400 12px Roboto Mono'),
      document.fonts.load('400 12px Geist'),
    ]

    Promise.all(fontPromises)
      .then(() => {
        setLoadingState('loaded')
        console.log('All fonts loaded successfully')
      })
      .catch(() => {
        setLoadingState('error')
        console.warn('Some fonts failed to load')
      })
  }, [])

  return loadingState
}

// Font subset optimization
export function useFontSubsetOptimization() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Only load font subsets that are actually used
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check for text content and optimize font loading accordingly
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null
          )

          const characters = new Set<string>()
          let node
          while (node = walker.nextNode()) {
            if (node.textContent) {
              for (const char of node.textContent) {
                characters.add(char)
              }
            }
          }

          // You could implement logic here to load only the required character sets
          console.log('Characters used:', Array.from(characters).length)
        }
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => observer.disconnect()
  }, [])
}

// Variable font optimization
export function useVariableFontOptimization() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Optimize variable font loading
    const style = document.createElement('style')
    style.textContent = `
      /* Variable font optimization */
      .font-inter {
        font-family: 'Inter', system-ui, sans-serif;
        font-variation-settings: 'wght' 400, 'slnt' 0;
        font-optical-sizing: auto;
      }

      .font-geist {
        font-family: 'Geist', system-ui, sans-serif;
        font-variation-settings: 'wght' 400;
      }

      .font-roboto-mono {
        font-family: 'Roboto Mono', 'SF Mono', monospace;
        font-variation-settings: 'wght' 400;
      }
    `
    document.head.appendChild(style)
  }, [])
}

// Font loading performance monitor
export function useFontPerformanceMonitor() {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    fontsLoaded: 0,
    totalFonts: 0,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const startTime = performance.now()

    if ('fonts' in document) {
      const fontFace = (document as any).fonts

      fontFace.ready.then(() => {
        const loadTime = performance.now() - startTime
        setMetrics({
          loadTime,
          fontsLoaded: fontFace.size,
          totalFonts: fontFace.size,
        })
      })
    }
  }, [])

  return metrics
}