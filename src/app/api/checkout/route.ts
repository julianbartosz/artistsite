import { NextRequest, NextResponse } from 'next/server';
import {
  allowedCheckoutCountriesForItems,
  calculateItemShipping,
  CartItemVariant,
  E2E_CHECKOUT_SESSION_PREFIX,
  Product,
  productAllowsCountry,
  productImageSrc,
} from '@/lib/commerce';
import { isVideoUrl } from '@/lib/image-variant-url';
import { getProductById } from '@/lib/commerce-server';
import {
  cancelCheckout,
  createOrder,
  createOrderAccessToken,
  finalizePaidOrder,
  Order,
  OrderCustomization,
  OrderItem,
  OrderManager,
  recordCheckoutSession,
  ShippingAddress,
  updateOrder,
  verifyOrderAccessToken,
} from '@/lib/orders';
import { InventoryService } from '@/lib/inventory';
import { getConfigBool, getSiteUrl } from '@/lib/config';
import { sendManualOrderRequestEmails } from '@/lib/email';
import { resolvePromoDiscount, roundPromoMoney } from '@/lib/promo-codes';
import { getCheckoutRuntimeConfig, getStripe, upsertStripeCheckoutCustomer } from '@/lib/stripe';
import { createOrderInquiryThread } from '@/lib/studio-inbox';

// Stripe requires sessions to live at least 30 minutes from its own creation time. Holds
// outlive the session so stock stays reserved for as long as the session can be paid.
const CHECKOUT_SESSION_MINUTES = 31;
const CHECKOUT_HOLD_MINUTES = CHECKOUT_SESSION_MINUTES + 5;

