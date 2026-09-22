import { z } from 'zod';

export const SITE_CONTENT_KEYS = {
  identity: 'SITE_IDENTITY_JSON',
  home: 'PAGE_HOME_JSON',
  bio: 'PAGE_BIO_JSON',
  contact: 'PAGE_CONTACT_JSON',
  portfolio: 'PAGE_PORTFOLIO_JSON',
  shop: 'PAGE_SHOP_JSON',
  blog: 'PAGE_BLOG_JSON',
} as const;

export type SiteContentPage = keyof typeof SITE_CONTENT_KEYS;
export const SITE_CONTENT_PAGES = Object.keys(SITE_CONTENT_KEYS) as [SiteContentPage, ...SiteContentPage[]];

const optionalImage = z.string().default('');
export const heroCtaKeySchema = z.enum(['shop', 'portfolio', 'contact']);
export const heroHeightSchema = z.enum(['compact', 'full']);
export const heroImagePlacementSchema = z.enum(['inline', 'badge', 'background']);
export const fontPresetSchema = z.enum(['system', 'serif', 'modern']);
export const cardStyleSchema = z.enum(['gallery', 'studio', 'bold']);
export const spacingDensitySchema = z.enum(['comfortable', 'compact']);
export const productDetailLayoutSchema = z.enum(['standard', 'gallery-focus']);
export const featuredSelectionModeSchema = z.enum(['featured_flag', 'latest', 'manual']);
export const portfolioGridColumnsSchema = z.enum(['2', '3', '4']);
export const homeLayoutTemplateSchema = z.enum(['classic', 'gallery-first', 'story-first']);

export type FontPreset = z.infer<typeof fontPresetSchema>;
export type CardStyle = z.infer<typeof cardStyleSchema>;
export type SpacingDensity = z.infer<typeof spacingDensitySchema>;
export type ProductDetailLayout = z.infer<typeof productDetailLayoutSchema>;
export type FeaturedSelectionMode = z.infer<typeof featuredSelectionModeSchema>;
export type PortfolioGridColumns = z.infer<typeof portfolioGridColumnsSchema>;
export type HomeLayoutTemplate = z.infer<typeof homeLayoutTemplateSchema>;

export const HOME_SECTION_KEYS = ['featured', 'about', 'blog', 'newsletter'] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const BIO_SECTION_KEYS = ['statement', 'background', 'achievements', 'studio', 'collections', 'cta'] as const;
export type BioSectionKey = (typeof BIO_SECTION_KEYS)[number];

export const FONT_PRESET_FAMILIES: Record<FontPreset, string> = {
  system: 'var(--font-geist-sans), Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  modern: '"Helvetica Neue", Helvetica, Arial, sans-serif',
};

function isHomeSectionKey(value: unknown): value is HomeSectionKey {
  return typeof value === 'string' && (HOME_SECTION_KEYS as readonly string[]).includes(value);
}

function isValidHexColor(value: string): boolean {
  if (value.length !== 7 || value[0] !== '#') return false;
  for (let index = 1; index < value.length; index += 1) {
    const char = value[index].toLowerCase();
    if (!((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f'))) return false;
  }
  return true;
}

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return isValidHexColor(trimmed) ? trimmed : fallback;
}

function hexChannel(hex: string, start: number): number {
  const normalized = normalizeHexColor(hex, '#000000');
  return parseInt(normalized.slice(start, start + 2), 16);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: hexChannel(hex, 1),
    g: hexChannel(hex, 3),
    b: hexChannel(hex, 5),
  };
}

function sRgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * sRgbChannelToLinear(r)
    + 0.7152 * sRgbChannelToLinear(g)
    + 0.0722 * sRgbChannelToLinear(b)
  );
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const foreground = relativeLuminance(foregroundHex);
  const background = relativeLuminance(backgroundHex);
  const lighter = Math.max(foreground, background);
  const darker = Math.min(foreground, background);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG contrast for white button text on the primary brand color. */
export function whiteTextContrastOnPrimary(primaryHex: string): 'pass' | 'warn' | 'fail' {
  const ratio = contrastRatio('#ffffff', primaryHex);
  if (ratio >= 4.5) return 'pass';
  if (ratio >= 3) return 'warn';
  return 'fail';
}

const CARD_STYLE_VARIABLES: Record<CardStyle, Record<string, string>> = {
  gallery: {
    '--radius-card': '0px',
    '--shadow-card': 'none',
    '--card-border-width': '0px',
    '--card-border-color': 'transparent',
  },
  studio: {
    '--radius-card': '0.5rem',
    '--shadow-card': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--card-border-width': '1px',
    '--card-border-color': 'rgb(229 231 235)',
  },
  bold: {
    '--radius-card': '0.75rem',
    '--shadow-card': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    '--card-border-width': '2px',
    '--card-border-color': 'rgb(209 213 219)',
  },
};

