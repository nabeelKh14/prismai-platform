'use client'

import React, { useEffect } from 'react'

// CSS optimization utilities
export function optimizeCSS() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Remove unused CSS rules
    const styleSheets = Array.from(document.styleSheets)
    styleSheets.forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || [])
        rules.forEach((rule, index) => {
          // Remove rules that are not used
          if ((rule as any).selectorText && !document.querySelector((rule as any).selectorText)) {
            // This is a simplified approach - in production you'd want more sophisticated detection
            // sheet.deleteRule(index)
          }
        })
      } catch (e) {
        // Cross-origin stylesheets can't be accessed
        console.debug('Cannot optimize cross-origin stylesheet')
      }
    })
  }, [])
}

// Critical CSS inliner
export function useCriticalCSS() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Add critical CSS to head for faster rendering
    const criticalCSS = `
      /* Critical above-the-fold styles */
      body { font-family: system-ui, sans-serif; margin: 0; }
      .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
      .loading { display: flex; align-items: center; justify-content: center; min-height: 200px; }
      .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; }
      @keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    `

    const style = document.createElement('style')
    style.textContent = criticalCSS
    document.head.insertBefore(style, document.head.firstChild)
  }, [])
}

// CSS lazy loading
export function lazyLoadCSS(href: string, media = 'all') {
  if (typeof window === 'undefined') return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.media = media
  link.onload = () => {
    link.media = 'all'
  }

  document.head.appendChild(link)
}

// CSS compression utility
export function compressCSS(css: string): string {
  return css
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
    .replace(/\s*{\s*/g, '{') // Remove whitespace around braces
    .replace(/;\s*/g, ';') // Remove whitespace after semicolons
    .replace(/:\s*/g, ':') // Remove whitespace after colons
    .trim()
}

// CSS purging utility (simplified version)
export function purgeCSS(css: string, usedSelectors: string[]): string {
  const selectorRegex = /([^{]+)\s*{[^}]*}/g
  const purgedRules: string[] = []

  let match
  while ((match = selectorRegex.exec(css)) !== null) {
    const selector = match[1].trim()
    const rule = match[0]

    // Check if selector is used or is a pseudo-selector
    const isUsed = usedSelectors.some(usedSelector =>
      selector.includes(usedSelector) ||
      selector.includes(':') ||
      selector.includes('::') ||
      selector.includes('@media')
    )

    if (isUsed) {
      purgedRules.push(rule)
    }
  }

  return purgedRules.join('\n')
}

// CSS optimization hook
export function useCSSOptimization() {
  useEffect(() => {
    // Optimize existing stylesheets
    const styleSheets = Array.from(document.styleSheets)

    styleSheets.forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || [])
        rules.forEach((rule) => {
          // Add CSS optimization logic here
          if (rule instanceof CSSStyleRule) {
            // Optimize individual rules
            optimizeRule(rule)
          }
        })
      } catch (e) {
        // Skip cross-origin stylesheets
      }
    })
  }, [])
}

function optimizeRule(rule: CSSStyleRule) {
  // Remove redundant properties
  const properties = rule.style
  const toRemove: string[] = []

  // Check for redundant properties
  if (properties.margin && properties.margin === properties.marginTop && properties.margin === properties.marginRight && properties.margin === properties.marginBottom && properties.margin === properties.marginLeft) {
    toRemove.push('marginTop', 'marginRight', 'marginBottom', 'marginLeft')
  }

  // Remove redundant properties
  toRemove.forEach(prop => {
    properties.removeProperty(prop)
  })
}

// CSS loading performance monitor
export function useCSSPerformanceMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.name.endsWith('.css')) {
          console.log('CSS loaded:', entry.name, `${entry.duration}ms`)
        }
      })
    })

    observer.observe({ entryTypes: ['resource'] })

    return () => observer.disconnect()
  }, [])
}

// Dynamic CSS theme switching with optimization
export function useOptimizedTheme(theme: 'light' | 'dark' | 'auto' = 'auto') {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement

    // Remove existing theme classes
    root.classList.remove('light', 'dark')

    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark' : 'light')
    } else {
      root.classList.add(theme)
    }
  }, [theme])
}

// CSS-in-JS optimization
export function optimizeCSSInJS(styles: Record<string, any>): Record<string, any> {
  const optimized: Record<string, any> = {}

  Object.entries(styles).forEach(([key, value]) => {
    // Remove undefined/null values
    if (value == null) return

    // Remove empty objects
    if (typeof value === 'object' && Object.keys(value).length === 0) return

    // Remove redundant properties
    if (key === 'marginTop' && styles.margin && styles.margin === value) return
    if (key === 'marginRight' && styles.margin && styles.margin === value) return
    if (key === 'marginBottom' && styles.margin && styles.margin === value) return
    if (key === 'marginLeft' && styles.margin && styles.margin === value) return

    optimized[key] = value
  })

  return optimized
}