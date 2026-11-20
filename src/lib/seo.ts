import type { Metadata } from 'next';
import { getPublicSiteShell } from '@/lib/public-site-shell';

export interface SEOParams {
  title: string;
  description: string;
  type?: 'website' | 'article';
  images?: string[];
  url?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
}

/** Brand fields that nested `openGraph` / `twitter` metadata must repeat, because Next replaces those objects instead of merging them. */
export type SeoBrand = {
  siteName: string;
  twitterHandle?: string;
};

const DEFAULT_IMAGE = '/api/og';

/** "@studio" from a profile URL such as https://x.com/studio; undefined when no handle can be read. */
export function socialHandle(profileUrl: string): string | undefined {
  if (!profileUrl) return undefined;
  try {
    const [segment] = new URL(profileUrl).pathname.split('/').filter(Boolean);
    if (!segment) return undefined;
    return segment.startsWith('@') ? segment : `@${segment}`;
  } catch {
    return undefined;
  }
}

export async function getSeoBrand(): Promise<SeoBrand> {
  const shell = await getPublicSiteShell();
  return {
    siteName: shell.identity.siteName,
    twitterHandle: socialHandle(shell.socialUrls.twitter),
  };
}

/** Titles stay bare: the root layout's title template appends the site name. URLs stay relative to the layout's metadataBase. */
export function generatePageMetadata({
  title,
  description,
  type = 'website',
  images,
  url,
  publishedTime,
  modifiedTime,
  authors,
  tags,
  brand,
  noIndex = false,
}: SEOParams & { brand: SeoBrand; noIndex?: boolean }): Metadata {
  const shareImages = images?.length ? images : [DEFAULT_IMAGE];
  return {
    title,
    description,
    keywords: tags?.join(', '),
    authors: authors?.map(name => ({ name })),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type,
      url,
      siteName: brand.siteName,
      images: shareImages.map(image => ({
        url: image,
        width: 1200,
        height: 630,
        alt: title,
      })),
      publishedTime,
      modifiedTime,
      authors,
      tags,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: shareImages,
      creator: brand.twitterHandle,
      site: brand.twitterHandle,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export function generateBlogMetadata({
  title,
  description,
  publishedAt,
  author,
  tags,
  coverImage,
  slug,
  brand,
  noIndex = false,
}: {
  title: string;
  description: string;
  publishedAt: string;
  author?: string;
  tags?: string[];
  coverImage?: string;
  slug: string;
  brand: SeoBrand;
  noIndex?: boolean;
}): Metadata {
  return generatePageMetadata({
    title,
    description,
    type: 'article',
    images: coverImage ? [coverImage] : undefined,
    url: `/updates/${slug}`,
    publishedTime: publishedAt,
    modifiedTime: publishedAt,
    authors: author ? [author] : undefined,
    tags,
    brand,
    noIndex,
  });
}

export function generatePortfolioMetadata({
  title,
  description,
  images,
  medium,
  year,
  slug,
  brand,
}: {
  title: string;
  description: string;
  images: { main?: string; gallery?: string[] };
  medium?: string;
  year?: number;
  slug: string;
  brand: SeoBrand;
}): Metadata {
  const portfolioImages = images.main ? [images.main] : images.gallery?.slice(0, 1);
  const tags = [medium, year?.toString()].filter(Boolean) as string[];

  return generatePageMetadata({
    title,
    description,
    type: 'article',
    images: portfolioImages,
    url: `/portfolio/${slug}`,
    tags,
    brand,
  });
}

export function generateFeedLinks(siteName: string): Array<{ rel: string; type: string; title: string; href: string }> {
  return [
    { rel: 'alternate', type: 'application/rss+xml', title: `${siteName} (RSS)`, href: '/rss.xml' },
    { rel: 'alternate', type: 'application/atom+xml', title: `${siteName} (Atom)`, href: '/atom.xml' },
  ];
}
