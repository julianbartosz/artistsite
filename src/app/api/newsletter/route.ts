import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';
import { getConfig } from '@/lib/config';
import { isNewsletterSubscriber, normalizeSubscriberEmail, recordNewsletterSubscriber } from '@/lib/newsletter-subscribers';

export const POST = withApiErrorHandler(async (request: NextRequest) => {
  const payload = await request.json() as { email?: string; digest?: boolean };
  const email = normalizeSubscriberEmail(payload.email);

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
    await recordNewsletterSubscriber(email, payload.digest !== false);
    return NextResponse.json({
      message: 'Successfully subscribed to newsletter!',
      email,
      mode: process.env.NODE_ENV === 'production' ? 'site' : 'development',
    });
  }

  if (!apiKey || !listId || !serverPrefix) {
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(503, 'Newsletter service is not configured', 'ESP_UNCONFIGURED');
    }

    console.warn('Mailchimp environment variables not configured, logging email instead:', email);
    
    // Fallback: just log the subscription for development
    await recordNewsletterSubscriber(email, payload.digest !== false);
    return NextResponse.json({ 
      message: 'Successfully subscribed to newsletter!',
      email,
      mode: 'development'
    });
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
        await recordNewsletterSubscriber(email, payload.digest !== false);
        return NextResponse.json({ message: 'Successfully subscribed to newsletter!', email, mode: 'production' });
      }
      
      console.error('Mailchimp API error:', data);
      throw new ApiError(500, 'Failed to subscribe to newsletter', 'ESP_ERROR');
    }

    console.log(`Newsletter subscription successful: ${email}`);
    await recordNewsletterSubscriber(email, payload.digest !== false);
    
    return NextResponse.json({ 
      message: 'Successfully subscribed to newsletter!',
      email,
      mode: 'production'
    });

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('Newsletter subscription error:', error);
    throw new ApiError(500, 'Failed to subscribe to newsletter', 'NETWORK_ERROR');
  }
});