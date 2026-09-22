'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { readGuestWishlist, toggleGuestWishlist, writeGuestWishlist } from '@/lib/wishlist-storage';

type WishlistButtonProps = {
  productId: string;
  className?: string;
  size?: 'sm' | 'md';
  /** When nested inside a link/card, prevent navigation on toggle. */
  stopNavigation?: boolean;
};

export function WishlistButton({ productId, className = '', size = 'md', stopNavigation = false }: WishlistButtonProps) {
  const { data: session, status } = useSession();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshSavedState = useCallback(async () => {
    if (session?.user?.id) {
      try {
        const response = await fetch('/api/wishlist', { cache: 'no-store' });
        const data = await response.json();
        if (data.success) {
          setSaved((data.items || []).some((item: { productId: string }) => item.productId === productId));
        }
      } catch {
        setSaved(false);
      }
      return;
    }

    setSaved(readGuestWishlist().includes(productId));
  }, [productId, session?.user?.id]);

  useEffect(() => {
    if (status === 'loading') return;
    void refreshSavedState();
  }, [status, refreshSavedState]);

  async function handleToggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (stopNavigation) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (busy) return;
    setBusy(true);

    try {
      if (session?.user?.id) {
        if (saved) {
          const response = await fetch(`/api/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' });
          if (response.ok) {
            setSaved(false);
          }
        } else {
          const response = await fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
          });
          if (response.ok) {
            setSaved(true);
          }
        }
        return;
      }

      const nextSaved = toggleGuestWishlist(productId);
      setSaved(nextSaved);
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
      disabled={busy || status === 'loading'}
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
  }
}
