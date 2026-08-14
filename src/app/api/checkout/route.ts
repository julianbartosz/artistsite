import { NextRequest, NextResponse } from 'next/server';
import { CartItemVariant, Product, productImageSrc } from '@/lib/commerce';
import { getProductById } from '@/lib/commerce-server';
import { createOrder, Order, OrderCustomization, OrderItem, OrderManager, ShippingAddress, updateOrder } from '@/lib/orders';
import { InventoryService } from '@/lib/inventory';
import { getConfigBool } from '@/lib/config';
import { db } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { items, customerInfo, promoCode } = await req.json();

    if (!customerInfo?.email || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Customer email and cart items are required' },
        { status: 400 }
      );
    }

    if (process.env.PLAYWRIGHT_E2E === 'true') {
      return NextResponse.json(
        { error: 'Checkout reached the payment-provider boundary in e2e mode' },
        { status: 503 }
      );
    }

    const stripe = await getStripe();

    const shippingAddress: ShippingAddress = {
      firstName: customerInfo.firstName,
      lastName: customerInfo.lastName,
      address1: customerInfo.address,
      city: customerInfo.city,
      state: customerInfo.state,
      postalCode: customerInfo.postalCode,
      country: customerInfo.country || 'US',
      phone: customerInfo.phone,
    };

    const addressErrors = OrderManager.validateShippingAddress(shippingAddress);
    if (addressErrors.length > 0) {
      return NextResponse.json(
        { error: 'Invalid shipping address', details: addressErrors },
        { status: 400 }
      );
    }

    const orderItems = await resolveOrderItems(items);
    const rawSubtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.totalPrice, 0));
    const promoDiscount = await resolvePromoDiscount(promoCode, rawSubtotal);
    const subtotal = roundMoney(Math.max(0, rawSubtotal - promoDiscount.amount));
    const shipping = roundMoney(calculateProductShipping(orderItems, shippingAddress.country));
    const tax = 0;
    const total = roundMoney(subtotal + shipping + tax);

    const order: Order = {
      id: crypto.randomUUID(),
      orderNumber: OrderManager.generateOrderNumber(),
      type: 'standard',
      status: 'pending',
      customerEmail: customerInfo.email,
      items: orderItems,
      subtotal,
      shipping,
      tax,
      total,
      currency: 'USD',
      shippingAddress,
      billingAddress: shippingAddress,
      paymentStatus: 'pending',
      shippingMethod: 'standard',
      timeline: [
        OrderManager.createTimelineEntry(
          'pending',
          OrderManager.getStatusMessage('pending'),
          'Stripe checkout session created and awaiting payment confirmation'
        ),
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const persistedOrder = await createOrder(order);

    const unavailableProductId = await reserveTrackedInventory(persistedOrder);
    if (unavailableProductId) {
      await updateOrder(persistedOrder.id, {
        status: 'cancelled',
        message: 'Order cancelled because stock could not be reserved',
        details: `Product ${unavailableProductId} is no longer available`,
      });

      return NextResponse.json(
        { error: `Product is no longer available: ${unavailableProductId}` },
        { status: 409 }
      );
    }

    const discountCoupon = promoDiscount.amount > 0
      ? await stripe.coupons.create({
          amount_off: toCents(promoDiscount.amount),
          currency: 'usd',
          duration: 'once',
          name: promoDiscount.code ? `Promo ${promoDiscount.code}` : 'Artwork discount',
        })
      : undefined;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: orderItems.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.product.title,
            description: `${item.product.medium} • ${item.product.dimensions}`,
            images: absoluteStripeImageUrls(req.nextUrl.origin, productImageSrc(item.product)),
            metadata: {
              productId: item.product.id,
              category: item.product.category,
            },
          },
          unit_amount: toCents(item.unitPrice),
        },
        quantity: item.quantity,
      })),
      // Add shipping as a separate line item
      ...(shipping > 0 && {
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: {
                amount: Math.round(shipping * 100),
                currency: 'usd',
              },
              display_name: 'Standard Shipping',
              delivery_estimate: {
                minimum: {
                  unit: 'business_day',
                  value: 5,
                },
                maximum: {
                  unit: 'business_day',
                  value: 10,
                },
              },
            },
          },
        ],
      }),
      // Add tax calculation
      automatic_tax: {
        enabled: await getConfigBool('STRIPE_AUTOMATIC_TAX_ENABLED'),
      },
      ...(discountCoupon ? { discounts: [{ coupon: discountCoupon.id }] } : {}),
      mode: 'payment',
      success_url: `${req.nextUrl.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/checkout/cancel`,
      customer_email: customerInfo.email,
      client_reference_id: persistedOrder.id,
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU'],
      },
      metadata: {
        orderId: persistedOrder.id,
        orderNumber: persistedOrder.orderNumber,
        customerEmail: customerInfo.email,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        orderTotal: total.toString(),
        itemCount: orderItems.length.toString(),
        ...(promoDiscount.code ? {
          promoCode: promoDiscount.code,
          promoDiscount: promoDiscount.amount.toString(),
        } : {}),
      },
      // Store customer information for order fulfillment
      custom_fields: [
        {
          key: 'phone',
          label: {
            type: 'custom',
            custom: 'Phone Number',
          },
          type: 'text',
          optional: false,
        },
      ],
    });

    if (promoDiscount.code) {
      await incrementPromoUsage(promoDiscount.code);
    }

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe session creation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    const isValidationError = /required|Invalid|Unavailable|not available|not found|quantity/i.test(message);
    const isConfigurationError = /not configured/i.test(message);

    return NextResponse.json(
      { error: isValidationError || isConfigurationError ? message : 'Failed to create checkout session' },
      { status: isConfigurationError ? 503 : isValidationError ? 400 : 500 }
    );
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toCents(value: number): number {
  return Math.round(roundMoney(value) * 100);
}

