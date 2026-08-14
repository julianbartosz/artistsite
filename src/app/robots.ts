import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
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
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}