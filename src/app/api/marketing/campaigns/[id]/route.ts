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
import { publishRecordedCampaign, sendEmailCampaign } from '@/lib/marketing/campaign-execution';

const dbWithMarketing = db as any;

async function resolveKind(id: string, requested?: string | null): Promise<'email' | 'social' | 'ad' | null> {
  if (requested === 'email' || requested === 'social' || requested === 'ad') return requested;
  if (await dbWithMarketing.emailCampaign.findUnique({ where: { id }, select: { id: true } })) return 'email';
  if (await dbWithMarketing.socialMediaPost.findUnique({ where: { id }, select: { id: true } })) return 'social';
  if (await dbWithMarketing.adCampaign.findUnique({ where: { id }, select: { id: true } })) return 'ad';
  return null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const kind = await resolveKind(id, body.type || body.campaignType);
    if (!kind) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    if (kind === 'ad' && body.action === 'record_performance') {
      const existing = await dbWithMarketing.adCampaign.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      const currentPerformance = parseJsonObject(existing.performance);
      const performance = {
        ...currentPerformance,
        impressions: nonNegativeNumber(body.impressions, currentPerformance.impressions),
        clicks: nonNegativeNumber(body.clicks, currentPerformance.clicks),
        conversions: nonNegativeNumber(body.conversions, currentPerformance.conversions),
        cost: nonNegativeNumber(body.cost, currentPerformance.cost),
        roas: nonNegativeNumber(body.roas, currentPerformance.roas),
      };
      const campaign = await dbWithMarketing.adCampaign.update({
        where: { id },
        data: { performance: JSON.stringify(performance), status: existing.status === 'draft' ? 'active' : existing.status },
      });
      return NextResponse.json({ campaign });
    }

    if (kind === 'social' && body.action === 'mark_posted') {
      const campaign = await dbWithMarketing.socialMediaPost.update({
        where: { id },
        data: {
          status: 'published',
          publishedAt: new Date(),
          notes: body.notes || undefined,
        },
      });
      return NextResponse.json({ campaign });
    }

    if (kind === 'email') {
      const payload = sanitizeEmailCampaignPayload(emailCampaignPayloadSchema.parse(body));
      const campaign = await dbWithMarketing.emailCampaign.update({ where: { id }, data: payload });
      return NextResponse.json({ campaign });
    }

    if (kind === 'social') {
      const payload = sanitizeSocialPostPayload(socialPostPayloadSchema.parse(body));
      const campaign = await dbWithMarketing.socialMediaPost.update({ where: { id }, data: payload });
      return NextResponse.json({ campaign });
    }

    const payload = normalizeAdCampaignPayload(adCampaignPayloadSchema.parse(body));
    const campaign = await dbWithMarketing.adCampaign.update({ where: { id }, data: payload });
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid campaign data', details: error.issues }, { status: 400 });
    console.error('Marketing campaign update error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function nonNegativeNumber(value: unknown, fallback: unknown = 0): number {
  const candidate = Number(value ?? fallback ?? 0);
  return Number.isFinite(candidate) && candidate >= 0 ? candidate : 0;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const kind = await resolveKind(id, body.type || body.campaignType);
    if (!kind) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    if (body.action === 'delete') {
      return DELETE(request, { params: Promise.resolve({ id }) });
    }

    if (kind === 'email') {
      const result = await sendEmailCampaign(id);
      return NextResponse.json({ success: true, result });
    }

    const campaign = await publishRecordedCampaign(kind, id);
    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Marketing campaign action error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to run campaign action' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const kind = await resolveKind(id);
    if (!kind) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    if (kind === 'email') await dbWithMarketing.emailCampaign.delete({ where: { id } });
    if (kind === 'social') await dbWithMarketing.socialMediaPost.delete({ where: { id } });
    if (kind === 'ad') await dbWithMarketing.adCampaign.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Marketing campaign delete error:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}