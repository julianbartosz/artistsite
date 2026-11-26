'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import OrderStatusStepper from '@/components/admin/OrderStatusStepper';
import { adminSettingFieldHref } from '@/components/AdminSettings';
import { formatCartItemVariant, formatPrice, type CartItemVariant } from '@/lib/commerce';
import { orderStatusLabel, type OrderStatus } from '@/lib/order-status-shared';
import type { ShippingAddress } from '@/lib/shipping-address';
import {
  formatShippingAddressBlock,
  formatShippingAddressLines,
  inferOrderParcel,
  parseTrackingInput,
  SHIPPING_CARRIERS,
  STUDIO_SHIPPING_PRESETS,
  trackingUrl,
  type OptionalParcelDimensions,
  type ParcelDimensions,
} from '@/lib/shipping';

type AdminOrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  selectedVariant?: CartItemVariant;
  customizations?: Array<{ id: string; name: string; value: string; priceModifier?: number }>;
  notes?: string;
  product: {
    title: string;
    dimensions?: string;
    shipping?: {
      parcel?: OptionalParcelDimensions;
    };
  };
};

type AdminOrder = {
  id: string;
  orderNumber: string;
  type?: 'standard' | 'commission' | 'in_person';
  marketEventId?: string | null;
  status: OrderStatus;
  paymentStatus: string;
  paymentIntentId?: string;
  paymentMethod?: string;
  customerEmail: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  shippingAddress?: ShippingAddress;
  shippingCarrier?: string;
  trackingNumber?: string;
  shipmentId?: string;
  shippingLabelUrl?: string;
  estimatedDelivery?: string;
  specialInstructions?: string;
  giftMessage?: string;
  createdAt: string;
  items: AdminOrderItem[];
  certificates?: Array<{
    id: string;
    code: string;
    artworkTitle: string;
    licenseType: string;
    issuedAt: string;
  }>;
  timeline: Array<{ id: string; status: OrderStatus; message: string; details?: string; trackingNumber?: string; timestamp: string }>;
};

type ShippingFulfillmentContext = {
  provider: 'manual' | 'easypost';
  easyPostReady: boolean;
  missingConfig: string[];
  defaultParcel: ParcelDimensions;
  studioName: string;
  studioUrl: string;
  supportEmail: string;
  studioReturnAddress: ShippingAddress | null;
  emailDeliveryMode?: 'smtp' | 'log' | 'unconfigured';
};

type ShippingRateOption = {
  id: string;
  carrier: string;
  carrierId: string;
  service: string;
  rate: number;
  currency: string;
  deliveryDays?: number;
  deliveryDate?: string;
};

type ShippingRateQuote = {
  shipmentId: string;
  parcel: ParcelDimensions;
  rates: ShippingRateOption[];
};

type OrderDraft = {
  status: OrderStatus;
  shippingCarrier: string;
  trackingNumber: string;
  estimatedDelivery: string;
};

type ParcelDraft = {
  weightOz: string;
  lengthIn: string;
  widthIn: string;
  heightIn: string;
};

const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

