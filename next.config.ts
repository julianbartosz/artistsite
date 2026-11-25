// next.config.ts
import type { NextConfig } from 'next'
import withMDX from '@next/mdx'
import path from 'path'

/** Wrap Next's config with MDX support */
const mdx = withMDX({
  extension: /\.mdx?$/
})

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
  {
    protocol: 'https',
    hostname: '*.blob.core.windows.net',
  },
];

if (process.env.AZURE_STORAGE_PUBLIC_BASE_URL) {
  try {
    const parsed = new URL(process.env.AZURE_STORAGE_PUBLIC_BASE_URL);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      remotePatterns.push({
        protocol: parsed.protocol === 'http:' ? 'http' : 'https',
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
      });
    }
  } catch {
    // Ignore invalid AZURE_STORAGE_PUBLIC_BASE_URL during config load.
  }
}

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],

  // Dev server defaults to localhost; allow 127.0.0.1 so auth cookies and /_next/* chunks load.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  
  // Enable standalone output for Docker deployment
  output: 'standalone',

  // Generated brand images read these fonts from disk at runtime.
  outputFileTracingIncludes: {
    '/api/og': ['./src/app/fonts/og/**'],
    '/api/brand/icon': ['./src/app/fonts/og/**'],
    '/brand/icon': ['./src/app/fonts/og/**'],
    '/favicon.ico': ['./src/app/fonts/og/**'],
  },
  
  // Server external packages
  serverExternalPackages: ['@vercel/otel', 'web-vitals'],
  
  // Production source maps for better debugging
  productionBrowserSourceMaps: true,

  // CI runs lint as a separate quality gate; keep build focused on compilation/output.
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Enhanced logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  
  // Performance optimization
  experimental: {
    // Allow studio image (<=25 MB) and video (<=80 MB) uploads to pass through middleware without 10 MB truncation.
    middlewareClientMaxBodySize: '85mb',
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

  async rewrites() {
    return [
      { source: '/updates', destination: '/blog' },
      { source: '/updates/tag/:tag', destination: '/blog/tag/:tag' },
      { source: '/updates/:slug', destination: '/blog/:slug' },
    ];
  },

  // Config headers override route-handler headers, so API caching stays per-route and
  // /_next/static keeps Next's own policy (hashed + immutable in prod, no-store in dev).
  // /images files are replaced in place, so they must revalidate; /uploads files are content-hashed.
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Image optimization (WebP avoids slow CPU-bound AVIF encoding on single-vCPU hosting)
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    remotePatterns,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Fixed webpack configuration to handle client-side libraries properly
  webpack: (config, { isServer, dev }) => {
    // Add path alias for better imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };

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

    // Fix for "self is not defined" error during server-side builds
    if (isServer) {
      // Define globals that are expected by client-side libraries
      config.plugins = config.plugins || [];
      const { DefinePlugin } = require('webpack');
      config.plugins.push(
        new DefinePlugin({
          'typeof window': JSON.stringify('undefined'),
          'typeof document': JSON.stringify('undefined'),
          'typeof self': JSON.stringify('undefined'),
        })
      );
      
      // Externalize client-side only packages during server builds
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('web-vitals');
      }
    }

    // Performance optimizations for production browser bundles only.
    if (!dev && !isServer) {
      // Enable proper code splitting
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
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
              test: /[\\/]node_modules[\\/](@mdx-js|remark|rehype)[\\/]/,
              name: 'markdown',
              priority: 10,
              chunks: 'async',
            },
            analytics: {
              test: /[\\/]node_modules[\\/](web-vitals|ga4)[\\/]/,
              name: 'analytics',
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