/** Darken a #RRGGBB color by a 0–255 RGB delta (negative values lighten). */
export function adjustHexRgb(hex: string, delta: number): string {
  const normalized = normalizeHexColor(hex, '#111827');
  const parsed = parseInt(normalized.slice(1), 16);
  const clamp = (channel: number) => Math.min(255, Math.max(0, channel));
  const r = clamp(((parsed >> 16) & 0xff) + delta);
  const g = clamp(((parsed >> 8) & 0xff) + delta);
  const b = clamp((parsed & 0xff) + delta);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function isBioSectionKey(value: unknown): value is BioSectionKey {
  return typeof value === 'string' && (BIO_SECTION_KEYS as readonly string[]).includes(value);
}

export function normalizeBioSectionOrder(value: unknown): BioSectionKey[] {
  const incoming = Array.isArray(value) ? value : [];
  const order: BioSectionKey[] = [];

  for (const item of incoming) {
    if (isBioSectionKey(item) && !order.includes(item)) {
      order.push(item);
    }
  }

  for (const key of BIO_SECTION_KEYS) {
    if (!order.includes(key)) {
      order.push(key);
    }
  }

  return order;
}

export function normalizeHomeSectionOrder(value: unknown): HomeSectionKey[] {
  const incoming = Array.isArray(value) ? value : [];
  const order: HomeSectionKey[] = [];

  for (const item of incoming) {
    if (isHomeSectionKey(item) && !order.includes(item)) {
      order.push(item);
    }
  }

  for (const key of HOME_SECTION_KEYS) {
    if (!order.includes(key)) {
      order.push(key);
    }
  }

  return order;
}

export function themeCssVariables(theme: {
  primaryColor: string;
  accentColor: string;
  fontPreset: FontPreset;
  cardStyle?: CardStyle;
  spacingDensity?: SpacingDensity;
}): Record<string, string> {
  const cardStyle = theme.cardStyle ?? 'studio';
  const spacingDensity = theme.spacingDensity ?? 'comfortable';
  return {
    '--color-primary': theme.primaryColor,
    '--color-primary-hover': adjustHexRgb(theme.primaryColor, -20),
    '--color-accent': theme.accentColor,
    '--font-site': FONT_PRESET_FAMILIES[theme.fontPreset],
    ...CARD_STYLE_VARIABLES[cardStyle],
    ...SPACING_DENSITY_VARIABLES[spacingDensity],
  };
}

export function gridColumnsClass(columns: PortfolioGridColumns): string {
  switch (columns) {
    case '2':
      return 'grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8';
    case '4':
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8';
    default:
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8';
  }
}

export function resolveHomeSectionRenderPlan(home: HomePageContent): {
  beforeHero: HomeSectionKey[];
  afterHero: HomeSectionKey[];
} {
  const order = normalizeHomeSectionOrder(home.sectionOrder);
  if (home.layoutTemplate === 'gallery-first' && home.featured.showSection) {
    return {
      beforeHero: ['featured'],
      afterHero: order.filter((key) => key !== 'featured'),
    };
  }
  if (home.layoutTemplate === 'story-first' && home.about.showSection) {
    return {
      beforeHero: ['about'],
      afterHero: order.filter((key) => key !== 'about'),
    };
  }
  return { beforeHero: [], afterHero: order };
}

export function listingHeroPaddingClass(height: z.infer<typeof heroHeightSchema>): string {
  return height === 'full' ? 'py-12 md:py-16' : 'py-6 md:py-8';
}

export function homeHeroHeightClass(height: z.infer<typeof heroHeightSchema>): string {
  return height === 'full'
    ? 'min-h-[70vh] md:min-h-[85vh] max-h-[85vh]'
    : 'section-space';
}

export type HeroCtaKey = z.infer<typeof heroCtaKeySchema>;

export const HERO_CTA_HREFS: Record<HeroCtaKey, string> = {
  shop: '/shop',
  portfolio: '/portfolio',
  contact: '/contact',
};

export const NAV_PAGE_KEYS = ['home', 'portfolio', 'blog', 'shop', 'bio', 'contact'] as const;
export type NavPageKey = (typeof NAV_PAGE_KEYS)[number];

export const UPDATES_PATH = '/updates';
export const UPDATES_LEGACY_PATH = '/blog';

export function updatesPostPath(slug: string): string {
  return `${UPDATES_PATH}/${encodeURIComponent(slug)}`;
}

export function updatesTagPath(tag: string): string {
  return `${UPDATES_PATH}/tag/${encodeURIComponent(tag.toLowerCase())}`;
}

export function isUpdatesPath(pathname: string): boolean {
  return (
    pathname === UPDATES_PATH
    || pathname.startsWith(`${UPDATES_PATH}/`)
    || pathname === UPDATES_LEGACY_PATH
    || pathname.startsWith(`${UPDATES_LEGACY_PATH}/`)
  );
}

export function navItemIsActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === UPDATES_PATH || href === UPDATES_LEGACY_PATH) {
    return isUpdatesPath(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const NAV_PAGE_HREFS: Record<NavPageKey, string> = {
  home: '/',
  portfolio: '/portfolio',
  blog: UPDATES_PATH,
  shop: '/shop',
  bio: '/bio',
  contact: '/contact',
};

export const CONTACT_INQUIRY_KEYS = ['general', 'purchase', 'commission', 'press', 'exhibition'] as const;
export type ContactInquiryKey = (typeof CONTACT_INQUIRY_KEYS)[number];

export const SITE_CONTENT_PREVIEW_HREF: Record<SiteContentPage, string> = {
  identity: '/',
  home: '/',
  bio: '/bio',
  contact: '/contact',
  portfolio: '/portfolio',
  shop: '/shop',
  blog: UPDATES_PATH,
};

function isNavPageKey(value: unknown): value is NavPageKey {
  return typeof value === 'string' && (NAV_PAGE_KEYS as readonly string[]).includes(value);
}

function isContactInquiryKey(value: unknown): value is ContactInquiryKey {
  return typeof value === 'string' && (CONTACT_INQUIRY_KEYS as readonly string[]).includes(value);
}

export type NavItem = {
  key: NavPageKey;
  href: string;
  label: string;
  visible: boolean;
  showInFooter: boolean;
};

export type ContactInquiryType = {
  key: ContactInquiryKey;
  label: string;
  visible: boolean;
};

export const DEFAULT_NAVIGATION: NavItem[] = [
  { key: 'home', href: '/', label: 'Home', visible: true, showInFooter: false },
  { key: 'portfolio', href: '/portfolio', label: 'Portfolio', visible: true, showInFooter: true },
  { key: 'blog', href: UPDATES_PATH, label: 'Updates', visible: true, showInFooter: true },
  { key: 'shop', href: '/shop', label: 'Shop', visible: true, showInFooter: true },
  { key: 'bio', href: '/bio', label: 'Bio', visible: true, showInFooter: true },
  { key: 'contact', href: '/contact', label: 'Contact', visible: true, showInFooter: true },
];

export const DEFAULT_CONTACT_INQUIRY_TYPES: ContactInquiryType[] = [
  { key: 'general', label: 'General Inquiry', visible: true },
  { key: 'purchase', label: 'Purchase Artwork', visible: true },
  { key: 'commission', label: 'Commission Request', visible: true },
  { key: 'press', label: 'Press & Media', visible: true },
  { key: 'exhibition', label: 'Exhibition Opportunity', visible: true },
];

export function normalizeNavigation(value: unknown): NavItem[] {
  const incoming = Array.isArray(value) ? value : [];
  const byKey = new Map<NavPageKey, Record<string, unknown>>();
  const order: NavPageKey[] = [];

  for (const item of incoming) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (!isNavPageKey(record.key) || byKey.has(record.key)) continue;
    order.push(record.key);
    byKey.set(record.key, record);
  }

  for (const item of DEFAULT_NAVIGATION) {
    if (!byKey.has(item.key)) {
      order.push(item.key);
      byKey.set(item.key, item);
    }
  }

  return order.map((key) => {
    const defaults = DEFAULT_NAVIGATION.find((item) => item.key === key)!;
    const override = byKey.get(key) || {};
    let label = typeof override.label === 'string' && override.label.trim()
      ? override.label.trim()
      : defaults.label;
    // Migrate legacy CMS nav label from the old blog route naming.
    if (key === 'blog' && label.toLowerCase() === 'blog') {
      label = defaults.label;
    }
    return {
      key,
      href: NAV_PAGE_HREFS[key],
      label,
      visible: typeof override.visible === 'boolean' ? override.visible : defaults.visible,
      showInFooter: typeof override.showInFooter === 'boolean' ? override.showInFooter : defaults.showInFooter,
    };
  });
}

export function normalizeInquiryTypes(value: unknown): ContactInquiryType[] {
  const incoming = Array.isArray(value) ? value : [];
  const byKey = new Map<ContactInquiryKey, Record<string, unknown>>();
  const order: ContactInquiryKey[] = [];

  for (const item of incoming) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (!isContactInquiryKey(record.key) || byKey.has(record.key)) continue;
    order.push(record.key);
    byKey.set(record.key, record);
  }

  for (const item of DEFAULT_CONTACT_INQUIRY_TYPES) {
    if (!byKey.has(item.key)) {
      order.push(item.key);
      byKey.set(item.key, item);
    }
  }

  return order.map((key) => {
    const defaults = DEFAULT_CONTACT_INQUIRY_TYPES.find((item) => item.key === key)!;
    const override = byKey.get(key) || {};
    const label = typeof override.label === 'string' && override.label.trim()
      ? override.label.trim()
      : defaults.label;
    return {
      key,
      label,
      visible: typeof override.visible === 'boolean' ? override.visible : defaults.visible,
    };
  });
}

