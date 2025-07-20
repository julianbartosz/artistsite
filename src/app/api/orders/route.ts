import { NextRequest, NextResponse } from 'next/server';
import { 
  Order, 
  CreateOrderRequest, 
  OrderManager, 
  OrderItem,
  OrderTimeline 
} from '@/lib/orders';
import { getAllProducts } from '@/lib/commerce';
import { OrderEmailService } from '@/lib/email';

// In-memory order storage (replace with database in production)
const orders: Map<string, Order> = new Map();

export async function POST(request: NextRequest) {
  try {
    const body: CreateOrderRequest = await request.json();
    
    // Validate required fields
    if (!body.customerEmail || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Customer email and items are required' },
        { status: 400 }
      );
    }

    // Validate shipping address
    const addressErrors = OrderManager.validateShippingAddress(body.shippingAddress);
    if (addressErrors.length > 0) {
      return NextResponse.json(
        { error: 'Invalid shipping address', details: addressErrors },
        { status: 400 }
      );
    }

    // Get all products for validation
    const products = await getAllProducts();
    
    // Convert cart items to order items with full product data
    const orderItems: OrderItem[] = [];
    for (const item of body.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        );
      }

      // Calculate item pricing
      let unitPrice = product.price;
      if (item.selectedVariant) {
        unitPrice += item.selectedVariant.priceModifier || 0;
      }
      if (item.customizations) {
        unitPrice += item.customizations.reduce((sum, custom) => 
          sum + (custom.priceModifier || 0), 0
        );
      }

      const orderItem: OrderItem = {
        id: crypto.randomUUID(),
        productId: item.productId,
        product,
        quantity: item.quantity,
        selectedVariant: item.selectedVariant,
        customizations: item.customizations,
        unitPrice,
        totalPrice: unitPrice * item.quantity
      };

      orderItems.push(orderItem);
    }

    // Calculate shipping cost
    const shippingCost = OrderManager.calculateShippingCost(
      orderItems,
      body.shippingAddress,
      body.shippingMethod
    );

    // Calculate totals
    const totals = OrderManager.calculateOrderTotals(orderItems, shippingCost);

    // Create initial timeline
    const initialTimeline: OrderTimeline[] = [
      OrderManager.createTimelineEntry(
        'pending',
        OrderManager.getStatusMessage('pending'),
        'Order created and awaiting payment confirmation'
      )
    ];

    // Create the order
    const order: Order = {
      id: crypto.randomUUID(),
      orderNumber: OrderManager.generateOrderNumber(),
      type: 'standard',
      status: 'pending',
      customerEmail: body.customerEmail,
      customerId: body.customerId,
      items: orderItems,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      tax: totals.tax,
      total: totals.total,
      currency: 'USD',
      shippingAddress: body.shippingAddress,
      billingAddress: body.billingAddress || body.shippingAddress,
      paymentStatus: 'pending',
      shippingMethod: body.shippingMethod || 'standard',
      timeline: initialTimeline,
      specialInstructions: body.specialInstructions,
      giftMessage: body.giftMessage,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store the order
    orders.set(order.id, order);

    console.log(`Order created: ${order.orderNumber} for ${order.customerEmail}`);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        currency: order.currency
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('customerEmail');
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');

    if (!customerEmail && !customerId) {
      return NextResponse.json(
        { error: 'Customer email or ID is required' },
        { status: 400 }
      );
    }

    // Filter orders by customer
    const customerOrders = Array.from(orders.values()).filter(order => {
      const matchesCustomer = customerEmail 
        ? order.customerEmail === customerEmail 
        : order.customerId === customerId;
      
      const matchesStatus = status ? order.status === status : true;
      
      return matchesCustomer && matchesStatus;
    });

    // Sort by creation date (newest first)
    customerOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({
      success: true,
      orders: customerOrders
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}