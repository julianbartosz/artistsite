'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PostMedia from '@/components/PostMedia';
import UpdateQuickLook, { type UpdateQuickLookPost } from '@/components/UpdateQuickLook';
import PostEngagement from '@/components/PostEngagement';
import { updatesPostPath } from '@/lib/site-content-shared';

type FeedPost = UpdateQuickLookPost & {
  tags?: string[];
  coverImage?: string;
  author?: string;
};

type UpdatesFeedClientProps = {
  posts: FeedPost[];
  layout: 'timeline' | 'grid';
  journalLabel: string;
  studioLabel: string;
  signedIn: boolean;
  quickLookLabel?: string;
  saveUpdateLabel?: string;
  askArtistLabel?: string;
  featuredLabel?: string;
  showFeedDate?: boolean;
  showFeedAuthor?: boolean;
  showFeedTags?: boolean;
  showComments?: boolean;
  showLikes?: boolean;
  commentsLabel?: string;
  likeLabel?: string;
};

function formatLabel(post: FeedPost, journalLabel: string, studioLabel: string): string {
  return post.format === 'short' ? studioLabel : journalLabel;
}

export default function UpdatesFeedClient({
  posts,
  layout,
  journalLabel,
  studioLabel,
  signedIn,
  quickLookLabel = 'Quick look',
  saveUpdateLabel = 'Save',
  askArtistLabel = 'Ask the artist',
  featuredLabel = 'Featured',
  showFeedDate = true,
  showFeedAuthor = true,
  showFeedTags = true,
  showComments = false,
  showLikes = false,
  commentsLabel = 'Comments',
  likeLabel = 'Like',
}: UpdatesFeedClientProps) {
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [savedSlugs, setSavedSlugs] = useState<Set<string>>(new Set());
  const [messageDraft, setMessageDraft] = useState<{ post: FeedPost; body: string } | null>(null);
  const [messageStatus, setMessageStatus] = useState<string | null>(null);

  const savedLookup = useMemo(() => savedSlugs, [savedSlugs]);

  const loadSaved = useCallback(async () => {
    if (!signedIn) return;
    try {
      const response = await fetch('/api/account/saved-updates', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setSavedSlugs(new Set(Array.isArray(data.saved) ? data.saved : []));
    } catch {
      // Ignore load failures.
    }
  }, [signedIn]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  async function toggleSave(post: FeedPost) {
    if (!signedIn) return;
    const isSaved = savedLookup.has(post.slug);
    const response = await fetch(isSaved ? `/api/account/saved-updates/${encodeURIComponent(post.slug)}` : '/api/account/saved-updates', {
      method: isSaved ? 'DELETE' : 'POST',
      headers: isSaved ? undefined : { 'Content-Type': 'application/json' },
      body: isSaved ? undefined : JSON.stringify({ postSlug: post.slug }),
    });
    if (!response.ok) return;
    setSavedSlugs((current) => {
      const next = new Set(current);
      if (isSaved) next.delete(post.slug);
      else next.add(post.slug);
      return next;
    });
  }

  async function sendMessage() {
    if (!messageDraft || !signedIn) return;
    setMessageStatus(null);
    const response = await fetch('/api/account/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postSlug: messageDraft.post.slug,
        postTitle: messageDraft.post.title,
        message: messageDraft.body,
      }),
    });
    if (!response.ok) {
      setMessageStatus('Could not send message. Try again.');
      return;
    }
    setMessageStatus('Message sent. View replies in your account.');
    setMessageDraft(null);
  }

  const quickLook = (
    <UpdateQuickLook
      post={activePost}
      open={Boolean(activePost)}
      onClose={() => setActivePost(null)}
      journalLabel={journalLabel}
      studioLabel={studioLabel}
      quickLookLabel={quickLookLabel}
      signedIn={signedIn}
      saved={activePost ? savedLookup.has(activePost.slug) : false}
      onToggleSave={(post) => void toggleSave(post as FeedPost)}
      onAskArtist={(post) => setMessageDraft({ post: post as FeedPost, body: '' })}
      saveLabel={saveUpdateLabel}
      askLabel={askArtistLabel}
    />
  );

  const composer = messageDraft ? (
    <MessageComposer
      title={`${askArtistLabel}: ${messageDraft.post.format === 'short' ? messageDraft.post.excerpt || messageDraft.post.title : messageDraft.post.title}`}
      body={messageDraft.body}
      onBodyChange={(body) => setMessageDraft({ ...messageDraft, body })}
      onClose={() => setMessageDraft(null)}
      onSend={() => void sendMessage()}
      status={messageStatus}
    />
  ) : null;

  if (layout === 'grid') {
    return (
      <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {posts.map((post) => {
            const headline = post.format === 'short' ? (post.excerpt || post.title) : post.title;
            return (
              <div key={post.slug} className="group relative overflow-hidden rounded-xl bg-gray-100 card-surface">
                <button type="button" className="block w-full text-left" onClick={() => setActivePost(post)}>
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
                    <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-white">{featuredLabel}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {quickLook}
        {composer}
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
            <article key={post.slug} className="border-b border-gray-200 pb-10 last:border-b-0 last:pb-0">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                <span>{formatLabel(post, journalLabel, studioLabel)}</span>
                {showFeedDate && (
                  <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                )}
                {showFeedAuthor && post.author && <span>{post.author}</span>}
                {post.featured && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{featuredLabel}</span>}
                {post.visibility === 'private' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Collectors</span>
                )}
                {post.processStage && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{post.processStage}</span>}
              </div>
              {showFeedTags && post.tags && post.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{tag}</span>
                  ))}
                </div>
              )}
              {post.media.length > 0 && (
                <div className="mb-4">
                  <button type="button" onClick={() => setActivePost(post)} className="block w-full text-left">
                    <PostMedia items={post.media} title={post.title} layout="feed" />
                  </button>
                </div>
              )}
              {post.pullQuote && (
                <blockquote className="mb-4 border-l-4 border-primary/30 pl-4 text-lg italic text-gray-700">{post.pullQuote}</blockquote>
              )}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {!isShort && (
                    <h2 className="text-2xl font-bold text-gray-900">
                      <Link href={href} className="hover:text-gray-700">{post.title}</Link>
                    </h2>
                  )}
                  {post.excerpt && (
                    <p className={`text-gray-700 ${isShort ? 'text-lg' : 'mt-2'}`}>{post.excerpt}</p>
                  )}
                  {post.location && <p className="mt-2 text-sm text-gray-500">{post.location}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setActivePost(post)} className="tap-target-inline rounded-md text-sm font-medium text-primary hover:opacity-80">
                    {quickLookLabel}
                  </button>
                  {signedIn && (
                    <>
                      <button type="button" onClick={() => void toggleSave(post)} className="tap-target-inline rounded-md text-sm font-medium text-gray-600 hover:text-gray-900">
                        {savedLookup.has(post.slug) ? 'Saved' : saveUpdateLabel}
                      </button>
                      <button type="button" onClick={() => setMessageDraft({ post, body: '' })} className="tap-target-inline rounded-md text-sm font-medium text-gray-600 hover:text-gray-900">
                        {askArtistLabel}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <Link href={href} className="text-sm font-medium text-gray-900 hover:text-primary">
                  Read full post →
                </Link>
              </div>
              {(showComments || showLikes) && (
                <PostEngagement
                  slug={post.slug}
                  signedIn={signedIn}
                  signInCallbackUrl={href}
                  showComments={showComments}
                  showLikes={showLikes}
                  commentsLabel={commentsLabel}
                  likeLabel={likeLabel}
                  compact
                />
              )}
            </article>
          );
        })}
      </div>
      {quickLook}
      {composer}
    </>
  );
}

function MessageComposer({
  title,
  body,
  onBodyChange,
  onClose,
  onSend,
  status,
}: {
  title: string;
  body: string;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
  status: string | null;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <textarea
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          rows={5}
          className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Write your message to the artist..."
        />
        {status && <p className="mt-2 text-sm text-green-700">{status}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          <button type="button" disabled={!body.trim()} onClick={onSend} className="btn-primary rounded-md px-4 py-2 text-sm disabled:opacity-50">Send</button>
        </div>
      </div>
    </div>
  );
}