async function resolvePromoDiscount(rawCode: unknown, subtotal: number): Promise<{ code?: string; amount: number }> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!code || subtotal <= 0) return { amount: 0 };

  const promo = await db.promoCode.findUnique({ where: { code } }).catch(() => null);
  if (!promo) return { amount: 0 };
  if (promo.expiresAt && promo.expiresAt < new Date()) return { amount: 0 };
  if (promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usageCount >= promo.usageLimit) return { amount: 0 };

  const rawAmount = promo.discountType === 'percentage'
    ? subtotal * (promo.discountValue / 100)
    : promo.discountValue;

  return { code, amount: roundMoney(Math.min(subtotal, Math.max(0, rawAmount))) };
}

async function incrementPromoUsage(code: string): Promise<void> {
  await db.promoCode.update({
    where: { code },
    data: { usageCount: { increment: 1 } },
  }).catch((error) => {
    console.error('Failed to increment promo code usage:', error);
  });
}

function absoluteStripeImageUrls(origin: string, imageUrl?: string): string[] {
  if (!imageUrl) return [];
  try {
    return [new URL(imageUrl, origin).toString()];
  } catch {
    return [];
  }
}

function resolveVariant(product: Product, variant?: CartItemVariant): CartItemVariant | undefined {
  if (!variant) return undefined;

  const resolve = (type: 'size' | 'framing' | 'material') => {
    const selected = variant[type];
    if (!selected?.id) return undefined;

    const variants = type === 'size'
      ? product.variants?.sizes
      : type === 'framing'
        ? product.variants?.framing
        : product.variants?.materials;

    const catalogVariant = variants?.find((candidate) => candidate.id === selected.id);
    if (!catalogVariant) {
      throw new Error(`Invalid ${type} variant for product ${product.id}`);
    }
    if (!catalogVariant.available || catalogVariant.stock === 0) {
      throw new Error(`Unavailable ${type} variant for product ${product.id}`);
    }

    return {
      id: catalogVariant.id,
      name: catalogVariant.name,
      price: catalogVariant.priceModifier,
    };
  };

  const resolved: CartItemVariant = {
    size: resolve('size'),
    framing: resolve('framing'),
    material: resolve('material'),
  };

  return Object.values(resolved).some(Boolean) ? resolved : undefined;
}

function resolveCustomizations(
  product: Product,
  values: Record<string, string> | undefined,
  variant: CartItemVariant | undefined
): OrderCustomization[] | undefined {
  if (!product.customizations?.length) return undefined;

  const customizations: OrderCustomization[] = [];
  for (const customization of product.customizations) {
    const rawValue = values?.[customization.id]?.trim() || '';

    if (customization.required && !rawValue) {
      throw new Error(`${customization.name} is required`);
    }
    if (!rawValue) continue;
    if (customization.maxLength && rawValue.length > customization.maxLength) {
      throw new Error(`${customization.name} must be ${customization.maxLength} characters or less`);
    }

    if (customization.type === 'select') {
      const option = customization.options?.find((candidate) => candidate.id === rawValue);
      if (!option) {
        throw new Error(`Invalid selection for ${customization.name}`);
      }

      customizations.push({
        id: customization.id,
        name: customization.name,
        value: option.name,
        priceModifier: option.price,
      });
      continue;
    }

    customizations.push({
      id: customization.id,
      name: customization.name,
      value: rawValue,
      priceModifier: customization.priceModifier || 0,
    });
  }

  if (customizations.length > 0 && variant) {
    variant.customizations = customizations.map((customization) => ({
      id: customization.id,
      name: customization.name,
      value: customization.value,
      price: customization.priceModifier || 0,
    }));
  }

  return customizations.length > 0 ? customizations : undefined;
}

async function resolveOrderItems(items: any[]): Promise<OrderItem[]> {
  return Promise.all(items.map(async (item) => {
    const productId = item.product?.id || item.productId;
    const product = productId ? await getProductById(productId) : undefined;
    if (!product) {
      throw new Error(`Product not found: ${productId || 'unknown'}`);
    }
    if (product.availability !== 'available') {
      throw new Error(`Product is not available for checkout: ${product.id}`);
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error(`Invalid quantity for product ${product.id}`);
    }

    const selectedVariant = resolveVariant(product, item.variant);
    const customizations = resolveCustomizations(product, item.customizations, selectedVariant);
    const variantTotal = [
      selectedVariant?.size?.price || 0,
      selectedVariant?.framing?.price || 0,
      selectedVariant?.material?.price || 0,
      ...(selectedVariant?.customizations?.map((customization) => customization.price) || []),
    ].reduce((sum, price) => sum + price, 0);
    const unitPrice = roundMoney(product.price + variantTotal);

    return {
      id: crypto.randomUUID(),
      productId: product.id,
      product,
      quantity,
      selectedVariant,
      customizations,
      unitPrice,
      totalPrice: roundMoney(unitPrice * quantity),
    };
  }));
}

function calculateProductShipping(items: OrderItem[], country: string): number {
  const isDomestic = country === 'US';
  return items.reduce((sum, item) => {
    const shippingCost = isDomestic ? item.product.shipping.domestic : item.product.shipping.international;
    return sum + shippingCost * item.quantity;
  }, 0);
}

async function reserveTrackedInventory(order: Order): Promise<string | null> {
  for (const item of order.items) {
    const inventory = await InventoryService.getInventoryStatus(item.productId);
    if (!inventory) continue;

    const reservationId = await InventoryService.reserveStock(item.productId, item.quantity, 15, {
      orderId: order.id,
      userId: order.customerId,
    });
    if (!reservationId) return item.productId;
  }

  return null;
}