import type { MetadataRoute } from 'next';
import { PAGE_TONES, getPublishedSiteContent } from '@/lib/site-content';
import { brandIconPath } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const identity = await getPublishedSiteContent('identity');
  const { theme } = identity;
  return {
    name: identity.siteName,
    short_name: identity.headerName.trim() || identity.siteName,
    description: identity.tagline || undefined,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    lang: 'en',
    background_color: PAGE_TONES[theme.pageTone].page,
    theme_color: theme.primaryColor,
    icons: [
      { src: brandIconPath(identity, 192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: brandIconPath(identity, 512), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: brandIconPath(identity, 512), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    categories: ['art', 'shopping'],
  };
}
