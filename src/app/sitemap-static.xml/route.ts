import { NextResponse } from 'next/server';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';

export async function GET() {
  const staticPages = [
    { url: baseUrl, priority: '1.0', changefreq: 'daily' },
    { url: `${baseUrl}/bio`, priority: '0.8', changefreq: 'monthly' },
    { url: `${baseUrl}/portfolio`, priority: '0.9', changefreq: 'weekly' },
    { url: `${baseUrl}/blog`, priority: '0.8', changefreq: 'daily' },
    { url: `${baseUrl}/shop`, priority: '0.9', changefreq: 'daily' },
    { url: `${baseUrl}/contact`, priority: '0.7', changefreq: 'monthly' },
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(page => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}