const GUEST_WISHLIST_KEY = 'guest_wishlist';

export function readGuestWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function writeGuestWishlist(productIds: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify([...new Set(productIds)]));
}

export function toggleGuestWishlist(productId: string): boolean {
  const current = readGuestWishlist();
  const exists = current.includes(productId);
  const next = exists ? current.filter((id) => id !== productId) : [...current, productId];
  writeGuestWishlist(next);
  return !exists;
}

export function clearGuestWishlist(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GUEST_WISHLIST_KEY);
}
