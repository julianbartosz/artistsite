import { z } from 'zod';
import { visibleHtmlText } from '@/lib/site-content-shared';
import { emailButtonHtml, emailShellHtml, escapeHtml, isResendSandboxSender, normalizeEmailColor } from '@/lib/email-shell';

/** Marks EmailCampaign rows whose `content` is a block document (see `newsletterDocumentSchema`). */
export const NEWSLETTER_TEMPLATE_ID = 'newsletter-blocks';
export const NEWSLETTER_SEGMENT = 'newsletter_subscriber';

export const AUTOMATION_EMAIL_IDS = {
  newsletterWelcome: 'auto-newsletter-welcome',
  newsletterWelcomeFollowup: 'auto-newsletter-welcome-followup',
  collectorWinback: 'auto-collector-winback',
  cartRecovery: 'auto-cart-recovery',
} as const;

export type AutomationEmailId = (typeof AUTOMATION_EMAIL_IDS)[keyof typeof AUTOMATION_EMAIL_IDS];

const AUTOMATION_EMAIL_ID_SET = new Set<string>(Object.values(AUTOMATION_EMAIL_IDS));

export function isAutomationEmailId(value: string): value is AutomationEmailId {
  return AUTOMATION_EMAIL_ID_SET.has(value);
}

export type AutomationAudienceKind = 'subscriber' | 'checkout';

export type AutomationEmailDefinition = {
  id: AutomationEmailId;
  templateId: string;
  title: string;
  description: string;
  triggerSummary: string;
  settingKey:
    | 'NEWSLETTER_WELCOME_ENABLED'
    | 'NEWSLETTER_WELCOME_SERIES_ENABLED'
    | 'WINBACK_EMAIL_ENABLED'
    | 'CART_ABANDONMENT_ENABLED';
  defaultEnabled: boolean;
  requiresScheduler: boolean;
  audienceKind: AutomationAudienceKind;
};

export const AUTOMATION_EMAIL_CATALOG: readonly AutomationEmailDefinition[] = [
  {
    id: AUTOMATION_EMAIL_IDS.newsletterWelcome,
    templateId: 'automated-welcome',
    title: 'Welcome email',
    description: 'Sent immediately when someone joins your newsletter list.',
    triggerSummary: 'Instant on signup',
    settingKey: 'NEWSLETTER_WELCOME_ENABLED',
    defaultEnabled: true,
    requiresScheduler: false,
    audienceKind: 'subscriber',
  },
  {
    id: AUTOMATION_EMAIL_IDS.newsletterWelcomeFollowup,
    templateId: 'automated-welcome-followup',
    title: 'Day-3 studio follow-up',
    description: 'Sent 3 days after newsletter signup to share your portfolio and studio updates.',
    triggerSummary: '3 days after signup',
    settingKey: 'NEWSLETTER_WELCOME_SERIES_ENABLED',
    defaultEnabled: false,
    requiresScheduler: true,
    audienceKind: 'subscriber',
  },
  {
    id: AUTOMATION_EMAIL_IDS.collectorWinback,
    templateId: 'automated-winback',
    title: 'Collector win-back',
    description: 'Sent once to opted-in subscribers who have not visited or ordered recently.',
    triggerSummary: 'After quiet period',
    settingKey: 'WINBACK_EMAIL_ENABLED',
    defaultEnabled: false,
    requiresScheduler: true,
    audienceKind: 'subscriber',
  },
  {
    id: AUTOMATION_EMAIL_IDS.cartRecovery,
    templateId: 'automated-cart-recovery',
    title: 'Cart recovery',
    description: 'Sent 1 hour after someone enters their email at checkout without completing an order.',
    triggerSummary: '1 hour after abandoned checkout',
    settingKey: 'CART_ABANDONMENT_ENABLED',
    defaultEnabled: false,
    requiresScheduler: true,
    audienceKind: 'checkout',
  },
] as const;

export function getAutomationEmailDefinition(id: AutomationEmailId): AutomationEmailDefinition {
  return AUTOMATION_EMAIL_CATALOG.find((entry) => entry.id === id) ?? AUTOMATION_EMAIL_CATALOG[0];
}

const blockId = z.string().trim().min(1).max(64);
const text = (max: number) => z.string().max(max).default('');

export const newsletterBlockSchema = z.discriminatedUnion('type', [
  z.object({ id: blockId, type: z.literal('text'), html: z.string().max(100_000).default('') }),
  z.object({
    id: blockId,
    type: z.literal('image'),
    url: text(2000),
    alt: text(300),
    caption: text(300),
    href: text(2000),
  }),
  z.object({ id: blockId, type: z.literal('button'), label: text(80), href: text(2000) }),
  z.object({
    id: blockId,
    type: z.literal('product'),
    productId: text(200),
    title: text(200),
    imageUrl: text(2000),
    priceLabel: text(80),
    href: text(2000),
    ctaLabel: text(80),
  }),
  z.object({ id: blockId, type: z.literal('divider') }),
]);

