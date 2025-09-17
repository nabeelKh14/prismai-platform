import { NextRequest, NextResponse } from 'next/server'

export interface VersionInfo {
  version: string
  deprecated: boolean
  deprecationDate?: Date
  sunsetDate?: Date
  replacementVersion?: string
}

const API_VERSIONS: Record<string, VersionInfo> = {
  'v1': {
    version: 'v1',
    deprecated: false,
  },
  'v2': {
    version: 'v2',
    deprecated: true,
    deprecationDate: new Date('2024-12-01'),
    sunsetDate: new Date('2025-06-01'),
    replacementVersion: 'v3',
  },
  'v3': {
    version: 'v3',
    deprecated: false,
  },
}

export class ApiVersioning {
  /**
   * Extract API version from request URL
   */
  static extractVersion(request: NextRequest): string {
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)

    // Check if path starts with version prefix (e.g., /v1/, /v2/, /v3/)
    if (pathSegments.length > 0 && pathSegments[0].startsWith('v') && /^\d+$/.test(pathSegments[0].substring(1))) {
      return pathSegments[0]
    }

    // Default to v1 for backward compatibility
    return 'v1'
  }

  /**
   * Get version information
   */
  static getVersionInfo(version: string): VersionInfo | null {
    return API_VERSIONS[version] || null
  }

  /**
   * Check if version is deprecated and add deprecation headers
   */
  static addDeprecationHeaders(response: NextResponse, version: string): NextResponse {
    const versionInfo = this.getVersionInfo(version)

    if (versionInfo?.deprecated) {
      response.headers.set('X-API-Deprecated', 'true')
      response.headers.set('X-API-Deprecation-Date', versionInfo.deprecationDate?.toISOString() || '')
      response.headers.set('X-API-Sunset-Date', versionInfo.sunsetDate?.toISOString() || '')

      if (versionInfo.replacementVersion) {
        response.headers.set('X-API-Replacement-Version', versionInfo.replacementVersion)
      }

      // Add deprecation warning to response body if it's JSON
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        // Note: In a real implementation, you'd modify the response body
        // For now, we just add headers
      }
    }

    // Always add current version info
    response.headers.set('X-API-Version', version)
    response.headers.set('X-API-Versions-Available', Object.keys(API_VERSIONS).join(', '))

    return response
  }

  /**
   * Create versioned response with deprecation notices
   */
  static createVersionedResponse(data: any, version: string, status = 200): NextResponse {
    const response = NextResponse.json(data, { status })
    return this.addDeprecationHeaders(response, version)
  }

  /**
   * Middleware to handle API versioning
   */
  static middleware(request: NextRequest): NextResponse | null {
    const version = this.extractVersion(request)
    const versionInfo = this.getVersionInfo(version)

    // If version doesn't exist, return 404
    if (!versionInfo) {
      return NextResponse.json(
        {
          error: 'API version not found',
          message: `Version '${version}' is not supported. Available versions: ${Object.keys(API_VERSIONS).join(', ')}`,
          availableVersions: Object.keys(API_VERSIONS)
        },
        { status: 404 }
      )
    }

    // If version is deprecated, log warning
    if (versionInfo.deprecated) {
      console.warn(`Deprecated API version used: ${version}`, {
        replacement: versionInfo.replacementVersion,
        sunsetDate: versionInfo.sunsetDate,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      })
    }

    // Continue with request - version info will be added to response
    return null
  }
}