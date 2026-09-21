import { NextRequest, NextResponse } from 'next/server';
import { verifyCartRecoveryToken, createCartRecoveryToken, buildCartRecoveryPath } from '@/lib/cart-recovery';
import type { CartItem } from '@/components/CartContext';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Recovery token is required' }, { status: 400 });
  }

  const payload = verifyCartRecoveryToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Recovery link expired or invalid' }, { status: 410 });
  }

  return NextResponse.json({
    success: true,
    items: payload.items,
    email: payload.email ?? '',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items as CartItem[] : [];
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const token = createCartRecoveryToken(items, email || undefined);
    const recoveryPath = buildCartRecoveryPath(token);

    return NextResponse.json({
      success: true,
      token,
      recoveryPath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create recovery link' },
      { status: 500 },
    );
  }
}
