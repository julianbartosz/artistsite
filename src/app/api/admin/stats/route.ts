import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/lib/api-error-handler';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { getLatestCelebrationOrder } from '@/lib/order-celebration';
import { countUnreadThreadsForAdmin } from '@/lib/studio-inbox';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      totalPosts,
      publishedPosts,
      totalProducts,
      totalArtworks,
      totalViews,
      monthlyViews,
      totalOrders,
      unfulfilledOrdersCount,
      totalThreadsCount,
      unreadMessagesCount,
      lowStockCount,
      activeAlertsCount,
    ] = await Promise.all([
      db.blogPost.count(),
      db.blogPost.count({ where: { isDraft: false } }),
      db.product.count(),
      db.artwork.count(),
      db.analyticsEvent.count({ where: { eventName: 'page_view' } }),
      db.analyticsEvent.count({ where: { eventName: 'page_view', timestamp: { gte: monthStart } } }),
      db.order.count(),
      db.order.count({ where: { status: { notIn: ['shipped', 'delivered', 'cancelled', 'refunded'] } } }),
      db.studioMessageThread.count(),
      countUnreadThreadsForAdmin(),
      db.productInventory.count({ where: { stockStatus: { in: ['low_stock', 'out_of_stock'] } } }),
      db.stockAlert.count({ where: { isActive: true } }),
    ]);

    const latestCelebration = await getLatestCelebrationOrder();

    const stats = {
      totalPosts,
      publishedPosts,
      draftPosts: Math.max(0, totalPosts - publishedPosts),
      totalProducts,
      totalArtworks,
      totalViews,
      monthlyViews,
      totalOrders,
      unfulfilledOrdersCount,
      totalThreadsCount,
      unreadMessagesCount,
      lowStockCount,
      activeAlertsCount,
      latestCelebration,
    };

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store',
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