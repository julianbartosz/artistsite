'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type EngagementComment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
};

type PostEngagementProps = {
  slug: string;
  signedIn: boolean;
  signInCallbackUrl: string;
  showComments?: boolean;
  showLikes?: boolean;
  commentsLabel?: string;
  likeLabel?: string;
  compact?: boolean;
  isAdmin?: boolean;
};

export default function PostEngagement({
  slug,
  signedIn,
  signInCallbackUrl,
  showComments = true,
  showLikes = true,
  commentsLabel = 'Comments',
  likeLabel = 'Like',
  compact = false,
  isAdmin = false,
}: PostEngagementProps) {
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<EngagementComment[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const loadEngagement = useCallback(async () => {
    const response = await fetch(`/api/updates/${encodeURIComponent(slug)}/engagement`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.engagement) return;
    setLikeCount(data.engagement.likeCount || 0);
    setLiked(Boolean(data.engagement.liked));
    setComments(Array.isArray(data.engagement.comments) ? data.engagement.comments : []);
  }, [slug]);

  useEffect(() => {
    void loadEngagement();
  }, [loadEngagement]);

  async function toggleLike() {
    const response = await fetch(`/api/updates/${encodeURIComponent(slug)}/engagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'like' }),
    });
    if (!response.ok) return;
    const data = await response.json();
    setLiked(Boolean(data.liked));
    setLikeCount(data.likeCount || 0);
  }

  async function submitComment() {
    if (!signedIn || !draft.trim()) return;
    setStatus(null);
    const response = await fetch(`/api/updates/${encodeURIComponent(slug)}/engagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'comment', body: draft.trim() }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || 'Could not post comment.');
      return;
    }
    setComments((current) => [...current, data.comment]);
    setDraft('');
    setStatus('Comment posted.');
  }

  async function hideComment(commentId: string) {
    const response = await fetch(`/api/admin/comments/${encodeURIComponent(commentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'hidden' }),
    });
    if (!response.ok) return;
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }

  if (!showComments && !showLikes) return null;

  return (
    <div className={compact ? 'space-y-3' : 'mt-8 space-y-4 border-t border-gray-200 pt-6'}>
      {showLikes && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void toggleLike()}
            className={`rounded-md border px-3 py-1.5 text-sm ${liked ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {liked ? 'Liked' : likeLabel}
          </button>
          <span className="text-sm text-gray-500">{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
        </div>
      )}

      {showComments && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{commentsLabel}</h3>
          <div className="mt-3 space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">No comments yet.</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.body}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{comment.authorName} · {new Date(comment.createdAt).toLocaleString()}</span>
                    {isAdmin && (
                      <button type="button" onClick={() => void hideComment(comment.id)} className="text-red-600 hover:text-red-800">
                        Hide
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {signedIn ? (
            <div className="mt-4 space-y-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Share your thoughts..."
              />
              <div className="flex justify-end">
                <button type="button" disabled={!draft.trim()} onClick={() => void submitComment()} className="btn-primary rounded-md px-4 py-2 text-sm disabled:opacity-50">
                  Post comment
                </button>
              </div>
              {status && <p className="text-sm text-green-700">{status}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-600">
              <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(signInCallbackUrl)}`} className="text-primary hover:opacity-80">
                Sign in
              </Link>
              {' '}to leave a comment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