export const newsletterDocumentSchema = z.object({
  subject: text(200),
  preheader: text(200),
  fromName: text(80),
  blocks: z.array(newsletterBlockSchema).max(40).default([]),
});

export type NewsletterBlock = z.infer<typeof newsletterBlockSchema>;
export type NewsletterBlockType = NewsletterBlock['type'];
export type NewsletterDocument = z.infer<typeof newsletterDocumentSchema>;

export const NEWSLETTER_BLOCK_LABELS: Record<NewsletterBlockType, string> = {
  text: 'Text',
  image: 'Image',
  button: 'Button',
  product: 'Artwork from shop',
  divider: 'Divider',
};

function newBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createNewsletterBlock(type: NewsletterBlockType): NewsletterBlock {
  const id = newBlockId();
  switch (type) {
    case 'text':
      return { id, type, html: '<p></p>' };
    case 'image':
      return { id, type, url: '', alt: '', caption: '', href: '' };
    case 'button':
      return { id, type, label: '', href: '' };
    case 'product':
      return { id, type, productId: '', title: '', imageUrl: '', priceLabel: '', href: '', ctaLabel: 'View artwork' };
    case 'divider':
      return { id, type };
  }
}

export function createNewsletterDraft(): NewsletterDocument {
  return {
    subject: '',
    preheader: '',
    fromName: '',
    blocks: [{ ...createNewsletterBlock('text'), html: '<p>Hi {{first_name}},</p><p></p>' } as NewsletterBlock],
  };
}

/**
 * Reads a stored campaign `content` value. Block documents parse directly; campaigns authored
 * before block documents (`{ subject, html }`) become a single text block.
 */
export function newsletterDocumentFromContent(content: unknown): NewsletterDocument {
  const record = content && typeof content === 'object' && !Array.isArray(content)
    ? content as Record<string, unknown>
    : {};
  if (Array.isArray(record.blocks)) {
    const parsed = newsletterDocumentSchema.safeParse(record);
    if (parsed.success) return parsed.data;
  }
  const subject = typeof record.subject === 'string' ? record.subject.slice(0, 200) : '';
  const html = typeof record.html === 'string' ? record.html : '';
  return {
    subject,
    preheader: '',
    fromName: '',
    blocks: html.trim()
      ? [{ id: 'legacy-body', type: 'text', html: html.split('{{customer_name}}').join('{{first_name}}') }]
      : [],
  };
}

// ---------------------------------------------------------------------------
// Personalization
// ---------------------------------------------------------------------------

export const NEWSLETTER_MERGE_FIELDS = [
  { key: 'first_name', label: 'First name', fallback: 'there' },
  { key: 'email', label: 'Email address', fallback: '' },
  { key: 'site_name', label: 'Studio name', fallback: '' },
  { key: 'site_url', label: 'Website address', fallback: '' },
] as const;

export const CART_RECOVERY_MERGE_FIELDS = [
  ...NEWSLETTER_MERGE_FIELDS,
  { key: 'checkout_url', label: 'Checkout link', fallback: '/checkout' },
  { key: 'promo_code', label: 'Promo code', fallback: '' },
] as const;

export type NewsletterMergeFieldOption = {
  readonly key: string;
  readonly label: string;
  readonly fallback: string;
};

export type NewsletterMergeKey =
  | (typeof CART_RECOVERY_MERGE_FIELDS)[number]['key']
  | 'unsubscribe_url';
export type NewsletterMergeValues = Partial<Record<NewsletterMergeKey, string>>;

const NEWSLETTER_MERGE_KEY_SET = new Set<string>([
  ...NEWSLETTER_MERGE_FIELDS.map((field) => field.key),
  'unsubscribe_url',
]);

const CART_RECOVERY_MERGE_KEY_SET = new Set<string>([
  ...CART_RECOVERY_MERGE_FIELDS.map((field) => field.key),
  'unsubscribe_url',
]);

const URL_MERGE_KEYS = new Set<string>(['checkout_url', 'site_url', 'unsubscribe_url']);

const MERGE_FIELD_FALLBACKS = new Map<string, string>([
  ...CART_RECOVERY_MERGE_FIELDS.map((field) => [field.key, field.fallback] as [string, string]),
  ['unsubscribe_url', '#'],
]);

