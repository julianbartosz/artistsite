'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { OrderCelebration } from '@/lib/order-celebration-shared';
import { formatPrice } from '@/lib/commerce';

const DISMISS_STORAGE_KEY = 'artist-site-celebration-dismissed';

function readDismissedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeDismissedIds(ids: string[]) {
  window.localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(ids.slice(-50)));
}

type OrderCelebrationCardProps = {
  celebration: OrderCelebration;
  onDismiss: () => void;
};

export default function OrderCelebrationCard({ celebration, onDismiss }: OrderCelebrationCardProps) {
  const primaryItem = celebration.items[0];

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">New sale</p>
          <h2 className="mt-1 text-xl font-bold text-emerald-950">
            {celebration.items.length > 1
              ? `${celebration.items.length} works sold`
              : `"${primaryItem?.title || 'Artwork'}" sold`}
          </h2>
          <p className="mt-1 text-sm text-emerald-900">
            Order {celebration.orderNumber} · {formatPrice(celebration.total, celebration.currency)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
        >
          Dismiss
        </button>
      </div>

      {primaryItem && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-emerald-200 bg-white">
            <Image
              src={primaryItem.imageUrl}
              alt={primaryItem.title}
              fill
              className="object-cover"
              sizes="112px"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin?tab=orders"
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              View order
            </Link>
            <Link
              href="/admin?tab=marketing"
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
            >
              Open marketing
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function useOrderCelebration(): {
  celebration: OrderCelebration | null;
  dismissCelebration: () => void;
  loading: boolean;
} {
  const [celebration, setCelebration] = useState<OrderCelebration | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCelebration = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.latestCelebration) {
        setCelebration(null);
        return;
      }

      const payload = data.latestCelebration as OrderCelebration;
      const dismissed = readDismissedIds();
      if (dismissed.includes(payload.orderId)) {
        setCelebration(null);
        return;
      }

      setCelebration(payload);
    } catch {
      setCelebration(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCelebration();
    const interval = window.setInterval(() => void loadCelebration(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadCelebration]);

  const dismissCelebration = useCallback(() => {
    if (!celebration) return;
    const dismissed = readDismissedIds();
    if (!dismissed.includes(celebration.orderId)) {
      writeDismissedIds([...dismissed, celebration.orderId]);
    }
    setCelebration(null);
  }, [celebration]);

  return { celebration, dismissCelebration, loading };
}
