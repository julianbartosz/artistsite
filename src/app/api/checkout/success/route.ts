import { SessionIdSchema } from '@shared/validation/orders'
import { OrderService, StripePaymentService } from '@domain/orders'
import { debug } from '@/lib/debug'

function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  })
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = SessionIdSchema.safeParse({ session_id: searchParams.get('session_id') })
    if (!parsed.success) {
      return json({ error: 'Session ID is required' }, { status: 400 })
    }

    const session = await StripePaymentService.retrieveCheckoutSession(parsed.data.session_id)
    if (session.payment_status !== 'paid') {
      return json({ error: 'Payment not completed' }, { status: 400 })
    }

    const { id: orderId, orderNumber } = await OrderService.createOrderFromStripeSession(
      session as unknown as Parameters<typeof OrderService.createOrderFromStripeSession>[0]
    )

    return json({
      success: true,
      orderId,
      orderNumber,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      amount: session.amount_total,
    })
  } catch (error) {
    debug.error('Error handling checkout success', error as Error)
    return json({ error: 'Failed to process order' }, { status: 500 })
  }
}