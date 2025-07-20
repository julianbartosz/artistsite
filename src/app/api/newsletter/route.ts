import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';

export const POST = withApiErrorHandler(async (request: NextRequest) => {
  const { email } = await request.json();
  
  if (!email || !email.includes('@')) {
    throw new ApiError(400, 'Valid email address is required', 'INVALID_EMAIL');
  }

  // Check for required environment variables
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;
  const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;

  if (!apiKey || !listId || !serverPrefix) {
    console.warn('Mailchimp environment variables not configured, logging email instead:', email);
    
    // Fallback: just log the subscription for development
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