'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import OrderStatusStepper from '@/components/admin/OrderStatusStepper';
import { SHIPPING_CARRIERS, trackingUrl } from '@/lib/shipping';

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

type AdminOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentIntentId?: string;
  customerEmail: string;
  total: number;
  currency: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  shipmentId?: string;
  shippingLabelUrl?: string;
  estimatedDelivery?: string;
  createdAt: string;
  items: Array<{ id: string; productId: string; quantity: number; unitPrice: number; totalPrice: number; product: { title: string } }>;
  timeline: Array<{ id: string; status: OrderStatus; message: string; details?: string; trackingNumber?: string; timestamp: string }>;
};

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: OrderStatus; shippingCarrier: string; trackingNumber: string; estimatedDelivery: string }>>({});
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [messageOpen, setMessageOpen] = useState<Record<string, boolean>>({});
  const [messageStatus, setMessageStatus] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const loadOrders = useCallback(async (nextSearch = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope: 'all' });
      if (statusFilter) params.set('status', statusFilter);
      if (nextSearch.trim()) params.set('search', nextSearch.trim());
      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load orders');
      const loadedOrders = data.orders || [];
      setOrders(loadedOrders);
      setDrafts(Object.fromEntries(loadedOrders.map((order: AdminOrder) => [order.id, {
        status: order.status,
        shippingCarrier: order.shippingCarrier || '',
        trackingNumber: order.trackingNumber || '',
        estimatedDelivery: order.estimatedDelivery?.slice(0, 10) || '',
      }])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    if (session?.user?.isAdmin) {
      void loadOrders();
    }
  }, [loadOrders, session?.user?.isAdmin]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    await loadOrders(search);
  }

  async function updateOrder(order: AdminOrder) {
    const draft = drafts[order.id];
    if (!draft) return;
    setMessage(null);

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: draft.status,
          shippingCarrier: draft.shippingCarrier || undefined,
          trackingNumber: draft.trackingNumber || undefined,
          estimatedDelivery: draft.estimatedDelivery ? new Date(draft.estimatedDelivery).toISOString() : undefined,
          message: draft.status !== order.status ? undefined : `Order ${order.orderNumber} updated`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update order');
      setMessage(`Order ${order.orderNumber} updated.`);
      await loadOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update order');
    }
  }

  function applyShippedPreset(order: AdminOrder) {
    const draft = drafts[order.id];
    if (!draft) return;
    setDrafts((current) => ({
      ...current,
      [order.id]: {
        ...draft,
        status: 'shipped',
        shippingCarrier: draft.shippingCarrier || 'usps',
      },
    }));
  }

  async function copyTrackingLink(order: AdminOrder) {
    const draft = drafts[order.id];
    const url = trackingUrl(draft?.shippingCarrier || order.shippingCarrier, draft?.trackingNumber || order.trackingNumber);
    if (!url) {
      setMessage('Add a carrier and tracking number first.');
      return;
    }
    await navigator.clipboard.writeText(url);
    setMessage(`Tracking link copied for ${order.orderNumber}.`);
  }

  async function issueRefund(order: AdminOrder) {
    if (!window.confirm(`Issue a full Stripe refund for order ${order.orderNumber}? This returns money to the collector.`)) {
      return;
    }
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to issue refund');
      setMessage(`Refund issued for order ${order.orderNumber}.`);
      await loadOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to issue refund');
    }
  }

  function canRefund(order: AdminOrder): boolean {
    return order.paymentStatus === 'paid'
      && ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status)
      && Boolean(order.paymentIntentId);
  }

  async function buyLabel(order: AdminOrder) {
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buy_label' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to buy shipping label');
      setMessage(`Shipping label created for order ${order.orderNumber}.`);
      await loadOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to buy shipping label');
    }
  }

  async function sendMessageToCollector(order: AdminOrder) {
    const body = messageDrafts[order.id]?.trim();
    if (!body) return;
    setMessageStatus(null);
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, message: body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send message');
      setMessageStatus(`Message sent to ${order.customerEmail} for ${order.orderNumber}.`);
      setMessageDrafts((current) => ({ ...current, [order.id]: '' }));
      setMessageOpen((current) => ({ ...current, [order.id]: false }));
    } catch (error) {
      setMessageStatus(error instanceof Error ? error.message : 'Failed to send message');
    }
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</div>}
      {messageStatus && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{messageStatus}</div>}

      <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-lg border bg-white p-4 md:flex-row md:items-end">
        <label className="flex-1 text-sm font-medium text-gray-700">
          Search orders
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Order number or customer email" />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block rounded-md border border-gray-300 px-3 py-2">
            <option value="">All statuses</option>
            {[...ORDER_STATUSES, 'refunded'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white">Apply</button>
      </form>

      {loading ? (
        <div className="rounded-lg border bg-white p-6 text-gray-600">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-gray-600">No orders found.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const draft = drafts[order.id] || { status: order.status, shippingCarrier: '', trackingNumber: '', estimatedDelivery: '' };
            const expanded = expandedOrders[order.id] ?? false;
            const detailsClass = expanded ? 'block' : 'hidden md:block';
            return (
              <article key={order.id} className="rounded-lg border bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{order.orderNumber}</h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-700">{order.paymentStatus}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs capitalize text-blue-800">{order.status}</span>
                    </div>
                    <p className="text-sm text-gray-600">{order.customerEmail} • ${order.total.toLocaleString()} {order.currency}</p>
                    <p className="mt-1 text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    className="md:hidden tap-target-inline shrink-0 rounded border border-gray-300 px-3 text-sm text-gray-700"
                    aria-expanded={expanded}
                    onClick={() => setExpandedOrders((current) => ({ ...current, [order.id]: !expanded }))}
                  >
                    {expanded ? 'Collapse' : 'Manage'}
                  </button>
                </div>
                <div className={`${detailsClass} mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between`}>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {order.items.map((item) => (
                      <li key={item.id}>{item.quantity} x {item.product?.title || item.productId}</li>
                    ))}
                  </ul>
                  <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm font-medium text-gray-700 sm:col-span-2 lg:col-span-4">
                      Status
                      <select
                        value={draft.status}
                        disabled={order.status === 'refunded'}
                        onChange={(event) => setDrafts((current) => ({ ...current, [order.id]: { ...draft, status: event.target.value as OrderStatus } }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                      >
                        {order.status === 'refunded'
                          ? <option value="refunded">refunded</option>
                          : ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-gray-700">
                      Carrier
                      <select value={draft.shippingCarrier} onChange={(event) => setDrafts((current) => ({ ...current, [order.id]: { ...draft, shippingCarrier: event.target.value } }))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
                        <option value="">Select</option>
                        {SHIPPING_CARRIERS.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.label}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-gray-700">
                      Tracking
                      <input value={draft.trackingNumber} onChange={(event) => setDrafts((current) => ({ ...current, [order.id]: { ...draft, trackingNumber: event.target.value } }))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                    </label>
                    <label className="text-sm font-medium text-gray-700">
                      Delivery ETA
                      <input type="date" value={draft.estimatedDelivery} onChange={(event) => setDrafts((current) => ({ ...current, [order.id]: { ...draft, estimatedDelivery: event.target.value } }))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
                      <button type="button" onClick={() => updateOrder(order)} className="rounded bg-gray-900 px-4 py-2 text-white">Save</button>
                      <button type="button" onClick={() => applyShippedPreset(order)} className="rounded border border-gray-300 px-4 py-2 text-gray-700">Mark as shipped</button>
                      {canRefund(order) && (
                        <button type="button" onClick={() => issueRefund(order)} className="rounded border border-red-300 px-4 py-2 text-red-700">Issue refund</button>
                      )}
                      <button type="button" onClick={() => buyLabel(order)} className="rounded bg-blue-600 px-4 py-2 text-white">Buy label</button>
                      <button type="button" onClick={() => void copyTrackingLink(order)} className="rounded border border-gray-300 px-4 py-2 text-gray-700">Copy tracking link</button>
                      {order.shippingLabelUrl && <a href={order.shippingLabelUrl} target="_blank" rel="noreferrer" className="rounded border border-gray-300 px-4 py-2 text-gray-700">Open label</a>}
                    </div>
                  </div>
                </div>
                <div className={`${detailsClass} mt-5 border-t pt-4`}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Fulfillment progress</p>
                  <OrderStatusStepper status={draft.status} />
                </div>
                {order.timeline?.length > 0 && (
                  <div className={`${detailsClass} mt-5 border-t pt-4`}>
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Timeline</p>
                    <ol className="space-y-3">
                      {order.timeline.map((entry) => (
                        <li key={entry.id} className="text-sm text-gray-700">
                          <span className="font-medium text-gray-900">{entry.message}</span>
                          {entry.details && <span className="text-gray-600"> — {entry.details}</span>}
                          <span className="ml-2 text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className={`${detailsClass} mt-5 border-t pt-4`}>
                  {!messageOpen[order.id] ? (
                    <button
                      type="button"
                      onClick={() => setMessageOpen((current) => ({ ...current, [order.id]: true }))}
                      className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Message collector
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900">Message {order.customerEmail}</p>
                      <textarea
                        value={messageDrafts[order.id] || ''}
                        onChange={(event) => setMessageDrafts((current) => ({ ...current, [order.id]: event.target.value }))}
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Write an update about this order..."
                      />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={!messageDrafts[order.id]?.trim()} onClick={() => void sendMessageToCollector(order)} className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
                          Send message
                        </button>
                        <button type="button" onClick={() => setMessageOpen((current) => ({ ...current, [order.id]: false }))} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
