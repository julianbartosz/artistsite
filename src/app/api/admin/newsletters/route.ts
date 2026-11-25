import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { jsonErrorResponse } from '@/lib/api-error-handler';
import { newsletterCampaignData } from '@/lib/admin-content';
import {
  getNewsletterSendContext,
  getNewsletterSummary,
  listAutomationEmailSummaries,
  listNewsletterSummaries,
} from '@/lib/marketing/campaign-execution';
import { newsletterDocumentSchema, type NewsletterAdminContext } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ document: newsletterDocumentSchema });

export async function GET() {
  try {
    const session = await requireAdmin();
    const [newsletters, automations, sendContext, admin] = await Promise.all([
      listNewsletterSummaries(),
      listAutomationEmailSummaries(),
      getNewsletterSendContext(),
      db.user.findUnique({ where: { id: session.user.id }, select: { email: true, firstName: true, name: true } }),
    ]);
    const context: NewsletterAdminContext = {
      ...sendContext,
      schedulingAvailable: true,
      testRecipient: {
        email: admin?.email || session.user.email || '',
        firstName: admin?.firstName || admin?.name?.split(' ')[0] || '',
      },
    };
    return NextResponse.json({ newsletters, automations, context });
  } catch (error) {
    return jsonErrorResponse(error, 'Failed to load newsletters');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { document } = createSchema.parse(await request.json());
    const created = await db.emailCampaign.create({
      data: { ...newsletterCampaignData(document), status: 'draft', metrics: '{}' },
    });
    return NextResponse.json({ newsletter: await getNewsletterSummary(created.id) }, { status: 201 });
  } catch (error) {
    return jsonErrorResponse(error, 'Failed to create newsletter');
  }
}
