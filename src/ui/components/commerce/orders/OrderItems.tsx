// filepath: src/ui/components/commerce/orders/OrderItems.tsx
'use client';
import React from 'react';
import Image from 'next/image';
import type { Order } from '@/lib/orders';

export default function OrderItems({ order }: { order: Order }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Items</h2>
      <div className="space-y-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
            <Image
              src={item.product.images.thumbnail}
              alt={item.product.title}
              width={64}
              height={64}
              className="w-16 h-16 object-cover rounded-lg"
            />
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{item.product.title}</h3>
              <div className="text-sm text-gray-600 mt-1">
                {item.selectedVariant && <p>Variant: {item.selectedVariant.name}</p>}
                {item.customizations && item.customizations.length > 0 && (
                  <p>Customizations: {item.customizations.map((c) => c.name).join(', ')}</p>
                )}
                <p>Quantity: {item.quantity}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900">${item.totalPrice.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
