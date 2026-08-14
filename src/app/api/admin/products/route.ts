import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { normalizeProductPayload, productPayloadSchema } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: string }).code === 'P2002';
}

export async function GET() {
  try {
    await requireAdmin();
    const products = await db.product.findMany({ orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }] });
    return NextResponse.json({ products });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Admin products fetch error:', error);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = normalizeProductPayload(productPayloadSchema.parse(await request.json()));
    const existingProduct = await db.product.findFirst({
      where: {
        OR: [
          { id: payload.id },
          { slug: payload.slug },
        ],
      },
      select: { id: true, title: true },
    });

    if (existingProduct) {
      return NextResponse.json({ error: `Product already exists (${existingProduct.id}). Edit the existing item instead of creating a duplicate.` }, { status: 409 });
    }

    const product = await db.product.create({ data: payload as any });
    revalidateTag('products');
    revalidatePath('/shop');
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid product data', details: error.issues }, { status: 400 });
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Product already exists. Edit the existing item instead of creating a duplicate.' }, { status: 409 });
    }
    console.error('Admin product create error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}