'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import OrderTracking from '@/components/OrderTracking';
import { SHIPPING_CARRIERS } from '@/lib/shipping';

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

type AdminOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
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
  timeline: any[];
};

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: OrderStatus; shippingCarrier: string; trackingNumber: string; estimatedDelivery: string }>>({});

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  async function loadOrders(nextSearch = search) {
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
  }

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

  return (
    <div className="space-y-6">
      {message && <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</div>}

      <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-lg border bg-white p-4 md:flex-row md:items-end">
        <label className="flex-1 text-sm font-medium text-gray-700">
          Search orders
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Order number or customer email" />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block rounded-md border border-gray-300 px-3 py-2">
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
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
            return (
              <article key={order.id} className="rounded-lg border bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{order.orderNumber}</h3>
                    <p className="text-sm text-gray-600">{order.customerEmail} • ${order.total.toLocaleString()} {order.currency}</p>
                    <p className="mt-1 text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
                    <ul className="mt-3 space-y-1 text-sm text-gray-700">
                      {order.items.map((item) => (
                        <li key={item.id}>{item.quantity} x {item.product?.title || item.productId}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-5">
                    <label className="text-sm font-medium text-gray-700">
                      Status
                      <select value={draft.status} onChange={(event) => setDrafts((current) => ({ ...current, [order.id]: { ...draft, status: event.target.value as OrderStatus } }))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
                        {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
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
                    <div className="self-end flex flex-wrap gap-2 md:col-span-5">
                      <button type="button" onClick={() => updateOrder(order)} className="rounded bg-gray-900 px-4 py-2 text-white">Save</button>
                      <button type="button" onClick={() => buyLabel(order)} className="rounded bg-blue-600 px-4 py-2 text-white">Buy label</button>
                      {order.shippingLabelUrl && <a href={order.shippingLabelUrl} target="_blank" rel="noreferrer" className="rounded border border-gray-300 px-4 py-2 text-gray-700">Open label</a>}
                    </div>
                  </div>
                </div>
                <div className="mt-5 border-t pt-4">
                  <OrderTracking order={order as any} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}