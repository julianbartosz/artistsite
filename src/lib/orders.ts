import { createHmac, timingSafeEqual } from 'crypto';
import { CartItemVariant, calculateVariantPrice, formatCartItemVariant, Product, productImageSrc } from './commerce';
import { db } from './db';
import { getProductById } from './commerce-server';
import { SHIPPING_CARRIERS, trackingUrl } from '@/lib/shipping';

export { SHIPPING_CARRIERS, trackingUrl };

function orderAccessSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
}

export function createOrderAccessToken(orderId: string): string {
  const secret = orderAccessSecret();
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET is required to create order access tokens');
  }

  return createHmac('sha256', secret)
    .update(`order:${orderId}`)
    .digest('base64url');
}

export function verifyOrderAccessToken(orderId: string, token?: string | null): boolean {
  const secret = orderAccessSecret();
  if (!secret || !token) return false;

  const expected = createHmac('sha256', secret)
    .update(`order:${orderId}`)
    .digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);

  return expectedBuffer.length === tokenBuffer.length && timingSafeEqual(expectedBuffer, tokenBuffer);
}

export function createOrderTrackingPath(orderId: string): string {
  const safeOrderId = encodeURIComponent(orderId);

  try {
    return `/orders/${safeOrderId}?t=${encodeURIComponent(createOrderAccessToken(orderId))}`;
  } catch {
    return `/orders/${safeOrderId}`;
  }
}

// Order Status Types
export type OrderStatus = 
  | 'pending'           // Payment pending
  | 'confirmed'         // Payment confirmed
  | 'processing'        // Order being prepared
  | 'shipped'           // Order shipped
  | 'delivered'         // Order delivered
  | 'cancelled'         // Order cancelled
  | 'refunded';         // Order refunded

export type OrderType = 'standard' | 'commission' | 'consultation';

// Order Item with full variant and customization details
export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  selectedVariant?: CartItemVariant;
  customizations?: OrderCustomization[];
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface OrderCustomization {
  id: string;
  name: string;
  value: string;
  priceModifier?: number;
}

// Shipping Information
export interface ShippingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

// Order Timeline Entry
export interface OrderTimeline {
  id: string;
  status: OrderStatus;
  timestamp: Date;
  message: string;
  details?: string;
  trackingNumber?: string;
}

// Complete Order Interface
export interface Order {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  
  // Customer Information
  customerEmail: string;
  customerId?: string;
  
  // Order Items
  items: OrderItem[];
  
  // Pricing
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  
  // Addresses
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  
  // Payment Information
  paymentIntentId?: string;
  paymentStatus: string;
  paymentMethod?: string;
  
  // Shipping
  shippingMethod?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  shipmentId?: string;
  shippingLabelUrl?: string;
  estimatedDelivery?: Date;
  
  // Timeline
  timeline: OrderTimeline[];
  