export async function POST(req: NextRequest) {
  try {
    const { items, customerInfo, promoCode, giftMessage } = await req.json();

    if (!customerInfo?.email || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Customer email and cart items are required' },
        { status: 400 }
      );
    }

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
    const shippingPolicy = allowedCheckoutCountriesForItems(orderItems);
    if (shippingPolicy.hasConflict) {
      return NextResponse.json(
        { error: 'The items in your cart do not share an available shipping region. Please check out separately.' },
        { status: 400 },
      );
    }
    const disallowedItem = orderItems.find((item) => !productAllowsCountry(item.product, shippingAddress.country));
    if (disallowedItem) {
      const regionNote = shippingAddress.country === 'US'
        ? 'does not ship to the United States'
        : 'is available for US shipping only';
      return NextResponse.json(
        { error: `"${disallowedItem.product.title}" ${regionNote}.` },
        { status: 400 },
      );
    }
    const rawSubtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.totalPrice, 0));
    const promoDiscount = await resolvePromoDiscount(promoCode, rawSubtotal);
    const submittedPromo = typeof promoCode === 'string' ? promoCode.trim() : '';
    if (submittedPromo && promoDiscount.amount <= 0) {
      return NextResponse.json(
        { error: promoDiscount.error || 'Invalid promo code' },
        { status: 400 },
      );
    }
    const subtotal = roundMoney(Math.max(0, rawSubtotal - promoDiscount.amount));
    const shipping = roundMoney(calculateProductShipping(orderItems, shippingAddress.country));
    const tax = 0;
    const total = roundMoney(subtotal + shipping + tax);

    const isE2e = process.env.PLAYWRIGHT_E2E === 'true';
    const checkoutConfig = isE2e ? null : await getCheckoutRuntimeConfig();
    const isManualCheckout = !isE2e && checkoutConfig?.checkoutMode === 'manual';

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
      paymentMethod: isManualCheckout ? 'manual' : undefined,
      shippingMethod: 'standard',
      giftMessage: typeof giftMessage === 'string' && giftMessage.trim()
        ? giftMessage.trim().slice(0, 500)
        : undefined,
      timeline: [
        OrderManager.createTimelineEntry(
          'pending',
          isManualCheckout
            ? 'Purchase request received'
            : OrderManager.getStatusMessage('pending'),
          isE2e
            ? 'E2E checkout session created'
            : isManualCheckout
              ? 'Manual purchase request submitted. Awaiting studio confirmation and payment'
              : 'Stripe checkout session created and awaiting payment confirmation'
        ),
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isManualCheckout) {
      for (const item of orderItems) {
        const purchasable = await InventoryService.isPurchasable(item.productId, item.product.availability);
        if (!purchasable) {
          return NextResponse.json(
            { error: `Product is no longer available: ${item.product.title}` },
            { status: 409 },
          );
        }
      }

      const persistedOrder = await createOrder(order);
      const customerName = `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() || customerInfo.email;
      const itemSummary = orderItems.map((item) => `${item.quantity} × ${item.product.title} ($${item.totalPrice.toFixed(2)})`).join('\n');
      const inboxNote = [
        `New purchase request for order #${persistedOrder.orderNumber} ($${persistedOrder.total.toFixed(2)} ${persistedOrder.currency}).`,
        itemSummary,
        `Ship to: ${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.postalCode}, ${shippingAddress.country}`,
        persistedOrder.giftMessage ? `Collector note: ${persistedOrder.giftMessage}` : null,
      ].filter(Boolean).join('\n\n');

      await createOrderInquiryThread({
        userId: persistedOrder.customerId ?? null,
        userEmail: persistedOrder.customerEmail,
        userName: customerName,
        orderId: persistedOrder.id,
        orderNumber: persistedOrder.orderNumber,
        message: inboxNote,
      }).catch((err) => {
        console.error('Failed to link manual purchase request to Studio Inbox:', err);
      });

      await sendManualOrderRequestEmails(
        persistedOrder,
        checkoutConfig.manualPaymentInstructions,
      ).catch((err) => {
        console.error('Failed to email manual purchase request notification:', err);
      });

      return NextResponse.json({
        manualRequest: true,
        orderId: persistedOrder.id,
        orderNumber: persistedOrder.orderNumber,
        accessToken: createOrderAccessToken(persistedOrder.id),
      });
    }

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

    if (isE2e) {
      await finalizePaidOrder(persistedOrder.id, {
        paymentIntentId: `e2e_payment_${persistedOrder.id}`,
        paymentMethod: 'card',
        paidTotals: { shipping, tax, total },
        promoCode: promoDiscount.code,
      });

      return NextResponse.json({
        sessionId: `${E2E_CHECKOUT_SESSION_PREFIX}${persistedOrder.id}`,
        e2e: true,
      });
    }

    const stripe = await getStripe();
    const checkoutOrigin = await resolveCheckoutOrigin(req);
    const returnUrl = `${checkoutOrigin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelToken = createOrderAccessToken(persistedOrder.id);

    let session;
    try {
      const [discountCoupon, { customer: stripeCustomer, params: customerParams }, automaticTaxEnabled] = await Promise.all([
        promoDiscount.amount > 0
          ? stripe.coupons.create({
              amount_off: toCents(promoDiscount.amount),
              currency: 'usd',
              duration: 'once',
              name: promoDiscount.code ? `Promo ${promoDiscount.code}` : 'Artwork discount',
            })
          : Promise.resolve(undefined),
        upsertStripeCheckoutCustomer(stripe, {
          email: customerInfo.email,
          firstName: shippingAddress.firstName,
          lastName: shippingAddress.lastName,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
          phone: shippingAddress.phone,
        }),
        getConfigBool('STRIPE_AUTOMATIC_TAX_ENABLED'),
      ]);

      session = await stripe.checkout.sessions.create({
        ui_mode: 'custom',
        payment_method_types: ['card'],
        wallet_options: {
          link: { display: 'never' },
        },
        line_items: orderItems.map((item) => {
          const itemDescription = [item.product.medium, item.product.dimensions].filter(Boolean).join(' • ');
          return {
            price_data: {
              currency: 'usd',
              product_data: {
                name: item.product.title,
                ...(itemDescription ? { description: itemDescription } : {}),
                images: absoluteStripeImageUrls(checkoutOrigin, productImageSrc(item.product)),
                metadata: {
                  productId: item.product.id,
                  category: item.product.category,
                },
              },
              unit_amount: toCents(item.unitPrice),
            },
            quantity: item.quantity,
          };
        }),
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
        automatic_tax: {
          enabled: automaticTaxEnabled,
        },
        ...(discountCoupon ? { discounts: [{ coupon: discountCoupon.id }] } : {}),
        mode: 'payment',
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_MINUTES * 60,
        return_url: returnUrl,
        customer: stripeCustomer.id,
        customer_update: {
          address: 'auto',
          name: 'auto',
        },
        client_reference_id: persistedOrder.id,
        billing_address_collection: 'auto',
        payment_intent_data: {
          receipt_email: customerParams.email,
          ...(!shippingPolicy.isPickupOnly ? { shipping: customerParams.shipping } : {}),
        },
        metadata: {
          orderId: persistedOrder.id,
          orderNumber: persistedOrder.orderNumber,
          customerEmail: customerParams.email,
          customerName: customerParams.name,
          orderTotal: total.toString(),
          itemCount: orderItems.length.toString(),
          ...(promoDiscount.code ? {
            promoCode: promoDiscount.code,
            promoDiscount: promoDiscount.amount.toString(),
          } : {}),
        },
      });
    } catch (stripeError) {
      await InventoryService.releaseActiveReservationsForOrder(persistedOrder.id);
      throw stripeError;
    }

    await recordCheckoutSession(persistedOrder.id, session.id);

    return NextResponse.json({
      sessionId: session.id,
      clientSecret: session.client_secret,
      orderId: persistedOrder.id,
      cancelToken,
    });
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

export async function DELETE(req: NextRequest) {
  const { orderId, token } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string' || !verifyOrderAccessToken(orderId, typeof token === 'string' ? token : null)) {
    return NextResponse.json({ error: 'Invalid checkout reference' }, { status: 400 });
  }

  try {
    await cancelCheckout(orderId);
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    console.error('Checkout cancellation error:', error);
    return NextResponse.json({ error: 'Failed to cancel checkout' }, { status: 500 });
  }
}

function roundMoney(value: number): number {
  return roundPromoMoney(value);
}

function toCents(value: number): number {
  return Math.round(roundMoney(value) * 100);
}

function absoluteStripeImageUrls(origin: string, imageUrl?: string): string[] {
  if (!imageUrl || isVideoUrl(imageUrl)) return [];
  try {
    return [new URL(imageUrl, origin).toString()];
  } catch {
    return [];
  }
}

function isUsablePublicOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === '0.0.0.0') return false;
    if ((host === 'localhost' || host === '127.0.0.1') && process.env.NODE_ENV === 'production') return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Stripe success/cancel URLs must be browser-reachable. On Fly, Next can see
 * req.nextUrl.origin as https://0.0.0.0:3000 (listen address), which breaks redirect.
 */
async function resolveCheckoutOrigin(req: NextRequest): Promise<string> {
  const configured = (await getSiteUrl()).replace(/\/$/, '');
  if (configured && isUsablePublicOrigin(configured)) {
    return configured;
  }

  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedProto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0]?.trim() || 'https';
  if (forwardedHost) {
    const host = forwardedHost.split(',')[0]?.trim();
    if (host) {
      const candidate = `${forwardedProto}://${host}`;
      if (isUsablePublicOrigin(candidate)) return candidate;
    }
  }

  if (isUsablePublicOrigin(req.nextUrl.origin)) {
    return req.nextUrl.origin;
  }

  throw new Error('Checkout origin is not configured. Set NEXT_PUBLIC_SITE_URL to your public site URL.');
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
    const purchasable = await InventoryService.isPurchasable(product.id, product.availability, quantity);
    if (!purchasable) {
      throw new Error(`Product is not available for checkout: ${product.id}`);
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error(`Invalid quantity for product ${product.id}`);
    }

    const selectedVariant = resolveVariant(product, item.variant);
    const customizations = resolveCustomizations(product, item.customizations, selectedVariant);
    const variantTotal = [
      selectedVariant?.size?.price || 0,
      selectedVariant?.framing?.price || 0,
      selectedVariant?.material?.price || 0,
      ...(customizations?.map((customization) => customization.priceModifier || 0) || []),
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
  return items.reduce((sum, item) => {
    return sum + calculateItemShipping(item.product, country) * item.quantity;
  }, 0);
}

async function reserveTrackedInventory(order: Order): Promise<string | null> {
  if (process.env.PLAYWRIGHT_E2E === 'true') {
    return null;
  }

  const reservedIds: string[] = [];

  for (const item of order.items) {
    const inventory = await InventoryService.getInventoryStatus(item.productId);
    if (!inventory) continue;

    const reservationId = await InventoryService.reserveStock(item.productId, item.quantity, CHECKOUT_HOLD_MINUTES, {
      orderId: order.id,
      userId: order.customerId,
    });
    if (!reservationId) {
      await Promise.all(reservedIds.map((id) => InventoryService.releaseReservation(id)));
      return item.productId;
    }
    reservedIds.push(reservationId);
  }

  return null;
}
