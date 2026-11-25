import { NextRequest, NextResponse } from 'next/server';
import { 
  UpdateOrderRequest, 
  finalizePaidOrder,
  getOrderById,
  refundOrder,
  updateOrder,
  verifyOrderAccessToken,
} from '@/lib/orders';
import { OrderEmailService } from '@/lib/email';
import { requireAdmin, requireUser } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import { buyShippingLabel, quoteShippingRates } from '@/lib/shipping-provider';
import type { OptionalParcelDimensions } from '@/lib/shipping';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = id;
    const token = new URL(request.url).searchParams.get('t');
    
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (verifyOrderAccessToken(orderId, token)) {
      return NextResponse.json({
        success: true,
        order
      });
    }

    let session;
    try {
      session = await requireUser();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      throw error;
    }

    const canViewOrder =
      order.customerId === session.user.id ||
      order.customerEmail === session.user.email ||
      session.user.isAdmin;

    if (!canViewOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order
    });

  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = id;
    await requireAdmin();
    const body: UpdateOrderRequest & {
      action?: string;
      shipmentId?: string;
      rateId?: string;
      parcel?: OptionalParcelDimensions;
    } = await request.json();
    
    const existingOrder = await getOrderById(orderId);
    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (body.action === 'mark_paid') {
      if (existingOrder.paymentStatus === 'paid') {
        return NextResponse.json({
          success: true,
          order: {
            id: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            status: existingOrder.status,
            paymentStatus: existingOrder.paymentStatus,
            paymentMethod: existingOrder.paymentMethod,
            timeline: existingOrder.timeline,
          },
        });
      }
      const order = await finalizePaidOrder(orderId, {
        paymentMethod: existingOrder.paymentMethod || 'manual',
        paidTotals: {
          shipping: existingOrder.shipping,
          tax: existingOrder.tax,
          total: existingOrder.total,
        },
      });
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          timeline: order.timeline,
        },
      });
    }

    if (body.action === 'refund') {
      const order = await refundOrder(orderId);
      try {
        await OrderEmailService.sendStatusUpdate(order, 'refunded');
      } catch (emailError) {
        console.error('Failed to send refund email notification:', emailError);
      }
      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          timeline: order.timeline,
        },
      });
    }

    if (body.action === 'quote_rates') {
      const quote = await quoteShippingRates(existingOrder, body.parcel);
      return NextResponse.json({
        success: true,
        quote,
      });
    }

    if (body.status === 'refunded') {
      return NextResponse.json(
        { error: 'Use the Issue refund action to refund through Stripe.' },
        { status: 400 }
      );
    }

    let label;
    if (body.action === 'buy_label') {
      label = await buyShippingLabel(existingOrder, {
        shipmentId: body.shipmentId,
        rateId: body.rateId,
        parcel: body.parcel,
      });
    }

    const labelSummary = label
      ? [
          label.carrier ? label.carrier.toUpperCase() : '',
          label.service || '',
          typeof label.rate === 'number' ? `$${label.rate.toFixed(2)}` : '',
        ].filter(Boolean).join(' · ')
      : '';

    const order = await updateOrder(orderId, label ? {
      status: 'shipped',
      shippingCarrier: label.carrier,
      trackingNumber: label.trackingNumber,
      shipmentId: label.shipmentId,
      shippingLabelUrl: label.labelUrl,
      estimatedDelivery: label.estimatedDelivery,
      message: 'Shipping label purchased',
      details: labelSummary ? `${labelSummary} via ${label.provider}` : `Shipping label purchased with ${label.provider}`,
    } : body);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== existingOrder.status) {
      try {
        await OrderEmailService.sendStatusUpdate(order, order.status);
        console.log(`Email notification sent for order ${order.orderNumber} status change: ${existingOrder.status} -> ${order.status}`);
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }

      try {
        const { maybeCreateOrderProgressPost } = await import('@/lib/order-progress-update');
        const progress = await maybeCreateOrderProgressPost(order, existingOrder.status);
        if (progress.created) {
          console.log(`Order progress post created (${progress.mode}): ${progress.slug}`);
        }
      } catch (progressError) {
        console.error('Failed to create order progress post:', progressError);
      }
    }

    console.log(`Order ${order.orderNumber} updated to status: ${order.status}`);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        shippingCarrier: order.shippingCarrier,
        trackingNumber: order.trackingNumber,
        shipmentId: order.shipmentId,
        shippingLabelUrl: order.shippingLabelUrl,
        estimatedDelivery: order.estimatedDelivery,
        label,
        timeline: order.timeline
      }
    });

  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}