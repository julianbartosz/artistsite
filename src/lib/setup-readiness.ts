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
  const theme = content.identity.theme;
  const defaultTheme = defaults.identity.theme;
  const identityChanged =
    content.identity.siteName !== defaults.identity.siteName
    || content.identity.tagline !== defaults.identity.tagline
    || Boolean(content.identity.logoImage)
    || (['primaryColor', 'accentColor', 'fontPreset', 'cardStyle', 'spacingDensity', 'pageTone'] as const)
      .some((key) => theme[key] !== defaultTheme[key]);

  const homeChanged =
    content.home.hero.titleLine1 !== defaults.home.hero.titleLine1
    || content.home.hero.subtitle !== defaults.home.hero.subtitle
    || content.home.layoutTemplate !== defaults.home.layoutTemplate;

  return identityChanged || homeChanged;
}

function isConfigured(settings: Map<string, 'configured' | 'not_set'> | undefined, key: string): boolean {
  return settings?.get(key) === 'configured';
}

function hasAllConfigured(settings: Map<string, 'configured' | 'not_set'> | undefined, keys: string[]): boolean {
  if (!settings) return false;
  return keys.every((key) => settings.get(key) === 'configured');
}

function hasAnyConfigured(settings: Map<string, 'configured' | 'not_set'> | undefined, keys: string[]): boolean {
  if (!settings) return false;
  return keys.some((key) => settings.get(key) === 'configured');
}

function isEmailDeliveryReady(settings: Map<string, 'configured' | 'not_set'> | undefined): boolean {
  if (!isConfigured(settings, 'CONTACT_EMAIL')) return false;
  if (isConfigured(settings, 'EMAIL_DELIVERY_MODE')) return true;
  return hasAllConfigured(settings, ['SMTP_FROM', 'SMTP_USER']);
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
      helpText: 'Your site cannot save orders or content until the database connection works. Check DATABASE_URL with your host — it is set in the server environment, not in this form.',
      // No settingKey: DATABASE_URL is env-only; deep-linking to CRON_SECRET was misleading.
    },
    {
      key: 'pages',
      label: 'Customize site page copy and branding',
      complete: hasAnyConfigured(settings, Object.values(SITE_CONTENT_KEYS))
        || (input.content ? isSiteCustomizationComplete(input.content) : false),
      tab: 'pages',
      action: 'Open Pages',
      helpText: 'Update your studio name, colors, and homepage copy under Pages.',
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
      complete: hasAllConfigured(settings, ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']),
      tab: 'settings',
      action: 'Open Stripe settings',
      helpText: 'Paste Stripe keys from dashboard.stripe.com under Settings → Payments.',
      settingKey: 'STRIPE_SECRET_KEY',
    },
    {
      key: 'email',
      label: 'Configure contact and email delivery',
      complete: isEmailDeliveryReady(settings),
      tab: 'settings',
      action: 'Open email settings',
      helpText: 'Set a contact email plus SMTP for order emails, or use log mode while testing locally.',
      settingKey: 'CONTACT_EMAIL',
    },
    {
      key: 'storage',
      label: 'Connect image storage for production uploads',
      complete: input.storageConfigured !== false,
      tab: 'settings',
      action: 'Open settings',
      helpText: 'Production uploads need AZURE_STORAGE_CONNECTION_STRING (and usually AZURE_STORAGE_CONTAINER). Local uploads work without Azure.',
      optional: true,
    },
    {
      key: 'marketing',
      label: 'Connect or prepare marketing channels',
      complete: hasAnyConfigured(settings, ['NEWSLETTER_FOOTER_ADDRESS', 'NEWSLETTER_DELIVERY_MODE', 'SOCIAL_PUBLISH_MODE', 'NEXT_PUBLIC_GA4_MEASUREMENT_ID']),
      tab: 'marketing',
      action: 'Open marketing',
      helpText: 'Add analytics or newsletter settings when you are ready to promote. Safe to finish after launch.',
      optional: true,
    },
    {
      key: 'automations',
      label: 'Turn on studio automations (optional)',
      complete: !cronStale,
      tab: 'settings',
      action: 'Open automation settings',
      helpText: 'In Settings, click Run automations now to send cart recovery and scheduled marketing jobs. Optional until you want hands-off follow-up.',
      settingKey: 'CRON_SECRET',
      optional: true,
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