const navItemSchema = z.object({
  key: z.enum(NAV_PAGE_KEYS),
  href: z.string(),
  label: z.string().min(1),
  visible: z.boolean().default(true),
  showInFooter: z.boolean().default(true),
});

const inquiryTypeSchema = z.object({
  key: z.enum(CONTACT_INQUIRY_KEYS),
  label: z.string().min(1),
  visible: z.boolean().default(true),
});

const SPACING_DENSITY_VARIABLES: Record<SpacingDensity, Record<string, string>> = {
  comfortable: {
    '--section-space-y': '3rem',
    '--section-space-y-md': '4rem',
    '--section-space-y-lg': '5rem',
  },
  compact: {
    '--section-space-y': '2rem',
    '--section-space-y-md': '2.5rem',
    '--section-space-y-lg': '3rem',
  },
};

export const siteThemeSchema = z.object({
  primaryColor: z.preprocess((value) => normalizeHexColor(value, '#111827'), z.string()),
  accentColor: z.preprocess((value) => normalizeHexColor(value, '#374151'), z.string()),
  fontPreset: fontPresetSchema.default('system'),
  cardStyle: cardStyleSchema.default('studio'),
  spacingDensity: spacingDensitySchema.default('comfortable'),
});

export const siteFooterSchema = z.object({
  quickLinksHeading: z.string().default('Quick Links'),
  legalHeading: z.string().default('Legal'),
  showLegal: z.boolean().default(true),
  extraColumn: z.object({
    show: z.boolean().default(false),
    heading: z.string().default(''),
    bodyHtml: z.string().default(''),
  }).default({ show: false, heading: '', bodyHtml: '' }),
});

export type SiteTheme = z.infer<typeof siteThemeSchema>;
export type SiteFooterContent = z.infer<typeof siteFooterSchema>;

export const siteIdentitySchema = z.object({
  siteName: z.string().min(1),
  headerName: z.string().default(''),
  tagline: z.string(),
  footerTagline: z.string(),
  copyrightName: z.string().min(1),
  navigation: z.preprocess(normalizeNavigation, z.array(navItemSchema)).default(DEFAULT_NAVIGATION),
  theme: siteThemeSchema.default({
    primaryColor: '#111827',
    accentColor: '#374151',
    fontPreset: 'system',
    cardStyle: 'studio',
    spacingDensity: 'comfortable',
  }),
  footer: siteFooterSchema.default({
    quickLinksHeading: 'Quick Links',
    legalHeading: 'Legal',
    showLegal: true,
    extraColumn: { show: false, heading: '', bodyHtml: '' },
  }),
});

