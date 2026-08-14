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

export const blogPostPayloadSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1),
  excerpt: z.string().default(''),
  content: z.string().default(''),
  publishedAt: z.coerce.date().default(new Date()),
  tags: stringArray.default([]),
  isDraft: z.coerce.boolean().default(true),
  featured: z.coerce.boolean().default(false),
  coverImage: z.string().optional().nullable(),
  author: z.string().default('Artist'),
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
});

export function sanitizeBlogPostPayload(payload: z.infer<typeof blogPostPayloadSchema>) {
  return {
    ...payload,
    slug: slugify(payload.slug || payload.title),
    content: sanitizeRichHtml(payload.content),
    coverImage: payload.coverImage || null,
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