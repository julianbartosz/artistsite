import 'server-only';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { ApiError } from '@/lib/api-error-handler';
import type { EngagementComment, PostEngagementState } from '@/lib/site-content-shared';

export type { EngagementComment, PostEngagementState } from '@/lib/site-content-shared';

export type EngagementViewer = { userId?: string | null; sessionId?: string | null };

export type PostEngagementSummary = PostEngagementState & {
  comments: EngagementComment[];
};

const GUEST_SESSION_COOKIE = 'update_guest_session';
const COMMENT_PAGE_SIZE = 50;
const COMMENT_RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
const ANONYMOUS_AUTHOR = 'Collector';

const EMPTY_STATE: PostEngagementState = { likeCount: 0, commentCount: 0, liked: false, saved: false };

export async function readGuestSessionId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(GUEST_SESSION_COOKIE)?.value || null;
}

export async function resolveGuestSessionId(): Promise<string> {
  const existing = await readGuestSessionId();
  if (existing) return existing;
  const jar = await cookies();
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

/** A signed-in viewer also owns any like made from this browser before signing in. */
function likeOwnership(viewer: EngagementViewer) {
  const owners: Array<{ userId: string } | { sessionId: string }> = [];
  if (viewer.userId) owners.push({ userId: viewer.userId });
  if (viewer.sessionId) owners.push({ sessionId: viewer.sessionId });
  return owners;
}

function publicAuthorName(user: { name: string | null }): string {
  return user.name?.trim() || ANONYMOUS_AUTHOR;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

export async function getEngagementStates(
  postSlugs: string[],
  viewer: EngagementViewer,
): Promise<Record<string, PostEngagementState>> {
  const slugs = [...new Set(postSlugs)];
  if (slugs.length === 0) return {};
  const owners = likeOwnership(viewer);

  const [likeGroups, commentGroups, viewerLikes, viewerSaves] = await Promise.all([
    db.updateLike.groupBy({ by: ['postSlug'], where: { postSlug: { in: slugs } }, _count: { _all: true } }),
    db.updateComment.groupBy({
      by: ['postSlug'],
      where: { postSlug: { in: slugs }, status: 'visible' },
      _count: { _all: true },
    }),
    owners.length
      ? db.updateLike.findMany({ where: { postSlug: { in: slugs }, OR: owners }, select: { postSlug: true } })
      : Promise.resolve([]),
    viewer.userId
      ? db.savedUpdate.findMany({ where: { userId: viewer.userId, postSlug: { in: slugs } }, select: { postSlug: true } })
      : Promise.resolve([]),
  ]);

  const likes = new Map(likeGroups.map((group) => [group.postSlug, group._count._all]));
  const comments = new Map(commentGroups.map((group) => [group.postSlug, group._count._all]));
  const liked = new Set(viewerLikes.map((like) => like.postSlug));
  const saved = new Set(viewerSaves.map((entry) => entry.postSlug));

  return Object.fromEntries(slugs.map((slug) => [slug, {
    likeCount: likes.get(slug) ?? 0,
    commentCount: comments.get(slug) ?? 0,
    liked: liked.has(slug),
    saved: saved.has(slug),
  }]));
}

export async function getPostEngagement(
  postSlug: string,
  viewer: EngagementViewer,
): Promise<PostEngagementSummary> {
  const [states, latest] = await Promise.all([
    getEngagementStates([postSlug], viewer),
    db.updateComment.findMany({
      where: { postSlug, status: 'visible' },
      orderBy: { createdAt: 'desc' },
      take: COMMENT_PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return {
    ...(states[postSlug] ?? EMPTY_STATE),
    comments: latest.reverse().map((comment) => ({
      id: comment.id,
      body: comment.body,
      authorName: publicAuthorName(comment.user),
      createdAt: comment.createdAt.toISOString(),
      canRemove: Boolean(viewer.userId) && comment.userId === viewer.userId,
    })),
  };
}

/** Idempotent: repeated or concurrent requests for the same desired state converge on one row. */
export async function setPostLike(
  postSlug: string,
  viewer: EngagementViewer,
  liked: boolean,
): Promise<{ liked: boolean; likeCount: number }> {
  const owners = likeOwnership(viewer);
  if (owners.length === 0) throw new ApiError(400, 'Like requires a session', 'SESSION_REQUIRED');

  if (!liked) {
    await db.updateLike.deleteMany({ where: { postSlug, OR: owners } });
  } else {
    const existing = await db.updateLike.findFirst({ where: { postSlug, OR: owners }, select: { id: true, userId: true } });
    try {
      if (!existing) {
        await db.updateLike.create({
          data: {
            postSlug,
            userId: viewer.userId || null,
            sessionId: viewer.userId ? null : viewer.sessionId || null,
          },
        });
      } else if (viewer.userId && !existing.userId) {
        await db.updateLike.update({ where: { id: existing.id }, data: { userId: viewer.userId, sessionId: null } });
      }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (existing && viewer.userId && !existing.userId) {
        await db.updateLike.deleteMany({ where: { id: existing.id } });
      }
    }
  }

  const likeCount = await db.updateLike.count({ where: { postSlug } });
  return { liked, likeCount };
}

export async function countVisibleComments(postSlug: string): Promise<number> {
  return db.updateComment.count({ where: { postSlug, status: 'visible' } });
}

export async function addPostComment(input: {
  postSlug: string;
  userId: string;
  body: string;
}): Promise<EngagementComment> {
  const body = input.body.trim();
  if (!body) throw new ApiError(400, 'Comment body is required', 'COMMENT_REQUIRED');

  const recent = await db.updateComment.count({
    where: { userId: input.userId, createdAt: { gte: new Date(Date.now() - COMMENT_RATE_LIMIT.windowMs) } },
  });
  if (recent >= COMMENT_RATE_LIMIT.max) {
    throw new ApiError(429, 'You are commenting too quickly. Please wait a few minutes.', 'COMMENT_RATE_LIMITED');
  }

  const comment = await db.updateComment.create({
    data: { postSlug: input.postSlug, userId: input.userId, body },
    include: { user: { select: { name: true } } },
  });

  return {
    id: comment.id,
    body: comment.body,
    authorName: publicAuthorName(comment.user),
    createdAt: comment.createdAt.toISOString(),
    canRemove: true,
  };
}

/** Authors withdraw their own comments; withdrawn comments never reach the artist's restore queue. */
export async function removeOwnComment(input: { postSlug: string; commentId: string; userId: string }) {
  const result = await db.updateComment.updateMany({
    where: { id: input.commentId, postSlug: input.postSlug, userId: input.userId, status: 'visible' },
    data: { status: 'removed' },
  });
  if (result.count === 0) throw new ApiError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
}

export async function moderateComment(commentId: string, status: 'visible' | 'hidden') {
  const result = await db.updateComment.updateMany({
    where: { id: commentId, status: { in: ['visible', 'hidden'] } },
    data: { status },
  });
  if (result.count === 0) throw new ApiError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
  return { id: commentId, status };
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