export const pageListingHeroSchema = z.object({
  height: heroHeightSchema.default('compact'),
});

export const homePageSchema = z.object({
  layoutTemplate: homeLayoutTemplateSchema.default('classic'),
  sectionOrder: z.preprocess(normalizeHomeSectionOrder, z.array(z.enum(HOME_SECTION_KEYS))).default([...HOME_SECTION_KEYS]),
  hero: z.object({
    titleLine1: z.string().min(1),
    titleLine2: z.string(),
    subtitle: z.string(),
    ctaShop: z.string().min(1),
    ctaPortfolio: z.string().min(1),
    ctaContact: z.string().min(1),
    portraitImage: optionalImage,
    height: heroHeightSchema.default('compact'),
    imagePlacement: heroImagePlacementSchema.default('inline'),
    primaryCta: heroCtaKeySchema.default('shop'),
    showSecondaryCtas: z.boolean().default(true),
  }),
  featured: z.object({
    title: z.string().min(1),
    description: z.string(),
    cta: z.string().min(1),
    emptyMessage: z.string(),
    showDescriptions: z.boolean().default(false),
    showSection: z.boolean().default(true),
    selectionMode: featuredSelectionModeSchema.default('featured_flag'),
    manualSlugs: z.array(z.string()).default([]),
    limit: z.number().int().min(1).max(12).default(3),
    columns: portfolioGridColumnsSchema.default('3'),
  }),
  about: z.object({
    title: z.string().min(1),
    paragraph1: z.string(),
    paragraph2: z.string(),
    cta: z.string().min(1),
    studioImage: optionalImage,
    showSection: z.boolean().default(true),
  }),
  blog: z.object({
    title: z.string().min(1),
    description: z.string(),
    cta: z.string().min(1),
    emptyMessage: z.string(),
    showSection: z.boolean().default(true),
  }),
  newsletter: z.object({
    title: z.string().min(1),
    description: z.string(),
    placeholder: z.string().default('Enter your email'),
    buttonLabel: z.string().default('Subscribe'),
    disclaimer: z.string().default('No spam, unsubscribe at any time.'),
    showSection: z.boolean().default(true),
  }),
});

export const bioPageSchema = z.object({
  sectionOrder: z.preprocess(normalizeBioSectionOrder, z.array(z.enum(BIO_SECTION_KEYS))).default([...BIO_SECTION_KEYS]),
  hero: z.object({
    title: z.string().min(1),
    subtitle: z.string(),
    portraitImage: optionalImage,
    ctaPortfolio: z.string().default('View Portfolio'),
    ctaContact: z.string().default('Get in Touch'),
  }),
  statementTitle: z.string().min(1).default('Artist Statement'),
  backgroundTitle: z.string().min(1).default('Background'),
  achievementsTitle: z.string().min(1).default('Achievements'),
  studioTitle: z.string().min(1).default('Studio Practice'),
  collectionsTitle: z.string().min(1).default('Collections & Press'),
  artistStatementHtml: z.string(),
  backgroundHtml: z.string(),
  achievementsHtml: z.string(),
  studioPracticeHtml: z.string(),
  collectionsHtml: z.string(),
  studioImage: optionalImage,
  cta: z.object({
    title: z.string().min(1),
    subtitle: z.string(),
    portfolioLabel: z.string().default('Explore Portfolio'),
    shopLabel: z.string().default('Available Works'),
    contactLabel: z.string().default('Contact'),
  }),
  showStatement: z.boolean().default(true),
  showBackground: z.boolean().default(true),
  showAchievements: z.boolean().default(true),
  showStudio: z.boolean().default(true),
  showCollections: z.boolean().default(true),
  showCta: z.boolean().default(true),
});

export const contactPageSchema = z.object({
  header: z.object({
    title: z.string().min(1),
    subtitle: z.string(),
  }),
  form: z.object({
    title: z.string().min(1),
    successMessage: z.string(),
    inquiryLabel: z.string().min(1).default('Type of Inquiry'),
    nameLabel: z.string().min(1).default('Name'),
    emailLabel: z.string().min(1).default('Email'),
    subjectLabel: z.string().min(1).default('Subject'),
    messageLabel: z.string().min(1).default('Message'),
    submitLabel: z.string().min(1).default('Send Message'),
    namePlaceholder: z.string().default('Your full name'),
    emailPlaceholder: z.string().default('your@email.com'),
    subjectPlaceholder: z.string().default("What's this about?"),
    messagePlaceholder: z.string().default('Tell me more about your inquiry...'),
    inquiryTypes: z.preprocess(normalizeInquiryTypes, z.array(inquiryTypeSchema)).default(DEFAULT_CONTACT_INQUIRY_TYPES),
  }),
  sidebar: z.object({
    connectTitle: z.string().min(1),
    connectText: z.string(),
    location: z.string(),
    instagramHandle: z.string(),
    contactInfoTitle: z.string().min(1).default('Contact Information'),
    responseTimeTitle: z.string().min(1).default('Response Time'),
    commissionTitle: z.string().min(1).default('Commission Work'),
    responseTimeHtml: z.string(),
    commissionHtml: z.string(),
  }),
  portraitImage: optionalImage,
});

export const listingPageSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string(),
  hero: pageListingHeroSchema.default({ height: 'compact' }),
});

export const portfolioPageSchema = listingPageSchema.extend({
  layout: z.object({
    gridColumns: portfolioGridColumnsSchema.default('3'),
    showFilters: z.boolean().default(true),
    masonry: z.boolean().default(false),
  }).default({ gridColumns: '3', showFilters: true, masonry: false }),
  artworkDetailLayout: productDetailLayoutSchema.default('standard'),
});

