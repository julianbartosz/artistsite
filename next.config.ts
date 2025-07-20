// next.config.ts
import type { NextConfig } from 'next'
import withMDX from '@next/mdx'
import path from 'path'

/** Wrap Next's config with MDX support */
const mdx = withMDX({
  extension: /\.mdx?$/
})

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
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
  
  // Performance optimization
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      '@mdx-js/react', 
      'lucide-react',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'react-markdown',
      'rehype-highlight',
      'remark-gfm'
    ],
  },

  // Enhanced caching and ISR
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Minimal webpack configuration - only essential overrides
  webpack: (config, { isServer, dev }) => {
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
      '@': path.resolve(__dirname, 'src'),
    };

    // Performance optimizations for production
    if (!dev) {
      // Enable gzip compression
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: -10,
              chunks: 'all',
            },
            // Separate chunk for large libraries
            editor: {
              test: /[\\/]node_modules[\\/](@tiptap|@tinymce)[\\/]/,
              name: 'editor',
              priority: 10,
              chunks: 'async',
            },
            markdown: {
              test: /[\\/]node_modules[\\/](mdx-bundler|@mdx-js|remark|rehype)[\\/]/,
              name: 'markdown',
              priority: 10,
              chunks: 'async',
            },
          },
        },
      };
    }

    return config;
  },
};

export default mdx(nextConfig)
