import { z } from 'zod';
import { htmlHasVisibleText, sanitizeRichHtml } from '@/lib/content-sanitize';
import { normalizeProduct, PRODUCT_IMAGE_FALLBACK } from '@/lib/commerce';
import { isVideoUrl } from '@/lib/image-variant-url';
import { resolvePublicAssetUrl } from '@/lib/public-asset';
import {
  NEWSLETTER_SEGMENT,
  NEWSLETTER_TEMPLATE_ID,
  type NewsletterBlock,
  type NewsletterDocument,
} from '@/lib/newsletter';

const ARTWORK_IMAGE_FALLBACK = PRODUCT_IMAGE_FALLBACK;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${Date.now()}`;
}

const stringArray = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}, z.array(z.string()));

export const productPayloadSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().default(''),
  price: z.coerce.number().min(0),
  currency: z.string().default('USD'),
  category: z.string().min(1),
  medium: z.string().default(''),
  dimensions: z.string().default(''),
  year: z.coerce.number().int().default(new Date().getFullYear()),
  availability: z.enum(['available', 'sold', 'reserved', 'commissioned']).default('available'),
  featured: z.coerce.boolean().default(false),
  images: z.object({
    thumbnail: z.string().default(''),
    gallery: stringArray.default([]),
  }),
  tags: stringArray.default([]),
  shipping: z.object({
    domestic: z.coerce.number().min(0).default(0),
    international: z.coerce.number().min(0).default(0),
    domesticEnabled: z.coerce.boolean().optional(),
    internationalEnabled: z.coerce.boolean().optional(),
  }),
  specifications: z.object({
    framed: z.coerce.boolean().default(false),
    signed: z.coerce.boolean().default(true),
    certificate: z.coerce.boolean().default(true),
  }),
  variants: z.unknown().optional(),
  customizations: z.unknown().optional(),
  relatedProducts: stringArray.optional(),
  bundle: z.unknown().optional(),
  commissionInfo: z.object({
    available: z.coerce.boolean(),
    estimatedDays: z.coerce.number().int().min(1, 'Estimated days must be at least 1'),
    priceRange: z.object({
      min: z.coerce.number().min(0, 'Commission minimum price cannot be negative'),
      max: z.coerce.number().min(0, 'Commission maximum price cannot be negative'),
    }),
    requiresConsultation: z.coerce.boolean().default(true),
  }).nullable().optional(),
  edition: z.object({
    total: z.coerce.number().int().min(1),
    remaining: z.coerce.number().int().min(0).optional(),
  }).nullable().optional(),
  initialStock: z.coerce.number().int().min(0).optional(),
});

export function isPublishableContentTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length >= 3 && trimmed.toLowerCase() !== 'untitled';
}

/** @deprecated Use isPublishableContentTitle */
export const isPublishableBlogTitle = isPublishableContentTitle;

export const POST_FORMATS = ['article', 'short'] as const;
export const POST_PROCESS_STAGES = ['sketch', 'glaze', 'finished', 'other'] as const;
export type PostProcessStage = (typeof POST_PROCESS_STAGES)[number];

export type PostMeta = {
  pullQuote?: string;
  location?: string;
  processStage?: PostProcessStage;
};
export const POST_VISIBILITIES = ['public', 'private'] as const;

export type PostFormat = (typeof POST_FORMATS)[number];
export type PostVisibility = (typeof POST_VISIBILITIES)[number];
export type PostMediaItem = {
  url: string;
  type: 'image' | 'video';
  alt?: string;
  poster?: string;
};

export function isAllowedMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//') && !trimmed.includes('\\');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parsePostMedia(value: unknown): PostMediaItem[] {
  if (!Array.isArray(value)) return [];
  const items: PostMediaItem[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && isAllowedMediaUrl(entry)) {
      items.push({ url: entry.trim(), type: 'image' });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    if (!isAllowedMediaUrl(url)) continue;
    const type = record.type === 'video' ? 'video' : 'image';
    const alt = typeof record.alt === 'string' ? record.alt.trim() : undefined;
    const poster = typeof record.poster === 'string' && isAllowedMediaUrl(record.poster) ? record.poster.trim() : undefined;
    items.push({ url, type, ...(alt ? { alt } : {}), ...(poster ? { poster } : {}) });
  }
  return items;
}

export function normalizeAudienceEmails(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const emails: string[] = [];
  const seen = new Set<string>();
  for (const entry of source) {
    if (typeof entry !== 'string') continue;
    const email = entry.trim().toLowerCase();
    if (!email || seen.has(email) || !email.includes('@') || email.includes(' ')) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

const postMediaItemSchema = z.object({
  url: z.string().min(1),
  type: z.enum(['image', 'video']).default('image'),
  alt: z.string().optional(),
  poster: z.string().optional(),
});

export const blogPostPayloadSchema = z.object({
  slug: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  title: z.string().default(''),
  excerpt: z.string().default(''),
  content: z.string().default(''),
  publishedAt: z.coerce.date().default(new Date()),
  tags: stringArray.default([]),
  isDraft: z.coerce.boolean().default(true),
  featured: z.coerce.boolean().default(false),
  coverImage: z.string().optional().nullable(),
  author: z.string().default('Artist'),
  format: z.enum(POST_FORMATS).default('article'),
  visibility: z.enum(POST_VISIBILITIES).default('public'),
  media: z.preprocess(parsePostMedia, z.array(postMediaItemSchema)).default([]),
  audienceEmails: z.preprocess(normalizeAudienceEmails, z.array(z.string())).default([]),
  relatedProductId: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().nullable().optional(),
  ),
  relatedArtworkSlug: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().nullable().optional(),
  ),
  pullQuote: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  processStage: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.enum(POST_PROCESS_STAGES).nullable().optional(),
  ),
}).superRefine((payload, ctx) => {
  if (payload.isDraft) return;

  if (payload.visibility === 'private' && payload.audienceEmails.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['audienceEmails'],
      message: 'Private updates must whitelist at least one collector email.',
    });
  }

  if (payload.format === 'short') {
    const caption = payload.excerpt.trim();
    if (payload.media.length === 0 && caption.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['media'],
        message: 'Published studio updates need a photo, video, or caption.',
      });
    }
    return;
  }

  if (!isPublishableContentTitle(payload.title)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['title'],
      message: 'Published journal posts need a descriptive title (at least 3 characters, not "Untitled").',
    });
  }
});

export const socialPostPayloadSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'pinterest']).default('instagram'),
  content: z.string().min(1),
  mediaUrls: stringArray.default([]),
  scheduledAt: z.coerce.date().optional().nullable(),
  publishedAt: z.coerce.date().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'needs_attention', 'failed']).default('draft'),
  hashtags: stringArray.optional(),
  mentions: stringArray.optional(),
  campaignId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const adCampaignPayloadSchema = z.object({
  name: z.string().min(1),
  platform: z.enum(['google', 'facebook', 'instagram', 'linkedin', 'twitter']).default('google'),
  campaignId: z.string().optional().nullable(),
  type: z.enum(['search', 'display', 'video', 'shopping', 'social']).default('social'),
  objective: z.enum(['awareness', 'traffic', 'conversions', 'sales']).default('sales'),
  targetAudience: z.unknown().optional(),
  budgetType: z.enum(['daily', 'lifetime']).default('daily'),
  budgetAmount: z.coerce.number().min(0),
  bidStrategy: z.enum(['cpc', 'cpm', 'cpa', 'roas']).default('cpc'),
  bidAmount: z.coerce.number().min(0).optional().nullable(),
  adSets: z.unknown().optional(),
  creatives: z.unknown().optional(),
  startDate: z.coerce.date().default(new Date()),
  endDate: z.coerce.date().optional().nullable(),
  performance: z.unknown().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
  notes: z.string().optional().nullable(),
});

export const promoCodePayloadSchema = z.object({
  code: z.string().min(2).max(64),
  discountType: z.enum(['percentage', 'fixed']).default('percentage'),
  discountValue: z.coerce.number().positive(),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

function hasArtworkMedia(images: {
  main?: string | null;
  thumbnail?: string | null;
  gallery?: readonly string[] | null;
}): boolean {
  const candidates = [
    images.main,
    images.thumbnail,
    ...(Array.isArray(images.gallery) ? images.gallery : []),
  ];
  return candidates.some((entry) => {
    if (typeof entry !== 'string') return false;
    const trimmed = entry.trim();
    return Boolean(trimmed) && trimmed !== ARTWORK_IMAGE_FALLBACK;
  });
}

export const artworkPayloadSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().trim().default(''),
  description: z.string().default(''),
  medium: z.string().default(''),
  dimensions: z.string().default(''),
  year: z.coerce.string().default(String(new Date().getFullYear())),
  category: stringArray.default([]),
  featured: z.coerce.boolean().default(false),
  available: z.coerce.boolean().default(false),
  price: z.string().optional().nullable(),
  images: z.object({
    main: z.string().default(''),
    gallery: stringArray.default([]),
    thumbnail: z.string().default(''),
  }),
  content: z.string().default(''),
}).superRefine((payload, ctx) => {
  const hasTitle = payload.title.trim().length > 0;
  const hasMedia = hasArtworkMedia(payload.images);
  if (!hasTitle && !hasMedia) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['title'],
      message: 'Add a photo or enter a title.',
    });
  }
});

function escapeHtmlText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function shortPostTitle(payload: z.infer<typeof blogPostPayloadSchema>): string {
  const caption = payload.excerpt.trim();
  if (caption.length >= 3) {
    const firstLine = caption.split('\n').map((line) => line.trim()).find(Boolean) || caption;
    return firstLine.length > 80 ? `${firstLine.slice(0, 77).trimEnd()}…` : firstLine;
  }
  const title = payload.title.trim();
  if (isPublishableContentTitle(title)) return title;
  return `Studio update ${payload.publishedAt.toISOString().slice(0, 10)}`;
}

function postSlug(payload: z.infer<typeof blogPostPayloadSchema>, title: string): string {
  if (payload.slug?.trim()) return slugify(payload.slug);
  const base = slugify(title);
  const caption = payload.excerpt.trim();
  if (payload.format === 'short' && !isPublishableContentTitle(payload.title) && caption.length < 3) {
    return `${base}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return base;
}