export const shopPageSchema = listingPageSchema.extend({
  layout: z.object({
    gridColumns: portfolioGridColumnsSchema.default('3'),
    showFilters: z.boolean().default(true),
  }).default({ gridColumns: '3', showFilters: true }),
  searchPlaceholder: z.string().default('Search artworks, categories, or artists...'),
  showRecentlyViewed: z.boolean().default(true),
  showRecommendations: z.boolean().default(true),
  showPurchaseInfo: z.boolean().default(true),
  checkoutTrustCopy: z.string().default('Your payment information is processed securely by Stripe. We never store your payment details.'),
  checkoutPageTitle: z.string().default('Checkout'),
  checkoutPageSubtitle: z.string().default('Complete your purchase securely'),
  checkoutStepContact: z.string().default('Contact'),
  checkoutStepShipping: z.string().default('Shipping'),
  checkoutStepReview: z.string().default('Review & pay'),
  successTitle: z.string().default('Order Confirmed!'),
  successSubtitle: z.string().default('Thank you for your purchase'),
  successNextStepsHtml: z.string().default(`
    <ul>
      <li>You'll receive an order confirmation email shortly</li>
      <li>We'll prepare your artwork for shipping within 2-3 business days</li>
      <li>You'll receive tracking information once your order ships</li>
      <li>All artwork is carefully packaged and fully insured</li>
    </ul>
  `.trim()),
  productDetailLayout: productDetailLayoutSchema.default('standard'),
  purchaseInfo: z.object({
    title: z.string().default('Purchase Information'),
    authenticityTitle: z.string().default('Authenticity'),
    authenticityText: z.string().default('All original works come with a signed certificate of authenticity.'),
    shippingTitle: z.string().default('Shipping'),
    shippingText: z.string().default('Carefully packaged and insured shipping worldwide. Domestic shipping starts at $15.'),
    commissionsTitle: z.string().default('Commissions'),
    commissionsText: z.string().default('Interested in a custom piece? Contact me to discuss commission opportunities.'),
    ctaLabel: z.string().default('Contact for Inquiries'),
  }).default({
    title: 'Purchase Information',
    authenticityTitle: 'Authenticity',
    authenticityText: 'All original works come with a signed certificate of authenticity.',
    shippingTitle: 'Shipping',
    shippingText: 'Carefully packaged and insured shipping worldwide. Domestic shipping starts at $15.',
    commissionsTitle: 'Commissions',
    commissionsText: 'Interested in a custom piece? Contact me to discuss commission opportunities.',
    ctaLabel: 'Contact for Inquiries',
  }),
});

export const updatesFeedLayoutSchema = z.enum(['timeline', 'grid']);
export const orderProgressPostModeSchema = z.enum(['off', 'draft', 'publish']);

export const blogPageSchema = listingPageSchema.extend({
  subscribeLabel: z.string().default('Subscribe for Updates'),
  showSubscribe: z.boolean().default(true),
  showRss: z.boolean().default(true),
  feedLayout: updatesFeedLayoutSchema.default('timeline'),
  showFormatFilters: z.boolean().default(true),
  journalLabel: z.string().default('Journal'),
  studioLabel: z.string().default('Studio'),
  showPrivateSection: z.boolean().default(true),
  privateSectionTitle: z.string().default('For collectors'),
  privateSectionSubtitle: z.string().default('Private studio notes and process videos shared with selected collectors.'),
  privateSignInLabel: z.string().default('Sign in to see collector updates'),
  quickLookLabel: z.string().default('Quick look'),
  saveUpdateLabel: z.string().default('Save'),
  askArtistLabel: z.string().default('Ask the artist'),
  featuredLabel: z.string().default('Featured'),
  publicTabLabel: z.string().default('Public'),
  allFilterLabel: z.string().default('All'),
  showFeedDate: z.boolean().default(true),
  showFeedAuthor: z.boolean().default(true),
  showFeedTags: z.boolean().default(true),
  showComments: z.boolean().default(true),
  showLikes: z.boolean().default(true),
  commentsLabel: z.string().default('Comments'),
  likeLabel: z.string().default('Like'),
  autoOrderProgressPost: orderProgressPostModeSchema.default('draft'),
  autoOrderProgressExcerpt: z.string().default('Work has started in the studio on {{summary}}. This private update is linked to your order — more photos and notes will appear here as the piece progresses.'),
  digestEnabled: z.boolean().default(true),
  digestIntervalDays: z.coerce.number().int().min(1).max(30).default(7),
  digestSubject: z.string().default('Recent studio updates'),
  digestIntro: z.string().default('Here is what has been happening in the studio:'),
  collectorDigestEnabled: z.boolean().default(true),
  collectorDigestSubject: z.string().default('New collector studio updates'),
  collectorDigestIntro: z.string().default('New private studio notes shared with you:'),
});

export type SiteIdentityContent = z.infer<typeof siteIdentitySchema>;
export type HomePageContent = z.infer<typeof homePageSchema>;
export type BioPageContent = z.infer<typeof bioPageSchema>;
export type ContactPageContent = z.infer<typeof contactPageSchema>;
export type ListingPageContent = z.infer<typeof listingPageSchema>;
export type PortfolioPageContent = z.infer<typeof portfolioPageSchema>;
export type ShopPageContent = z.infer<typeof shopPageSchema>;
export type BlogPageContent = z.infer<typeof blogPageSchema>;

export type SiteContentByPage = {
  identity: SiteIdentityContent;
  home: HomePageContent;
  bio: BioPageContent;
  contact: ContactPageContent;
  portfolio: PortfolioPageContent;
  shop: ShopPageContent;
  blog: BlogPageContent;
};

