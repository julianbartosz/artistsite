import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { finalizePaidOrder } from '@/lib/orders';
import {
  approveJobProofByToken,
  createJobPaymentSession,
  getPublicJobByToken,
} from '@/lib/jobs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const sessionId = request.nextUrl.searchParams.get('session_id')?.trim();

    // If returning from Stripe Checkout, verify & finalize immediately so status reflects payment
    // even when webhooks arrive asynchronously or aren't forwarded in local dev.
    if (sessionId && sessionId.startsWith('cs_')) {
      try {
        const stripe = await getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const orderId = session.metadata?.orderId || session.client_reference_id;
        if (session.payment_status === 'paid' && orderId) {
          await finalizePaidOrder(orderId, {
            paymentIntentId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id,
            paymentMethod: session.payment_method_types?.[0] || 'card',
            paidTotals: {
              total: session.amount_total !== null && session.amount_total !== undefined
                ? Math.round(session.amount_total) / 100
                : undefined,
            },
            stripeSession: session,
          });
        }
      } catch (err) {
        console.warn('Proposal return session sync skipped:', err);
      }
    }

    const payload = await getPublicJobByToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load proposal';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'pay_deposit' || action === 'pay_balance') {
      const stage = action === 'pay_balance' ? 'balance' : 'deposit';
      const result = await createJobPaymentSession(token, stage);
      return NextResponse.json(result);
    }

    if (action === 'approve_proof') {
      const job = await approveJobProofByToken(
        token,
        typeof body.note === 'string' ? body.note : undefined,
      );
      return NextResponse.json({ job });
    }

    return NextResponse.json({ error: 'Invalid proposal action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not process proposal request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
