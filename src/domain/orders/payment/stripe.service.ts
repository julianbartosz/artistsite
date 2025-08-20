import Stripe from 'stripe'

// Encapsulated Stripe service for Orders domain
export class StripePaymentService {
  private static stripe: Stripe | null = null

  private static getClient(): Stripe {
    if (!this.stripe) {
      const secret = process.env.STRIPE_SECRET_KEY
      if (!secret) throw new Error('STRIPE_SECRET_KEY is not set')
      this.stripe = new Stripe(secret)
    }
    return this.stripe
  }

  static async createCheckoutSession(input: {
    items: Array<{
      product: {
        id: string
        title: string
        medium?: string
        dimensions?: string
        images?: { thumbnail?: string }
        category?: string
        price: number
      }
      quantity: number
    }>
    customerInfo: { email: string; firstName?: string; lastName?: string }
    subtotal: number
    shipping: number
    tax: number
    total: number
    successUrl: string
    cancelUrl: string
  }): Promise<{ id: string }> {
    const stripe = this.getClient()

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: input.items.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.product.title,
            description: [item.product.medium, item.product.dimensions].filter(Boolean).join(' • '),
            images: item.product.images?.thumbnail ? [item.product.images.thumbnail] : undefined,
            metadata: {
              productId: item.product.id,
              category: item.product.category ?? '',
            },
          },
          unit_amount: Math.round(item.product.price * 100),
        },
        quantity: item.quantity,
      })),
      ...(input.shipping > 0 && {
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: {
                amount: Math.round(input.shipping * 100),
                currency: 'usd',
              },
              display_name: 'Standard Shipping',
              delivery_estimate: {
                minimum: { unit: 'business_day', value: 5 },
                maximum: { unit: 'business_day', value: 10 },
              },
            },
          },
        ],
      }),
      automatic_tax: { enabled: true },
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerInfo.email,
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU'] },
      metadata: {
        customerEmail: input.customerInfo.email,
        customerName: `${input.customerInfo.firstName ?? ''} ${input.customerInfo.lastName ?? ''}`.trim(),
        orderTotal: input.total.toString(),
        itemCount: input.items.length.toString(),
      },
      custom_fields: [
        {
          key: 'phone',
          label: { type: 'custom', custom: 'Phone Number' },
          type: 'text',
          optional: false,
        },
      ],
    })

    return { id: session.id }
  }

  static async retrieveCheckoutSession(sessionId: string) {
    const stripe = this.getClient()
    return stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items', 'customer', 'shipping_cost'] })
  }
}
