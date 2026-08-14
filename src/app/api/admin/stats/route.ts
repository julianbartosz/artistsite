import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { getAllPosts } from '@/lib/markdown';
import { getAllProducts } from '@/lib/commerce-server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [posts, products, totalArtworks, productViews, monthlyProductViews] = await Promise.all([
      getAllPosts(true),
      getAllProducts(),
      db.artwork.count(),
      db.productView.count(),
      db.productView.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    const stats = {
      totalPosts: posts.length,
      publishedPosts: posts.filter((post) => !post.isDraft).length,
      draftPosts: posts.filter((post) => post.isDraft).length,
      totalProducts: products.length,
      totalArtworks,
      totalViews: productViews,
      monthlyViews: monthlyProductViews,
    };

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'private, max-age=300', // 5 minutes cache
      },
    });
    
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}