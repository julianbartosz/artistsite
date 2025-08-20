import { MetadataRoute } from 'next';
import { generateSitemap } from '@domain/seo';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await generateSitemap();
  return entries.map(e => ({
    url: e.url,
    lastModified: e.lastModified ?? new Date(),
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}