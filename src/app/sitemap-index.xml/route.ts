import { NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/commerce';
import { getAllPosts } from '@/lib/markdown';
import { getAllArtworks } from '@/lib/portfolio';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';

export async function GET() {
  const [products, posts, artworks] = await Promise.all([
    getAllProducts(),
    getAllPosts(),
    getAllArtworks(),
  ]);

  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-products.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-blog.xml</loc>
    <lastmod>${posts.length > 0 ? new Date(Math.max(...posts.map(p => new Date(p.publishedAt).getTime()))).toISOString() : new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-portfolio.xml</loc>
    <lastmod>${artworks.length > 0 ? new Date(Math.max(...artworks.map(a => new Date(a.createdAt).getTime()))).toISOString() : new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new NextResponse(sitemapIndex, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}