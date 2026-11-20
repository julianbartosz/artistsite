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
export const FONT_PRESET_VALUES = ['system', 'serif', 'editorial'] as const;
/** `modern` was a near-duplicate of `system` and is folded into it for stored themes. */
export const fontPresetSchema = z.preprocess(
  (value) => (value === 'modern' ? 'system' : value),
  z.enum(FONT_PRESET_VALUES),
);
export const cardStyleSchema = z.enum(['gallery', 'studio', 'bold']);
export const spacingDensitySchema = z.enum(['comfortable', 'compact']);
export const pageToneSchema = z.enum(['soft', 'white', 'warm']);
export const productDetailLayoutSchema = z.enum(['standard', 'gallery-focus']);
export const featuredSelectionModeSchema = z.enum(['featured_flag', 'latest', 'manual']);
export const portfolioGridColumnsSchema = z.enum(['2', '3', '4']);
export const portfolioImageFitSchema = z.enum(['cover', 'contain']);
export const portfolioThumbAspectSchema = z.enum(['square', 'portrait', 'landscape']);
export const homeLayoutTemplateSchema = z.enum(['classic', 'gallery-first', 'story-first']);

export type FontPreset = z.infer<typeof fontPresetSchema>;
export type CardStyle = z.infer<typeof cardStyleSchema>;
export type SpacingDensity = z.infer<typeof spacingDensitySchema>;
export type PageTone = z.infer<typeof pageToneSchema>;
export type ProductDetailLayout = z.infer<typeof productDetailLayoutSchema>;
export type FeaturedSelectionMode = z.infer<typeof featuredSelectionModeSchema>;
export type PortfolioGridColumns = z.infer<typeof portfolioGridColumnsSchema>;
export type PortfolioImageFit = z.infer<typeof portfolioImageFitSchema>;
export type PortfolioThumbAspect = z.infer<typeof portfolioThumbAspectSchema>;
export type HomeLayoutTemplate = z.infer<typeof homeLayoutTemplateSchema>;

export const HOME_SECTION_KEYS = ['featured', 'about', 'blog', 'newsletter'] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const BIO_SECTION_KEYS = ['statement', 'background', 'achievements', 'studio', 'collections', 'cta'] as const;
export type BioSectionKey = (typeof BIO_SECTION_KEYS)[number];

const SANS_STACK = 'var(--font-inter), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
const SERIF_STACK = 'var(--font-source-serif), Georgia, "Times New Roman", serif';
const DISPLAY_SERIF_STACK = 'var(--font-fraunces), Georgia, "Times New Roman", serif';

/** Curated heading/body pairings; families are self-hosted via next/font in the root layout. */
export const FONT_PRESETS: Record<FontPreset, { label: string; description: string; body: string; heading: string }> = {
  system: {
    label: 'Clean',
    description: 'Modern sans-serif throughout',
    body: SANS_STACK,
    heading: SANS_STACK,
  },
  serif: {
    label: 'Classic',
    description: 'Book serif for headings and text',
    body: SERIF_STACK,
    heading: SERIF_STACK,
  },
  editorial: {
    label: 'Editorial',
    description: 'Soft display serif headings, clean text',
    body: SANS_STACK,
    heading: DISPLAY_SERIF_STACK,
  },
};

export const PAGE_TONES: Record<PageTone, {
  label: string;
  description: string;
  page: string;
  muted: string;
  sunken: string;
}> = {
  soft: {
    label: 'Soft gray',
    description: 'White pages with quiet gray bands',
    page: '#ffffff',
    muted: '#f9fafb',
    sunken: '#f3f4f6',
  },
  white: {
    label: 'Gallery white',
    description: 'All white — the art carries the color',
    page: '#ffffff',
    muted: '#ffffff',
    sunken: '#f5f5f5',
  },
  warm: {
    label: 'Warm paper',
    description: 'Cream paper tones, like a print studio',
    page: '#fbf8f3',
    muted: '#f4eee4',
    sunken: '#ebe2d3',
  },
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

/** WCAG AA for normal-size text. */
export const MIN_TEXT_CONTRAST = 4.5;

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (channel: number) => Math.min(255, Math.max(0, Math.round(channel)));
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) return rgbToHex(l * 255, l * 255, l * 255);
  const hueToChannel = (p: number, q: number, t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgbToHex(
    hueToChannel(p, q, h + 1 / 3) * 255,
    hueToChannel(p, q, h) * 255,
    hueToChannel(p, q, h - 1 / 3) * 255,
  );
}