export const PAGE_SCHEMAS = {
  identity: siteIdentitySchema,
  home: homePageSchema,
  bio: bioPageSchema,
  contact: contactPageSchema,
  portfolio: portfolioPageSchema,
  shop: shopPageSchema,
  blog: blogPageSchema,
} as const;

export function visibleHtmlText(html: string): string {
  let output = '';
  let inTag = false;
  for (let index = 0; index < html.length; index += 1) {
    const char = html[index];
    if (char === '<') {
      inTag = true;
      continue;
    }
    if (char === '>') {
      inTag = false;
      output += ' ';
      continue;
    }
    if (!inTag) {
      output += char;
    }
  }
  return output.split(' ').filter(Boolean).join(' ').trim();
}

export function htmlHasVisibleText(html: string): boolean {
  return visibleHtmlText(html).length > 0;
}

export function headerDisplayName(identity: SiteIdentityContent): string {
  const shortName = identity.headerName.trim();
  return shortName || identity.siteName;
}

/** Reject placeholder CMS strings so stored drafts do not override seeded defaults on public pages. */
export function isMeaningfulSiteText(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3) return false;
  const normalized = trimmed.toLowerCase();
  return normalized !== 'untitled' && normalized !== 'filler' && normalized !== 'placeholder' && normalized !== 'tbd';
}

export function visibleNavItems(identity: SiteIdentityContent): NavItem[] {
  return normalizeNavigation(identity.navigation).filter((item) => item.visible);
}

export function footerNavItems(identity: SiteIdentityContent): NavItem[] {
  return visibleNavItems(identity).filter((item) => item.showInFooter);
}

export function visibleInquiryTypes(contact: ContactPageContent): ContactInquiryType[] {
  return normalizeInquiryTypes(contact.form.inquiryTypes).filter((item) => item.visible);
}

export function defaultInquiryType(contact: ContactPageContent): ContactInquiryKey {
  return visibleInquiryTypes(contact)[0]?.key ?? 'general';
}

export function homeHeroCtas(home: HomePageContent): Array<{ key: HeroCtaKey; href: string; label: string; variant: 'primary' | 'secondary' }> {
  const labels: Record<HeroCtaKey, string> = {
    shop: home.hero.ctaShop,
    portfolio: home.hero.ctaPortfolio,
    contact: home.hero.ctaContact,
  };
  const keys: HeroCtaKey[] = ['shop', 'portfolio', 'contact'];
  const primary = home.hero.primaryCta;
  const ordered = [primary, ...keys.filter((key) => key !== primary)];
  const visible = home.hero.showSecondaryCtas ? ordered : [primary];
  return visible.map((key, index) => ({
    key,
    href: HERO_CTA_HREFS[key],
    label: labels[key],
    variant: index === 0 ? 'primary' : 'secondary',
  }));
}

export const DEFAULT_SITE_IDENTITY: SiteIdentityContent = {
  siteName: 'Artist Site',
  headerName: '',
  tagline: 'Contemporary paintings and drawings exploring the intersection of urban landscapes, abstract form, and the ever-changing quality of light.',
  footerTagline: 'Built with passion and creativity',
  copyrightName: 'Artist Site',
  navigation: DEFAULT_NAVIGATION,
  theme: {
    primaryColor: '#111827',
    accentColor: '#374151',
    fontPreset: 'system',
    cardStyle: 'studio',
    spacingDensity: 'comfortable',
  },
  footer: {
    quickLinksHeading: 'Quick Links',
    legalHeading: 'Legal',
    showLegal: true,
    extraColumn: { show: false, heading: '', bodyHtml: '' },
  },
};

export const DEFAULT_HOME_PAGE: HomePageContent = {
  layoutTemplate: 'classic',
  sectionOrder: [...HOME_SECTION_KEYS],
  hero: {
    titleLine1: 'Capturing Light',
    titleLine2: 'Through Art',
    subtitle: 'Contemporary paintings and drawings exploring the intersection of urban landscapes, abstract form, and the ever-changing quality of light.',
    ctaShop: 'Shop Art',
    ctaPortfolio: 'View Portfolio',
    ctaContact: 'Commission a Piece',
    portraitImage: '/images/artist-portrait.jpg',
    height: 'compact',
    imagePlacement: 'inline',
    primaryCta: 'shop',
    showSecondaryCtas: true,
  },
  featured: {
    title: 'Featured Works',
    description: 'A selection of recent pieces that showcase my ongoing exploration of light, form, and urban environments.',
    cta: 'View Full Portfolio →',
    emptyMessage: 'Featured artworks coming soon...',
    showDescriptions: false,
    showSection: true,
    selectionMode: 'featured_flag',
    manualSlugs: [],
    limit: 3,
    columns: '3',
  },
  about: {
    title: 'About the Artist',
    paragraph1: 'My work explores the dynamic relationship between light and form in urban environments. Through painting and drawing, I seek to capture the fleeting moments when ordinary cityscapes are transformed by the changing quality of light throughout the day.',
    paragraph2: 'Working primarily with oils, acrylics, and mixed media, I layer colors and textures to create pieces that hover between abstraction and representation, inviting viewers to discover their own connections to the urban landscape.',
    cta: 'Get in Touch',
    studioImage: '/images/artist-studio.jpg',
    showSection: true,
  },
  blog: {
    title: 'Latest updates',
    description: 'Studio notes, photos, short videos, and journal posts from the making of the work.',
    cta: 'See all updates →',
    emptyMessage: 'Updates coming soon...',
    showSection: true,
  },
  newsletter: {
    title: 'Stay Connected',
    description: 'Get updates on new works, upcoming exhibitions, and insights from the studio. Join a community of art enthusiasts and collectors.',
    placeholder: 'Enter your email',
    buttonLabel: 'Subscribe',
    disclaimer: 'No spam, unsubscribe at any time.',
    showSection: true,
  },
};

