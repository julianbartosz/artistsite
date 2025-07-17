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
}

export default mdx(nextConfig)
