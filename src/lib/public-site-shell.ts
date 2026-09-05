import 'server-only';
import { getConfigMany } from '@/lib/config';
import { getSiteContent } from '@/lib/site-content';
import { DEFAULT_SITE_IDENTITY, type SiteIdentityContent } from '@/lib/site-content-shared';

const PUBLIC_SHELL_CONFIG_KEYS = [
  'CONTACT_EMAIL',
  'ARTIST_EMAIL',
  'SUPPORT_EMAIL',
  'SOCIAL_INSTAGRAM_URL',
  'SOCIAL_FACEBOOK_URL',
  'SOCIAL_X_URL',
  'SOCIAL_PINTEREST_URL',
] as const;

export type PublicSiteShell = {
  identity: SiteIdentityContent;
  contactEmail: string;
  socialUrls: {
    instagram: string;
    facebook: string;
    twitter: string;
    pinterest: string;
  };
};

const DEFAULT_CONTACT_EMAIL = 'hello@artistsite.com';

export async function getPublicSiteShell(): Promise<PublicSiteShell> {
  const [identity, config] = await Promise.all([
    getSiteContent('identity'),
    getConfigMany([...PUBLIC_SHELL_CONFIG_KEYS]),
  ]);

  return {
    identity,
    contactEmail:
      config.CONTACT_EMAIL ||
      config.ARTIST_EMAIL ||
      config.SUPPORT_EMAIL ||
      DEFAULT_CONTACT_EMAIL,
    socialUrls: {
      instagram: config.SOCIAL_INSTAGRAM_URL || '',
      facebook: config.SOCIAL_FACEBOOK_URL || '',
      twitter: config.SOCIAL_X_URL || '',
      pinterest: config.SOCIAL_PINTEREST_URL || '',
    },
  };
}

export { DEFAULT_SITE_IDENTITY };
