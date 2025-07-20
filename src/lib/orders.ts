import { Product, ProductVariant, ProductCustomization } from './commerce';

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
  selectedVariant?: ProductVariant;
  customizations?: ProductCustomization[];
  unitPrice: number;
  totalPrice: number;
  notes?: string;
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
  trackingNumber?: string;
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
    selectedVariant?: ProductVariant;
    customizations?: ProductCustomization[];
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
  trackingNumber?: string;
  estimatedDelivery?: Date;
  message?: string;
  details?: string;
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
      item.selectedVariant?.name.includes('Large') || 
      item.selectedVariant?.name.includes('24x36')
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