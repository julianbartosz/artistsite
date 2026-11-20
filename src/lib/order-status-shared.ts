/** Client-safe order status labels — keep free of server-only imports. */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  pending: 'Order placed and payment pending',
  confirmed: 'Payment confirmed and order received',
  processing: 'Order is being prepared for shipment',
  shipped: 'Order has been shipped',
  delivered: 'Order has been delivered',
  cancelled: 'Order has been cancelled',
  refunded: 'Order has been refunded',
};

export function orderStatusLabel(status: OrderStatus | string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] || status;
}

export function orderStatusDescription(status: OrderStatus): string {
  return ORDER_STATUS_DESCRIPTIONS[status];
}
