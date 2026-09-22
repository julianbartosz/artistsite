import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

const updateSchema = z.object({
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const payload = updateSchema.parse(await request.json());

    const promoCode = await db.promoCode.update({
      where: { id },
      data: {
        ...(payload.usageLimit !== undefined ? { usageLimit: payload.usageLimit } : {}),
        ...(payload.expiresAt !== undefined ? { expiresAt: payload.expiresAt } : {}),
      },
    });

    return NextResponse.json({ promoCode });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid promo code update', details: error.issues }, { status: 400 });
    }
    console.error('Admin promo code update error:', error);
    return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const existing = await db.promoCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
    }
    if (existing.usageCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a promo code that has already been used. Set an expiry date instead.' },
        { status: 409 }
      );
    }

    await db.promoCode.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Admin promo code delete error:', error);
    return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 });
  }
}
