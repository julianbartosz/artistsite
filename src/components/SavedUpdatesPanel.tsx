'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PostMedia from '@/components/PostMedia';
import UpdateQuickLook, { type UpdateQuickLookPost } from '@/components/UpdateQuickLook';
import { updatesPostPath } from '@/lib/site-content-shared';

type SavedPost = UpdateQuickLookPost & {
  coverImage?: string;
};

type SavedItem = {
  postSlug: string;
  savedAt: string;
  post: SavedPost | null;
};

type SavedUpdatesPanelProps = {
  journalLabel?: string;
  studioLabel?: string;
  quickLookLabel?: string;
};

export default function SavedUpdatesPanel({
  journalLabel = 'Journal',
  studioLabel = 'Studio',
  quickLookLabel = 'Quick look',
}: SavedUpdatesPanelProps) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePost, setActivePost] = useState<SavedPost | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/account/saved-updates', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load saved updates');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load saved updates');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  async function removeSaved(slug: string) {
    const response = await fetch(`/api/account/saved-updates/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    if (!response.ok) return;
    setItems((current) => current.filter((item) => item.postSlug !== slug));
    if (activePost?.slug === slug) setActivePost(null);
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading saved updates...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <h3 className="text-sm font-medium text-gray-900 mb-2">No saved updates yet</h3>
        <p className="text-sm text-gray-500 mb-4">Tap save on any update in the feed to bookmark it here.</p>
        <Link href="/updates" className="btn-primary px-4 py-2 rounded-md inline-block">Browse updates</Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const post = item.post;
          if (!post) {
            return (
              <div key={item.postSlug} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">This update is no longer available.</p>
                <button type="button" onClick={() => void removeSaved(item.postSlug)} className="mt-2 text-sm text-gray-600 hover:text-red-600">
                  Remove
                </button>
              </div>
            );
          }

          const headline = post.format === 'short' ? (post.excerpt || post.title) : post.title;
          return (
            <div key={item.postSlug} className="overflow-hidden rounded-lg border border-gray-200 card-surface">
              {post.media.length > 0 ? (
                <button type="button" className="block w-full text-left" onClick={() => setActivePost(post)}>
                  <PostMedia items={post.media} title={post.title} layout="grid" />
                </button>
              ) : post.coverImage ? (
                <button type="button" className="block w-full text-left" onClick={() => setActivePost(post)}>
                  <div className="relative aspect-square overflow-hidden bg-gray-100">
                    <img src={post.coverImage} alt={post.title} className="h-full w-full object-cover" />
                  </div>
                </button>
              ) : (
                <button type="button" className="flex aspect-square w-full items-end bg-gray-100 p-4 text-left" onClick={() => setActivePost(post)}>
                  <span className="text-lg font-semibold text-gray-900">{headline}</span>
                </button>
              )}
              <div className="p-4 space-y-2">
                <p className="font-medium text-gray-900 line-clamp-2">{headline}</p>
                <p className="text-xs text-gray-500">Saved {new Date(item.savedAt).toLocaleDateString()}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link href={updatesPostPath(post.slug)} className="font-medium text-primary hover:opacity-80">Open</Link>
                  <button type="button" onClick={() => setActivePost(post)} className="font-medium text-gray-600 hover:text-gray-900">{quickLookLabel}</button>
                  <button type="button" onClick={() => void removeSaved(post.slug)} className="font-medium text-gray-600 hover:text-red-600">Remove</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <UpdateQuickLook
        post={activePost}
        open={Boolean(activePost)}
        onClose={() => setActivePost(null)}
        journalLabel={journalLabel}
        studioLabel={studioLabel}
        quickLookLabel={quickLookLabel}
        signedIn
        saved
        onToggleSave={(post) => void removeSaved(post.slug)}
      />
    </>
  );
}
