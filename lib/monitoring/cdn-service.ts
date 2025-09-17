import { logger } from '@/lib/logger'
import { performanceMonitor } from './performance-monitor'

export interface CDNConfig {
  provider: 'cloudflare' | 'aws' | 'vercel' | 'custom'
  domain: string
  apiKey?: string
  apiToken?: string
  zoneId?: string
  distributionId?: string
  accessKeyId?: string
  secretAccessKey?: string
  region?: string
}

export interface AssetOptimization {
  compress?: boolean
  minify?: boolean
  webpConversion?: boolean
  lazyLoading?: boolean
  preloadCritical?: boolean
}

export interface CDNMetrics {
  requests: number
  bytesTransferred: number
  cacheHitRate: number
  responseTime: number
  errorRate: number
}

export class CDNService {
  private static instance: CDNService
  private config: CDNConfig | null = null
  private metrics: CDNMetrics = {
    requests: 0,
    bytesTransferred: 0,
    cacheHitRate: 0,
    responseTime: 0,
    errorRate: 0
  }

  static getInstance(): CDNService {
    if (!CDNService.instance) {
      CDNService.instance = new CDNService()
    }
    return CDNService.instance
  }

  /**
   * Configure CDN service
   */
  configure(config: CDNConfig): void {
    this.config = config
    logger.info('CDN service configured', { provider: config.provider, domain: config.domain })
  }

  /**
   * Get optimized asset URL
   */
  getAssetUrl(assetPath: string, options?: AssetOptimization): string {
    if (!this.config) {
      logger.warn('CDN not configured, returning original path')
      return assetPath
    }

    const baseUrl = `https://${this.config.domain}`
    let optimizedPath = assetPath

    // Apply optimizations
    if (options?.compress) {
      optimizedPath = this.addCompressionParams(optimizedPath)
    }

    if (options?.webpConversion && this.isImage(assetPath)) {
      optimizedPath = this.convertToWebP(optimizedPath)
    }

    if (options?.minify && this.isMinifiable(assetPath)) {
      optimizedPath = this.addMinificationParams(optimizedPath)
    }

    return `${baseUrl}${optimizedPath}`
  }

  /**
   * Preload critical assets
   */
  generatePreloadTags(assetPaths: string[]): string {
    if (!this.config) return ''

    const preloadTags = assetPaths.map(path => {
      const url = this.getAssetUrl(path)
      const as = this.getAssetType(path)

      return `<link rel="preload" href="${url}" as="${as}" crossorigin>`
    })

    return preloadTags.join('\n')
  }

  /**
   * Generate lazy loading script for images
   */
  generateLazyLoadingScript(): string {
    return `
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          const lazyImages = document.querySelectorAll('img[data-src]');

          const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
              }
            });
          });

          lazyImages.forEach(img => imageObserver.observe(img));
        });
      </script>
    `
  }

  /**
   * Purge CDN cache for specific assets
   */
  async purgeCache(assetPaths: string[]): Promise<boolean> {
    if (!this.config) {
      logger.warn('CDN not configured, cannot purge cache')
      return false
    }

    try {
      switch (this.config.provider) {
        case 'cloudflare':
          return await this.purgeCloudflareCache(assetPaths)
        case 'aws':
          return await this.purgeAWSCloudFrontCache(assetPaths)
        case 'vercel':
          return await this.purgeVercelCache(assetPaths)
        default:
          logger.warn('Cache purging not implemented for provider', { provider: this.config.provider })
          return false
      }
    } catch (error) {
      logger.error('Failed to purge CDN cache', { error, assetPaths })
      return false
    }
  }

  /**
   * Get CDN analytics
   */
  async getAnalytics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<CDNMetrics> {
    if (!this.config) {
      return this.metrics
    }

    try {
      switch (this.config.provider) {
        case 'cloudflare':
          return await this.getCloudflareAnalytics(timeRange)
        case 'aws':
          return await this.getAWSCloudFrontAnalytics(timeRange)
        default:
          return this.metrics
      }
    } catch (error) {
      logger.error('Failed to get CDN analytics', { error })
      return this.metrics
    }
  }

