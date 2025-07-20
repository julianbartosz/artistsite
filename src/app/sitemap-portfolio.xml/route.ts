import { NextResponse } from 'next/server';
import { getAllArtworks } from '@/lib/portfolio';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';

export async function GET() {
  const artworks = await getAllArtworks();

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${artworks.map(artwork => `  <url>
    <loc>${baseUrl}/portfolio/${artwork.slug}</loc>
    <lastmod>${new Date(artwork.createdAt).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>${baseUrl}${artwork.images.main}</image:loc>
      <image:title>${artwork.title}</image:title>
      <image:caption>${artwork.description}</image:caption>
    </image:image>
${artwork.images.gallery ? artwork.images.gallery.map(img => `    <image:image>
      <image:loc>${baseUrl}${img}</image:loc>
      <image:title>${artwork.title} - Gallery Image</image:title>
    </image:image>`).join('\n') : ''}
  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}