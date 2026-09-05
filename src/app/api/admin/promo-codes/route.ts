import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { promoCodePayloadSchema } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/auth';
import { PromoCodeManager } from '@/lib/marketing/promo-codes';

export async function GET() {
  try {
    await requireAdmin();
    const promoCodes = await PromoCodeManager.listAll();
    return NextResponse.json({ promoCodes });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Admin promo codes fetch error:', error);
    return NextResponse.json({ error: 'Failed to load promo codes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = promoCodePayloadSchema.parse(await request.json());
    const promoCode = await PromoCodeManager.createManual({
      code: payload.code,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      usageLimit: payload.usageLimit ?? null,
      expiresAt: payload.expiresAt ?? null,
    });
    return NextResponse.json({ promoCode }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid promo code data', details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to create promo code';
    const status = /already exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
