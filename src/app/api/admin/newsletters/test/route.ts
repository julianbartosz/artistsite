import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ApiError, jsonErrorResponse } from '@/lib/api-error-handler';
import { sanitizeNewsletterDocument } from '@/lib/admin-content';
import { getSiteUrl } from '@/lib/config';
import { getEmailDeliveryStatus } from '@/lib/email';
import { sendNewsletterTest } from '@/lib/marketing/campaign-execution';
import { newsletterContentIssues, newsletterDocumentSchema } from '@/lib/newsletter';
import { normalizeSubscriberEmail } from '@/lib/newsletter-subscribers';

export const dynamic = 'force-dynamic';

const MAX_TEST_RECIPIENTS = 5;

const testSchema = z.object({
  document: newsletterDocumentSchema,
  emails: z.array(z.string()).max(MAX_TEST_RECIPIENTS),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const payload = testSchema.parse(await request.json());
    const document = sanitizeNewsletterDocument(payload.document);

    const requested = payload.emails.length ? payload.emails : [session.user.email ?? ''];
    const emails = Array.from(new Set(requested.map(normalizeSubscriberEmail)));
    if (emails.length === 0 || emails.some((email) => email === null)) {
      throw new ApiError(400, 'Enter valid email addresses, separated by commas.', 'INVALID_EMAIL');
    }

    const issues = newsletterContentIssues(document, { siteUrl: await getSiteUrl() });
    if (issues.length > 0) throw new ApiError(400, issues[0].message, 'NOT_READY', issues);

    const [result, delivery] = await Promise.all([
      sendNewsletterTest(document, emails as string[]),
      getEmailDeliveryStatus(),
    ]);
    return NextResponse.json({ ...result, deliveryMode: delivery.mode });
  } catch (error) {
    return jsonErrorResponse(error, 'Failed to send test newsletter');
  }
}
