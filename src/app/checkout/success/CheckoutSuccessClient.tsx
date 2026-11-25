'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Check } from 'lucide-react';
import { useCart } from '@/components/CartContext';
import OrderTracking, { OrderStatusPill } from '@/components/OrderTracking';
import type { Order } from '@/lib/orders';
import { formatPrice } from '@/lib/commerce';
import { DEFAULT_SHOP_PAGE, type ShopPageContent } from '@/lib/site-content-shared';

interface OrderDetails {
  mode?: 'stripe' | 'manual';
  sessionId: string;
  paymentStatus: string;
  order: Order;
  manualPaymentInstructions?: string;
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
    const orderParam = searchParams.get('order');
    const tokenParam = searchParams.get('t');

    if (!sessionId && (!orderParam || !tokenParam)) {
      router.push('/shop');
      return;
    }

    const fetchOrderDetails = async () => {
      try {
        const endpoint = orderParam && tokenParam
          ? `/api/checkout/success?order=${encodeURIComponent(orderParam)}&t=${encodeURIComponent(tokenParam)}`
          : `/api/checkout/success?session_id=${encodeURIComponent(sessionId!)}`;
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          setOrderDetails(data);
          setLoadError(null);
          clearCart();
        } else {
          setLoadError(
            orderParam
              ? 'We could not load your purchase request details. Please contact the studio if you need a copy.'
              : 'Payment succeeded, but we could not load your order details yet. Check your email receipt or contact the studio with your checkout session.',
          );
          console.error('Failed to fetch order details');
        }
      } catch (error) {
        setLoadError('We could not load your order details. Check your email receipt or contact the studio.');
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Confirming your order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted py-10 md:py-14">
      <div className="max-w-3xl mx-auto page-x space-y-6">
        <div className="rounded-xl border border-gray-200/80 bg-surface p-6 shadow-sm md:p-8">
          {/* Warm studio confirmation header */}
          <div className="text-center">
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                loadError
                  ? 'bg-amber-50 text-amber-800 ring-8 ring-amber-50/70'
                  : 'bg-primary/10 text-primary ring-8 ring-primary/5'
              }`}
            >
              {loadError ? (
                <AlertCircle className="h-7 w-7" aria-hidden="true" />
              ) : (
                <Check className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              {loadError
                ? 'Order details pending'
                : orderDetails?.mode === 'manual'
                  ? 'Purchase request received'
                  : shopCopy.successTitle}
            </h1>
            <p className="mt-2 text-base text-gray-600">
              {loadError
                ? 'We could not load the order summary yet.'
                : orderDetails?.mode === 'manual'
                  ? 'Thank you. The studio has received your request and will follow up with payment details.'
                  : shopCopy.successSubtitle}
            </p>
          </div>

          {loadError && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
              {loadError}
            </div>
          )}

          {orderDetails && (
            <div className="mt-8 border-t border-gray-100 pt-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Order</p>
                  <p className="mt-0.5 text-lg font-semibold text-gray-900">
                    #{orderDetails.order.orderNumber}
                  </p>
                </div>
                <OrderStatusPill status={orderDetails.order.status} />
              </div>

              <dl className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200/70 bg-surface-muted/60 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {orderDetails.mode === 'manual' ? 'Collector email' : 'Confirmation sent to'}
                  </dt>
                  <dd className="mt-1 font-medium text-gray-900 break-all">{orderDetails.order.customerEmail}</dd>
                </div>
                <div className="sm:text-right">
                  <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {orderDetails.mode === 'manual' && orderDetails.paymentStatus !== 'paid' ? 'Requested total' : 'Total paid'}
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">
                    {formatPrice(orderDetails.order.total, orderDetails.order.currency)} {orderDetails.order.currency}
                  </dd>
                </div>
              </dl>

              <div className="rounded-lg border border-gray-200/60 bg-surface-muted/40 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">What happens next</h2>
                {orderDetails.mode === 'manual' ? (
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>{orderDetails.manualPaymentInstructions || 'No payment was charged today. The studio will confirm availability and send payment instructions shortly.'}</p>
                    <p>Once payment is confirmed, your piece will be carefully packaged and shipped with tracking details.</p>
                  </div>
                ) : (
                  <div
                    className="prose prose-sm max-w-none text-gray-600 [&_ul]:space-y-1.5 [&_li]:leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: shopCopy.successNextStepsHtml }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Action Buttons — unified radius & button hierarchy */}
          <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row">
            <Link
              href="/shop"
              className="btn-primary flex-1 py-3 px-6 text-center text-sm font-medium transition-colors"
            >
              Continue Shopping
            </Link>
            <Link
              href={orderDetails?.order ? '/account' : '/contact'}
              className="btn-primary-outline flex-1 py-3 px-6 text-center text-sm font-medium transition-colors"
            >
              {orderDetails?.order ? 'View My Account' : 'Contact Us'}
            </Link>
          </div>

          <p className="mt-5 text-center text-xs text-gray-500">
            Questions about your order?{' '}
            {supportEmail ? (
              <>
                Email{' '}
                <a href={`mailto:${supportEmail}`} className="font-medium text-gray-800 underline-offset-4 hover:underline">
                  {supportEmail}
                </a>
              </>
            ) : (
              <Link href="/contact" className="font-medium text-gray-800 underline-offset-4 hover:underline">
                Contact the studio
              </Link>
            )}
          </p>
        </div>

        {orderDetails?.order && (
          <OrderTracking order={orderDetails.order} embedded />
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
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