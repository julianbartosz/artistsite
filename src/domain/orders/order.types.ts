// Types for Orders domain
import type { Product, ProductVariant, ProductCustomization } from '@domain/shop';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type OrderType = 'standard' | 'commission' | 'consultation';

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

export interface OrderTimeline {
  id: string;
  status: OrderStatus;
  timestamp: Date;
  message: string;
  details?: string;
  trackingNumber?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;

  customerEmail: string;
  customerId?: string;

  items: OrderItem[];

  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;

  shippingAddress: ShippingAddress;
  billingAddress?: ShippingAddress;

  paymentIntentId?: string;
  paymentStatus: string;
  paymentMethod?: string;

  shippingMethod?: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;

  timeline: OrderTimeline[];

  specialInstructions?: string;
  giftMessage?: string;

  createdAt: Date;
  updatedAt: Date;
}

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

export interface UpdateOrderRequest {
  status?: OrderStatus;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  message?: string;
  details?: string;
}

export interface OrderEmailData {
  order: Order;
  customerName: string;
  isCommission?: boolean;
  customMessage?: string;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<OrderStatus, number>;
  recentOrders: Order[];
}
