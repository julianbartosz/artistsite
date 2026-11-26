import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';
import { getConfig } from '@/lib/config';
import { linkSessionEventsToProfile } from '@/lib/analytics/customer-insights';
import { sendNewsletterWelcomeEmail } from '@/lib/marketing/campaign-execution';
import {
  COLLECTOR_PROFILE_COOKIE,
  COMMISSION_WAITLIST_SEGMENT,
  createCollectorProfileToken,
  isNewsletterSubscriber,
  normalizeSubscriberEmail,
  recordNewsletterSubscriber,
} from '@/lib/newsletter-subscribers';

const PROFILE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

async function finalizeSubscription(
  email: string,
  digest: boolean,
  sessionId: string | undefined,
  mode: 'site' | 'development' | 'production',
  mailchimpSynced?: boolean,
  meta?: { eventSlug?: string; firstName?: string; extraSegments?: string[] },
): Promise<NextResponse> {
  const profileId = await recordNewsletterSubscriber(email, digest, meta);

  if (profileId && sessionId) {
    await linkSessionEventsToProfile(sessionId, profileId).catch(() => undefined);
  }

  const welcome = await sendNewsletterWelcomeEmail(email, profileId).catch((error) => {
    console.error('Newsletter welcome email failed:', error);
    return { attempted: false, delivered: false };
  });

  const response = NextResponse.json({
    message: 'Successfully subscribed to newsletter!',
    email,
    mode,
    emailSent: welcome.delivered,
    ...(mailchimpSynced !== undefined ? { mailchimpSynced } : {}),
  });

  if (profileId) {
    const token = createCollectorProfileToken(profileId);
    if (token) {
      response.cookies.set(COLLECTOR_PROFILE_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: PROFILE_COOKIE_MAX_AGE_SECONDS,
      });
    }
  }

  return response;
}

export const POST = withApiErrorHandler(async (request: NextRequest) => {
  const payload = await request.json() as {
    email?: string;
    digest?: boolean;
    sessionId?: string;
    eventSlug?: string;
    firstName?: string;
    segment?: string;
  };
  const email = normalizeSubscriberEmail(payload.email);
  const sessionId = typeof payload.sessionId === 'string' && payload.sessionId.trim()
    ? payload.sessionId.trim().slice(0, 128)
    : undefined;
  const eventSlug = typeof payload.eventSlug === 'string'
    ? payload.eventSlug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || undefined
    : undefined;
  const firstName = typeof payload.firstName === 'string' && payload.firstName.trim()
    ? payload.firstName.trim().slice(0, 80)
    : undefined;
  const extraSegments = payload.segment === COMMISSION_WAITLIST_SEGMENT
    ? [COMMISSION_WAITLIST_SEGMENT]
    : [];
  const digest = payload.digest !== false;

  if (!email) {
    throw new ApiError(400, 'Valid email address is required', 'INVALID_EMAIL');
  }

  if (await isNewsletterSubscriber(email)) {
    if (eventSlug || extraSegments.length > 0) {
      await recordNewsletterSubscriber(email, digest, { eventSlug, firstName, extraSegments });
      return NextResponse.json({
        message: extraSegments.includes(COMMISSION_WAITLIST_SEGMENT)
          ? "You're on the commission waitlist! We'll email you as soon as spots open."
          : "You're already on the list! We noted your visit today.",
        email,
        alreadySubscribed: true,
        emailSent: false,
      });
    }
    throw new ApiError(409, 'This email is already subscribed to our newsletter', 'ALREADY_SUBSCRIBED');
  }

  // Always save subscribers on-site; Mailchimp is an optional best-effort copy so
  // incomplete credentials or third-party outages never lose a collector signup.
  const apiKey = await getConfig('MAILCHIMP_API_KEY');
  const listId = await getConfig('MAILCHIMP_LIST_ID');
  const serverPrefix = await getConfig('MAILCHIMP_SERVER_PREFIX');
  const deliveryMode = (await getConfig('NEWSLETTER_DELIVERY_MODE')) || 'log';
  const isE2eLogMode = process.env.PLAYWRIGHT_E2E === 'true';

  if (deliveryMode !== 'mailchimp' || isE2eLogMode) {
    return finalizeSubscription(
      email,
      digest,
      sessionId,
      process.env.NODE_ENV === 'production' ? 'site' : 'development',
      undefined,
      { eventSlug, firstName, extraSegments },
    );
  }

  if (!apiKey || !listId || !serverPrefix) {
    console.warn('Mailchimp sync enabled but credentials incomplete; saved subscriber on-site:', email);
    return finalizeSubscription(
      email,
      digest,
      sessionId,
      process.env.NODE_ENV === 'production' ? 'site' : 'development',
      false,
      { eventSlug, firstName, extraSegments },
    );
  }

  let mailchimpSynced = false;
  try {
    const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status: 'subscribed',
        tags: [
          'website-signup',
          ...(eventSlug ? [`market:${eventSlug}`] : []),
          ...extraSegments,
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok || data.title === 'Member Exists') {
      mailchimpSynced = true;
    } else {
      console.error('Mailchimp sync failed; saved subscriber on-site:', data);
    }
  } catch (error) {
    console.error('Mailchimp sync network error; saved subscriber on-site:', error);
  }

  return finalizeSubscription(
    email,
    digest,
    sessionId,
    mailchimpSynced ? 'production' : (process.env.NODE_ENV === 'production' ? 'site' : 'development'),
    mailchimpSynced,
    { eventSlug, firstName, extraSegments },
  );
});