export function mergeFieldsForAudience(audienceKind: AutomationAudienceKind = 'subscriber'): readonly NewsletterMergeFieldOption[] {
  return audienceKind === 'checkout' ? CART_RECOVERY_MERGE_FIELDS : NEWSLETTER_MERGE_FIELDS;
}

export function allowedMergeKeysForAudience(audienceKind: AutomationAudienceKind = 'subscriber'): ReadonlySet<string> {
  return audienceKind === 'checkout' ? CART_RECOVERY_MERGE_KEY_SET : NEWSLETTER_MERGE_KEY_SET;
}

export function mergeFieldToken(key: string): string {
  return `{{${key}}}`;
}

type MergeSegment =
  | { kind: 'text'; value: string }
  | { kind: 'field'; key: string; fallback: string | null; raw: string };

function parseMergeTemplate(input: string): MergeSegment[] {
  const segments: MergeSegment[] = [];
  let cursor = 0;
  while (cursor < input.length) {
    const open = input.indexOf('{{', cursor);
    if (open === -1) break;
    const close = input.indexOf('}}', open + 2);
    if (close === -1) break;
    if (open > cursor) segments.push({ kind: 'text', value: input.slice(cursor, open) });
    const inner = input.slice(open + 2, close);
    const bar = inner.indexOf('|');
    segments.push({
      kind: 'field',
      key: (bar === -1 ? inner : inner.slice(0, bar)).trim().toLowerCase(),
      fallback: bar === -1 ? null : inner.slice(bar + 1).trim(),
      raw: input.slice(open, close + 2),
    });
    cursor = close + 2;
  }
  if (cursor < input.length) segments.push({ kind: 'text', value: input.slice(cursor) });
  return segments;
}

/**
 * Replaces `{{field}}` / `{{field|fallback}}` tokens. In `html` mode values are escaped and
 * fallbacks are used verbatim because they were authored inside (already escaped) HTML.
 * Unknown fields are left untouched so readiness checks can surface them.
 */
export function applyMergeFields(input: string, values: NewsletterMergeValues, mode: 'html' | 'text'): string {
  return parseMergeTemplate(input).map((segment) => {
    if (segment.kind === 'text') return segment.value;
    if (!MERGE_FIELD_FALLBACKS.has(segment.key)) return segment.raw;
    const value = values[segment.key as NewsletterMergeKey]?.trim();
    if (value) return mode === 'html' ? escapeHtml(value) : value;
    if (segment.fallback !== null) return segment.fallback;
    const fallback = MERGE_FIELD_FALLBACKS.get(segment.key) || '';
    return mode === 'html' ? escapeHtml(fallback) : fallback;
  }).join('');
}

function unknownMergeTokens(input: string, allowedKeys: ReadonlySet<string>): string[] {
  return parseMergeTemplate(input)
    .filter((segment): segment is Extract<MergeSegment, { kind: 'field' }> => segment.kind === 'field')
    .filter((segment) => !allowedKeys.has(segment.key))
    .map((segment) => segment.raw);
}

