import { getAllPosts } from '@/lib/markdown';
import { getAllArtworks } from '@/lib/portfolio';
import { getAllProducts } from '@/lib/commerce-server';

export interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';

export async function generateSitemap(): Promise<SitemapEntry[]> {
  const sitemap: SitemapEntry[] = [];

  // Static pages
  const staticPages = [
    { url: '', priority: 1.0, changeFreq: 'daily' as const },
    { url: '/blog', priority: 0.8, changeFreq: 'weekly' as const },
    { url: '/portfolio', priority: 0.9, changeFreq: 'weekly' as const },
    { url: '/shop', priority: 0.8, changeFreq: 'daily' as const },
    { url: '/bio', priority: 0.7, changeFreq: 'monthly' as const },
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

  // Blog posts
  try {
    const posts = await getAllPosts();
    posts.forEach(post => {
      sitemap.push({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: new Date(post.publishedAt),
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    });
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error);
  }

  // Portfolio items
  try {
    const artworks = await getAllArtworks();
    artworks.forEach(artwork => {
      sitemap.push({
        url: `${SITE_URL}/portfolio/${artwork.slug}`,
        lastModified: new Date(),
        changeFrequency: 'yearly',
        priority: 0.7,
      });
    });
  } catch (error) {
    console.error('Error fetching artworks for sitemap:', error);
  }

  // Shop products
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
  const urls = entries.map(entry => `
    <url>
      <loc>${entry.url}</loc>
      ${entry.lastModified ? `<lastmod>${entry.lastModified.toISOString()}</lastmod>` : ''}
      ${entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : ''}
      ${entry.priority ? `<priority>${entry.priority}</priority>` : ''}
    </url>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>`;
}

export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /

# Block admin and API routes
Disallow: /admin/
Disallow: /api/
Disallow: /auth/
Disallow: /checkout/

# Block draft content
Disallow: /*?draft=*

Sitemap: ${SITE_URL}/sitemap.xml`;
}