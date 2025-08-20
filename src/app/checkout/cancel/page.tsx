'use client';

import Link from 'next/link';
import { useCart } from '@ui/components/cart/context/CartContext';
import { IconClose } from '@ui/icons';

export default function CheckoutCancelPage() {
  const { state } = useCart();

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-3xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* Cancel Icon */}
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
              <IconClose className="h-8 w-8 text-gray-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
            <p className="text-lg text-gray-600">Your order was not completed</p>
          </div>

          <div className="text-center mb-8">
            <p className="text-gray-600 mb-4">
              No worries! Your items are still in your cart and no payment was processed.
            </p>
            <p className="text-sm text-gray-500">
              You can continue shopping or try the checkout process again whenever you&apos;re ready.
            </p>
          </div>

          {/* Cart Summary */}
          {state.items.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Your Cart</h3>
              <div className="space-y-2 text-sm">
                {state.items.map((item) => (
                  <div key={item.product.id} className="flex justify-between">
                    <span className="text-gray-700">{item.product.title} × {item.quantity}</span>
                    <span className="font-medium">${(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>${state.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/checkout"
              className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors font-medium text-center"
            >
              Try Checkout Again
            </Link>
            <Link
              href="/shop"
              className="flex-1 border border-gray-300 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
            >
              Continue Shopping
            </Link>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Need help with your order?{' '}
              <Link href="/contact" className="text-gray-900 hover:underline">
                Contact us
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}