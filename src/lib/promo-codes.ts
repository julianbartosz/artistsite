import 'server-only';
import { db } from '@/lib/db';

export function roundPromoMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function resolvePromoDiscount(
  rawCode: unknown,
  subtotal: number,
): Promise<{ code?: string; amount: number }> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!code || subtotal <= 0) return { amount: 0 };

  const promo = await db.promoCode.findUnique({ where: { code } }).catch(() => null);
  if (!promo) return { amount: 0 };
  if (promo.expiresAt && promo.expiresAt < new Date()) return { amount: 0 };
  if (promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usageCount >= promo.usageLimit) {
    return { amount: 0 };
  }

  const rawAmount = promo.discountType === 'percentage'
    ? subtotal * (promo.discountValue / 100)
    : promo.discountValue;

  return {
    code,
    amount: roundPromoMoney(Math.min(subtotal, Math.max(0, rawAmount))),
  };
}

export async function incrementPromoUsage(code: string): Promise<void> {
  await db.promoCode.update({
    where: { code },
    data: { usageCount: { increment: 1 } },
  }).catch((error) => {
    console.error('Failed to increment promo code usage:', error);
  });
}
