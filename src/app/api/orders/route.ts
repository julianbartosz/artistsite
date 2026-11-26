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
import { getShippingFulfillmentContext } from '@/lib/shipping-provider';
import { requireAdmin, requireUser } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import type { CartItemVariant, Product } from '@/lib/commerce';
import type { OrderCustomization } from '@/lib/orders';

function resolveCatalogVariant(product: Product, variant?: CartItemVariant): CartItemVariant | undefined {
  if (!variant) return undefined;
  const pick = (type: 'size' | 'framing' | 'material') => {
    const selected = variant[type];
    if (!selected?.id) return undefined;
    const pool = type === 'size'
      ? product.variants?.sizes
      : type === 'framing'
        ? product.variants?.framing
        : product.variants?.materials;
    const match = pool?.find((candidate) => candidate.id === selected.id);
    if (!match) throw new ApiError(400, `Invalid ${type} variant for product ${product.id}`, 'INVALID_VARIANT');
    return { id: match.id, name: match.name, price: match.priceModifier };
  };
  const resolved: CartItemVariant = {
    size: pick('size'),
    framing: pick('framing'),
    material: pick('material'),
  };
  return Object.values(resolved).some(Boolean) ? resolved : undefined;
}

function resolveCatalogCustomizations(product: Product, raw?: OrderCustomization[]): OrderCustomization[] | undefined {
  if (!raw?.length || !product.customizations?.length) return undefined;
  const resolved: OrderCustomization[] = [];
  for (const incoming of raw) {
    const def = product.customizations.find((candidate) => candidate.id === incoming.id);
    if (!def) continue;
    const value = String(incoming.value || '').trim();
    if (!value) continue;
    if (def.type === 'select') {
      const option = def.options?.find((opt) => opt.id === value || opt.name === value);
      if (!option) throw new ApiError(400, `Invalid customization option for ${def.name}`, 'INVALID_CUSTOMIZATION');
      resolved.push({ id: def.id, name: def.name, value: option.name, priceModifier: option.price });
    } else {
      resolved.push({ id: def.id, name: def.name, value, priceModifier: def.priceModifier || 0 });
    }
  }
  return resolved.length > 0 ? resolved : undefined;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body: CreateOrderRequest = await request.json();
    
    // Validate required fields
    if (!body.customerEmail || !Array.isArray(body.items) || body.items.length === 0) {
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
    
    // Convert cart items to order items with server-verified catalog pricing
    const orderItems: OrderItem[] = [];
    for (const item of body.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        );
      }

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        return NextResponse.json(
          { error: `Invalid quantity for product ${product.id}` },
          { status: 400 }
        );
      }

      const selectedVariant = resolveCatalogVariant(product, item.selectedVariant);
      const customizations = resolveCatalogCustomizations(product, item.customizations);

      let unitPrice = product.price;
      if (selectedVariant) {
        unitPrice += selectedVariant.size?.price || 0;
        unitPrice += selectedVariant.framing?.price || 0;
        unitPrice += selectedVariant.material?.price || 0;
      }
      if (customizations) {
        unitPrice += customizations.reduce((sum, custom) => sum + (custom.priceModifier || 0), 0);
      }
      unitPrice = Math.max(0, Math.round(unitPrice * 100) / 100);

      const orderItem: OrderItem = {
        id: crypto.randomUUID(),
        productId: item.productId,
        product,
        quantity,
        selectedVariant,
        customizations,
        unitPrice,
        totalPrice: Math.round(unitPrice * quantity * 100) / 100
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
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
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
      const [orders, shippingContext] = await Promise.all([
        getAllOrders({ status, search }),
        getShippingFulfillmentContext(),
      ]);
      const { listCertificatesByOrderIds } = await import('@/lib/certificates');
      const certificatesByOrder = await listCertificatesByOrderIds(orders.map((o) => o.id));
      return NextResponse.json({
        success: true,
        orders: orders.map((order) => ({
          ...order,
          certificates: certificatesByOrder[order.id] ?? [],
        })),
        shippingContext,
      });
    }

    const customerOrders = await getOrdersByCustomer({
      customerEmail: session.user.email,
      customerId: session.user.id,
      status
    });
    const { listCertificatesByOrderIds } = await import('@/lib/certificates');
    const certificatesByOrder = await listCertificatesByOrderIds(customerOrders.map((o) => o.id));

    return NextResponse.json({
      success: true,
      orders: customerOrders.map((order) => ({
        ...order,
        certificates: certificatesByOrder[order.id] ?? [],
      }))
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