import type { SiteContentByPage } from '@/lib/site-content-shared';
import { SITE_CONTENT_DEFAULTS, SITE_CONTENT_KEYS } from '@/lib/site-content-shared';

export type LaunchReadinessTab =
  | 'overview'
  | 'pages'
  | 'products'
  | 'portfolio'
  | 'posts'
  | 'settings'
  | 'marketing';

export type LaunchReadinessItem = {
  key: string;
  label: string;
  complete: boolean;
  tab: LaunchReadinessTab;
  action: string;
  helpText: string;
  optional?: boolean;
  settingKey?: string;
};

export type LaunchReadinessInput = {
  content?: SiteContentByPage | null;
  stats?: {
    totalProducts?: number;
    totalArtworks?: number;
    publishedPosts?: number;
  };
  settings?: Map<string, 'configured' | 'not_set'>;
  settingValues?: Map<string, string>;
  promoCount?: number;
  databaseHealthy?: boolean;
  storageConfigured?: boolean;
};

export function isSiteCustomizationComplete(content: SiteContentByPage): boolean {
  const defaults = SITE_CONTENT_DEFAULTS;
  const identityChanged =
    content.identity.siteName !== defaults.identity.siteName
    || content.identity.tagline !== defaults.identity.tagline
    || content.identity.theme.primaryColor !== defaults.identity.theme.primaryColor
    || content.identity.theme.accentColor !== defaults.identity.theme.accentColor
    || content.identity.theme.fontPreset !== defaults.identity.theme.fontPreset;

  const homeChanged =
    content.home.hero.titleLine1 !== defaults.home.hero.titleLine1
    || content.home.hero.subtitle !== defaults.home.hero.subtitle
    || content.home.layoutTemplate !== defaults.home.layoutTemplate;

  return identityChanged || homeChanged;
}

function hasConfigured(settings: Map<string, 'configured' | 'not_set'> | undefined, keys: string[]): boolean {
  if (!settings) return false;
  return keys.some((key) => settings.get(key) === 'configured');
}

export function buildLaunchReadinessItems(input: LaunchReadinessInput): LaunchReadinessItem[] {
  const settings = input.settings;
  const values = input.settingValues;
  const cronLastRun = values?.get('CRON_LAST_RUN_AT');
  const cronStale = !cronLastRun || (Date.now() - new Date(cronLastRun).getTime()) > 25 * 60 * 60 * 1000;

  return [
    {
      key: 'database',
      label: 'Database connection is working',
      complete: input.databaseHealthy !== false,
      tab: 'settings',
      action: 'Open settings',
      helpText: 'Your site cannot save orders or content until the database connection works. Check DATABASE_URL with your host.',
      settingKey: 'CRON_SECRET',
    },
    {
      key: 'pages',
      label: 'Customize site page copy and branding',
      complete: hasConfigured(settings, Object.values(SITE_CONTENT_KEYS))
        || (input.content ? isSiteCustomizationComplete(input.content) : false),
      tab: 'pages',
      action: 'Open site pages',
      helpText: 'Update your studio name, colors, and homepage copy under Site Pages.',
    },
    {
      key: 'products',
      label: 'Add at least one artwork for sale',
      complete: (input.stats?.totalProducts || 0) > 0,
      tab: 'products',
      action: 'Open products',
      helpText: 'Create a product with photos, price, and shipping so collectors can checkout.',
    },
    {
      key: 'portfolio',
      label: 'Build the public portfolio',
      complete: (input.stats?.totalArtworks || 0) > 0,
      tab: 'portfolio',
      action: 'Open portfolio',
      helpText: 'Add portfolio pieces collectors can browse even before they buy.',
    },
    {
      key: 'blog',
      label: 'Publish at least one update',
      complete: (input.stats?.publishedPosts || 0) > 0,
      tab: 'posts',
      action: 'Open updates',
      helpText: 'Share a studio note or journal entry so your Updates feed is alive on launch.',
    },
    {
      key: 'payments',
      label: 'Configure Stripe checkout',
      complete: hasConfigured(settings, ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']),
      tab: 'settings',
      action: 'Open Stripe settings',
      helpText: 'Paste Stripe keys from dashboard.stripe.com under Settings → Payments.',
      settingKey: 'STRIPE_SECRET_KEY',
    },
    {
      key: 'email',
      label: 'Configure contact and email delivery',
      complete: hasConfigured(settings, ['CONTACT_EMAIL', 'SMTP_FROM', 'SMTP_USER', 'EMAIL_DELIVERY_MODE']),
      tab: 'settings',
      action: 'Open email settings',
      helpText: 'Set SMTP for order emails, or use log mode while testing locally.',
      settingKey: 'EMAIL_DELIVERY_MODE',
    },
    {
      key: 'storage',
      label: 'Connect image storage for production uploads',
      complete: input.storageConfigured !== false,
      tab: 'settings',
      action: 'Open settings',
      helpText: 'Production uploads need Azure blob storage configured by your host.',
      optional: true,
      settingKey: 'CRON_SECRET',
    },
    {
      key: 'marketing',
      label: 'Connect or prepare marketing channels',
      complete: hasConfigured(settings, ['NEWSLETTER_DELIVERY_MODE', 'SOCIAL_PUBLISH_MODE', 'NEXT_PUBLIC_GA4_MEASUREMENT_ID']),
      tab: 'marketing',
      action: 'Open marketing',
      helpText: 'Add GA4, newsletter mode, or social publish settings when you are ready to promote.',
    },
    {
      key: 'automations',
      label: 'Run scheduled automations at least once',
      complete: !cronStale,
      tab: 'settings',
      action: 'Open automation settings',
      helpText: 'Save an automation secret, click Run automations now, or schedule hourly calls to /api/cron/marketing.',
      settingKey: 'CRON_SECRET',
    },
    {
      key: 'promos',
      label: 'Create a promo code (optional)',
      complete: (input.promoCount || 0) > 0,
      tab: 'marketing',
      action: 'Open marketing',
      helpText: 'Optional discount codes collectors enter at checkout.',
      optional: true,
    },
  ];
}
