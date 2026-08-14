import { NextRequest, NextResponse } from 'next/server';
import { 
  Order,
  CreateOrderRequest, 
  OrderManager, 
  OrderItem,
  OrderTimeline,
  createOrder,
  getAllOrders,
  getOrdersByCustomer
} from '@/lib/orders';
import { getAllProducts } from '@/lib/commerce-server';
import { requireUser } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';

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
        unitPrice += item.selectedVariant.size?.price || 0;
        unitPrice += item.selectedVariant.framing?.price || 0;
        unitPrice += item.selectedVariant.material?.price || 0;
        unitPrice += item.selectedVariant.customizations?.reduce((sum, custom) => sum + custom.price, 0) || 0;
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

    const savedOrder = await createOrder(order);

    console.log(`Order created: ${savedOrder.orderNumber} for ${savedOrder.customerEmail}`);

    return NextResponse.json({
      success: true,
      order: {
        id: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        status: savedOrder.status,
        total: savedOrder.total,
        currency: savedOrder.currency
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
    const status = searchParams.get('status');
    const scope = searchParams.get('scope');
    const search = searchParams.get('search');
    const session = await requireUser();

    if (session.user.isAdmin && scope === 'all') {
      const orders = await getAllOrders({ status, search });
      return NextResponse.json({
        success: true,
        orders
      });
    }

    const customerOrders = await getOrdersByCustomer({
      customerEmail: session.user.email,
      customerId: session.user.id,
      status
    });

    return NextResponse.json({
      success: true,
      orders: customerOrders
    });

  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}