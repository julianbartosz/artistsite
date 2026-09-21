import { NextRequest, NextResponse } from 'next/server';
import { E2E_CHECKOUT_SESSION_PREFIX } from '@/lib/commerce';
import { finalizePaidOrder, getOrderById } from '@/lib/orders';
import { getStripe } from '@/lib/stripe';

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

    if (
      process.env.PLAYWRIGHT_E2E === 'true'
      && sessionId.startsWith(E2E_CHECKOUT_SESSION_PREFIX)
    ) {
      const orderId = sessionId.slice(E2E_CHECKOUT_SESSION_PREFIX.length);
      const existing = await getOrderById(orderId);
      if (!existing) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const order = existing.paymentStatus === 'paid'
        ? existing
        : await finalizePaidOrder(orderId, {
            paymentIntentId: `e2e_payment_${orderId}`,
            paymentMethod: 'card',
            paidTotals: {
              shipping: existing.shipping,
              tax: existing.tax,
              total: existing.total,
            },
          });

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        sessionId,
        paymentStatus: 'paid',
        order,
      });
    }

    const stripe = await getStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer', 'shipping_cost'],
    });

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is missing from checkout session' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      order,
    });
  } catch (error) {
    console.error('Error retrieving session:', error);
    return NextResponse.json(
      { error: error instanceof Error && /not configured/i.test(error.message) ? error.message : 'Failed to retrieve order details' },
      { status: error instanceof Error && /not configured/i.test(error.message) ? 503 : 500 }
    );
  }
}

function centsToDollars(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.round(value) / 100;
}