export const DEFAULT_BIO_PAGE: BioPageContent = {
  sectionOrder: [...BIO_SECTION_KEYS],
  hero: {
    title: 'About the Artist',
    subtitle: 'Contemporary painter exploring the intersection of urban landscapes, abstract form, and the ever-changing quality of light through oil and mixed media works.',
    portraitImage: '/images/artist-portrait.jpg',
    ctaPortfolio: 'View Portfolio',
    ctaContact: 'Get in Touch',
  },
  statementTitle: 'Artist Statement',
  backgroundTitle: 'Background',
  achievementsTitle: 'Achievements',
  studioTitle: 'Studio Practice',
  collectionsTitle: 'Collections & Press',
  studioImage: '/images/artist-studio.jpg',
  artistStatementHtml: `
    <p>My work explores the dynamic relationship between urban environments and natural light, capturing fleeting moments where architecture becomes canvas and shadow becomes form. Through oil painting and mixed media, I seek to translate the emotional resonance of city life into abstract compositions that speak to our shared human experience.</p>
    <p>Each piece begins with observation—the way morning light filters through building facades, how evening shadows create unexpected geometries, or the rhythm of movement in bustling street scenes. These moments of urban poetry become the foundation for works that balance representation with abstraction, allowing viewers to discover their own connections to the metropolitan landscape.</p>
    <p>Working primarily in oil on canvas, I employ both traditional techniques and contemporary approaches, often incorporating elements of collage and mixed media to create textural depth that mirrors the complexity of urban experience. My palette draws from the subtle variations of city light—warm ochres of sunset on concrete, cool blues of predawn streets, and the infinite grays that define metropolitan atmosphere.</p>
  `.trim(),
  backgroundHtml: `
    <h3>Education</h3>
    <p><strong>MFA, Painting</strong> - Yale School of Art, 2018</p>
    <p><strong>BFA, Fine Arts</strong> - Rhode Island School of Design, 2015</p>
    <p><strong>Study Abroad</strong> - Florence Academy of Art, 2014</p>
    <h3>Professional Experience</h3>
    <p><strong>Studio Artist</strong> - Independent Practice, 2018-Present</p>
    <p><strong>Teaching Assistant</strong> - Yale School of Art, 2016-2018</p>
    <p><strong>Gallery Intern</strong> - David Zwirner Gallery, 2015</p>
  `.trim(),
  achievementsHtml: `
    <h3>Selected Exhibitions</h3>
    <p><strong>2024</strong> - "Urban Abstractions" - Solo Exhibition, Gallery Modern</p>
    <p><strong>2023</strong> - "New Voices in Contemporary Art" - Group Show, MoMA PS1</p>
    <p><strong>2022</strong> - "Light and Shadow" - Solo Exhibition, Tribeca Gallery</p>
    <p><strong>2021</strong> - "Emerging Artists" - Group Show, Whitney Biennial</p>
    <h3>Awards &amp; Recognition</h3>
    <p><strong>2023</strong> - Artist Fellowship, New York Foundation for the Arts</p>
    <p><strong>2022</strong> - Emerging Artist Award, Art Basel Miami</p>
    <p><strong>2019</strong> - Yale School of Art Merit Scholarship</p>
  `.trim(),
  studioPracticeHtml: `
    <p>My studio practice is rooted in direct observation and material experimentation. Located in a converted warehouse in Long Island City, the space allows for both intimate drawing sessions and large-scale painting projects.</p>
    <p>I typically work on multiple pieces simultaneously, allowing ideas to cross-pollinate and evolve organically. The studio serves as both laboratory and sanctuary, where urban inspiration is transformed into artistic expression through careful attention to color, form, and texture.</p>
    <p>My materials range from traditional oil paints and brushes to unconventional tools like palette knives, found objects, and various texturing mediums. This hybrid approach reflects my interest in bridging classical techniques with contemporary conceptual frameworks.</p>
  `.trim(),
  collectionsHtml: `
    <h3>Public Collections</h3>
    <p>Museum of Contemporary Art, Chicago</p>
    <p>Brooklyn Museum Permanent Collection</p>
    <p>Yale University Art Gallery</p>
    <p>Private collections throughout the US and Europe</p>
    <h3>Press &amp; Publications</h3>
    <p><em>Artforum</em> - "Rising Stars of 2024"</p>
    <p><em>ARTnews</em> - "Urban Abstractions Review"</p>
    <p><em>Art in America</em> - "New York Studio Visits"</p>
    <p><em>Hyperallergic</em> - "Contemporary Landscape Painting"</p>
  `.trim(),
  cta: {
    title: 'Connect With My Work',
    subtitle: "Interested in learning more about my artistic practice, available works, or commission opportunities? I'd love to hear from you.",
    portfolioLabel: 'Explore Portfolio',
    shopLabel: 'Available Works',
    contactLabel: 'Contact',
  },
  showStatement: true,
  showBackground: true,
  showAchievements: true,
  showStudio: true,
  showCollections: true,
  showCta: true,
};

