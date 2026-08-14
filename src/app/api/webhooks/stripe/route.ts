import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { markOrderPaid } from '@/lib/orders';
import { OrderEmailService } from '@/lib/email';
import { InventoryService } from '@/lib/inventory';
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

  const order = await markOrderPaid(
    orderId,
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    session.payment_method_types?.[0],
    {
      shipping: centsToDollars(session.total_details?.amount_shipping),
      tax: centsToDollars(session.total_details?.amount_tax),
      total: centsToDollars(session.amount_total),
    }
  );

  if (!order) {
    throw new Error(`Order not found for Stripe session ${session.id}: ${orderId}`);
  }

  await InventoryService.fulfillReservationsForOrder(order.id);
  await OrderEmailService.sendStatusUpdate(order, 'confirmed');
  await db.analyticsEvent.create({
    data: {
      eventName: 'post_purchase_sequence_triggered',
      userId: order.customerId,
      properties: JSON.stringify({ order_id: order.id, order_number: order.orderNumber, order_value: order.total }),
      timestamp: new Date(),
    },
  }).catch(() => undefined);
}

function centsToDollars(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value) / 100;
}