/** Default block document for each built-in automation email (used until the artist customizes it). */
export function buildDefaultAutomationDocument(
  id: AutomationEmailId,
  options: { siteName: string; promoCode?: string } = { siteName: 'Studio' },
): NewsletterDocument {
  const siteName = options.siteName.trim() || 'Studio';
  const promoCode = options.promoCode?.trim() || '';

  switch (id) {
    case AUTOMATION_EMAIL_IDS.newsletterWelcome:
      return {
        subject: `Welcome to ${siteName}`,
        preheader: 'Studio notes, new work, and first access before releases open.',
        fromName: siteName,
        blocks: [
          {
            id: 'welcome-intro',
            type: 'text',
            html: `<p>Hi {{first_name|there}},</p><p>Thank you for joining the ${escapeHtml(siteName)} newsletter. You will hear first about new original pieces, limited print editions, exhibitions, and studio notes.</p><p>In the meantime, feel free to explore what is currently available.</p>`,
          },
          {
            id: 'welcome-cta',
            type: 'button',
            label: 'Explore available works',
            href: '/shop',
          },
        ],
      };

    case AUTOMATION_EMAIL_IDS.newsletterWelcomeFollowup:
      return {
        subject: `Inside the studio at ${siteName}`,
        preheader: 'A closer look at recent works, process notes, and available pieces.',
        fromName: siteName,
        blocks: [
          {
            id: 'followup-intro',
            type: 'text',
            html: `<p>Hi {{first_name|there}},</p><p>A quick studio note since you joined ${escapeHtml(siteName)}. If you are exploring pieces for a space or curious about commissions, you can browse the full <a href="/portfolio">portfolio</a> or see recent <a href="/updates">studio updates</a>.</p><p>Reply anytime if a particular work catches your eye.</p>`,
          },
          {
            id: 'followup-cta',
            type: 'button',
            label: 'View the portfolio',
            href: '/portfolio',
          },
        ],
      };

    case AUTOMATION_EMAIL_IDS.collectorWinback:
      return {
        subject: `New from ${siteName}`,
        preheader: 'Recent pieces and updates from the studio.',
        fromName: siteName,
        blocks: [
          {
            id: 'winback-intro',
            type: 'text',
            html: `<p>Hi {{first_name|there}},</p><p>It has been a little while since we last caught up. New works and limited prints have been added to ${escapeHtml(siteName)} recently. Take a look whenever you have a quiet moment.</p><p>If you are looking for a specific size or palette, reply to this email or send a note through <a href="/contact">the studio contact page</a>.</p>`,
          },
          {
            id: 'winback-cta',
            type: 'button',
            label: 'See what is new',
            href: '/shop',
          },
        ],
      };

    case AUTOMATION_EMAIL_IDS.cartRecovery: {
      const promoLine = promoCode
        ? `<p>If it helps, use code <strong>{{promo_code}}</strong> at checkout.</p>`
        : '';
      return {
        subject: `Still thinking it over? Your piece is waiting at ${siteName}`,
        preheader: 'Return to checkout whenever you are ready.',
        fromName: siteName,
        blocks: [
          {
            id: 'cart-intro',
            type: 'text',
            html: `<p>Hi {{first_name|there}},</p><p>You left artwork waiting at checkout on ${escapeHtml(siteName)}. Original works and limited editions can go quickly, so your link is ready whenever you would like to finish your order.</p>${promoLine}<p>Have a question about framing, shipping, or dimensions? Just reply to this email.</p>`,
          },
          {
            id: 'cart-cta',
            type: 'button',
            label: 'Return to checkout',
            href: '{{checkout_url}}',
          },
        ],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export type NewsletterRenderContext = {
  siteName: string;
  siteUrl: string;
  primaryColor: string;
  footerAddress: string;
  /** Optional override for the footer explanation line (e.g. cart recovery checkout reminder). */
  footerReason?: string;
  /** Whether to include the newsletter unsubscribe link in the footer (default: true). */
  includeUnsubscribe?: boolean;
};

export type RenderedNewsletter = { subject: string; html: string; text: string };

export { escapeHtml };

type UrlCheck = { url: string } | { problem: 'needs-site-url' | 'invalid' };

function isSingleUrlMergeToken(value: string): boolean {
  const segments = parseMergeTemplate(value);
  return segments.length === 1 && segments[0].kind === 'field' && URL_MERGE_KEYS.has(segments[0].key);
}

/** Accepts absolute http(s)/mailto URLs, site-relative paths, and URL merge tokens (`{{checkout_url}}`, `{{site_url}}`). */
export function resolveNewsletterUrl(value: string, siteUrl: string, allowMailto = true): UrlCheck {
  const trimmed = value.trim();
  if (isSingleUrlMergeToken(trimmed)) {
    return { url: trimmed };
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    if (!siteUrl) return { problem: 'needs-site-url' };
    const base = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    return { url: `${base}${trimmed}` };
  }
  try {
    const parsed = new URL(trimmed);
    const allowed = parsed.protocol === 'https:' || parsed.protocol === 'http:' || (allowMailto && parsed.protocol === 'mailto:');
    return allowed ? { url: trimmed } : { problem: 'invalid' };
  } catch {
    return { problem: 'invalid' };
  }
}

function resolvedUrl(value: string, siteUrl: string, allowMailto = true): string | null {
  const check = resolveNewsletterUrl(value, siteUrl, allowMailto);
  return 'url' in check ? check.url : null;
}

function textBlockHasContent(html: string): boolean {
  return visibleHtmlText(html).length > 0 || html.includes('<img');
}

function blockHasContent(block: NewsletterBlock): boolean {
  switch (block.type) {
    case 'text':
      return textBlockHasContent(block.html);
    case 'image':
      return Boolean(block.url.trim());
    case 'button':
      return Boolean(block.label.trim() || block.href.trim());
    case 'product':
      return Boolean(block.productId.trim());
    case 'divider':
      return false;
  }
}

function blockHtml(block: NewsletterBlock, context: NewsletterRenderContext, color: string): string {
  switch (block.type) {
    case 'text':
      return textBlockHasContent(block.html) ? `<div class="nl-text">${absoluteRichText(block.html, context.siteUrl)}</div>` : '';
    case 'image': {
      const src = resolvedUrl(block.url, context.siteUrl, false);
      if (!src) return '';
      const image = `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt.trim())}" width="520" style="display:block;width:100%;max-width:520px;height:auto;margin:0 auto;border:0;border-radius:8px;">`;
      const href = block.href.trim() ? resolvedUrl(block.href, context.siteUrl) : null;
      const caption = block.caption.trim()
        ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.5;color:#6b7280;text-align:center;">${escapeHtml(block.caption.trim())}</p>`
        : '';
      return `${href ? `<a href="${escapeHtml(href)}">${image}</a>` : image}${caption}`;
    }
    case 'button': {
      const href = resolvedUrl(block.href, context.siteUrl);
      return href && block.label.trim() ? emailButtonHtml(block.label.trim(), href, color) : '';
    }
    case 'product': {
      if (!block.productId.trim()) return '';
      const href = resolvedUrl(block.href, context.siteUrl);
      const src = block.imageUrl.trim() ? resolvedUrl(block.imageUrl, context.siteUrl, false) : null;
      const image = src
        ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.title)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;margin:0 auto 16px;border:0;border-radius:8px;">`
        : '';
      const linkedImage = image && href ? `<a href="${escapeHtml(href)}">${image}</a>` : image;
      const price = block.priceLabel.trim()
        ? `<p style="margin:4px 0 0;font-size:15px;color:#6b7280;">${escapeHtml(block.priceLabel.trim())}</p>`
        : '';
      const cta = href ? `<div style="margin-top:16px;">${emailButtonHtml(block.ctaLabel.trim() || 'View artwork', href, color)}</div>` : '';
      return `<div style="text-align:center;">${linkedImage}<p style="margin:0;font-size:18px;font-weight:600;line-height:1.35;color:#111827;">${escapeHtml(block.title)}</p>${price}${cta}</div>`;
    }
    case 'divider':
      return '<hr style="border:0;border-top:1px solid #e5e7eb;margin:8px 0;">';
  }
}

const BLOCK_BREAK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote', 'figure', 'figcaption']);
const HTML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(value: string): string {
  let output = '';
  let cursor = 0;
  while (cursor < value.length) {
    const amp = value.indexOf('&', cursor);
    if (amp === -1) break;
    const semi = value.indexOf(';', amp + 1);
    if (semi === -1 || semi - amp > 10) {
      output += value.slice(cursor, amp + 1);
      cursor = amp + 1;
      continue;
    }
    const name = value.slice(amp + 1, semi);
    let decoded: string | null = HTML_ENTITIES[name.toLowerCase()] ?? null;
    if (decoded === null && name.startsWith('#')) {
      const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      decoded = Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : null;
    }
    output += value.slice(cursor, amp) + (decoded ?? value.slice(amp, semi + 1));
    cursor = semi + 1;
  }
  return output + value.slice(cursor);
}

function tagName(tag: string): string {
  const body = (tag.startsWith('/') ? tag.slice(1) : tag).trimStart();
  let end = 0;
  while (end < body.length && body[end].trim() !== '' && body[end] !== '/') end += 1;
  return body.slice(0, end).toLowerCase();
}

/** Character range of a quoted attribute value inside a tag body, matching whole attribute names only. */
function attributeRange(tag: string, attribute: string): { start: number; end: number } | null {
  const lower = tag.toLowerCase();
  const needle = `${attribute}=`;
  for (let index = lower.indexOf(needle); index !== -1; index = lower.indexOf(needle, index + 1)) {
    if (index > 0 && lower[index - 1].trim() !== '') continue;
    const quote = tag[index + needle.length];
    if (quote !== '"' && quote !== "'") return null;
    const start = index + needle.length + 1;
    const end = tag.indexOf(quote, start);
    return end === -1 ? null : { start, end };
  }
  return null;
}

function attributeValue(tag: string, attribute: string): string | null {
  const range = attributeRange(tag, attribute);
  return range ? tag.slice(range.start, range.end) : null;
}

type RichTextUrl = { value: string; kind: 'link' | 'image' };

/** Rewrites every link href and image src in rich text through `map` (values are decoded/re-escaped). */
function mapRichTextUrls(html: string, map: (url: RichTextUrl) => string): string {
  let output = '';
  let cursor = 0;
  while (cursor < html.length) {
    const open = html.indexOf('<', cursor);
    const close = open === -1 ? -1 : html.indexOf('>', open);
    if (close === -1) break;
    const tag = html.slice(open + 1, close);
    const name = tagName(tag);
    const kind = name === 'a' ? 'link' : name === 'img' ? 'image' : null;
    const range = kind && !tag.startsWith('/') ? attributeRange(tag, kind === 'link' ? 'href' : 'src') : null;
    output += html.slice(cursor, open + 1);
    output += range && kind
      ? `${tag.slice(0, range.start)}${escapeHtml(map({ value: decodeEntities(tag.slice(range.start, range.end)), kind }))}${tag.slice(range.end)}`
      : tag;
    output += '>';
    cursor = close + 1;
  }
  return output + html.slice(cursor);
}

function richTextUrls(html: string): RichTextUrl[] {
  const urls: RichTextUrl[] = [];
  mapRichTextUrls(html, (url) => {
    urls.push(url);
    return url.value;
  });
  return urls;
}

/** Site paths in rich text become absolute so they work from an inbox; merge-field URLs resolve later. */
function absoluteRichText(html: string, siteUrl: string): string {
  return mapRichTextUrls(html, ({ value, kind }) => (
    value.includes('{{') ? value : resolvedUrl(value, siteUrl, kind === 'link') ?? value
  ));
}

/** Plain-text alternative for rich text: paragraphs, list bullets, and link targets survive. */
export function htmlToPlainText(html: string): string {
  let output = '';
  const linkStack: Array<string | null> = [];
  let linkTextStart = 0;
  let cursor = 0;
  while (cursor < html.length) {
    const open = html.indexOf('<', cursor);
    if (open === -1) {
      output += html.slice(cursor);
      break;
    }
    output += html.slice(cursor, open);
    const close = html.indexOf('>', open);
    if (close === -1) {
      output += html.slice(open);
      break;
    }
    const tag = html.slice(open + 1, close);
    const closing = tag.startsWith('/');
    const name = tagName(tag);
    if (name === 'br') output += '\n';
    else if (name === 'li' && !closing) output += '\n- ';
    else if (BLOCK_BREAK_TAGS.has(name)) output += '\n\n';
    else if (name === 'a' && !closing) {
      linkStack.push(attributeValue(tag, 'href'));
      linkTextStart = output.length;
    } else if (name === 'a' && closing) {
      const href = linkStack.pop();
      const label = decodeEntities(output.slice(linkTextStart)).trim();
      const target = href ? decodeEntities(href) : '';
      if (target && target !== label) output += ` (${target})`;
    }
    cursor = close + 1;
  }
  return collapseText(decodeEntities(output));
}

function collapseText(value: string): string {
  const lines = value.split('\n').map((line) => line.split(' ').filter(Boolean).join(' '));
  const kept: string[] = [];
  for (const line of lines) {
    if (!line && (kept.length === 0 || kept[kept.length - 1] === '')) continue;
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop();
  return kept.join('\n');
}

function blockText(block: NewsletterBlock, context: NewsletterRenderContext): string {
  switch (block.type) {
    case 'text':
      return textBlockHasContent(block.html) ? htmlToPlainText(absoluteRichText(block.html, context.siteUrl)) : '';
    case 'image': {
      const href = block.href.trim() ? resolvedUrl(block.href, context.siteUrl) : null;
      const caption = block.caption.trim() || block.alt.trim();
      return [caption, href].filter(Boolean).join('\n');
    }
    case 'button': {
      const href = resolvedUrl(block.href, context.siteUrl);
      return href && block.label.trim() ? `${block.label.trim()}: ${href}` : '';
    }
    case 'product': {
      if (!block.productId.trim()) return '';
      const href = resolvedUrl(block.href, context.siteUrl);
      return [[block.title, block.priceLabel.trim()].filter(Boolean).join(': '), href].filter(Boolean).join('\n');
    }
    case 'divider':
      return '---';
  }
}

/**
 * Renders the shared email template. Merge tokens (including `{{unsubscribe_url}}`) stay in the
 * output so one render can be personalized per recipient with `personalizeNewsletter`.
 */
export function renderNewsletter(document: NewsletterDocument, context: NewsletterRenderContext): RenderedNewsletter {
  const color = normalizeEmailColor(context.primaryColor);
  const siteName = context.siteName.trim() || 'Studio';
  const siteHref = context.siteUrl ? resolvedUrl(context.siteUrl, '') : null;
  const subject = document.subject.trim();
  const preheader = document.preheader.trim();
  const address = context.footerAddress.trim();

  const blocks = document.blocks
    .map((block) => blockHtml(block, context, color))
    .filter(Boolean)
    .map((html) => `<div style="margin:0 0 28px;">${html}</div>`)
    .join('');

  const includeUnsubscribe = context.includeUnsubscribe !== false;
  const footerReason = context.footerReason?.trim() || `You are receiving this because you subscribed to ${siteName}.`;
  const footerLinesHtml = [
    escapeHtml(footerReason),
    includeUnsubscribe ? '<a href="{{unsubscribe_url}}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>' : '',
    address ? escapeHtml(address) : '',
  ].filter(Boolean);
  const footerLinesText = [
    footerReason,
    includeUnsubscribe ? 'Unsubscribe: {{unsubscribe_url}}' : '',
    address,
  ].filter(Boolean);

  const html = emailShellHtml({
    brand: { siteName, siteUrl: siteHref ?? '', primaryColor: color },
    title: subject,
    preheader,
    bodyHtml: blocks,
    footerHtml: footerLinesHtml.join('<br>\n'),
    extraCss: `.nl-text p{margin:0 0 16px;}
.nl-text p:last-child{margin-bottom:0;}
.nl-text h1,.nl-text h2,.nl-text h3{margin:28px 0 12px;line-height:1.25;color:#111827;}
.nl-text h2{font-size:22px;}
.nl-text ul,.nl-text ol{margin:0 0 16px;padding-left:24px;}
.nl-text li{margin:0 0 6px;}
.nl-text a{color:${color};}
.nl-text img{max-width:100%;height:auto;border-radius:8px;}`,
  });

  const body = document.blocks.map((block) => blockText(block, context)).filter(Boolean).join('\n\n');
  const text = [
    siteName,
    body,
    `--\n${footerLinesText.join('\n')}`,
  ].filter(Boolean).join('\n\n');

  return { subject, html, text };
}

export function personalizeNewsletter(rendered: RenderedNewsletter, values: NewsletterMergeValues): RenderedNewsletter {
  return {
    subject: applyMergeFields(rendered.subject, values, 'text'),
    html: applyMergeFields(rendered.html, values, 'html'),
    text: applyMergeFields(rendered.text, values, 'text'),
  };
}

export function newsletterMergeValues(
  recipient: { email: string; firstName?: string | null },
  context: NewsletterRenderContext,
  unsubscribeUrl: string,
  extra?: Partial<Pick<NewsletterMergeValues, 'checkout_url' | 'promo_code'>>,
): NewsletterMergeValues {
  return {
    first_name: recipient.firstName?.trim() || '',
    email: recipient.email,
    site_name: context.siteName,
    site_url: context.siteUrl,
    unsubscribe_url: unsubscribeUrl,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Admin API shapes
// ---------------------------------------------------------------------------

export type NewsletterStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';

export type NewsletterSummary = {
  id: string;
  status: NewsletterStatus;
  document: NewsletterDocument;
  scheduledAt: string | null;
  sentAt: string | null;
  updatedAt: string;
  /** Totals from the delivery ledger; `total` is the planned audience while sending. */
  metrics: { total: number; delivered: number; failed: number; lastError?: string };
  /** False once any subscriber has received it or while it is sending. */
  editable: boolean;
};

export type AutomationEmailSummary = {
  id: AutomationEmailId;
  title: string;
  description: string;
  triggerSummary: string;
  settingKey: AutomationEmailDefinition['settingKey'];
  enabled: boolean;
  requiresScheduler: boolean;
  audienceKind: AutomationAudienceKind;
  customized: boolean;
  document: NewsletterDocument;
  defaultDocument: NewsletterDocument;
  updatedAt: string | null;
  metrics: { delivered: number; failed: number; lastSentAt: string | null };
  /** Optional automation-specific settings surfaced inline in the editor. */
  winbackDays?: number;
  cartRecoveryPromoCode?: string;
};

export type NewsletterAdminContext = NewsletterRenderContext & {
  subscriberCount: number;
  deliveryMode: NewsletterDeliveryMode;
  fromAddress: string;
  replyTo: string;
  schedulingAvailable: boolean;
  testRecipient: { email: string; firstName: string };
};

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export type NewsletterIssue = { key: string; message: string; blockId?: string };

export type NewsletterDeliveryMode = 'smtp' | 'log' | 'unconfigured';

export type NewsletterSendContext = NewsletterRenderContext & {
  subscriberCount: number;
  deliveryMode: NewsletterDeliveryMode;
  fromAddress?: string;
};

function urlIssue(
  value: string,
  siteUrl: string,
  key: string,
  label: string,
  blockId: string,
  allowMailto = true,
): NewsletterIssue | null {
  const check = resolveNewsletterUrl(value, siteUrl, allowMailto);
  if ('url' in check) return null;
  if (check.problem === 'needs-site-url') {
    return { key, blockId, message: `${label} uses a site path. Set your public site URL in Settings so it works in email.` };
  }
  return { key, blockId, message: `${label} needs a full link starting with https:// or a site path like /shop.` };
}

/** Problems that make the email itself wrong. Test sends and real sends both require none. */
export function newsletterContentIssues(
  document: NewsletterDocument,
  context: Pick<NewsletterRenderContext, 'siteUrl'>,
  options?: { audienceKind?: AutomationAudienceKind },
): NewsletterIssue[] {
  const audienceKind = options?.audienceKind ?? 'subscriber';
  const allowedKeys = allowedMergeKeysForAudience(audienceKind);
  const availableFields = mergeFieldsForAudience(audienceKind);
  const issues: NewsletterIssue[] = [];
  if (!document.subject.trim()) issues.push({ key: 'subject', message: 'Add a subject line.' });
  if (!document.blocks.some(blockHasContent)) {
    issues.push({ key: 'content', message: 'Add some content — text, an image, a button, or an artwork.' });
  }

  document.blocks.forEach((block, index) => {
    const label = `${NEWSLETTER_BLOCK_LABELS[block.type]} block ${index + 1}`;
    if (block.type === 'text') {
      const urls = richTextUrls(block.html).filter((url) => !url.value.includes('{{'));
      for (const kind of ['link', 'image'] as const) {
        const issue = urls
          .filter((url) => url.kind === kind)
          .map((url) => urlIssue(url.value, context.siteUrl, `text-${kind}-${block.id}`, `A ${kind} in ${label.toLowerCase()}`, block.id, kind === 'link'))
          .find(Boolean);
        if (issue) issues.push(issue);
      }
    }
    if (block.type === 'image' && block.url.trim()) {
      const issue = urlIssue(block.url, context.siteUrl, `image-${block.id}`, `${label} image`, block.id, false);
      if (issue) issues.push(issue);
      if (block.href.trim()) {
        const linkIssue = urlIssue(block.href, context.siteUrl, `image-link-${block.id}`, `${label} link`, block.id);
        if (linkIssue) issues.push(linkIssue);
      }
    }
    if (block.type === 'button' && blockHasContent(block)) {
      if (!block.label.trim() || !block.href.trim()) {
        issues.push({ key: `button-${block.id}`, blockId: block.id, message: `${label} needs both a label and a link.` });
      } else {
        const issue = urlIssue(block.href, context.siteUrl, `button-${block.id}`, label, block.id);
        if (issue) issues.push(issue);
      }
    }
    if (block.type === 'product') {
      if (!block.productId.trim()) {
        issues.push({ key: `product-${block.id}`, blockId: block.id, message: `${label}: choose an artwork or remove the block.` });
      } else {
        const issue = urlIssue(block.href, context.siteUrl, `product-${block.id}`, label, block.id);
        if (issue) issues.push(issue);
      }
    }
  });

  const tokenSources = [
    document.subject,
    document.preheader,
    ...document.blocks.flatMap((block) => {
      switch (block.type) {
        case 'text': return [block.html];
        case 'image': return [block.caption, block.alt, block.href];
        case 'button': return [block.label, block.href];
        case 'product': return [block.ctaLabel];
        case 'divider': return [];
      }
    }),
  ];
  const unknown = Array.from(new Set(tokenSources.flatMap((source) => unknownMergeTokens(source, allowedKeys))));
  for (const token of unknown) {
    issues.push({
      key: `field-${token}`,
      message: `${token} is not a personalization field. Use ${availableFields.map((field) => mergeFieldToken(field.key)).join(', ')}.`,
    });
  }
  return issues;
}

/** Everything `newsletterContentIssues` checks, plus what a real send to subscribers needs. */
export function newsletterSendIssues(document: NewsletterDocument, context: NewsletterSendContext): NewsletterIssue[] {
  const issues = newsletterContentIssues(document, context);
  if (!context.siteUrl) {
    issues.push({ key: 'site-url', message: 'Set your public site URL in Settings so unsubscribe links work.' });
  }
  if (!context.footerAddress.trim()) {
    issues.push({ key: 'address', message: 'Add a mailing address for the newsletter footer in Settings (required by anti-spam law).' });
  }
  if (context.deliveryMode === 'log') {
    issues.push({ key: 'delivery', message: 'Email delivery is in log mode. Switch to SMTP in Settings to reach inboxes.' });
  } else if (context.deliveryMode === 'unconfigured') {
    issues.push({ key: 'delivery', message: 'Finish SMTP setup in Settings → Email delivery before sending.' });
  } else if (isResendSandboxSender(context.fromAddress)) {
    issues.push({ key: 'sandbox-sender', message: 'From address uses Resend sandbox (onboarding@resend.dev), which cannot deliver to subscribers. Update it in Settings → Email delivery.' });
  }
  if (context.subscriberCount <= 0) {
    issues.push({ key: 'audience', message: 'You have no subscribers yet.' });
  }
  return issues;
}
