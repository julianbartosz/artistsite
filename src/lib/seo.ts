import { Metadata } from 'next';

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
  price?: number;
  currency?: string;
  availability?: string;
}

const SITE_NAME = 'Artist Site';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
const DEFAULT_IMAGE = '/images/og-default.jpg';

export function generatePageMetadata({
  title,
  description,
  type = 'website',
  images = [DEFAULT_IMAGE],
  url,
  publishedTime,
  modifiedTime,
  authors,
  tags,
}: SEOParams): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const absoluteImages = images.map(img => 
    img.startsWith('http') ? img : `${SITE_URL}${img}`
  );
  const canonicalUrl = url ? `${SITE_URL}${url}` : undefined;

  return {
    title: fullTitle,
    description,
    keywords: tags?.join(', '),
    authors: authors?.map(name => ({ name })),
    creator: 'Artist Site',
    publisher: 'Artist Site',
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: fullTitle,
      description,
      type,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: absoluteImages.map(url => ({
        url,
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
      title: fullTitle,
      description,
      images: absoluteImages,
      creator: '@artistsite',
      site: '@artistsite',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
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
}: {
  title: string;
  description: string;
  publishedAt: string;
  author?: string;
  tags?: string[];
  coverImage?: string;
  slug: string;
}): Metadata {
  return generatePageMetadata({
    title,
    description,
    type: 'article',
    images: coverImage ? [coverImage] : undefined,
    url: `/blog/${slug}`,
    publishedTime: publishedAt,
    modifiedTime: publishedAt,
    authors: author ? [author] : undefined,
    tags,
  });
}

export function generatePortfolioMetadata({
  title,
  description,
  images,
  medium,
  year,
  slug,
}: {
  title: string;
  description: string;
  images: { main?: string; gallery?: string[] };
  medium?: string;
  year?: number;
  slug: string;
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
  });
}

export function generateProductMetadata({
  title,
  description,
  images,
  category,
  tags,
  slug,
}: {
  title: string;
  description: string;
  price: number;
  currency?: string;
  availability?: string;
  images: { thumbnail?: string; gallery?: string[] };
  category?: string;
  tags?: string[];
  slug: string;
}): Metadata {
  const productImages = images.thumbnail ? [images.thumbnail] : images.gallery?.slice(0, 1);
  const productTags = [category, ...(tags || [])].filter(Boolean) as string[];

  // For products, we'll use 'website' type in OpenGraph since 'product' isn't supported in Next.js metadata
  return generatePageMetadata({
    title,
    description,
    type: 'website',
    images: productImages,
    url: `/shop/${slug}`,
    tags: productTags,
  });
}

// Enhanced SEO utilities for Phase 2
export function generateCanonicalUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function generateHreflangTags(slug: string, locales: string[] = ['en']): Array<{ hreflang: string; href: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return locales.map(locale => ({
    hreflang: locale,
    href: `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/${slug}`
  }));
}

export function generateRSSFeedLink(): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return `${baseUrl}/rss.xml`;
}

// Generate Atom feed link for Phase 3
export function generateAtomFeedLink(): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return `${baseUrl}/atom.xml`;
}

// Generate comprehensive feed links for better SEO
export function generateFeedLinks(): Array<{ rel: string; type: string; title: string; href: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return [
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'Artist Site Blog RSS Feed',
      href: `${baseUrl}/rss.xml`
    },
    {
      rel: 'alternate',
      type: 'application/atom+xml',
      title: 'Artist Site Blog Atom Feed',
      href: `${baseUrl}/atom.xml`
    }
  ];
}

export function generateSitemapLinks(): Array<{ type: string; url: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return [
    { type: 'sitemap', url: `${baseUrl}/sitemap.xml` },
    { type: 'sitemap-index', url: `${baseUrl}/sitemap-index.xml` },
    { type: 'sitemap-static', url: `${baseUrl}/sitemap-static.xml` },
    { type: 'sitemap-products', url: `${baseUrl}/sitemap-products.xml` },
    { type: 'sitemap-blog', url: `${baseUrl}/sitemap-blog.xml` },
    { type: 'sitemap-portfolio', url: `${baseUrl}/sitemap-portfolio.xml` },
  ];
}

