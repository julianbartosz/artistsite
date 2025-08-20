'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@ui/components/cart/context/CartContext';
import { Suspense } from 'react';
import { IconCheck, IconCheckCircleSolid } from '@ui/icons';

interface OrderDetails {
  sessionId: string;
  customerEmail: string;
  amount: number;
  items: any[];
}

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      router.push('/shop');
      return;
    }

    // Retrieve session details and clear cart
    const fetchOrderDetails = async () => {
      try {
        const response = await fetch(`/api/checkout/success?session_id=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setOrderDetails(data);
          // Clear the cart after successful purchase
          clearCart();
        } else {
          console.error('Failed to fetch order details');
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderDetails();
  }, [searchParams, router, clearCart]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <IconCheck className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
            <p className="text-lg text-gray-600">Thank you for your purchase</p>
          </div>

          {/* Order Details */}
          {orderDetails && (
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Details</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order ID</span>
                  <span className="font-medium text-gray-900">{orderDetails.sessionId.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Email</span>
                  <span className="font-medium text-gray-900">{orderDetails.customerEmail}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-medium text-gray-900">
                    ${(orderDetails.amount / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">What happens next?</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <IconCheckCircleSolid className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    You&apos;ll receive an order confirmation email shortly
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheckCircleSolid className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    We&apos;ll prepare your artwork for shipping within 2-3 business days
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheckCircleSolid className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    You&apos;ll receive tracking information once your order ships
                  </li>
                  <li className="flex items-start gap-2">
                    <IconCheckCircleSolid className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    All artwork is carefully packaged and fully insured
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
            <Link
              href="/shop"
              className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors font-medium text-center"
            >
              Continue Shopping
            </Link>
            <Link
              href="/contact"
              className="flex-1 border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
            >
              Contact Us
            </Link>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Questions about your order? Contact us at{' '}
              <a href="mailto:orders@artistsite.com" className="text-gray-900 hover:underline">
                orders@artistsite.com
              </a>
            </p>
          </div>
        </div>
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

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}