import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyCartRecoveryToken, createCartRecoveryToken, buildCartRecoveryPath } from '@/lib/cart-recovery';
import { calculateVariantPrice } from '@/lib/commerce';
import { getAllProducts } from '@/lib/commerce-server';
import type { CartItem } from '@/components/CartContext';

const RecoveryItemSchema = z.object({
  productId: z.string().min(1).max(120).optional(),
  product: z.object({ id: z.string().min(1).max(120) }).optional(),
  quantity: z.coerce.number().int().min(1).max(99),
  variant: z.unknown().optional(),
  customizations: z.record(z.string().max(120), z.string().max(500)).optional(),
});

const RecoveryRequestSchema = z.object({
  items: z.array(RecoveryItemSchema).min(1).max(50),
  email: z.string().max(254).optional(),
});

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
    const parsed = RecoveryRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Cart is empty or invalid' }, { status: 400 });
    }

    const catalog = await getAllProducts();
    const productMap = new Map(catalog.map((product) => [product.id, product]));
    const validatedItems: CartItem[] = [];

    for (const rawItem of parsed.data.items) {
      const productId = rawItem.product?.id || rawItem.productId;
      const catalogProduct = productId ? productMap.get(productId) : undefined;
      if (!catalogProduct) continue;

      const variant = rawItem.variant && typeof rawItem.variant === 'object'
        ? rawItem.variant as CartItem['variant']
        : undefined;
      const unitPrice = calculateVariantPrice(catalogProduct.price, variant);
      validatedItems.push({
        product: catalogProduct,
        quantity: rawItem.quantity,
        totalPrice: Math.round(unitPrice * rawItem.quantity * 100) / 100,
        addedAt: Date.now(),
        ...(variant ? { variant } : {}),
        ...(rawItem.customizations ? { customizations: rawItem.customizations } : {}),
      });
    }

    if (validatedItems.length === 0) {
      return NextResponse.json({ error: 'No valid products found in cart' }, { status: 400 });
    }

    const email = parsed.data.email?.trim() || undefined;
    const token = createCartRecoveryToken(validatedItems, email);
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
