import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { ApiError, jsonErrorResponse } from '@/lib/api-error-handler';
import { newsletterCampaignData } from '@/lib/admin-content';
import {
  claimEmailCampaign,
  deliverEmailCampaign,
  getNewsletterSendContext,
  getNewsletterSummary,
} from '@/lib/marketing/campaign-execution';
import { newsletterDocumentSchema, newsletterSendIssues } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({ document: newsletterDocumentSchema });

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send') }),
  z.object({ action: z.literal('schedule'), scheduledAt: z.string().datetime({ offset: true }) }),
  z.object({ action: z.literal('unschedule') }),
]);

const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const NOT_EDITABLE = 'This newsletter has already gone out. Duplicate it to send a new version.';
const EDITABLE_STATUSES = ['draft', 'scheduled', 'paused'];

async function requireEditable(id: string) {
  const newsletter = await getNewsletterSummary(id);
  if (!newsletter.editable) throw new ApiError(409, NOT_EDITABLE, 'NOT_EDITABLE');
  return newsletter;
}

/** Writes only if the cron has not claimed the newsletter since `requireEditable`. */
async function updateEditable(id: string, data: Parameters<typeof db.emailCampaign.updateMany>[0]['data']) {
  const { count } = await db.emailCampaign.updateMany({ where: { id, status: { in: EDITABLE_STATUSES } }, data });
  if (count === 0) throw new ApiError(409, NOT_EDITABLE, 'NOT_EDITABLE');
  return NextResponse.json({ newsletter: await getNewsletterSummary(id) });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { document } = updateSchema.parse(await request.json());
    await requireEditable(id);
    return await updateEditable(id, newsletterCampaignData(document));
  } catch (error) {
    return jsonErrorResponse(error, 'Failed to save newsletter');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    const newsletter = await getNewsletterSummary(id);
    if (newsletter.status === 'active') {
      throw new ApiError(409, 'This newsletter is sending right now. Delete it after it finishes.', 'SENDING');
    }
    await db.emailCampaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonErrorResponse(error, 'Failed to delete newsletter');
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    const payload = actionSchema.parse(await request.json());

    if (payload.action === 'send') {
      const mode = await claimEmailCampaign(id);
      after(async () => {
        await deliverEmailCampaign(id, mode).catch((error) => console.error('Newsletter delivery failed:', error));
      });
      return NextResponse.json({ newsletter: await getNewsletterSummary(id) }, { status: 202 });
    }

    const newsletter = await requireEditable(id);

    if (payload.action === 'unschedule') {
      if (newsletter.status !== 'scheduled') throw new ApiError(409, 'This newsletter is not scheduled.', 'NOT_SCHEDULED');
      return await updateEditable(id, { status: 'draft', scheduledAt: null });
    }

    if (!(await getConfig('CRON_SECRET') || process.env.CRON_SECRET)) {
      throw new ApiError(400, 'Scheduling needs the automation secret in Settings.', 'SCHEDULING_UNAVAILABLE');
    }
    const scheduledAt = new Date(payload.scheduledAt);
    const ahead = scheduledAt.getTime() - Date.now();
    if (ahead <= 0) throw new ApiError(400, 'Pick a time in the future.', 'INVALID_SCHEDULE');
    if (ahead > MAX_SCHEDULE_AHEAD_MS) throw new ApiError(400, 'Pick a time within the next year.', 'INVALID_SCHEDULE');

    const issues = newsletterSendIssues(newsletter.document, await getNewsletterSendContext());
    if (issues.length > 0) throw new ApiError(400, issues[0].message, 'NOT_READY', issues);

    return await updateEditable(id, { status: 'scheduled', scheduledAt });
  } catch (error) {
    return jsonErrorResponse(error, 'Failed to update newsletter');
  }
}
