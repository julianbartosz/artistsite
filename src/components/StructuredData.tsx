import { Thing, WithContext } from 'schema-dts';

interface StructuredDataProps {
  data: WithContext<Thing>;
}

export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Schema generators for different content types
export function generateArticleSchema({
  title,
  description,
  author,
  publishedAt,
  modifiedAt,
  url,
  image,
  tags,
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
    author: author ? {
      '@type': 'Person',
      name: author,
    } : undefined,
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
    brand: {
      '@type': 'Brand',
      name: brand,
    },
    category,
    sku,
    offers: {
      '@type': 'Offer',
      price: price.toString(),
      priceCurrency: currency,
      availability: `https://schema.org/${availability}`,
      itemCondition: `https://schema.org/${condition}Condition`,
      url: `${siteUrl}${url}`,
      seller: {
        '@type': 'Organization',
        name: 'Artist Site',
      },
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
    creator: creator ? {
      '@type': 'Person',
      name: creator,
    } : undefined,
    dateCreated,
    artMedium: medium,
    size: dimensions,
    image: image ? `${siteUrl}${image}` : undefined,
    url: `${siteUrl}${url}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}${url}`,
    },
  };
}

export function generateOrganizationSchema({
  name = 'Artist Site',
  description,
  url,
  logo,
  contactPoint,
  sameAs,
}: {
  name?: string;
  description: string;
  url?: string;
  logo?: string;
  contactPoint?: {
    telephone?: string;
    email?: string;
    contactType?: string;
  };
  sameAs?: string[];
}): WithContext<Thing> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://artistsite.com';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    description,
    url: url || siteUrl,
    logo: logo ? `${siteUrl}${logo}` : undefined,
    contactPoint: contactPoint ? {
      '@type': 'ContactPoint',
      telephone: contactPoint.telephone,
      email: contactPoint.email,
      contactType: contactPoint.contactType || 'Customer Service',
    } : undefined,
    sameAs,
  };
}

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

// Advanced Schema Types for Phase 3
export interface FAQItem {
  question: string;
  answer: string;
}

export interface HowToStep {
  name: string;
  text: string;
  image?: string;
  url?: string;
}

export interface ReviewSchema {
  itemReviewed: {
    name: string;
    type: string;
  };
  author: string;
  reviewRating: {
    ratingValue: number;
    bestRating: number;
    worstRating: number;
  };
  reviewBody: string;
  datePublished: string;
}

// Generate FAQ Schema
export function generateFAQSchema(faqs: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

// Generate How-to Schema
export function generateHowToSchema({
  name,
  description,
  image,
  totalTime,
  supply,
  tool,
  steps
}: {
  name: string;
  description: string;
  image?: string;
  totalTime?: string;
  supply?: string[];
  tool?: string[];
  steps: HowToStep[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    image: image ? [image] : undefined,
    totalTime,
    supply: supply?.map(item => ({
      '@type': 'HowToSupply',
      name: item
    })),
    tool: tool?.map(item => ({
      '@type': 'HowToTool',
      name: item
    })),
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      image: step.image,
      url: step.url
    }))
  };
}

// Generate Review Schema
export function generateReviewSchema(review: ReviewSchema) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': review.itemReviewed.type,
      name: review.itemReviewed.name
    },
    author: {
      '@type': 'Person',
      name: review.author
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.reviewRating.ratingValue,
      bestRating: review.reviewRating.bestRating,
      worstRating: review.reviewRating.worstRating
    },
    reviewBody: review.reviewBody,
    datePublished: review.datePublished
  };
}

// Generate Collection/Gallery Schema
export function generateCollectionSchema({
  name,
  description,
  curator,
  artworks,
  url
}: {
  name: string;
  description: string;
  curator: string;
  artworks: Array<{
    name: string;
    creator: string;
    url: string;
    image?: string;
  }>;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ExhibitionEvent',
    name,
    description,
    url,
    organizer: {
      '@type': 'Person',
      name: curator
    },
    workPerformed: artworks.map(artwork => ({
      '@type': 'VisualArtwork',
      name: artwork.name,
      creator: {
        '@type': 'Person',
        name: artwork.creator
      },
      url: artwork.url,
      image: artwork.image
    }))
  };
}

// Generate Artist/Creator Schema
export function generateArtistSchema({
  name,
  description,
  image,
  url,
  sameAs,
  birthDate,
  birthPlace,
  artform
}: {
  name: string;
  description: string;
  image?: string;
  url: string;
  sameAs?: string[];
  birthDate?: string;
  birthPlace?: string;
  artform?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': url,
    name,
    description,
    image,
    url,
    sameAs,
    birthDate,
    birthPlace,
    hasOccupation: {
      '@type': 'Occupation',
      name: 'Artist',
      occupationLocation: {
        '@type': 'Place',
        name: birthPlace
      }
    },
    knowsAbout: artform,
    mainEntityOfPage: url
  };
}