export function sanitizeBlogPostPayload(payload: z.infer<typeof blogPostPayloadSchema>) {
  const format = payload.format;
  const title = format === 'short' ? shortPostTitle(payload) : payload.title.trim();
  const media = parsePostMedia(payload.media);
  const excerpt = payload.excerpt.trim();
  const hasRichContent = htmlHasVisibleText(payload.content);
  const contentSource = format === 'short'
    ? (excerpt ? `<p>${escapeHtmlText(excerpt)}</p>` : (hasRichContent ? payload.content : ''))
    : payload.content;
  const coverImage = payload.coverImage || media.find((item) => item.type === 'image')?.url || null;

  return {
    slug: postSlug(payload, title),
    title,
    excerpt,
    content: sanitizeRichHtml(contentSource),
    publishedAt: payload.publishedAt,
    tags: payload.tags,
    isDraft: payload.isDraft,
    featured: payload.featured,
    coverImage,
    author: payload.author,
    format,
    visibility: payload.visibility,
    media,
    audienceEmails: payload.visibility === 'private' ? payload.audienceEmails : [],
    relatedProductId: payload.relatedProductId?.trim() || null,
    relatedArtworkSlug: payload.relatedArtworkSlug?.trim() || null,
    pullQuote: payload.pullQuote?.trim() || null,
    location: payload.location?.trim() || null,
    processStage: payload.processStage || null,
  };
}