// SEO-optimized metadata for collections
export function generateCollectionMetadata({
  title,
  description,
  totalItems,
  page = 1,
  itemsPerPage = 12,
  category,
  basePath,
}: {
  title: string;
  description: string;
  totalItems: number;
  page?: number;
  itemsPerPage?: number;
  category?: string;
  basePath: string;
}): Metadata {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const pageTitle = page > 1 ? `${title} - Page ${page}` : title;
  const canonical = generateCanonicalUrl(`${basePath}${page > 1 ? `?page=${page}` : ''}`);
  
  const metadata: Metadata = {
    title: pageTitle,
    description: `${description} ${page > 1 ? `Page ${page} of ${totalPages}.` : ''}`,
    alternates: {
      canonical,
    },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical,
      type: 'website',
    },
    other: {},
  };

  // Add pagination links
  if (totalPages > 1) {
    if (page > 1) {
      metadata.other!['prev'] = generateCanonicalUrl(`${basePath}${page > 2 ? `?page=${page - 1}` : ''}`);
    }
    if (page < totalPages) {
      metadata.other!['next'] = generateCanonicalUrl(`${basePath}?page=${page + 1}`);
    }
  }

  return metadata;
}

// Generate rich snippets for search results
export function generateSearchMetadata({
  query,
  totalResults,
  searchTime,
  page = 1,
}: {
  query: string;
  totalResults: number;
  searchTime: number;
  page?: number;
}): Metadata {
  const title = `Search results for "${query}"${page > 1 ? ` - Page ${page}` : ''}`;
  const description = `Found ${totalResults} results for "${query}" in ${searchTime}ms`;
  
  return {
    title,
    description,
    robots: 'noindex, follow', // Don't index search results
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

// Open Graph optimization for Phase 3
export function generateAdvancedOpenGraph({
  title,
  description,
  url,
  type = 'website',
  image,
  imageAlt,
  siteName = 'Artist Site',
  locale = 'en_US',
  article,
  product,
}: {
  title: string;
  description: string;
  url: string;
  type?: 'website' | 'article' | 'product';
  image?: string;
  imageAlt?: string;
  siteName?: string;
  locale?: string;
  article?: {
    publishedTime: string;
    modifiedTime?: string;
    author: string;
    section: string;
    tags?: string[];
  };
  product?: {
    price: number;
    currency: string;
    availability: string;
    condition: string;
  };
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  const absoluteUrl = `${baseUrl}${url}`;
  const absoluteImage = image ? (image.startsWith('http') ? image : `${baseUrl}${image}`) : undefined;

  const openGraph: Record<string, any> = {
    title,
    description,
    url: absoluteUrl,
    type,
    siteName,
    locale,
    images: absoluteImage ? [{
      url: absoluteImage,
      width: 1200,
      height: 630,
      alt: imageAlt || title,
      type: 'image/jpeg',
    }] : undefined,
  };

  // Add article-specific metadata
  if (type === 'article' && article) {
    openGraph.publishedTime = article.publishedTime;
    openGraph.modifiedTime = article.modifiedTime;
    openGraph.authors = [article.author];
    openGraph.section = article.section;
    openGraph.tags = article.tags;
  }

  // Add product-specific metadata (using custom properties since OG doesn't have native product support)
  if (type === 'product' && product) {
    openGraph['product:price:amount'] = product.price;
    openGraph['product:price:currency'] = product.currency;
    openGraph['product:availability'] = product.availability;
    openGraph['product:condition'] = product.condition;
  }

  return openGraph;
}

// Twitter Card optimization
export function generateTwitterCard({
  card = 'summary_large_image',
  title,
  description,
  image,
  imageAlt,
  creator = '@artistsite',
  site = '@artistsite',
}: {
  card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  creator?: string;
  site?: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  const absoluteImage = image ? (image.startsWith('http') ? image : `${baseUrl}${image}`) : undefined;

  return {
    card,
    title,
    description,
    images: absoluteImage ? [{ url: absoluteImage, alt: imageAlt || title }] : undefined,
    creator,
    site,
  };
}

// Generate comprehensive metadata for art/portfolio pages
export function generateArtworkPageMetadata({
  title,
  description,
  artist,
  year,
  medium,
  dimensions,
  price,
  currency,
  availability,
  images,
  slug,
  tags,
}: {
  title: string;
  description: string;
  artist: string;
  year?: number;
  medium?: string;
  dimensions?: string;
  price?: number;
  currency?: string;
  availability?: string;
  images: { main?: string; gallery?: string[] };
  slug: string;
  tags?: string[];
}): Metadata {
  const url = `/portfolio/${slug}`;
  const mainImage = images.main || images.gallery?.[0];
  
  return {
    title: `${title} by ${artist} | Artist Site`,
    description: `${description} ${medium ? `Medium: ${medium}.` : ''} ${year ? `Created in ${year}.` : ''} ${dimensions ? `Dimensions: ${dimensions}.` : ''}`.trim(),
    keywords: [
      artist,
      medium,
      year?.toString(),
      'contemporary art',
      'artwork',
      'gallery',
      ...(tags || [])
    ].filter(Boolean).join(', '),
    alternates: {
      canonical: generateCanonicalUrl(url),
    },
    openGraph: generateAdvancedOpenGraph({
      title: `${title} by ${artist}`,
      description,
      url,
      type: 'article',
      image: mainImage,
      imageAlt: `${title} - artwork by ${artist}`,
      article: {
        publishedTime: year ? `${year}-01-01T00:00:00.000Z` : new Date().toISOString(),
        author: artist,
        section: 'Portfolio',
        tags: tags,
      },
    }),
    twitter: generateTwitterCard({
      title: `${title} by ${artist}`,
      description,
      image: mainImage,
      imageAlt: `${title} - artwork by ${artist}`,
    }),
  };
}

// Generate comprehensive metadata for product pages
export function generateEnhancedProductMetadata({
  title,
  description,
  price,
  currency = 'USD',
  availability = 'available',
  category,
  tags,
  images,
  slug,
  artist,
  medium,
  dimensions,
}: {
  title: string;
  description: string;
  price: number;
  currency?: string;
  availability?: string;
  category?: string;
  tags?: string[];
  images: { thumbnail?: string; gallery?: string[] };
  slug: string;
  artist?: string;
  medium?: string;
  dimensions?: string;
}): Metadata {
  const url = `/shop/${slug}`;
  const mainImage = images.thumbnail || images.gallery?.[0];
  const availabilityMap: Record<string, string> = {
    available: 'in stock',
    sold: 'out of stock',
    reserved: 'limited availability',
    commissioned: 'made to order',
  };
  
  return {
    title: `${title} - $${price} | Artist Site`,
    description: `${description} ${medium ? `Medium: ${medium}.` : ''} ${dimensions ? `Size: ${dimensions}.` : ''} ${availabilityMap[availability] ? `Status: ${availabilityMap[availability]}.` : ''}`.trim(),
    keywords: [
      title,
      artist,
      category,
      medium,
      'art for sale',
      'original artwork',
      'buy art online',
      ...(tags || [])
    ].filter(Boolean).join(', '),
    alternates: {
      canonical: generateCanonicalUrl(url),
    },
    openGraph: generateAdvancedOpenGraph({
      title: `${title} - $${price}`,
      description,
      url,
      type: 'product',
      image: mainImage,
      imageAlt: `${title} - original artwork`,
      product: {
        price,
        currency,
        availability: availabilityMap[availability] || availability,
        condition: 'new',
      },
    }),
    twitter: generateTwitterCard({
      title: `${title} - $${price}`,
      description,
      image: mainImage,
      imageAlt: `${title} - original artwork`,
    }),
  };
}

// Generate dynamic Open Graph image URL
export function generateDynamicOGImage({
  title,
  subtitle,
  type,
  image,
}: {
  title: string;
  subtitle?: string;
  type: 'blog' | 'portfolio' | 'product' | 'default';
  image?: string;
}): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  const params = new URLSearchParams({
    title: title.slice(0, 100), // Limit title length
    type,
  });
  
  if (subtitle) {
    params.set('subtitle', subtitle.slice(0, 150));
  }
  
  if (image) {
    params.set('image', image);
  }
  
  return `${baseUrl}/api/og?${params.toString()}`;
}

// Enhanced metadata generation with dynamic OG images
export function generateEnhancedPageMetadata({
  title,
  description,
  type = 'website',
  pageType,
  images,
  url,
  publishedTime,
  modifiedTime,
  authors,
  tags,
  customOGImage,
}: SEOParams & {
  pageType?: 'blog' | 'portfolio' | 'product' | 'default';
  customOGImage?: boolean;
}): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  let ogImages: string[];
  
  // Use dynamic OG image if enabled and no custom images provided
  if (customOGImage !== false && (!images || images.length === 0)) {
    const dynamicImage = generateDynamicOGImage({
      title,
      subtitle: description,
      type: pageType || 'default',
    });
    ogImages = [dynamicImage];
  } else {
    ogImages = images && images.length > 0 ? images.map(img => 
      img.startsWith('http') ? img : `${SITE_URL}${img}`
    ) : [DEFAULT_IMAGE];
  }
  
  const canonicalUrl = url ? `${SITE_URL}${url}` : undefined;

  return {
    title: fullTitle,
    description,
    keywords: tags?.join(', '),
    authors: authors?.map(name => ({ name })),
    creator: 'Artist Site',
    publisher: 'Artist Site',
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: fullTitle,
      description,
      type,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: ogImages.map(url => ({
        url,
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
      title: fullTitle,
      description,
      images: ogImages,
      creator: '@artistsite',
      site: '@artistsite',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

// Enhanced blog metadata with dynamic OG images
export function generateEnhancedBlogMetadata({
  title,
  description,
  publishedAt,
  author,
  tags,
  coverImage,
  slug,
}: {
  title: string;
  description: string;
  publishedAt: string;
  author?: string;
  tags?: string[];
  coverImage?: string;
  slug: string;
}): Metadata {
  return generateEnhancedPageMetadata({
    title,
    description,
    type: 'article',
    pageType: 'blog',
    images: coverImage ? [coverImage] : undefined,
    url: `/blog/${slug}`,
    publishedTime: publishedAt,
    modifiedTime: publishedAt,
    authors: author ? [author] : undefined,
    tags,
    customOGImage: !coverImage, // Use dynamic OG image if no cover image
  });
}

// Enhanced portfolio metadata with dynamic OG images
export function generateEnhancedPortfolioMetadata({
  title,
  description,
  images,
  medium,
  year,
  slug,
}: {
  title: string;
  description: string;
  images: { main?: string; gallery?: string[] };
  medium?: string;
  year?: number;
  slug: string;
}): Metadata {
  const portfolioImages = images.main ? [images.main] : images.gallery?.slice(0, 1);
  const tags = [medium, year?.toString()].filter(Boolean) as string[];

  return generateEnhancedPageMetadata({
    title,
    description,
    type: 'article',
    pageType: 'portfolio',
    images: portfolioImages,
    url: `/portfolio/${slug}`,
    tags,
    customOGImage: !portfolioImages || portfolioImages.length === 0,
  });
}