export const DEFAULT_CONTACT_PAGE: ContactPageContent = {
  header: {
    title: 'Get in Touch',
    subtitle: "I'd love to hear from you. Whether you're interested in purchasing artwork, commissioning a custom piece, or just want to say hello, don't hesitate to reach out.",
  },
  form: {
    title: 'Send a Message',
    successMessage: "Thank you for your message! I'll get back to you within 24-48 hours.",
    inquiryLabel: 'Type of Inquiry',
    nameLabel: 'Name',
    emailLabel: 'Email',
    subjectLabel: 'Subject',
    messageLabel: 'Message',
    submitLabel: 'Send Message',
    namePlaceholder: 'Your full name',
    emailPlaceholder: 'your@email.com',
    subjectPlaceholder: "What's this about?",
    messagePlaceholder: 'Tell me more about your inquiry...',
    inquiryTypes: DEFAULT_CONTACT_INQUIRY_TYPES,
  },
  sidebar: {
    connectTitle: "Let's Connect",
    connectText: "I'm always excited to discuss art, collaborate on projects, or simply chat about creativity.",
    location: 'New York, NY',
    instagramHandle: '@artistsite',
    contactInfoTitle: 'Contact Information',
    responseTimeTitle: 'Response Time',
    commissionTitle: 'Commission Work',
    responseTimeHtml: `
      <p>I typically respond to all inquiries within 24-48 hours. For urgent matters or commission deadlines, please mention this in your message.</p>
      <ul>
        <li>Purchase inquiries: Same day</li>
        <li>Commission requests: 1-2 days</li>
        <li>General questions: 24-48 hours</li>
      </ul>
    `.trim(),
    commissionHtml: `
      <p>I accept a limited number of commission projects each year. Please include details about:</p>
      <ul>
        <li>Desired size and medium</li>
        <li>Timeline and deadline</li>
        <li>Subject matter or theme</li>
        <li>Budget range</li>
      </ul>
    `.trim(),
  },
  portraitImage: '/images/artist-portrait.jpg',
};

export const DEFAULT_PORTFOLIO_PAGE: PortfolioPageContent = {
  title: 'Portfolio',
  subtitle: 'A collection of paintings, drawings, and mixed media works exploring themes of light, urban environments, and the intersection of abstraction and representation.',
  hero: { height: 'compact' },
  layout: { gridColumns: '3', showFilters: true, masonry: false },
  artworkDetailLayout: 'standard',
};

export const DEFAULT_SHOP_PAGE: ShopPageContent = {
  title: 'Art Shop',
  subtitle: 'Discover original paintings, drawings, prints, and collections. Each piece is carefully crafted and comes with a certificate of authenticity.',
  hero: { height: 'compact' },
  layout: { gridColumns: '3', showFilters: true },
  searchPlaceholder: 'Search artworks, categories, or artists...',
  checkoutTrustCopy: 'Your payment information is processed securely by Stripe. We never store your payment details.',
  checkoutPageTitle: 'Checkout',
  checkoutPageSubtitle: 'Complete your purchase securely',
  checkoutStepContact: 'Contact',
  checkoutStepShipping: 'Shipping',
  checkoutStepReview: 'Review & pay',
  successTitle: 'Order Confirmed!',
  successSubtitle: 'Thank you for your purchase',
  successNextStepsHtml: `
    <ul>
      <li>You'll receive an order confirmation email shortly</li>
      <li>We'll prepare your artwork for shipping within 2-3 business days</li>
      <li>You'll receive tracking information once your order ships</li>
      <li>All artwork is carefully packaged and fully insured</li>
    </ul>
  `.trim(),
  productDetailLayout: 'standard',
  showRecentlyViewed: true,
  showRecommendations: true,
  showPurchaseInfo: true,
  purchaseInfo: {
    title: 'Purchase Information',
    authenticityTitle: 'Authenticity',
    authenticityText: 'All original works come with a signed certificate of authenticity.',
    shippingTitle: 'Shipping',
    shippingText: 'Carefully packaged and insured shipping worldwide. Domestic shipping starts at $15.',
    commissionsTitle: 'Commissions',
    commissionsText: 'Interested in a custom piece? Contact me to discuss commission opportunities.',
    ctaLabel: 'Contact for Inquiries',
  },
};

export const DEFAULT_BLOG_PAGE: BlogPageContent = {
  title: 'Updates',
  subtitle: 'Studio photos, short videos, and journal notes — a living feed of the work, plus a private space for collectors.',
  hero: { height: 'compact' },
  subscribeLabel: 'Subscribe for Updates',
  showSubscribe: true,
  showRss: true,
  feedLayout: 'timeline',
  showFormatFilters: true,
  journalLabel: 'Journal',
  studioLabel: 'Studio',
  showPrivateSection: true,
  privateSectionTitle: 'For collectors',
  privateSectionSubtitle: 'Private studio notes and process videos shared with selected collectors.',
  privateSignInLabel: 'Sign in to see collector updates',
  quickLookLabel: 'Quick look',
  saveUpdateLabel: 'Save',
  askArtistLabel: 'Ask the artist',
  featuredLabel: 'Featured',
  publicTabLabel: 'Public',
  allFilterLabel: 'All',
  showFeedDate: true,
  showFeedAuthor: true,
  showFeedTags: true,
  showComments: true,
  showLikes: true,
  commentsLabel: 'Comments',
  likeLabel: 'Like',
  autoOrderProgressPost: 'draft',
  autoOrderProgressExcerpt: 'Work has started in the studio on {{summary}}. This private update is linked to your order — more photos and notes will appear here as the piece progresses.',
  digestEnabled: true,
  digestIntervalDays: 7,
  digestSubject: 'Recent studio updates',
  digestIntro: 'Here is what has been happening in the studio:',
  collectorDigestEnabled: true,
  collectorDigestSubject: 'New collector studio updates',
  collectorDigestIntro: 'New private studio notes shared with you:',
};

export const SITE_CONTENT_DEFAULTS = {
  identity: DEFAULT_SITE_IDENTITY,
  home: DEFAULT_HOME_PAGE,
  bio: DEFAULT_BIO_PAGE,
  contact: DEFAULT_CONTACT_PAGE,
  portfolio: DEFAULT_PORTFOLIO_PAGE,
  shop: DEFAULT_SHOP_PAGE,
  blog: DEFAULT_BLOG_PAGE,
} as const;