export function sanitizeNewsletterDocument(document: NewsletterDocument): NewsletterDocument {
  return {
    subject: document.subject.trim(),
    preheader: document.preheader.trim(),
    fromName: document.fromName.trim(),
    blocks: document.blocks.map((block): NewsletterBlock => {
      switch (block.type) {
        case 'text':
          return { ...block, html: sanitizeRichHtml(block.html) };
        case 'image':
          return { ...block, url: block.url.trim(), alt: block.alt.trim(), caption: block.caption.trim(), href: block.href.trim() };
        case 'button':
          return { ...block, label: block.label.trim(), href: block.href.trim() };
        case 'product':
          return {
            ...block,
            productId: block.productId.trim(),
            title: block.title.trim(),
            imageUrl: block.imageUrl.trim(),
            priceLabel: block.priceLabel.trim(),
            href: block.href.trim(),
            ctaLabel: block.ctaLabel.trim(),
          };
        case 'divider':
          return block;
      }
    }),
  };
}

/** EmailCampaign columns for a newsletter draft; status and scheduling are owned by send actions. */
export function newsletterCampaignData(document: NewsletterDocument) {
  const sanitized = sanitizeNewsletterDocument(document);
  return {
    name: sanitized.subject || 'Untitled newsletter',
    type: 'broadcast',
    templateId: NEWSLETTER_TEMPLATE_ID,
    segments: JSON.stringify([NEWSLETTER_SEGMENT]),
    content: sanitized,
  };
}