  // Special Instructions
  specialInstructions?: string;
  giftMessage?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Order Creation Request
export interface CreateOrderRequest {
  customerEmail: string;
  customerId?: string;
  items: {
    productId: string;
    quantity: number;
    selectedVariant?: CartItemVariant;
    customizations?: OrderCustomization[];
  }[];
  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;
  shippingMethod?: string;
  specialInstructions?: string;
  giftMessage?: string;
}

// Order Update Request
export interface UpdateOrderRequest {
  status?: OrderStatus;
  shippingCarrier?: string;
  trackingNumber?: string;
  shipmentId?: string;
  shippingLabelUrl?: string;
  estimatedDelivery?: Date;
  message?: string;
  details?: string;
}

const orderInclude = {
  items: true,
  timeline: true,
  shippingAddress: true,
} as const;

function fallbackProductFromItem(item: any): Product {
  return {
    id: item.productId,
    title: item.productTitle,
    description: '',
    price: item.unitPrice,
    currency: 'USD',
    category: 'unknown',
    medium: '',
    dimensions: '',
    year: new Date(item.createdAt).getFullYear(),
    availability: 'available',
    featured: false,
    images: {
      thumbnail: item.productImage,
      gallery: [item.productImage],
    },
    tags: [],
    shipping: {
      domestic: 0,
      international: 0,
    },
    specifications: {
      framed: false,
      signed: false,
      certificate: false,
    },
  };
}

function toShippingAddress(address: any): ShippingAddress {
  return {
    firstName: address?.firstName || '',
    lastName: address?.lastName || '',
    company: address?.company || undefined,
    address1: address?.address1 || '',
    address2: address?.address2 || undefined,
    city: address?.city || '',
    state: address?.state || '',
    postalCode: address?.postalCode || '',
    country: address?.country || '',
    phone: address?.phone || undefined,
  };
}

async function toDomainOrder(order: any): Promise<Order> {
  const items = await Promise.all(order.items.map(async (item: any) => {
    const product = await getProductById(item.productId) || fallbackProductFromItem(item);
    return {
      id: item.id,
      productId: item.productId,
      product,
      quantity: item.quantity,
      selectedVariant: item.selectedVariant || undefined,
      customizations: item.customizations || undefined,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      notes: item.notes || undefined,
    };
  }));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type as OrderType,
    status: order.status as OrderStatus,
    customerEmail: order.userEmail,
    customerId: order.userId || undefined,
    items,
    subtotal: order.subtotal,
    shipping: order.shipping,
    tax: order.tax,
    total: order.total,
    currency: order.currency,
    shippingAddress: toShippingAddress(order.shippingAddress),
    paymentIntentId: order.paymentIntentId || undefined,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod || undefined,
    shippingCarrier: order.shippingCarrier || undefined,
    trackingNumber: order.trackingNumber || undefined,
    shipmentId: order.shipmentId || undefined,
    shippingLabelUrl: order.shippingLabelUrl || undefined,
    estimatedDelivery: order.estimatedDelivery || undefined,
    timeline: order.timeline
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((entry: any) => ({
        id: entry.id,
        status: entry.status as OrderStatus,
        timestamp: entry.timestamp,
        message: entry.message,
        details: entry.details || undefined,
        trackingNumber: entry.trackingNumber || undefined,
      })),
    specialInstructions: order.specialInstructions || undefined,
    giftMessage: order.giftMessage || undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function ensureCustomerUser(
  email: string,
  customerId?: string,
  shippingAddress?: ShippingAddress,
  tx: any = db
): Promise<string> {
  if (customerId) {
    const existingById = await tx.user.findUnique({ where: { id: customerId } });
    if (existingById) return existingById.id;
  }

  const existingByEmail = await tx.user.findUnique({ where: { email } });
  if (existingByEmail) return existingByEmail.id;

  const user = await tx.user.create({
    data: {
      email,
      name: shippingAddress ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() : undefined,
      firstName: shippingAddress?.firstName,
      lastName: shippingAddress?.lastName,
      phone: shippingAddress?.phone,
    },
  });

  return user.id;
}

async function createAddress(userId: string, type: 'shipping' | 'billing', address: ShippingAddress, tx: any) {
  return tx.address.create({
    data: {
      userId,
      type,
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
    },
  });
}

// Email Template Types
export interface OrderEmailData {
  order: Order;
  customerName: string;
  isCommission?: boolean;
  customMessage?: string;
}

// Order Statistics
export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
  recentOrders: Order[];
}

export async function createOrder(order: Order): Promise<Order> {
  const persisted = await db.$transaction(async (tx) => {
    const userId = await ensureCustomerUser(order.customerEmail, order.customerId, order.shippingAddress, tx);
    const shippingAddress = await createAddress(userId, 'shipping', order.shippingAddress, tx);
    const billingAddress = order.billingAddress
      ? await createAddress(userId, 'billing', order.billingAddress, tx)
      : shippingAddress;

    return tx.order.create({
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        userId,
        userEmail: order.customerEmail,
        status: order.status,
        type: order.type,
        subtotal: order.subtotal,
        shipping: order.shipping,
        tax: order.tax,
        total: order.total,
        currency: order.currency,
        paymentIntentId: order.paymentIntentId,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
        shippingCarrier: order.shippingCarrier,
        trackingNumber: order.trackingNumber,
        shipmentId: order.shipmentId,
        shippingLabelUrl: order.shippingLabelUrl,
        estimatedDelivery: order.estimatedDelivery,
        specialInstructions: order.specialInstructions,
        giftMessage: order.giftMessage,
        items: {
          create: order.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            productTitle: item.product.title,
            productImage: productImageSrc(item.product),
            selectedVariant: item.selectedVariant as any,
            customizations: item.customizations as any,
            notes: item.notes,
          })),
        },
        timeline: {
          create: order.timeline.map((entry) => ({
            id: entry.id,
            status: entry.status,
            timestamp: entry.timestamp,
            message: entry.message,
            details: entry.details,
            trackingNumber: entry.trackingNumber,
          })),
        },
      },
      include: orderInclude,
    });
  });

  return toDomainOrder(persisted);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });

  return order ? toDomainOrder(order) : null;
}

