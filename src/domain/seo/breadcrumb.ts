// filepath: /Users/julianbartosz/git/repos/artistsite/src/domain/seo/breadcrumb.ts
import { Thing, WithContext } from 'schema-dts';
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>): WithContext<Thing> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.url}`,
    })),
  };
}
