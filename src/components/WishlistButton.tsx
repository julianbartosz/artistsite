'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { readGuestWishlist, writeGuestWishlist } from '@/lib/wishlist-storage';

type WishlistButtonProps = {
  productId: string;
  className?: string;
  size?: 'sm' | 'md';
  /** When nested inside a link/card, prevent navigation on toggle. */
  stopNavigation?: boolean;
};

type WishlistCacheState = {
  userId: string | null;
  items: Set<string>;
  loadedAt: number;
  inFlight: Promise<Set<string>> | null;
};

const WISHLIST_CACHE_TTL_MS = 15_000;
const wishlistState: WishlistCacheState = {
  userId: null,
  items: new Set(),
  loadedAt: 0,
  inFlight: null,
};
const wishlistListeners = new Set<() => void>();

function notifyWishlistListeners() {
  wishlistListeners.forEach((listener) => listener());
}

function resetWishlistCache(nextUserId: string | null) {
  wishlistState.userId = nextUserId;
  wishlistState.items = new Set();
  wishlistState.loadedAt = 0;
  wishlistState.inFlight = null;
}

export function evictWishlistCacheItem(productId: string): void {
  if (!wishlistState.items.has(productId)) return;
  wishlistState.items.delete(productId);
  wishlistState.loadedAt = Date.now();
  notifyWishlistListeners();
}

/** Deduplicate GET /api/wishlist across all mounted cards, quick-looks, and recommendations. */
function loadAccountWishlist(userId: string): Promise<Set<string>> {
  if (wishlistState.userId !== userId) {
    resetWishlistCache(userId);
  }

  const fresh =
    wishlistState.loadedAt > 0 && Date.now() - wishlistState.loadedAt < WISHLIST_CACHE_TTL_MS;
  if (fresh) {
    return Promise.resolve(wishlistState.items);
  }
  if (wishlistState.inFlight) {
    return wishlistState.inFlight;
  }

  const request = fetch('/api/wishlist', { cache: 'no-store' })
    .then((response) => response.json())
    .then((data) => {
      if (wishlistState.userId !== userId) return wishlistState.items;
      const next = new Set<string>();
      if (data.success && Array.isArray(data.items)) {
        for (const item of data.items as Array<{ productId?: string }>) {
          if (item.productId) next.add(item.productId);
        }
      }
      wishlistState.items = next;
      wishlistState.loadedAt = Date.now();
      notifyWishlistListeners();
      return next;
    })
    .catch(() => wishlistState.items)
    .finally(() => {
      if (wishlistState.inFlight === request) {
        wishlistState.inFlight = null;
      }
    });

  wishlistState.inFlight = request;
  return request;
}

export function WishlistButton({ productId, className = '', size = 'md', stopNavigation = false }: WishlistButtonProps) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const isCollector = status === 'authenticated' && Boolean(userId) && !session?.user?.isAdmin;
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isCollector || !userId) {
      setSaved(false);
      return undefined;
    }

    const sync = () => {
      setSaved(wishlistState.userId === userId && wishlistState.items.has(productId));
    };

    wishlistListeners.add(sync);
    sync();
    void loadAccountWishlist(userId).then(sync);

    return () => {
      wishlistListeners.delete(sync);
    };
  }, [isCollector, productId, userId]);

  if (!isCollector || !userId) {
    return null;
  }

  async function handleToggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (stopNavigation) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (busy || !userId) return;
    setBusy(true);

    try {
      if (saved) {
        const response = await fetch(`/api/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' });
        if (response.ok) {
          if (wishlistState.userId !== userId) resetWishlistCache(userId);
          wishlistState.items.delete(productId);
          wishlistState.loadedAt = Date.now();
          notifyWishlistListeners();
        }
      } else {
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });
        if (response.ok) {
          if (wishlistState.userId !== userId) resetWishlistCache(userId);
          wishlistState.items.add(productId);
          wishlistState.loadedAt = Date.now();
          notifyWishlistListeners();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const iconSize = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';

  function stopCardNavigation(event: React.SyntheticEvent) {
    if (!stopNavigation) return;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <button
      type="button"
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-pressed={saved}
      data-testid={`wishlist-${productId}`}
      disabled={busy}
      onPointerDown={stopCardNavigation}
      onClick={(event) => void handleToggle(event)}
      className={`inline-flex items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
        saved
          ? 'border-primary bg-primary text-white hover:bg-primary-hover'
          : 'border-gray-300 bg-white text-gray-600 hover:border-primary hover:text-primary'
      } ${size === 'sm' ? 'p-1.5' : 'p-2'} ${className}`}
    >
      <svg className={iconSize} viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </button>
  );
}

export async function mergeGuestWishlistIntoAccount(): Promise<void> {
  const productIds = readGuestWishlist();
  if (productIds.length === 0) return;

  const response = await fetch('/api/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productIds }),
  });

  if (response.ok) {
    writeGuestWishlist([]);
    wishlistState.loadedAt = 0;
    notifyWishlistListeners();
  }
}
