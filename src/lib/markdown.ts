import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { sanitizeRichHtml, stripLeadingDuplicateHeading } from '@/lib/content-sanitize';
import {
  isPublishableContentTitle,
  parsePostMedia,
  type PostFormat,
  type PostMediaItem,
  type PostProcessStage,
  type PostVisibility,
} from '@/lib/admin-content';

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  tags?: string[];
  isDraft?: boolean;
  featured?: boolean;
  coverImage?: string;
  author?: string;
  readingTime?: number;
  format: PostFormat;
  visibility: PostVisibility;
  media: PostMediaItem[];
  relatedProductId?: string;
  relatedArtworkSlug?: string;
  pullQuote?: string;
  location?: string;
  processStage?: PostProcessStage;
}

export interface BlogPostWithContent extends BlogPost {
  content: string;
  code: string;
}

export type PostViewer = {
  id?: string | null;
  email?: string | null;
  isAdmin?: boolean;
};

type BlogPostRecord = {
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  publishedAt: Date;
  tags: unknown;
  isDraft: boolean;
  featured?: boolean;
  coverImage?: string | null;
  author: string;
  format?: string | null;
  visibility?: string | null;
  media?: unknown;
  relatedProductId?: string | null;
  relatedArtworkSlug?: string | null;
  pullQuote?: string | null;
  location?: string | null;
  processStage?: string | null;
};

function tagsFromJson(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
}

function estimateReadingTime(content: string): number {
  const words = content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function asFormat(value: unknown): PostFormat {
  return value === 'short' ? 'short' : 'article';
}

function asProcessStage(value: unknown): PostProcessStage | undefined {
  if (value === 'sketch' || value === 'glaze' || value === 'finished' || value === 'other') return value;
  return undefined;
}

function sortPostsFeaturedFirst<T extends { featured?: boolean; publishedAt: string }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredDelta !== 0) return featuredDelta;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function isListedPublicPost(record: BlogPostRecord): boolean {
  if (record.isDraft) return false;
  if (asVisibility(record.visibility) !== 'public') return false;
  if (asFormat(record.format) === 'short') {
    return parsePostMedia(record.media).length > 0 || record.excerpt.trim().length >= 3 || isPublishableContentTitle(record.title);
  }
  return isPublishableContentTitle(record.title);
}

function asVisibility(value: unknown): PostVisibility {
  return value === 'private' ? 'private' : 'public';
}

function toPost(record: BlogPostRecord): BlogPost {
  return {
    slug: record.slug,
    title: record.title,
    excerpt: record.excerpt,
    publishedAt: record.publishedAt.toISOString(),
    tags: tagsFromJson(record.tags),
    isDraft: record.isDraft,
    featured: Boolean(record.featured),
    coverImage: record.coverImage || undefined,
    author: record.author || 'Artist',
    readingTime: estimateReadingTime(record.content || record.excerpt),
    format: asFormat(record.format),
    visibility: asVisibility(record.visibility),
    media: parsePostMedia(record.media),
    relatedProductId: record.relatedProductId || undefined,
    relatedArtworkSlug: record.relatedArtworkSlug || undefined,
    pullQuote: record.pullQuote || undefined,
    location: record.location || undefined,
    processStage: asProcessStage(record.processStage),
  };
}

export function viewerCanAccessPost(
  post: Pick<BlogPost, 'visibility' | 'isDraft'>,
  viewer: PostViewer | undefined,
  options?: { includeDrafts?: boolean; audienceEmails?: string[]; audienceUserIds?: string[] },
): boolean {
  if (post.isDraft && !options?.includeDrafts && !viewer?.isAdmin) return false;
  if (post.visibility !== 'private') return true;
  if (viewer?.isAdmin) return true;
  const email = normalizeEmail(viewer?.email);
  if (email && options?.audienceEmails?.includes(email)) return true;
  if (viewer?.id && options?.audienceUserIds?.includes(viewer.id)) return true;
  return false;
}

