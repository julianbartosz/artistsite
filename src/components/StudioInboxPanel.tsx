'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { adminSettingFieldHref } from '@/components/AdminSettings';
import { updatesPostPath } from '@/lib/site-content-shared';
import { CRM_STAGES, type CrmStage, type StudioMessageRecord, type StudioThreadSummary } from '@/lib/studio-inbox-shared';

const inboxFetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to load');
  return data;
};

const inboxSwrOptions = { revalidateOnFocus: false, dedupingInterval: 10_000 } as const;

type StudioInboxPanelProps = {
  mode: 'account' | 'admin';
  apiBase: '/api/account/messages' | '/api/admin/messages';
};

type ThreadDetail = {
  id: string;
  subject: string;
  userEmail: string;
  userName: string | null;
  relatedPostSlug: string | null;
  relatedOrderId: string | null;
  status: string;
  crmStage?: CrmStage;
  tags?: string[];
  messages: StudioMessageRecord[];
};

export default function StudioInboxPanel({ mode, apiBase }: StudioInboxPanelProps) {
  const {
    data: threadsData,
    error: threadsError,
    isLoading: loading,
    mutate: mutateThreads,
  } = useSWR<{ threads?: StudioThreadSummary[]; emailDeliveryMode?: 'smtp' | 'log' | 'unconfigured' }>(apiBase, inboxFetcher, inboxSwrOptions);
  const emailDeliveryMode = threadsData?.emailDeliveryMode;
  const threads: StudioThreadSummary[] = useMemo(
    () => (Array.isArray(threadsData?.threads) ? threadsData.threads : []),
    [threadsData],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [reply, setReply] = useState('');
  const [crmStage, setCrmStage] = useState<CrmStage>('new');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | CrmStage>('all');
  const [tagFilter, setTagFilter] = useState<'all' | 'commission' | 'unread'>('all');
  const streamRef = useRef<EventSource | null>(null);

  const error = actionError || (threadsError instanceof Error ? threadsError.message : null);

  async function loadThreads() {
    await mutateThreads();
  }

  async function loadThread(threadId: string) {
    setSelectedId(threadId);
    setActionError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(`${apiBase}/${threadId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load conversation');
      const loaded = data.thread || null;
      setThread(loaded);
      await mutateThreads(
        (current) => (current && Array.isArray(current.threads)
          ? { ...current, threads: current.threads.map((entry) => (entry.id === threadId ? { ...entry, unread: false } : entry)) }
          : current),
        { revalidate: false },
      );
      if (loaded) {
        setCrmStage(loaded.crmStage || 'new');
        setTagsInput(Array.isArray(loaded.tags) ? loaded.tags.join(', ') : '');
      }
    } catch (loadError) {
      setActionError(loadError instanceof Error ? loadError.message : 'Failed to load conversation');
      setThread(null);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setSaving(true);
    setActionError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(`${apiBase}/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send reply');
      setThread(data.thread || null);
      setReply('');
      if (mode === 'admin' && data.thread?.userEmail) {
        if (data.emailDelivery?.delivered) {
          setStatusMessage(`Reply saved and emailed to ${data.thread.userEmail}.`);
        } else {
          setStatusMessage(`Reply saved to conversation. Email delivery is off — use Email directly above to notify ${data.thread.userEmail}.`);
        }
      }
      await loadThreads();
    } catch (sendError) {
      setActionError(sendError instanceof Error ? sendError.message : 'Failed to send reply');
    } finally {
      setSaving(false);
    }
  }

  async function copyCollectorEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      setStatusMessage(`Collector email: ${email}`);
    }
  }

  async function saveCrm() {
    if (mode !== 'admin' || !selectedId) return;
    const tags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
    setStatusMessage(null);
    try {
      const response = await fetch(`${apiBase}/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmStage, tags }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to save CRM details');
      setActionError(null);
      await loadThreads();
      await loadThread(selectedId);
      setStatusMessage('CRM details saved.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save CRM details');
    }
  }

  async function updateThreadStatus(nextStatus: 'open' | 'closed') {
    if (mode !== 'admin' || !selectedId) return;
    setStatusMessage(null);
    try {
      const response = await fetch(`${apiBase}/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Failed to ${nextStatus === 'closed' ? 'close' : 'reopen'} conversation`);
      setActionError(null);
      await loadThreads();
      await loadThread(selectedId);
      setStatusMessage(nextStatus === 'closed' ? 'Conversation closed.' : 'Conversation reopened.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update conversation status');
    }
  }

  useEffect(() => {
    streamRef.current?.close();
    streamRef.current = null;
    if (!selectedId) return;

    const source = new EventSource(`/api/studio/stream/${encodeURIComponent(selectedId)}`);
    streamRef.current = source;

    source.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as StudioMessageRecord;
        setThread((current) => {
          if (!current || current.id !== selectedId) return current;
          if (current.messages.some((entry) => entry.id === message.id)) return current;
          return { ...current, messages: [...current.messages, message] };
        });
      } catch {
        // Ignore malformed stream payloads.
      }
    });

    return () => {
      source.close();
      if (streamRef.current === source) streamRef.current = null;
    };
  }, [selectedId]);

  const filteredThreads = threads.filter((entry) => {
    if (stageFilter !== 'all' && entry.crmStage !== stageFilter) return false;
    if (tagFilter === 'unread' && !entry.unread) return false;
    if (tagFilter === 'commission' && !(entry.tags || []).includes('commission')) return false;
    const needle = listQuery.trim().toLowerCase();
    if (!needle) return true;
    const haystack = [
      entry.subject,
      entry.userEmail,
      entry.userName || '',
      entry.lastPreview,
      ...(entry.tags || []),
    ].join(' ').toLowerCase();
    return haystack.includes(needle);
  });

  if (loading) {
    return <p className="text-sm text-gray-500">Loading messages...</p>;
  }

  if (mode === 'account' && threads.length === 0) {
    return (
      <div className="py-10 text-center">
        <h2 className="text-base font-medium text-gray-900 mb-2">No messages yet</h2>
        <p className="mx-auto max-w-md text-sm text-gray-500 mb-5">
          Have a question about an artwork, shipping, or a custom commission? Send a note to the studio and replies will appear right here.
        </p>
        <Link href="/contact" className="btn-primary px-5 py-2 inline-block text-sm">
          Message the studio
        </Link>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      <div className="flex flex-col space-y-2 lg:col-span-1 lg:h-[calc(100vh-14rem)] lg:min-h-[32rem] lg:max-h-[46rem]">
        <div className="shrink-0 space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">{mode === 'admin' ? 'Inbox' : 'Messages'}</h2>
          {mode === 'admin' && threads.length > 0 && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-2">
              <input
                type="search"
                value={listQuery}
                onChange={(event) => setListQuery(event.target.value)}
                placeholder="Search subject, email, tags…"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value as 'all' | CrmStage)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  aria-label="Filter by CRM stage"
                >
                  <option value="all">All stages</option>
                  {CRM_STAGES.map((stage) => (
                    <option key={stage} value={stage}>{stage.charAt(0).toUpperCase() + stage.slice(1)}</option>
                  ))}
                </select>
                <select
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value as 'all' | 'commission' | 'unread')}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  aria-label="Filter by focus"
                >
                  <option value="all">All threads</option>
                  <option value="unread">Unread</option>
                  <option value="commission">Commissions</option>
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-2 lg:overflow-y-auto lg:pr-1">
          {threads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-5">
              <p className="text-sm font-medium text-gray-900">No conversations yet</p>
              <p className="mt-1 text-xs text-gray-500">
                {mode === 'admin'
                  ? 'Messages from the contact form, order chat, and update questions land here.'
                  : 'When you message the studio, the conversation appears here.'}
              </p>
            </div>
          ) : filteredThreads.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-5 text-sm text-gray-500">
              No conversations match these filters.
            </p>
          ) : (
            filteredThreads.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => void loadThread(entry.id)}
                className={`block w-full rounded-lg border bg-white p-3 text-left ${selectedId === entry.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{entry.subject}</span>
                  {entry.unread && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-white">New</span>}
                </div>
                {mode === 'admin' && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{entry.userName || entry.userEmail}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 capitalize">{entry.crmStage}</span>
                    {(entry.tags || []).slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5">{tag}</span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-600 line-clamp-2">{entry.lastPreview}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex min-h-[24rem] flex-col rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2 lg:h-[calc(100vh-14rem)] lg:min-h-[32rem] lg:max-h-[46rem]">
        {!thread ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-gray-500">Select a conversation to read and reply.</p>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b pb-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{thread.subject}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                    thread.status === 'closed' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {thread.status}
                </span>
              </div>
              {mode === 'admin' && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                  <span>{thread.userName ? `${thread.userName} · ${thread.userEmail}` : thread.userEmail}</span>
                  <a
                    href={`mailto:${encodeURIComponent(thread.userEmail)}?subject=${encodeURIComponent(/^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`)}`}
                    className="text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Email directly
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyCollectorEmail(thread.userEmail)}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    {copiedEmail ? 'Copied' : 'Copy email'}
                  </button>
                </div>
              )}
              {mode === 'admin' && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-gray-700">
                    Stage
                    <select value={crmStage} onChange={(event) => setCrmStage(event.target.value as CrmStage)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                      {CRM_STAGES.map((stage) => (
                        <option key={stage} value={stage}>{stage.charAt(0).toUpperCase() + stage.slice(1)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-gray-700">
                    Tags (comma-separated)
                    <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <button type="button" onClick={() => void saveCrm()} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      Save CRM details
                    </button>
                    {thread.status === 'open' ? (
                      <button type="button" onClick={() => void updateThreadStatus('closed')} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        Mark closed
                      </button>
                    ) : (
                      <button type="button" onClick={() => void updateThreadStatus('open')} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-gray-50">
                        Reopen conversation
                      </button>
                    )}
                    {thread.relatedPostSlug && (
                      <Link href={updatesPostPath(thread.relatedPostSlug)} className="ml-auto text-xs font-medium text-primary hover:opacity-80">
                        Related update
                      </Link>
                    )}
                    {thread.relatedOrderId && (
                      <Link href={`/orders/${thread.relatedOrderId}`} className="text-xs font-medium text-primary hover:opacity-80">
                        Related order
                      </Link>
                    )}
                  </div>
                </div>
              )}
              {mode !== 'admin' && (thread.relatedPostSlug || thread.relatedOrderId) && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {thread.relatedPostSlug && (
                    <Link href={updatesPostPath(thread.relatedPostSlug)} className="text-primary hover:opacity-80">
                      Related update
                    </Link>
                  )}
                  {thread.relatedOrderId && (
                    <Link href={`/orders/${thread.relatedOrderId}`} className="text-primary hover:opacity-80">
                      Related order
                    </Link>
                  )}
                </div>
              )}
              {statusMessage && (
                <p role="status" className="mt-2 text-xs font-medium text-green-700">{statusMessage}</p>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
              {thread.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg px-3 py-2 text-sm ${message.senderRole === 'artist' ? 'ml-8 bg-primary/10 text-gray-900' : 'mr-8 bg-gray-100 text-gray-800'}`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                    {message.senderRole === 'artist' ? 'Artist' : mode === 'admin' ? 'Collector' : 'You'} · {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {thread.status !== 'closed' && (
              <div className="shrink-0 border-t pt-3">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder={mode === 'admin' ? 'Write a reply to the collector...' : 'Write a reply to the artist...'}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {mode === 'admin' && emailDeliveryMode && emailDeliveryMode !== 'smtp' ? (
                    <p className="text-xs text-gray-500">
                      Email delivery is off — replies save to the collector’s account only. Use <strong>Email directly</strong> above for guest inquiries, or{' '}
                      <Link href={adminSettingFieldHref('EMAIL_DELIVERY_MODE')} className="font-medium text-gray-700 underline hover:text-gray-900">
                        enable SMTP →
                      </Link>
                    </p>
                  ) : (
                    <span />
                  )}
                  <button type="button" disabled={saving || !reply.trim()} onClick={() => void sendReply()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                    {saving ? 'Sending...' : 'Send reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {mode === 'admin' && (
        <div className="lg:col-span-3">
          <HiddenCommentsPanel />
        </div>
      )}
    </div>
  );
}

type HiddenComment = {
  id: string;
  postSlug: string;
  body: string;
  authorName: string;
  updatedAt: string;
};

function HiddenCommentsPanel() {
  const {
    data: commentsData,
    error: commentsError,
    isLoading: loading,
    mutate: mutateComments,
  } = useSWR<{ comments?: HiddenComment[] }>('/api/admin/comments', inboxFetcher, inboxSwrOptions);
  const comments: HiddenComment[] = Array.isArray(commentsData?.comments) ? commentsData.comments : [];
  const [message, setMessage] = useState<string | null>(null);

  async function restoreComment(commentId: string) {
    setMessage(null);
    const response = await fetch(`/api/admin/comments/${encodeURIComponent(commentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'visible' }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Failed to restore comment');
      return;
    }
    setMessage('Comment restored.');
    await mutateComments();
  }

  const displayMessage = message || (commentsError instanceof Error ? commentsError.message : null);

  return (
    <section className="mt-6 rounded-lg border bg-white p-5">
      <h3 className="text-lg font-semibold text-gray-900">Hidden comments</h3>
      <p className="mt-1 text-sm text-gray-600">Comments you hid from public updates appear here. Comments their authors deleted are not restorable.</p>
      {displayMessage && <p className="mt-3 text-sm text-blue-800">{displayMessage}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No hidden comments.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {comments.map((comment) => (
            <li key={comment.id} className="py-3 text-sm">
              <p className="font-medium text-gray-900">
                {comment.authorName} on{' '}
                <Link href={updatesPostPath(comment.postSlug)} className="text-primary hover:opacity-80">{comment.postSlug}</Link>
              </p>
              <p className="mt-1 text-gray-700">{comment.body}</p>
              <button type="button" onClick={() => void restoreComment(comment.id)} className="mt-2 rounded border px-2 py-1 text-xs">
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
