import { withApiErrorHandler, ApiError } from '@/lib/api-error-handler';
import { validateContactForm, sanitizeFormData, type ContactFormData } from '@/lib/form-validation';

// Lightweight json helper (avoid NextResponse.json for Jest environment)
function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

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

export const POST = withApiErrorHandler(async (request: Request) => {
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

  return json({ 
    message: 'Message sent successfully!',
    inquiryType,
    timestamp: new Date().toISOString()
  });
});