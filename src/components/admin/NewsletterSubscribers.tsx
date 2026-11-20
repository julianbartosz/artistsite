'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { newsletterRequest } from '@/components/admin/NewsletterEditor';

type Subscriber = { profileId: string; email: string; firstName: string | null; name: string | null; subscribedAt: string };

export default function NewsletterSubscribers({ onChange }: { onChange: () => void }) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<{ subscribers: Subscriber[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    try {
      setData(await newsletterRequest(`/api/admin/newsletters/subscribers?q=${encodeURIComponent(search)}`));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load subscribers.');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(query), 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  async function mutate(key: string, task: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await task();
      await load(query);
      onChange();
      return true;
    } catch (mutateError) {
      setError(mutateError instanceof Error ? mutateError.message : 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const added = await mutate('add', () => newsletterRequest('/api/admin/newsletters/subscribers', { method: 'POST', body: { email: newEmail } }));
    if (added) setNewEmail('');
  }

  function handleRemove(email: string) {
    if (!window.confirm(`Unsubscribe ${email}? They won’t receive newsletters unless they sign up again.`)) return;
    void mutate(email, () => newsletterRequest(`/api/admin/newsletters/subscribers?email=${encodeURIComponent(email)}`, { method: 'DELETE' }));
  }

  const subscribers = data?.subscribers ?? [];

  return (
    <div className="rounded-lg border bg-white p-6 space-y-4" data-testid="newsletter-subscribers">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email"
          aria-label="Search subscribers"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="Add an email"
              aria-label="Email to add"
              className="block w-48 rounded-md border border-gray-300 px-3 py-2 text-gray-900"
            />
            <button type="submit" disabled={busy !== null} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {busy === 'add' ? 'Adding…' : 'Add'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => window.location.assign('/api/admin/newsletters/subscribers?format=csv')}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {data === null ? (
        <p className="text-sm text-gray-500">Loading subscribers…</p>
      ) : subscribers.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          {query.trim()
            ? 'No subscribers match that search.'
            : <>No subscribers yet. People join from the signup form on your site — <a href="/subscribe" target="_blank" rel="noreferrer" className="underline">view the signup page</a>.</>}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Subscribed</th>
                <th className="py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subscribers.map((subscriber) => (
                <tr key={subscriber.profileId}>
                  <td className="py-2 pr-4 text-gray-900">{subscriber.email}</td>
                  <td className="py-2 pr-4 text-gray-600">{subscriber.name || '—'}</td>
                  <td className="py-2 pr-4 text-gray-600">{new Date(subscriber.subscribedAt).toLocaleDateString()}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(subscriber.email)}
                      disabled={busy !== null}
                      className="text-xs font-medium text-gray-600 hover:text-red-700 disabled:opacity-50"
                    >
                      {busy === subscriber.email ? 'Removing…' : 'Unsubscribe'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.total > subscribers.length && (
            <p className="mt-3 text-xs text-gray-500">Showing the newest {subscribers.length.toLocaleString()} of {data.total.toLocaleString()}. Search to find someone specific.</p>
          )}
        </div>
      )}
    </div>
  );
}