const QUEUE_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All orders' },
  { value: 'needs_shipping', label: 'Needs shipping' },
  { value: 'in_person', label: 'In-person' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

function paymentStatusDisplay(paymentStatus: string): { label: string; tone: string } {
  switch (paymentStatus) {
    case 'paid':
      return { label: 'Paid', tone: 'bg-green-100 text-green-800' };
    case 'refunded':
      return { label: 'Refunded', tone: 'bg-gray-100 text-gray-700' };
    case 'failed':
      return { label: 'Payment failed', tone: 'bg-red-100 text-red-800' };
    default:
      return { label: 'Unpaid', tone: 'bg-gray-100 text-gray-700' };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parcelToDraft(parcel: ParcelDimensions): ParcelDraft {
  return {
    weightOz: String(parcel.weightOz),
    lengthIn: String(parcel.lengthIn),
    widthIn: String(parcel.widthIn),
    heightIn: String(parcel.heightIn),
  };
}

function draftToParcel(draft?: ParcelDraft): OptionalParcelDimensions | undefined {
  if (!draft) return undefined;
  const parse = (raw: string) => {
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : undefined;
  };
  const parcel: OptionalParcelDimensions = {
    weightOz: parse(draft.weightOz),
    lengthIn: parse(draft.lengthIn),
    widthIn: parse(draft.widthIn),
    heightIn: parse(draft.heightIn),
  };
  return Object.values(parcel).some((entry) => entry !== undefined) ? parcel : undefined;
}

function carrierLabel(carrierId?: string): string {
  if (!carrierId) return '';
  return SHIPPING_CARRIERS.find((entry) => entry.id === carrierId)?.label || carrierId.toUpperCase();
}

function buildCollectorUpdateNote(
  order: AdminOrder,
  draft: OrderDraft,
  context: ShippingFulfillmentContext | null,
): string {
  const firstName = order.shippingAddress?.firstName?.trim();
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const carrier = carrierLabel(draft.shippingCarrier || order.shippingCarrier);
  const tracking = (draft.trackingNumber || order.trackingNumber || '').trim();
  const link = trackingUrl(draft.shippingCarrier || order.shippingCarrier, tracking);
  const studio = context?.studioName || 'the studio';
  const lines = [
    greeting,
    '',
    `Your order ${order.orderNumber} from ${studio} is on its way${carrier ? ` via ${carrier}` : ''}!`,
  ];
  if (tracking) lines.push(`Tracking number: ${tracking}`);
  if (link) lines.push(`Track your package: ${link}`);
  lines.push('', 'Thank you so much for supporting independent art!');
  return lines.join('\n');
}

function buildPackingSlipHtml(order: AdminOrder, context: ShippingFulfillmentContext | null): string {
  const studioName = context?.studioName || 'Artist Studio';
  const returnLines = context?.studioReturnAddress
    ? formatShippingAddressLines(context.studioReturnAddress)
    : [];
  const shipLines = formatShippingAddressLines(order.shippingAddress);
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const itemRows = order.items
    .map((item) => {
      const details: string[] = [];
      const variant = formatCartItemVariant(item.selectedVariant);
      if (variant) details.push(variant);
      if (item.product.dimensions) details.push(item.product.dimensions);
      if (item.customizations?.length) {
        details.push(item.customizations.map((entry) => `${entry.name}: ${entry.value}`).join(' · '));
      }
      if (item.notes) details.push(`Note: ${item.notes}`);
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;">
            <div style="font-weight:600;color:#111827;">${escapeHtml(item.product.title)}</div>
            ${details.length > 0 ? `<div style="margin-top:3px;font-size:12px;color:#4b5563;">${escapeHtml(details.join(' · '))}</div>` : ''}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;font-weight:600;color:#111827;width:72px;">
            × ${item.quantity}
          </td>
        </tr>
      `;
    })
    .join('');

  const noteBlocks: string[] = [];
  if (order.giftMessage) {
    noteBlocks.push(
      `<div style="margin-top:16px;padding:12px 14px;border:1px solid #e5e7eb;background:#fafafa;border-radius:6px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Gift message</div>
        <div style="margin-top:4px;font-size:14px;color:#111827;white-space:pre-wrap;">${escapeHtml(order.giftMessage)}</div>
      </div>`
    );
  }
  if (order.specialInstructions) {
    noteBlocks.push(
      `<div style="margin-top:12px;padding:12px 14px;border:1px solid #e5e7eb;background:#fafafa;border-radius:6px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Packing instructions</div>
        <div style="margin-top:4px;font-size:13px;color:#374151;white-space:pre-wrap;">${escapeHtml(order.specialInstructions)}</div>
      </div>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Packing Slip — ${escapeHtml(order.orderNumber)}</title>
  <style>
    @page { margin: 0.6in; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; padding: 24px; max-width: 720px; }
    @media print { .no-print { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:20px;display:flex;justify-content:flex-end;gap:8px;">
    <button onclick="window.print()" style="background:#111827;color:#fff;border:none;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;">Print packing slip</button>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111827;padding-bottom:16px;">
    <div>
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(studioName)}</div>
      ${returnLines.length > 0 ? `<div style="margin-top:6px;font-size:12px;color:#4b5563;line-height:1.5;">${returnLines.map(escapeHtml).join('<br/>')}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Packing Slip</div>
      <div style="margin-top:4px;font-size:16px;font-weight:700;">${escapeHtml(order.orderNumber)}</div>
      <div style="margin-top:2px;font-size:12px;color:#4b5563;">Ordered ${escapeHtml(orderDate)}</div>
    </div>
  </div>

  <div style="margin-top:20px;display:flex;justify-content:space-between;gap:24px;">
    <div>
      <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Ship to</div>
      <div style="margin-top:6px;font-size:14px;line-height:1.55;">
        ${shipLines.length > 0 ? shipLines.map(escapeHtml).join('<br/>') : escapeHtml(order.customerEmail)}
        ${order.shippingAddress?.phone ? `<br/><span style="color:#4b5563;">${escapeHtml(order.shippingAddress.phone)}</span>` : ''}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Collector</div>
      <div style="margin-top:6px;font-size:13px;color:#374151;">${escapeHtml(order.customerEmail)}</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-top:24px;">
    <thead>
      <tr>
        <th style="text-align:left;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;padding-bottom:8px;border-bottom:1px solid #111827;">Artwork / Item</th>
        <th style="text-align:right;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;padding-bottom:8px;border-bottom:1px solid #111827;">Qty</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  ${noteBlocks.join('')}

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;display:flex;justify-content:space-between;">
    <span>Thank you for supporting independent art.</span>
    <span>${escapeHtml(context?.supportEmail || '')}</span>
  </div>
</body>
</html>`;
}

export default function AdminOrders({ hideIntro = false }: { hideIntro?: boolean } = {}) {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [shippingContext, setShippingContext] = useState<ShippingFulfillmentContext | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});
  const [detectedCarrierHint, setDetectedCarrierHint] = useState<Record<string, string>>({});
  const [parcelDrafts, setParcelDrafts] = useState<Record<string, ParcelDraft>>({});
  const [labelPanelOpen, setLabelPanelOpen] = useState<Record<string, boolean>>({});
  const [rateQuotes, setRateQuotes] = useState<Record<string, ShippingRateQuote>>({});
  const [selectedRateId, setSelectedRateId] = useState<Record<string, string>>({});
  const [quotingOrderId, setQuotingOrderId] = useState<string | null>(null);
  const [buyingOrderId, setBuyingOrderId] = useState<string | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [messageOpen, setMessageOpen] = useState<Record<string, boolean>>({});
  const [messageStatus, setMessageStatus] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const loadOrders = useCallback(async (nextSearch = search, nextStatus = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope: 'all' });
      if (nextStatus) params.set('status', nextStatus);
      if (nextSearch.trim()) params.set('search', nextSearch.trim());
      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load orders');
      const loadedOrders: AdminOrder[] = data.orders || [];
      const nextContext: ShippingFulfillmentContext | null = data.shippingContext || null;
      setOrders(loadedOrders);
      setShippingContext(nextContext);
      setExpandedOrders((current) => {
        if (loadedOrders.length === 0) return {};
        const stillVisible = loadedOrders.some((entry) => current[entry.id]);
        if (stillVisible) return current;
        const firstActive = loadedOrders.find(
          (entry) => !['delivered', 'cancelled', 'refunded'].includes(entry.status),
        ) ?? loadedOrders[0];
        return { [firstActive.id]: true };
      });
      setDrafts(Object.fromEntries(loadedOrders.map((order) => [order.id, {
        status: order.status,
        shippingCarrier: order.shippingCarrier || '',
        trackingNumber: order.trackingNumber || '',
        estimatedDelivery: order.estimatedDelivery?.slice(0, 10) || '',
      }])));
      setParcelDrafts((current) => {
        const next: Record<string, ParcelDraft> = { ...current };
        for (const order of loadedOrders) {
          if (!next[order.id]) {
            next[order.id] = parcelToDraft(inferOrderParcel(order.items, nextContext?.defaultParcel));
          }
        }
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    if (session?.user?.isAdmin) {
      void loadOrders(search, statusFilter);
    }
  }, [loadOrders, search, session?.user?.isAdmin, statusFilter]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    await loadOrders(search, statusFilter);
  }

  function handleTrackingChange(orderId: string, rawValue: string) {
    const parsed = parseTrackingInput(rawValue);
    setDrafts((current) => {
      const existing = current[orderId];
      if (!existing) return current;
      return {
        ...current,
        [orderId]: {
          ...existing,
          trackingNumber: parsed.cleanedFromUrl ? parsed.trackingNumber : rawValue,
          shippingCarrier: parsed.carrier || existing.shippingCarrier,
        },
      };
    });
    if (parsed.carrier) {
      setDetectedCarrierHint((current) => ({
        ...current,
        [orderId]: parsed.cleanedFromUrl
          ? `Extracted ${carrierLabel(parsed.carrier)} tracking number from link`
          : `Detected ${carrierLabel(parsed.carrier)}`,
      }));
    } else {
      setDetectedCarrierHint((current) => {
        if (!current[orderId]) return current;
        const next = { ...current };
        delete next[orderId];
        return next;
      });
    }
  }

  async function persistOrderDraft(order: AdminOrder, nextDraft: OrderDraft, successMessage: string) {
    setMessage(null);
    setSavingOrderId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextDraft.status,
          shippingCarrier: nextDraft.shippingCarrier || undefined,
          trackingNumber: nextDraft.trackingNumber.trim() || undefined,
          estimatedDelivery: nextDraft.estimatedDelivery
            ? new Date(nextDraft.estimatedDelivery).toISOString()
            : undefined,
          message: nextDraft.status !== order.status ? undefined : `Order ${order.orderNumber} updated`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update order');
      setMessage(successMessage);
      await loadOrders(search, statusFilter);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update order');
    } finally {
      setSavingOrderId(null);
    }
  }

  async function updateOrder(order: AdminOrder) {
    const draft = drafts[order.id];
    if (!draft) return;
    await persistOrderDraft(order, draft, `Order ${order.orderNumber} updated.`);
  }

  async function markOrderShipped(order: AdminOrder) {
    const draft = drafts[order.id];
    if (!draft) return;
    const emailsLive = shippingContext?.emailDeliveryMode === 'smtp';
    const cleanedTracking = parseTrackingInput(draft.trackingNumber);
    if (!cleanedTracking.trackingNumber) {
      const ok = window.confirm(
        emailsLive
          ? `Mark ${order.orderNumber} as shipped without a tracking number? The collector will still receive a shipped email.`
          : `Mark ${order.orderNumber} as shipped without a tracking number?`
      );
      if (!ok) return;
    }
    const nextDraft: OrderDraft = {
      ...draft,
      status: 'shipped',
      shippingCarrier: draft.shippingCarrier || cleanedTracking.carrier || 'usps',
      trackingNumber: cleanedTracking.trackingNumber,
    };
    setDrafts((current) => ({ ...current, [order.id]: nextDraft }));
    await persistOrderDraft(
      order,
      nextDraft,
      emailsLive
        ? `Order ${order.orderNumber} marked as shipped and email sent to ${order.customerEmail}.`
        : `Order ${order.orderNumber} marked as shipped. Copy the update note if you want to message ${order.customerEmail} manually.`
    );
  }

  async function fetchRates(order: AdminOrder) {
    setMessage(null);
    setQuotingOrderId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quote_rates',
          parcel: draftToParcel(parcelDrafts[order.id]),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to quote shipping rates');
      const quote: ShippingRateQuote = data.quote;
      setRateQuotes((current) => ({ ...current, [order.id]: quote }));
      setParcelDrafts((current) => ({ ...current, [order.id]: parcelToDraft(quote.parcel) }));
      if (quote.rates[0]) {
        setSelectedRateId((current) => ({ ...current, [order.id]: quote.rates[0].id }));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to quote shipping rates');
    } finally {
      setQuotingOrderId(null);
    }
  }

  async function purchaseSelectedLabel(order: AdminOrder) {
    const quote = rateQuotes[order.id];
    const rateId = selectedRateId[order.id];
    const chosenRate = quote?.rates.find((entry) => entry.id === rateId);
    if (!quote || !chosenRate) {
      setMessage('Select a carrier rate before purchasing a label.');
      return;
    }

    const ok = window.confirm(
      `Buy ${chosenRate.carrier} ${chosenRate.service} label for ${formatPrice(chosenRate.rate, chosenRate.currency)}?\n\nThis charges your EasyPost account, marks ${order.orderNumber} as shipped, and emails tracking to ${order.customerEmail}.`
    );
    if (!ok) return;

    setMessage(null);
    setBuyingOrderId(order.id);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'buy_label',
          shipmentId: quote.shipmentId,
          rateId: chosenRate.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to purchase shipping label');
      setLabelPanelOpen((current) => ({ ...current, [order.id]: false }));
      setRateQuotes((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      setMessage(
        `Label purchased for ${order.orderNumber}${data.label?.trackingNumber ? ` (${data.label.trackingNumber})` : ''}.`
      );
      await loadOrders(search, statusFilter);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to purchase shipping label');
    } finally {
      setBuyingOrderId(null);
    }
  }

  async function copyText(id: string, value: string, feedbackLabel: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setMessage(`${feedbackLabel} copied to clipboard.`);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 2000);
    } catch {
      setMessage(`Could not access clipboard. Value: ${value}`);
    }
  }

  function openPackingSlip(order: AdminOrder) {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=820,height=920');
    if (!printWindow) {
      setMessage('Allow pop-ups in your browser to print packing slips.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildPackingSlipHtml(order, shippingContext));
    printWindow.document.close();
    printWindow.focus();
  }

  async function issueCertificate(order: AdminOrder) {
    setSavingOrderId(order.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issue_coa' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to issue Certificate of Authenticity');
      setMessage(`Issued Certificate of Authenticity for ${order.orderNumber}.`);
      await loadOrders(search, statusFilter);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to issue Certificate of Authenticity');
    } finally {
      setSavingOrderId(null);
    }
  }

  async function markOrderAsPaid(order: AdminOrder) {
    const confirmed = window.confirm(
      `Mark ${order.orderNumber} (${formatPrice(order.total, order.currency)}) as paid? This confirms the order, updates inventory, and sends a confirmation email if SMTP is enabled.`
    );
    if (!confirmed) return;
    setSavingOrderId(order.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_paid' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to mark order paid');
      setMessage(`Order ${order.orderNumber} marked paid and confirmed.`);
      await loadOrders(search, statusFilter);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to mark order paid');
    } finally {
      setSavingOrderId(null);
    }
  }

  async function issueRefund(order: AdminOrder) {
    const isManualPayment = !order.paymentIntentId && order.paymentMethod === 'manual';
    const confirmed = window.confirm(
      isManualPayment
        ? `Mark ${order.orderNumber} (${formatPrice(order.total, order.currency)}) refunded and restore inventory? Send the refund separately via the payment method you used.`
        : `Refund ${formatPrice(order.total, order.currency)} for ${order.orderNumber} via Stripe? This returns the collector's payment and restores inventory.`
    );
    if (!confirmed) return;
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refund' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to refund order');
      setMessage(`Order ${order.orderNumber} refunded and inventory restored.`);
      await loadOrders(search, statusFilter);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to refund order');
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
        body: JSON.stringify({
          orderId: order.id,
          message: body,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send message');
      setMessageDrafts((current) => ({ ...current, [order.id]: '' }));
      setMessageOpen((current) => ({ ...current, [order.id]: false }));
      const emailed = Boolean(data.emailDelivery?.delivered);
      setMessageStatus(
        emailed
          ? `Message saved to Inbox and emailed to ${order.customerEmail}.`
          : `Message saved to Studio Inbox for ${order.customerEmail} (email delivery is off; open Inbox or copy an update note to email directly).`,
      );
    } catch (error) {
      setMessageStatus(error instanceof Error ? error.message : 'Failed to send message');
    }
  }

  return (
    <div className="space-y-6">
      {!hideIntro && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Orders</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            Track online shipments, in-person market pickups, refunds, and collector updates.
          </p>
        </div>
      )}

      <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Order queue filters">
          {QUEUE_FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <button
                key={filter.value || 'all'}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order number, collector email, or tracking number"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
            Search
          </button>
        </form>
      </div>

      {message && (
        <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-4 text-xs text-gray-500 hover:text-gray-800"
          >
            Dismiss
          </button>
        </div>
      )}
      {messageStatus && (
        <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
          {messageStatus}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-lg bg-white shadow-sm" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {statusFilter === 'needs_shipping'
            ? 'All paid shipping orders are shipped. Nothing waiting to pack right now.'
            : statusFilter === 'in_person'
              ? 'No in-person market orders yet.'
              : 'No orders match this filter yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const draft = drafts[order.id] || {
              status: order.status,
              shippingCarrier: order.shippingCarrier || '',
              trackingNumber: order.trackingNumber || '',
              estimatedDelivery: order.estimatedDelivery?.slice(0, 10) || '',
            };
            const trackLink = trackingUrl(draft.shippingCarrier || order.shippingCarrier, draft.trackingNumber || order.trackingNumber);
            const canMarkShipped = !['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status);
            const canMarkPaid = order.paymentStatus !== 'paid' && !['cancelled', 'refunded'].includes(order.status);
            const isManualPayment = !order.paymentIntentId && order.paymentMethod === 'manual';
            const canRefund = order.paymentStatus === 'paid' && (Boolean(order.paymentIntentId) || isManualPayment) && order.status !== 'refunded';
            const canBuyEasyPost =
              shippingContext?.provider === 'easypost' &&
              !order.shippingLabelUrl &&
              !['cancelled', 'refunded'].includes(order.status);
            const isInPerson = order.type === 'in_person';
            const paymentBadge = paymentStatusDisplay(order.paymentStatus);
            const isExpanded = Boolean(expandedOrders[order.id]);
            const addressLines = formatShippingAddressLines(order.shippingAddress);
            const addressBlock = formatShippingAddressBlock(order.shippingAddress);
            const shipCityLine = order.shippingAddress?.city
              ? [order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(', ')
              : '';
            const quote = rateQuotes[order.id];
            const parcelDraft = parcelDrafts[order.id] || parcelToDraft(inferOrderParcel(order.items, shippingContext?.defaultParcel));

            return (
              <article key={order.id} className="rounded-lg bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{order.orderNumber}</h3>
                      {isInPerson && (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                          In-person
                        </span>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadge.tone}`}>
                        {paymentBadge.label}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        order.status === 'shipped' || order.status === 'delivered'
                          ? 'bg-emerald-50 text-emerald-700'
                          : order.status === 'cancelled' || order.status === 'refunded'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-800'
                      }`}>
                        {orderStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {order.customerEmail}
                      {shipCityLine ? ` · ${shipCityLine}` : ''}
                      {' · '}
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      {order.trackingNumber
                        ? ` · ${carrierLabel(order.shippingCarrier) || 'Tracking'}: ${order.trackingNumber}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right">
                      <p className="text-base font-semibold text-gray-900">{formatPrice(order.total, order.currency)}</p>
                      <p className="text-xs text-gray-500">
                        {isInPerson
                          ? 'In-person pickup'
                          : order.shipping > 0
                            ? `incl. ${formatPrice(order.shipping, order.currency)} shipping`
                            : 'Free shipping'}
                      </p>
                    </div>
                    {order.shippingLabelUrl && (
                      <a
                        href={order.shippingLabelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Open label
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrders((current) => ({ ...current, [order.id]: !isExpanded }))
                      }
                      aria-expanded={isExpanded}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {isExpanded ? 'Collapse' : 'Manage'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-5 space-y-5">
                    <OrderStatusStepper status={order.status} />

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                      {/* Left column: Pack & Ship details */}
                      <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/70 p-4 lg:col-span-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              {isInPerson ? 'Pickup details' : 'Ship to'}
                            </h4>
                            {addressLines.length > 0 ? (
                              <address className="mt-1.5 not-italic text-sm leading-relaxed text-gray-800">
                                {addressLines.map((line, index) => (
                                  <div key={`${order.id}-addr-${index}`}>{line}</div>
                                ))}
                                {order.shippingAddress?.phone && (
                                  <div className="mt-0.5 text-xs text-gray-500">{order.shippingAddress.phone}</div>
                                )}
                              </address>
                            ) : (
                              <p className="mt-1.5 text-sm text-gray-500">No shipping address on file.</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {addressBlock && (
                              <button
                                type="button"
                                onClick={() => void copyText(`addr-${order.id}`, addressBlock, 'Shipping address')}
                                className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                {copiedId === `addr-${order.id}` ? 'Copied' : 'Copy address'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openPackingSlip(order)}
                              className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Packing slip
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-gray-200 pt-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Items to pack</h4>
                          <ul className="mt-2 space-y-2.5">
                            {order.items.map((item) => {
                              const variantText = formatCartItemVariant(item.selectedVariant);
                              return (
                                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-900">
                                      {item.quantity} × {item.product.title}
                                    </p>
                                    {(variantText || item.product.dimensions) && (
                                      <p className="text-xs text-gray-600">
                                        {[variantText, item.product.dimensions].filter(Boolean).join(' · ')}
                                      </p>
                                    )}
                                    {item.customizations && item.customizations.length > 0 && (
                                      <p className="text-xs text-gray-600">
                                        {item.customizations.map((entry) => `${entry.name}: ${entry.value}`).join(' · ')}
                                      </p>
                                    )}
                                    {item.notes && (
                                      <p className="text-xs text-amber-800">Note: {item.notes}</p>
                                    )}
                                  </div>
                                  <span className="shrink-0 text-sm text-gray-700">
                                    {formatPrice(item.totalPrice, order.currency)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        {(order.giftMessage || order.specialInstructions) && (
                          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                            {order.giftMessage && (
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-amber-800">Gift message</p>
                                <p className="mt-0.5 whitespace-pre-wrap">{order.giftMessage}</p>
                              </div>
                            )}
                            {order.specialInstructions && (
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-amber-800">Special instructions</p>
                                <p className="mt-0.5 whitespace-pre-wrap">{order.specialInstructions}</p>
                              </div>
                            )}
                          </div>
                        )}

                        <dl className="space-y-1 border-t border-gray-200 pt-3 text-xs text-gray-600">
                          <div className="flex justify-between">
                            <dt>Subtotal</dt>
                            <dd>{formatPrice(order.subtotal, order.currency)}</dd>
                          </div>
                          <div className="flex justify-between font-medium text-gray-800">
                            <dt>Shipping paid by collector</dt>
                            <dd>{order.shipping > 0 ? formatPrice(order.shipping, order.currency) : 'Free'}</dd>
                          </div>
                          {order.tax > 0 && (
                            <div className="flex justify-between">
                              <dt>Tax</dt>
                              <dd>{formatPrice(order.tax, order.currency)}</dd>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-gray-200 pt-1.5 text-sm font-semibold text-gray-900">
                            <dt>Total</dt>
                            <dd>{formatPrice(order.total, order.currency)}</dd>
                          </div>
                        </dl>

                        {order.paymentStatus === 'paid' && (
                          <div className="rounded-md border border-gray-200 bg-gray-50/70 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Certificates of Authenticity
                              </span>
                              {(!order.certificates || order.certificates.length === 0) && (
                                <button
                                  type="button"
                                  disabled={savingOrderId === order.id}
                                  onClick={() => void issueCertificate(order)}
                                  className="text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
                                >
                                  Issue COA
                                </button>
                              )}
                            </div>
                            {order.certificates && order.certificates.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {order.certificates.map((cert) => (
                                  <Link
                                    key={cert.id}
                                    href={`/verify/${encodeURIComponent(cert.code)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                                  >
                                    <span>{cert.artworkTitle}</span>
                                    <span className="font-mono text-[11px] text-emerald-700">{cert.code}</span>
                                  </Link>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">
                                Auto-issued for products with Certificate enabled, or click Issue COA above.
                              </p>
                            )}
                          </div>
                        )}
                      </section>

                      {/* Right column: Fulfillment & EasyPost labels */}
                      <section className="space-y-4 lg:col-span-7">
                        <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Fulfillment & tracking
                            </h4>
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              {(draft.trackingNumber.trim() || order.trackingNumber || order.status === 'shipped') && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyText(
                                      `note-${order.id}`,
                                      buildCollectorUpdateNote(order, draft, shippingContext),
                                      'Collector shipping note'
                                    )
                                  }
                                  className="text-gray-600 underline hover:text-gray-900"
                                >
                                  {copiedId === `note-${order.id}` ? 'Copied note' : 'Copy update note'}
                                </button>
                              )}
                              {trackLink && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void copyText(`track-${order.id}`, trackLink, 'Tracking link')}
                                    className="text-gray-600 underline hover:text-gray-900"
                                  >
                                    {copiedId === `track-${order.id}` ? 'Copied link' : 'Copy tracking link'}
                                  </button>
                                  <a
                                    href={trackLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-gray-900 underline"
                                  >
                                    Track package
                                  </a>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="text-xs text-gray-600">
                              Status
                              <select
                                value={draft.status}
                                onChange={(event) => setDrafts((current) => ({
                                  ...current,
                                  [order.id]: { ...draft, status: event.target.value as OrderStatus },
                                }))}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                              >
                                {ORDER_STATUSES.map((status) => (
                                  <option key={status} value={status}>{orderStatusLabel(status)}</option>
                                ))}
                                {order.status === 'refunded' && (
                                  <option value="refunded">{orderStatusLabel('refunded')}</option>
                                )}
                              </select>
                            </label>
                            <label className="text-xs text-gray-600">
                              Carrier
                              <select
                                value={draft.shippingCarrier}
                                onChange={(event) => setDrafts((current) => ({
                                  ...current,
                                  [order.id]: { ...draft, shippingCarrier: event.target.value },
                                }))}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                              >
                                <option value="">Select carrier</option>
                                {SHIPPING_CARRIERS.map((carrier) => (
                                  <option key={carrier.id} value={carrier.id}>{carrier.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs text-gray-600 sm:col-span-2">
                              Tracking number or carrier link
                              <input
                                value={draft.trackingNumber}
                                onChange={(event) => handleTrackingChange(order.id, event.target.value)}
                                placeholder="Paste tracking number or USPS / UPS / FedEx link"
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                              />
                              {detectedCarrierHint[order.id] && (
                                <span className="mt-1 block text-xs text-emerald-700">
                                  {detectedCarrierHint[order.id]}
                                </span>
                              )}
                            </label>
                            <label className="text-xs text-gray-600 sm:col-span-2">
                              Estimated delivery (optional)
                              <input
                                type="date"
                                value={draft.estimatedDelivery}
                                onChange={(event) => setDrafts((current) => ({
                                  ...current,
                                  [order.id]: { ...draft, estimatedDelivery: event.target.value },
                                }))}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                              />
                            </label>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {canMarkShipped ? (
                              <>
                                <button
                                  type="button"
                                  disabled={savingOrderId === order.id}
                                  onClick={() => void markOrderShipped(order)}
                                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                                >
                                  {savingOrderId === order.id
                                    ? 'Saving…'
                                    : shippingContext?.emailDeliveryMode === 'smtp'
                                      ? 'Mark shipped & email collector'
                                      : 'Mark shipped'}
                                </button>
                                <button
                                  type="button"
                                  disabled={savingOrderId === order.id}
                                  onClick={() => void updateOrder(order)}
                                  className="rounded-md border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  Save changes
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={savingOrderId === order.id}
                                onClick={() => void updateOrder(order)}
                                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                              >
                                {savingOrderId === order.id ? 'Saving…' : 'Save changes'}
                              </button>
                            )}

                            {order.shippingLabelUrl && (
                              <a
                                href={order.shippingLabelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-md border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Open PDF label
                              </a>
                            )}

                            {canMarkPaid && (
                              <button
                                type="button"
                                disabled={savingOrderId === order.id}
                                onClick={() => void markOrderAsPaid(order)}
                                className="rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                Mark paid
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setMessageOpen((current) => ({ ...current, [order.id]: !current[order.id] }))}
                              className="rounded-md border border-gray-300 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Message collector
                            </button>

                            {canRefund && (
                              <button
                                type="button"
                                onClick={() => void issueRefund(order)}
                                className="ml-auto rounded-md border border-red-200 px-3.5 py-2 text-sm text-red-700 hover:bg-red-50"
                              >
                                {isManualPayment ? 'Mark refunded' : 'Issue refund'}
                              </button>
                            )}
                          </div>

                          {shippingContext?.provider !== 'easypost' && !order.shippingLabelUrl && canMarkShipped && (
                            <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">
                              Buying labels outside the site (Pirate Ship, USPS, UPS)? Copy the address, paste the tracking number above, and click Mark shipped.{' '}
                              <Link
                                href={adminSettingFieldHref('SHIPPING_PROVIDER')}
                                className="whitespace-nowrap font-medium text-gray-700 underline hover:text-gray-900"
                              >
                                Enable EasyPost in-site labels →
                              </Link>
                            </p>
                          )}

                          {shippingContext && shippingContext.emailDeliveryMode !== 'smtp' && (
                            <p className="text-xs text-gray-500">
                              Email delivery is in log mode, so automatic shipped emails are paused. Use <strong>Copy update note</strong> after adding tracking to message the collector, or{' '}
                              <Link
                                href={adminSettingFieldHref('EMAIL_DELIVERY_MODE')}
                                className="whitespace-nowrap font-medium text-gray-700 underline hover:text-gray-900"
                              >
                                enable SMTP in Settings →
                              </Link>
                            </p>
                          )}
                        </div>

                        {/* EasyPost label quote & purchase panel */}
                        {canBuyEasyPost && (
                          <div className="rounded-lg border border-gray-200 p-4">
                            {!shippingContext?.easyPostReady ? (
                              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                                <div>
                                  <p className="font-semibold">Finish EasyPost setup to buy labels here</p>
                                  <p className="mt-0.5 text-amber-800">
                                    Missing: {shippingContext?.missingConfig.join(', ')}.
                                  </p>
                                </div>
                                <Link
                                  href={adminSettingFieldHref('EASYPOST_API_KEY')}
                                  className="rounded-md bg-amber-900 px-3 py-1.5 font-medium text-white hover:bg-amber-800"
                                >
                                  Open Shipping settings
                                </Link>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                      EasyPost shipping label
                                    </h4>
                                    <p className="mt-0.5 text-xs text-gray-500">
                                      Compare live carrier rates before purchasing a printable PDF label.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLabelPanelOpen((current) => ({ ...current, [order.id]: !current[order.id] }))
                                    }
                                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
                                  >
                                    {labelPanelOpen[order.id] ? 'Hide label rates' : 'Get EasyPost label'}
                                  </button>
                                </div>

                                {labelPanelOpen[order.id] && (
                                  <div className="space-y-3 border-t border-gray-100 pt-3">
                                    <div>
                                      <p className="mb-1.5 text-xs font-medium text-gray-600">Box size presets</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {STUDIO_SHIPPING_PRESETS.map((preset) => (
                                          <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => {
                                              setParcelDrafts((current) => ({
                                                ...current,
                                                [order.id]: parcelToDraft(preset.parcel),
                                              }));
                                              setRateQuotes((current) => {
                                                if (!current[order.id]) return current;
                                                const next = { ...current };
                                                delete next[order.id];
                                                return next;
                                              });
                                            }}
                                            className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:border-gray-400 hover:bg-white"
                                          >
                                            {preset.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                      {([
                                        ['weightOz', 'Weight (oz)'],
                                        ['lengthIn', 'Length (in)'],
                                        ['widthIn', 'Width (in)'],
                                        ['heightIn', 'Height (in)'],
                                      ] as const).map(([field, label]) => (
                                        <label key={field} className="text-xs text-gray-600">
                                          {label}
                                          <input
                                            type="number"
                                            min="0.1"
                                            step="0.5"
                                            value={parcelDraft[field]}
                                            onChange={(event) => {
                                              const value = event.target.value;
                                              setParcelDrafts((current) => ({
                                                ...current,
                                                [order.id]: { ...parcelDraft, [field]: value },
                                              }));
                                            }}
                                            className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900"
                                          />
                                        </label>
                                      ))}
                                    </div>

                                    <button
                                      type="button"
                                      disabled={quotingOrderId === order.id}
                                      onClick={() => void fetchRates(order)}
                                      className="rounded-md border border-gray-900 px-3.5 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-900 hover:text-white disabled:opacity-50"
                                    >
                                      {quotingOrderId === order.id ? 'Fetching live rates…' : quote ? 'Refresh rates' : 'Get live rates'}
                                    </button>

                                    {quote && (
                                      <div className="space-y-2 pt-1">
                                        {quote.rates.length === 0 ? (
                                          <p className="text-xs text-gray-500">
                                            No carrier rates returned for these dimensions. Try adjusting weight or box size.
                                          </p>
                                        ) : (
                                          <>
                                            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                                              {quote.rates.map((rate) => {
                                                const selected = selectedRateId[order.id] === rate.id;
                                                const delta = order.shipping - rate.rate;
                                                return (
                                                  <label
                                                    key={rate.id}
                                                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs transition-colors ${
                                                      selected
                                                        ? 'border-gray-900 bg-gray-50'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                  >
                                                    <div className="flex items-center gap-2.5">
                                                      <input
                                                        type="radio"
                                                        name={`rate-${order.id}`}
                                                        checked={selected}
                                                        onChange={() =>
                                                          setSelectedRateId((current) => ({ ...current, [order.id]: rate.id }))
                                                        }
                                                      />
                                                      <div>
                                                        <p className="font-medium text-gray-900">
                                                          {rate.carrier} · {rate.service}
                                                        </p>
                                                        <p className="text-gray-500">
                                                          {rate.deliveryDays
                                                            ? `Est. ${rate.deliveryDays} ${rate.deliveryDays === 1 ? 'day' : 'days'}`
                                                            : 'Standard transit'}
                                                        </p>
                                                      </div>
                                                    </div>
                                                    <div className="text-right">
                                                      <p className="font-semibold text-gray-900">
                                                        {formatPrice(rate.rate, rate.currency)}
                                                      </p>
                                                      <p className={delta >= 0 ? 'text-emerald-700' : 'text-amber-700'}>
                                                        {delta >= 0
                                                          ? `${formatPrice(delta, rate.currency)} under paid`
                                                          : `${formatPrice(Math.abs(delta), rate.currency)} over paid`}
                                                      </p>
                                                    </div>
                                                  </label>
                                                );
                                              })}
                                            </div>

                                            {(() => {
                                              const chosen = quote.rates.find((entry) => entry.id === selectedRateId[order.id]);
                                              return (
                                                <button
                                                  type="button"
                                                  disabled={!chosen || buyingOrderId === order.id}
                                                  onClick={() => void purchaseSelectedLabel(order)}
                                                  className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                                                >
                                                  {buyingOrderId === order.id
                                                    ? 'Purchasing label…'
                                                    : chosen
                                                      ? `Buy ${formatPrice(chosen.rate, chosen.currency)} label & mark shipped`
                                                      : 'Select a rate'}
                                                </button>
                                              );
                                            })()}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {messageOpen[order.id] && (
                          <div className="rounded-lg border border-gray-200 p-4 space-y-2">
                            <p className="text-sm font-medium text-gray-900">Message {order.customerEmail}</p>
                            <textarea
                              value={messageDrafts[order.id] || ''}
                              onChange={(event) => setMessageDrafts((current) => ({ ...current, [order.id]: event.target.value }))}
                              rows={3}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                              placeholder="Write an update about this order..."
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!messageDrafts[order.id]?.trim()}
                                onClick={() => void sendMessageToCollector(order)}
                                className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                              >
                                Send message
                              </button>
                              <button
                                type="button"
                                onClick={() => setMessageOpen((current) => ({ ...current, [order.id]: false }))}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </section>
                    </div>

                    {order.timeline?.length > 0 && (
                      <div className="border-t border-gray-100 pt-4">
                        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline</p>
                        <ol className="space-y-2">
                          {order.timeline.map((entry) => (
                            <li key={entry.id} className="text-xs text-gray-700">
                              <span className="font-medium text-gray-900">{entry.message}</span>
                              {entry.details && <span className="text-gray-600"> · {entry.details}</span>}
                              <span className="ml-2 text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
