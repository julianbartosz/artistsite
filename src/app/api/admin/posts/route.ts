import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { blogPostPayloadSchema, parsePostMedia, sanitizeBlogPostPayload } from '@/lib/admin-content';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { replacePostAudience } from '@/lib/markdown';
import { notifyCollectorsOfPrivatePost } from '@/lib/collector-update-notify';
import { getPrivateViewersBySlug } from '@/lib/post-view-analytics';
import { UPDATES_PATH } from '@/lib/site-content-shared';

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: string }).code === 'P2002';
}

function revalidateUpdates(slug?: string) {
  revalidateTag('posts');
  revalidatePath('/blog');
  revalidatePath(UPDATES_PATH);
  if (slug) {
    revalidatePath(`/blog/${slug}`);
    revalidatePath(`${UPDATES_PATH}/${slug}`);
  }
}

async function listCollectorAccounts() {
  const [users, orderGroups] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
      },
      orderBy: { email: 'asc' },
      take: 500,
    }),
    db.order.groupBy({
      by: ['userEmail'],
      _count: { _all: true },
    }),
  ]);

  const orderCountByEmail = new Map(
    orderGroups.map((group) => [group.userEmail.trim().toLowerCase(), group._count._all]),
  );

  const collectors = users
    .filter((user) => user.email)
    .map((user) => {
      const email = user.email!.trim().toLowerCase();
      return {
        id: user.id,
        email,
        name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || email,
        orderCount: orderCountByEmail.get(email) || 0,
      };
    });

  const known = new Set(collectors.map((collector) => collector.email));
  for (const [email, orderCount] of orderCountByEmail) {
    if (!email || known.has(email)) continue;
    known.add(email);
    collectors.push({ id: '', email, name: email, orderCount });
  }

  return collectors.sort((a, b) => a.email.localeCompare(b.email));
}

export async function GET() {
  try {
    await requireAdmin();

    const [posts, viewEvents, collectors] = await Promise.all([
      db.blogPost.findMany({
        orderBy: { publishedAt: 'desc' },
        include: { audience: { select: { email: true } } },
      }),
      db.analyticsEvent.findMany({
        where: { eventName: 'blog_post_view' },
        select: { properties: true },
      }),
      listCollectorAccounts(),
    ]);
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

    const privateSlugs = posts.filter((post) => post.visibility === 'private').map((post) => post.slug);
    const privateViewersBySlug = await getPrivateViewersBySlug(privateSlugs);

    return NextResponse.json({
      posts: posts.map((post) => ({
        id: post.slug,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        status: post.isDraft ? 'draft' : 'published',
        isDraft: post.isDraft,
        publishedAt: post.publishedAt.toISOString(),
        views: viewsBySlug.get(post.slug) || 0,
        privateViewers: post.visibility === 'private' ? (privateViewersBySlug.get(post.slug) || []) : [],
        featured: post.featured,
        tags: post.tags || [],
        coverImage: post.coverImage,
        author: post.author,
        format: post.format || 'article',
        visibility: post.visibility || 'public',
        media: parsePostMedia(post.media),
        relatedProductId: post.relatedProductId,
        relatedArtworkSlug: post.relatedArtworkSlug,
        relatedOrderId: post.relatedOrderId,
        pullQuote: post.pullQuote,
        location: post.location,
        processStage: post.processStage,
        audienceEmails: post.audience.map((entry) => entry.email),
      })),
      collectors,
    }, {
      headers: {
        'Cache-Control': 'private, no-store',
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

    const { audienceEmails, ...data } = payload;
    const post = await db.blogPost.create({ data });
    await replacePostAudience(post.id, audienceEmails);
    if (!post.isDraft && post.visibility === 'private') {
      void notifyCollectorsOfPrivatePost(post.id).catch((error) => {
        console.error('Collector notify failed for new post:', error);
      });
    }
    revalidateUpdates(post.slug);

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
