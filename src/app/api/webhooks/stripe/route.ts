import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { finalizePaidOrder } from '@/lib/orders';
import { getConfig } from '@/lib/config';
import { getStripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const webhookSecret = await getConfig('STRIPE_WEBHOOK_SECRET');
  const signature = request.headers.get('stripe-signature');

  if (!webhookSecret || !signature) {
    return NextResponse.json(
      { error: 'Stripe webhook is not configured' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid Stripe webhook signature' },
      { status: 400 }
    );
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return NextResponse.json(
      { error: 'Stripe webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return;

  const orderId = session.metadata?.orderId || session.client_reference_id;
  if (!orderId) {
    throw new Error(`Stripe session ${session.id} does not include an order id`);
  }

  const order = await finalizePaidOrder(orderId, {
    paymentIntentId: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id,
    paymentMethod: session.payment_method_types?.[0],
    paidTotals: {
      shipping: centsToDollars(session.total_details?.amount_shipping),
      tax: centsToDollars(session.total_details?.amount_tax),
      total: centsToDollars(session.amount_total),
    },
    promoCode: session.metadata?.promoCode,
    stripeSession: session,
  });

  if (!order) {
    throw new Error(`Order not found for Stripe session ${session.id}: ${orderId}`);
  }

  await sendMetaPurchaseEvent(session, order.total).catch(() => undefined);
}

async function sendMetaPurchaseEvent(session: Stripe.Checkout.Session, value: number): Promise<void> {
  const pixelId = await getConfig('FACEBOOK_PIXEL_ID');
  const accessToken = await getConfig('FACEBOOK_CONVERSION_API_TOKEN');
  if (!pixelId?.trim() || !accessToken?.trim()) return;

  const eventTime = Math.floor(Date.now() / 1000);
  const email = session.customer_details?.email || session.metadata?.customerEmail;

  await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [{
        event_name: 'Purchase',
        event_time: eventTime,
        event_id: session.id,
        action_source: 'website',
        user_data: email ? { em: [email] } : {},
        custom_data: {
          currency: 'USD',
          value,
          order_id: session.metadata?.orderId,
        },
      }],
    }),
  });
}

function centsToDollars(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value) / 100;
}
