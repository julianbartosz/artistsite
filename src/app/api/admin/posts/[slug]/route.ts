import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { blogPostPayloadSchema, sanitizeBlogPostPayload } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    const payload = sanitizeBlogPostPayload(blogPostPayloadSchema.parse(await request.json()));
    const post = await db.blogPost.update({ where: { slug }, data: payload });
    revalidateTag('posts');
    revalidatePath('/blog');
    revalidatePath(`/blog/${post.slug}`);
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid post data', details: error.issues }, { status: 400 });
    console.error('Admin post update error:', error);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    await db.blogPost.delete({ where: { slug } });
    revalidateTag('posts');
    revalidatePath('/blog');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Admin post delete error:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}