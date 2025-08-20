// filepath: src/ui/components/commerce/orders/OrderTracking.tsx
'use client';
import React, { useCallback, useEffect, useState } from 'react';
import type { Order } from '@/lib/orders';
import OrderHeader from './OrderHeader';
import OrderProgress from './OrderProgress';
import OrderTimeline from './OrderTimeline';
import OrderItems from './OrderItems';
import ShippingInfo from './ShippingInfo';

export interface OrderTrackingProps {
  orderId?: string;
  order?: Order;
  customerEmail?: string;
}

export default function OrderTracking({ orderId, order: initialOrder }: OrderTrackingProps) {
  const [order, setOrder] = useState<Order | null>(initialOrder || null);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error('Order not found');
      const data = await res.json();
      setOrder(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId && !initialOrder) fetchOrder();
  }, [orderId, initialOrder, fetchOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-2 text-gray-600">Loading order details...</span>
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-800 mb-2">Order Not Found</h3>
        <p className="text-red-600">{error || 'The requested order could not be found.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <OrderHeader order={order} />
      {order.status !== 'cancelled' && order.status !== 'refunded' && (
        <OrderProgress status={order.status} />
      )}
      <ShippingInfo order={order} />
      <OrderTimeline order={order} />
      <OrderItems order={order} />
    </div>
  );
}
