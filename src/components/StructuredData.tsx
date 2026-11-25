import { Thing, WithContext } from 'schema-dts';
import { absoluteUrl } from '@/lib/utils';

interface StructuredDataProps {
  data: WithContext<Thing>;
}

export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).split('<').join('\\u003c') }}
    />
  );
}

export function generateArticleSchema({
  title,
  description,
  author,
  publishedAt,
  modifiedAt,
  url,
  image,
  tags,
  publisher,
  siteUrl,
}: {
  title: string;
  description: string;
  author?: string;
  publishedAt: string;
  modifiedAt?: string;
  url: string;
  image?: string;
  tags?: string[];
  publisher: { name: string; logo: string };
  siteUrl: string;
}): WithContext<Thing> {
  const pageUrl = absoluteUrl(url, siteUrl);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: author ? {
      '@type': 'Person',
      name: author,
    } : undefined,
    publisher: {
      '@type': 'Organization',
      name: publisher.name,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl(publisher.logo, siteUrl),
      },
    },
    datePublished: publishedAt,
    dateModified: modifiedAt || publishedAt,
    url: pageUrl,
    image: image ? absoluteUrl(image, siteUrl) : undefined,
    keywords: tags?.join(', '),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
  };
}

export function generateVisualArtworkSchema({
  title,
  description,
  creator,
  dateCreated,
  medium,
  dimensions,
  image,
  url,
  siteUrl,
}: {
  title: string;
  description: string;
  creator?: string;
  dateCreated?: string;
  medium?: string;
  dimensions?: string;
  image?: string;
  url: string;
  siteUrl: string;
}): WithContext<Thing> {
  const pageUrl = absoluteUrl(url, siteUrl);

  return {
    '@context': 'https://schema.org',
    '@type': 'VisualArtwork',
    name: title,
    description,
    creator: creator ? {
      '@type': 'Person',
      name: creator,
    } : undefined,
    dateCreated,
    artMedium: medium,
    size: dimensions,
    image: image ? absoluteUrl(image, siteUrl) : undefined,
    url: pageUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
  };
}

export function generateOrganizationSchema({
  name,
  description,
  logo,
  contactPoint,
  sameAs,
  siteUrl,
}: {
  name: string;
  description: string;
  logo?: string;
  contactPoint?: {
    telephone?: string;
    email?: string;
    contactType?: string;
  };
  sameAs?: string[];
  siteUrl: string;
}): WithContext<Thing> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    description,
    url: siteUrl || undefined,
    logo: logo ? absoluteUrl(logo, siteUrl) : undefined,
    contactPoint: contactPoint ? {
      '@type': 'ContactPoint',
      telephone: contactPoint.telephone,
      email: contactPoint.email,
      contactType: contactPoint.contactType || 'Customer Service',
    } : undefined,
    sameAs,
  };
}

export function generateWebSiteSchema({
  name,
  alternateNames,
  description,
  siteUrl,
}: {
  name: string;
  alternateNames?: string[];
  description?: string;
  siteUrl: string;
}): WithContext<Thing> {
  const uniqueAlternates = Array.from(
    new Set((alternateNames ?? []).map((entry) => entry.trim()).filter((entry) => entry && entry.toLowerCase() !== name.trim().toLowerCase())),
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    ...(uniqueAlternates.length > 0 ? { alternateName: uniqueAlternates } : {}),
    description: description || undefined,
    url: siteUrl || undefined,
  };
}

export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>, siteUrl: string): WithContext<Thing> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url, siteUrl),
    })),
  };
}
