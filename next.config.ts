// next.config.ts
import type { NextConfig } from 'next'
import withMDX from '@next/mdx'

/** Wrap Next's config with MDX support */
const mdx = withMDX({
  extension: /\.mdx?$/
})

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  
  // Server external packages
  serverExternalPackages: ['@vercel/otel'],
  
  // Production source maps for better debugging
  productionBrowserSourceMaps: true,
  
  // Enhanced logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  
  // Minimal webpack configuration - only essential overrides
  webpack: (config, { isServer }) => {
    // Only add essential fallbacks for client-side builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        os: false,
      };
    }

    // Add path alias for better imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };

    return config;
  },
};

export default mdx(nextConfig)
