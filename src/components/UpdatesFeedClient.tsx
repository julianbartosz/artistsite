'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import PostMedia from '@/components/PostMedia';
import UpdateQuickLook, { type UpdateQuickLookPost } from '@/components/UpdateQuickLook';
import PostEngagement from '@/components/PostEngagement';
import {
  updatesPostPath,
  updatesTagPath,
  type PostEngagementState,
  type UpdatesFeedCopy,
} from '@/lib/site-content-shared';

type FeedPost = UpdateQuickLookPost & {
  tags?: string[];
  coverImage?: string;
  author?: string;
};

type UpdatesFeedClientProps = {
  posts: FeedPost[];
  layout: 'timeline' | 'grid';
  copy: UpdatesFeedCopy;
  signedIn: boolean;
  signInCallbackUrl: string;
  engagement: Record<string, PostEngagementState>;
};

const EMPTY_ENGAGEMENT: PostEngagementState = { likeCount: 0, commentCount: 0, liked: false, saved: false };

export default function UpdatesFeedClient({
  posts,
  layout,
  copy,
  signedIn,
  signInCallbackUrl,
  engagement,
}: UpdatesFeedClientProps) {
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [overrides, setOverrides] = useState<Record<string, PostEngagementState>>({});

  const stateFor = (slug: string) => overrides[slug] ?? engagement[slug] ?? EMPTY_ENGAGEMENT;
  const setStateFor = (slug: string) => (next: PostEngagementState) => {
    setOverrides((current) => ({ ...current, [slug]: next }));
  };

  const engagementFor = (post: FeedPost, trailing?: ReactNode) => (
    <PostEngagement
      slug={post.slug}
      title={post.format === 'short' ? (post.excerpt || post.title) : post.title}
      copy={copy}
      signedIn={signedIn}
      signInCallbackUrl={signInCallbackUrl}
      initialState={stateFor(post.slug)}
      state={stateFor(post.slug)}
      onStateChange={setStateFor(post.slug)}
      trailing={trailing}
    />
  );

  const quickLook = (
    <UpdateQuickLook
      post={activePost}
      open={Boolean(activePost)}
      onClose={() => setActivePost(null)}
      journalLabel={copy.journalLabel}
      studioLabel={copy.studioLabel}
      quickLookLabel={copy.quickLookLabel}
      featuredLabel={copy.featuredLabel}
      privateLabel={copy.privateSectionTitle}
      actions={activePost ? engagementFor(activePost) : null}
    />
  );

  if (layout === 'grid') {
    return (
      <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {posts.map((post) => {
            const headline = post.format === 'short' ? (post.excerpt || post.title) : post.title;
            return (
              <div key={post.slug} className="group relative overflow-hidden rounded-xl bg-gray-100 card-surface">
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => setActivePost(post)}
                  aria-label={`${copy.quickLookLabel}: ${headline}`}
                >
                  {post.media.length > 0 ? (
                    <PostMedia items={post.media} title={post.title} layout="grid" />
                  ) : post.coverImage ? (
                    <div className="relative aspect-square overflow-hidden">
                      <img src={post.coverImage} alt={post.title} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-end bg-gray-200 p-4">
                      <h2 className="text-lg font-semibold text-gray-900">{headline}</h2>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                    <p className="text-sm font-medium leading-snug">{headline}</p>
                  </div>
                </button>
                {post.featured && (
                  <div className="absolute right-2 top-2">
                    <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-white">{copy.featuredLabel}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {quickLook}
      </>
    );
  }

  return (
    <>
      <div className="space-y-10">
        {posts.map((post) => {
          const href = updatesPostPath(post.slug);
          const isShort = post.format === 'short';
          return (
            <article key={post.slug} className="border-b border-gray-200 pb-8 last:border-b-0 last:pb-0">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                <span>{isShort ? copy.studioLabel : copy.journalLabel}</span>
                {copy.showFeedDate && (
                  <time dateTime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </time>
                )}
                {copy.showFeedAuthor && post.author && <span>{post.author}</span>}
                {post.featured && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{copy.featuredLabel}</span>}
                {post.visibility === 'private' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{copy.privateSectionTitle}</span>
                )}
                {post.processStage && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{post.processStage}</span>}
              </div>
              {post.media.length > 0 && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setActivePost(post)}
                    className="block w-full text-left"
                    aria-label={`${copy.quickLookLabel}: ${isShort ? (post.excerpt || post.title) : post.title}`}
                  >
                    <PostMedia items={post.media} title={post.title} layout="feed" />
                  </button>
                </div>
              )}
              {post.pullQuote && (
                <blockquote className="mb-4 border-l-4 border-primary/30 pl-4 text-lg italic text-gray-700">{post.pullQuote}</blockquote>
              )}
              {!isShort && (
                <h2 className="text-2xl font-bold text-gray-900">
                  <Link href={href} className="hover:text-gray-700">{post.title}</Link>
                </h2>
              )}
              {post.excerpt && (
                <p className={`text-gray-700 ${isShort ? 'text-lg' : 'mt-2'}`}>{post.excerpt}</p>
              )}
              {post.location && <p className="mt-2 text-sm text-gray-500">{post.location}</p>}
              {copy.showFeedTags && post.tags && post.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Link key={tag} href={updatesTagPath(tag)} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200">
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-4 -ml-3">
                {engagementFor(post, (
                  <Link href={href} className="tap-target-inline text-sm font-medium text-gray-900 hover:text-primary">
                    {isShort ? 'View post' : 'Read full post'} →
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {quickLook}
    </>
  );
}
