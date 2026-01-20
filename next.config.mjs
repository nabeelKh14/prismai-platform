/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add fallbacks for Node.js modules used by swagger-ui-react
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'formdata-node': false,
      'btoa': false,
      'traverse': false,
    };
    return config;
  },
};

export default nextConfig;