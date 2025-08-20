// filepath: /Users/julianbartosz/git/repos/artistsite/src/domain/seo/product.ts
import { Thing, WithContext } from 'schema-dts';
export function generateProductSchema({
  title,
  description,
  price,
  currency = 'USD',
  availability = 'InStock',
  condition = 'New',
  image,
  category,
  brand = 'Artist Site',
  sku,
  url,
}: {
  title: string;
  description: string;
  price: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  condition?: 'New' | 'Used' | 'Refurbished';
  image?: string;
  category?: string;
  brand?: string;
  sku?: string;
  url: string;
}): WithContext<Thing> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description,
    image: image ? `${siteUrl}${image}` : undefined,
    brand: { '@type': 'Brand', name: brand },
    category,
    sku,
    offers: {
      '@type': 'Offer',
      price: price.toString(),
      priceCurrency: currency,
      availability: `https://schema.org/${availability}`,
      itemCondition: `https://schema.org/${condition}Condition`,
      url: `${siteUrl}${url}`,
      seller: { '@type': 'Organization', name: 'Artist Site' },
    },
  };
}
