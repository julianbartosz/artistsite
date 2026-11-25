import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { ApiError, jsonErrorResponse } from '@/lib/api-error-handler';
import { newsletterCampaignData } from '@/lib/admin-content';
import {
  claimEmailCampaign,
  deliverEmailCampaign,
  getNewsletterSendContext,
  getNewsletterSummary,
  saveAutomationEmail,
} from '@/lib/marketing/campaign-execution';
import { isAutomationEmailId, newsletterDocumentSchema, newsletterSendIssues } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({ document: newsletterDocumentSchema });

const automationUpdateSchema = z.object({
  document: newsletterDocumentSchema.optional(),
  resetToDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
  winbackDays: z.number().int().min(14).max(365).optional(),
  cartRecoveryPromoCode: z.string().max(64).optional(),
});

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
    const body = await request.json();
    if (isAutomationEmailId(id)) {
      const payload = automationUpdateSchema.parse(body);
      const automation = await saveAutomationEmail(id, payload);
      return NextResponse.json({ automation });
    }
    const { document } = updateSchema.parse(body);
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
    if (isAutomationEmailId(id)) {
      throw new ApiError(400, 'Built-in automation emails cannot be deleted. Turn them off or reset to default instead.', 'AUTOMATION_PROTECTED');
    }
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
    if (isAutomationEmailId(id)) {
      throw new ApiError(400, 'Automation emails send automatically on their trigger. Use Send test to preview.', 'AUTOMATION_PROTECTED');
    }
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
