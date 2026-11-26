'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, CheckCircle2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { formatPrice } from '@/lib/commerce';
import type { ConsignmentRecord, ConsignmentStatus } from '@/lib/jobs-shared';

type CatalogOption = {
  id: string;
  title: string;
  price: number;
  category: string;
  availability: string;
};

export default function AdminConsignment() {
  const [placements, setPlacements] = useState<ConsignmentRecord[]>([]);
  const [products, setProducts] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | ConsignmentStatus>('out');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [productId, setProductId] = useState('');
  const [venueName, setVenueName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [askingPrice, setAskingPrice] = useState('');
  const [artistSplitPercent, setArtistSplitPercent] = useState(60);
  const [returnDueAt, setReturnDueAt] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/consignment', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load consignment log');
      setPlacements(Array.isArray(data.placements) ? data.placements : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Failed to load consignment log',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeOut = useMemo(() => placements.filter((p) => p.status === 'out'), [placements]);
  const summary = useMemo(() => {
    const now = Date.now();
    const soonThreshold = now + 7 * 24 * 60 * 60 * 1000;
    let totalRetail = 0;
    let totalPayout = 0;
    let dueSoon = 0;
    for (const p of activeOut) {
      totalRetail += p.askingPrice * p.quantity;
      totalPayout += p.artistPayout;
      if (p.returnDueAt && new Date(p.returnDueAt).getTime() <= soonThreshold) {
        dueSoon += 1;
      }
    }
    return {
      countOut: activeOut.reduce((sum, p) => sum + p.quantity, 0),
      totalRetail,
      totalPayout,
      dueSoon,
    };
  }, [activeOut]);

  const filteredPlacements = useMemo(
    () => (filter === 'all' ? placements : placements.filter((p) => p.status === filter)),
    [filter, placements],
  );

  function handleSelectProduct(id: string) {
    setProductId(id);
    const match = products.find((p) => p.id === id);
    if (match) {
      setAskingPrice(String(match.price));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !venueName.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/consignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          venueName: venueName.trim(),
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          quantity,
          askingPrice: Number(askingPrice) || 0,
          artistSplitPercent,
          returnDueAt: returnDueAt || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log placement');
      setShowForm(false);
      setProductId('');
      setVenueName('');
      setContactName('');
      setContactEmail('');
      setQuantity(1);
      setAskingPrice('');
      setArtistSplitPercent(60);
      setReturnDueAt('');
      setNotes('');
      setFilter('out');
      setFeedback({
        kind: 'success',
        text: `Logged placement at ${data.placement.venueName}. Storefront stock updated so it cannot double-sell online.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not log placement',
      });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(placement: ConsignmentRecord, status: ConsignmentStatus) {
    setBusyId(placement.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/consignment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: placement.id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update placement');
      setFeedback({
        kind: 'success',
        text:
          status === 'returned'
            ? `"${placement.productTitle}" marked returned and restored to storefront stock.`
            : status === 'sold'
              ? `"${placement.productTitle}" marked sold at ${placement.venueName} (est. payout ${formatPrice(placement.artistPayout)}).`
              : `"${placement.productTitle}" moved back to active consignment.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not update placement',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function removePlacement(placement: ConsignmentRecord) {
    if (!window.confirm(`Remove consignment record for "${placement.productTitle}" at ${placement.venueName}?`)) return;
    setBusyId(placement.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/consignment?id=${encodeURIComponent(placement.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove placement');
      setFeedback({ kind: 'success', text: 'Consignment record removed.' });
      await loadData();
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not remove placement',
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Gallery & Venue Consignments</h3>
          <p className="text-sm text-gray-600">
            Track works hanging off-site. Active placements hold storefront stock automatically and remind you before return dates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((open) => !open)}
          className="btn-primary inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 self-start px-3.5 py-2 text-sm font-medium sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {showForm ? 'Close form' : 'Log placement'}
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3.5">
          <p className="text-xs font-medium text-gray-500">Works out</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{summary.countOut}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3.5">
          <p className="text-xs font-medium text-gray-500">Gallery retail value</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{formatPrice(summary.totalRetail)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3.5">
          <p className="text-xs font-medium text-gray-500">Est. artist payout</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{formatPrice(summary.totalPayout)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3.5">
          <p className="text-xs font-medium text-gray-500">Due back soon</p>
          <p className={`mt-1 text-xl font-semibold ${summary.dueSoon > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
            {summary.dueSoon}
          </p>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            feedback.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900">New Consignment Placement</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Artwork / product *</label>
              <select
                required
                value={productId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select a catalog piece...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({formatPrice(p.price)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Gallery or venue name *</label>
              <input
                type="text"
                required
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g. Riverfront Fine Art Gallery"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Venue contact</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Curator or owner name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="gallery@example.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-gray-700">
              Quantity
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-700">
              Asking price ($)
              <input
                type="number"
                min="0"
                step="1"
                required
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-700">
              Artist split (%)
              <input
                type="number"
                min="0"
                max="100"
                value={artistSplitPercent}
                onChange={(e) => setArtistSplitPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-700">
              Return due date
              <input
                type="date"
                value={returnDueAt}
                onChange={(e) => setReturnDueAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-600">
              Estimated artist payout:{' '}
              <strong className="text-gray-900">
                {formatPrice((Number(askingPrice) || 0) * quantity * (artistSplitPercent / 100))}
              </strong>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary px-4 py-2 text-xs font-medium disabled:opacity-50"
              >
                {saving ? 'Logging...' : 'Save placement'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Status Filter Strip */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { key: 'out', label: 'Active out' },
            { key: 'sold', label: 'Sold' },
            { key: 'returned', label: 'Returned' },
            { key: 'all', label: 'All' },
          ] as const
        ).map((tab) => {
          const count =
            tab.key === 'all' ? placements.length : placements.filter((p) => p.status === tab.key).length;
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 ${active ? 'text-gray-300' : 'text-gray-400'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Placements List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
          ))}
        </div>
      ) : filteredPlacements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <Building2 className="mx-auto h-7 w-7 text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-gray-900">No consignment placements here</p>
          <p className="mt-1 text-xs text-gray-500">
            Log pieces placed at galleries, cafes, or shops so your online inventory stays accurate.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlacements.map((p) => {
            const isOverdue =
              p.status === 'out' && p.returnDueAt && new Date(p.returnDueAt).getTime() < Date.now();
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {p.productImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.productImage}
                      alt={p.productTitle}
                      className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-400">
                      <Building2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-semibold text-gray-900">{p.productTitle}</h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          p.status === 'out'
                            ? 'bg-amber-50 text-amber-800'
                            : p.status === 'sold'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {p.status === 'out' ? 'Out at venue' : p.status === 'sold' ? 'Sold' : 'Returned'}
                      </span>
                      {isOverdue && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          Return overdue
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700">
                      <strong>{p.venueName}</strong>
                      {p.contactName ? ` · ${p.contactName}` : ''}
                      {p.contactEmail ? ` (${p.contactEmail})` : ''}
                    </p>
                    <p className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>
                        Qty {p.quantity} · Ask {formatPrice(p.askingPrice)} · {p.artistSplitPercent}% split (
                        <strong className="text-gray-800">{formatPrice(p.artistPayout)}</strong> net)
                      </span>
                      {p.returnDueAt && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          Due {new Date(p.returnDueAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {p.status === 'out' && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void updateStatus(p, 'sold')}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Mark sold
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void updateStatus(p, 'returned')}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Mark returned
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => void removePlacement(p)}
                    aria-label={`Remove ${p.productTitle} placement`}
                    className="inline-flex items-center rounded-md border border-gray-200 bg-white p-1.5 text-gray-400 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
