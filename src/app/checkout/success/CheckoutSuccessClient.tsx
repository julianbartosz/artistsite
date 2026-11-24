'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/components/CartContext';
import { Suspense } from 'react';
import OrderTracking from '@/components/OrderTracking';
import type { Order } from '@/lib/orders';
import { DEFAULT_SHOP_PAGE, type ShopPageContent } from '@/lib/site-content-shared';

interface OrderDetails {
  sessionId: string;
  paymentStatus: string;
  order: Order;
}

type CheckoutSuccessClientProps = {
  initialShopCopy?: ShopPageContent;
};

function CheckoutSuccessContent({ initialShopCopy }: CheckoutSuccessClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [supportEmail, setSupportEmail] = useState('');
  const [shopCopy] = useState(() => ({
    ...DEFAULT_SHOP_PAGE,
    ...(initialShopCopy || {}),
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;

    let active = true;

    fetch('/api/config/public')
      .then((response) => response.ok ? response.json() : null)
      .then((config) => {
        const configuredEmail = config?.SUPPORT_EMAIL || config?.CONTACT_EMAIL || config?.ARTIST_EMAIL;
        if (active && configuredEmail) setSupportEmail(configuredEmail);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

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
          setLoadError(null);
          // Clear the cart after successful purchase
          clearCart();
        } else {
          setLoadError('Payment succeeded, but we could not load your order details yet. Check your email receipt or contact the studio with your checkout session.');
          console.error('Failed to fetch order details');
        }
      } catch (error) {
        setLoadError('Payment may have succeeded, but we could not load your order details. Check your email receipt or contact the studio.');
        console.error('Error fetching order details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderDetails();
  }, [searchParams, router, clearCart]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing your order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted py-8 md:py-12">
      <div className="max-w-3xl mx-auto page-x">
        <div className="bg-surface rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
          {/* Success / recovery header */}
          <div className="text-center mb-8">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${loadError ? 'bg-amber-100' : 'bg-green-100'}`}>
              {loadError ? (
                <svg className="h-8 w-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 5a7 7 0 100 14 7 7 0 000-14z" />
                </svg>
              ) : (
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {loadError ? 'Payment received — order details pending' : shopCopy.successTitle}
            </h1>
            <p className="text-lg text-gray-600">
              {loadError
                ? 'Your payment may have succeeded. We could not load the order summary yet.'
                : shopCopy.successSubtitle}
            </p>
          </div>

          {loadError && (
            <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
              {loadError}
            </div>
          )}

          {/* Order Details */}
          {orderDetails && (
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Order Details</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order ID</span>
                  <span className="font-medium text-gray-900">{orderDetails.order.orderNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Email</span>
                  <span className="font-medium text-gray-900">{orderDetails.order.customerEmail}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-medium text-gray-900">
                    ${orderDetails.order.total.toFixed(2)} {orderDetails.order.currency}
                  </span>
                </div>
              </div>

              <div className="bg-surface-muted rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">What happens next?</h3>
                <div
                  className="prose prose-sm max-w-none text-gray-600 [&_ul]:space-y-2 [&_li]:flex [&_li]:items-start [&_li]:gap-2"
                  dangerouslySetInnerHTML={{ __html: shopCopy.successNextStepsHtml }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
            <Link
              href="/shop"
              className="btn-primary flex-1 py-3 px-6 transition-colors font-medium text-center"
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
              Questions about your order?{' '}
              {supportEmail ? (
                <>
                  Contact us at{' '}
                  <a href={`mailto:${supportEmail}`} className="text-gray-900 hover:underline">
                    {supportEmail}
                  </a>
                </>
              ) : (
                <Link href="/contact" className="text-gray-900 hover:underline">Contact us</Link>
              )}
            </p>
          </div>
        </div>
      </div>

      {orderDetails?.order && (
        <div className="mt-10 bg-surface border-t border-gray-200">
          <OrderTracking order={orderDetails.order} />
        </div>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
    </div>
  );
}

export default function CheckoutSuccessClient({ initialShopCopy }: CheckoutSuccessClientProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CheckoutSuccessContent initialShopCopy={initialShopCopy} />
    </Suspense>
  );
}