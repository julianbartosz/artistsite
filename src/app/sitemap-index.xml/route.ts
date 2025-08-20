import { NextResponse } from 'next/server';
import { getAllProducts } from '@domain/shop';
import { getAllPosts, getAllArtworks } from '@domain/content';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';

export async function GET() {
  const [products, posts, artworks] = await Promise.all([
    getAllProducts(),
    getAllPosts(),
    getAllArtworks(),
  ]);
  const nowIso = new Date().toISOString();
  const productsLastMod = products.length > 0 ? nowIso : nowIso;
  const postsLastMod = posts.length > 0 ? new Date(Math.max(...posts.map(p => new Date(p.publishedAt).getTime()))).toISOString() : nowIso;
  const artworksLastMod = artworks.length > 0 ? new Date(Math.max(...artworks.map(a => new Date(a.createdAt).getTime()))).toISOString() : nowIso;
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
    <lastmod>${nowIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-products.xml</loc>
    <lastmod>${productsLastMod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-blog.xml</loc>
    <lastmod>${postsLastMod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-portfolio.xml</loc>
    <lastmod>${artworksLastMod}</lastmod>
  </sitemap>
</sitemapindex>`;
  return new NextResponse(sitemapIndex, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}