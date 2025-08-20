import { 
  Order, 
  OrderManager, 
  OrderItem,
  OrderTimeline 
} from '@/lib/orders'
import { getAllProducts } from '@domain/shop'
import { CreateOrderRequestSchema, GetOrdersQuerySchema } from '@shared/validation/orders'
import { debug } from '@/lib/debug'

// In-memory order storage (replace with database in production)
const orders: Map<string, Order> = new Map()

function json(data: any, init: ResponseInit = {}) { 
  return new Response(JSON.stringify(data), { 
    ...init, 
    headers: { 
      'content-type': 'application/json', 
      ...(init.headers || {}) 
    } 
  }) 
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown
    const parsed = CreateOrderRequestSchema.parse(body)

    // Validate shipping address
    const addressErrors = OrderManager.validateShippingAddress(parsed.shippingAddress)
    if (addressErrors.length > 0) {
      return json(
        { error: 'Invalid shipping address', details: addressErrors },
        { status: 400 }
      )
    }

    // Get all products for validation
    const products = await getAllProducts()

    // Convert cart items to order items with full product data
    const orderItems: OrderItem[] = []
    for (const item of parsed.items) {
      const product = products.find((p) => p.id === item.productId)
      if (!product) {
        return json({ error: `Product not found: ${item.productId}` }, { status: 400 })
      }
      let unitPrice = product.price
      if (item.selectedVariant) unitPrice += item.selectedVariant.priceModifier || 0
      if (item.customizations) unitPrice += item.customizations.reduce((sum, c) => sum + (c.priceModifier || 0), 0)

      orderItems.push({
        id: crypto.randomUUID(),
        productId: item.productId,
        product,
        quantity: item.quantity,
        selectedVariant: item.selectedVariant,
        customizations: item.customizations,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      })
    }

    // Calculate shipping and totals
    const shippingCost = OrderManager.calculateShippingCost(orderItems, parsed.shippingAddress, parsed.shippingMethod)
    const totals = OrderManager.calculateOrderTotals(orderItems, shippingCost)

    // Create initial timeline
    const initialTimeline: OrderTimeline[] = [
      OrderManager.createTimelineEntry('pending', OrderManager.getStatusMessage('pending'), 'Order created and awaiting payment confirmation'),
    ]

    // Create the order
    const order: Order = {
      id: crypto.randomUUID(),
      orderNumber: OrderManager.generateOrderNumber(),
      type: 'standard',
      status: 'pending',
      customerEmail: parsed.customerEmail,
      customerId: parsed.customerId,
      items: orderItems,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      tax: totals.tax,
      total: totals.total,
      currency: 'USD',
      shippingAddress: parsed.shippingAddress,
      billingAddress: parsed.billingAddress || parsed.shippingAddress,
      paymentStatus: 'pending',
      shippingMethod: parsed.shippingMethod || 'standard',
      timeline: initialTimeline,
      specialInstructions: parsed.specialInstructions,
      giftMessage: parsed.giftMessage,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Store the order
    orders.set(order.id, order)

    return json({
      success: true,
      order: { id: order.id, orderNumber: order.orderNumber, status: order.status, total: order.total, currency: order.currency },
    })
  } catch (error) {
    debug.error('Error creating order', error as Error)
    return json({ error: 'Failed to create order' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = GetOrdersQuerySchema.safeParse({
      customerEmail: searchParams.get('customerEmail') ?? undefined,
      customerId: searchParams.get('customerId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    })

    if (!parsed.success) {
      return json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 })
    }

    const { customerEmail, customerId, status } = parsed.data

    const customerOrders = Array.from(orders.values()).filter((order) => {
      const matchesCustomer = customerEmail ? order.customerEmail === customerEmail : order.customerId === customerId
      const matchesStatus = status ? order.status === status : true
      return matchesCustomer && matchesStatus
    })

    customerOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return json({ success: true, orders: customerOrders })
  } catch (error) {
    debug.error('Error fetching orders', error as Error)
    return json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}