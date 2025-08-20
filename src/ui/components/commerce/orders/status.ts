// filepath: src/ui/components/commerce/orders/status.ts
import type { OrderStatus } from '@/lib/orders';

export const statusSteps: OrderStatus[] = ['confirmed', 'processing', 'shipped', 'delivered'];

export const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-orange-100 text-orange-800 border-orange-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  refunded: 'bg-gray-100 text-gray-800 border-gray-200'
};

export const statusIcons: Record<OrderStatus, string> = {
  pending: '⏳',
  confirmed: '✅',
  processing: '📦',
  shipped: '🚚',
  delivered: '📦',
  cancelled: '❌',
  refunded: '💰'
};
