import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';
import { validateContactForm, sanitizeFormData, type ContactFormData } from '@/lib/form-validation';
import { sendTemplateEmail } from '@/lib/email';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 3;

function ipHash(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

function parseProperties(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function isRateLimited(ip: string): Promise<boolean> {
  const hashedIp = ipHash(ip);
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const attempts = await db.analyticsEvent.findMany({
    where: {
      eventName: 'contact_submit_attempt',
      timestamp: { gte: since },
    },
    select: { properties: true },
    take: 100,
  });

  const recentAttempts = attempts.filter((event) => parseProperties(event.properties).ip_hash === hashedIp).length;
  if (recentAttempts >= RATE_LIMIT_MAX_REQUESTS) return true;

  await db.analyticsEvent.create({
    data: {
      eventName: 'contact_submit_attempt',
      properties: JSON.stringify({ ip_hash: hashedIp }),
      timestamp: new Date(),
    },
  });

  return false;
}

export const POST = withApiErrorHandler(async (request: NextRequest) => {
  // Get client IP for rate limiting
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  const skipRateLimit = process.env.PLAYWRIGHT_E2E === 'true' || (process.env.NODE_ENV !== 'production' && request.headers.get('x-e2e-test') === 'true');
  
  // Check rate limiting
  if (!skipRateLimit && await isRateLimited(ip)) {
    throw new ApiError(429, 'Too many requests. Please wait before submitting again.', 'RATE_LIMITED');
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    throw new ApiError(400, 'Invalid JSON in request body', 'INVALID_JSON');
  }

  // Sanitize and validate form data
  const sanitizedData = sanitizeFormData(body as ContactFormData);
  const validationErrors = validateContactForm(sanitizedData);
  
  if (Object.keys(validationErrors).length > 0) {
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', { errors: validationErrors });
  }

  const { name, email, subject, message, inquiryType } = sanitizedData;

  const isE2eLogMode = process.env.PLAYWRIGHT_E2E === 'true';
  const deliveryMode = isE2eLogMode ? 'log' : await getConfig('EMAIL_DELIVERY_MODE') || (process.env.NODE_ENV === 'production' ? 'smtp' : 'log');
  const recipient = await getConfig('CONTACT_EMAIL') || await getConfig('SMTP_FROM') || await getConfig('SMTP_USER');
  if (!recipient && deliveryMode !== 'log') {
    throw new ApiError(503, 'Contact email recipient is not configured', 'CONTACT_RECIPIENT_UNCONFIGURED');
  }

  const delivered = await sendTemplateEmail(recipient || 'contact-log@localhost', {
    subject: `[${inquiryType.toUpperCase()}] ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Inquiry Type:</strong> ${inquiryType}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <div style="white-space: pre-wrap; border-left: 4px solid #2563eb; padding-left: 12px;">${message}</div>
        <hr />
        <p style="font-size: 12px; color: #666;">IP: ${ip}</p>
        <p style="font-size: 12px; color: #666;">User Agent: ${request.headers.get('user-agent')?.substring(0, 100) || 'unknown'}</p>
      </div>
    `,
    text: `New contact form submission\n\nFrom: ${name} <${email}>\nInquiry Type: ${inquiryType}\nSubject: ${subject}\n\n${message}\n\nIP: ${ip}`,
  });

  if (!delivered) {
    throw new ApiError(502, 'Failed to send email notification', 'EMAIL_SEND_FAILED');
  }

  return NextResponse.json({ 
    message: 'Message sent successfully!',
    inquiryType,
    timestamp: new Date().toISOString()
  });
});