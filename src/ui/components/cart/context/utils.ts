// filepath: src/ui/components/cart/context/utils.ts
'use client';
import type { CartItem } from './types';
import type { CartItemVariant } from '@domain/shop';

export function generateVariantKey(productId: string, variant?: CartItemVariant): string {
  if (!variant) return productId;
  const parts = [productId];
  if (variant.size) parts.push(`size:${variant.size.id}`);
  if (variant.framing) parts.push(`frame:${variant.framing.id}`);
  if (variant.material) parts.push(`material:${variant.material.id}`);
  return parts.join('|');
}

export function calculateCartTotals(items: CartItem[]): { total: number; itemCount: number } {
  const total = items.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { total, itemCount };
}
