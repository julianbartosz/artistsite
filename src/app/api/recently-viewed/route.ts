import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { ApiError } from '@/lib/api-error-handler';
import { db } from '@/lib/db';
import { getAllProducts } from '@/lib/commerce-server';

export async function GET(request: NextRequest) {
  try {
    const session = await requireUser();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '8', 10), 24);

    const recentViews = await db.productView.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit * 2,
      select: {
        productId: true,
      },
    });

    const uniqueProductIds = [...new Set(recentViews.map((view) => view.productId))].slice(0, limit);
    const allProducts = await getAllProducts();
    const products = uniqueProductIds
      .map((id) => allProducts.find((product) => product.id === id))
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, products: [] }, { status: error.status });
    }

    console.error('Recently viewed API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get recently viewed products',
        products: [],
      },
      { status: 500 },
    );
  }
}
