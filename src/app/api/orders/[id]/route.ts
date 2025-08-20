import { NextResponse } from 'next/server';
import { 
  Order, 
  UpdateOrderRequest, 
  OrderManager, 
  OrderTimeline 
} from '@/lib/orders';
import { OrderEmailService } from '@/lib/email';
import { OrderIdParamSchema, UpdateOrderStatusSchema } from '@shared/validation/orders';
import { debug } from '@/lib/debug';
import { OrderRepository } from '@domain/orders';
import type { Prisma } from '@prisma/client';

// In-memory order storage (local to this route file)
const orders: Map<string, Order> = new Map();
const repo = new OrderRepository();

type DbOrderDetailed = Prisma.OrderGetPayload<{
  include: { items: true; timeline: true; shippingAddress: true; user: true }
}>;

function mapDbOrderToDomain(o: DbOrderDetailed): Order {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    type: (o.type ?? 'standard') as Order['type'],
    status: o.status as Order['status'],
    customerEmail: o.userEmail,
    customerId: o.userId ?? undefined,
    items: (o.items || []).map((it) => ({
      id: it.id,
      productId: it.productId,
      product: {
        id: it.productId,
        title: it.productTitle ?? 'Item',
        description: it.productTitle ?? 'Purchased item',
        price: it.unitPrice,
        currency: (o.currency ?? 'USD'),
        category: 'art',
        medium: '',
        dimensions: '',
        year: new Date(o.createdAt).getFullYear(),
        availability: 'sold',
        featured: false,
        images: { thumbnail: it.productImage || '/images/placeholder.png', gallery: [] },
        tags: [],
        shipping: { domestic: 0, international: 0 },
        specifications: { framed: false, signed: false, certificate: false },
        edition: undefined,
        variants: undefined,
        customizations: undefined,
        relatedProducts: undefined,
        bundle: undefined,
        commissionInfo: undefined,
      },
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
      // stored as JSON in DB
      selectedVariant: (it.selectedVariant as unknown) as Order['items'][number]['selectedVariant'],
      customizations: (it.customizations as unknown) as Order['items'][number]['customizations'],
      notes: it.notes ?? undefined,
    })),
    subtotal: o.subtotal,
    shipping: o.shipping,
    tax: o.tax,
    total: o.total,
    currency: o.currency ?? 'USD',
    shippingAddress: {
      firstName: o.shippingAddress?.firstName ?? '',
      lastName: o.shippingAddress?.lastName ?? '',
      company: o.shippingAddress?.company ?? undefined,
      address1: o.shippingAddress?.address1 ?? '',
      address2: o.shippingAddress?.address2 ?? undefined,
      city: o.shippingAddress?.city ?? '',
      state: o.shippingAddress?.state ?? '',
      postalCode: o.shippingAddress?.postalCode ?? '',
      country: o.shippingAddress?.country ?? '',
      phone: o.shippingAddress?.phone ?? undefined,
    },
    billingAddress: undefined,
    paymentIntentId: o.paymentIntentId ?? undefined,
    paymentStatus: o.paymentStatus ?? 'paid',
    paymentMethod: o.paymentMethod ?? undefined,
    shippingMethod: 'standard',
    trackingNumber: o.trackingNumber ?? undefined,
    estimatedDelivery: o.estimatedDelivery ?? undefined,
    timeline: (o.timeline || []).map((t) => ({
      id: t.id,
      status: t.status as Order['status'],
      timestamp: new Date(t.timestamp),
      message: t.message,
      details: t.details ?? undefined,
      trackingNumber: t.trackingNumber ?? undefined,
    })),
    specialInstructions: o.specialInstructions ?? undefined,
    giftMessage: o.giftMessage ?? undefined,
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
  };
}

export async function GET(
  _request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  const { id } = (context?.params ?? {}) as { id: string };
  try {
    const parsed = OrderIdParamSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }

    const order = orders.get(parsed.data.id);
    if (order) {
      return NextResponse.json({ success: true, order });
    }

    // Fallback to DB
    const dbOrder = await repo.findByIdDetailed(parsed.data.id);
    if (!dbOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const domainOrder = mapDbOrderToDomain(dbOrder as DbOrderDetailed);
    return NextResponse.json({ success: true, order: domainOrder });

  } catch (error) {
    debug.error('Error fetching order', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  const { id } = (context?.params ?? {}) as { id: string };
  try {
    const parsedParams = OrderIdParamSchema.safeParse({ id });
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }

    const orderId = parsedParams.data.id;
    const json = await request.json();
    const parsedBody = UpdateOrderStatusSchema.safeParse(json);
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid update payload', details: parsedBody.error.flatten() }, { status: 400 });
    }

    const body: UpdateOrderRequest = parsedBody.data as UpdateOrderRequest;
    const order = orders.get(orderId);
    if (order) {
      // Update in-memory order
      if (body.status && body.status !== order.status) {
        const message = body.message || OrderManager.getStatusMessage(body.status);
        const timelineEntry: OrderTimeline = OrderManager.createTimelineEntry(
          body.status,
          message,
          body.details,
          body.trackingNumber
        );
        order.timeline.push(timelineEntry);
        const previousStatus = order.status;
        order.status = body.status;

        try {
          await OrderEmailService.sendStatusUpdate(order, body.status);
          debug.info(`Email notification sent for order ${order.orderNumber} status change: ${previousStatus} → ${body.status}`);
        } catch (emailError) {
          debug.warn('Failed to send email notification', emailError as Error);
        }
      }

      if (body.trackingNumber) order.trackingNumber = body.trackingNumber;
      if (body.estimatedDelivery) order.estimatedDelivery = body.estimatedDelivery;

      order.updatedAt = new Date();
      orders.set(orderId, order);

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          trackingNumber: order.trackingNumber,
          estimatedDelivery: order.estimatedDelivery,
          timeline: order.timeline,
        },
      });
    }

    // Update in DB when not in memory
    const message = body.message || (body.status ? OrderManager.getStatusMessage(body.status) : 'Order updated');
    const updated = await repo.updateStatus(orderId, {
      status: body.status ?? 'processing',
      message,
      details: body.details,
      trackingNumber: body.trackingNumber,
      estimatedDelivery: body.estimatedDelivery,
    });

    // send email best-effort: fetch again for composing template
    const dbOrder = await repo.findByIdDetailed(orderId);
    if (dbOrder && body.status) {
      try {
        const domainOrder = mapDbOrderToDomain(dbOrder as DbOrderDetailed);
        await OrderEmailService.sendStatusUpdate(domainOrder, body.status);
      } catch (emailError) {
        debug.warn('Failed to send email notification', emailError as Error);
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status,
        trackingNumber: updated.trackingNumber,
        estimatedDelivery: updated.estimatedDelivery,
      },
    });

  } catch (error) {
    debug.error('Error updating order', error as Error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}