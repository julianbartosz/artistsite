import 'server-only';
import { db } from '@/lib/db';
import { slugify } from '@/lib/admin-content';
import { replacePostAudience } from '@/lib/markdown';
import { notifyCollectorsOfPrivatePost } from '@/lib/collector-update-notify';
import { getSiteContent } from '@/lib/site-content';
import { revalidatePath, revalidateTag } from 'next/cache';
import { UPDATES_PATH } from '@/lib/site-content-shared';
import type { Order } from '@/lib/orders';

export type OrderProgressPostMode = 'off' | 'draft' | 'publish';

function itemSummary(order: Order): string {
  const titles = order.items.map((item) => item.product?.title || 'Artwork').filter(Boolean);
  if (titles.length === 0) return 'your order';
  if (titles.length === 1) return titles[0];
  return `${titles[0]} and ${titles.length - 1} more`;
}

export async function maybeCreateOrderProgressPost(
  order: Order,
  previousStatus: string,
): Promise<{ created: boolean; slug?: string; mode: OrderProgressPostMode }> {
  if (order.status !== 'processing' || previousStatus === 'processing') {
    return { created: false, mode: 'off' };
  }

  const blog = await getSiteContent('blog');
  const mode = blog.autoOrderProgressPost || 'draft';
  if (mode === 'off') return { created: false, mode };

  const existing = await db.blogPost.findFirst({
    where: { relatedOrderId: order.id },
    select: { slug: true },
  });
  if (existing) return { created: false, mode, slug: existing.slug };

  const summary = itemSummary(order);
  const template = blog.autoOrderProgressExcerpt || 'Work has started in the studio on {{summary}}. This private update is linked to your order — more photos and notes will appear here as the piece progresses.';
  const excerpt = template.replace('{{summary}}', summary).replace('{{orderNumber}}', order.orderNumber);
  const slugBase = slugify(`order-${order.orderNumber}-in-production`);
  let slug = slugBase;
  let suffix = 1;
  while (await db.blogPost.findUnique({ where: { slug }, select: { slug: true } })) {
    slug = `${slugBase}-${suffix}`;
    suffix += 1;
  }

  const isDraft = mode === 'draft';
  const post = await db.blogPost.create({
    data: {
      slug,
      title: `Order ${order.orderNumber} — In production`,
      excerpt,
      content: `<p>${excerpt}</p>`,
      isDraft,
      format: 'short',
      visibility: 'private',
      processStage: 'other',
      relatedOrderId: order.id,
      relatedProductId: order.items[0]?.productId || null,
      tags: ['order-progress'],
      media: [],
    },
  });

  await replacePostAudience(post.id, [order.customerEmail.trim().toLowerCase()]);

  if (!isDraft) {
    void notifyCollectorsOfPrivatePost(post.id).catch((error) => {
      console.error('Order progress post notify failed:', error);
    });
  }

  revalidateTag('posts');
  revalidatePath('/blog');
  revalidatePath(UPDATES_PATH);

  return { created: true, slug: post.slug, mode };
}
