'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Mail,
  Minus,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Undo2,
  WifiOff,
  X,
} from 'lucide-react';
import { MarketQrCard } from '@/components/admin/MarketQrCard';
import {
  buildMarketKioskUrl,
  buildMarketPayUrl,
  buildMarketQrUrl,
  buildPrintablePriceSheetHtml,
  DEFAULT_PRICE_SHEET_CONFIG,
  formatMarketQrDisplayUrl,
  MARKET_PAYMENT_METHODS,
  MARKET_QR_DESTINATIONS,
  marketPaymentMethodLabel,
  normalizePriceSheetConfig,
  type MarketBookkeepingSummary,
  type MarketPaymentMethod,
  type MarketQrDestination,
  type MarketSaleLedgerEntry,
  type PriceSheetConfig,
  type PriceSheetCustomLine,
  type PrintableSheetItem,
} from '@/lib/market-qr';

const OFFLINE_SALES_QUEUE_KEY = 'studio_market_offline_sales_queue';

type MarketSubView = 'pos' | 'print';

interface MarketEventRecord {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  boothFee: number;
  otherExpenses: number;
  salesTaxRate: number;
  promoCode: string | null;
  followUpEnabled: boolean;
  followUpDelayDays: number;
  followUpSubject: string | null;
  followUpBody: string | null;
  followUpSentAt: string | null;
  priceSheetConfig: PriceSheetConfig;
  notes: string | null;
  contactCount: number;
  summary: MarketBookkeepingSummary;
}

interface MarketProductTile {
  id: string;
  slug: string;
  title: string;
  price: number;
  category: string;
  medium: string;
  dimensions: string;
  availability: string;
  imageUrl: string;
  trackedStock: number | null;
  availableStock: number | null;
}

interface MarketWorkspaceResponse {
  siteName?: string;
  events: MarketEventRecord[];
  sales: MarketSaleLedgerEntry[];
  summary: MarketBookkeepingSummary;
  products: MarketProductTile[];
}

interface PosBagItem {
  key: string;
  productId?: string;
  slug?: string;
  title: string;
  unitPrice: number;
  quantity: number;
  maxStock: number | null;
}

interface QueuedOfflineSale {
  id: string;
  queuedAt: string;
  payload: {
    marketEventId?: string | null;
    paymentMethod: MarketPaymentMethod;
    items: Array<{ productId?: string; title: string; unitPrice: number; quantity: number }>;
    taxRate: number;
    buyerEmail?: string;
    buyerName?: string;
    subscribeToFollowUp: boolean;
    sendReceipt: boolean;
    notes?: string;
  };
  total: number;
}

interface UndoBannerState {
  orderId: string;
  orderNumber: string;
  total: number;
  paymentMethod: string;
  expiresAt: number;
}

