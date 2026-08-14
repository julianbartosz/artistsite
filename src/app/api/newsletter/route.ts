import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const POST = withApiErrorHandler(async (request: NextRequest) => {
  const { email } = await request.json();
  
  if (!email || !email.includes('@')) {
    throw new ApiError(400, 'Valid email address is required', 'INVALID_EMAIL');
  }

  // Check for required environment variables
  const apiKey = await getConfig('MAILCHIMP_API_KEY');
  const listId = await getConfig('MAILCHIMP_LIST_ID');
  const serverPrefix = await getConfig('MAILCHIMP_SERVER_PREFIX');
  const deliveryMode = await getConfig('NEWSLETTER_DELIVERY_MODE') || (process.env.NODE_ENV === 'production' ? 'mailchimp' : 'log');
  const isE2eLogMode = process.env.PLAYWRIGHT_E2E === 'true';

  if (deliveryMode === 'log' || isE2eLogMode) {
    await recordNewsletterSubscriber(email);
    return NextResponse.json({
      message: 'Successfully subscribed to newsletter!',
      email,
      mode: 'development'
    });
  }

  if (!apiKey || !listId || !serverPrefix) {
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(503, 'Newsletter service is not configured', 'ESP_UNCONFIGURED');
    }

    console.warn('Mailchimp environment variables not configured, logging email instead:', email);
    
    // Fallback: just log the subscription for development
    await recordNewsletterSubscriber(email);
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
        throw new ApiError(409, 'This email is already subscribed to our newsletter', 'ALREADY_SUBSCRIBED');
      }
      
      console.error('Mailchimp API error:', data);
      throw new ApiError(500, 'Failed to subscribe to newsletter', 'ESP_ERROR');
    }

    console.log(`Newsletter subscription successful: ${email}`);
    await recordNewsletterSubscriber(email);
    
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

async function recordNewsletterSubscriber(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const existing = await db.customerProfile.findUnique({ where: { email: normalizedEmail } }).catch(() => null);
  const existingSegments = parseSegments(existing?.segments);
  const segments = Array.from(new Set([...existingSegments, 'newsletter_subscriber']));

  await db.customerProfile.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      segments: JSON.stringify(segments),
      preferences: JSON.stringify({ newsletter: true }),
      lastActivity: new Date(),
    },
    update: {
      segments: JSON.stringify(segments),
      preferences: JSON.stringify({ ...(parseObject(existing?.preferences)), newsletter: true }),
      lastActivity: new Date(),
    },
  }).catch((error) => {
    console.error('Failed to record newsletter subscriber profile:', error);
  });
}

function parseSegments(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((segment): segment is string => typeof segment === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((segment): segment is string => typeof segment === 'string') : [];
  } catch {
    return [];
  }
}

function parseObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}