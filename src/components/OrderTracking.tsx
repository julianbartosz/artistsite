'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Package,
  RotateCcw,
  Sparkles,
  Truck,
  XCircle,
} from 'lucide-react';
import type { Order } from '@/lib/orders';
import {
  humanizeOrderTimelineEntry,
  orderStatusDescription,
  orderStatusLabel,
  type OrderStatus,
} from '@/lib/order-status-shared';
import { shippingAddressIsPopulated } from '@/lib/shipping-address';
import { formatCartItemVariant, formatPrice } from '@/lib/commerce';
import ProductImage from '@/components/ProductImage';
import { shippingCarrierLabel, trackingUrl } from '@/lib/shipping';
import { OrderProgressSteps } from '@/components/admin/OrderStatusStepper';
import OrderMessageComposer from '@/components/OrderMessageComposer';

interface OrderTrackingProps {
  orderId?: string;
  order?: Order;
  customerEmail?: string;
  accessToken?: string;
  /** When embedded inside checkout confirmation, omit redundant top header and account back-link. */
  embedded?: boolean;
}

const statusBadgeStyles: Record<OrderStatus, string> = {
  pending: 'bg-surface-muted text-gray-700 border-gray-300/80',
  confirmed: 'bg-primary/10 text-primary border-primary/20',
  processing: 'bg-primary/10 text-primary border-primary/20',
  shipped: 'bg-primary/10 text-primary border-primary/20',
  delivered: 'bg-primary/15 text-primary border-primary/25',
  cancelled: 'bg-rose-50 text-rose-800 border-rose-200/80',
  refunded: 'bg-stone-100 text-stone-700 border-stone-200',
};

