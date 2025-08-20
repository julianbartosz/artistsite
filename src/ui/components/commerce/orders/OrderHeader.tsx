// filepath: src/ui/components/commerce/orders/OrderHeader.tsx
'use client';
import React from 'react';
import type { Order } from '@/lib/orders';
import { statusColors, statusIcons } from './status';
import { formatDate } from './date';

export default function OrderHeader({ order }: { order: Order }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order #{order.orderNumber}</h1>
          <p className="text-gray-600 mt-1">Placed on {formatDate(order.createdAt)}</p>
          <p className="text-gray-600">Customer: {order.customerEmail}</p>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusColors[order.status]}`}>
            <span className="mr-2">{statusIcons[order.status]}</span>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          <p className="text-2xl font-bold text-gray-900 mt-2">${order.total.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
