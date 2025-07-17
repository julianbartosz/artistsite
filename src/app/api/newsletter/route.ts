import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    // For now, we'll just log the subscription and return success
    // In production, this would integrate with your ESP (Mailchimp, ConvertKit, etc.)
    console.log(`Newsletter subscription: ${email}`);

    // TODO: Integrate with ESP API
    // Example for Mailchimp:
    // const response = await fetch(`https://us15.api.mailchimp.com/3.0/lists/${LIST_ID}/members`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`anystring:${process.env.MAILCHIMP_API_KEY}`).toString('base64')}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     email_address: email,
    //     status: 'subscribed',
    //   }),
    // });

    return NextResponse.json({ 
      message: 'Successfully subscribed to newsletter!',
      email 
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}