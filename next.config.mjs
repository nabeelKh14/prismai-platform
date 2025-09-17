/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output configuration for Vercel deployment
  output: 'standalone',

  // Build optimizations
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Image optimizations
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
    ],
  },

  // Server external packages
  serverExternalPackages: ['@supabase/supabase-js'],
  
  // Compression
  compress: true,
  
  // Security headers with EvalError prevention
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // EvalError prevention: Strict CSP for production
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'production'
              ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;"
              : "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;"
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  
  // Redirects for SEO
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/analytics',
        permanent: false,
      },
    ]
  },
  
  // Production-safe webpack configuration
  webpack: (config, { dev, isServer }) => {
    // EvalError prevention: Use safer devtool in production
    if (!dev && !isServer) {
      config.devtool = 'source-map' // Safer than eval-source-map
    }

    // Bundle analyzer (enable with ANALYZE=true)
    if (process.env.ANALYZE === 'true') {
      config.plugins.push(
        new (require('@next/bundle-analyzer'))({ enabled: true })
      )
    }

    return config
  },
}

export default nextConfig
