// Order domain service: business logic and persistence
import type Stripe from 'stripe'
import { prisma } from '@/lib/db'
import type { Order, OrderItem, OrderStatus, OrderTimeline, ShippingAddress } from './order.types'

type ExpandedCheckoutSession = Stripe.Checkout.Session & { line_items?: Stripe.ApiList<Stripe.LineItem> }

export class OrderService {
  // ...migrated helpers from OrderManager...
  static generateOrderNumber(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 5)
    return `ART-${timestamp}-${random}`.toUpperCase()
  }

  static calculateOrderTotals(items: OrderItem[], shippingCost: number = 0): {
    subtotal: number
    shipping: number
    tax: number
    total: number
  } {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0)
    const shipping = shippingCost
    const tax = subtotal * 0.08
    const total = subtotal + shipping + tax
    return { subtotal, shipping, tax, total }
  }

  static createTimelineEntry(
    status: OrderStatus,
    message: string,
    details?: string,
    trackingNumber?: string
  ): OrderTimeline {
    return {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      status,
      timestamp: new Date(),
      message,
      details,
      trackingNumber,
    }
  }

  static getStatusMessage(status: OrderStatus): string {
    const messages: Record<OrderStatus, string> = {
      pending: 'Order placed and payment pending',
      confirmed: 'Payment confirmed and order received',
      processing: 'Order is being prepared for shipment',
      shipped: 'Order has been shipped',
      delivered: 'Order has been delivered',
      cancelled: 'Order has been cancelled',
      refunded: 'Order has been refunded',
    }
    return messages[status]
  }

  static validateShippingAddress(address: ShippingAddress): string[] {
    const errors: string[] = []
    if (!address.firstName?.trim()) errors.push('First name is required')
    if (!address.lastName?.trim()) errors.push('Last name is required')
    if (!address.address1?.trim()) errors.push('Address is required')
    if (!address.city?.trim()) errors.push('City is required')
    if (!address.state?.trim()) errors.push('State is required')
    if (!address.postalCode?.trim()) errors.push('Postal code is required')
    if (!address.country?.trim()) errors.push('Country is required')
    return errors
  }

  static calculateShippingCost(items: OrderItem[], shippingAddress: ShippingAddress, method?: string): number {
    const isInternational = shippingAddress.country !== 'US'
    const hasLargeItems = items.some(
      (item) => item.selectedVariant?.name?.includes?.('Large') || item.selectedVariant?.name?.includes?.('24x36')
    )
    let baseCost = 15
    if (method === 'express') baseCost *= 2
    if (isInternational) baseCost *= 1.5
    if (hasLargeItems) baseCost += 25
    return Math.round(baseCost * 100) / 100
  }

  static canCancelOrder(order: Order): boolean {
    return ['pending', 'confirmed'].includes(order.status)
  }

  static canRefundOrder(order: Order): boolean {
    return ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status)
  }

  // Persistence from Stripe session
  static async createOrderFromStripeSession(session: ExpandedCheckoutSession): Promise<{ id: string; orderNumber: string }>{
    const email = session.customer_details?.email ?? session.customer_email ?? ''
    const currency = (session.currency ?? 'usd').toUpperCase()
    const subtotal = (session.amount_subtotal ?? 0) / 100
    const total = (session.amount_total ?? 0) / 100
    const shipping = (session.total_details?.amount_shipping ?? 0) / 100
    const tax = (session.total_details?.amount_tax ?? 0) / 100

    const orderNumber = this.generateOrderNumber()

    // Create order and items in a transaction
    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          userEmail: email,
          status: 'confirmed',
          type: 'standard',
          subtotal,
          shipping,
          tax,
          total,
          currency,
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
          paymentStatus: session.payment_status ?? 'paid',
        },
      })

      const items = session.line_items?.data ?? []
      if (items.length) {
        for (const li of items) {
          const priceCents = li.price?.unit_amount ?? li.amount_total ?? 0
          const price = priceCents / 100
          const quantity = li.quantity ?? 1
          const totalPrice = price * quantity
          const productRef = li.price?.product
          const productId = typeof productRef === 'string' ? productRef : productRef?.id ?? 'unknown'

          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId,
              quantity,
              unitPrice: price,
              totalPrice,
              productTitle: li.description ?? 'Item',
              productImage: '',
              selectedVariant: undefined,
              customizations: undefined,
            },
          })
        }
      }

      await tx.orderTimelineEntry.create({
        data: {
          orderId: order.id,
          status: 'confirmed',
          message: this.getStatusMessage('confirmed'),
        },
      })

      return order
    })

    return { id: created.id, orderNumber }
  }
}
