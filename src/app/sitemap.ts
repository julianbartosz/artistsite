import { MetadataRoute } from 'next';
import { getAllProducts } from '@/lib/commerce-server';
import { PRODUCT_IMAGE_FALLBACK, productImageSrc } from '@/lib/commerce';
import { isVideoUrl } from '@/lib/image-variant-url';
import { getAllPosts } from '@/lib/markdown';
import { UPDATES_PATH, updatesPostPath } from '@/lib/site-content-shared';
import { getAllArtworks } from '@/lib/portfolio';
import { getSiteUrl } from '@/lib/config';
import { escapeHtml } from '@/lib/email-shell';
import { absoluteUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = await getSiteUrl();
  // Next writes sitemap values into XML verbatim.
  const link = (path: string) => escapeHtml(absoluteUrl(path, siteUrl));
  const imageLinks = (images: Array<string | undefined>) => [...new Set(images)]
    .filter((image): image is string => Boolean(image) && image !== PRODUCT_IMAGE_FALLBACK && !isVideoUrl(image))
    .map(link);

  const staticPages: MetadataRoute.Sitemap = [
    { url: link('/'), lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: link('/bio'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: link('/portfolio'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: link(UPDATES_PATH), lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: link('/shop'), lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: link('/contact'), lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ];

  let productPages: MetadataRoute.Sitemap = [];
  let blogPages: MetadataRoute.Sitemap = [];
  let portfolioPages: MetadataRoute.Sitemap = [];

  try {
    const products = await getAllProducts();
    productPages = products.map(product => ({
      url: link(`/shop/${product.id}`),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
      images: imageLinks([productImageSrc(product, undefined, 'lg')]),
    }));
  } catch (error) {
    console.error('Error fetching products for sitemap:', error);
  }

  try {
    const posts = await getAllPosts();
    blogPages = posts.map(post => ({
      url: link(updatesPostPath(post.slug)),
      lastModified: new Date(post.publishedAt),
      changeFrequency: 'monthly',
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error);
  }

  try {
    const artworks = await getAllArtworks();
    portfolioPages = artworks.map(artwork => ({
      url: link(`/portfolio/${artwork.slug}`),
      lastModified: new Date(artwork.createdAt),
      changeFrequency: 'monthly',
      priority: 0.8,
      images: imageLinks([artwork.images.main, ...(artwork.images.gallery || [])]),
    }));
  } catch (error) {
    console.error('Error fetching artworks for sitemap:', error);
  }

  return [...staticPages, ...productPages, ...blogPages, ...portfolioPages];
}
