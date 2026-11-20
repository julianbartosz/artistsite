import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandler } from '@/lib/api-error-handler';
import { brandedEmailHtml, emailDetailRows, emailQuoteHtml, getEmailBrand, sendTemplateEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/email-shell';
import { getConfig } from '@/lib/config';
import { linkContactSubmissionToInbox } from '@/lib/studio-inbox';

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

    const inboxBody = [
      `Commission request ${requestId}`,
      data.productId ? `Related product: ${data.productId}` : null,
      ...commissionDetails(data).map(([label, value]) => `${label}: ${value}`),
      `Preferred contact: ${data.customerInfo.preferredContact}`,
      data.customerInfo.phone ? `Phone: ${data.customerInfo.phone}` : null,
      '',
      data.description,
      data.specialRequests ? `\nSpecial requests:\n${data.specialRequests}` : null,
    ].filter((line) => line !== null).join('\n');

    try {
      await linkContactSubmissionToInbox({
        name: data.customerInfo.name,
        email: data.customerInfo.email,
        subject: `Commission request ${requestId}`,
        message: inboxBody,
        inquiryType: 'commission',
      });
    } catch (inboxError) {
      console.error('Failed to persist commission request to studio inbox:', inboxError);
    }

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

function commissionDetails(data: CommissionRequestData): Array<[string, string]> {
  return [
    ['Type', String(data.type)],
    ['Medium', String(data.medium)],
    ['Dimensions', String(data.dimensions)],
    ['Timeline', String(data.timeline)],
    ['Budget', `$${data.budget?.min ?? 0} - $${data.budget?.max ?? 0}`],
  ];
}

async function sendCommissionRequestEmails(data: CommissionRequestData, requestId: string) {
  const artistEmail = await getConfig('ARTIST_EMAIL') || await getConfig('CONTACT_EMAIL') || await getConfig('SMTP_FROM') || await getConfig('SMTP_USER');
  if (!artistEmail) {
    throw new Error('Artist email recipient is not configured');
  }

  const brand = await getEmailBrand();
  const { name, email, preferredContact, phone } = data.customerInfo;
  const details = commissionDetails(data);
  const detailText = details.map(([label, value]) => `${label}: ${value}`).join('\n');
  const escapedRows = (rows: Array<[string, string]>) => emailDetailRows(rows.map(([label, value]) => [label, escapeHtml(value)]));

  const customerEmailContent = {
    subject: `Commission Request Confirmation - ${requestId}`,
    html: brandedEmailHtml(brand, {
      title: 'Commission request received',
      intro: `Hello ${escapeHtml(name)}, your commission request <strong>${escapeHtml(requestId)}</strong> has been received. Expect a reply within 24–48 hours.`,
      sections: [{ html: escapedRows(details) }],
    }),
    text: `Commission request received\n\nRequest ID: ${requestId}\n${detailText}\nEstimated response: 24-48 hours.`,
  };

  const artistEmailContent = {
    subject: `New Commission Request - ${requestId}`,
    html: brandedEmailHtml(brand, {
      title: 'New commission request',
      intro: `${escapeHtml(name)} sent request <strong>${escapeHtml(requestId)}</strong>. Reply to this email to answer them directly.`,
      sections: [
        {
          html: escapedRows([
            ['Customer', `${name} <${email}>`],
            ['Preferred contact', String(preferredContact)],
            ...(phone ? [['Phone', String(phone)] as [string, string]] : []),
            ...details,
          ]),
        },
        { heading: 'Description', html: emailQuoteHtml(String(data.description), brand) },
        ...(data.specialRequests ? [{ heading: 'Special requests', html: emailQuoteHtml(String(data.specialRequests), brand) }] : []),
      ],
    }),
    text: `New commission request\n\nRequest ID: ${requestId}\nCustomer: ${name} <${email}>\nPreferred Contact: ${preferredContact}\n${detailText}\n\n${data.description}\n\n${data.specialRequests || ''}`,
  };

  const [customerDelivered, artistDelivered] = await Promise.all([
    sendTemplateEmail(email, customerEmailContent),
    sendTemplateEmail(artistEmail, artistEmailContent, { replyTo: email }),
  ]);

  if (!customerDelivered || !artistDelivered) {
    throw new Error('Failed to send commission request emails');
  }
}

export const POST = withApiErrorHandler(handleCommissionRequest);