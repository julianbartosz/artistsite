import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/config';
import { absoluteUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getSiteUrl();
  const isProduction = process.env.NODE_ENV === 'production' && !baseUrl.includes('staging');

  if (!isProduction) {
    // Block all crawlers on staging/development
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  // Production robots.txt
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/auth/',
          '/checkout/',
          '/account/',
          '/_next/',
          '/debug/',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml', baseUrl),
    host: baseUrl,
  };
}