export function sanitizeSocialPostPayload(payload: z.infer<typeof socialPostPayloadSchema>) {
  const scheduledAt = payload.scheduledAt || null;
  return {
    platform: payload.platform,
    content: sanitizeRichHtml(payload.content).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    mediaUrls: JSON.stringify(payload.mediaUrls || []),
    scheduledAt,
    publishedAt: payload.publishedAt || null,
    status: scheduledAt && scheduledAt > new Date() ? 'scheduled' : payload.status,
    engagement: JSON.stringify({ likes: 0, comments: 0, shares: 0, reach: 0, clicks: 0 }),
    campaignId: payload.campaignId || null,
    hashtags: payload.hashtags ? JSON.stringify(payload.hashtags) : null,
    mentions: payload.mentions ? JSON.stringify(payload.mentions) : null,
    notes: payload.notes || null,
  };
}

export function normalizeAdCampaignPayload(payload: z.infer<typeof adCampaignPayloadSchema>) {
  return {
    name: payload.name.trim(),
    platform: payload.platform,
    campaignId: payload.campaignId || null,
    type: payload.type,
    objective: payload.objective,
    targetAudience: JSON.stringify(payload.targetAudience || {}),
    budgetType: payload.budgetType,
    budgetAmount: payload.budgetAmount,
    bidStrategy: payload.bidStrategy,
    bidAmount: payload.bidAmount || null,
    adSets: JSON.stringify(payload.adSets || []),
    creatives: JSON.stringify(payload.creatives || []),
    startDate: payload.startDate,
    endDate: payload.endDate || null,
    performance: JSON.stringify(payload.performance || { impressions: 0, clicks: 0, conversions: 0, cost: 0, roas: 0 }),
    status: payload.status,
    notes: payload.notes || null,
  };
}

