'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// Enhanced image component with lazy loading and optimization
export function OptimizedImage({
  src,
  alt,
  className,
  priority = false,
  quality = 75,
  sizes = '100vw',
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  ...props
}: {
  src: string
  alt: string
  className?: string
  priority?: boolean
  quality?: number
  sizes?: string
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onLoad?: () => void
  onError?: () => void
  [key: string]: any
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const imgRef = useRef<HTMLImageElement>(null)

  // Intersection observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [priority, isInView])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  // Generate blur placeholder if not provided
  const defaultBlurDataURL = blurDataURL || generateBlurDataURL(src)

  if (hasError) {
    return (
      <div
        className={cn(
          'bg-muted flex items-center justify-center text-muted-foreground',
          className
        )}
        style={{ aspectRatio: props.width && props.height ? `${props.width}/${props.height}` : '1' }}
      >
        <div className="text-center">
          <div className="text-sm">Failed to load image</div>
          <div className="text-xs opacity-75">{alt}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {isInView && (
        <Image
          ref={imgRef}
          src={src}
          alt={alt}
          quality={quality}
          sizes={sizes}
          placeholder={placeholder}
          blurDataURL={defaultBlurDataURL}
          priority={priority}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          {...props}
        />
      )}

      {/* Loading skeleton */}
      {!isLoaded && isInView && (
        <div
          className={cn(
            'absolute inset-0 bg-muted animate-pulse',
            'flex items-center justify-center'
          )}
        >
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Intersection trigger for lazy loading */}
      {!priority && !isInView && (
        <div
          ref={imgRef}
          className="absolute inset-0 bg-muted/50"
          style={{ aspectRatio: props.width && props.height ? `${props.width}/${props.height}` : '1' }}
        />
      )}
    </div>
  )
}

// Responsive image component
export function ResponsiveImage({
  src,
  alt,
  className,
  breakpoints = [640, 768, 1024, 1280, 1536],
  quality = 75,
  ...props
}: {
  src: string
  alt: string
  className?: string
  breakpoints?: number[]
  quality?: number
  [key: string]: any
}) {
  const sizes = breakpoints.map(bp => `(max-width: ${bp}px) ${bp}px`).join(', ') + ', 100vw'

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      className={className}
      sizes={sizes}
      quality={quality}
      {...props}
    />
  )
}

// Background image component with lazy loading
export function LazyBackgroundImage({
  src,
  alt,
  className,
  children,
  placeholder,
  ...props
}: {
  src: string
  alt: string
  className?: string
  children?: React.ReactNode
  placeholder?: string
  [key: string]: any
}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isInView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [isInView])

  useEffect(() => {
    if (!isInView || isLoaded) return

    const img = new (window as any).Image()
    img.onload = () => setIsLoaded(true)
    img.onerror = () => setIsLoaded(true) // Show placeholder on error
    img.src = src
  }, [isInView, isLoaded, src])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden transition-opacity duration-500',
        isLoaded ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        backgroundImage: isLoaded ? `url(${src})` : placeholder ? `url(${placeholder})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      role="img"
      aria-label={alt}
      {...props}
    >
      {children}
    </div>
  )
}

// Utility function to generate blur data URL
function generateBlurDataURL(src: string): string {
  // Simple base64 encoded 1x1 transparent PNG
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
}

// Image gallery component with lazy loading
export function LazyImageGallery({
  images,
  className,
  imageClassName,
  ...props
}: {
  images: Array<{ src: string; alt: string; [key: string]: any }>
  className?: string
  imageClassName?: string
  [key: string]: any
}) {
  return (
    <div className={cn('grid gap-4', className)}>
      {images.map((image, index) => (
        <OptimizedImage
          key={index}
          {...image}
          className={imageClassName}
          priority={index < 2} // Load first 2 images immediately
          {...props}
        />
      ))}
    </div>
  )
}

// WebP support detection and fallback
export function useWebPSupport() {
  const [supportsWebP, setSupportsWebP] = useState<boolean | null>(null)

  useEffect(() => {
    const checkWebPSupport = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1

      const ctx = canvas.getContext('2d')
      if (!ctx) return false

      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
    }

    checkWebPSupport().then(setSupportsWebP)
  }, [])

  return supportsWebP
}