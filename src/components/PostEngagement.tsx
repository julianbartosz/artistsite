'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Bookmark, Heart, Mail, MessageCircle, Share2 } from 'lucide-react';
import { useAnalytics } from '@/components/AnalyticsProvider';
import {
  updatesPostPath,
  type EngagementComment,
  type PostEngagementState,
  type UpdatesFeedCopy,
} from '@/lib/site-content-shared';

export type PostEngagementCopy = Pick<
  UpdatesFeedCopy,
  'showLikes' | 'showComments' | 'likeLabel' | 'commentsLabel' | 'saveUpdateLabel' | 'askArtistLabel'
>;

type PostEngagementProps = {
  slug: string;
  title: string;
  copy: PostEngagementCopy;
  signedIn: boolean;
  signInCallbackUrl: string;
  initialState: PostEngagementState;
  /** Supply with onStateChange when several surfaces (feed card + quick look) show the same post. */
  state?: PostEngagementState;
  onStateChange?: (next: PostEngagementState) => void;
  variant?: 'bar' | 'full';
  initialComments?: EngagementComment[];
  isAdmin?: boolean;
  trailing?: ReactNode;
};

const COMMENT_MAX_LENGTH = 2000;
const ACTION_CLASS = 'tap-target-inline gap-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
const IDLE_CLASS = 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';
const ACTIVE_CLASS = 'text-primary hover:bg-primary/10';

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return typeof data?.error === 'string' ? data.error : fallback;
}

export default function PostEngagement({
  slug,
  title,
  copy,
  signedIn,
  signInCallbackUrl,
  initialState,
  state: controlledState,
  onStateChange,
  variant = 'bar',
  initialComments = [],
  isAdmin = false,
  trailing,
}: PostEngagementProps) {
  const { trackSocialShare } = useAnalytics();
  const [localState, setLocalState] = useState(initialState);
  const state = controlledState ?? localState;
  const stateRef = useRef(state);
  stateRef.current = state;

  const [pending, setPending] = useState<'like' | 'save' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const permalink = updatesPostPath(slug);
  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(signInCallbackUrl)}`;
  const engagementUrl = `/api/updates/${encodeURIComponent(slug)}/engagement`;

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function update(patch: Partial<PostEngagementState>) {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    if (!controlledState) setLocalState(next);
    onStateChange?.(next);
  }

  async function toggleLike() {
    if (pending) return;
    const before = stateRef.current;
    const liked = !before.liked;
    update({ liked, likeCount: Math.max(0, before.likeCount + (liked ? 1 : -1)) });
    setPending('like');
    try {
      const response = await fetch(engagementUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', liked }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not update like.'));
      const data = await response.json();
      update({ liked: Boolean(data.liked), likeCount: Number(data.likeCount) || 0 });
    } catch (error) {
      update({ liked: before.liked, likeCount: before.likeCount });
      setNotice(error instanceof Error ? error.message : 'Could not update like.');
    } finally {
      setPending(null);
    }
  }

  async function toggleSave() {
    if (pending) return;
    const saved = !stateRef.current.saved;
    update({ saved });
    setPending('save');
    try {
      const response = saved
        ? await fetch('/api/account/saved-updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postSlug: slug }),
        })
        : await fetch(`/api/account/saved-updates/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readError(response, 'Could not update saved updates.'));
      setNotice(saved ? 'Saved to your account.' : 'Removed from saved.');
    } catch (error) {
      update({ saved: !saved });
      setNotice(error instanceof Error ? error.message : 'Could not update saved updates.');
    } finally {
      setPending(null);
    }
  }

  async function share() {
    const url = new URL(permalink, window.location.origin).toString();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        trackSocialShare('native_share', url);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice('Could not open sharing.');
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      trackSocialShare('copy_link', url);
      setNotice('Link copied.');
    } catch {
      setNotice(`Copy this link: ${url}`);
    }
  }

  const commentsHref = variant === 'full' ? '#comments' : `${permalink}#comments`;

  const bar = (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      {copy.showLikes && (
        <button
          type="button"
          onClick={() => void toggleLike()}
          aria-pressed={state.liked}
          disabled={pending === 'like'}
          className={`${ACTION_CLASS} ${state.liked ? ACTIVE_CLASS : IDLE_CLASS}`}
        >
          <Heart className="h-4 w-4" aria-hidden="true" fill={state.liked ? 'currentColor' : 'none'} />
          <span className="sr-only">{copy.likeLabel}</span>
          <span>{state.likeCount}</span>
        </button>
      )}
      {copy.showComments && (
        <Link href={commentsHref} className={`${ACTION_CLASS} ${IDLE_CLASS}`}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{copy.commentsLabel}</span>
          <span>{state.commentCount}</span>
        </Link>
      )}
      {signedIn ? (
        <button
          type="button"
          onClick={() => void toggleSave()}
          aria-pressed={state.saved}
          disabled={pending === 'save'}
          className={`${ACTION_CLASS} ${state.saved ? ACTIVE_CLASS : IDLE_CLASS}`}
        >
          <Bookmark className="h-4 w-4" aria-hidden="true" fill={state.saved ? 'currentColor' : 'none'} />
          <span className="sr-only sm:not-sr-only">{state.saved ? 'Saved' : copy.saveUpdateLabel}</span>
        </button>
      ) : (
        <Link href={signInHref} className={`${ACTION_CLASS} ${IDLE_CLASS}`} title={`Sign in to ${copy.saveUpdateLabel.toLowerCase()}`}>
          <Bookmark className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{copy.saveUpdateLabel}</span>
        </Link>
      )}
      {signedIn ? (
        <button type="button" onClick={() => setAskOpen(true)} className={`${ACTION_CLASS} ${IDLE_CLASS}`}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{copy.askArtistLabel}</span>
        </button>
      ) : (
        <Link href={signInHref} className={`${ACTION_CLASS} ${IDLE_CLASS}`} title="Sign in to message the artist">
          <Mail className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{copy.askArtistLabel}</span>
        </Link>
      )}
      <button type="button" onClick={() => void share()} className={`${ACTION_CLASS} ${IDLE_CLASS}`}>
        <Share2 className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Share</span>
      </button>
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );

  return (
    <div className={variant === 'full' ? 'mt-10 border-t border-gray-200 pt-6' : undefined}>
      {bar}
      <p role="status" aria-live="polite" className={notice ? 'mt-1 px-3 text-sm text-gray-600' : 'sr-only'}>
        {notice}
      </p>
      {variant === 'full' && copy.showComments && (
        <CommentThread
          engagementUrl={engagementUrl}
          label={copy.commentsLabel}
          signedIn={signedIn}
          signInHref={signInHref}
          isAdmin={isAdmin}
          initialComments={initialComments}
          commentCount={state.commentCount}
          onCountChange={(commentCount) => update({ commentCount })}
        />
      )}
      {askOpen && (
        <AskArtistDialog
          slug={slug}
          title={title}
          label={copy.askArtistLabel}
          onClose={() => setAskOpen(false)}
        />
      )}
    </div>
  );
}

