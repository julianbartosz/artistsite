import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';
import { getConfig } from '@/lib/config';
import { linkSessionEventsToProfile } from '@/lib/analytics/customer-insights';
import { sendNewsletterWelcomeEmail } from '@/lib/marketing/campaign-execution';
import {
  COLLECTOR_PROFILE_COOKIE,
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
): Promise<NextResponse> {
  const profileId = await recordNewsletterSubscriber(email, digest);

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
  const payload = await request.json() as { email?: string; digest?: boolean; sessionId?: string };
  const email = normalizeSubscriberEmail(payload.email);
  const sessionId = typeof payload.sessionId === 'string' && payload.sessionId.trim()
    ? payload.sessionId.trim().slice(0, 128)
    : undefined;
  const digest = payload.digest !== false;

  if (!email) {
    throw new ApiError(400, 'Valid email address is required', 'INVALID_EMAIL');
  }

  // Check for optional Mailchimp sync; default to on-site subscribers (matching Settings UI).
  const apiKey = await getConfig('MAILCHIMP_API_KEY');
  const listId = await getConfig('MAILCHIMP_LIST_ID');
  const serverPrefix = await getConfig('MAILCHIMP_SERVER_PREFIX');
  const deliveryMode = (await getConfig('NEWSLETTER_DELIVERY_MODE')) || 'log';
  const isE2eLogMode = process.env.PLAYWRIGHT_E2E === 'true';

  if (deliveryMode !== 'mailchimp' || isE2eLogMode) {
    if (await isNewsletterSubscriber(email)) {
      throw new ApiError(409, 'This email is already subscribed to our newsletter', 'ALREADY_SUBSCRIBED');
    }
    return finalizeSubscription(
      email,
      digest,
      sessionId,
      process.env.NODE_ENV === 'production' ? 'site' : 'development',
    );
  }

  if (!apiKey || !listId || !serverPrefix) {
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(503, 'Newsletter service is not configured', 'ESP_UNCONFIGURED');
    }

    console.warn('Mailchimp environment variables not configured, logging email instead:', email);

    // Fallback: just log the subscription for development
    return finalizeSubscription(email, digest, sessionId, 'development');
  }

  try {
    // Mailchimp API integration
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
        tags: ['website-signup'], // Tag to identify website signups
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle Mailchimp-specific errors
      if (data.title === 'Member Exists') {
        if (await isNewsletterSubscriber(email)) {
          throw new ApiError(409, 'This email is already subscribed to our newsletter', 'ALREADY_SUBSCRIBED');
        }
        return finalizeSubscription(email, digest, sessionId, 'production');
      }

      console.error('Mailchimp API error:', data);
      throw new ApiError(500, 'Failed to subscribe to newsletter', 'ESP_ERROR');
    }

    console.log(`Newsletter subscription successful: ${email}`);
    return finalizeSubscription(email, digest, sessionId, 'production');
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error('Newsletter subscription error:', error);
    throw new ApiError(500, 'Failed to subscribe to newsletter', 'NETWORK_ERROR');
  }
});
