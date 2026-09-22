import 'server-only';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';

export type EngagementComment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
};

export type PostEngagementSummary = {
  likeCount: number;
  commentCount: number;
  liked: boolean;
  comments: EngagementComment[];
};

const GUEST_SESSION_COOKIE = 'update_guest_session';

export async function resolveGuestSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(GUEST_SESSION_COOKIE)?.value;
  if (existing) return existing;
  const generated = `guest_${crypto.randomUUID()}`;
  jar.set(GUEST_SESSION_COOKIE, generated, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return generated;
}

export async function getPostEngagement(
  postSlug: string,
  viewer?: { userId?: string | null; sessionId?: string | null },
): Promise<PostEngagementSummary> {
  const [likeCount, commentCount, comments, likedByUser, likedBySession] = await Promise.all([
    db.updateLike.count({ where: { postSlug } }),
    db.updateComment.count({ where: { postSlug, status: 'visible' } }),
    db.updateComment.findMany({
      where: { postSlug, status: 'visible' },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    }),
    viewer?.userId
      ? db.updateLike.findFirst({ where: { postSlug, userId: viewer.userId }, select: { id: true } })
      : Promise.resolve(null),
    viewer?.sessionId && !viewer.userId
      ? db.updateLike.findFirst({ where: { postSlug, sessionId: viewer.sessionId }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  return {
    likeCount,
    commentCount,
    liked: Boolean(likedByUser || likedBySession),
    comments: comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      authorName: comment.user.name || comment.user.email,
      createdAt: comment.createdAt.toISOString(),
    })),
  };
}

export async function togglePostLike(
  postSlug: string,
  viewer: { userId?: string | null; sessionId?: string | null },
): Promise<{ liked: boolean; likeCount: number }> {
  if (!viewer.userId && !viewer.sessionId) {
    throw new Error('Like requires a session');
  }

  const existing = viewer.userId
    ? await db.updateLike.findFirst({ where: { postSlug, userId: viewer.userId } })
    : await db.updateLike.findFirst({ where: { postSlug, sessionId: viewer.sessionId || undefined } });

  if (existing) {
    await db.updateLike.delete({ where: { id: existing.id } });
  } else {
    await db.updateLike.create({
      data: {
        postSlug,
        userId: viewer.userId || null,
        sessionId: viewer.userId ? null : viewer.sessionId || null,
      },
    });
  }

  const likeCount = await db.updateLike.count({ where: { postSlug } });
  return { liked: !existing, likeCount };
}

export async function addPostComment(input: {
  postSlug: string;
  userId: string;
  body: string;
}): Promise<EngagementComment> {
  const body = input.body.trim();
  if (!body) throw new Error('Comment body is required');

  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { name: true, email: true },
  });
  if (!user) throw new Error('User not found');

  const comment = await db.updateComment.create({
    data: {
      postSlug: input.postSlug,
      userId: input.userId,
      body,
    },
  });

  return {
    id: comment.id,
    body: comment.body,
    authorName: user.name || user.email,
    createdAt: comment.createdAt.toISOString(),
  };
}

export async function moderateComment(commentId: string, status: 'visible' | 'hidden') {
  return db.updateComment.update({
    where: { id: commentId },
    data: { status },
  });
}

export async function listHiddenComments(limit = 100) {
  return db.updateComment.findMany({
    where: { status: 'hidden' },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      user: { select: { name: true, email: true } },
    },
  });
}
