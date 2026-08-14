'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { Order, OrderStatus } from '@/lib/orders';
import { formatCartItemVariant, productImageSrc } from '@/lib/commerce';
import { shippingCarrierLabel, trackingUrl } from '@/lib/shipping';

interface OrderTrackingProps {
  orderId?: string;
  order?: Order;
  customerEmail?: string;
  accessToken?: string;
}

const statusSteps: OrderStatus[] = ['confirmed', 'processing', 'shipped', 'delivered'];

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-orange-100 text-orange-800 border-orange-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  refunded: 'bg-gray-100 text-gray-800 border-gray-200'
};

const statusIcons: Record<OrderStatus, string> = {
  pending: 'P',
  confirmed: 'C',
  processing: 'P',
  shipped: 'S',
  delivered: 'D',
  cancelled: 'X',
  refunded: 'R'
};

export default function OrderTracking({ orderId, order: initialOrder, accessToken }: OrderTrackingProps) {
  const [order, setOrder] = useState<Order | null>(initialOrder || null);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    
    try {
      setLoading(true);
      const params = accessToken ? `?t=${encodeURIComponent(accessToken)}` : '';
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}${params}`);
      
      if (!response.ok) {
        throw new Error('Order not found');
      }
      
      const data = await response.json();
      setOrder(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    if (orderId && !initialOrder) {
      fetchOrder();
    }
  }, [orderId, initialOrder, fetchOrder]);

  const getStatusStepIndex = (status: OrderStatus): number => {
    return statusSteps.indexOf(status);
  };

  const isStepCompleted = (stepStatus: OrderStatus, currentStatus: OrderStatus): boolean => {
    const stepIndex = getStatusStepIndex(stepStatus);
    const currentIndex = getStatusStepIndex(currentStatus);
    return stepIndex <= currentIndex && currentStatus !== 'cancelled' && currentStatus !== 'refunded';
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const packageTrackingUrl = trackingUrl(order?.shippingCarrier, order?.trackingNumber);
  const carrierLabel = shippingCarrierLabel(order?.shippingCarrier);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
      {/* Order Header */}
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

      {/* Progress Steps */}
      {order.status !== 'cancelled' && order.status !== 'refunded' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Progress</h2>
          <div className="flex items-center justify-between">
            {statusSteps.map((step, index) => {
              const isCompleted = isStepCompleted(step, order.status);
              const isCurrent = step === order.status;
              
              return (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted || isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {isCompleted && !isCurrent ? '✓' : statusIcons[step]}
                  </div>
                  <span className={`mt-2 text-sm ${
                    isCompleted || isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500'
                  }`}>
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </span>
                  {index < statusSteps.length - 1 && (
                    <div className={`hidden md:block absolute w-full h-0.5 mt-5 ${
                      isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                    }`} style={{ left: '50%', right: '-50%' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shipping Info */}
      {order.trackingNumber && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Information</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Tracking Number</p>
              <p className="font-medium text-blue-600">{order.trackingNumber}</p>
              {carrierLabel && <p className="text-sm text-gray-500">{carrierLabel}</p>}
              {packageTrackingUrl && (
                <a href={packageTrackingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-medium text-blue-700 hover:text-blue-800">
                  Track package
                </a>
              )}
            </div>
            {order.estimatedDelivery && (
              <div>
                <p className="text-sm text-gray-600">Estimated Delivery</p>
                <p className="font-medium">{formatDate(order.estimatedDelivery)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Timeline */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Timeline</h2>
        <div className="space-y-4">
          {order.timeline.map((entry, index) => (
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

      {/* Order Items */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Items</h2>
        <div className="space-y-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
              <Image
                src={productImageSrc(item.product)}
                alt={item.product.title}
                width={64}
                height={64}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{item.product.title}</h3>
                <div className="text-sm text-gray-600 mt-1">
                  {formatCartItemVariant(item.selectedVariant) && (
                    <p>Variant: {formatCartItemVariant(item.selectedVariant)}</p>
                  )}
                  {item.customizations && item.customizations.length > 0 && (
                    <p>Customizations: {item.customizations.map(c => c.name).join(', ')}</p>
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

      {/* Shipping Address */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h2>
        <div className="text-gray-600">
          <p>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
          {order.shippingAddress.company && <p>{order.shippingAddress.company}</p>}
          <p>{order.shippingAddress.address1}</p>
          {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
          <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
          <p>{order.shippingAddress.country}</p>
          {order.shippingAddress.phone && <p>Phone: {order.shippingAddress.phone}</p>}
        </div>
      </div>
    </div>
  );
}