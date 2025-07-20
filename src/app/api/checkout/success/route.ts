import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer', 'shipping_cost'],
    });

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    // Format the response
    const orderDetails = {
      sessionId: session.id,
      customerEmail: session.customer_email,
      amount: session.amount_total,
      items: session.line_items?.data || [],
      paymentStatus: session.payment_status,
      shippingAddress: session.shipping_cost ? {
        // Use customer_details instead of shipping_details
        name: session.customer_details?.name,
        email: session.customer_details?.email,
        address: session.customer_details?.address
      } : null,
    };

    return NextResponse.json(orderDetails);
  } catch (error) {
    console.error('Error retrieving session:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve order details' },
      { status: 500 }
    );
  }
}