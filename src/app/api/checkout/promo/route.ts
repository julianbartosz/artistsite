import { NextRequest, NextResponse } from 'next/server';
import { resolvePromoDiscount } from '@/lib/promo-codes';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const subtotal = Number(body?.subtotal);
    const result = await resolvePromoDiscount(
      body?.promoCode,
      Number.isFinite(subtotal) ? subtotal : 0,
    );

    if (result.error || result.amount <= 0) {
      return NextResponse.json(
        { valid: false, amount: 0, error: result.error || 'Invalid promo code' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      valid: true,
      code: result.code,
      amount: result.amount,
    });
  } catch (error) {
    console.error('Promo validation error:', error);
    return NextResponse.json({ error: 'Failed to validate promo code' }, { status: 500 });
  }
}