  /**
   * Record CDN performance metrics
   */
  async recordMetrics(requests: number, bytesTransferred: number, responseTime: number, cacheHit: boolean): Promise<void> {
    this.metrics.requests += requests
    this.metrics.bytesTransferred += bytesTransferred
    this.metrics.responseTime = (this.metrics.responseTime + responseTime) / 2 // Rolling average

    if (cacheHit) {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * 0.9) + 0.1 // Rolling hit rate
    } else {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * 0.9) // Rolling hit rate
    }

    const timestamp = new Date().toISOString()

    // Record network latency
    await performanceMonitor.recordNetworkLatency(responseTime, 'cdn_response', timestamp)

    // Record throughput
    await performanceMonitor.recordThroughputMetric(requests, timestamp, 'cdn')
  }

  /**
   * Optimize images for web delivery
   */
  optimizeImage(imagePath: string): string {
    if (!this.config) return imagePath

    let optimizedUrl = this.getAssetUrl(imagePath, {
      compress: true,
      webpConversion: true,
      lazyLoading: true
    })

    // Add responsive image parameters
    optimizedUrl += '?w=auto&fit=crop&auto=format'

    return optimizedUrl
  }

  /**
   * Generate responsive image srcset
   */
  generateResponsiveImageSrcset(imagePath: string, sizes: number[]): string {
    if (!this.config) return ''

    const srcset = sizes.map(size => {
      const url = this.getAssetUrl(imagePath, { compress: true, webpConversion: true })
      return `${url}?w=${size}&fit=crop&auto=format ${size}w`
    })

    return srcset.join(', ')
  }

  // Private helper methods

  private addCompressionParams(path: string): string {
    return `${path}?compress=true`
  }

  private convertToWebP(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png'].includes(ext || '')) {
      return path.replace(/\.[^.]+$/, '.webp')
    }
    return path
  }

  private addMinificationParams(path: string): string {
    return `${path}?minify=true`
  }

  private isImage(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')
  }

  private isMinifiable(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase()
    return ['js', 'css', 'html'].includes(ext || '')
  }

  private getAssetType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()

    switch (ext) {
      case 'js':
        return 'script'
      case 'css':
        return 'style'
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return 'image'
      case 'woff':
      case 'woff2':
        return 'font'
      default:
        return 'fetch'
    }
  }

  private async purgeCloudflareCache(assetPaths: string[]): Promise<boolean> {
    if (!this.config?.apiToken || !this.config?.zoneId) {
      throw new Error('Cloudflare API token and zone ID required')
    }

    const urls = assetPaths.map(path => `https://${this.config!.domain}${path}`)

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files: urls })
    })

    return response.ok
  }

  private async purgeAWSCloudFrontCache(assetPaths: string[]): Promise<boolean> {
    // AWS CloudFront cache purging implementation
    logger.info('AWS CloudFront cache purge not implemented yet', { assetPaths })
    return false
  }

  private async purgeVercelCache(assetPaths: string[]): Promise<boolean> {
    // Vercel cache purging implementation
    logger.info('Vercel cache purge not implemented yet', { assetPaths })
    return false
  }

  private async getCloudflareAnalytics(timeRange: string): Promise<CDNMetrics> {
    // Cloudflare analytics implementation
    return this.metrics
  }

  private async getAWSCloudFrontAnalytics(timeRange: string): Promise<CDNMetrics> {
    // AWS CloudFront analytics implementation
    return this.metrics
  }

  /**
   * Get current CDN configuration
   */
  getConfig(): CDNConfig | null {
    return this.config
  }

  /**
   * Check if CDN is properly configured
   */
  isConfigured(): boolean {
    return this.config !== null
  }
}

// Export singleton instance
export const cdnService = CDNService.getInstance()