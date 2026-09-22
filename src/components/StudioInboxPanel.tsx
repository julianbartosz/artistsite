'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { updatesPostPath } from '@/lib/site-content-shared';
import { CRM_STAGES, type CrmStage, type StudioMessageRecord, type StudioThreadSummary } from '@/lib/studio-inbox-shared';

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
  const [threads, setThreads] = useState<StudioThreadSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [reply, setReply] = useState('');
  const [crmStage, setCrmStage] = useState<CrmStage>('new');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  async function loadThreads() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiBase, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load messages');
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(threadId: string) {
    setSelectedId(threadId);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/${threadId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load conversation');
      const loaded = data.thread || null;
      setThread(loaded);
      if (loaded) {
        setCrmStage(loaded.crmStage || 'new');
        setTagsInput(Array.isArray(loaded.tags) ? loaded.tags.join(', ') : '');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load conversation');
      setThread(null);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    setSaving(true);
    setError(null);
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
      await loadThreads();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send reply');
    } finally {
      setSaving(false);
    }
  }

  async function saveCrm() {
    if (mode !== 'admin' || !selectedId) return;
    const tags = tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean);
    await fetch(`${apiBase}/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crmStage, tags }),
    });
    await loadThreads();
    await loadThread(selectedId);
  }

  async function closeThread() {
    if (mode !== 'admin' || !selectedId) return;
    await fetch(`${apiBase}/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    await loadThreads();
    await loadThread(selectedId);
  }

  useEffect(() => {
    void loadThreads();
  }, [apiBase]);

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

  if (loading) {
    return <p className="text-sm text-gray-500">Loading messages...</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-2 lg:col-span-1">
        <h2 className="text-sm font-semibold text-gray-900">{mode === 'admin' ? 'Inbox' : 'Messages'}</h2>
        {threads.length === 0 ? (
          <p className="text-sm text-gray-500">No conversations yet.</p>
        ) : (
          threads.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => void loadThread(entry.id)}
              className={`block w-full rounded-lg border p-3 text-left ${selectedId === entry.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-900">{entry.subject}</span>
                {entry.unread && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-white">New</span>}
              </div>
              {mode === 'admin' && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>{entry.userName || entry.userEmail}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 capitalize">{entry.crmStage}</span>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-600 line-clamp-2">{entry.lastPreview}</p>
            </button>
          ))
        )}
      </div>

      <div className="lg:col-span-2 rounded-lg border border-gray-200 p-4 min-h-[24rem]">
        {!thread ? (
          <p className="text-sm text-gray-500">Select a conversation to read and reply.</p>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b pb-3">
              <h3 className="text-lg font-semibold text-gray-900">{thread.subject}</h3>
              {mode === 'admin' && (
                <p className="text-sm text-gray-500">{thread.userName || thread.userEmail}</p>
              )}
              {mode === 'admin' && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-gray-700">
                    Stage
                    <select value={crmStage} onChange={(event) => setCrmStage(event.target.value as CrmStage)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                      {CRM_STAGES.map((stage) => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-gray-700">
                    Tags (comma-separated)
                    <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                  </label>
                  <div className="sm:col-span-2">
                    <button type="button" onClick={() => void saveCrm()} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                      Save CRM details
                    </button>
                  </div>
                </div>
              )}
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
                {mode === 'admin' && thread.status === 'open' && (
                  <button type="button" onClick={() => void closeThread()} className="text-gray-600 hover:text-gray-900">
                    Mark closed
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto py-4">
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
              <div className="border-t pt-3">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder={mode === 'admin' ? 'Write a reply to the collector...' : 'Write a reply to the artist...'}
                />
                <div className="mt-2 flex justify-end">
                  <button type="button" disabled={saving || !reply.trim()} onClick={() => void sendReply()} className="btn-primary rounded-md px-4 py-2 text-sm disabled:opacity-50">
                    {saving ? 'Sending...' : 'Send reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {mode === 'admin' && <HiddenCommentsPanel />}
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
  const [comments, setComments] = useState<HiddenComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadComments() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/comments', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load hidden comments');
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load hidden comments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadComments();
  }, []);

  async function restoreComment(commentId: string) {
    setMessage(null);
    const response = await fetch(`/api/admin/comments/${encodeURIComponent(commentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: true }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Failed to restore comment');
      return;
    }
    setMessage('Comment restored.');
    await loadComments();
  }

  return (
    <section className="mt-6 rounded-lg border bg-white p-5">
      <h3 className="text-lg font-semibold text-gray-900">Hidden comments</h3>
      <p className="mt-1 text-sm text-gray-600">Comments you hid from public updates appear here.</p>
      {message && <p className="mt-3 text-sm text-blue-800">{message}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Loading...</p>
      ) : comments.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No hidden comments.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {comments.map((comment) => (
            <li key={comment.id} className="py-3 text-sm">
              <p className="font-medium text-gray-900">{comment.authorName} on {comment.postSlug}</p>
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
