import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import {
  adCampaignPayloadSchema,
  emailCampaignPayloadSchema,
  normalizeAdCampaignPayload,
  sanitizeEmailCampaignPayload,
  sanitizeSocialPostPayload,
  socialPostPayloadSchema,
} from '@/lib/admin-content';
import { db } from '@/lib/db';

const dbWithMarketing = db as any;

interface MarketingCampaignSummary {
  id: string;
  type: 'email' | 'social' | 'ad';
  name: string;
  status: string;
  performance: string;
  updatedAt?: string;
  content?: Record<string, any>;
  scheduledAt?: string;
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function rate(numerator: number, denominator: number): string {
  if (!denominator) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function emailPerformance(campaign: any): string {
  const metrics = parseJsonObject(campaign.metrics);
  const sent = Number(metrics.sent || 0);
  const opened = Number(metrics.opened || 0);
  const clicked = Number(metrics.clicked || 0);
  const converted = Number(metrics.converted || 0);

  if (sent > 0) return `${sent.toLocaleString()} sent, ${rate(opened, sent)} open rate`;
  if (converted > 0 || clicked > 0) return `${converted.toLocaleString()} conversions, ${clicked.toLocaleString()} clicks`;
  return 'No delivery data yet';
}

function socialPerformance(post: any): string {
  const engagement = parseJsonObject(post.engagement);
  const likes = Number(engagement.likes || 0);
  const comments = Number(engagement.comments || 0);
  const shares = Number(engagement.shares || 0);
  const reach = Number(engagement.reach || 0);
  const totalEngagement = likes + comments + shares;

  if (reach > 0) return `${totalEngagement.toLocaleString()} engagements, ${reach.toLocaleString()} reach`;
  if (post.scheduledAt) return `Scheduled for ${new Date(post.scheduledAt).toLocaleDateString()}`;
  return 'No engagement data yet';
}

function adPerformance(campaign: any): string {
  const performance = parseJsonObject(campaign.performance);
  const roas = Number(performance.roas || 0);
  const conversions = Number(performance.conversions || 0);
  const cost = Number(performance.cost || 0);

  if (roas > 0) return `${roas.toFixed(1)}x ROAS, ${conversions.toLocaleString()} conversions`;
  if (cost > 0) return `$${cost.toLocaleString()} spend, ${conversions.toLocaleString()} conversions`;
  return `$${Number(campaign.budgetAmount || 0).toLocaleString()} ${campaign.budgetType || 'budget'}`;
}

function toEmailCampaign(campaign: any): MarketingCampaignSummary {
  return {
    id: campaign.id,
    type: 'email',
    name: campaign.name,
    status: campaign.status,
    performance: emailPerformance(campaign),
    updatedAt: campaign.createdAt?.toISOString?.(),
    content: parseJsonObject(campaign.content),
    scheduledAt: campaign.scheduledAt?.toISOString?.(),
  };
}

function toSocialCampaign(post: any): MarketingCampaignSummary {
  return {
    id: post.id,
    type: 'social',
    name: `${post.platform} ${post.status}`,
    status: post.status,
    performance: socialPerformance(post),
    updatedAt: (post.publishedAt || post.scheduledAt || post.createdAt)?.toISOString?.(),
    content: { platform: post.platform, content: post.content, mediaUrls: parseJsonObject(post.mediaUrls) },
    scheduledAt: post.scheduledAt?.toISOString?.(),
  };
}

function toAdCampaign(campaign: any): MarketingCampaignSummary {
  const performance = parseJsonObject(campaign.performance);
  return {
    id: campaign.id,
    type: 'ad',
    name: campaign.name,
    status: campaign.status,
    performance: adPerformance(campaign),
    updatedAt: campaign.updatedAt?.toISOString?.(),
    content: {
      platform: campaign.platform,
      objective: campaign.objective,
      budgetAmount: campaign.budgetAmount,
      budgetType: campaign.budgetType,
      performance,
    },
  };
}

export async function GET() {
  try {
    await requireAdmin();

    const [emailCampaigns, socialPosts, adCampaigns] = await Promise.all([
      db.emailCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      dbWithMarketing.socialMediaPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      dbWithMarketing.adCampaign.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      email: emailCampaigns.map(toEmailCampaign),
      social: socialPosts.map(toSocialCampaign),
      ads: adCampaigns.map(toAdCampaign),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Marketing campaigns API error:', error);
    return NextResponse.json(
      { error: 'Failed to load marketing campaigns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const type = body.type || body.campaignType || 'email';

    if (type === 'email') {
      const payload = sanitizeEmailCampaignPayload(emailCampaignPayloadSchema.parse(body));
      const campaign = await db.emailCampaign.create({ data: payload as any });
      return NextResponse.json({ campaign: toEmailCampaign(campaign) }, { status: 201 });
    }

    if (type === 'social') {
      const payload = sanitizeSocialPostPayload(socialPostPayloadSchema.parse(body));
      const post = await dbWithMarketing.socialMediaPost.create({ data: payload });
      return NextResponse.json({ campaign: toSocialCampaign(post) }, { status: 201 });
    }

    if (type === 'ad') {
      // The campaign-kind discriminator ("ad") is a separate namespace from the ad
      // record's own "type" field (ad format: search/display/video/shopping/social).
      // Drop the discriminator before ad-format validation so a leaked kind does not
      // fail parsing, while still honoring a genuine ad-format value when provided.
      const adFormats = ['search', 'display', 'video', 'shopping', 'social'];
      const { campaignType: _campaignType, ...adBody } = body;
      if (!adFormats.includes(adBody.type)) {
        delete adBody.type;
      }
      const payload = normalizeAdCampaignPayload(adCampaignPayloadSchema.parse(adBody));
      const campaign = await dbWithMarketing.adCampaign.create({ data: payload });
      return NextResponse.json({ campaign: toAdCampaign(campaign) }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid campaign type' }, { status: 400 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid campaign data', details: error.issues }, { status: 400 });
    }

    console.error('Marketing campaign create error:', error);
    return NextResponse.json({ error: 'Failed to create marketing campaign' }, { status: 500 });
  }
}