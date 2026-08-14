import { NextRequest, NextResponse } from 'next/server';
import { 
  UpdateOrderRequest, 
  getOrderById,
  updateOrder,
  verifyOrderAccessToken
} from '@/lib/orders';
import { OrderEmailService } from '@/lib/email';
import { requireAdmin, requireUser } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import { buyShippingLabel } from '@/lib/shipping-provider';

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
    const body: UpdateOrderRequest & { action?: string } = await request.json();
    
    const existingOrder = await getOrderById(orderId);
    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    let label;
    if (body.action === 'buy_label') {
      label = await buyShippingLabel(existingOrder);
    }

    const order = await updateOrder(orderId, label ? {
      status: 'shipped',
      shippingCarrier: label.carrier,
      trackingNumber: label.trackingNumber,
      shipmentId: label.shipmentId,
      shippingLabelUrl: label.labelUrl,
      estimatedDelivery: label.estimatedDelivery,
      message: 'Shipping label purchased',
      details: `Shipping label purchased with ${label.provider}`,
    } : body);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== existingOrder.status) {
      // Send email notification for status change
      try {
        await OrderEmailService.sendStatusUpdate(order, order.status);
        console.log(`Email notification sent for order ${order.orderNumber} status change: ${existingOrder.status} -> ${order.status}`);
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the order update if email fails
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