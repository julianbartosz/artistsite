import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import { addWishlistItem, listWishlistItems, mergeWishlistProductIds } from '@/lib/wishlist';

const AddSchema = z.object({
  productId: z.string().min(1),
});

const MergeSchema = z.object({
  productIds: z.array(z.string().min(1)).max(100),
});

export async function GET() {
  try {
    const session = await requireUser();
    const items = await listWishlistItems(session.user.id);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to load wishlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    const body = await request.json();

    const mergeParsed = MergeSchema.safeParse(body);
    if (mergeParsed.success) {
      const merged = await mergeWishlistProductIds(session.user.id, mergeParsed.data.productIds);
      const items = await listWishlistItems(session.user.id);
      return NextResponse.json({ success: true, merged, items });
    }

    const parsed = AddSchema.parse(body);
    const item = await addWishlistItem(session.user.id, parsed.productId);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid wishlist payload', details: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Product not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update wishlist' }, { status: 500 });
  }
}
