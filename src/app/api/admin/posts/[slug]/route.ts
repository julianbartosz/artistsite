import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { blogPostPayloadSchema, sanitizeBlogPostPayload } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { replacePostAudience } from '@/lib/markdown';
import { notifyCollectorsOfPrivatePost } from '@/lib/collector-update-notify';
import { UPDATES_PATH } from '@/lib/site-content-shared';

function revalidateUpdates(slug?: string) {
  revalidateTag('posts');
  revalidatePath('/blog');
  revalidatePath(UPDATES_PATH);
  if (slug) {
    revalidatePath(`/blog/${slug}`);
    revalidatePath(`${UPDATES_PATH}/${slug}`);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    const existing = await db.blogPost.findUnique({ where: { slug }, select: { id: true, isDraft: true, visibility: true } });
    const payload = sanitizeBlogPostPayload(blogPostPayloadSchema.parse(await request.json()));
    const { audienceEmails, ...data } = payload;
    const post = await db.blogPost.update({ where: { slug }, data });
    await replacePostAudience(post.id, audienceEmails);
    const becamePublishedPrivate = Boolean(
      existing
      && (existing.isDraft || existing.visibility !== 'private')
      && !post.isDraft
      && post.visibility === 'private',
    );
    if (becamePublishedPrivate) {
      void notifyCollectorsOfPrivatePost(post.id).catch((error) => {
        console.error('Collector notify failed for updated post:', error);
      });
    }
    revalidateUpdates(post.slug);
    if (post.slug !== slug) revalidateUpdates(slug);
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid post data', details: error.issues }, { status: 400 });
    if (typeof error === 'object' && error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Another update already uses this slug. Choose a different URL slug.' }, { status: 409 });
    }
    console.error('Admin post update error:', error);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    await db.blogPost.delete({ where: { slug } });
    revalidateUpdates(slug);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Admin post delete error:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
