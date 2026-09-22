import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { requireUser } from '@/lib/auth';
import { parsePostMedia } from '@/lib/admin-content';
import { db } from '@/lib/db';
import { getPostBySlug, viewerCanAccessPost } from '@/lib/markdown';

const saveSchema = z.object({
  postSlug: z.string().min(1),
});

export async function GET() {
  try {
    const session = await requireUser();
    const viewer = {
      id: session.user.id,
      email: session.user.email,
      isAdmin: Boolean(session.user.isAdmin),
    };
    const saved = await db.savedUpdate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: { postSlug: true, createdAt: true },
    });

    const slugs = saved.map((entry) => entry.postSlug);
    const posts = slugs.length
      ? await db.blogPost.findMany({
          where: { slug: { in: slugs }, isDraft: false },
          select: {
            slug: true,
            title: true,
            excerpt: true,
            format: true,
            visibility: true,
            isDraft: true,
            publishedAt: true,
            coverImage: true,
            featured: true,
            media: true,
            pullQuote: true,
            location: true,
            processStage: true,
            audience: { select: { email: true, userId: true } },
          },
        })
      : [];
    const postBySlug = new Map(
      posts
        .filter((post) => viewerCanAccessPost(
          { visibility: (post.visibility === 'private' ? 'private' : 'public'), isDraft: post.isDraft },
          viewer,
          {
            audienceEmails: post.audience.map((entry) => entry.email),
            audienceUserIds: post.audience.map((entry) => entry.userId).filter((id): id is string => Boolean(id)),
          },
        ))
        .map((post) => [post.slug, post]),
    );

    const visibleSaved = saved.filter((entry) => postBySlug.has(entry.postSlug));

    return NextResponse.json({
      saved: visibleSaved.map((entry) => entry.postSlug),
      items: visibleSaved.map((entry) => {
        const post = postBySlug.get(entry.postSlug)!;
        return {
          postSlug: entry.postSlug,
          savedAt: entry.createdAt.toISOString(),
          post: {
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            format: post.format || 'article',
            visibility: post.visibility || 'public',
            publishedAt: post.publishedAt.toISOString(),
            coverImage: post.coverImage || undefined,
            featured: post.featured,
            media: parsePostMedia(post.media),
            pullQuote: post.pullQuote || undefined,
            location: post.location || undefined,
            processStage: post.processStage || undefined,
          },
        };
      }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Saved updates list error:', error);
    return NextResponse.json({ error: 'Failed to load saved updates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    const payload = saveSchema.parse(await request.json());
    const viewer = {
      id: session.user.id,
      email: session.user.email,
      isAdmin: Boolean(session.user.isAdmin),
    };
    const post = await getPostBySlug(payload.postSlug, false, viewer);
    if (!post) {
      throw new ApiError(404, 'Update not found', 'POST_NOT_FOUND');
    }

    await db.savedUpdate.upsert({
      where: {
        userId_postSlug: {
          userId: session.user.id,
          postSlug: payload.postSlug,
        },
      },
      create: {
        userId: session.user.id,
        postSlug: payload.postSlug,
      },
      update: {},
    });

    return NextResponse.json({ saved: true, postSlug: payload.postSlug });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid save request', details: error.issues }, { status: 400 });
    }
    console.error('Saved update create error:', error);
    return NextResponse.json({ error: 'Failed to save update' }, { status: 500 });
  }
}
