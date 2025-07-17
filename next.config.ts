// next.config.ts
import type { NextConfig } from 'next'
import withMDX from '@next/mdx'

/** Wrap Next’s config with MDX support */
const mdx = withMDX<NextConfig>({
  extension: /\.mdx?$/
})

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  // any other Next.js options (env, i18n, rewrites…)
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // Enhanced fallback configuration for client-side builds
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        assert: false,
        http: false,
        https: false,
        url: false,
        zlib: false,
        perf_hooks: false,
        util: false,
        buffer: false,
        events: false,
        process: false,
        module: false,
        net: false,
        tls: false,
        child_process: false,
        worker_threads: false,
        cluster: false,
        dgram: false,
        dns: false,
        readline: false,
        repl: false,
        tty: false,
        v8: false,
        vm: false,
        constants: false,
        timers: false,
      };

      // Add plugin to ignore Node.js modules
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(perf_hooks|fs|path|os|crypto|stream|assert|http|https|url|zlib|util|buffer|events|process|module)$/,
        })
      );
    }
    return config;
  },
};

export default mdx(nextConfig)