const getCachedPublishedPosts = unstable_cache(
  async () => {
    const posts = await db.blogPost.findMany({
      where: { isDraft: false, visibility: 'public' },
      orderBy: { publishedAt: 'desc' },
    });
    return sortPostsFeaturedFirst(
      posts
        .filter((post) => isListedPublicPost(post as BlogPostRecord))
        .map((post) => toPost(post as BlogPostRecord)),
    );
  },
  ['blog-posts-published-public'],
  { tags: ['posts'], revalidate: 300 }
);

export async function getAllPosts(includePages = false): Promise<BlogPost[]> {
  if (!includePages) {
    return getCachedPublishedPosts();
  }

  const posts = await db.blogPost.findMany({
    orderBy: { publishedAt: 'desc' },
  });
  return posts.map((post) => toPost(post as BlogPostRecord));
}

export async function getPrivatePostsForViewer(viewer: PostViewer | undefined): Promise<BlogPost[]> {
  if (!viewer?.id && !viewer?.email && !viewer?.isAdmin) return [];

  const email = normalizeEmail(viewer.email);
  const posts = await db.blogPost.findMany({
    where: {
      isDraft: false,
      visibility: 'private',
      ...(viewer.isAdmin
        ? {}
        : {
            audience: {
              some: {
                OR: [
                  ...(viewer.id ? [{ userId: viewer.id }] : []),
                  ...(email ? [{ email }] : []),
                ],
              },
            },
          }),
    },
    orderBy: { publishedAt: 'desc' },
    include: { audience: { select: { email: true, userId: true } } },
  });

  return sortPostsFeaturedFirst(
    posts
      .filter((post) => {
        if (asFormat(post.format) === 'short') {
          return parsePostMedia(post.media).length > 0 || post.excerpt.trim().length >= 3 || isPublishableContentTitle(post.title);
        }
        return isPublishableContentTitle(post.title);
      })
      .map((post) => toPost(post as BlogPostRecord)),
  );
}

export async function getPostBySlug(
  slug: string,
  includeDrafts = false,
  viewer?: PostViewer,
): Promise<BlogPostWithContent | null> {
  const post = await db.blogPost.findUnique({
    where: { slug },
    include: { audience: { select: { email: true, userId: true } } },
  });

  if (!post) return null;

  const mapped = toPost(post as BlogPostRecord);
  if (!viewerCanAccessPost(mapped, viewer, {
    includeDrafts,
    audienceEmails: post.audience.map((entry) => entry.email),
    audienceUserIds: post.audience.map((entry) => entry.userId).filter((id): id is string => Boolean(id)),
  })) {
    return null;
  }

  if (!includeDrafts && mapped.visibility === 'public' && !isListedPublicPost(post as BlogPostRecord)) {
    return null;
  }

  const content = stripLeadingDuplicateHeading(sanitizeRichHtml(post.content), post.title);
  return {
    ...mapped,
    content,
    code: content,
  };
}

export async function replacePostAudience(postId: string, emails: string[]): Promise<void> {
  const uniqueEmails = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  const users = uniqueEmails.length
    ? await db.user.findMany({
        where: { email: { in: uniqueEmails } },
        select: { id: true, email: true },
      })
    : [];
  const userIdByEmail = new Map(
    users
      .filter((user) => user.email)
      .map((user) => [normalizeEmail(user.email), user.id]),
  );

  await db.$transaction([
    db.blogPostAudience.deleteMany({ where: { postId } }),
    ...(uniqueEmails.length
      ? [
          db.blogPostAudience.createMany({
            data: uniqueEmails.map((email) => ({
              postId,
              email,
              userId: userIdByEmail.get(email) || null,
            })),
          }),
        ]
      : []),
  ]);
}

export async function getPostSlugs(): Promise<string[]> {
  const posts = await db.blogPost.findMany({
    where: { isDraft: false, visibility: 'public' },
    select: { slug: true, title: true, format: true, excerpt: true, media: true },
  });
  return posts
    .filter((post) => isListedPublicPost(post as BlogPostRecord))
    .map((post) => post.slug);
}
