import 'server-only';
import { db } from '@/lib/db';

export function roundPromoMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type PromoDiscountResult = {
  code?: string;
  amount: number;
  error?: string;
};

export async function resolvePromoDiscount(
  rawCode: unknown,
  subtotal: number,
): Promise<PromoDiscountResult> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!code) return { amount: 0 };
  if (subtotal <= 0) return { amount: 0, error: 'Promo codes require a purchase subtotal' };

  const promo = await db.promoCode.findUnique({ where: { code } }).catch(() => null);
  if (!promo) return { amount: 0, error: 'Promo code not found' };
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return { amount: 0, error: 'This promo code has expired' };
  }
  if (promo.usageLimit !== null && promo.usageLimit !== undefined && promo.usageCount >= promo.usageLimit) {
    return { amount: 0, error: 'This promo code has reached its usage limit' };
  }

  const rawAmount = promo.discountType === 'percentage'
    ? subtotal * (promo.discountValue / 100)
    : promo.discountValue;

  const amount = roundPromoMoney(Math.min(subtotal, Math.max(0, rawAmount)));
  if (amount <= 0) {
    return { amount: 0, error: 'This promo code does not apply to your order' };
  }

  return { code, amount };
}

export async function incrementPromoUsage(code: string): Promise<void> {
  await db.promoCode.update({
    where: { code },
    data: { usageCount: { increment: 1 } },
  }).catch((error) => {
    console.error('Failed to increment promo code usage:', error);
  });
}
