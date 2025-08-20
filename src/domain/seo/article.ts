// filepath: /Users/julianbartosz/git/repos/artistsite/src/domain/seo/article.ts
import { Thing, WithContext } from 'schema-dts';
export function generateArticleSchema({
  title,
  description,
  author,
  publishedAt,
  modifiedAt,
  url,
  image,
  tags
}: {
  title: string;
  description: string;
  author?: string;
  publishedAt: string;
  modifiedAt?: string;
  url: string;
  image?: string;
  tags?: string[];
}): WithContext<Thing> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: author
      ? {
          '@type': 'Person',
          name: author,
        }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Artist Site',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/images/logo.png`,
      },
    },
    datePublished: publishedAt,
    dateModified: modifiedAt || publishedAt,
    url: `${siteUrl}${url}`,
    image: image ? `${siteUrl}${image}` : undefined,
    keywords: tags?.join(', '),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}${url}`,
    },
  };
}
