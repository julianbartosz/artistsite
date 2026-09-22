'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import PostMedia from '@/components/PostMedia';
import { updatesPostPath } from '@/lib/site-content-shared';
import type { PostMediaItem } from '@/lib/admin-content';

export type UpdateQuickLookPost = {
  slug: string;
  title: string;
  excerpt: string;
  format: 'article' | 'short';
  visibility: 'public' | 'private';
  publishedAt: string;
  media: PostMediaItem[];
  pullQuote?: string;
  location?: string;
  processStage?: string;
  featured?: boolean;
};

type UpdateQuickLookProps = {
  post: UpdateQuickLookPost | null;
  open: boolean;
  onClose: () => void;
  journalLabel: string;
  studioLabel: string;
  quickLookLabel?: string;
  signedIn?: boolean;
  onAskArtist?: (post: UpdateQuickLookPost) => void;
  onToggleSave?: (post: UpdateQuickLookPost) => void;
  saved?: boolean;
  saveLabel?: string;
  askLabel?: string;
};

export default function UpdateQuickLook({
  post,
  open,
  onClose,
  journalLabel,
  studioLabel,
  quickLookLabel = 'Quick look',
  signedIn = false,
  onAskArtist,
  onToggleSave,
  saved = false,
  saveLabel = 'Save',
  askLabel = 'Ask the artist',
}: UpdateQuickLookProps) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !post) return null;

  const isShort = post.format === 'short';
  const headline = isShort ? (post.excerpt || post.title) : post.title;
  const dateLabel = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${quickLookLabel}: ${headline}`}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {isShort ? studioLabel : journalLabel}
              {post.visibility === 'private' && ' · Collectors'}
              {post.featured && ' · Featured'}
            </p>
            <h2 className="text-lg font-semibold text-gray-900">{headline}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">Close</button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-sm text-gray-500">{dateLabel}{post.location ? ` · ${post.location}` : ''}{post.processStage ? ` · ${post.processStage}` : ''}</p>
          {post.pullQuote && (
            <blockquote className="border-l-4 border-primary/40 pl-4 text-lg italic text-gray-700">{post.pullQuote}</blockquote>
          )}
          {post.media.length > 0 && <PostMedia items={post.media} title={post.title} layout="detail" />}
          {!isShort && post.excerpt && <p className="text-gray-700">{post.excerpt}</p>}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={updatesPostPath(post.slug)} className="btn-primary inline-flex rounded-md px-4 py-2 text-sm">
              View full post
            </Link>
            {signedIn && onToggleSave && (
              <button type="button" onClick={() => onToggleSave(post)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {saved ? 'Saved' : saveLabel}
              </button>
            )}
            {signedIn && onAskArtist && (
              <button type="button" onClick={() => onAskArtist(post)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {askLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
