// filepath: src/ui/components/commerce/orders/ShippingInfo.tsx
'use client';
import React from 'react';
import type { Order } from '@/lib/orders';
import { formatDate } from './date';

export default function ShippingInfo({ order }: { order: Order }) {
  const est = formatDate(order.estimatedDelivery);
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Information</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {order.trackingNumber && (
            <div>
              <p className="text-sm text-gray-600">Tracking Number</p>
              <p className="font-medium text-blue-600">{order.trackingNumber}</p>
            </div>
          )}
          {order.shippingMethod && (
            <div>
              <p className="text-sm text-gray-600">Shipping Method</p>
              <p className="font-medium">{order.shippingMethod}</p>
            </div>
          )}
          {est && (
            <div>
              <p className="text-sm text-gray-600">Estimated Delivery</p>
              <p className="font-medium">{est}</p>
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Shipping Address</h3>
          <div className="text-gray-600">
            <p>
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            {order.shippingAddress.company && <p>{order.shippingAddress.company}</p>}
            <p>{order.shippingAddress.address1}</p>
            {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.postalCode}
            </p>
            <p>{order.shippingAddress.country}</p>
            {order.shippingAddress.phone && <p>Phone: {order.shippingAddress.phone}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
