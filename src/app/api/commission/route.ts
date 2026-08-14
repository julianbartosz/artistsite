import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandler } from '@/lib/api-error-handler';
import { sendTemplateEmail } from '@/lib/email';
import { getConfig } from '@/lib/config';

interface CommissionRequestData {
  type: 'similar' | 'custom' | 'consultation';
  productId?: string;
  medium: string;
  dimensions: string;
  description: string;
  budget: {
    min: number;
    max: number;
  };
  timeline: string;
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
    preferredContact: 'email' | 'phone';
  };
  specialRequests?: string;
  variants?: {
    size?: string;
    material?: string;
    style?: string;
    background?: string;
    subjects?: string;
  };
}

async function handleCommissionRequest(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  const data: CommissionRequestData = await req.json();

  // Validate required fields
  const requiredFields: (keyof CommissionRequestData)[] = ['description', 'timeline', 'customerInfo'];
  const missingFields = requiredFields.filter(field => !data[field]);

  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missingFields.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate customer info
  if (!data.customerInfo.name || !data.customerInfo.email) {
    return NextResponse.json(
      { error: 'Customer name and email are required' },
      { status: 400 }
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.customerInfo.email)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 }
    );
  }

  // Validate budget
  if (data.budget && data.budget.min >= data.budget.max) {
    return NextResponse.json(
      { error: 'Maximum budget must be higher than minimum budget' },
      { status: 400 }
    );
  }

  // Generate commission request ID
  const requestId = `COMM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    await sendCommissionRequestEmails(data, requestId);

    // Log the request for monitoring
    console.log('Commission request received:', {
      requestId,
      customerEmail: data.customerInfo.email,
      type: data.type,
      budget: data.budget,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Commission request submitted successfully',
      estimatedResponse: '24-48 hours',
      nextSteps: [
        'You will receive a confirmation email shortly',
        data.type === 'consultation' 
          ? 'We will contact you to schedule a consultation call'
          : 'We will review your request and provide a detailed proposal',
        'All communication will use your preferred contact method'
      ]
    });

  } catch (error) {
    console.error('Failed to process commission request:', error);
    return NextResponse.json(
      { error: 'Failed to submit commission request. Please try again.' },
      { status: 500 }
    );
  }
}

async function sendCommissionRequestEmails(data: CommissionRequestData, requestId: string) {
  const artistEmail = await getConfig('ARTIST_EMAIL') || await getConfig('CONTACT_EMAIL') || await getConfig('SMTP_FROM') || await getConfig('SMTP_USER');
  if (!artistEmail) {
    throw new Error('Artist email recipient is not configured');
  }

  const customerEmailContent = {
    subject: `Commission Request Confirmation - ${requestId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Commission Request Received</h2>
        <p>Hello ${data.customerInfo.name},</p>
        <p>Your commission request <strong>${requestId}</strong> has been received.</p>
        <p><strong>Type:</strong> ${data.type}</p>
        <p><strong>Medium:</strong> ${data.medium}</p>
        <p><strong>Dimensions:</strong> ${data.dimensions}</p>
        <p><strong>Timeline:</strong> ${data.timeline}</p>
        <p><strong>Budget:</strong> $${data.budget?.min ?? 0} - $${data.budget?.max ?? 0}</p>
        <p>Estimated response: 24-48 hours.</p>
      </div>
    `,
    text: `Commission request received\n\nRequest ID: ${requestId}\nType: ${data.type}\nMedium: ${data.medium}\nDimensions: ${data.dimensions}\nTimeline: ${data.timeline}\nBudget: $${data.budget?.min ?? 0} - $${data.budget?.max ?? 0}\nEstimated response: 24-48 hours.`,
  };

  const artistEmailContent = {
    subject: `New Commission Request - ${requestId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Commission Request</h2>
        <p><strong>Request ID:</strong> ${requestId}</p>
        <p><strong>Customer:</strong> ${data.customerInfo.name} (${data.customerInfo.email})</p>
        <p><strong>Preferred Contact:</strong> ${data.customerInfo.preferredContact}</p>
        <p><strong>Type:</strong> ${data.type}</p>
        <p><strong>Medium:</strong> ${data.medium}</p>
        <p><strong>Dimensions:</strong> ${data.dimensions}</p>
        <p><strong>Timeline:</strong> ${data.timeline}</p>
        <p><strong>Budget:</strong> $${data.budget?.min ?? 0} - $${data.budget?.max ?? 0}</p>
        <p><strong>Description:</strong></p>
        <div style="white-space: pre-wrap; border-left: 4px solid #2563eb; padding-left: 12px;">${data.description}</div>
        ${data.specialRequests ? `<p><strong>Special Requests:</strong> ${data.specialRequests}</p>` : ''}
      </div>
    `,
    text: `New commission request\n\nRequest ID: ${requestId}\nCustomer: ${data.customerInfo.name} <${data.customerInfo.email}>\nPreferred Contact: ${data.customerInfo.preferredContact}\nType: ${data.type}\nMedium: ${data.medium}\nDimensions: ${data.dimensions}\nTimeline: ${data.timeline}\nBudget: $${data.budget?.min ?? 0} - $${data.budget?.max ?? 0}\n\n${data.description}\n\n${data.specialRequests || ''}`,
  };

  const [customerDelivered, artistDelivered] = await Promise.all([
    sendTemplateEmail(data.customerInfo.email, customerEmailContent),
    sendTemplateEmail(artistEmail, artistEmailContent),
  ]);

  if (!customerDelivered || !artistDelivered) {
    throw new Error('Failed to send commission request emails');
  }
}

export const POST = withApiErrorHandler(handleCommissionRequest);