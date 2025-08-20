import { getAllPosts, getAllArtworks } from '@domain/content';
import { getAllProducts } from '@domain/shop';

export interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';

export async function generateSitemap(): Promise<SitemapEntry[]> {
  const sitemap: SitemapEntry[] = [];

  // Static pages (mirrors app/sitemap.ts)
  const staticPages = [
    { url: '', priority: 1.0, changeFreq: 'daily' as const },
    { url: '/bio', priority: 0.8, changeFreq: 'monthly' as const },
    { url: '/portfolio', priority: 0.9, changeFreq: 'weekly' as const },
    { url: '/blog', priority: 0.8, changeFreq: 'daily' as const },
    { url: '/shop', priority: 0.9, changeFreq: 'daily' as const },
    { url: '/contact', priority: 0.7, changeFreq: 'monthly' as const },
  ];

  staticPages.forEach(page => {
    sitemap.push({
      url: `${SITE_URL}${page.url}`,
      lastModified: new Date(),
      changeFrequency: page.changeFreq,
      priority: page.priority,
    });
  });

  // Blog posts (priority 0.7, monthly)
  try {
    const posts = await getAllPosts();
    posts.forEach(post => {
      sitemap.push({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: new Date(post.publishedAt),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    });
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error);
  }

  // Portfolio items (monthly, 0.8, lastModified from createdAt)
  try {
    const artworks = await getAllArtworks();
    artworks.forEach(artwork => {
      sitemap.push({
        url: `${SITE_URL}/portfolio/${artwork.slug}`,
        lastModified: new Date(artwork.createdAt),
        changeFrequency: 'monthly',
        priority: 0.8,
      });
    });
  } catch (error) {
    console.error('Error fetching artworks for sitemap:', error);
  }

  // Shop products (weekly, 0.8)
  try {
    const products = await getAllProducts();
    products.forEach(product => {
      sitemap.push({
        url: `${SITE_URL}/shop/${product.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    });
  } catch (error) {
    console.error('Error fetching products for sitemap:', error);
  }

  return sitemap;
}

export function generateSitemapXML(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      entry => `\n    <url>\n      <loc>${entry.url}</loc>\n      ${entry.lastModified ? `<lastmod>${entry.lastModified.toISOString()}</lastmod>` : ''}\n      ${entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : ''}\n      ${entry.priority ? `<priority>${entry.priority}</priority>` : ''}\n    </url>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls}\n</urlset>`;
}

export function generateRobotsTxt(): string {
  return `User-agent: *\nAllow: /\n# Block admin and API routes\nDisallow: /admin/\nDisallow: /api/\nDisallow: /auth/\nDisallow: /checkout/\n# Block draft content\nDisallow: /*?draft=*\nSitemap: ${SITE_URL}/sitemap.xml`;
}
