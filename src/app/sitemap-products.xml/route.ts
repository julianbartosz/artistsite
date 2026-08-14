import { NextResponse } from 'next/server';
import { productImageSrc } from '@/lib/commerce';
import { getAllProducts } from '@/lib/commerce-server';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';

export async function GET() {
  const products = await getAllProducts();

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${products.map(product => `  <url>
    <loc>${baseUrl}/shop/${product.id}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>${baseUrl}${productImageSrc(product)}</image:loc>
      <image:title>${product.title}</image:title>
      <image:caption>${product.description}</image:caption>
    </image:image>
  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
    },
  });
}