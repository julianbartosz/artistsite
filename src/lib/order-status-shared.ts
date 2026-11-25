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

const LEGACY_TIMELINE_MESSAGE_MAP: Record<string, string> = {
  'Order placed and payment pending': 'Order received',
  'Payment confirmed and order received': 'Order confirmed',
};

const LEGACY_TIMELINE_DETAILS_MAP: Record<string, string> = {
  'Stripe checkout session created and awaiting payment confirmation': 'We received your order details and began verifying payment.',
  'Payment confirmed by Stripe': 'Payment received — your artwork is reserved and queued for studio packaging.',
};

/** Present internal payment-processor timeline notes warmly for collectors. */
export function humanizeOrderTimelineEntry(entry: {
  message: string;
  details?: string;
}): { message: string; details?: string } {
  const message = LEGACY_TIMELINE_MESSAGE_MAP[entry.message] ?? entry.message;
  const details = entry.details
    ? (LEGACY_TIMELINE_DETAILS_MAP[entry.details] ?? entry.details)
    : undefined;
  return { message, details };
}
