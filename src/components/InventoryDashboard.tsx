'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { AlertTriangle, Check, ChevronDown, ExternalLink, Search, SlidersHorizontal } from 'lucide-react';
import { StockAlert, type InventoryStatus } from '@/lib/inventory';
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  type LowStockThresholdConfig,
  Product,
  formatLowStockRangeLabel,
  formatPrice,
  normalizeCategoryThresholdKey,
} from '@/lib/commerce';
import ProductImage from '@/components/ProductImage';
import { IntegerField } from '@/components/admin/StudioFormFields';
import StockIndicator from './StockIndicator';

interface DashboardData {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
  activeAlerts: number;
  recentMovements: unknown[];
  lowStockThresholds?: LowStockThresholdConfig;
}

function formatCategoryDisplayName(raw: string): string {
  const cleaned = raw.replace(/[-_]+/g, ' ').trim();
  if (!cleaned) return 'Uncategorized';
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

type StatusFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

const swrFetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
};

const swrOptions = {
  revalidateOnFocus: false,
  dedupingInterval: 5_000,
} as const;

function resolveRowStatus(
  product: Product,
  inventory?: InventoryStatus | null,
): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (inventory) {
    if (inventory.stockStatus === 'out_of_stock' || inventory.availableStock <= 0) return 'out_of_stock';
    if (inventory.stockStatus === 'low_stock') return 'low_stock';
    return 'in_stock';
  }
  return product.availability === 'sold' ? 'out_of_stock' : 'in_stock';
}

type InventoryDashboardProps = {
  /** Navigate directly to the Products tab (optional productId to edit, or omit to create). */
  onOpenProduct?: (productId?: string) => void;
};

