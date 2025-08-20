import { CreateCheckoutSessionRequestSchema } from '@shared/validation/orders'
import { StripePaymentService } from '@domain/orders'

// Lightweight json helper (avoids NextResponse.json for test environment compatibility)
function json(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = CreateCheckoutSessionRequestSchema.parse(body)

    const origin = new URL(req.url).origin
    const session = await StripePaymentService.createCheckoutSession({
      ...parsed,
      successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout/cancel`,
    })

    return json({ sessionId: session.id })
  } catch (error) {
    const message = (error as { issues?: unknown })?.issues ? 'Invalid request payload' : 'Failed to create checkout session'
    return json({ error: message }, { status: 400 })
  }
}