import { NextRequest, NextResponse } from 'next/server';
import { 
  Order, 
  UpdateOrderRequest, 
  OrderManager, 
  OrderTimeline 
} from '@/lib/orders';
import { OrderEmailService } from '@/lib/email';

// Import the orders storage from the main route
// In production, this would be a database query
const orders: Map<string, Order> = new Map();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = id;
    
    const order = orders.get(orderId);
    if (!order) {
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
    const body: UpdateOrderRequest = await request.json();
    
    const order = orders.get(orderId);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Create a new timeline entry if status is being updated
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

      // Send email notification for status change
      try {
        await OrderEmailService.sendStatusUpdate(order, body.status);
        console.log(`📧 Email notification sent for order ${order.orderNumber} status change: ${previousStatus} → ${body.status}`);
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the order update if email fails
      }
    }

    // Update other fields
    if (body.trackingNumber) {
      order.trackingNumber = body.trackingNumber;
    }
    
    if (body.estimatedDelivery) {
      order.estimatedDelivery = body.estimatedDelivery;
    }

    // Update timestamp
    order.updatedAt = new Date();

    // Save the updated order
    orders.set(orderId, order);

    console.log(`Order ${order.orderNumber} updated to status: ${order.status}`);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNumber: order.trackingNumber,
        estimatedDelivery: order.estimatedDelivery,
        timeline: order.timeline
      }
    });

  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}