/**
 * Darkens a color (keeping hue and saturation) just until it reaches the target
 * contrast against a light background. Returns the input when it already passes.
 */
export function ensureContrast(hex: string, background: string, minRatio = MIN_TEXT_CONTRAST): string {
  const normalized = normalizeHexColor(hex, '#000000').toLowerCase();
  if (contrastRatio(normalized, background) >= minRatio) return normalized;
  const { h, s, l } = hexToHsl(normalized);
  for (let lightness = l; lightness > 0; lightness -= 0.01) {
    const candidate = hslToHex(h, s, lightness);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return '#000000';
}

export type ThemeContrastIssue = {
  role: 'primary' | 'accent';
  ratio: number;
  suggestion: string;
};

/**
 * Primary carries white button and footer text; accent is headline text on the page
 * surface. Both should meet AA; the editor flags misses and offers the deepened color.
 */
export function themeContrastIssues(theme: Pick<SiteTheme, 'primaryColor' | 'accentColor' | 'pageTone'>): ThemeContrastIssue[] {
  const page = PAGE_TONES[theme.pageTone ?? 'soft'].page;
  const issues: ThemeContrastIssue[] = [];
  const primaryRatio = contrastRatio('#ffffff', theme.primaryColor);
  if (primaryRatio < MIN_TEXT_CONTRAST) {
    issues.push({ role: 'primary', ratio: primaryRatio, suggestion: ensureContrast(theme.primaryColor, '#ffffff') });
  }
  const accentRatio = contrastRatio(theme.accentColor, page);
  if (accentRatio < MIN_TEXT_CONTRAST) {
    issues.push({ role: 'accent', ratio: accentRatio, suggestion: ensureContrast(theme.accentColor, page) });
  }
  return issues;
}

/** Returns the theme with both brand colors deepened to meet contrast. */
export function withReadableBrandColors<T extends Pick<SiteTheme, 'primaryColor' | 'accentColor' | 'pageTone'>>(theme: T): T {
  const page = PAGE_TONES[theme.pageTone ?? 'soft'].page;
  return {
    ...theme,
    primaryColor: ensureContrast(theme.primaryColor, '#ffffff'),
    accentColor: ensureContrast(theme.accentColor, page),
  };
}

/**
 * Suggests brand colors from artwork swatches: the deepest color carries buttons and the
 * footer; the most vivid of the rest that is already near-readable becomes the highlight
 * (pale colors darken into mud). Both are then deepened just enough to pass contrast.
 */
export function suggestBrandColorsFromSwatches(
  swatches: string[],
  pageTone: PageTone = 'soft',
): { primaryColor: string; accentColor: string } | null {
  const colors = normalizeSwatches(swatches);
  if (colors.length === 0) return null;
  const primary = [...colors].sort((left, right) => relativeLuminance(left) - relativeLuminance(right))[0];
  const page = PAGE_TONES[pageTone].page;
  const rest = colors.filter((color) => color !== primary);
  const nearReadable = rest.filter((color) => contrastRatio(color, page) >= 3);
  const pool = nearReadable.length > 0 ? nearReadable : rest;
  const accent = pool.length > 0
    ? pool.reduce((best, color) => (hexToHsl(color).s > hexToHsl(best).s ? color : best))
    : primary;
  const readable = withReadableBrandColors({ primaryColor: primary, accentColor: accent, pageTone });
  return { primaryColor: readable.primaryColor, accentColor: readable.accentColor };
}

/** One radius vocabulary for cards, buttons, and fields so the site reads as one shape. */
export const SHAPE_VARIABLES: Record<CardStyle, Record<string, string>> = {
  gallery: {
    '--radius-card': '0px',
    '--radius-button': '0px',
    '--radius-input': '0px',
    '--shadow-card': 'none',
    '--card-border-width': '0px',
    '--card-border-color': 'transparent',
  },
  studio: {
    '--radius-card': '0.5rem',
    '--radius-button': '0.5rem',
    '--radius-input': '0.375rem',
    '--shadow-card': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--card-border-width': '1px',
    '--card-border-color': 'rgb(229 231 235)',
  },
  bold: {
    '--radius-card': '0.75rem',
    '--radius-button': '9999px',
    '--radius-input': '0.75rem',
    '--shadow-card': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    '--card-border-width': '2px',
    '--card-border-color': 'rgb(209 213 219)',
  },
};

/** Neutral product defaults — artists brand via looks, palettes, or Match an artwork. */
export const DEFAULT_THEME_PRIMARY = '#111827';
export const DEFAULT_THEME_ACCENT = '#374151';

/** Darken a #RRGGBB color by a 0–255 RGB delta (negative values lighten). */
export function adjustHexRgb(hex: string, delta: number): string {
  const normalized = normalizeHexColor(hex, DEFAULT_THEME_PRIMARY);
  const parsed = parseInt(normalized.slice(1), 16);
  const clamp = (channel: number) => Math.min(255, Math.max(0, channel));
  const r = clamp(((parsed >> 16) & 0xff) + delta);
  const g = clamp(((parsed >> 8) & 0xff) + delta);
  const b = clamp((parsed & 0xff) + delta);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const DEFAULT_THEME_PRIMARY_HOVER = adjustHexRgb(DEFAULT_THEME_PRIMARY, -20);

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

/** Space-separated channels so Tailwind opacity modifiers (`bg-primary/10`) can compose them. */
function rgbChannels(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

export function themeCssVariables(theme: {
  primaryColor: string;
  accentColor: string;
  fontPreset: FontPreset;
  cardStyle?: CardStyle;
  spacingDensity?: SpacingDensity;
  pageTone?: PageTone;
}): Record<string, string> {
  const primary = normalizeHexColor(theme.primaryColor, DEFAULT_THEME_PRIMARY);
  const accent = normalizeHexColor(theme.accentColor, DEFAULT_THEME_ACCENT);
  const primaryHover = adjustHexRgb(primary, -20);
  const fonts = FONT_PRESETS[theme.fontPreset] ?? FONT_PRESETS.system;
  const tone = PAGE_TONES[theme.pageTone ?? 'soft'];
  return {
    '--color-primary': primary,
    '--color-primary-rgb': rgbChannels(primary),
    '--color-primary-hover': primaryHover,
    '--color-primary-hover-rgb': rgbChannels(primaryHover),
    '--color-accent': accent,
    '--color-accent-rgb': rgbChannels(accent),
    '--font-site': fonts.body,
    '--font-heading': fonts.heading,
    '--surface-page': tone.page,
    '--surface-page-rgb': rgbChannels(tone.page),
    '--surface-muted': tone.muted,
    '--surface-muted-rgb': rgbChannels(tone.muted),
    '--surface-sunken': tone.sunken,
    '--surface-sunken-rgb': rgbChannels(tone.sunken),
    ...SHAPE_VARIABLES[theme.cardStyle ?? 'studio'],
    ...SPACING_DENSITY_VARIABLES[theme.spacingDensity ?? 'comfortable'],
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

export const ARTWORK_PALETTE_MAX_SWATCHES = 6;

function normalizeSwatches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const swatches: string[] = [];
  for (const entry of value) {
    const hex = normalizeHexColor(entry, '').toLowerCase();
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    swatches.push(hex);
    if (swatches.length === ARTWORK_PALETTE_MAX_SWATCHES) break;
  }
  return swatches;
}

/** Colors sampled from one of the artist's images, kept so they can return to them. */
export const artworkPaletteSchema = z.object({
  image: z.string().default(''),
  swatches: z.preprocess(normalizeSwatches, z.array(z.string())).default([]),
});

export type ArtworkPalette = z.infer<typeof artworkPaletteSchema>;
export const EMPTY_ARTWORK_PALETTE: ArtworkPalette = { image: '', swatches: [] };

export const siteThemeSchema = z.object({
  primaryColor: z.preprocess((value) => normalizeHexColor(value, DEFAULT_THEME_PRIMARY), z.string()),
  accentColor: z.preprocess((value) => normalizeHexColor(value, DEFAULT_THEME_ACCENT), z.string()),
  fontPreset: fontPresetSchema.default('system'),
  cardStyle: cardStyleSchema.default('studio'),
  spacingDensity: spacingDensitySchema.default('comfortable'),
  pageTone: pageToneSchema.default('soft'),
  artworkPalette: artworkPaletteSchema.default(EMPTY_ARTWORK_PALETTE),
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

export const DEFAULT_SITE_THEME: SiteTheme = {
  primaryColor: DEFAULT_THEME_PRIMARY,
  accentColor: DEFAULT_THEME_ACCENT,
  fontPreset: 'system',
  cardStyle: 'studio',
  spacingDensity: 'comfortable',
  pageTone: 'soft',
  artworkPalette: EMPTY_ARTWORK_PALETTE,
};

export const siteIdentitySchema = z.object({
  siteName: z.string().min(1),
  headerName: z.string().default(''),
  logoImage: optionalImage,
  tagline: z.string(),
  footerTagline: z.string(),
  copyrightName: z.string().min(1),
  navigation: z.preprocess(normalizeNavigation, z.array(navItemSchema)).default(DEFAULT_NAVIGATION),
  theme: siteThemeSchema.default(DEFAULT_SITE_THEME),
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
    showSecondaryCtas: z.boolean().default(false),
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
    showSection: z.boolean().default(false),
  }),
  blog: z.object({
    title: z.string().min(1),
    description: z.string(),
    cta: z.string().min(1),
    emptyMessage: z.string(),
    showSection: z.boolean().default(false),
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

/** Exact legacy CMS strings that leaked Studio instructions onto public pages. */
const LEGACY_INSTRUCTIONAL_BIO_SUBTITLES = new Set([
  'A short introduction to you and your work. Add a photo when you are ready.',
]);
const LEGACY_INSTRUCTIONAL_PORTFOLIO_SUBTITLES = new Set([
  'Selected works. Add categories and choose how images display from Site Content → Portfolio.',
]);

function clearLegacyInstructionalCopy(value: unknown, legacy: Set<string>): unknown {
  if (typeof value !== 'string') return value;
  return legacy.has(value.trim()) ? '' : value;
}

export const bioPageSchema = z.object({
  sectionOrder: z.preprocess(normalizeBioSectionOrder, z.array(z.enum(BIO_SECTION_KEYS))).default([...BIO_SECTION_KEYS]),
  hero: z.object({
    title: z.string().min(1),
    subtitle: z.preprocess(
      (value) => clearLegacyInstructionalCopy(value, LEGACY_INSTRUCTIONAL_BIO_SUBTITLES),
      z.string().default(''),
    ),
    portraitImage: optionalImage,
    portraitImageAlt: z.string().default(''),
    ctaPortfolio: z.string().default('View Portfolio'),
    ctaContact: z.string().default('Get in Touch'),
  }),
  statementTitle: z.string().min(1).default('Artist Statement'),
  backgroundTitle: z.string().min(1).default('Your path'),
  achievementsTitle: z.string().min(1).default('Shows & recognition'),
  studioTitle: z.string().min(1).default('How I work'),
  collectionsTitle: z.string().min(1).default('Collections & press'),
  artistStatementHtml: z.string(),
  backgroundHtml: z.string(),
  achievementsHtml: z.string(),
  studioPracticeHtml: z.string(),
  collectionsHtml: z.string(),
  studioImage: optionalImage,
  studioImageAlt: z.string().default(''),
  cta: z.object({
    title: z.string().min(1),
    subtitle: z.string(),
    portfolioLabel: z.string().default('Explore Portfolio'),
    shopLabel: z.string().default('Available Works'),
    contactLabel: z.string().default('Contact'),
  }),
  showStatement: z.boolean().default(true),
  showBackground: z.boolean().default(false),
  showAchievements: z.boolean().default(false),
  showStudio: z.boolean().default(false),
  showCollections: z.boolean().default(false),
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

const portfolioCategorySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  visible: z.boolean().default(true),
});

export type PortfolioCategory = z.infer<typeof portfolioCategorySchema>;

/** Lowercase kebab key for portfolio taxonomy — no regex, stable for freeform labels. */
export function normalizePortfolioCategoryKey(value: string): string {
  const lower = value.trim().toLowerCase();
  const chars: string[] = [];
  let pendingHyphen = false;
  for (const char of lower) {
    const isAlphaNum = (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9');
    if (isAlphaNum) {
      if (pendingHyphen && chars.length > 0) chars.push('-');
      chars.push(char);
      pendingHyphen = false;
    } else if (chars.length > 0) {
      pendingHyphen = true;
    }
  }
  return chars.join('') || 'category';
}

export function normalizePortfolioCategories(value: unknown): PortfolioCategory[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: PortfolioCategory[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const rawKey = typeof record.key === 'string' ? record.key : '';
    const rawLabel = typeof record.label === 'string' ? record.label : '';
    const key = normalizePortfolioCategoryKey(rawKey || rawLabel);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const label = rawLabel.trim() || key;
    result.push({
      key,
      label,
      visible: typeof record.visible === 'boolean' ? record.visible : true,
    });
  }

  return result;
}

/**
 * Ordered filter chips: configured visible categories first (even before artworks exist).
 * Unlisted artwork tags append only when includeUnlisted is true (Studio toggle),
 * so day-one artists can curate filters instead of inheriting every freeform tag.
 */
export function resolvePortfolioFilterCategories(
  artworkCategoryKeys: string[],
  configured: PortfolioCategory[],
  options?: { includeUnlisted?: boolean },
): Array<{ key: string; label: string }> {
  const artworkByKey = new Map<string, string>();
  for (const category of artworkCategoryKeys) {
    const trimmed = category.trim();
    if (!trimmed) continue;
    const key = normalizePortfolioCategoryKey(trimmed);
    if (!artworkByKey.has(key)) artworkByKey.set(key, trimmed);
  }

  const result: Array<{ key: string; label: string }> = [];
  const used = new Set<string>();

  for (const item of configured) {
    if (!item.visible) continue;
    const key = normalizePortfolioCategoryKey(item.key);
    used.add(key);
    result.push({
      key: artworkByKey.get(key) ?? item.key,
      label: item.label,
    });
  }

  if (options?.includeUnlisted !== true) return result;

  const leftovers = [...artworkByKey.entries()]
    .filter(([key]) => !used.has(key))
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }))
    .map(([, original]) => ({
      key: original,
      label: humanizeCategoryLabel(original),
    }));

  return [...result, ...leftovers];
}

/** Merge artwork tags into the configured category list without duplicating keys. */
export function mergePortfolioCategoriesFromTags(
  configured: PortfolioCategory[],
  artworkCategoryKeys: string[],
): PortfolioCategory[] {
  const next = [...configured];
  const seen = new Set(configured.map((item) => normalizePortfolioCategoryKey(item.key)));

  const sorted = [...artworkCategoryKeys]
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  for (const tag of sorted) {
    const key = normalizePortfolioCategoryKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({
      key,
      label: humanizeCategoryLabel(tag),
      visible: true,
    });
  }

  return next;
}

/** Common first-day category starters — labels only; keys derive from normalizePortfolioCategoryKey. */
export const PORTFOLIO_CATEGORY_STARTERS = [
  'Paintings',
  'Works on paper',
  'Sculpture',
  'Photography',
  'Digital',
  'Commissions',
] as const;

function humanizeCategoryLabel(value: string): string {
  const parts: string[] = [];
  let current = '';
  for (const char of value) {
    if (char === '-' || char === '_' || char === ' ') {
      if (current) {
        parts.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || value;
}

const DEFAULT_PORTFOLIO_LAYOUT = {
  gridColumns: '3' as const,
  showFilters: true,
  masonry: false,
  imageFit: 'cover' as const,
  thumbAspect: 'square' as const,
  showFeaturedBadge: true,
  showSoldBadge: true,
  showMeta: true,
  showPrice: false,
  includeUnlistedCategories: false,
};

export const portfolioPageSchema = listingPageSchema.extend({
  subtitle: z.preprocess(
    (value) => clearLegacyInstructionalCopy(value, LEGACY_INSTRUCTIONAL_PORTFOLIO_SUBTITLES),
    z.string().default(''),
  ),
  layout: z.object({
    gridColumns: portfolioGridColumnsSchema.default('3'),
    showFilters: z.boolean().default(true),
    masonry: z.boolean().default(false),
    imageFit: portfolioImageFitSchema.default('cover'),
    thumbAspect: portfolioThumbAspectSchema.default('square'),
    showFeaturedBadge: z.boolean().default(true),
    showSoldBadge: z.boolean().default(true),
    showMeta: z.boolean().default(true),
    showPrice: z.boolean().default(false),
    includeUnlistedCategories: z.boolean().default(false),
  }).default(DEFAULT_PORTFOLIO_LAYOUT),
  categories: z.preprocess(normalizePortfolioCategories, z.array(portfolioCategorySchema)).default([]),
  artworkDetailLayout: productDetailLayoutSchema.default('standard'),
});

export const shopPageSchema = listingPageSchema.extend({
  layout: z.object({
    gridColumns: portfolioGridColumnsSchema.default('3'),
    showFilters: z.boolean().default(true),
  }).default({ gridColumns: '3', showFilters: true }),
  searchPlaceholder: z.preprocess(
    (value) => (
      value === 'Search artworks, categories, or artists...'
        ? 'Search artworks by title, medium, or category…'
        : value
    ),
    z.string().default('Search artworks by title, medium, or category…'),
  ),
  showRecentlyViewed: z.boolean().default(false),
  showRecommendations: z.boolean().default(false),
  showPurchaseInfo: z.boolean().default(false),
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
    authenticityText: z.string().default('Original works ship with a signed note of authenticity from the studio.'),
    shippingTitle: z.string().default('Shipping'),
    shippingText: z.string().default('Carefully packaged and insured shipping worldwide. Domestic shipping starts at $15.'),
    commissionsTitle: z.string().default('Commissions'),
    commissionsText: z.string().default('Interested in a custom piece? Contact me to discuss commission opportunities.'),
    ctaLabel: z.string().default('Contact for Inquiries'),
  }).default({
    title: 'Purchase Information',
    authenticityTitle: 'Authenticity',
    authenticityText: 'Original works ship with a signed note of authenticity from the studio.',
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
  showRss: z.boolean().default(false),
  feedLayout: updatesFeedLayoutSchema.default('timeline'),
  showFormatFilters: z.boolean().default(false),
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

export type PostEngagementState = {
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
};

export type EngagementComment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  canRemove: boolean;
};

const UPDATES_FEED_COPY_KEYS = [
  'journalLabel',
  'studioLabel',
  'privateSectionTitle',
  'quickLookLabel',
  'saveUpdateLabel',
  'askArtistLabel',
  'featuredLabel',
  'showFeedDate',
  'showFeedAuthor',
  'showFeedTags',
  'showComments',
  'showLikes',
  'commentsLabel',
  'likeLabel',
] as const satisfies ReadonlyArray<keyof BlogPageContent>;

/** Updates page settings the feed, quick look, and post engagement read on the client. */
export type UpdatesFeedCopy = Pick<BlogPageContent, (typeof UPDATES_FEED_COPY_KEYS)[number]>;

export function updatesFeedCopy(blog: BlogPageContent): UpdatesFeedCopy {
  return Object.fromEntries(UPDATES_FEED_COPY_KEYS.map((key) => [key, blog[key]])) as UpdatesFeedCopy;
}

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
  siteName: 'Michal Elena',
  headerName: '',
  logoImage: '',
  tagline: 'created to create',
  footerTagline: 'From the studio in Milwaukee.',
  copyrightName: 'Michal Elena',
  navigation: DEFAULT_NAVIGATION,
  theme: DEFAULT_SITE_THEME,
  footer: {
    quickLinksHeading: 'Quick Links',
    legalHeading: 'Legal',
    showLegal: true,
    extraColumn: { show: false, heading: '', bodyHtml: '' },
  },
};

/** Catalog size at/under which shop filter chrome stays quiet (categories + availability only). */
export const QUIET_SHOP_CATALOG_LIMIT = 12;

export const DEFAULT_HOME_PAGE: HomePageContent = {
  layoutTemplate: 'classic',
  sectionOrder: [...HOME_SECTION_KEYS],
  hero: {
    titleLine1: 'created to',
    titleLine2: 'create',
    subtitle: 'Paintings, drawings, and handmade prints from Milwaukee.',
    ctaShop: 'Shop',
    ctaPortfolio: 'View Portfolio',
    ctaContact: 'Get in Touch',
    portraitImage: '/images/artist-portrait.jpg',
    height: 'compact',
    imagePlacement: 'inline',
    primaryCta: 'shop',
    showSecondaryCtas: false,
  },
  featured: {
    title: 'Featured Works',
    description: 'Recent pieces from the studio.',
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
    paragraph1: 'I make art to explore ideas — color, texture, memory, and the feeling of a place.',
    paragraph2: 'Working in acrylic, watercolor, and digital illustration from Milwaukee, I treat the studio like a journal and always find my way back to the work.',
    cta: 'Get in Touch',
    studioImage: '/images/artist-studio.jpg',
    showSection: false,
  },
  blog: {
    title: 'Latest updates',
    description: 'Studio notes, photos, short videos, and journal posts from the making of the work.',
    cta: 'See all updates →',
    emptyMessage: 'Updates coming soon...',
    showSection: false,
  },
  newsletter: {
    title: 'Studio notes',
    description: 'New work, market dates, and notes from the studio.',
    placeholder: 'Enter your email',
    buttonLabel: 'Subscribe',
    disclaimer: 'No spam, unsubscribe at any time.',
    showSection: true,
  },
};

/** Statement-first blank slate — no prestige CV filler for day-one artists. */
export const DEFAULT_BIO_PAGE: BioPageContent = {
  sectionOrder: ['statement', 'studio', 'background', 'achievements', 'collections', 'cta'],
  hero: {
    title: 'About',
    subtitle: '',
    portraitImage: '',
    portraitImageAlt: '',
    ctaPortfolio: 'View Portfolio',
    ctaContact: 'Get in Touch',
  },
  statementTitle: 'Artist Statement',
  backgroundTitle: 'Your path',
  achievementsTitle: 'Shows & recognition',
  studioTitle: 'How I work',
  collectionsTitle: 'Collections & press',
  studioImage: '',
  studioImageAlt: '',
  artistStatementHtml: '',
  backgroundHtml: '',
  achievementsHtml: '',
  studioPracticeHtml: '',
  collectionsHtml: '',
  cta: {
    title: 'Get in touch',
    subtitle: 'Questions about a piece, a print, or a commission? Reach out anytime.',
    portfolioLabel: 'Explore Portfolio',
    shopLabel: 'Available Works',
    contactLabel: 'Contact',
  },
  showStatement: true,
  showBackground: false,
  showAchievements: false,
  showStudio: false,
  showCollections: false,
  showCta: true,
};

export const DEFAULT_CONTACT_PAGE: ContactPageContent = {
  header: {
    title: 'Get in Touch',
    subtitle: 'Questions about a piece, a print, a commission, or just saying hello — write anytime.',
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
    connectText: 'I read every note — sales, commissions, markets, or a simple hello.',
    location: 'Milwaukee, WI',
    instagramHandle: '@michalelenaart',
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
      <p>I accept a limited number of commission projects each year. Choose <strong>Commission Request</strong> on the form and it will ask for:</p>
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
  subtitle: '',
  hero: { height: 'compact' },
  layout: { ...DEFAULT_PORTFOLIO_LAYOUT },
  categories: [],
  artworkDetailLayout: 'standard',
};

export const DEFAULT_SHOP_PAGE: ShopPageContent = {
  title: 'Shop',
  subtitle: 'Originals, prints, and small goods from the studio.',
  hero: { height: 'compact' },
  layout: { gridColumns: '3', showFilters: true },
  searchPlaceholder: 'Search artworks by title, medium, or category…',
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
  showRecentlyViewed: false,
  showRecommendations: false,
  showPurchaseInfo: false,
  purchaseInfo: {
    title: 'Purchase Information',
    authenticityTitle: 'Authenticity',
    authenticityText: 'Original works ship with a signed note of authenticity from the studio.',
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
  showRss: false,
  feedLayout: 'timeline',
  showFormatFilters: false,
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

/** The visual theme a look controls; page layouts stay with their own page tabs. */
export type SiteLookTheme = Omit<SiteTheme, 'artworkPalette'>;

export type SiteLookbookId =
  | 'gallery-wall'
  | 'night-opening'
  | 'warm-print'
  | 'compact-studio';

export type SiteLookbook = {
  id: SiteLookbookId;
  label: string;
  description: string;
  theme: SiteLookTheme;
};

export const SITE_LOOKBOOKS: readonly SiteLookbook[] = [
  {
    id: 'gallery-wall',
    label: 'Gallery wall',
    description: 'All white, flat frames, quiet type',
    theme: {
      primaryColor: '#111827',
      accentColor: '#6b7280',
      fontPreset: 'system',
      cardStyle: 'gallery',
      spacingDensity: 'compact',
      pageTone: 'white',
    },
  },
  {
    id: 'night-opening',
    label: 'Night opening',
    description: 'Deep navy, display serif, bold cards',
    theme: {
      primaryColor: '#0f172a',
      accentColor: '#0369a1',
      fontPreset: 'editorial',
      cardStyle: 'bold',
      spacingDensity: 'comfortable',
      pageTone: 'soft',
    },
  },
  {
    id: 'warm-print',
    label: 'Warm print shop',
    description: 'Umber on cream paper, book serif',
    theme: {
      primaryColor: '#78350f',
      accentColor: '#b45309',
      fontPreset: 'serif',
      cardStyle: 'studio',
      spacingDensity: 'comfortable',
      pageTone: 'warm',
    },
  },
  {
    id: 'compact-studio',
    label: 'Compact studio',
    description: 'Moss green, tight rhythm, clean type',
    theme: {
      primaryColor: '#365314',
      accentColor: '#4d7c0f',
      fontPreset: 'system',
      cardStyle: 'studio',
      spacingDensity: 'compact',
      pageTone: 'soft',
    },
  },
] as const;

/** Color-only starting points; each pair meets AA contrast on every page tone. */
export const THEME_PALETTES = [
  { name: 'Charcoal', primaryColor: DEFAULT_THEME_PRIMARY, accentColor: DEFAULT_THEME_ACCENT },
  { name: 'Ocean', primaryColor: '#1e3a5f', accentColor: '#1d4ed8' },
  { name: 'Terracotta', primaryColor: '#7c2d12', accentColor: '#c2410c' },
  { name: 'Sage', primaryColor: '#365314', accentColor: '#4d7c0f' },
  { name: 'Plum', primaryColor: '#581c87', accentColor: '#7e22ce' },
  { name: 'Rose', primaryColor: '#881337', accentColor: '#be123c' },
] as const;

/** Applies a look's visual theme; the artist's saved artwork palette is kept. */
export function applySiteLookbook(theme: SiteTheme, lookbookId: SiteLookbookId): SiteTheme {
  const lookbook = SITE_LOOKBOOKS.find((entry) => entry.id === lookbookId);
  if (!lookbook) return theme;
  return { ...lookbook.theme, artworkPalette: theme.artworkPalette };
}

function lookThemeMatches(look: SiteLookTheme, theme: SiteTheme): boolean {
  return (
    normalizeHexColor(theme.primaryColor, '').toLowerCase() === look.primaryColor.toLowerCase()
    && normalizeHexColor(theme.accentColor, '').toLowerCase() === look.accentColor.toLowerCase()
    && theme.fontPreset === look.fontPreset
    && theme.cardStyle === look.cardStyle
    && theme.spacingDensity === look.spacingDensity
    && theme.pageTone === look.pageTone
  );
}

/** Returns the look id when the theme still matches that look exactly, else null. */
export function detectSiteLookbook(theme: SiteTheme): SiteLookbookId | null {
  return SITE_LOOKBOOKS.find((lookbook) => lookThemeMatches(lookbook.theme, theme))?.id ?? null;
}

export const SITE_CONTENT_DEFAULTS = {
  identity: DEFAULT_SITE_IDENTITY,
  home: DEFAULT_HOME_PAGE,
  bio: DEFAULT_BIO_PAGE,
  contact: DEFAULT_CONTACT_PAGE,
  portfolio: DEFAULT_PORTFOLIO_PAGE,
  shop: DEFAULT_SHOP_PAGE,
  blog: DEFAULT_BLOG_PAGE,
} as const;