function StatusIcon({ status, className = 'h-4 w-4' }: { status: OrderStatus; className?: string }) {
  switch (status) {
    case 'pending':
      return <Clock className={className} aria-hidden="true" />;
    case 'confirmed':
      return <CheckCircle2 className={className} aria-hidden="true" />;
    case 'processing':
      return <Package className={className} aria-hidden="true" />;
    case 'shipped':
      return <Truck className={className} aria-hidden="true" />;
    case 'delivered':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'cancelled':
      return <XCircle className={className} aria-hidden="true" />;
    case 'refunded':
      return <RotateCcw className={className} aria-hidden="true" />;
    default:
      return <CheckCircle2 className={className} aria-hidden="true" />;
  }
}

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-wide ${statusBadgeStyles[status]}`}
    >
      <StatusIcon status={status} className="h-3.5 w-3.5" />
      {orderStatusLabel(status)}
    </span>
  );
}

const CARD_CLASS = 'rounded-xl border border-gray-200/80 bg-surface p-6 shadow-sm';

export default function OrderTracking({
  orderId,
  order: initialOrder,
  accessToken,
  embedded = false,
}: OrderTrackingProps) {
  const { data: session } = useSession();
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

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const datePart = d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${datePart} · ${timePart}`;
  };

  const packageTrackingUrl = trackingUrl(order?.shippingCarrier, order?.trackingNumber);
  const carrierLabel = shippingCarrierLabel(order?.shippingCarrier);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-600">Loading order details...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl page-x">
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-6">
          <h3 className="text-lg font-medium text-rose-900 mb-2">Order Not Found</h3>
          <p className="text-sm text-rose-800">{error || 'The requested order could not be found.'}</p>
        </div>
      </div>
    );
  }

  const showProgress = order.status !== 'cancelled' && order.status !== 'refunded';
  const hasShippingAddress = shippingAddressIsPopulated(order.shippingAddress);
  const inferredDiscount = Math.max(0, Number((order.subtotal + order.shipping + order.tax - order.total).toFixed(2)));
  const showPriceBreakdown =
    (typeof order.shipping === 'number' && order.shipping > 0) ||
    (typeof order.tax === 'number' && order.tax > 0) ||
    inferredDiscount > 0;
  const wrapperClass = embedded ? 'space-y-6' : 'mx-auto max-w-3xl page-x space-y-6';

  return (
    <div className={wrapperClass}>
      {!embedded && (
        <>
          <div>
            <Link href="/account" className="text-sm font-medium text-primary hover:opacity-80 transition-opacity">
              ← Back to my account
            </Link>
          </div>

          <div className={CARD_CLASS}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Order Receipt</p>
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                  Order <span className="whitespace-nowrap">#{order.orderNumber}</span>
                </h1>
                <p className="text-sm text-gray-600">Placed {formatDate(order.createdAt)}</p>
                <p className="text-sm text-gray-600">{order.customerEmail}</p>
              </div>
              <div className="shrink-0 sm:text-right space-y-2">
                <OrderStatusPill status={order.status} />
                <p className="max-w-xs text-sm text-gray-600">{orderStatusDescription(order.status)}</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(order.total, order.currency)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Unified Order Journey: Progress Stepper + Editorial Timeline */}
      <section className={CARD_CLASS} aria-label="Order journey">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Order Journey</h2>
          <span className="text-xs text-gray-500">{orderStatusDescription(order.status)}</span>
        </div>

        {showProgress && (
          <div className="pb-6">
            <OrderProgressSteps status={order.status} />
          </div>
        )}

        {order.timeline.length > 0 && (
          <div className={showProgress ? 'border-t border-gray-100 pt-6' : ''}>
            <ol className="relative space-y-5">
              {order.timeline.map((entry, index) => {
                const isLatest = index === order.timeline.length - 1;
                const isNegative = entry.status === 'cancelled' || entry.status === 'refunded';
                const humanized = humanizeOrderTimelineEntry(entry);
                return (
                  <li key={entry.id} className="relative flex items-start gap-4">
                    {index < order.timeline.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-[13px] top-7 bottom-[-20px] w-px bg-primary/20"
                      />
                    )}
                    <span
                      className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        isNegative
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isLatest
                            ? 'bg-primary text-white ring-4 ring-primary/15'
                            : 'bg-surface-muted text-primary border border-primary/25'
                      }`}
                    >
                      <StatusIcon status={entry.status} className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className={`text-sm ${isLatest ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                          {humanized.message}
                        </p>
                        {humanized.details && (
                          <p className="mt-0.5 text-sm text-gray-600 leading-relaxed">
                            {humanized.details}
                          </p>
                        )}
                        {entry.trackingNumber && (
                          <p className="mt-1 text-xs font-medium text-primary">
                            Tracking: {entry.trackingNumber}
                          </p>
                        )}
                      </div>
                      <time className="shrink-0 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(entry.timestamp)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      {/* Tracking Info */}
      {order.trackingNumber && (
        <section className={CARD_CLASS}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping &amp; Tracking</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Tracking Number</p>
              <p className="mt-1 font-medium text-gray-900">{order.trackingNumber}</p>
              {carrierLabel && <p className="text-sm text-gray-500">{carrierLabel}</p>}
              {packageTrackingUrl && (
                <a
                  href={packageTrackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
                >
                  Track package
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
            {order.estimatedDelivery && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Estimated Delivery</p>
                <p className="mt-1 font-medium text-gray-900">{formatDate(order.estimatedDelivery)}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Order Items + Summary Breakdown */}
      <section className={CARD_CLASS}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Artwork</h2>
        <div className="divide-y divide-gray-100">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
              <ProductImage
                product={item.product}
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-lg border border-gray-200/70 object-cover"
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-gray-900">{item.product.title}</h3>
                <div className="mt-0.5 space-y-0.5 text-sm text-gray-600">
                  {formatCartItemVariant(item.selectedVariant) && (
                    <p>{formatCartItemVariant(item.selectedVariant)}</p>
                  )}
                  {item.customizations && item.customizations.length > 0 && (
                    <p>{item.customizations.map((c) => c.name).join(', ')}</p>
                  )}
                  <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium text-gray-900">{formatPrice(item.totalPrice, order.currency)}</p>
              </div>
            </div>
          ))}
        </div>

        <dl className="mt-5 space-y-2 border-t border-gray-100 pt-4 text-sm">
          {showPriceBreakdown && (
            <>
              <div className="flex justify-between text-gray-600">
                <dt>Subtotal</dt>
                <dd>{formatPrice(order.subtotal, order.currency)}</dd>
              </div>
              {inferredDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <dt>Discount</dt>
                  <dd>−{formatPrice(inferredDiscount, order.currency)}</dd>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <dt>Shipping</dt>
                <dd>{order.shipping > 0 ? formatPrice(order.shipping, order.currency) : 'Free'}</dd>
              </div>
              {typeof order.tax === 'number' && order.tax > 0 && (
                <div className="flex justify-between text-gray-600">
                  <dt>Tax</dt>
                  <dd>{formatPrice(order.tax, order.currency)}</dd>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between pt-1 text-base font-semibold text-gray-900">
            <dt>Total</dt>
            <dd>{formatPrice(order.total, order.currency)}</dd>
          </div>
        </dl>
      </section>

      {/* Shipping Address + Studio Support side-by-side */}
      <div className={hasShippingAddress ? 'grid gap-6 md:grid-cols-2' : ''}>
        {hasShippingAddress && (
          <section className={CARD_CLASS}>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Shipping To</h2>
            <address className="not-italic text-sm text-gray-600 leading-relaxed space-y-0.5">
              <p className="font-medium text-gray-900">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              {order.shippingAddress.company && <p>{order.shippingAddress.company}</p>}
              <p>{order.shippingAddress.address1}</p>
              {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
              </p>
              <p>{order.shippingAddress.country}</p>
              {order.shippingAddress.phone && (
                <p className="pt-1 text-gray-500">Phone: {order.shippingAddress.phone}</p>
              )}
            </address>
          </section>
        )}

        <section className={CARD_CLASS}>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Questions about your order?</h2>
          {session?.user ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Write directly to the studio. Replies appear in your account messages.
              </p>
              <OrderMessageComposer
                orderId={order.id}
                orderNumber={order.orderNumber}
              />
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Sign in to message the studio in-app, or reach out with your order number.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/auth/signin?callbackUrl=${encodeURIComponent(`/orders/${order.id}`)}`}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  Sign in to message
                </Link>
                <Link
                  href={`/contact?subject=${encodeURIComponent(`Order ${order.orderNumber}`)}`}
                  className="btn-primary-outline px-4 py-2 text-sm"
                >
                  Contact studio
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}