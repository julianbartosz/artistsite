import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import { removeWishlistItem } from '@/lib/wishlist';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const session = await requireUser();
    const { productId } = await params;
    const removed = await removeWishlistItem(session.user.id, productId);

    if (!removed) {
      return NextResponse.json({ error: 'Wishlist item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to remove wishlist item' }, { status: 500 });
  }
}
