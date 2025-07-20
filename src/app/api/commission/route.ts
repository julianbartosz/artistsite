import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandler } from '@/lib/api-error-handler';

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

  // In a real application, you would:
  // 1. Save to database
  // 2. Send email notifications
  // 3. Create calendar events for consultations
  // 4. Integrate with CRM systems

  // For now, we'll simulate the process
  try {
    // Simulate email sending
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
  // This would integrate with your email service (Mailchimp, SendGrid, etc.)
  // For now, we'll just log what would be sent

  const customerEmailContent = {
    to: data.customerInfo.email,
    subject: `Commission Request Confirmation - ${requestId}`,
    template: 'commission-confirmation',
    data: {
      customerName: data.customerInfo.name,
      requestId,
      type: data.type,
      description: data.description,
      timeline: data.timeline,
      budget: data.budget,
      estimatedResponse: '24-48 hours'
    }
  };

  const artistEmailContent = {
    to: process.env.ARTIST_EMAIL || 'artist@example.com',
    subject: `New Commission Request - ${requestId}`,
    template: 'commission-notification',
    data: {
      requestId,
      customerInfo: data.customerInfo,
      projectDetails: {
        type: data.type,
        medium: data.medium,
        dimensions: data.dimensions,
        description: data.description,
        timeline: data.timeline,
        budget: data.budget,
        specialRequests: data.specialRequests
      },
      variants: data.variants
    }
  };

  // Log email content for development
  console.log('Customer email would be sent:', customerEmailContent);
  console.log('Artist notification would be sent:', artistEmailContent);

  // In production, you would send actual emails here:
  // await emailService.send(customerEmailContent);
  // await emailService.send(artistEmailContent);

  // Simulate email delivery delay
  await new Promise(resolve => setTimeout(resolve, 100));
}

export const POST = withApiErrorHandler(handleCommissionRequest);