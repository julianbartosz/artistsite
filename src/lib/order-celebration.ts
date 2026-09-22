import 'server-only';

import { productImageSrc } from '@/lib/commerce';
import { getProductById } from '@/lib/commerce-server';
import { db } from '@/lib/db';
import type { OrderCelebration, OrderCelebrationItem } from '@/lib/order-celebration-shared';

export type { OrderCelebration, OrderCelebrationItem } from '@/lib/order-celebration-shared';

export async function getLatestCelebrationOrder(): Promise<OrderCelebration | null> {
  const order = await db.order.findFirst({
    where: {
      paymentStatus: 'paid',
      NOT: {
        status: { in: ['cancelled', 'refunded'] },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
    },
  });

  if (!order) return null;

  const items: OrderCelebrationItem[] = [];
  for (const item of order.items) {
    const product = await getProductById(item.productId);
    items.push({
      title: product?.title || 'Artwork',
      imageUrl: product ? productImageSrc(product) : '/images/fallback-artwork.svg',
      quantity: item.quantity,
    });
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    items,
  };
}
