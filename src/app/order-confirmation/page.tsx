'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OrderTracking from '@/components/OrderTracking';
import { Order } from '@/lib/orders';

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      
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
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    } else {
      setError('No order ID provided');
      setLoading(false);
    }
  }, [orderId, fetchOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading your order...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md">
          <div className="text-center">
            <div className="text-6xl text-red-500 mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'The requested order could not be found.'}</p>
            <Link
              href="/shop"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Header */}
      <div className="bg-green-600 text-white py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-green-100 text-lg">
            Thank you for your purchase. Your order #{order.orderNumber} has been received.
          </p>
          <p className="text-green-100 mt-2">
            A confirmation email has been sent to {order.customerEmail}
          </p>
        </div>
      </div>

      {/* Order Summary Cards */}
      <div className="max-w-4xl mx-auto px-6 -mt-8">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Order Total */}
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              ${order.total.toFixed(2)}
            </div>
            <p className="text-gray-600">Order Total</p>
            <p className="text-sm text-gray-500 mt-1">{order.items.length} item(s)</p>
          </div>

          {/* Payment Status */}
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl text-green-600 mb-2">💳</div>
            <p className="font-medium text-gray-900">Payment Confirmed</p>
            <p className="text-sm text-gray-500 mt-1">{order.paymentMethod || 'Card'}</p>
          </div>

          {/* Estimated Delivery */}
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-3xl text-blue-600 mb-2">📦</div>
            <p className="font-medium text-gray-900">
              {order.estimatedDelivery 
                ? new Date(order.estimatedDelivery).toLocaleDateString()
                : '3-5 Business Days'
              }
            </p>
            <p className="text-sm text-gray-500 mt-1">Estimated Delivery</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What&apos;s Next?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="text-2xl text-blue-600 mb-2">📧</div>
              <h3 className="font-medium text-gray-900 mb-1">Check Your Email</h3>
              <p className="text-sm text-gray-600">Order confirmation and receipt sent</p>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="text-2xl text-orange-600 mb-2">📱</div>
              <h3 className="font-medium text-gray-900 mb-1">Track Your Order</h3>
              <p className="text-sm text-gray-600">Updates sent as order progresses</p>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="text-2xl text-green-600 mb-2">🎨</div>
              <h3 className="font-medium text-gray-900 mb-1">Enjoy Your Art</h3>
              <p className="text-sm text-gray-600">Carefully packaged and shipped</p>
            </div>
          </div>
        </div>

        {/* Special Instructions */}
        {(order.specialInstructions || order.giftMessage) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Special Instructions</h2>
            {order.specialInstructions && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Delivery Instructions:</p>
                <p className="text-gray-900">{order.specialInstructions}</p>
              </div>
            )}
            {order.giftMessage && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Gift Message:</p>
                <p className="text-gray-900 italic">&ldquo;{order.giftMessage}&rdquo;</p>
              </div>
            )}
          </div>
        )}

        {/* Commission Notice */}
        {order.type === 'commission' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">🎨 Commission Order</h2>
            <p className="text-blue-800">
              This is a custom commission order. The artist will contact you within 24-48 hours 
              to discuss details, timeline, and next steps for your custom artwork.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Link
            href="/shop"
            className="flex-1 bg-blue-600 text-white text-center py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue Shopping
          </Link>
          <button
            onClick={() => window.print()}
            className="flex-1 bg-gray-600 text-white text-center py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Print Order Details
          </button>
        </div>
      </div>

      {/* Full Order Tracking */}
      <div className="bg-white">
        <OrderTracking order={order} />
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OrderConfirmationContent />
    </Suspense>
  );
}