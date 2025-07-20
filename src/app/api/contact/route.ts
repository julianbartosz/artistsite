import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';
import { validateContactForm, sanitizeFormData, type ContactFormData } from '@/lib/form-validation';

// Simple in-memory rate limiting (in production, use Redis or database)
const rateLimitStore = new Map<string, number[]>();

const isRateLimited = (ip: string, windowMs = 60000, maxRequests = 3): boolean => {
  const now = Date.now();
  const requests = rateLimitStore.get(ip) || [];
  
  // Filter out requests outside the time window
  const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return true;
  }
  
  // Add current request and update store
  recentRequests.push(now);
  rateLimitStore.set(ip, recentRequests);
  
  return false;
};

export const POST = withApiErrorHandler(async (request: NextRequest) => {
  // Get client IP for rate limiting
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  
  // Check rate limiting
  if (isRateLimited(ip)) {
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

  // Enhanced logging with more security context
  console.log('Contact form submission:', {
    name,
    email,
    subject,
    inquiryType,
    messageLength: message.length,
    timestamp: new Date().toISOString(),
    ip,
    userAgent: request.headers.get('user-agent')?.substring(0, 100),
  });

  // TODO: Implement email sending service
  // This is where you would integrate with your email service provider:
  
  try {
    // Simulate email sending processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Example email service integration (commented out):
    /*
    if (process.env.EMAIL_SERVICE === 'sendgrid') {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      const msg = {
        to: process.env.CONTACT_EMAIL || 'hello@artistsite.com',
        from: process.env.FROM_EMAIL || 'noreply@artistsite.com',
        replyTo: email,
        subject: `[${inquiryType.toUpperCase()}] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;">
              New Contact Form Submission
            </h2>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>From:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              <p><strong>Inquiry Type:</strong> ${inquiryType}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div style="margin: 20px 0;">
              <h3 style="color: #333;">Message:</h3>
              <div style="background: white; padding: 15px; border-left: 4px solid #007cba; white-space: pre-wrap;">${message}</div>
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
              <p>This message was sent from the Artist Site contact form.</p>
              <p>IP: ${ip}</p>
            </div>
          </div>
        `,
      };
      
      await sgMail.send(msg);
    } else if (process.env.EMAIL_SERVICE === 'resend') {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@artistsite.com',
        to: process.env.CONTACT_EMAIL || 'hello@artistsite.com',
        replyTo: email,
        subject: `[${inquiryType.toUpperCase()}] ${subject}`,
        html: // ... similar HTML template
      });
    }
    */
    
    // For development/testing, log the email content
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email would be sent:', {
        to: process.env.CONTACT_EMAIL || 'hello@artistsite.com',
        from: email,
        subject: `[${inquiryType.toUpperCase()}] ${subject}`,
        messagePreview: message.substring(0, 100) + '...'
      });
    }
    
  } catch (emailError) {
    console.error('Email sending failed:', emailError);
    throw new ApiError(500, 'Failed to send email notification', 'EMAIL_SEND_FAILED');
  }

  return NextResponse.json({ 
    message: 'Message sent successfully!',
    inquiryType,
    timestamp: new Date().toISOString()
  });
});