export function InventoryDashboard({ onOpenProduct }: InventoryDashboardProps = {}) {
  const { mutate: globalMutate } = useSWRConfig();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  /** Only stores unsaved user edits; untouched rows always mirror live server stock. */
  const [stockDrafts, setStockDrafts] = useState<Record<string, number | ''>>({});
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [savedProductId, setSavedProductId] = useState<string | null>(null);
  const [dismissingAlertId, setDismissingAlertId] = useState<string | null>(null);
  const [dismissingAllAlerts, setDismissingAllAlerts] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [defaultThresholdDraft, setDefaultThresholdDraft] = useState<number | '' | null>(null);
  const [categoryThresholdDrafts, setCategoryThresholdDrafts] = useState<Record<string, number | ''>>({});
  const [savingThresholds, setSavingThresholds] = useState(false);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const {
    data: productsPayload,
    error: productsError,
    isLoading: productsLoading,
    mutate: mutateProducts,
  } = useSWR<{ products: Product[] }>('/api/admin/products', swrFetcher, swrOptions);

  const products = useMemo(() => productsPayload?.products ?? [], [productsPayload]);
  const productIdsKey = useMemo(
    () => (products.length > 0 ? `/api/inventory?productIds=${encodeURIComponent(products.map((p) => p.id).join(','))}` : null),
    [products],
  );

  const {
    data: dashboardData,
    mutate: mutateDashboard,
  } = useSWR<DashboardData & { success?: boolean }>('/api/inventory', swrFetcher, swrOptions);

  const {
    data: alertsPayload,
    mutate: mutateAlerts,
  } = useSWR<{ success?: boolean; alerts?: StockAlert[] }>('/api/inventory/alerts', swrFetcher, swrOptions);

  const {
    data: inventoriesPayload,
    mutate: mutateInventories,
  } = useSWR<{ success?: boolean; inventories?: Record<string, InventoryStatus> }>(
    productIdsKey,
    swrFetcher,
    swrOptions,
  );

  const inventories = useMemo(() => inventoriesPayload?.inventories ?? {}, [inventoriesPayload]);
  const alerts = useMemo(() => alertsPayload?.alerts ?? [], [alertsPayload]);

  const savedThresholds: LowStockThresholdConfig = useMemo(
    () => dashboardData?.lowStockThresholds ?? { defaultThreshold: DEFAULT_LOW_STOCK_THRESHOLD, categories: {} },
    [dashboardData],
  );

  const categoryEntries = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const product of products) {
      const key = normalizeCategoryThresholdKey(product.category);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key, label: formatCategoryDisplayName(product.category), count: 1 });
      }
    }
    for (const key of Object.keys(savedThresholds.categories)) {
      if (!map.has(key)) {
        map.set(key, { key, label: formatCategoryDisplayName(key), count: 0 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [products, savedThresholds]);

  const effectiveDefaultDraft = defaultThresholdDraft === null ? savedThresholds.defaultThreshold : defaultThresholdDraft;

  const thresholdsDirty = useMemo(() => {
    const nextDefault = effectiveDefaultDraft === '' ? savedThresholds.defaultThreshold : Number(effectiveDefaultDraft);
    if (nextDefault !== savedThresholds.defaultThreshold) return true;
    for (const key of Object.keys(categoryThresholdDrafts)) {
      const draftVal = categoryThresholdDrafts[key];
      const savedVal = savedThresholds.categories[key];
      if (draftVal === '') {
        if (savedVal !== undefined) return true;
      } else if (Number(draftVal) !== savedVal) {
        return true;
      }
    }
    return false;
  }, [effectiveDefaultDraft, categoryThresholdDrafts, savedThresholds]);

  const thresholdSummaryText = useMemo(() => {
    const parts = [`Default: ${formatLowStockRangeLabel(savedThresholds.defaultThreshold)}`];
    for (const entry of categoryEntries) {
      const custom = savedThresholds.categories[entry.key];
      if (custom !== undefined) {
        parts.push(`${entry.label}: ${formatLowStockRangeLabel(custom)}`);
      }
    }
    return parts.join(' · ');
  }, [categoryEntries, savedThresholds]);

  const counts = useMemo(() => {
    if (dashboardData && typeof dashboardData.totalProducts === 'number') {
      return {
        all: dashboardData.totalProducts,
        in_stock: dashboardData.inStock,
        low_stock: dashboardData.lowStock,
        out_of_stock: dashboardData.outOfStock,
      };
    }
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    for (const product of products) {
      const status = resolveRowStatus(product, inventories[product.id]);
      if (status === 'out_of_stock') outOfStock++;
      else if (status === 'low_stock') lowStock++;
      else inStock++;
    }
    return { all: products.length, in_stock: inStock, low_stock: lowStock, out_of_stock: outOfStock };
  }, [dashboardData, products, inventories]);

  const alertsByProduct = useMemo(() => {
    const map = new Map<string, StockAlert>();
    for (const alert of alerts) {
      if (!map.has(alert.productId)) map.set(alert.productId, alert);
    }
    return map;
  }, [alerts]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const status = resolveRowStatus(product, inventories[product.id]);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!query) return true;
      return (
        product.title.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query) ||
        product.medium.toLowerCase().includes(query)
      );
    });
  }, [products, inventories, statusFilter, searchQuery]);

  async function refreshAll() {
    await Promise.all([
      mutateDashboard(),
      mutateAlerts(),
      mutateInventories(),
      mutateProducts(),
      globalMutate('/api/admin/stats'),
    ]);
  }

  async function handleSetStock(productId: string) {
    const draft = stockDrafts[productId];
    const currentStock = draft === '' || draft === undefined ? Number.NaN : Number(draft);
    if (!Number.isFinite(currentStock) || currentStock < 0) {
      setFeedback({ type: 'error', message: 'Enter a valid quantity (0 or more).' });
      return;
    }

    setSavingProductId(productId);
    setFeedback(null);
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_update',
          updates: [{ productId, currentStock }],
        }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Failed to update stock');
      }

      await refreshAll();
      setStockDrafts((current) => {
        if (!(productId in current)) return current;
        const next = { ...current };
        delete next[productId];
        return next;
      });
      setSavedProductId(productId);
      window.setTimeout(() => {
        setSavedProductId((current) => (current === productId ? null : current));
      }, 2500);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update stock',
      });
    } finally {
      setSavingProductId(null);
    }
  }

  async function handleDismissAlert(alertId: string) {
    setDismissingAlertId(alertId);
    setFeedback(null);
    try {
      const response = await fetch('/api/inventory/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', alertId }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Failed to dismiss alert');
      }
      await Promise.all([mutateAlerts(), mutateDashboard(), globalMutate('/api/admin/stats')]);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to dismiss alert',
      });
    } finally {
      setDismissingAlertId(null);
    }
  }

  async function handleDismissAllAlerts(type?: 'low_stock' | 'out_of_stock') {
    setDismissingAllAlerts(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/inventory/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_all', ...(type ? { type } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Failed to dismiss alerts');
      }
      await Promise.all([mutateAlerts(), mutateDashboard(), globalMutate('/api/admin/stats')]);
      setAlertsOpen(false);
      const count = typeof data.dismissedCount === 'number' ? data.dismissedCount : alerts.length;
      setFeedback({
        type: 'success',
        message:
          type === 'low_stock'
            ? `Dismissed ${count} low-stock ${count === 1 ? 'alert' : 'alerts'}.`
            : `Dismissed ${count} stock ${count === 1 ? 'alert' : 'alerts'}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to dismiss alerts',
      });
    } finally {
      setDismissingAllAlerts(false);
    }
  }

  async function handleSaveThresholds() {
    const nextDefault = effectiveDefaultDraft === '' ? DEFAULT_LOW_STOCK_THRESHOLD : Number(effectiveDefaultDraft);
    if (!Number.isFinite(nextDefault) || nextDefault < 0) {
      setFeedback({ type: 'error', message: 'Default low-stock threshold must be 0 or more.' });
      return;
    }

    const nextCategories: Record<string, number> = { ...savedThresholds.categories };
    for (const [key, value] of Object.entries(categoryThresholdDrafts)) {
      if (value === '') {
        delete nextCategories[key];
      } else {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0) {
          setFeedback({ type: 'error', message: 'Category thresholds must be 0 or more.' });
          return;
        }
        nextCategories[key] = Math.floor(numeric);
      }
    }

    setSavingThresholds(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_thresholds',
          defaultThreshold: Math.floor(nextDefault),
          categories: nextCategories,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Failed to save low-stock ranges');
      }
      setDefaultThresholdDraft(null);
      setCategoryThresholdDrafts({});
      await refreshAll();
      setFeedback({ type: 'success', message: 'Low-stock ranges saved and applied across your shop.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save low-stock ranges',
      });
    } finally {
      setSavingThresholds(false);
    }
  }

  function focusProductRow(productId: string) {
    setStatusFilter('all');
    setSearchQuery('');
    setHighlightedProductId(productId);
    window.requestAnimationFrame(() => {
      const row = rowRefs.current[productId];
      if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = row.querySelector<HTMLInputElement>('input');
      input?.focus();
      input?.select();
    });
    window.setTimeout(() => {
      setHighlightedProductId((current) => (current === productId ? null : current));
    }, 2500);
  }

  if (productsLoading && !productsPayload) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  const statCards: Array<{
    id: StatusFilter;
    label: string;
    count: number;
    tone: string;
    activeRing: string;
  }> = [
    { id: 'all', label: 'All products', count: counts.all, tone: 'text-gray-900', activeRing: 'border-gray-900 ring-1 ring-gray-900' },
    { id: 'in_stock', label: 'In stock', count: counts.in_stock, tone: 'text-emerald-700', activeRing: 'border-emerald-600 ring-1 ring-emerald-600' },
    { id: 'low_stock', label: 'Low stock', count: counts.low_stock, tone: 'text-amber-700', activeRing: 'border-amber-600 ring-1 ring-amber-600' },
    { id: 'out_of_stock', label: 'Out of stock', count: counts.out_of_stock, tone: 'text-red-700', activeRing: 'border-red-600 ring-1 ring-red-600' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Inventory</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            Update quantities inline — stock alerts update and clear automatically.
          </p>
        </div>
        {onOpenProduct ? (
          <button
            type="button"
            onClick={() => onOpenProduct()}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 self-start sm:self-auto"
          >
            Add product
          </button>
        ) : (
          <Link
            href="/admin?tab=products&create=1"
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 self-start sm:self-auto"
          >
            Add product
          </Link>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {productsError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Could not load product inventory. Check your database connection, then refresh.
        </div>
      )}

      {/* Clickable status filter cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Filter inventory by stock status">
        {statCards.map((card) => {
          const active = statusFilter === card.id;
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(card.id)}
              className={`rounded-lg border bg-white px-4 py-3 text-left transition-all hover:border-gray-400 ${
                active ? card.activeRing : 'border-gray-200'
              }`}
            >
              <p className="text-xs font-medium text-gray-500">{card.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${card.tone}`}>{card.count}</p>
            </button>
          );
        })}
      </div>

      {/* Collapsible inline active stock alerts strip (only when alerts exist) */}
      {alerts.length > 0 && (() => {
        const hasLowStockAlerts = alerts.some((alert) => alert.type === 'low_stock');
        const hasOutOfStockAlerts = alerts.some(
          (alert) => alert.type === 'out_of_stock' || alert.severity === 'critical',
        );
        return (
          <section
            aria-label="Stock alerts"
            className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/70"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <button
                type="button"
                aria-expanded={alertsOpen}
                onClick={() => setAlertsOpen((open) => !open)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded text-left text-sm font-medium text-amber-950 transition-colors hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>
                  {alerts.length} stock {alerts.length === 1 ? 'alert' : 'alerts'}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-amber-700/70 transition-transform duration-200 ${
                    alertsOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {hasLowStockAlerts && hasOutOfStockAlerts && (
                  <button
                    type="button"
                    disabled={dismissingAllAlerts}
                    onClick={() => void handleDismissAllAlerts('low_stock')}
                    className="rounded-md border border-amber-300/80 bg-white/80 px-2.5 py-1 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-100 disabled:opacity-50"
                  >
                    {dismissingAllAlerts ? 'Dismissing…' : 'Dismiss low stock'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={dismissingAllAlerts}
                  onClick={() => void handleDismissAllAlerts()}
                  className="rounded-md border border-amber-300/80 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-100 disabled:opacity-50"
                >
                  {dismissingAllAlerts ? 'Dismissing…' : 'Dismiss all'}
                </button>
              </div>
            </div>
            {alertsOpen && (
              <ul className="divide-y divide-amber-200/60 border-t border-amber-200/80">
                {alerts.map((alert) => {
                  const product = products.find((p) => p.id === alert.productId);
                  const title = product?.title || alert.productId;
                  const isOut = alert.type === 'out_of_stock' || alert.severity === 'critical';
                  return (
                    <li
                      key={alert.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                            isOut ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate font-medium text-gray-900">{title}</span>
                        <span className="text-xs text-gray-600">{alert.message}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => focusProductRow(alert.productId)}
                          className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                        >
                          Restock
                        </button>
                        <button
                          type="button"
                          disabled={dismissingAlertId === alert.id || dismissingAllAlerts}
                          onClick={() => void handleDismissAlert(alert.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-amber-100/80 hover:text-gray-900 disabled:opacity-50"
                        >
                          {dismissingAlertId === alert.id ? 'Dismissing…' : 'Dismiss'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })()}

      {/* Per-category low-stock ranges */}
      <details className="group/thresholds overflow-hidden rounded-lg border border-gray-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm select-none transition-colors hover:bg-gray-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex shrink-0 items-center gap-2 font-medium text-gray-900">
            <SlidersHorizontal className="h-4 w-4 text-gray-500" aria-hidden="true" />
            Low-stock ranges by category
          </span>
          <span className="inline-flex min-w-0 items-center gap-2 text-xs text-gray-500">
            <span className="truncate">{thresholdSummaryText}</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-open/thresholds:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>
        <div className="border-t border-gray-200 px-4 py-4 space-y-4">
          <p className="text-xs text-gray-600">
            Choose the quantity at which each category is flagged as low stock. Enter <span className="font-medium text-gray-900">0</span> to disable low-stock warnings (ideal for 1-of-1 originals), or leave a category blank to use the default.
          </p>

          <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Default (all other categories)</p>
                <p className="text-xs text-gray-500">Applies to categories without a custom range</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24">
                  <IntegerField
                    label="Default low-stock threshold"
                    labelHidden
                    compact
                    min={0}
                    max={9999}
                    value={effectiveDefaultDraft}
                    onChange={(next) => setDefaultThresholdDraft(next)}
                  />
                </div>
                <span className="w-28 text-right text-xs font-medium text-gray-600">
                  {formatLowStockRangeLabel(
                    effectiveDefaultDraft === '' ? DEFAULT_LOW_STOCK_THRESHOLD : Number(effectiveDefaultDraft),
                  )}
                </span>
              </div>
            </div>

            {categoryEntries.map((entry) => {
              const hasDraft = Object.prototype.hasOwnProperty.call(categoryThresholdDrafts, entry.key);
              const savedValue = savedThresholds.categories[entry.key];
              const fieldValue: number | '' = hasDraft
                ? categoryThresholdDrafts[entry.key]
                : savedValue ?? '';
              const fallbackNumeric =
                effectiveDefaultDraft === '' ? DEFAULT_LOW_STOCK_THRESHOLD : Number(effectiveDefaultDraft);
              const previewLabel =
                fieldValue === ''
                  ? `Default (${formatLowStockRangeLabel(fallbackNumeric)})`
                  : formatLowStockRangeLabel(Number(fieldValue));

              return (
                <div key={entry.key} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{entry.label}</p>
                    <p className="text-xs text-gray-500">
                      {entry.count === 0
                        ? 'Saved rule (no current products)'
                        : `${entry.count} ${entry.count === 1 ? 'product' : 'products'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24">
                      <IntegerField
                        label={`Low-stock threshold for ${entry.label}`}
                        labelHidden
                        compact
                        min={0}
                        max={9999}
                        placeholder={String(fallbackNumeric)}
                        value={fieldValue}
                        onChange={(next) =>
                          setCategoryThresholdDrafts((current) => ({ ...current, [entry.key]: next }))
                        }
                      />
                    </div>
                    <span className="w-28 text-right text-xs font-medium text-gray-600">
                      {previewLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2">
            {thresholdsDirty && (
              <button
                type="button"
                disabled={savingThresholds}
                onClick={() => {
                  setDefaultThresholdDraft(null);
                  setCategoryThresholdDrafts({});
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              disabled={!thresholdsDirty || savingThresholds}
              onClick={() => void handleSaveThresholds()}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
                thresholdsDirty
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'border border-gray-200 bg-gray-50 text-gray-400'
              } disabled:cursor-not-allowed`}
            >
              {savingThresholds ? 'Saving…' : 'Save ranges'}
            </button>
          </div>
        </div>
      </details>

      {/* Main unified Products stock table */}
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">Products</h3>
            {statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                {statCards.find((c) => c.id === statusFilter)?.label} ×
              </button>
            )}
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products…"
              aria-label="Search inventory products"
              className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Quantity
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center">
                    <p className="text-sm font-medium text-gray-900">No products to track yet</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Add a product in the Products tab, then manage stock quantities here.
                    </p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No products match this filter.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="font-medium text-gray-900 underline"
                    >
                      Show all
                    </button>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const inventory = inventories[product.id] ?? null;
                  const savedStock = Math.max(0, Math.floor(Number(inventory?.currentStock ?? 0)) || 0);
                  const draftValue = stockDrafts[product.id] ?? savedStock;
                  const isDirty = draftValue !== '' && Number(draftValue) !== savedStock;
                  const isSaving = savingProductId === product.id;
                  const justSaved = savedProductId === product.id;
                  const isHighlighted = highlightedProductId === product.id;
                  const rowAlert = alertsByProduct.get(product.id);

                  return (
                    <tr
                      key={product.id}
                      ref={(node) => {
                        rowRefs.current[product.id] = node;
                      }}
                      className={`transition-colors ${
                        isHighlighted ? 'bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            product={product}
                            width={40}
                            height={40}
                            className="h-10 w-10 shrink-0 rounded object-cover"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {product.title}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                              {[product.category.replaceAll('-', ' '), product.medium].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StockIndicator
                            productId={product.id}
                            showDetails
                            inventory={inventory}
                          />
                          {rowAlert && (
                            <span className="text-[11px] text-amber-700">Alert active</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div
                          className="w-24"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !isSaving) {
                              event.preventDefault();
                              void handleSetStock(product.id);
                            }
                          }}
                        >
                          <IntegerField
                            label={`Quantity for ${product.title}`}
                            labelHidden
                            compact
                            min={0}
                            value={draftValue}
                            onChange={(next) =>
                              setStockDrafts((current) => {
                                if (next !== '' && Number(next) === savedStock) {
                                  if (!(product.id in current)) return current;
                                  const copy = { ...current };
                                  delete copy[product.id];
                                  return copy;
                                }
                                return { ...current, [product.id]: next };
                              })
                            }
                          />
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-900 sm:table-cell">
                        {formatPrice(product.price, product.currency || 'USD')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <div className="inline-flex items-center justify-end gap-2">
                          {justSaved && !isDirty ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              Saved
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleSetStock(product.id)}
                              disabled={isSaving || !isDirty}
                              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                isDirty
                                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                                  : 'border border-gray-200 bg-gray-50 text-gray-400'
                              } disabled:cursor-not-allowed`}
                            >
                              {isSaving ? 'Saving…' : 'Save'}
                            </button>
                          )}
                          {onOpenProduct ? (
                            <button
                              type="button"
                              onClick={() => onOpenProduct(product.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                              title={`Edit ${product.title} listing`}
                            >
                              Edit
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </button>
                          ) : (
                            <Link
                              href={`/admin?tab=products&product=${encodeURIComponent(product.id)}`}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                              title={`Edit ${product.title} listing`}
                            >
                              Edit
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default InventoryDashboard;
