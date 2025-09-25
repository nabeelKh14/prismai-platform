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
    // Enable image optimization features
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Optimize loading
    minimumCacheTTL: 60,
    // Enable modern formats
    loader: 'default',
    path: '/_next/image',
  },
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
      'recharts',
      'date-fns',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
    // Enable modern bundling features
    optimizeCss: true,
    scrollRestoration: true,
    // Enable modern JavaScript features
    esmExternals: true,
  },

  // Server external packages
  serverExternalPackages: ['@supabase/supabase-js', 'redis'],
  
  // Compression
  compress: true,

  // Enable modern output format
  poweredByHeader: false,

  // Optimize for production
  productionBrowserSourceMaps: false,

  // Enable React strict mode for better performance
  reactStrictMode: true,

  // Optimize build performance
  onDemandEntries: {
    // Keep pages in memory for 15 minutes
    maxInactiveAge: 15 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  
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
  webpack: (config, { dev, isServer, webpack }) => {
    // EvalError prevention: Use safer devtool in production
    if (!dev && !isServer) {
      config.devtool = 'source-map' // Safer than eval-source-map
    }

    // Exclude server-only packages from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      }

      // Add polyfill for 'self' global
      config.plugins.push(
        new webpack.DefinePlugin({
          'global.self': 'global',
          'self': 'global',
        })
      )
    }

    // Bundle analyzer (enable with ANALYZE=true)
    if (process.env.ANALYZE === 'true') {
      // Dynamic import for webpack-bundle-analyzer
      import('webpack-bundle-analyzer').then(({ default: BundleAnalyzerPlugin }) => {
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'server',
            analyzerPort: 8888,
            openAnalyzer: true,
          })
        )
      })
    }

    // Performance optimizations
    if (!dev) {
      // Enable code splitting optimizations
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Vendor chunk for node_modules
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            // React and related libraries
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 20,
            },
            // UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|recharts)[\\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 15,
            },
            // Large utility libraries
            utils: {
              test: /[\\/]node_modules[\\/](date-fns|clsx|tailwind-merge)[\\/]/,
              name: 'utils',
              chunks: 'all',
              priority: 12,
            },
          },
        },
        // Enable module concatenation
        concatenateModules: true,
        // Enable tree shaking
        usedExports: true,
        // Enable side effects optimization
        sideEffects: true,
        // Minimize bundle size
        minimize: true,
        minimizer: [
          ...(config.optimization.minimizer || []),
          new webpack.optimize.ModuleConcatenationPlugin(),
        ],
      }

      // CSS optimization will be handled by Next.js built-in optimizers
    }

    return config
  },
}

export default nextConfig