interface EventFormState {
  id?: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  boothFee: string;
  otherExpenses: string;
  salesTaxRate: string;
  promoCode: string;
  notes: string;
  followUpEnabled: boolean;
  followUpDelayDays: string;
  followUpSubject: string;
  followUpBody: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Request failed (${res.status})`);
  }
  return res.json();
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(value) ? value : 0);
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function readOfflineSalesQueue(): QueuedOfflineSale[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_SALES_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineSalesQueue(queue: QueuedOfflineSale[]) {
  if (typeof window === 'undefined') return;
  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(OFFLINE_SALES_QUEUE_KEY);
    } else {
      window.localStorage.setItem(OFFLINE_SALES_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // ignore storage limits
  }
}

export default function AdminMarkets({ onSelectTab }: { onSelectTab?: (tab: string) => void }) {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [subView, setSubView] = useState<MarketSubView>('pos');
  const [siteOrigin, setSiteOrigin] = useState<string>('');
  const [siteName, setSiteName] = useState<string>('The Studio');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Event modal state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventForm, setEventForm] = useState<EventFormState>({
    name: '',
    location: '',
    startDate: toDateInputValue(new Date().toISOString()),
    endDate: '',
    boothFee: '0',
    otherExpenses: '0',
    salesTaxRate: '0',
    promoCode: '',
    notes: '',
    followUpEnabled: true,
    followUpDelayDays: '1',
    followUpSubject: '',
    followUpBody: '',
  });

  // POS state
  const [posSearch, setPosSearch] = useState('');
  const [posCategory, setPosCategory] = useState('All');
  const [posBag, setPosBag] = useState<PosBagItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<MarketPaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [sendReceipt, setSendReceipt] = useState(true);
  const [customItemTitle, setCustomItemTitle] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [showCustomAdder, setShowCustomAdder] = useState(false);
  const [recordingSale, setRecordingSale] = useState(false);
  const [undoBanner, setUndoBanner] = useState<UndoBannerState | null>(null);
  const [undoingSale, setUndoingSale] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<QueuedOfflineSale[]>([]);
  const [syncingOffline, setSyncingOffline] = useState(false);

  // Buyer Pay QR modal state
  const [buyerQrOpen, setBuyerQrOpen] = useState(false);
  const [buyerQrUrl, setBuyerQrUrl] = useState('');
  const [buyerQrDataUrl, setBuyerQrDataUrl] = useState('');
  const [copiedBuyerLink, setCopiedBuyerLink] = useState(false);

  // Print & QR Studio state
  const [sheetConfig, setSheetConfig] = useState<PriceSheetConfig>(() => normalizePriceSheetConfig(null));
  const [includePerPieceQr, setIncludePerPieceQr] = useState(true);
  const [sheetMasterQrSvg, setSheetMasterQrSvg] = useState<string>('');
  const [pieceQrMap, setPieceQrMap] = useState<Record<string, string>>({});
  const [savingSheet, setSavingSheet] = useState(false);
  const [newCustomLine, setNewCustomLine] = useState<{
    title: string;
    details: string;
    priceLabel: string;
  }>({
    title: '',
    details: '',
    priceLabel: '',
  });
  const [copiedKioskUrl, setCopiedKioskUrl] = useState(false);

  const [voidingOrderId, setVoidingOrderId] = useState<string | null>(null);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);

  const apiUrl = selectedEventId
    ? `/api/admin/markets?eventId=${encodeURIComponent(selectedEventId)}`
    : '/api/admin/markets';

  const { data, error, isLoading, mutate } = useSWR<MarketWorkspaceResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const events = useMemo(() => data?.events ?? [], [data?.events]);
  const sales = useMemo(() => data?.sales ?? [], [data?.sales]);
  const products = useMemo(() => data?.products ?? [], [data?.products]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  // Default to the first event once loaded if none chosen yet
  const initializedEventRef = useRef(false);
  useEffect(() => {
    if (initializedEventRef.current) return;
    if (events.length > 0) {
      initializedEventRef.current = true;
      setSelectedEventId(events[0].id);
    }
  }, [events]);

  // Load site origin & studio name once
  useEffect(() => {
    let cancelled = false;
    async function loadPublicConfig() {
      try {
        const res = await fetch('/api/config/public');
        const json = res.ok ? await res.json() : null;
        const configured = (json?.NEXT_PUBLIC_SITE_URL || json?.NEXT_PUBLIC_BASE_URL || '').trim();
        if (!cancelled) {
          if (configured) {
            try {
              setSiteOrigin(new URL(configured).origin);
            } catch {
              setSiteOrigin(window.location.origin);
            }
          } else if (typeof window !== 'undefined') {
            setSiteOrigin(window.location.origin);
          }
          if (typeof json?.ARTIST_NAME === 'string' && json.ARTIST_NAME.trim()) {
            setSiteName(json.ARTIST_NAME.trim());
          }
        }
      } catch {
        if (!cancelled && typeof window !== 'undefined') {
          setSiteOrigin(window.location.origin);
        }
      }
    }
    void loadPublicConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync print-sheet defaults whenever the active event changes
  useEffect(() => {
    setSheetConfig(normalizePriceSheetConfig(activeEvent?.priceSheetConfig ?? null));
  }, [activeEvent]);

  // Undo banner auto-expire timer (10s)
  useEffect(() => {
    if (!undoBanner) return;
    const msLeft = Math.max(0, undoBanner.expiresAt - Date.now());
    const timer = window.setTimeout(() => setUndoBanner(null), msLeft);
    return () => window.clearTimeout(timer);
  }, [undoBanner]);

  // Offline sale queue sync
  const flushOfflineSales = useCallback(async () => {
    const queue = readOfflineSalesQueue();
    setOfflineQueue(queue);
    if (queue.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

    setSyncingOffline(true);
    const remaining: QueuedOfflineSale[] = [];
    let syncedCount = 0;
    for (const entry of queue) {
      try {
        const res = await fetch('/api/admin/markets/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.payload),
        });
        if (res.ok) {
          syncedCount += 1;
        } else {
          remaining.push(entry);
        }
      } catch {
        remaining.push(entry);
      }
    }
    writeOfflineSalesQueue(remaining);
    setOfflineQueue(remaining);
    setSyncingOffline(false);
    if (syncedCount > 0) {
      setNotice({ kind: 'success', text: `Synced ${syncedCount} offline sale${syncedCount === 1 ? '' : 's'}.` });
      void mutate();
    }
  }, [mutate]);

  useEffect(() => {
    setOfflineQueue(readOfflineSalesQueue());
    void flushOfflineSales();
    const onOnline = () => void flushOfflineSales();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushOfflineSales]);

  // Notice auto-dismiss
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // POS derived values
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return ['All', ...Array.from(set).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = posSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (posCategory !== 'All' && p.category !== posCategory) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.medium.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, posCategory, posSearch]);

  const bagQuantityByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of posBag) {
      if (item.productId) {
        map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
      }
    }
    return map;
  }, [posBag]);

  const activeTaxRate = activeEvent?.salesTaxRate ?? 0;
  const posSubtotal = useMemo(
    () => Math.round(posBag.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100,
    [posBag],
  );
  const posTax = activeTaxRate > 0 ? Math.round(posSubtotal * (activeTaxRate / 100) * 100) / 100 : 0;
  const posTotal = Math.round((posSubtotal + posTax) * 100) / 100;

  const parsedTendered = Number.parseFloat(cashTendered);
  const cashChangeDue =
    paymentMethod === 'cash' && Number.isFinite(parsedTendered) && parsedTendered >= posTotal
      ? Math.round((parsedTendered - posTotal) * 100) / 100
      : null;

  const addProductToBag = (product: MarketProductTile) => {
    const isSoldOut =
      product.availability === 'sold' ||
      (product.availableStock !== null && product.availableStock <= 0);
    if (isSoldOut) return;

    setPosBag((current) => {
      const existing = current.find((item) => item.productId === product.id);
      const maxStock = product.availableStock;
      if (existing) {
        if (maxStock !== null && existing.quantity >= maxStock) {
          return current;
        }
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...current,
        {
          key: `prod-${product.id}`,
          productId: product.id,
          slug: product.slug,
          title: product.title,
          unitPrice: product.price,
          quantity: 1,
          maxStock,
        },
      ];
    });
  };

  const addCustomLineToBag = () => {
    const title = customItemTitle.trim();
    const price = Number.parseFloat(customItemPrice);
    if (!title || !Number.isFinite(price) || price <= 0) {
      setNotice({ kind: 'error', text: 'Enter a title and price greater than $0 for the custom item.' });
      return;
    }
    setPosBag((current) => [
      ...current,
      {
        key: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        unitPrice: Math.round(price * 100) / 100,
        quantity: 1,
        maxStock: null,
      },
    ]);
    setCustomItemTitle('');
    setCustomItemPrice('');
    setShowCustomAdder(false);
  };

  const updateBagQuantity = (key: string, delta: number) => {
    setPosBag((current) =>
      current
        .map((item) => {
          if (item.key !== key) return item;
          const next = item.quantity + delta;
          if (next <= 0) return null;
          if (item.maxStock !== null && next > item.maxStock) return item;
          return { ...item, quantity: next };
        })
        .filter((item): item is PosBagItem => item !== null),
    );
  };

  const openBuyerPayQr = async () => {
    const catalogBagItems = posBag.filter((item) => item.productId || item.slug);
    if (catalogBagItems.length === 0) {
      setNotice({
        kind: 'error',
        text: 'Buyer Pay QR works with catalog products. Use Card, Cash, Venmo, or Zelle for custom-only items.',
      });
      return;
    }
    const origin = siteOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
    if (!origin) return;

    try {
      const url = buildMarketPayUrl(
        origin,
        catalogBagItems.map((item) => ({
          productId: item.slug || item.productId || '',
          quantity: item.quantity,
        })),
        {
          eventSlug: activeEvent?.slug,
          promoCode: activeEvent?.promoCode ?? undefined,
        },
      );
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 3,
        width: 512,
        color: { dark: '#111827', light: '#ffffff' },
      });
      setBuyerQrUrl(url);
      setBuyerQrDataUrl(dataUrl);
      setBuyerQrOpen(true);
    } catch (err) {
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not build Buyer Pay QR link.',
      });
    }
  };

  const handleRecordSale = async () => {
    if (posBag.length === 0) return;

    if (paymentMethod === 'stripe_market') {
      await openBuyerPayQr();
      return;
    }

    const payload = {
      marketEventId: activeEvent?.id ?? null,
      paymentMethod,
      items: posBag.map((item) => ({
        ...(item.productId ? { productId: item.productId } : {}),
        title: item.title,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
      taxRate: activeTaxRate,
      ...(buyerEmail.trim() ? { buyerEmail: buyerEmail.trim() } : {}),
      ...(buyerName.trim() ? { buyerName: buyerName.trim() } : {}),
      subscribeToFollowUp: Boolean(buyerEmail.trim() && sendReceipt),
      sendReceipt: Boolean(buyerEmail.trim() && sendReceipt),
    };

    const enqueueOffline = () => {
      const next: QueuedOfflineSale[] = [
        ...readOfflineSalesQueue(),
        {
          id: `offline-${Date.now()}`,
          queuedAt: new Date().toISOString(),
          payload,
          total: posTotal,
        },
      ];
      writeOfflineSalesQueue(next);
      setOfflineQueue(next);
      setPosBag([]);
      setCashTendered('');
      setBuyerEmail('');
      setBuyerName('');
      setNotice({
        kind: 'success',
        text: `Offline sale (${formatMoney(posTotal)}) saved locally. It will sync automatically when back online.`,
      });
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOffline();
      return;
    }

    setRecordingSale(true);
    try {
      const res = await fetch('/api/admin/markets/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Could not record sale');
      }
      const recordedSale = json?.sale as MarketSaleLedgerEntry | undefined;
      if (recordedSale?.id) {
        setUndoBanner({
          orderId: recordedSale.id,
          orderNumber: recordedSale.orderNumber,
          total: recordedSale.total,
          paymentMethod: marketPaymentMethodLabel(paymentMethod),
          expiresAt: Date.now() + 10_000,
        });
      }
      setPosBag([]);
      setCashTendered('');
      setBuyerEmail('');
      setBuyerName('');
      await mutate();
    } catch (err) {
      if (err instanceof TypeError) {
        enqueueOffline();
      } else {
        setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to record sale' });
      }
    } finally {
      setRecordingSale(false);
    }
  };

  const handleVoidSale = async (orderId: string) => {
    setVoidingOrderId(orderId);
    setUndoingSale(true);
    try {
      const res = await fetch(`/api/admin/markets/sales?orderId=${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Could not void sale');
      }
      setUndoBanner(null);
      setNotice({ kind: 'success', text: 'Sale voided and inventory restored.' });
      await mutate();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to void sale' });
    } finally {
      setVoidingOrderId(null);
      setUndoingSale(false);
    }
  };

  // Event CRUD handlers
  const openCreateEventModal = () => {
    setEventForm({
      name: '',
      location: '',
      startDate: toDateInputValue(new Date().toISOString()),
      endDate: '',
      boothFee: '0',
      otherExpenses: '0',
      salesTaxRate: '0',
      promoCode: '',
      notes: '',
      followUpEnabled: true,
      followUpDelayDays: '1',
      followUpSubject: '',
      followUpBody: '',
    });
    setEventModalOpen(true);
  };

  const openEditEventModal = () => {
    if (!activeEvent) return;
    setEventForm({
      id: activeEvent.id,
      name: activeEvent.name,
      location: activeEvent.location ?? '',
      startDate: toDateInputValue(activeEvent.startDate),
      endDate: toDateInputValue(activeEvent.endDate),
      boothFee: String(activeEvent.boothFee),
      otherExpenses: String(activeEvent.otherExpenses),
      salesTaxRate: String(activeEvent.salesTaxRate),
      promoCode: activeEvent.promoCode ?? '',
      notes: activeEvent.notes ?? '',
      followUpEnabled: activeEvent.followUpEnabled,
      followUpDelayDays: String(activeEvent.followUpDelayDays),
      followUpSubject:
        activeEvent.followUpSubject ?? `Thanks for stopping by ${activeEvent.name}`,
      followUpBody:
        activeEvent.followUpBody ??
        `It was wonderful meeting you at ${activeEvent.name}. Browse the remaining pieces from the booth below, or reply anytime with questions.`,
    });
    setEventModalOpen(true);
  };

  const handleSaveEventModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.name.trim()) {
      setNotice({ kind: 'error', text: 'Event name is required.' });
      return;
    }
    setSavingEvent(true);
    try {
      const isEdit = Boolean(eventForm.id);
      const res = await fetch('/api/admin/markets', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { id: eventForm.id } : {}),
          name: eventForm.name.trim(),
          location: eventForm.location.trim() || null,
          startDate: eventForm.startDate || new Date().toISOString(),
          endDate: eventForm.endDate || null,
          boothFee: Number.parseFloat(eventForm.boothFee) || 0,
          otherExpenses: Number.parseFloat(eventForm.otherExpenses) || 0,
          salesTaxRate: Number.parseFloat(eventForm.salesTaxRate) || 0,
          promoCode: eventForm.promoCode.trim() || null,
          notes: eventForm.notes.trim() || null,
          followUpEnabled: eventForm.followUpEnabled,
          followUpDelayDays: Math.max(0, Math.min(14, Number.parseInt(eventForm.followUpDelayDays, 10) || 1)),
          followUpSubject: eventForm.followUpSubject.trim() || null,
          followUpBody: eventForm.followUpBody.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to save event');
      }
      setEventModalOpen(false);
      if (!isEdit && json?.event?.id) {
        setSelectedEventId(json.event.id);
      }
      setNotice({ kind: 'success', text: isEdit ? 'Event updated.' : 'Market event created.' });
      await mutate();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save event' });
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteActiveEvent = async () => {
    if (!activeEvent) return;
    if (!window.confirm(`Delete "${activeEvent.name}"? Recorded orders will stay in your Orders history.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/markets?id=${encodeURIComponent(activeEvent.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || 'Failed to delete event');
      }
      setSelectedEventId('');
      setEventModalOpen(false);
      setNotice({ kind: 'success', text: 'Event deleted.' });
      await mutate();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not delete event' });
    }
  };

  const handleSendFollowUpNow = async () => {
    if (!activeEvent || !eventForm.id) return;
    if (
      !window.confirm(
        `Send the post-market follow-up email now to ${activeEvent.contactCount} tagged contact${activeEvent.contactCount === 1 ? '' : 's'}? Already-emailed recipients are automatically skipped.`,
      )
    ) {
      return;
    }
    setSendingFollowUp(true);
    try {
      // Persist the latest draft from the event editor, then send.
      await fetch('/api/admin/markets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeEvent.id,
          followUpEnabled: eventForm.followUpEnabled,
          followUpDelayDays: Math.max(0, Math.min(14, Number.parseInt(eventForm.followUpDelayDays, 10) || 1)),
          promoCode: eventForm.promoCode.trim() || null,
          followUpSubject: eventForm.followUpSubject.trim() || null,
          followUpBody: eventForm.followUpBody.trim() || null,
        }),
      });
      const res = await fetch('/api/admin/markets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeEvent.id, action: 'send_followup' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to send follow-up');
      const result = json.result as {
        sent?: number;
        skipped?: number;
        failed?: number;
        skippedReason?: string;
        reason?: string;
      } | undefined;
      if (result?.skippedReason || result?.reason) {
        setNotice({ kind: 'error', text: result.skippedReason || result.reason || 'Could not send follow-up.' });
      } else {
        setNotice({
          kind: 'success',
          text: `Follow-up sent to ${result?.sent ?? 0} contact${(result?.sent ?? 0) === 1 ? '' : 's'}${result?.skipped ? ` (${result.skipped} already sent)` : ''}.`,
        });
      }
      await mutate();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to send follow-up' });
    } finally {
      setSendingFollowUp(false);
    }
  };

  // Print & QR Studio helpers
  const selectedSheetProducts = useMemo(() => {
    if (sheetConfig.productIds.length > 0) {
      const byId = new Map(products.map((p) => [p.id, p]));
      return sheetConfig.productIds
        .map((id) => byId.get(id))
        .filter((p): p is MarketProductTile => Boolean(p));
    }
    return products.filter((p) => p.availability !== 'sold').slice(0, 12);
  }, [products, sheetConfig.productIds]);

  const effectiveOrigin = siteOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://example.com');

  const sheetMasterQrUrl = useMemo(() => {
    try {
      return buildMarketQrUrl(
        effectiveOrigin,
        sheetConfig.qrDestination,
        activeEvent?.name || 'booth',
        sheetConfig.qrCustomPath,
      );
    } catch {
      return effectiveOrigin;
    }
  }, [effectiveOrigin, sheetConfig.qrDestination, sheetConfig.qrCustomPath, activeEvent?.name]);

  // Generate vector SVGs for Print Studio live preview (only when Print tab is active)
  useEffect(() => {
    if (subView !== 'print') return;
    let cancelled = false;

    async function generateQrs() {
      try {
        if (sheetConfig.showQr) {
          const masterSvg = await QRCode.toString(sheetMasterQrUrl, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 2,
            color: { dark: '#111827', light: '#ffffff' },
          });
          if (!cancelled) setSheetMasterQrSvg(masterSvg);
        } else if (!cancelled) {
          setSheetMasterQrSvg('');
        }

        if (includePerPieceQr && sheetConfig.template !== 'booth_sign') {
          const nextMap: Record<string, string> = {};
          await Promise.all(
            selectedSheetProducts.slice(0, 24).map(async (prod) => {
              try {
                const payUrl = buildMarketPayUrl(
                  effectiveOrigin,
                  [{ productId: prod.slug || prod.id, quantity: 1 }],
                  { eventSlug: activeEvent?.slug, promoCode: activeEvent?.promoCode ?? undefined },
                );
                nextMap[prod.id] = await QRCode.toString(payUrl, {
                  type: 'svg',
                  errorCorrectionLevel: 'M',
                  margin: 1,
                  color: { dark: '#111827', light: '#ffffff' },
                });
              } catch {
                // skip piece QR if invalid
              }
            }),
          );
          if (!cancelled) setPieceQrMap(nextMap);
        } else if (!cancelled) {
          setPieceQrMap({});
        }
      } catch {
        // non-blocking
      }
    }

    void generateQrs();
    return () => {
      cancelled = true;
    };
  }, [
    subView,
    sheetConfig.showQr,
    sheetConfig.template,
    sheetMasterQrUrl,
    includePerPieceQr,
    selectedSheetProducts,
    effectiveOrigin,
    activeEvent?.slug,
    activeEvent?.promoCode,
  ]);

  const printableItems = useMemo<PrintableSheetItem[]>(() => {
    const catalogItems: PrintableSheetItem[] = selectedSheetProducts.map((p) => ({
      id: p.id,
      title: p.title,
      details: [p.medium, p.dimensions].filter(Boolean).join(' · '),
      priceLabel: formatMoney(p.price),
      imageUrl: p.imageUrl || null,
      qrSvgMarkup: includePerPieceQr ? (pieceQrMap[p.id] ?? null) : null,
    }));
    const customItems: PrintableSheetItem[] = sheetConfig.customLines.map((line, index) => ({
      id: `custom-sheet-${index}`,
      title: line.title,
      details: line.details,
      priceLabel: line.priceLabel,
      imageUrl: null,
      qrSvgMarkup: null,
    }));
    return [...catalogItems, ...customItems];
  }, [selectedSheetProducts, sheetConfig.customLines, includePerPieceQr, pieceQrMap]);

  const resolvedSiteName = data?.siteName || siteName;

  const previewHtml = useMemo(() => {
    if (subView !== 'print') return '';
    return buildPrintablePriceSheetHtml({
      config: sheetConfig,
      siteName: resolvedSiteName,
      eventName: activeEvent?.name ?? null,
      displayUrl: formatMarketQrDisplayUrl(sheetMasterQrUrl),
      masterQrSvg: sheetConfig.showQr ? sheetMasterQrSvg : null,
      items: printableItems,
      hideToolbar: true,
    });
  }, [subView, sheetConfig, resolvedSiteName, activeEvent?.name, sheetMasterQrUrl, sheetMasterQrSvg, printableItems]);

  const printableHtml = useMemo(() => {
    if (subView !== 'print') return '';
    return buildPrintablePriceSheetHtml({
      config: sheetConfig,
      siteName: resolvedSiteName,
      eventName: activeEvent?.name ?? null,
      displayUrl: formatMarketQrDisplayUrl(sheetMasterQrUrl),
      masterQrSvg: sheetConfig.showQr ? sheetMasterQrSvg : null,
      items: printableItems,
    });
  }, [subView, sheetConfig, resolvedSiteName, activeEvent?.name, sheetMasterQrUrl, sheetMasterQrSvg, printableItems]);

  const handlePrintSheet = () => {
    if (!printableHtml) return;
    const win = window.open('', '_blank', 'width=960,height=1050');
    if (!win) {
      setNotice({ kind: 'error', text: 'Pop-up was blocked. Allow pop-ups for this site to print or save PDF.' });
      return;
    }
    win.document.open();
    win.document.write(printableHtml);
    win.document.close();
  };

  const handleSaveSheetToEvent = async () => {
    if (!activeEvent) {
      setNotice({ kind: 'error', text: 'Create or select an event first to save your layout.' });
      return;
    }
    setSavingSheet(true);
    try {
      const res = await fetch('/api/admin/markets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeEvent.id, priceSheetConfig: sheetConfig }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not save print layout');
      setNotice({ kind: 'success', text: `Print layout saved to ${activeEvent.name}.` });
      await mutate();
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to save print layout' });
    } finally {
      setSavingSheet(false);
    }
  };

  const toggleProductInSheet = (productId: string) => {
    setSheetConfig((prev) => {
      const current = prev.productIds.length > 0
        ? prev.productIds
        : products.filter((p) => p.availability !== 'sold').slice(0, 12).map((p) => p.id);
      const exists = current.includes(productId);
      const nextIds = exists ? current.filter((id) => id !== productId) : [...current, productId];
      return { ...prev, productIds: nextIds };
    });
  };

  const addSheetCustomLine = () => {
    if (!newCustomLine.title.trim()) return;
    const entry: PriceSheetCustomLine = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newCustomLine.title.trim(),
      details: newCustomLine.details.trim(),
      priceLabel: newCustomLine.priceLabel.trim(),
    };
    setSheetConfig((prev) => ({
      ...prev,
      customLines: [...prev.customLines, entry],
    }));
    setNewCustomLine({ title: '', details: '', priceLabel: '' });
  };

  const kioskUrl = useMemo(() => {
    try {
      return buildMarketKioskUrl(effectiveOrigin, activeEvent?.slug);
    } catch {
      return '/subscribe?kiosk=1';
    }
  }, [effectiveOrigin, activeEvent?.slug]);

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-gray-200" />
          <div className="h-64 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Workspace Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-gray-700" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-gray-900">Markets &amp; Pop-Ups</h2>
          </div>
          <p className="mt-0.5 text-sm text-gray-600">
            Ring up booth sales and print price sheets, wall labels, and QR signs. Post-show emails live on each event.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select market event"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="min-w-[210px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-gray-900 focus:outline-none"
          >
            <option value="">All events / Walk-in</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({new Date(ev.startDate).toLocaleDateString()})
              </option>
            ))}
          </select>

          {activeEvent && (
            <button
              type="button"
              onClick={openEditEventModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit event
              {activeEvent.contactCount > 0 && (
                <span className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700">
                  <Mail className="h-3 w-3" aria-hidden="true" />
                  {activeEvent.contactCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={openCreateEventModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Event
          </button>
        </div>
      </div>

      {/* Global Alerts / Notices / Offline Banner */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Failed to load Markets workspace.'}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className={`mt-4 flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
            notice.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {offlineQueue.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {offlineQueue.length} offline sale{offlineQueue.length === 1 ? '' : 's'} waiting to sync.
            </span>
          </div>
          <button
            type="button"
            disabled={syncingOffline}
            onClick={() => void flushOfflineSales()}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingOffline ? 'animate-spin' : ''}`} />
            {syncingOffline ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
      )}

      {undoBanner && (
        <div
          data-testid="market-undo-banner"
          className="fixed bottom-20 md:bottom-6 inset-x-4 z-40 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm text-white shadow-xl"
        >
          <div className="flex items-center gap-2.5">
            <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>
              Recorded {formatMoney(undoBanner.total)} ({undoBanner.paymentMethod}) · Order {undoBanner.orderNumber} · Stock updated
            </span>
          </div>
          <button
            type="button"
            disabled={undoingSale}
            onClick={() => void handleVoidSale(undoBanner.orderId)}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 disabled:opacity-50"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            {undoingSale ? 'Undoing...' : 'Undo sale'}
          </button>
        </div>
      )}

      {subView === 'pos' && posBag.length > 0 && !undoBanner && (
        <div className="fixed bottom-16 inset-x-4 z-30 lg:hidden">
          <button
            type="button"
            onClick={() => {
              document.getElementById('market-sale-drawer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex w-full items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-lg"
          >
            <span>
              {posBag.reduce((sum, item) => sum + item.quantity, 0)} item{posBag.reduce((sum, item) => sum + item.quantity, 0) === 1 ? '' : 's'} in sale
            </span>
            <span>{formatMoney(posTotal)} · Review &amp; Pay ↓</span>
          </button>
        </div>
      )}

      {/* Sub-Navigation Pills */}
      <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Market tools">
        {(
          [
            { id: 'pos', label: 'Quick Sale', icon: ShoppingBag },
            { id: 'print', label: 'Print & QR', icon: Printer },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = subView === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubView(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ==================== 1. QUICK SALE (POS) ==================== */}
      {subView === 'pos' && (
        <div className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left: Product Grid */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  placeholder="Search works, prints, or mediums..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-gray-900 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCustomAdder((v) => !v)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Custom item
              </button>
            </div>

            {showCustomAdder && (
              <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={customItemTitle}
                  onChange={(e) => setCustomItemTitle(e.target.value)}
                  placeholder="Item title (e.g. Booth Postcard Set)"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                  placeholder="Price ($)"
                  className="w-full sm:w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addCustomLineToBag}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Add
                </button>
              </div>
            )}

            {/* Category filter pills */}
            {categories.length > 2 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPosCategory(cat)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      posCategory === cat
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
                No catalog pieces match your search. Tap &ldquo;Custom item&rdquo; above to ring up anything at your booth.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredProducts.map((product) => {
                  const inBag = bagQuantityByProductId.get(product.id) ?? 0;
                  const isSoldOut =
                    product.availability === 'sold' ||
                    (product.availableStock !== null && product.availableStock <= 0);
                  const atMax =
                    product.availableStock !== null && inBag >= product.availableStock;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={isSoldOut || atMax}
                      onClick={() => addProductToBag(product)}
                      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
                        isSoldOut
                          ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-55'
                          : inBag > 0
                            ? 'border-gray-900 bg-white ring-1 ring-gray-900'
                            : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'
                      }`}
                    >
                      <div className="relative aspect-square w-full bg-gray-100 overflow-hidden">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                            No photo
                          </div>
                        )}
                        {inBag > 0 && (
                          <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-900 px-2 text-xs font-bold text-white shadow">
                            {inBag}
                          </span>
                        )}
                        <span
                          className={`absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isSoldOut
                              ? 'bg-gray-900/80 text-white'
                              : product.availableStock !== null
                                ? 'bg-white/95 text-gray-800 shadow-sm'
                                : 'bg-white/95 text-emerald-800 shadow-sm'
                          }`}
                        >
                          {isSoldOut
                            ? 'Sold'
                            : product.availableStock !== null
                              ? `${product.availableStock} left`
                              : 'Available'}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-3">
                        <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                          {product.title}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-bold text-gray-900">
                            {formatMoney(product.price)}
                          </span>
                          {!isSoldOut && (
                            <span className="text-xs font-medium text-gray-500">
                              {atMax ? 'Max in bag' : '+ Tap'}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Sticky Sale Drawer */}
          <div id="market-sale-drawer" className="scroll-mt-20 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Current Sale</h2>
                {posBag.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPosBag([])}
                    className="text-xs font-medium text-gray-500 hover:text-gray-900"
                  >
                    Clear
                  </button>
                )}
              </div>

              {posBag.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  Tap artwork tiles on the left to ring up a sale.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto pr-1">
                  {posBag.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-500">{formatMoney(item.unitPrice)} each</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateBagQuantity(item.key, -1)}
                          aria-label={`Remove one ${item.title}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateBagQuantity(item.key, 1)}
                          disabled={item.maxStock !== null && item.quantity >= item.maxStock}
                          aria-label={`Add one ${item.title}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="w-16 text-right text-sm font-semibold text-gray-900">
                        {formatMoney(item.unitPrice * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              <div className="space-y-1.5 border-t border-gray-200 pt-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatMoney(posSubtotal)}</span>
                </div>
                {activeTaxRate > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Sales tax ({activeTaxRate}%)</span>
                    <span>{formatMoney(posTax)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatMoney(posTotal)}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Payment Method
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MARKET_PAYMENT_METHODS.map((method) => {
                    const active = paymentMethod === method.key;
                    const isPayQr = method.key === 'stripe_market';
                    return (
                      <button
                        key={method.key}
                        type="button"
                        onClick={() => setPaymentMethod(method.key)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                          isPayQr ? 'col-span-2' : ''
                        } ${
                          active
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        {isPayQr ? (
                          <QrCode className="h-4 w-4" aria-hidden="true" />
                        ) : method.key === 'card_external' ? (
                          <CreditCard className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cash Change Calculator */}
              {paymentMethod === 'cash' && posTotal > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="cash-tendered" className="text-xs font-medium text-gray-700">
                      Cash received
                    </label>
                    <div className="flex gap-1">
                      {[posTotal, 20, 50, 100].map((amt, idx) => (
                        <button
                          key={`${amt}-${idx}`}
                          type="button"
                          onClick={() => setCashTendered(amt.toFixed(2))}
                          className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          {idx === 0 ? 'Exact' : `$${amt}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="cash-tendered"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={posTotal.toFixed(2)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                  />
                  {cashChangeDue !== null && (
                    <div className="flex items-center justify-between text-sm font-semibold text-emerald-800">
                      <span>Change due</span>
                      <span>{formatMoney(cashChangeDue)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Optional buyer email / receipt */}
              {paymentMethod !== 'stripe_market' && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="Buyer email (optional, for receipt & follow-up)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  {buyerEmail.trim() && (
                    <>
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Buyer name (optional)"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendReceipt}
                          onChange={(e) => setSendReceipt(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Email receipt &amp; tag for event follow-up
                      </label>
                    </>
                  )}
                </div>
              )}

              {/* Primary CTA */}
              <button
                type="button"
                data-testid="market-record-sale-btn"
                disabled={posBag.length === 0 || recordingSale}
                onClick={() => void handleRecordSale()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {paymentMethod === 'stripe_market' ? (
                  <>
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                    Show Buyer Pay QR ({formatMoney(posTotal)})
                  </>
                ) : recordingSale ? (
                  'Recording sale...'
                ) : (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Record {marketPaymentMethodLabel(paymentMethod)} Sale ({formatMoney(posTotal)})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

          {/* Recent booth sales (void + CSV without a separate Bookkeeping tab) */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setSalesOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50"
              aria-expanded={salesOpen}
            >
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Recent booth sales
                  {sales.length > 0 ? (
                    <span className="ml-2 text-sm font-medium text-gray-500">({sales.length})</span>
                  ) : null}
                </h3>
                <p className="text-xs text-gray-500">
                  Synced with Orders · void mistaken sales here to restore stock
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/api/admin/markets/sales?format=csv${activeEvent ? `&eventId=${encodeURIComponent(activeEvent.id)}` : ''}`}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  CSV
                </a>
                <span className="text-xs font-medium text-gray-500">{salesOpen ? 'Hide' : 'Show'}</span>
              </div>
            </button>

            {salesOpen && (
              sales.length === 0 ? (
                <div className="border-t border-gray-100 px-5 py-8 text-center text-sm text-gray-500">
                  No in-person sales recorded{activeEvent ? ` for ${activeEvent.name}` : ''} yet.
                </div>
              ) : (
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Items</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Buyer</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sales.map((sale) => {
                        const isVoided = sale.status === 'cancelled' || sale.status === 'refunded';
                        return (
                          <tr key={sale.id} className={isVoided ? 'bg-gray-50/80 text-gray-400' : ''}>
                            <td className="whitespace-nowrap px-4 py-3 text-xs">
                              {new Date(sale.createdAt).toLocaleString()}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                              {sale.orderNumber}
                            </td>
                            <td className="px-4 py-3 text-xs">{sale.itemsSummary}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                                {marketPaymentMethodLabel(sale.paymentMethod)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs">
                              {sale.buyerEmail || 'Walk-in'}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${isVoided ? 'line-through' : 'text-gray-900'}`}>
                              {formatMoney(sale.total)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              {isVoided ? (
                                <span className="text-xs font-medium text-gray-400">Voided</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={voidingOrderId === sale.id}
                                  onClick={() => {
                                    if (window.confirm(`Void sale ${sale.orderNumber} and restore stock?`)) {
                                      void handleVoidSale(sale.id);
                                    }
                                  }}
                                  className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                                >
                                  {voidingOrderId === sale.id ? 'Voiding...' : 'Void'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ==================== 2. PRINT & QR STUDIO ==================== */}
      {subView === 'print' && (
        <div className="mt-6 space-y-8">
          {/* Booth Kiosk Quick Card */}
          <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gray-900" aria-hidden="true" />
                <h2 className="text-base font-semibold text-gray-900">Booth Email Guestbook (Kiosk Mode)</h2>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Leave this open on an iPad or phone at your table. Auto-resets after every guest, queues signups offline, and tags contacts to{' '}
                <span className="font-medium text-gray-900">{activeEvent ? activeEvent.name : 'your studio list'}</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(kioskUrl);
                  setCopiedKioskUrl(true);
                  window.setTimeout(() => setCopiedKioskUrl(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {copiedKioskUrl ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copiedKioskUrl ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={kioskUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open Kiosk
              </a>
            </div>
          </div>

          {/* Customizable Price Sheet / Wall Labels / Booth Sign Builder */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Price Sheet, Wall Labels &amp; Booth Card Designer
                </h2>
                <p className="text-sm text-gray-600">
                  Customize typography, paper size, ink mode, included works, and per-piece scan-to-pay QR codes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeEvent && (
                  <button
                    type="button"
                    disabled={savingSheet}
                    onClick={() => void handleSaveSheetToEvent()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {savingSheet ? 'Saving...' : 'Save to event'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrintSheet}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Print / Save PDF
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[400px_1fr]">
              {/* Controls column */}
              <div className="space-y-5">
                {/* Template picker */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Template
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'price_sheet', label: 'Price Sheet' },
                        { id: 'wall_labels', label: 'Wall Labels' },
                        { id: 'booth_sign', label: 'Booth Sign' },
                      ] as const
                    ).map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSheetConfig((prev) => ({ ...prev, template: tpl.id }))}
                        className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${
                          sheetConfig.template === tpl.id
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style & Paper grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Paper size</label>
                    <select
                      value={sheetConfig.paperSize}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          paperSize: e.target.value as PriceSheetConfig['paperSize'],
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                    >
                      <option value="letter">US Letter (8.5 × 11&quot;)</option>
                      <option value="5x7">5 × 7&quot; Tabletop</option>
                      <option value="4x6">4 × 6&quot; Postcard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Typography</label>
                    <select
                      value={sheetConfig.fontStyle}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          fontStyle: e.target.value as PriceSheetConfig['fontStyle'],
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                    >
                      <option value="editorial">Editorial Serif</option>
                      <option value="modern">Modern Sans</option>
                      <option value="classic">Classic Gallery</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Color palette</label>
                    <select
                      value={sheetConfig.colorMode}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          colorMode: e.target.value as PriceSheetConfig['colorMode'],
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                    >
                      <option value="brand">Studio Brand</option>
                      <option value="ink_saver">Ink-Saver B&amp;W</option>
                      <option value="warm">Warm Paper</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Spacing</label>
                    <select
                      value={sheetConfig.density}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          density: e.target.value as PriceSheetConfig['density'],
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </div>
                </div>

                {/* Copy customization */}
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Headline</label>
                    <input
                      type="text"
                      value={sheetConfig.title}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder={DEFAULT_PRICE_SHEET_CONFIG.title}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={sheetConfig.subtitle}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
                      placeholder="Original works, archival prints & studio editions"
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Accepted payments line</label>
                    <input
                      type="text"
                      value={sheetConfig.paymentNote}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, paymentNote: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Footer note</label>
                    <input
                      type="text"
                      value={sheetConfig.footerNote}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, footerNote: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2 border-t border-gray-100 pt-4 text-sm text-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sheetConfig.showPrices}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, showPrices: e.target.checked }))}
                    />
                    Show prices
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sheetConfig.showDetails}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, showDetails: e.target.checked }))}
                    />
                    Show medium &amp; dimensions
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sheetConfig.showThumbnails}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, showThumbnails: e.target.checked }))}
                    />
                    Show artwork thumbnails
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sheetConfig.showQr}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, showQr: e.target.checked }))}
                    />
                    Include main booth QR code
                  </label>
                  {sheetConfig.template !== 'booth_sign' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePerPieceQr}
                        onChange={(e) => setIncludePerPieceQr(e.target.checked)}
                      />
                      Include scan-to-pay QR on each piece
                    </label>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sheetConfig.showPromoCallout}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, showPromoCallout: e.target.checked }))}
                    />
                    Highlight fair promo callout
                  </label>
                  {sheetConfig.showPromoCallout && (
                    <input
                      type="text"
                      value={sheetConfig.promoCalloutText}
                      onChange={(e) => setSheetConfig((prev) => ({ ...prev, promoCalloutText: e.target.value }))}
                      placeholder={activeEvent?.promoCode ? `Use code ${activeEvent.promoCode} for 15% off online` : 'Use code FAIR15 for 15% off online'}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
                    />
                  )}
                </div>

                {/* Main QR Destination */}
                {sheetConfig.showQr && (
                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    <label className="block text-xs font-medium text-gray-700">Main QR destination</label>
                    <select
                      value={sheetConfig.qrDestination}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          qrDestination: e.target.value as MarketQrDestination,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                    >
                      {MARKET_QR_DESTINATIONS.filter((d) => d.key !== 'custom').map((d) => (
                        <option key={d.key} value={d.key}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Works picker & custom lines (for Price Sheet and Wall Labels) */}
                {sheetConfig.template !== 'booth_sign' && (
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Included Works ({selectedSheetProducts.length})
                      </span>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setSheetConfig((prev) => ({
                              ...prev,
                              productIds: products.filter((p) => p.availability !== 'sold').map((p) => p.id),
                            }))
                          }
                          className="font-medium text-gray-700 underline"
                        >
                          All available
                        </button>
                        <button
                          type="button"
                          onClick={() => setSheetConfig((prev) => ({ ...prev, productIds: [] }))}
                          className="text-gray-500 underline"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 p-2.5">
                      {products.map((prod) => {
                        const checked = selectedSheetProducts.some((p) => p.id === prod.id);
                        return (
                          <label
                            key={prod.id}
                            className="flex items-center justify-between gap-2 text-xs text-gray-700 cursor-pointer"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProductInSheet(prod.id)}
                              />
                              <span className="truncate">{prod.title}</span>
                            </span>
                            <span className="shrink-0 font-medium text-gray-900">
                              {formatMoney(prod.price)}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Custom booth lines */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">
                        Extra booth-only lines (stickers, postcards, bundles)
                      </p>
                      {sheetConfig.customLines.map((line, index) => (
                        <div
                          key={`${line.title}-${index}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{line.title}</p>
                            {line.details && <p className="text-gray-500 truncate">{line.details}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-semibold text-gray-900">{line.priceLabel}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${line.title}`}
                              onClick={() =>
                                setSheetConfig((prev) => ({
                                  ...prev,
                                  customLines: prev.customLines.filter((_, idx) => idx !== index),
                                }))
                              }
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="grid grid-cols-[1fr_90px] gap-1.5">
                        <input
                          type="text"
                          value={newCustomLine.title}
                          onChange={(e) => setNewCustomLine((p) => ({ ...p, title: e.target.value }))}
                          placeholder="Title (e.g. Postcard 3-Pack)"
                          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={newCustomLine.priceLabel}
                          onChange={(e) => setNewCustomLine((p) => ({ ...p, priceLabel: e.target.value }))}
                          placeholder="$12"
                          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={newCustomLine.details}
                          onChange={(e) => setNewCustomLine((p) => ({ ...p, details: e.target.value }))}
                          placeholder="Details (optional, e.g. 4x6 archival matte)"
                          className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={addSheetCustomLine}
                          className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Print Preview */}
              <div className="rounded-xl border border-gray-200 bg-neutral-100 p-4 flex flex-col">
                <div className="mb-2.5 flex items-center justify-between text-xs text-gray-600">
                  <span className="font-medium">Live Print Preview</span>
                  <span>{printableItems.length} item{printableItems.length === 1 ? '' : 's'}</span>
                </div>
                <div className="flex-1 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm min-h-[560px]">
                  <iframe
                    title="Printable price sheet preview"
                    srcDoc={previewHtml}
                    sandbox="allow-same-origin"
                    className="h-[680px] w-full border-0 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Standalone Quick QR Sign Generator (reused hardened component) */}
          <MarketQrCard onSelectTab={onSelectTab} />
        </div>
      )}


      {/* ==================== BUYER PAY QR MODAL ==================== */}
      {buyerQrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Buyer Pay QR Code"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Buyer Scan to Pay</h3>
              <button
                type="button"
                onClick={() => setBuyerQrOpen(false)}
                aria-label="Close Buyer Pay QR"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Have the buyer scan this code to pay <strong>{formatMoney(posTotal)}</strong> with Apple Pay, Google Pay, or card (no shipping address required).
            </p>
            {buyerQrDataUrl && (
              <div className="my-5 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={buyerQrDataUrl}
                  alt="Buyer express checkout QR code"
                  className="h-64 w-64 rounded-xl border border-gray-200 p-2 bg-white"
                />
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(buyerQrUrl);
                  setCopiedBuyerLink(true);
                  window.setTimeout(() => setCopiedBuyerLink(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                {copiedBuyerLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedBuyerLink ? 'Copied link' : 'Copy link'}
              </button>
              <a
                href={buyerQrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open checkout
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE / EDIT EVENT MODAL ==================== */}
      {eventModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={eventForm.id ? 'Edit Market Event' : 'New Market Event'}
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {eventForm.id ? 'Edit Market Event' : 'New Market Event'}
              </h3>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                aria-label="Close event dialog"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEventModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Event Name *</label>
                <input
                  type="text"
                  required
                  value={eventForm.name}
                  onChange={(e) => setEventForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Spring Craft Fair"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Downtown Pavilion, Booth #14"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Booth Fee ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={eventForm.boothFee}
                    onChange={(e) => setEventForm((p) => ({ ...p, boothFee: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sales Tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    step="0.01"
                    value={eventForm.salesTaxRate}
                    onChange={(e) => setEventForm((p) => ({ ...p, salesTaxRate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={eventForm.notes}
                  onChange={(e) => setEventForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Load-in time, parking info, booth dimensions..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Post-show follow-up email</p>
                    <p className="mt-0.5 text-xs text-gray-600">
                      Sent to booth buyers and guestbook signups tagged to this event.
                      {activeEvent && eventForm.id === activeEvent.id
                        ? ` ${activeEvent.contactCount} tagged so far.`
                        : ''}
                    </p>
                  </div>
                  {activeEvent?.followUpSentAt && eventForm.id === activeEvent.id && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                      Last sent {new Date(activeEvent.followUpSentAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventForm.followUpEnabled}
                    onChange={(e) => setEventForm((p) => ({ ...p, followUpEnabled: e.target.checked }))}
                  />
                  Auto-send after the event ends
                </label>

                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                  <span>Delay</span>
                  <input
                    type="number"
                    min="0"
                    max="14"
                    value={eventForm.followUpDelayDays}
                    onChange={(e) => setEventForm((p) => ({ ...p, followUpDelayDays: e.target.value }))}
                    className="w-16 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-sm"
                  />
                  <span>day(s) after end date</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Thank-you promo code (optional)
                  </label>
                  <input
                    type="text"
                    value={eventForm.promoCode}
                    onChange={(e) => setEventForm((p) => ({ ...p, promoCode: e.target.value.toUpperCase() }))}
                    placeholder="e.g. SPRING15"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email subject</label>
                  <input
                    type="text"
                    value={eventForm.followUpSubject}
                    onChange={(e) => setEventForm((p) => ({ ...p, followUpSubject: e.target.value }))}
                    placeholder="Thanks for stopping by"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Personal note</label>
                  <textarea
                    rows={3}
                    value={eventForm.followUpBody}
                    onChange={(e) => setEventForm((p) => ({ ...p, followUpBody: e.target.value }))}
                    placeholder="A short thank-you note. Available shop works are added automatically."
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                </div>

                {eventForm.id && activeEvent && eventForm.id === activeEvent.id && (
                  <button
                    type="button"
                    disabled={sendingFollowUp || activeEvent.contactCount === 0}
                    onClick={() => void handleSendFollowUpNow()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    {sendingFollowUp
                      ? 'Sending...'
                      : `Send now (${activeEvent.contactCount})`}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                {eventForm.id ? (
                  <button
                    type="button"
                    onClick={() => void handleDeleteActiveEvent()}
                    className="text-xs font-semibold text-red-600 hover:text-red-800"
                  >
                    Delete event
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEventModalOpen(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEvent}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {savingEvent ? 'Saving...' : eventForm.id ? 'Save changes' : 'Create event'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
