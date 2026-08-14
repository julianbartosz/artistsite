import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { sanitizeRichHtml } from '@/lib/content-sanitize';

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
}

export interface BlogPostWithContent extends BlogPost {
  content: string;
  code: string;
}

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
};

function tagsFromJson(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
}

function estimateReadingTime(content: string): number {
  const words = content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
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
  };
}

const getCachedPublishedPosts = unstable_cache(
  async () => {
    const posts = await db.blogPost.findMany({
      where: { isDraft: false },
      orderBy: { publishedAt: 'desc' },
    });
    return posts.map((post) => toPost(post as BlogPostRecord));
  },
  ['blog-posts-published'],
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

export async function getPostBySlug(slug: string, includeDrafts = false): Promise<BlogPostWithContent | null> {
  const post = await db.blogPost.findUnique({
    where: { slug },
  });

  if (!post || (post.isDraft && !includeDrafts)) {
    return null;
  }

  const content = sanitizeRichHtml(post.content);
  return {
    ...toPost(post as BlogPostRecord),
    content,
    code: content,
  };
}

export async function getPostSlugs(): Promise<string[]> {
  const posts = await db.blogPost.findMany({
    where: { isDraft: false },
    select: { slug: true },
  });
  return posts.map((post) => post.slug);
}