function CommentThread({
  engagementUrl,
  label,
  signedIn,
  signInHref,
  isAdmin,
  initialComments,
  commentCount,
  onCountChange,
}: {
  engagementUrl: string;
  label: string;
  signedIn: boolean;
  signInHref: string;
  isAdmin: boolean;
  initialComments: EngagementComment[];
  commentCount: number;
  onCountChange: (count: number) => void;
}) {
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const olderCount = Math.max(0, commentCount - comments.length);

  async function submit() {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(engagementUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', body }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not post comment.'));
      const data = await response.json();
      setComments((current) => [...current, data.comment]);
      onCountChange(Number(data.commentCount) || commentCount + 1);
      setDraft('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not post comment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw(comment: EngagementComment) {
    setError(null);
    const response = comment.canRemove
      ? await fetch(engagementUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_comment', commentId: comment.id }),
      })
      : await fetch(`/api/admin/comments/${encodeURIComponent(comment.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'hidden' }),
      });
    if (!response.ok) {
      setError(await readError(response, 'Could not update comment.'));
      return;
    }
    const data = await response.json().catch(() => ({}));
    setComments((current) => current.filter((entry) => entry.id !== comment.id));
    onCountChange(typeof data.commentCount === 'number' ? data.commentCount : Math.max(0, commentCount - 1));
  }

  return (
    <section id="comments" className="mt-8 scroll-mt-24" aria-labelledby={`${fieldId}-heading`}>
      <h2 id={`${fieldId}-heading`} className="text-lg font-semibold text-gray-900">
        {label} <span className="font-normal text-gray-500">({commentCount})</span>
      </h2>
      {olderCount > 0 && (
        <p className="mt-1 text-sm text-gray-500">Showing the latest {comments.length} of {commentCount}.</p>
      )}

      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                {comment.authorName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium text-gray-900">{comment.authorName}</span>
                  <time dateTime={comment.createdAt} className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </time>
                  {(comment.canRemove || isAdmin) && (
                    <button type="button" onClick={() => void withdraw(comment)} className="text-xs text-gray-500 underline-offset-2 hover:text-red-700 hover:underline">
                      {comment.canRemove ? 'Delete' : 'Hide'}
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {signedIn ? (
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label htmlFor={fieldId} className="sr-only">Add a comment</label>
          <textarea
            id={fieldId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={COMMENT_MAX_LENGTH}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Add a comment..."
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-500">
              {draft.length > COMMENT_MAX_LENGTH * 0.9 ? `${COMMENT_MAX_LENGTH - draft.length} characters left` : ''}
            </span>
            <button type="submit" disabled={!draft.trim() || submitting} className="btn-primary rounded-md px-4 py-2 text-sm disabled:opacity-50">
              {submitting ? 'Posting...' : 'Post comment'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
        </form>
      ) : (
        <p className="mt-5 text-sm text-gray-600">
          <Link href={signInHref} className="font-medium text-primary hover:opacity-80">Sign in</Link> to join the conversation.
        </p>
      )}
    </section>
  );
}

function AskArtistDialog({
  slug,
  title,
  label,
  onClose,
}: {
  slug: string;
  title: string;
  label: string;
  onClose: () => void;
}) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  async function send() {
    const message = body.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/account/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postSlug: slug, postTitle: title, message }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not send message. Try again.'));
      setSent(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send message. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={headingId} className="text-lg font-semibold text-gray-900">{label}</h3>
        <p className="mt-1 text-sm text-gray-500">About: {title}</p>
        {sent ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-green-800">Message sent. Replies will appear in your account messages.</p>
            <div className="flex justify-end gap-2">
              <Link href="/account?tab=messages" className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">View messages</Link>
              <button type="button" onClick={onClose} className="btn-primary rounded-md px-4 py-2 text-sm">Done</button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label htmlFor={`${headingId}-message`} className="sr-only">Message</label>
            <textarea
              id={`${headingId}-message`}
              ref={fieldRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              maxLength={5000}
              className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ask about the piece, process, or availability..."
            />
            {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={!body.trim() || sending} className="btn-primary rounded-md px-4 py-2 text-sm disabled:opacity-50">
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
