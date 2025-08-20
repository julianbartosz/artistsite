// filepath: /Users/julianbartosz/git/repos/artistsite/src/domain/seo/organization.ts
import { Thing, WithContext } from 'schema-dts';
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
  contactPoint?: { telephone?: string; email?: string; contactType?: string };
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
    contactPoint: contactPoint
      ? {
          '@type': 'ContactPoint',
          telephone: contactPoint.telephone,
          email: contactPoint.email,
          contactType: contactPoint.contactType || 'Customer Service',
        }
      : undefined,
    sameAs,
  };
}