export async function getOrdersByCustomer(filters: {
  customerEmail?: string | null;
  customerId?: string | null;
  status?: string | null;
}): Promise<Order[]> {
  const customerFilters = [
    filters.customerEmail ? { userEmail: filters.customerEmail } : null,
    filters.customerId ? { userId: filters.customerId } : null,
  ].filter(Boolean) as Array<{ userEmail: string } | { userId: string }>;

  const orders = await db.order.findMany({
    where: {
      ...(customerFilters.length > 0 ? { OR: customerFilters } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(orders.map(toDomainOrder));
}

export async function getAllOrders(filters: {
  status?: string | null;
  search?: string | null;
} = {}): Promise<Order[]> {
  const search = filters.search?.trim();
  const orders = await db.order.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(search ? {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { userEmail: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(orders.map(toDomainOrder));
}

export async function updateOrder(orderId: string, updates: UpdateOrderRequest): Promise<Order | null> {
  const existing = await getOrderById(orderId);
  if (!existing) return null;

  const newTrackingNumber = updates.trackingNumber?.trim();
  const newShipmentId = updates.shipmentId?.trim();
  const newShippingLabelUrl = updates.shippingLabelUrl?.trim();
  const hasNewTracking = Boolean(newTrackingNumber && newTrackingNumber !== existing.trackingNumber);
  const canAutoShip = !['shipped', 'delivered', 'cancelled', 'refunded'].includes(existing.status);
  const requestedStatusChanged = Boolean(updates.status && updates.status !== existing.status);
  const nextStatus = hasNewTracking && canAutoShip && !requestedStatusChanged ? 'shipped' : updates.status;

  const timelineUpdates = nextStatus && nextStatus !== existing.status
    ? {
        create: OrderManager.createTimelineEntry(
          nextStatus,
          updates.message || OrderManager.getStatusMessage(nextStatus),
          updates.details,
          newTrackingNumber || updates.trackingNumber
        ),
      }
    : undefined;

  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(updates.shippingCarrier ? { shippingCarrier: updates.shippingCarrier } : {}),
      ...(newTrackingNumber ? { trackingNumber: newTrackingNumber } : {}),
      ...(newShipmentId ? { shipmentId: newShipmentId } : {}),
      ...(newShippingLabelUrl ? { shippingLabelUrl: newShippingLabelUrl } : {}),
      ...(updates.estimatedDelivery ? { estimatedDelivery: updates.estimatedDelivery } : {}),
      ...(timelineUpdates ? { timeline: timelineUpdates } : {}),
    },
    include: orderInclude,
  });

  return toDomainOrder(updated);
}

export async function markOrderPaid(
  orderId: string,
  paymentIntentId?: string | null,
  paymentMethod?: string | null,
  paidTotals?: {
    shipping?: number | null;
    tax?: number | null;
    total?: number | null;
  }
): Promise<Order | null> {
  const existing = await getOrderById(orderId);
  if (!existing) return null;

  if (existing.paymentStatus === 'paid' && existing.status === 'confirmed') {
    return existing;
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentIntentId: paymentIntentId || existing.paymentIntentId,
      paymentMethod: paymentMethod || existing.paymentMethod,
      ...(paidTotals?.shipping !== undefined && paidTotals.shipping !== null ? { shipping: paidTotals.shipping } : {}),
      ...(paidTotals?.tax !== undefined && paidTotals.tax !== null ? { tax: paidTotals.tax } : {}),
      ...(paidTotals?.total !== undefined && paidTotals.total !== null ? { total: paidTotals.total } : {}),
      timeline: {
        create: OrderManager.createTimelineEntry(
          'confirmed',
          OrderManager.getStatusMessage('confirmed'),
          'Payment confirmed by Stripe',
          undefined
        ),
      },
    },
    include: orderInclude,
  });

  return toDomainOrder(updated);
}

// Order Management Functions
export class OrderManager {
  /**
   * Generate a unique order number
   */
  static generateOrderNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ART-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Calculate order totals from items
   */
  static calculateOrderTotals(items: OrderItem[], shippingCost: number = 0): {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
  } {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const shipping = shippingCost;
    const tax = subtotal * 0.08; // 8% tax rate (configurable)
    const total = subtotal + shipping + tax;

    return { subtotal, shipping, tax, total };
  }

  /**
   * Create order timeline entry
   */
  static createTimelineEntry(
    status: OrderStatus,
    message: string,
    details?: string,
    trackingNumber?: string
  ): OrderTimeline {
    return {
      id: crypto.randomUUID(),
      status,
      timestamp: new Date(),
      message,
      details,
      trackingNumber
    };
  }

  /**
   * Get status-specific timeline messages
   */
  static getStatusMessage(status: OrderStatus): string {
    const messages: Record<OrderStatus, string> = {
      pending: 'Order placed and payment pending',
      confirmed: 'Payment confirmed and order received',
      processing: 'Order is being prepared for shipment',
      shipped: 'Order has been shipped',
      delivered: 'Order has been delivered',
      cancelled: 'Order has been cancelled',
      refunded: 'Order has been refunded'
    };
    return messages[status];
  }

  /**
   * Validate shipping address
   */
  static validateShippingAddress(address: ShippingAddress): string[] {
    const errors: string[] = [];
    
    if (!address.firstName?.trim()) errors.push('First name is required');
    if (!address.lastName?.trim()) errors.push('Last name is required');
    if (!address.address1?.trim()) errors.push('Address is required');
    if (!address.city?.trim()) errors.push('City is required');
    if (!address.state?.trim()) errors.push('State is required');
    if (!address.postalCode?.trim()) errors.push('Postal code is required');
    if (!address.country?.trim()) errors.push('Country is required');
    
    return errors;
  }

  /**
   * Calculate shipping cost based on items and address
   */
  static calculateShippingCost(
    items: OrderItem[],
    shippingAddress: ShippingAddress,
    method?: string
  ): number {
    // Basic shipping calculation logic
    const isInternational = shippingAddress.country !== 'US';
    const hasLargeItems = items.some(item => 
      item.selectedVariant?.size?.name.includes('Large') || 
      item.selectedVariant?.size?.name.includes('24x36') ||
      item.product.dimensions.includes('24" x 36"')
    );
    
    let baseCost = 15; // Standard shipping
    
    if (method === 'express') baseCost *= 2;
    if (isInternational) baseCost *= 1.5;
    if (hasLargeItems) baseCost += 25;
    
    return Math.round(baseCost * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Check if order can be cancelled
   */
  static canCancelOrder(order: Order): boolean {
    return ['pending', 'confirmed'].includes(order.status);
  }

  /**
   * Check if order can be refunded
   */
  static canRefundOrder(order: Order): boolean {
    return ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status);
  }
}