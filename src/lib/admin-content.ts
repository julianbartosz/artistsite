import { z } from 'zod';
import { sanitizeRichHtml } from '@/lib/content-sanitize';
import { PRODUCT_IMAGE_FALLBACK } from '@/lib/commerce';

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
  medium: z.string().default('Mixed Media'),
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
  commissionInfo: z.unknown().optional(),
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

export const emailCampaignPayloadSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  htmlContent: z.string().default(''),
  textContent: z.string().optional(),
  segments: stringArray.default(['all']),
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'completed']).default('draft'),
  scheduledAt: z.coerce.date().optional().nullable(),
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

export const artworkPayloadSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().default(''),
  medium: z.string().default('Mixed Media'),
  dimensions: z.string().default(''),
  year: z.coerce.string().default(String(new Date().getFullYear())),
  category: stringArray.default(['uncategorized']),
  featured: z.coerce.boolean().default(false),
  available: z.coerce.boolean().default(false),
  price: z.string().optional().nullable(),
  images: z.object({
    main: z.string().default(ARTWORK_IMAGE_FALLBACK),
    gallery: stringArray.default([]),
    thumbnail: z.string().default(ARTWORK_IMAGE_FALLBACK),
  }),
  content: z.string().default(''),
}).superRefine((payload, ctx) => {
  if (payload.available && !isPublishableContentTitle(payload.title)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['title'],
      message: 'Available portfolio works need a descriptive title (at least 3 characters, not "Untitled").',
    });
  }
});

function shortPostTitle(payload: z.infer<typeof blogPostPayloadSchema>): string {
  const title = payload.title.trim();
  if (isPublishableContentTitle(title)) return title;
  const caption = payload.excerpt.trim();
  if (caption.length >= 3) {
    return caption.length > 80 ? `${caption.slice(0, 77).trimEnd()}…` : caption;
  }
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
  const contentSource = payload.content.trim() || (format === 'short' && excerpt ? `<p>${excerpt}</p>` : payload.content);
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

export function sanitizeEmailCampaignPayload(payload: z.infer<typeof emailCampaignPayloadSchema>) {
  const html = sanitizeRichHtml(payload.htmlContent);
  const text = (payload.textContent || html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  const scheduledAt = payload.scheduledAt || null;

  return {
    name: payload.name.trim(),
    type: 'broadcast',
    templateId: 'admin-authored',
    segments: JSON.stringify(payload.segments.length > 0 ? payload.segments : ['all']),
    content: {
      subject: payload.subject.trim(),
      html,
      text,
    },
    metrics: JSON.stringify({
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      converted: 0,
      bounced: 0,
      unsubscribed: 0,
      open_rate: 0,
      click_rate: 0,
      conversion_rate: 0,
    }),
    status: scheduledAt && scheduledAt > new Date() ? 'scheduled' : payload.status,
    scheduledAt,
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
  return {
    ...payload,
    slug: slugify(payload.slug || payload.title),
    content: sanitizeRichHtml(payload.content),
    price: payload.price || null,
    images: {
      main: payload.images.main || payload.images.thumbnail || ARTWORK_IMAGE_FALLBACK,
      thumbnail: payload.images.thumbnail || payload.images.main || ARTWORK_IMAGE_FALLBACK,
      gallery: payload.images.gallery,
    },
  };
}

export function normalizeProductPayload(payload: z.infer<typeof productPayloadSchema>) {
  const slug = slugify(payload.slug || payload.title);
  const gallery = payload.images.gallery.map(image => image.trim()).filter(Boolean);
  const thumbnail = payload.images.thumbnail.trim() || gallery[0] || PRODUCT_IMAGE_FALLBACK;

  return {
    ...payload,
    id: payload.id || slug,
    slug,
    images: {
      thumbnail,
      gallery: gallery.length > 0 ? gallery : [thumbnail],
    },
    relatedProducts: payload.relatedProducts || [],
  };
}