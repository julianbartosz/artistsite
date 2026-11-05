import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from '@/lib/api-error-handler';
import { getServerSession } from 'next-auth';
import { authOptions, requireUser } from '@/lib/auth';
import { getPostBySlug } from '@/lib/markdown';
import { getSiteContent } from '@/lib/site-content';
import {
  addPostComment,
  countVisibleComments,
  getPostEngagement,
  readGuestSessionId,
  removeOwnComment,
  resolveGuestSessionId,
  setPostLike,
} from '@/lib/update-engagement';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('like'), liked: z.boolean() }),
  z.object({ action: z.literal('comment'), body: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal('remove_comment'), commentId: z.string().min(1) }),
]);

const NO_STORE = { 'Cache-Control': 'private, no-store' };

async function loadViewerAndPost(slug: string) {
  const session = await getServerSession(authOptions);
  const viewer = session?.user
    ? { id: session.user.id, email: session.user.email, isAdmin: Boolean(session.user.isAdmin) }
    : undefined;
  const post = await getPostBySlug(slug, false, viewer);
  if (!post) throw new ApiError(404, 'Update not found', 'POST_NOT_FOUND');
  return { userId: session?.user?.id ?? null };
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid engagement request', details: error.issues }, { status: 400, headers: NO_STORE });
  }
  console.error(`${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500, headers: NO_STORE });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { userId } = await loadViewerAndPost(slug);
    const engagement = await getPostEngagement(slug, { userId, sessionId: await readGuestSessionId() });
    return NextResponse.json({ engagement }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error, 'Failed to load engagement');
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const payload = actionSchema.parse(await request.json());
    const [{ userId }, blog] = await Promise.all([loadViewerAndPost(slug), getSiteContent('blog')]);

    if (payload.action === 'like') {
      if (!blog.showLikes) throw new ApiError(403, 'Likes are turned off for updates', 'LIKES_DISABLED');
      const sessionId = userId ? await readGuestSessionId() : await resolveGuestSessionId();
      const result = await setPostLike(slug, { userId, sessionId }, payload.liked);
      return NextResponse.json(result, { headers: NO_STORE });
    }

    if (!blog.showComments) throw new ApiError(403, 'Comments are turned off for updates', 'COMMENTS_DISABLED');
    const session = await requireUser();

    if (payload.action === 'remove_comment') {
      await removeOwnComment({ postSlug: slug, commentId: payload.commentId, userId: session.user.id });
      return NextResponse.json({ removed: true, commentCount: await countVisibleComments(slug) }, { headers: NO_STORE });
    }

    const comment = await addPostComment({ postSlug: slug, userId: session.user.id, body: payload.body });
    return NextResponse.json(
      { comment, commentCount: await countVisibleComments(slug) },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    return errorResponse(error, 'Failed to update engagement');
  }
}
