// filepath: src/ui/components/commerce/orders/OrderTimeline.tsx
'use client';
import React from 'react';
import type { Order } from '@/lib/orders';
import { statusColors, statusIcons } from './status';
import { formatDate } from './date';

export default function OrderTimeline({ order }: { order: Order }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Timeline</h2>
      <div className="space-y-4">
        {order.timeline.map((entry) => (
          <div key={entry.id} className="flex items-start">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${statusColors[entry.status]}`}>
              {statusIcons[entry.status]}
            </div>
            <div className="ml-4 flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">{entry.message}</p>
                  {entry.details && (
                    <p className="text-sm text-gray-600 mt-1">{entry.details}</p>
                  )}
                  {entry.trackingNumber && (
                    <p className="text-sm text-blue-600 mt-1">Tracking: {entry.trackingNumber}</p>
                  )}
                </div>
                <p className="text-sm text-gray-500">{formatDate(entry.timestamp)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
