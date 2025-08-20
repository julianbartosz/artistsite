// filepath: /Users/julianbartosz/git/repos/artistsite/src/domain/seo/visualArtwork.ts
import { Thing, WithContext } from 'schema-dts';
export function generateVisualArtworkSchema({
  title,
  description,
  creator,
  dateCreated,
  medium,
  dimensions,
  image,
  url,
}: {
  title: string;
  description: string;
  creator?: string;
  dateCreated?: string;
  medium?: string;
  dimensions?: string;
  image?: string;
  url: string;
}): WithContext<Thing> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'VisualArtwork',
    name: title,
    description,
    creator: creator
      ? {
          '@type': 'Person',
          name: creator,
        }
      : undefined,
    dateCreated,
    artMedium: medium,
    size: dimensions,
    image: image ? `${siteUrl}${image}` : undefined,
    url: `${siteUrl}${url}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteUrl}${url}` },
  };
}