export function sanitizeArtworkPayload(payload: z.infer<typeof artworkPayloadSchema>) {
  const trimmedTitle = payload.title.trim();
  const title = trimmedTitle || 'Untitled';
  const rawGallery = (payload.images.gallery || [])
    .map((image) => image.trim())
    .filter((image) => Boolean(image) && image !== ARTWORK_IMAGE_FALLBACK)
    .map((image) => resolvePublicAssetUrl(image, ARTWORK_IMAGE_FALLBACK))
    .filter((image, index, list) => Boolean(image) && list.indexOf(image) === index);

  const rawMain = payload.images.main.trim();
  const rawThumb = payload.images.thumbnail.trim();
  const resolvedMain = rawMain && rawMain !== ARTWORK_IMAGE_FALLBACK
    ? resolvePublicAssetUrl(rawMain, ARTWORK_IMAGE_FALLBACK)
    : '';
  const resolvedThumb = rawThumb && rawThumb !== ARTWORK_IMAGE_FALLBACK
    ? resolvePublicAssetUrl(rawThumb, ARTWORK_IMAGE_FALLBACK)
    : '';

  const preferredStill =
    (resolvedMain && resolvedMain !== ARTWORK_IMAGE_FALLBACK && !isVideoUrl(resolvedMain) ? resolvedMain : '')
    || (resolvedThumb && resolvedThumb !== ARTWORK_IMAGE_FALLBACK && !isVideoUrl(resolvedThumb) ? resolvedThumb : '')
    || rawGallery.find((image) => image !== ARTWORK_IMAGE_FALLBACK && !isVideoUrl(image))
    || rawGallery[0]
    || resolvedMain
    || resolvedThumb;

  const main = resolvePublicAssetUrl(preferredStill, ARTWORK_IMAGE_FALLBACK);
  const thumbnail = resolvePublicAssetUrl(
    (resolvedThumb && resolvedThumb !== ARTWORK_IMAGE_FALLBACK && !isVideoUrl(resolvedThumb) ? resolvedThumb : '')
      || main,
    main,
  );
  const gallery = rawGallery.length > 0 ? rawGallery : [main];
  const explicitSlug = payload.slug?.trim();
  const slug = explicitSlug
    ? slugify(explicitSlug)
    : trimmedTitle && trimmedTitle.toLowerCase() !== 'untitled'
      ? slugify(trimmedTitle)
      : `untitled-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const category = (payload.category || []).filter(
    (entry) => entry.trim().length > 0 && entry.trim().toLowerCase() !== 'uncategorized',
  );

  return {
    ...payload,
    title,
    slug,
    category,
    content: sanitizeRichHtml(payload.content),
    price: payload.price || null,
    images: {
      main,
      thumbnail,
      gallery,
    },
  };
}

export function normalizeProductPayload(payload: z.infer<typeof productPayloadSchema>) {
  const slug = slugify(payload.slug || payload.title);
  const gallery = payload.images.gallery.map(image => image.trim()).filter(Boolean);
  const rawThumb = payload.images.thumbnail.trim();
  const thumbnail = (rawThumb && !isVideoUrl(rawThumb) ? rawThumb : '')
    || gallery.find((image) => !isVideoUrl(image))
    || rawThumb
    || gallery[0]
    || PRODUCT_IMAGE_FALLBACK;
  const normalized = normalizeProduct({
    ...(payload as any),
    id: payload.id || slug,
    slug,
    images: {
      thumbnail,
      gallery: gallery.length > 0 ? gallery : [thumbnail],
    },
  });
  const { initialStock: _ignoredInitialStock, ...rest } = payload;
  const commissionInfo = payload.commissionInfo?.available
    ? {
        available: true,
        estimatedDays: Math.max(1, Math.floor(payload.commissionInfo.estimatedDays)),
        priceRange: {
          min: Math.max(0, payload.commissionInfo.priceRange.min),
          max: Math.max(payload.commissionInfo.priceRange.min, payload.commissionInfo.priceRange.max),
        },
        requiresConsultation: payload.commissionInfo.requiresConsultation ?? true,
      }
    : null;
  const edition = normalized.edition
    ? {
        total: normalized.edition.total,
        remaining: normalized.edition.remaining,
      }
    : null;

  return {
    ...rest,
    id: payload.id || slug,
    slug,
    images: normalized.images,
    shipping: normalized.shipping,
    variants: normalized.variants ?? null,
    customizations: normalized.customizations ?? [],
    commissionInfo,
    edition,
    relatedProducts: payload.relatedProducts || [],
  };
}