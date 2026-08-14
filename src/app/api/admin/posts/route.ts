import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { blogPostPayloadSchema, sanitizeBlogPostPayload } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: string }).code === 'P2002';
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const posts = await db.blogPost.findMany({ orderBy: { publishedAt: 'desc' } });
    const viewEvents = await db.analyticsEvent.findMany({
      where: { eventName: 'blog_post_view' },
      select: { properties: true },
    });
    const viewsBySlug = new Map<string, number>();
    for (const event of viewEvents) {
      try {
        const properties = typeof event.properties === 'string' ? JSON.parse(event.properties) : event.properties;
        const slug = properties?.slug;
        if (typeof slug === 'string') {
          viewsBySlug.set(slug, (viewsBySlug.get(slug) || 0) + 1);
        }
      } catch {
        // Ignore malformed legacy analytics payloads.
      }
    }

    return NextResponse.json(posts.map((post) => ({
      id: post.slug,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      status: post.isDraft ? 'draft' : 'published',
      isDraft: post.isDraft,
      publishedAt: post.publishedAt.toISOString(),
      views: viewsBySlug.get(post.slug) || 0,
      featured: post.featured,
      tags: post.tags || [],
      coverImage: post.coverImage,
      author: post.author,
    })), {
      headers: {
        'Cache-Control': 'private, max-age=60', // 1 minute cache
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error('Posts API error:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = sanitizeBlogPostPayload(blogPostPayloadSchema.parse(await request.json()));
    const existingPost = await db.blogPost.findFirst({
      where: { slug: payload.slug },
      select: { slug: true, title: true },
    });

    if (existingPost) {
      return NextResponse.json({ error: `Post already exists (${existingPost.slug}). Edit the existing item instead of creating a duplicate.` }, { status: 409 });
    }

    const post = await db.blogPost.create({ data: payload });
    revalidateTag('posts');
    revalidatePath('/blog');

    return NextResponse.json({ post }, { status: 201 });

  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid post data', details: error.issues }, { status: 400 });
    }

    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'Post already exists. Edit the existing item instead of creating a duplicate.' }, { status: 409 });
    }

    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}